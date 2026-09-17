// Vercel serverless function: ingests PayPal Commerce Platform donation
// events into the `donations` table (migrations/2026-09-17_donations-
// paypal-provider.sql), the same table api/webhooks/stripe.js writes to.
// See Output/handoff/2026-09-17_paypal-commerce-integration.md.
//
// Why a remote verify call, unlike Stripe's and Resend's local HMAC:
// Stripe and Resend both sign with a shared secret, so this repo verifies
// locally with plain crypto (see api/webhooks/stripe.js's own header
// comment). PayPal V2 webhooks sign asymmetrically instead -- the
// signature is checked against a certificate PayPal serves at a rotating
// URL -- and getting that caching right (rotation, invalidation) is a
// real place to introduce a silent "accepts a forged webhook" bug for
// very little payoff at Reimagine's donation volume. This handler calls
// PayPal's own /v1/notifications/verify-webhook-signature endpoint
// instead and accepts the extra round trip. Revisit only if webhook
// volume ever makes the latency matter.
//
// Handles four event types (all four are what the PayPal Sandbox app's
// webhook subscription was set up to send):
//   PAYMENT.CAPTURE.COMPLETED -- records a new donation. carries custom_id
//     (the Reimagine user id SupportPanel/PayPalDonate attach when the
//     donor is signed in) and the capture amount.
//   PAYMENT.CAPTURE.DECLINED  -- no successful payment to record; ignored.
//   PAYMENT.CAPTURE.REFUNDED / PAYMENT.CAPTURE.REVERSED -- updates the
//     existing row's status in place rather than inserting a second row.
//     The refund/reversal resource does not carry the original capture's
//     custom_id, only a `links` entry (rel "up") pointing back at
//     /v2/payments/captures/<capture id>; the update is keyed on that id.
//
// Auth: none needed beyond the signature check -- unlike Stripe's flow,
// PayPal orders are always one-time (no subscription analog is wired up
// here), so there is no "look up the linked customer" step.
//
// Failure-mode contract (PayPal retries any non-2xx):
//   - Method other than POST                 -> 405
//   - PAYPAL_WEBHOOK_ID / client creds unset  -> 500 (PayPal retries; fix the env var)
//   - Signature verification call failed      -> 500 (worth a retry)
//   - Signature did not verify                -> 400
//   - Event type we don't want                -> 200 (ignored)
//   - Refund/reversal with no matching capture -> 200 (nothing to update)
//   - Database write failure                  -> 500 (worth a retry)
//   - Success                                 -> 200 { ok: true }

import { sql } from '../_lib/db.js'
import { asText, UUID_RE, paypalFetch } from '../_lib/paypal.js'

async function recordDonation({ dedupeKey, reimagineUserId, orderId, captureId, amountCents, currency, donatedAt }) {
  await sql`
    INSERT INTO donations (
      dedupe_key, reimagine_user_id, provider, status,
      paypal_order_id, paypal_capture_id, amount_cents, currency, frequency,
      donor_email, donated_at
    )
    VALUES (
      ${dedupeKey}, ${reimagineUserId}, 'paypal', 'completed',
      ${orderId}, ${captureId}, ${amountCents}, ${currency}, 'once',
      NULL, ${donatedAt}::timestamptz
    )
    ON CONFLICT (dedupe_key) DO NOTHING
  `
}

async function markCaptureStatus(captureId, status) {
  if (!captureId) return
  await sql`
    UPDATE donations SET status = ${status}
     WHERE paypal_capture_id = ${captureId} AND provider = 'paypal'
  `
}

// A refund/reversal resource's `links` array has a rel:"up" entry whose
// href is .../v2/payments/captures/<capture id>?... -- the only place the
// original capture id appears on these two event types.
function captureIdFromLinks(resource) {
  const links = (resource && Array.isArray(resource.links)) ? resource.links : []
  const up = links.find(l => l && l.rel === 'up' && typeof l.href === 'string')
  if (!up) return null
  const match = up.href.match(/\/captures\/([A-Za-z0-9-]+)/)
  return match ? match[1] : null
}

function centsFromAmount(amount) {
  const n = Number(amount && amount.value)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const webhookId = process.env.PAYPAL_WEBHOOK_ID
  if (!webhookId) {
    console.error('webhooks/paypal: PAYPAL_WEBHOOK_ID not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  const event = req.body
  if (!event || typeof event !== 'object') {
    // Unparseable JSON never reaches here -- @vercel/node's body parser
    // already 400s before the handler runs -- so this is only a truly
    // empty body.
    return res.status(200).json({ ok: true, ignored: 'empty body' })
  }

  try {
    const { ok: verifyOk, json: verifyJson } = await paypalFetch('/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      body: {
        auth_algo: req.headers['paypal-auth-algo'],
        cert_url: req.headers['paypal-cert-url'],
        transmission_id: req.headers['paypal-transmission-id'],
        transmission_sig: req.headers['paypal-transmission-sig'],
        transmission_time: req.headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: event,
      },
    })
    if (!verifyOk) {
      console.error('webhooks/paypal: verify-webhook-signature request failed')
      return res.status(500).json({ error: 'Verification request failed' })
    }
    if (!verifyJson || verifyJson.verification_status !== 'SUCCESS') {
      return res.status(400).json({ error: 'Signature did not verify' })
    }
  } catch (err) {
    console.error('webhooks/paypal: verify-webhook-signature failed', err && err.message)
    return res.status(500).json({ error: 'Verification request failed' })
  }

  const type = asText(event.event_type)
  const resource = event.resource || {}

  try {
    if (type === 'PAYMENT.CAPTURE.COMPLETED') {
      const captureId = asText(resource.id)
      if (!captureId) return res.status(200).json({ ok: true, ignored: 'no capture id' })
      const refId = asText(resource.custom_id)
      const reimagineUserId = refId && UUID_RE.test(refId) ? refId : null
      await recordDonation({
        dedupeKey: `pp:${captureId}`,
        reimagineUserId,
        orderId: asText((resource.supplementary_data && resource.supplementary_data.related_ids && resource.supplementary_data.related_ids.order_id) || null),
        captureId,
        amountCents: centsFromAmount(resource.amount),
        currency: (asText(resource.amount && resource.amount.currency_code) || 'USD').toLowerCase(),
        donatedAt: asText(resource.create_time) || new Date().toISOString(),
      })
      return res.status(200).json({ ok: true, type })
    }

    if (type === 'PAYMENT.CAPTURE.REFUNDED' || type === 'PAYMENT.CAPTURE.REVERSED') {
      const captureId = captureIdFromLinks(resource)
      if (!captureId) return res.status(200).json({ ok: true, ignored: 'no linked capture' })
      await markCaptureStatus(captureId, type === 'PAYMENT.CAPTURE.REFUNDED' ? 'refunded' : 'reversed')
      return res.status(200).json({ ok: true, type })
    }

    return res.status(200).json({ ok: true, ignored: type || 'untyped' })
  } catch (err) {
    console.error('webhooks/paypal: write failed', err)
    return res.status(500).json({ error: 'Write failed' })
  }
}
