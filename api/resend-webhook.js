// Vercel serverless function: ingests Resend delivery events into email_events.
//
// Why this exists: Resend knows who opened and clicked; it has never seen the
// product side. user_stage_events knows when someone crossed a stage; it has
// never seen an email. A lifecycle campaign is judged on the join of the two —
// "she clicked the week-two email, then reached Career Paths two days later" —
// and that join needs the email half in our own database.
//
// It also lands bounces and complaints where they can be seen. On a young
// sending domain a spam complaint is the most damaging event there is, and
// today the only way to notice one is to remember to open Resend.
//
// Auth: Svix signature over the raw body (Resend signs every webhook this way).
// The shared secret is RESEND_WEBHOOK_SECRET, the `whsec_...` value Resend shows
// when the endpoint is created.
//
// Why getRawBody and not req.body:
//   @vercel/node parses req.body via a lazy getter; the first reference to
//   req.body consumes the request stream. The signature is computed over the
//   exact bytes, so this handler MUST NOT touch req.body anywhere. Same
//   constraint and same solution as api/admin/analytics-drain.js.
//
// Failure-mode contract (Svix retries any non-2xx, so 2xx must mean "do not
// send this again"):
//   - Method other than POST            -> 405
//   - RESEND_WEBHOOK_SECRET unset       -> 500 (Svix retries; fix the env var)
//   - Body read failure                 -> 400
//   - Missing / bad / stale signature   -> 403
//   - Unparseable or uninteresting body -> 200 (retrying will not help)
//   - Database insert failure           -> 500 (worth a retry)
//   - Success                           -> 200 { ok: true }

import crypto from 'crypto'
import getRawBody from 'raw-body'
import { sql } from './_lib/db.js'

const MAX_BODY_BYTES = 1024 * 1024 // Resend event payloads are a few KB.
const MAX_SKEW_SECONDS = 5 * 60    // Replay window, per Svix's own guidance.

// Resend's event names. Anything outside this set is acknowledged and dropped —
// a new event type should not 500 and trigger an infinite retry.
const KNOWN_EVENTS = new Set([
  'email.sent', 'email.delivered', 'email.delivery_delayed',
  'email.opened', 'email.clicked', 'email.bounced', 'email.complained',
])

// Svix signs `${id}.${timestamp}.${body}` with the base64 secret that follows
// the `whsec_` prefix. The header carries a space-delimited list of
// `v1,<base64sig>` so a secret can be rotated without dropping deliveries;
// any match is a pass.
function verifySignature(secret, id, timestamp, rawBody, signatureHeader) {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = crypto
    .createHmac('sha256', key)
    .update(`${id}.${timestamp}.${rawBody.toString('utf8')}`)
    .digest('base64')
  const expectedBuf = Buffer.from(expected)
  for (const part of String(signatureHeader).split(' ')) {
    const sig = part.split(',')[1]
    if (!sig) continue
    const candidate = Buffer.from(sig)
    // Length check first: timingSafeEqual throws on a length mismatch.
    if (candidate.length !== expectedBuf.length) continue
    if (crypto.timingSafeEqual(candidate, expectedBuf)) return true
  }
  return false
}

const asText = v => (typeof v === 'string' && v.trim() ? v.trim() : null)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.error('resend-webhook: RESEND_WEBHOOK_SECRET not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  let rawBody
  try {
    rawBody = await getRawBody(req, { limit: MAX_BODY_BYTES })
  } catch (err) {
    console.error('resend-webhook: getRawBody failed', err && err.message)
    return res.status(400).json({ error: 'Could not read body' })
  }

  const svixId = req.headers['svix-id']
  const svixTimestamp = req.headers['svix-timestamp']
  const svixSignature = req.headers['svix-signature']
  if (!svixId || !svixTimestamp || !svixSignature) {
    return res.status(403).json({ error: 'Missing signature headers' })
  }
  // Reject stale timestamps before doing the HMAC: a captured payload replayed
  // later still carries a valid signature.
  const skew = Math.abs(Math.floor(Date.now() / 1000) - Number(svixTimestamp))
  if (!Number.isFinite(skew) || skew > MAX_SKEW_SECONDS) {
    return res.status(403).json({ error: 'Timestamp outside tolerance' })
  }
  if (!verifySignature(secret, svixId, svixTimestamp, rawBody, svixSignature)) {
    return res.status(403).json({ error: 'Signature did not match' })
  }

  let payload
  try {
    payload = JSON.parse(rawBody.toString('utf8'))
  } catch {
    // Signed but unparseable. Retrying sends the same bytes, so acknowledge.
    console.warn('resend-webhook: signed payload did not parse')
    return res.status(200).json({ ok: true, ignored: 'unparseable' })
  }

  const type = asText(payload && payload.type)
  const data = (payload && payload.data) || {}
  if (!type || !KNOWN_EVENTS.has(type)) {
    return res.status(200).json({ ok: true, ignored: type || 'untyped' })
  }

  // `to` is an array on Resend's payload; one row per recipient so a multi-
  // recipient send does not collapse to a single trace. The event id is
  // suffixed by index to keep the primary key unique across those rows.
  const recipients = (Array.isArray(data.to) ? data.to : [data.to])
    .map(asText).filter(Boolean).map(s => s.toLowerCase())
  if (!recipients.length) {
    return res.status(200).json({ ok: true, ignored: 'no recipient' })
  }

  const eventType = type.replace(/^email\./, '')
  const emailId = asText(data.email_id) || asText(data.id)
  const linkUrl = asText(data.click && data.click.link)
  const tags = data.tags && typeof data.tags === 'object' ? JSON.stringify(data.tags) : null
  const occurredAt = asText(data.created_at) || new Date().toISOString()

  try {
    for (let i = 0; i < recipients.length; i++) {
      const eventId = recipients.length > 1 ? `${svixId}:${i}` : String(svixId)
      await sql`
        INSERT INTO email_events (event_id, email_id, event_type, recipient, link_url, tags, occurred_at)
        VALUES (${eventId}, ${emailId}, ${eventType}, ${recipients[i]}, ${linkUrl}, ${tags}::jsonb, ${occurredAt}::timestamptz)
        ON CONFLICT (event_id) DO NOTHING
      `
    }
  } catch (err) {
    console.error('resend-webhook: insert failed', err)
    return res.status(500).json({ error: 'Insert failed' })
  }

  return res.status(200).json({ ok: true, type: eventType, recipients: recipients.length })
}
