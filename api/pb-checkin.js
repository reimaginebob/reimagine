// Vercel serverless function: records one Personal Brand check-in tap into the
// coach_checkin_responses table. The tap (Yes / Mostly / Not quite) is the
// measurable signal behind the My Coach check-in shown once on first arrival at
// "Put it to Work". The ingest cron later maps it into feedback_event with
// surface='personal-brand' and solicited=true.
//
// - POST only.
// - Origin check rejects hosts outside the Reimagine allowlist (same shape as
//   api/feedback/submit.js).
// - Signed-in only: the check-in fires for known users, and dedupe keys on
//   user_id. No session -> 401.
// - Body: { checkin?: string (defaults 'personal-brand'), answer: 'yes' |
//   'mostly' | 'not_quite' }. Invalid answer -> 400.
// - First tap wins: UNIQUE (user_id, checkin_key) + ON CONFLICT DO NOTHING, so a
//   stray re-tap never overwrites the recorded signal.

import { sql } from './_lib/db.js'
import { getSessionUser } from './_lib/session.js'

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

const VALID_ANSWERS = new Set(['yes', 'mostly', 'not_quite'])

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const origin = req.headers.origin || req.headers.referer || ''
  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const body = req.body || {}
  const answer = typeof body.answer === 'string' ? body.answer.trim() : ''
  if (!VALID_ANSWERS.has(answer)) {
    return res.status(400).json({ error: 'answer must be one of yes | mostly | not_quite' })
  }
  let checkinKey = typeof body.checkin === 'string' && body.checkin.trim() ? body.checkin.trim().slice(0, 60) : 'personal-brand'

  let user
  try {
    user = await getSessionUser(req, res)
  } catch (err) {
    console.warn('pb-checkin: session lookup failed', err)
    user = null
  }
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const rows = await sql`
      INSERT INTO coach_checkin_responses (user_id, email, checkin_key, answer)
      VALUES (${user.id}::uuid, ${user.email || null}, ${checkinKey}, ${answer})
      ON CONFLICT (user_id, checkin_key) DO NOTHING
      RETURNING id
    `
    // recorded:true on a fresh insert; false if a prior tap already won the dedupe.
    return res.status(200).json({ ok: true, recorded: rows.length > 0 })
  } catch (err) {
    console.error('pb-checkin: insert failed', err)
    return res.status(500).json({ error: 'Could not record your response.' })
  }
}
