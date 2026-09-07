// Vercel serverless function: why a saved opportunity ended, if the person
// has any read on it. One row per (user_id, record_id) in
// pursuit_close_reasons. Written only by the app's own one-tap offer --
// Coach proposes a category + the person's own words, the person taps, the
// app writes. Never model-decided, never volunteered outside an explicit
// question the person actually answered.
//
// Method:
//   PUT -> upsert one opportunity's close reason. Body { recordId, reasonCode,
//          initiatedBy, detail }.
//
// No GET: nothing in the UI displays this back yet, and Coach's own reads
// of it happen server-side, directly (api/coach.js queries the table
// itself, the same way it already reads pursuit_status and
// user_activity_facts) -- there is no client-side mirror state that would
// need hydrating.
//
// Auth: cookie session + origin allowlist, same shape as api/activity-facts.js.
// Gated on hasCloseReasonCapture, not hasPipelineCapture -- see the flag's
// own comment in api/_lib/feature-flags.js for why this gets a separate,
// stricter gate than the other opportunity-data captures.

import { sql } from './_lib/db.js'
import { getSessionUser } from './_lib/session.js'
import { stripNul } from './_lib/strip-nul.js'
import { hasCloseReasonCapture } from './_lib/feature-flags.js'
import { CLOSE_REASON_CODES, INITIATED_BY_VALUES } from '../src/pursuit-close-reasons.js'

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

// Their own words, alongside the category -- short on purpose, same reason
// activity-facts caps its own detail field: this is a note, not a field
// they are filling in, and anything longer belongs in the conversation
// Coach can already read.
const DETAIL_CAP = 400

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!isAllowedOrigin(req.headers.origin)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  let user = null
  try {
    user = await getSessionUser(req)
  } catch (err) {
    console.error('pursuit-close-reason session read failed:', err)
    return res.status(500).json({ error: 'Server error' })
  }
  if (!user) return res.status(401).json({ error: 'Not signed in' })
  if (!hasCloseReasonCapture(user)) return res.status(404).json({ error: 'Not found' })

  try {
    const body = req.body || {}
    const recordId = typeof body.recordId === 'string' ? body.recordId.trim() : ''
    const reasonCode = typeof body.reasonCode === 'string' ? body.reasonCode.trim() : ''
    const initiatedByRaw = typeof body.initiatedBy === 'string' ? body.initiatedBy.trim() : ''
    const initiatedBy = INITIATED_BY_VALUES.includes(initiatedByRaw) ? initiatedByRaw : 'unknown'

    // Validated against the fixed taxonomy rather than trusted -- an
    // unregistered code would store cleanly and be read by nothing, which
    // looks exactly like a successful save, the same failure mode
    // activity-facts guards against for its own catalog.
    if (!recordId || !CLOSE_REASON_CODES.includes(reasonCode)) {
      return res.status(400).json({ error: 'recordId and a known reasonCode are required' })
    }
    const rawDetail = typeof body.detail === 'string' ? stripNul(body.detail).trim() : ''
    const detail = rawDetail ? rawDetail.slice(0, DETAIL_CAP) : null

    await sql`
      INSERT INTO pursuit_close_reasons (user_id, record_id, reason_code, initiated_by, detail, learned_at)
      VALUES (${user.id}::uuid, ${recordId}, ${reasonCode}, ${initiatedBy}, ${detail}, NOW())
      ON CONFLICT (user_id, record_id) DO UPDATE
        SET reason_code = EXCLUDED.reason_code,
            initiated_by = EXCLUDED.initiated_by,
            detail = EXCLUDED.detail,
            learned_at = NOW()
    `
    return res.status(200).json({ ok: true, recordId, reasonCode })
  } catch (err) {
    console.error('pursuit-close-reason failed:', err)
    return res.status(500).json({ error: 'Server error' })
  }
}
