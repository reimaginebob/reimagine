// Vercel serverless function: the My Search status layer over a user's
// Opportunity Playbook records. One row per (user_id, record_id) in the
// pursuit_status table. Written by the app's own triggers (the My Search card
// editor, the Coach one-tap capture) — all app-decided, never model-decided.
//
// Methods:
//   GET    -> list every status row for the caller (the phase-two connector's
//             `list-pursuits` read interface; keep it a clean per-record list).
//   PUT    -> upsert one record's status. Read-merge-write so a stage-only tap
//             does not clear a previously-set next_move. UPSERT, not UPDATE: the
//             row does not pre-exist for a (user_id, record_id) pair.
//   POST   -> reconcile. Body { recordIds }: prune rows for records the client
//             no longer holds (single delete, at-cap remove, import-replace all
//             land here). Empty list prunes all the caller's rows.
//
// Auth (phase one): cookie session + origin allowlist, same shape as
// api/employment.js. Gated on the `my_search` feature flag (defense in depth).
//
// PHASE-TWO SEAM (do not build, do not violate): auth resolution is separated
// from the write core, and the origin check is conditional on auth mode. A later
// push connector adds a second resolver (push token -> userId) that calls the
// same writeCore; it will have no browser origin, so origin-presence must never
// be an unconditional precondition. The write core treats record_id as an opaque
// user-scoped key and never validates that the record "exists" — the server
// cannot see savedPlaybooks in either phase.

import crypto from 'node:crypto'
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

const VALID_STAGES = new Set(['researching', 'applied', 'in_conversation', 'interviewing', 'offer', 'closed'])
const VALID_OUTCOMES = new Set(['accepted', 'declined', 'not_selected', 'withdrew', 'no_response'])

// Parse an incoming timestamp field. Returns { ok, value } where value is an ISO
// string or null. A provided-but-unparseable value is a 400 (ok:false).
function parseTs(v) {
  if (v === undefined || v === null || v === '') return { ok: true, value: null }
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return { ok: false }
  return { ok: true, value: d.toISOString() }
}

// The write core is auth-agnostic on purpose (see PHASE-TWO SEAM). It merges the
// patch over the existing row so unspecified fields are preserved, then upserts.
async function writeCore(userId, recordId, patch) {
  const existingRows = await sql`
    SELECT stage, next_conversation_at, next_move, closed_at, outcome
    FROM pursuit_status
    WHERE user_id = ${userId}::uuid AND record_id = ${recordId}
    LIMIT 1
  `
  const prev = existingRows[0] || {}
  const has = (k) => Object.prototype.hasOwnProperty.call(patch, k)

  const stage = has('stage') ? patch.stage : (prev.stage ?? null)
  const nextConversationAt = has('next_conversation_at') ? patch.next_conversation_at : (prev.next_conversation_at ?? null)
  const nextMove = has('next_move') ? patch.next_move : (prev.next_move ?? null)
  const closedAt = has('closed_at') ? patch.closed_at : (prev.closed_at ?? null)
  const outcome = has('outcome') ? patch.outcome : (prev.outcome ?? null)

  await sql`
    INSERT INTO pursuit_status (user_id, record_id, stage, next_conversation_at, next_move, closed_at, outcome, updated_at)
    VALUES (${userId}::uuid, ${recordId}, ${stage}, ${nextConversationAt}, ${nextMove}, ${closedAt}, ${outcome}, NOW())
    ON CONFLICT (user_id, record_id)
    DO UPDATE SET stage = EXCLUDED.stage,
                  next_conversation_at = EXCLUDED.next_conversation_at,
                  next_move = EXCLUDED.next_move,
                  closed_at = EXCLUDED.closed_at,
                  outcome = EXCLUDED.outcome,
                  updated_at = NOW()
  `
}

