// Vercel serverless function: writes one inline-survey submission to the
// Neon survey_responses table. Replaces the prior Apps-Script-to-Sheet
// pipeline that the client called with a silent-error wrapper, so a failed
// submission now surfaces to the user instead of evaporating.
//
// - POST only.
// - Origin check rejects any host outside the Reimagine allowlist (same
//   shape as api/claude.js and api/chat.js).
// - Session is optional: signed-in submissions attach user_id; anonymous
//   submissions land with user_id = NULL (the table column allows it).
// - Body validation: nps_score required integer 0-10. The other categorical
//   fields are optional strings with length caps; open_text gets a larger
//   cap. Anything past the cap is truncated rather than rejected, so a
//   pasted-in essay still lands without the user losing their entry.
// - Errors surface as 500 with logged details. We do NOT swallow database
//   errors silently (the failure mode the brief was written to retire).

import { sql } from '../_lib/db.js'
import { getSessionUser } from '../_lib/session.js'

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

function clampString(value, max) {
  if (value == null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
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
  const nps = body.nps_score
  const npsNum = typeof nps === 'string' ? parseInt(nps, 10) : nps
  if (!Number.isInteger(npsNum) || npsNum < 0 || npsNum > 10) {
    return res.status(400).json({ error: 'nps_score must be an integer between 0 and 10' })
  }

  const most_valuable = clampString(body.most_valuable, 200)
  const confidence = clampString(body.confidence, 200)
  const accuracy = clampString(body.accuracy, 200)
  const chosen_role = clampString(body.chosen_role, 200)
  const open_text = clampString(body.open_text, 5000)

  // Session lookup is best-effort: cookie absent or expired leaves user_id NULL
  // so anonymous submissions still land. Any other failure mode in the
  // session helper (DB blip etc.) should not block the survey write.
  let user_id = null
  try {
    const user = await getSessionUser(req, res)
    if (user && user.id) user_id = user.id
  } catch (err) {
    console.warn('survey/submit: session lookup failed, recording as anonymous', err)
  }

  try {
    const rows = await sql`
      INSERT INTO survey_responses
        (user_id, nps_score, most_valuable, confidence, accuracy, open_text, chosen_role)
      VALUES
        (${user_id}::uuid, ${npsNum}, ${most_valuable}, ${confidence}, ${accuracy}, ${open_text}, ${chosen_role})
      RETURNING id
    `
    const id = rows[0]?.id
    return res.status(200).json({ ok: true, id })
  } catch (err) {
    console.error('survey/submit: insert failed', err)
    return res.status(500).json({ error: 'Could not save your feedback. Please try again.' })
  }
}
