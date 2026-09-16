// Vercel serverless function: ingests Stripe checkout events into `donations`.
//
// Why this exists: the Career Club Stripe account (acct_1IQLNEK4uJoqzRSd)
// backing the Pay It Forward donation links had no route back into Reimagine
// at all -- a charge there carried no identifier connecting it to a Reimagine
// account. src/App.jsx now appends `client_reference_id=<users.id>` to the
// donation links for a signed-in user; this handler is where that value comes
// back and gets stored, joined against users.created_at, to answer "what
// share of accounts have ever donated, and how long after signup."
//
// Only `checkout.session.completed` is handled. That covers every one-time
// gift in full (one checkout session each) and the moment a $10/mo
// subscription is opened, but NOT that subscription's later monthly renewal
// charges -- see migrations/2026-09-16_donations.sql for why that is the
// right scope for donor-rate and time-to-first-donation questions.
//
// Auth: Stripe signs the raw body with the endpoint's signing secret
// (STRIPE_WEBHOOK_SECRET, the full `whsec_...` string Stripe shows when the
// endpoint is created -- used AS-IS as the HMAC key, prefix included; unlike
// Svix's secret this is not base64 and the prefix is not stripped) via the
// `Stripe-Signature` header: `t=<unix ts>,v1=<hex hmac>`, HMAC-SHA256 over
// `${t}.${rawBody}`. Verified by hand here rather than via the `stripe` SDK
// -- CLAUDE.md section 8 keeps this codebase's admin/backend surface
// dependency-free where a signature check is this small, and
// api/resend-webhook.js already establishes the pattern (raw-body signature
// verification without the vendor's SDK); confirmed against Stripe's own
// "Verify webhook signatures manually" docs rather than assumed from Svix's
// scheme, which differs on exactly this point.
//
// Why getRawBody and not req.body: same constraint as api/resend-webhook.js
// -- @vercel/node's req.body getter consumes the request stream on first
// touch, and the signature is computed over the exact bytes.
//
// Failure-mode contract (Stripe retries any non-2xx for up to 3 days):
//   - Method other than POST              -> 405
//   - STRIPE_WEBHOOK_SECRET unset         -> 500 (Stripe retries; fix the env var)
//   - Body read failure                   -> 400
//   - Missing / bad / stale signature     -> 403
//   - Unparseable or uninteresting event  -> 200 (retrying will not help)
//   - Database insert failure             -> 500 (worth a retry)
//   - Success                             -> 200 { ok: true }

import crypto from 'crypto'
import getRawBody from 'raw-body'
import { sql } from './_lib/db.js'

const MAX_BODY_BYTES = 1024 * 1024 // Checkout Session payloads are a few KB.
const MAX_SKEW_SECONDS = 5 * 60    // Replay window, per Stripe's own guidance.

// During a secret roll (up to 24h overlap, Stripe's own docs) the header can
// carry more than one `v1=` entry, one per currently-active secret -- so
// every v1 candidate is checked, and any match passes, rather than keeping
// only the last one parsed.
function verifySignature(secret, rawBody, signatureHeader) {
  let timestamp = null
  const candidates = []
  for (const part of String(signatureHeader || '').split(',')) {
    const [k, v] = part.split('=')
    if (k === 't' && v) timestamp = v
    if (k === 'v1' && v) candidates.push(v)
  }
  if (!timestamp || !candidates.length) return { ok: false }

  const skew = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp))
  if (!Number.isFinite(skew) || skew > MAX_SKEW_SECONDS) return { ok: false }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest('hex')
  const expectedBuf = Buffer.from(expected)
  for (const candidateSig of candidates) {
    const candidateBuf = Buffer.from(candidateSig)
    if (candidateBuf.length !== expectedBuf.length) continue
    if (crypto.timingSafeEqual(candidateBuf, expectedBuf)) return { ok: true }
  }
  return { ok: false }
}

const asText = v => (typeof v === 'string' && v.trim() ? v.trim() : null)
// A well-formed UUID or null -- client_reference_id is attacker/user
// controllable (it rides in a URL query param), so it is validated as a
// shape before ever reaching a foreign-key lookup rather than trusted as an
// opaque string.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const asUserId = v => (typeof v === 'string' && UUID_RE.test(v.trim()) ? v.trim() : null)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('stripe-webhook: STRIPE_WEBHOOK_SECRET not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  let rawBody
  try {
    rawBody = await getRawBody(req, { limit: MAX_BODY_BYTES })
  } catch (err) {
    console.error('stripe-webhook: getRawBody failed', err && err.message)
    return res.status(400).json({ error: 'Could not read body' })
  }

  const signatureHeader = req.headers['stripe-signature']
  if (!signatureHeader) {
    return res.status(403).json({ error: 'Missing signature header' })
  }
  const { ok: signatureOk } = verifySignature(secret, rawBody, signatureHeader)
  if (!signatureOk) {
    return res.status(403).json({ error: 'Signature did not match' })
  }

  let payload
  try {
    payload = JSON.parse(rawBody.toString('utf8'))
  } catch {
    // Signed but unparseable. Retrying sends the same bytes, so acknowledge.
    console.warn('stripe-webhook: signed payload did not parse')
    return res.status(200).json({ ok: true, ignored: 'unparseable' })
  }

  const eventId = asText(payload && payload.id)
  const type = asText(payload && payload.type)
  if (!eventId || type !== 'checkout.session.completed') {
    return res.status(200).json({ ok: true, ignored: type || 'untyped' })
  }

  const session = (payload.data && payload.data.object) || {}
  // A donation link opened and abandoned before payment still fires this
  // event in some flows with no charge behind it; only a completed payment
  // status is real revenue.
  if (session.payment_status !== 'paid') {
    return res.status(200).json({ ok: true, ignored: 'not paid' })
  }

  const amountCents = Number.isFinite(session.amount_total) ? session.amount_total : null
  const currency = asText(session.currency)
  if (amountCents === null || !currency) {
    return res.status(200).json({ ok: true, ignored: 'no amount' })
  }

  const userId = asUserId(session.client_reference_id)
  const sessionId = asText(session.id)
  const frequency = session.mode === 'subscription' ? 'monthly' : 'once'
  const occurredAt = Number.isFinite(payload.created)
    ? new Date(payload.created * 1000).toISOString()
    : new Date().toISOString()

  try {
    await sql`
      INSERT INTO donations (user_id, stripe_event_id, stripe_session_id, amount_cents, currency, frequency, occurred_at)
      VALUES (${userId}, ${eventId}, ${sessionId}, ${amountCents}, ${currency}, ${frequency}, ${occurredAt}::timestamptz)
      ON CONFLICT (stripe_event_id) DO NOTHING
    `
  } catch (err) {
    console.error('stripe-webhook: insert failed', err)
    return res.status(500).json({ error: 'Insert failed' })
  }

  return res.status(200).json({ ok: true, type, user_linked: !!userId })
}