export default async function handler(req, res) {
  const method = req.method
  if (method !== 'GET' && method !== 'PUT' && method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Two auth modes, resolving the same user object:
  //  - Phase-two connector: a per-user bearer token whose SHA-256 hash matches
  //    users.push_token_hash. No cookie, no origin (a connector is not a browser).
  //  - Phase-one browser: cookie session + allowlisted origin.
  // Both then pass the same suspended + my_search gates below.
  const authHeader = req.headers.authorization || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  let user
  if (bearer) {
    const hash = crypto.createHash('sha256').update(bearer).digest('hex')
    try {
      const rows = await sql`SELECT id, feature_flags, suspended_at FROM users WHERE push_token_hash = ${hash} LIMIT 1`
      user = rows[0] || null
    } catch (err) {
      console.warn('pursuit-status: token lookup failed', err)
      user = null
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' })
    }
  } else {
    const origin = req.headers.origin || req.headers.referer || ''
    if (!isAllowedOrigin(origin)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    try {
      user = await getSessionUser(req, res)
    } catch (err) {
      console.warn('pursuit-status: session lookup failed', err)
      user = null
    }
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
  }
  if (user.suspended_at) {
    return res.status(403).json({ error: 'account_suspended' })
  }
  const flags = Array.isArray(user.feature_flags) ? user.feature_flags : []
  if (!flags.includes('my_search')) {
    return res.status(403).json({ error: 'Not enabled' })
  }

  try {
    if (method === 'GET') {
      const rows = await sql`
        SELECT record_id, stage, next_conversation_at, next_move, closed_at, outcome, updated_at
        FROM pursuit_status
        WHERE user_id = ${user.id}::uuid
      `
      return res.status(200).json({ rows })
    }

    if (method === 'PUT') {
      const body = req.body || {}
      const recordId = typeof body.recordId === 'string' ? body.recordId.trim() : ''
      if (!recordId) {
        return res.status(400).json({ error: 'recordId required' })
      }
      const patch = {}
      if (Object.prototype.hasOwnProperty.call(body, 'stage')) {
        const stage = body.stage === null ? null : (typeof body.stage === 'string' ? body.stage.trim() : '')
        if (stage !== null && !VALID_STAGES.has(stage)) {
          return res.status(400).json({ error: 'invalid stage' })
        }
        patch.stage = stage
      }
      if (Object.prototype.hasOwnProperty.call(body, 'outcome')) {
        const outcome = body.outcome === null ? null : (typeof body.outcome === 'string' ? body.outcome.trim() : '')
        if (outcome !== null && !VALID_OUTCOMES.has(outcome)) {
          return res.status(400).json({ error: 'invalid outcome' })
        }
        patch.outcome = outcome
      }
      if (Object.prototype.hasOwnProperty.call(body, 'nextMove')) {
        patch.next_move = body.nextMove === null ? null : stripNul(String(body.nextMove)).slice(0, 2000)
      }
      if (Object.prototype.hasOwnProperty.call(body, 'nextConversationAt')) {
        const p = parseTs(body.nextConversationAt)
        if (!p.ok) return res.status(400).json({ error: 'invalid nextConversationAt' })
        patch.next_conversation_at = p.value
      }
      if (Object.prototype.hasOwnProperty.call(body, 'closedAt')) {
        const p = parseTs(body.closedAt)
        if (!p.ok) return res.status(400).json({ error: 'invalid closedAt' })
        patch.closed_at = p.value
      }
      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: 'no status fields provided' })
      }
      await writeCore(user.id, recordId, patch)
      return res.status(200).json({ ok: true })
    }

    // POST -> reconcile.
    const body = req.body || {}
    const recordIds = Array.isArray(body.recordIds) ? body.recordIds.filter(x => typeof x === 'string') : []
    await sql`
      DELETE FROM pursuit_status
      WHERE user_id = ${user.id}::uuid AND record_id <> ALL(${recordIds}::text[])
    `
    return res.status(200).json({ ok: true, kept: recordIds.length })
  } catch (err) {
    console.error('pursuit-status: query failed', err)
    return res.status(500).json({ error: 'Could not update your pursuit status.' })
  }
}
