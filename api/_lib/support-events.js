import { sql } from './db.js'

// The operational error trail (2026-09-08 observability brief, part A). One row
// per failed generation, failed Coach turn, browser crash, and failed save,
// keyed by account, so "my Personal Brand never came back" has something behind
// it other than a Vercel console line nobody can join to a person.
//
// EVERY WRITE GOES THROUGH sanitizeSupportEvent. That function is the privacy
// boundary in code, and it is a WHITELIST: a field the caller passes that is
// not on ALLOWED_FIELDS is dropped, by construction, rather than carried
// through to an INSERT. This matters most for the client-facing endpoints,
// where the caller is a browser and the body is whatever it chose to send -- a
// browser cannot widen this table by adding a key. The migration's own CHECK on
// detail is the second layer for the one field that carries free text at all.
//
// What must never appear in a row: prompt text, reply text, profile or resume
// content, Coach message bodies, stack traces. `detail` holds an error message
// or an error class and nothing else, capped at 200 characters.
//
// recordSupportEvent NEVER throws and never changes a response. It is awaited
// at its call sites (serverless may freeze the instance the moment the response
// is written, which would drop a fire-and-forget insert) but a failure here is
// logged and swallowed, exactly like api/claude.js's logGeneration.

export const SUPPORT_EVENT_KINDS = Object.freeze([
  'generation_failed',
  'coach_failed',
  'client_crash',
  'save_failed',
  // Not a failure the person saw: a conversation summary was about to be
  // offered for one opportunity while naming another, and the offer was
  // suppressed rather than risk filing it on the wrong record (api/coach.js,
  // summaryNamesOtherOpportunity). Recorded so the rate is visible -- this
  // firing often means the scope instruction needs work, not the guard.
  'coach_summary_scope_bleed',
])

// The kinds a browser is allowed to post to api/support/client-event.js. The
// two server-side kinds are absent on purpose: a client that could post
// `generation_failed` could invent failures the server never saw, which makes
// the trail worse than no trail.
export const CLIENT_SUPPORT_EVENT_KINDS = Object.freeze(['client_crash', 'save_failed'])

export const DETAIL_MAX = 200

// Per-column caps. Nothing here is a content column, so these are about keeping
// one malformed caller from writing a megabyte into a log row, not about
// truncating meaning: a user agent past 300 characters is a spoof, a step past
// 60 is not one of ours.
const FIELD_LIMITS = Object.freeze({
  step: 60,
  error_class: 40,
  build_sha: 64,
  user_agent: 300,
  detail: DETAIL_MAX,
})

const ALLOWED_FIELDS = Object.freeze(['step', 'error_class', 'http_status', 'duration_ms', 'build_sha', 'user_agent', 'detail'])
const INT_FIELDS = Object.freeze(['http_status', 'duration_ms'])

function cleanText(value, limit) {
  if (value === null || value === undefined) return null
  // Errors stringify to something useful ('Cannot read properties of...');
  // anything that would land as '[object Object]' is noise, so it is dropped.
  const raw = value instanceof Error ? String(value.message || value) : String(value)
  // Control characters (including the NUL that Postgres rejects outright) and
  // newlines collapse to spaces: a log row is one line, and a multi-line value
  // is a stack trace trying to get in.
  const flat = raw.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!flat || flat === '[object Object]') return null
  return flat.slice(0, limit)
}

function cleanInt(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  // int4 range, and a negative duration is a clock artifact rather than data.
  const rounded = Math.trunc(n)
  if (rounded < 0 || rounded > 2147483647) return null
  return rounded
}

// Pure, exported for the behavioral test: given a kind and an arbitrary caller
// object, produce exactly the columns this table has, or null if the kind is
// not one of ours. Callers get back a fresh object -- never the input -- so no
// stray key can ride along by reference.
export function sanitizeSupportEvent(kind, fields) {
  const k = typeof kind === 'string' ? kind.trim() : ''
  if (!SUPPORT_EVENT_KINDS.includes(k)) return null
  const src = (fields && typeof fields === 'object') ? fields : {}
  const out = { kind: k }
  for (const name of ALLOWED_FIELDS) {
    out[name] = INT_FIELDS.includes(name)
      ? cleanInt(src[name])
      : cleanText(src[name], FIELD_LIMITS[name])
  }
  return out
}

export async function recordSupportEvent(userId, kind, fields = {}) {
  const row = sanitizeSupportEvent(kind, fields)
  if (!row) {
    console.error('support-events: refused unknown kind', { kind })
    return
  }
  try {
    await sql`
      INSERT INTO support_events
        (user_id, kind, step, error_class, http_status, duration_ms, build_sha, user_agent, detail)
      VALUES
        (${userId || null}, ${row.kind}, ${row.step}, ${row.error_class}, ${row.http_status},
         ${row.duration_ms}, ${row.build_sha}, ${row.user_agent}, ${row.detail})`
  } catch (err) {
    // A logging failure must never become a user-visible failure -- least of
    // all on these paths, where something has already gone wrong for them.
    console.error('support-events: insert failed', { kind: row.kind, message: (err && err.message) || String(err) })
  }
}

// Per-user cap for the browser-posted kinds. Deliberately counts rows in
// support_events itself rather than adding a second counter table: the trail IS
// the record of how much this account has posted, and the (user_id, created_at)
// index already exists for the timeline.
//
// Fails OPEN on a counting hiccup, matching every other limiter in this
// codebase (api/claude.js's generation cap, api/_lib/auth-rate-limit.js): a DB
// blip should not silence crash reporting for a real user who is, by
// definition, already having a bad time.
export async function clientEventRateLimited(userId, { windowMinutes = 15, limit = 30 } = {}) {
  if (!userId) return false
  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS n
      FROM support_events
      WHERE user_id = ${userId}
        AND kind = ANY(${CLIENT_SUPPORT_EVENT_KINDS})
        AND created_at > NOW() - (${windowMinutes} * INTERVAL '1 minute')
    `
    return ((rows[0] && rows[0].n) || 0) >= limit
  } catch (e) {
    console.error('support-events: rate-limit count skipped:', e && e.message)
    return false
  }
}
