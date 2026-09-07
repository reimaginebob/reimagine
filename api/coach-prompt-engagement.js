// Vercel serverless function: records one row into coach_prompt_engagement --
// a prompt was shown, or a shown prompt was accepted/declined. Pure product
// telemetry, same risk class as generation_events: no content, just "this UI
// element fired" and "this button got tapped" against a bounded vocabulary
// (src/coach-prompt-codes.js). That is why this ships with no feature flag
// and no per-user disclosure, unlike pursuit-close-reason.js -- there is
// nothing here a person is disclosing about themselves beyond having seen a
// button, which the product already shows them directly on screen.
//
// - POST only, same origin allowlist as pb-checkin.js / activity-facts.js.
// - Signed-in only: no session -> 401.
// - Body: { promptCode, triggerType?, outcome }. triggerType defaults
//   'direct' to match the table's own default, but callers should always
//   pass one of TRIGGER_TYPES explicitly. Anything outside the bounded lists
//   -> 400, so a typo in a call site fails loudly in testing instead of
//   quietly fragmenting the data.
// - Append-only: every call inserts a new row, including repeats. This is
//   deliberately NOT upsert-on-conflict -- the repeatable topic-close
//   trigger can legitimately fire more than once for the same account, and
//   each firing is its own data point.
// - Best-effort by design: the client fires this and does not wait on it to
//   decide anything, so a failure here costs one undercounted row, never a
//   broken UI. Still returns real status codes so a caller that DOES want to
//   know can check.

import { sql } from './_lib/db.js'
import { getSessionUser } from './_lib/session.js'
import { PROMPT_CODES, TRIGGER_TYPES, PROMPT_OUTCOMES } from '../src/coach-prompt-codes.js'

const ALLOWED_HOSTS = new Set([
  'reimagine2-two.vercel.app',
  'reimagine.career.club',
  'localhost:5173',
  'localhost:3000',
])

function isAllowedOrigin(rawOrigin) {
  if (!rawOrigin) return false
  try {
    const u = new URL(rawOrigin)
    const hostWithPort = u.port ? `${u.hostname}:${u.port}` : u.hostname
    if (ALLOWED_HOSTS.has(u.hostname) || ALLOWED_HOSTS.has(hostWithPort)) return true
    if (u.hostname.endsWith('.vercel.app') && u.hostname.includes('reimagine')) return true
    return false
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const origin = req.headers.origin || req.headers.referer || ''
  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const body = req.body || {}
  const promptCode = typeof body.promptCode === 'string' ? body.promptCode.trim() : ''
  const triggerType = typeof body.triggerType === 'string' && body.triggerType.trim() ? body.triggerType.trim() : 'direct'
  const outcome = typeof body.outcome === 'string' ? body.outcome.trim() : ''

  if (!PROMPT_CODES.includes(promptCode)) {
    return res.status(400).json({ error: 'promptCode must be one of PROMPT_CODES' })
  }
  if (!TRIGGER_TYPES.includes(triggerType)) {
    return res.status(400).json({ error: 'triggerType must be one of TRIGGER_TYPES' })
  }
  if (!PROMPT_OUTCOMES.includes(outcome)) {
    return res.status(400).json({ error: 'outcome must be one of PROMPT_OUTCOMES' })
  }

  let user
  try {
    user = await getSessionUser(req, res)
  } catch (err) {
    console.warn('coach-prompt-engagement: session lookup failed', err)
    user = null
  }
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    await sql`
      INSERT INTO coach_prompt_engagement (user_id, prompt_code, trigger_type, outcome)
      VALUES (${user.id}::uuid, ${promptCode}, ${triggerType}, ${outcome})
    `
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('coach-prompt-engagement: insert failed', err)
    return res.status(500).json({ error: 'Could not record.' })
  }
}
