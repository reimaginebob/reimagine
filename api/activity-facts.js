// Vercel serverless function: what we know about the moves this person has made,
// in the product and outside it. One row per (user_id, activity) in
// user_activity_facts. Written only by the app's own one-tap offers -- the model
// proposes, the person taps, the app writes. Never model-decided.
//
// Methods:
//   GET  -> every fact for the caller.
//   PUT  -> upsert one activity's state. Body { activity, state, source, detail }.
//   DELETE -> body { activity }. Removes a fact, which returns it to "we have
//             never discussed this" rather than recording a negative. That is a
//             real and different thing: the person telling us we got it wrong,
//             not the person telling us no.
//
// THE ROWS ARE THINGS WE LEARNED, NEVER A CHECKLIST OF THINGS OWED. There is no
// endpoint here that answers "how many has she done", and there should never be
// one. Absence of a row means we have not discussed it -- a question waiting to
// be asked, never an assumption that the thing has not happened, and never a
// gap to report to her.
//
// A NEGATIVE IS A FIRST-CLASS ANSWER. `declined` is what stops the coach raising
// something a fourth time, and `not_yet` is a live thing to encourage. A system
// that cannot record a no has no way to stop asking.
//
// Auth: cookie session + origin allowlist, same shape as api/pursuit-status.js.
// Gated on the Your Next Step pilot, because the coach behaviour it feeds is.

import { sql } from './_lib/db.js'
import { getSessionUser } from './_lib/session.js'
import { stripNul } from './_lib/strip-nul.js'
import { hasNextStep } from './_lib/feature-flags.js'
import { isValidFact } from '../src/activity-catalog.js'

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

// Their own words about the fact -- which group, who the partner is. Short on
// purpose: this is a note, not a field they are filling in, and anything longer
// belongs in the conversation the coach can already read.
const DETAIL_CAP = 300

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PUT' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (req.method !== 'GET' && !isAllowedOrigin(req.headers.origin)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  let user = null
  try {
    user = await getSessionUser(req)
  } catch (err) {
    console.error('activity-facts session read failed:', err)
    return res.status(500).json({ error: 'Server error' })
  }
  if (!user) return res.status(401).json({ error: 'Not signed in' })
  if (!hasNextStep(user)) return res.status(404).json({ error: 'Not found' })

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT activity, state, source, detail, learned_at
        FROM user_activity_facts
        WHERE user_id = ${user.id}::uuid
        ORDER BY learned_at DESC
      `
      return res.status(200).json({ facts: rows })
    }

    const body = req.body || {}
    const activity = typeof body.activity === 'string' ? body.activity.trim() : ''

    if (req.method === 'DELETE') {
      if (!activity) return res.status(400).json({ error: 'activity required' })
      await sql`DELETE FROM user_activity_facts WHERE user_id = ${user.id}::uuid AND activity = ${activity}`
      return res.status(200).json({ ok: true, activity })
    }

    const state = typeof body.state === 'string' ? body.state.trim() : ''
    const source = typeof body.source === 'string' ? body.source.trim() : ''
    // Validated against the catalog rather than trusted. An unregistered key
    // would store cleanly and be read by nothing, which looks exactly like a
    // successful save -- the worst available outcome, and the same reason
    // GRANTABLE_FLAGS validates a flag before setting it.
    if (!isValidFact(activity, state, source)) {
      return res.status(400).json({ error: 'unknown activity, state or source' })
    }
    const rawDetail = typeof body.detail === 'string' ? stripNul(body.detail).trim() : ''
    const detail = rawDetail ? rawDetail.slice(0, DETAIL_CAP) : null

    // Last answer wins. Someone who joined a group in October has superseded the
    // "not yet" they gave in September, and learned_at moves with it so the coach
    // knows how fresh the answer is.
    await sql`
      INSERT INTO user_activity_facts (user_id, activity, state, source, detail, learned_at)
      VALUES (${user.id}::uuid, ${activity}, ${state}, ${source}, ${detail}, NOW())
      ON CONFLICT (user_id, activity) DO UPDATE
        SET state = EXCLUDED.state,
            source = EXCLUDED.source,
            detail = EXCLUDED.detail,
            learned_at = NOW()
    `
    return res.status(200).json({ ok: true, activity, state })
  } catch (err) {
    console.error('activity-facts failed:', err)
    return res.status(500).json({ error: 'Server error' })
  }
}
