// Vercel serverless function: ingests direct Career Club donations from the
// career.club Stripe account (acct_1IQLNEK4uJoqzRSd) into the `donations`
// table (migrations/2026-09-16_donations.sql).
//
// Why this exists: the "Pay It Forward" support links (SUPPORT_PANEL_COPY,
// src/App.jsx) are plain donate.stripe.com Payment Links, not a backend
// checkout flow. Stripe supports attaching a client_reference_id to a
// Payment Link via a `?client_reference_id=` URL parameter
// (https://docs.stripe.com/payment-links/url-parameters), and that value
// round-trips onto the resulting Checkout Session and this webhook's
// checkout.session.completed event. SupportPanel appends the signed-in
// user's id there -- that is the ONLY linkage between a Stripe payment and
// a Reimagine account; nothing else correlates the two.
//
// Handles two event types:
//   checkout.session.completed -- every donation's first payment: a
//     one-time gift, or the first month of the $10/mo subscription.
//     Carries client_reference_id.
//   invoice.payment_succeeded  -- a recurring donation's 2nd+ monthly
//     charge. Only processed when billing_reason is 'subscription_cycle'
//     (a genuine renewal) -- the first invoice of a new subscription also
//     fires this event with billing_reason 'subscription_create', and that
//     one is already recorded via checkout.session.completed; treating
//     both as separate donations would double-count month one. A renewal
//     invoice carries no client_reference_id of its own (Stripe never
//     re-sends it), so reimagine_user_id is looked up by stripe_customer_id
//     from a donation this handler already recorded for that customer. A
//     customer never seen via a donation checkout is ignored outright --
//     this Stripe account also runs unrelated coaching-session and course
//     products (see Output/handoff/2026-09-16_direct-donation-tracking.md),
//     and this webhook must never mistake one of those for a donation.
//
// Auth: Stripe-Signature header, `t=<timestamp>,v1=<hex hmac>` of
// `${timestamp}.${rawBody}` keyed on STRIPE_WEBHOOK_SECRET (the
// `whsec_...` value Stripe shows when the endpoint is created -- see
// Output/handoff/2026-09-16_direct-donation-tracking.md for the one-time
// setup this file assumes). No Stripe secret key and no `stripe` npm
// package are needed anywhere in this flow; verification is plain HMAC,
// the same approach api/resend-webhook.js already uses for Svix.
//
// Why getRawBody and not req.body: @vercel/node parses req.body via a lazy
// getter; the first reference to req.body consumes the request stream. The
// signature is computed over the exact bytes, so this handler MUST NOT
// touch req.body anywhere. Same constraint as api/resend-webhook.js and
// api/admin/analytics-drain.js.
//
// Failure-mode contract (Stripe retries any non-2xx for up to 3 days):
//   - Method other than POST            -> 405
//   - STRIPE_WEBHOOK_SECRET unset       -> 500 (Stripe retries; fix the env var)
//   - Body read failure                 -> 400
//   - Missing / bad / stale signature   -> 400
//   - Unparseable body                  -> 200 (retrying will not help)
//   - Event type / reason we don't want -> 200 (ignored)
//   - Database insert failure           -> 500 (worth a retry)
//   - Success                           -> 200 { ok: true }

import crypto from 'crypto'
import getRawBody from 'raw-body'
import { sql } from '../_lib/db.js'

const MAX_BODY_BYTES = 1024 * 1024 // Stripe event payloads are a few KB.
const MAX_SKEW_SECONDS = 5 * 60    // Stripe's own guidance for signature tolerance.

