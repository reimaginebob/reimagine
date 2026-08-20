// Vercel serverless function: records one user's own read on their search into
// the users.search_going_well / users.search_focus columns. Written by the app's
// own triggers (the Orientation "Your Current Situation" fields) — app-decided,
// never model-decided, same rule as api/employment.js.
//
// - POST only.
// - Origin check against the Reimagine allowlist (same shape as api/employment.js).
// - Signed-in only; writes the caller's own row.
// - Body: { goingWell?, focus? } — partial. Only the fields present are written,
//   and only their timestamps are stamped, so editing one answer never makes the
//   other look freshly confirmed. Those timestamps are load-bearing: api/coach.js
//   states their age in words and drops the lines past a staleness threshold.
// - Empty string is a valid value (answered, then cleared). null/undefined means
//   "leave this field alone" — it is not a clear.
// - Plain UPDATE (updatable): the answer is a snapshot of where someone came in,
//   and they can revise it from the Orientation screen at any time.

import { sql } from './_lib/db.js'
import { getSessionUser } from './_lib/session.js'
import { stripNul } from './_lib/strip-nul.js'

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

// Generous for prose, and bounds what lands in the Coach profile slice. Over-length
// truncates rather than rejecting — losing the tail of a long answer is a better
// outcome than throwing away the whole thing at a screen the user is trying to leave.
export const MAX_LEN = 2000

// Present-and-writable means a string. Anything else (absent, null, a number) is
// "leave alone", so a partial body never blanks a field by omission.
function clean(value) {
  if (typeof value !== 'string') return undefined
  return stripNul(value).trim().slice(0, MAX_LEN)
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
  const goingWell = clean(body.goingWell)
  const focus = clean(body.focus)
  if (goingWell === undefined && focus === undefined) {
    return res.status(400).json({ error: 'Provide goingWell and/or focus as strings.' })
  }

  let user
  try {
    user = await getSessionUser(req, res)
  } catch (err) {
    console.warn('search-intake: session lookup failed', err)
    user = null
  }
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    // Two narrow statements rather than one assembled UPDATE: the tagged-template
    // sql client takes no dynamic column lists, and a partial write must not touch
    // the other field's timestamp.
    if (goingWell !== undefined) {
      await sql`
        UPDATE users
        SET search_going_well = ${goingWell}, search_going_well_updated_at = NOW()
        WHERE id = ${user.id}::uuid
      `
    }
    if (focus !== undefined) {
      await sql`
        UPDATE users
        SET search_focus = ${focus}, search_focus_updated_at = NOW()
        WHERE id = ${user.id}::uuid
      `
    }
    return res.status(200).json({ ok: true, goingWell, focus })
  } catch (err) {
    console.error('search-intake: update failed', err)
    return res.status(500).json({ error: 'Could not save your answer.' })
  }
}
