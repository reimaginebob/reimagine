// User-initiated diagnostics upload (2026-09-08 observability brief, part C).
//
// The error trail (support_events) is what we collect automatically, and it is
// deliberately thin: columns, no content, nothing a person did not already
// implicitly consent to as an operational log. This endpoint is the other
// posture entirely. Every row here exists because a person opened a box, read
// the exact JSON on screen, and clicked Send. That is why it may carry the
// component stack and the URL path -- things the automatic path deliberately
// leaves behind -- and why it is a separate table rather than a wider
// support_events.
//
// THE ALLOWLIST IS THE SCHEMA. `payload` is jsonb, which would be a hole if the
// endpoint took what it was given. It does not: PAYLOAD_KEYS is the complete
// set of keys that can be stored, anything else is dropped before the INSERT,
// and every string is capped. So the promise the UI makes -- "you can read
// exactly what will be sent below" -- is true in both directions: the box
// cannot show less than is sent, and the server cannot store more than the box
// showed.
//
// What can never be here, whatever a client posts: resume or profile text,
// playbook or generated output, and anything said to My Coach. There is no key
// for any of them, and the check that proves it runs against a hostile payload
// in scripts/test-support-diagnostics.mjs.

import { getSessionUser } from '../_lib/session.js'
import { isAllowedOrigin } from '../_lib/allowed-hosts.js'
import { sql } from '../_lib/db.js'

// key -> max stored length. Numbers and booleans are not in here; see below.
export const PAYLOAD_KEYS = Object.freeze({
  message: 400,
  // Component names, not content -- React builds this from the element tree.
  // The single most useful thing in a crash report and the reason this
  // endpoint exists at all, since the automatic path deliberately omits it.
  component_stack: 2000,
  step: 60,
  build_sha: 64,
  user_agent: 300,
  // PATH only. The full href would carry the query string, and a query string
  // is somewhere state can hide; the UI builds this with location.pathname.
  url_path: 200,
  iso: 40,
})

// The recent failures the client mirrors alongside the crash. Each entry is a
// support_events row the user's own browser observed, so the shape matches.
export const TRAIL_KEYS = Object.freeze({
  kind: 40,
  step: 60,
  error_class: 40,
  detail: 200,
  at: 40,
})
export const MAX_TRAIL = 20

function pick(source, spec) {
  const out = {}
  if (!source || typeof source !== 'object') return out
  for (const [key, limit] of Object.entries(spec)) {
    const v = source[key]
    if (v === null || v === undefined) continue
    // Objects and arrays are refused rather than stringified: '[object Object]'
    // is noise, and JSON.stringify of an unknown object is precisely the
    // uncontrolled shape this allowlist exists to prevent.
    if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') continue
    const s = String(v).trim()
    if (!s) continue
    out[key] = s.slice(0, limit)
  }
  return out
}

// Pure and exported so the test can throw a hostile payload at it -- resume
// text, a whole profile object, a Coach transcript, a raw stack trace -- and
// assert that none of it survives.
export function sanitizeDiagnostics(body) {
  const src = (body && typeof body === 'object') ? body : {}
  const payload = pick(src, PAYLOAD_KEYS)
  const rawTrail = Array.isArray(src.trail) ? src.trail.slice(0, MAX_TRAIL) : []
  const trail = rawTrail.map(e => pick(e, TRAIL_KEYS)).filter(e => Object.keys(e).length > 0)
  if (trail.length) payload.trail = trail
  return payload
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const origin = req.headers.origin || req.headers.referer || ''
  if (!isAllowedOrigin(origin)) return res.status(403).json({ error: 'Forbidden' })

  const user = await getSessionUser(req, res)
  if (!user) return res.status(401).json({ error: 'Not signed in' })

  const payload = sanitizeDiagnostics(req.body)
  // Nothing recognizable in it. Refused rather than stored as an empty row,
  // because an empty row in this table would imply someone chose to send one.
  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ error: 'Nothing to send' })
  }

  // user_agent is corrected to the real one rather than trusted from the body.
  // The client shows what it intends to send and that is what gets stored, but
  // this one field is a fact about the connection, and a support report whose
  // browser string is wrong is worse than one with no browser string at all.
  payload.user_agent = String(req.headers['user-agent'] || payload.user_agent || '').slice(0, PAYLOAD_KEYS.user_agent) || undefined

  try {
    const rows = await sql`
      INSERT INTO support_diagnostics (user_id, payload)
      VALUES (${user.id}, ${JSON.stringify(payload)}::jsonb)
      RETURNING id, created_at`
    console.log('support/diagnostics stored', { user_id: user.id, keys: Object.keys(payload).length })
    return res.status(200).json({ ok: true, at: rows[0] && rows[0].created_at })
  } catch (err) {
    console.error('support/diagnostics: insert failed', (err && err.message) || String(err))
    return res.status(500).json({ error: 'Could not send' })
  }
}