const asText = v => (typeof v === 'string' && v.trim() ? v.trim() : null)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Stripe-Signature: "t=1614556800,v1=<hex>,v0=<hex>". v1 is the current
// scheme; during a secret rotation Stripe sends two comma-delimited v1
// values, and any matching one is a pass, so a rotation window doesn't
// drop deliveries.
function verifySignature(secret, rawBody, signatureHeader) {
  if (!signatureHeader) return false
  const parts = {}
  for (const kv of String(signatureHeader).split(',')) {
    const i = kv.indexOf('=')
    if (i < 0) continue
    const key = kv.slice(0, i).trim()
    const val = kv.slice(i + 1).trim()
    if (key === 't' && !parts.t) parts.t = val
    if (key === 'v1') (parts.v1 = parts.v1 || []).push(val)
  }
  if (!parts.t || !parts.v1 || !parts.v1.length) return false
  const skew = Math.abs(Math.floor(Date.now() / 1000) - Number(parts.t))
  if (!Number.isFinite(skew) || skew > MAX_SKEW_SECONDS) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${parts.t}.${rawBody.toString('utf8')}`)
    .digest('hex')
  const expectedBuf = Buffer.from(expected)
  for (const candidate of parts.v1) {
    const candidateBuf = Buffer.from(candidate)
    if (candidateBuf.length !== expectedBuf.length) continue
    if (crypto.timingSafeEqual(candidateBuf, expectedBuf)) return true
  }
  return false
}

async function recordDonation({
  dedupeKey, reimagineUserId, stripeCustomerId, checkoutSessionId,
  paymentIntentId, invoiceId, amountCents, currency, frequency, donorEmail, donatedAt,
}) {
  await sql`
    INSERT INTO donations (
      dedupe_key, reimagine_user_id, stripe_customer_id, stripe_checkout_session_id,
      stripe_payment_intent_id, stripe_invoice_id, amount_cents, currency, frequency,
      donor_email, donated_at
    )
    VALUES (
      ${dedupeKey}, ${reimagineUserId}, ${stripeCustomerId}, ${checkoutSessionId},
      ${paymentIntentId}, ${invoiceId}, ${amountCents}, ${currency}, ${frequency},
      ${donorEmail}, ${donatedAt}::timestamptz
    )
    ON CONFLICT (dedupe_key) DO NOTHING
  `
}

function tsToIso(unixSeconds) {
  const n = Number(unixSeconds)
  return new Date((Number.isFinite(n) && n > 0 ? n : Math.floor(Date.now() / 1000)) * 1000).toISOString()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('webhooks/stripe: STRIPE_WEBHOOK_SECRET not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  let rawBody
  try {
    rawBody = await getRawBody(req, { limit: MAX_BODY_BYTES })
  } catch (err) {
    console.error('webhooks/stripe: getRawBody failed', err && err.message)
    return res.status(400).json({ error: 'Could not read body' })
  }

  if (!verifySignature(secret, rawBody, req.headers['stripe-signature'])) {
    return res.status(400).json({ error: 'Signature did not match' })
  }

  let event
  try {
    event = JSON.parse(rawBody.toString('utf8'))
  } catch {
    // Signed but unparseable. Retrying sends the same bytes, so acknowledge.
    console.warn('webhooks/stripe: signed payload did not parse')
    return res.status(200).json({ ok: true, ignored: 'unparseable' })
  }

  const type = asText(event && event.type)
  const obj = (event && event.data && event.data.object) || {}

  try {
    if (type === 'checkout.session.completed') {
      // 'no_payment_required' covers a $0 line item, which cannot happen on
      // a donation link, but the check costs nothing and keeps a stray
      // unpaid session from ever being recorded.
      if (obj.payment_status !== 'paid') {
        return res.status(200).json({ ok: true, ignored: 'not paid' })
      }
      const refId = asText(obj.client_reference_id)
      const reimagineUserId = refId && UUID_RE.test(refId) ? refId : null
      await recordDonation({
        dedupeKey: `cs:${obj.id}`,
        reimagineUserId,
        stripeCustomerId: asText(obj.customer),
        checkoutSessionId: asText(obj.id),
        paymentIntentId: asText(obj.payment_intent),
        invoiceId: null,
        amountCents: Number(obj.amount_total) || 0,
        currency: (asText(obj.currency) || 'usd').toLowerCase(),
        frequency: obj.mode === 'subscription' ? 'monthly' : 'once',
        donorEmail: asText(obj.customer_details && obj.customer_details.email),
        donatedAt: tsToIso(obj.created),
      })
      return res.status(200).json({ ok: true, type })
    }

    if (type === 'invoice.payment_succeeded') {
      const billingReason = asText(obj.billing_reason)
      if (billingReason !== 'subscription_cycle') {
        return res.status(200).json({ ok: true, ignored: billingReason || 'not a renewal' })
      }
      const customerId = asText(obj.customer)
      if (!customerId) return res.status(200).json({ ok: true, ignored: 'no customer' })

      const linked = await sql`
        SELECT reimagine_user_id FROM donations
         WHERE stripe_customer_id = ${customerId} AND reimagine_user_id IS NOT NULL
         ORDER BY donated_at ASC LIMIT 1
      `
      if (linked.length === 0) return res.status(200).json({ ok: true, ignored: 'unlinked customer' })

      await recordDonation({
        dedupeKey: `inv:${obj.id}`,
        reimagineUserId: linked[0].reimagine_user_id,
        stripeCustomerId: customerId,
        checkoutSessionId: null,
        paymentIntentId: asText(obj.payment_intent),
        invoiceId: asText(obj.id),
        amountCents: Number(obj.amount_paid) || 0,
        currency: (asText(obj.currency) || 'usd').toLowerCase(),
        frequency: 'monthly',
        donorEmail: asText(obj.customer_email),
        donatedAt: tsToIso(obj.created),
      })
      return res.status(200).json({ ok: true, type })
    }

    return res.status(200).json({ ok: true, ignored: type || 'untyped' })
  } catch (err) {
    console.error('webhooks/stripe: insert failed', err)
    return res.status(500).json({ error: 'Insert failed' })
  }
}
