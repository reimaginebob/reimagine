// Vercel serverless function: writes one free-text feedback note from the
// header "Share feedback" panel to the Neon general_feedback table. This is the
// in-app feedback write path that replaced the retired post-session NPS survey
// (api/survey/submit.js is kept for the survey_responses read paths and digest,
// but the survey no longer fires in-app).
//
// - POST only.
// - Origin check rejects any host outside the Reimagine allowlist (same shape
//   as api/survey/submit.js and api/claude.js).
// - Session is optional: signed-in submissions attach user_id + email;
//   anonymous submissions land with both NULL (the columns allow it).
// - Body validation: body (the note) is required, non-empty after trim, clamped
//   to a generous cap so a long note still lands. The silent-context fields
//   (surface, selected_lane, context_ref, commit_sha) are optional strings with
//   short caps. Anything past a cap is truncated rather than rejected.
// - Errors surface as 500 with logged details. We do NOT swallow database
//   errors silently.

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

  const reqBody = req.body || {}
  const body = clampString(reqBody.body, 5000)
  if (!body) {
    return res.status(400).json({ error: 'body is required' })
  }

  const surface = clampString(reqBody.surface, 200)
  const selected_lane = clampString(reqBody.selected_lane, 200)
  const context_ref = clampString(reqBody.context_ref, 500)
  const commit_sha = clampString(reqBody.commit_sha, 100)

  // Session lookup is best-effort: cookie absent or expired leaves user_id and
  // email NULL so an anonymous note still lands. A session-helper failure
  // (DB blip etc.) should not block the feedback write.
  let user_id = null
  let email = null
  try {
    const user = await getSessionUser(req, res)
    if (user && user.id) {
      user_id = user.id
      email = user.email || null
    }
  } catch (err) {
    console.warn('feedback/submit: session lookup failed, recording as anonymous', err)
  }

  try {
    const rows = await sql`
      INSERT INTO general_feedback
        (user_id, email, body, surface, selected_lane, context_ref, commit_sha)
      VALUES
        (${user_id}, ${email}, ${body}, ${surface}, ${selected_lane}, ${context_ref}, ${commit_sha})
      RETURNING id
    `
    const id = rows[0]?.id
    return res.status(200).json({ ok: true, id })
  } catch (err) {
    console.error('feedback/submit: insert failed', err)
    return res.status(500).json({ error: 'We could not save your feedback. Please try again.' })
  }
}
