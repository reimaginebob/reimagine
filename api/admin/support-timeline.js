// Per-account support view (2026-09-08 observability brief, part B). Answers
// the question a support conversation actually opens with -- "where was this
// person, what were they doing, and what broke" -- without anyone reading a
// word of what they wrote.
//
// Everything here already existed in Postgres. What did not exist was any view
// that assembled it: generation_events, chat_messages, user_stage_events,
// pursuit_status_events, sessions and profile_state were six separate queries
// nobody ran together, so the answer to a support email was a guess.
//
// ---------------------------------------------------------------------------
// THE LINE THIS ENDPOINT DOES NOT CROSS
// ---------------------------------------------------------------------------
// No Coach message or reply text, ever. src/legalDocs.js line 56 permits
// authorized review of coaching conversations only DE-IDENTIFIED -- name, email
// and account identifiers removed before anyone reads the content. This view is
// the opposite posture by construction: it is keyed BY identity, so it cannot
// carry content and stay inside that promise. Staff access to a named person's
// transcript is a policy change plus a consent step, logged as pending with
// legal, and is deliberately out of scope here.
//
// So Coach appears as COUNTS: when a turn happened, which step it was on, what
// kind of turn it was, and how it was rated. The exclusion is enforced at the
// QUERY level, not in the UI -- message and reply are never SELECTed, so there
// is no rendering mistake, no console inspection and no future refactor that
// can surface them. That is the difference between a promise and a guarantee.
//
// Nothing here reads the anonymous analytics stream (analytics_events). That
// one is anonymous by policy (legalDocs line 40) and reading it by identity
// would break the promise regardless of what this endpoint did with the result.
//
// Auth: signed-in session + ADMIN_LOGIN_EMAILS (api/_lib/admin-auth.js, #803).
// Analysts are NOT admitted: every other analyst-readable endpoint is aggregate
// across accounts, and this one is a single named person's activity.
//
// Method: GET.
//   ?email=someone@example.com   required; normalized before lookup
//   ?days=30                     window, default 30, max 90 (the retention
//                                ceiling -- asking for more would silently
//                                return less and read as data loss)

import { sql } from '../_lib/db.js'
import { checkAdminAuth, adminLoginEmailsMissing } from '../_lib/admin-auth.js'
import { normalizeEmail } from '../_lib/normalize-email.js'

export const DEFAULT_DAYS = 30
export const MAX_DAYS = 90

export function parseDays(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_DAYS
  return Math.min(Math.max(Math.trunc(n), 1), MAX_DAYS)
}

// Merges the six sources into one time-ordered array. Pure and exported so the
// test can prove the shape WITHOUT a database: given rows that do contain
// message and reply text (which is what a careless future query would hand it),
// no entry it produces may carry them. Belt and braces behind the query-level
// exclusion -- if someone later adds `message` to the SELECT, this still drops
// it, and the test says so out loud.
export function buildTimeline({ supportEvents = [], generations = [], stages = [], pursuits = [], signIns = [], coachTurns = [] }) {
  const entries = []

  for (const r of supportEvents) {
    entries.push({
      type: 'failure',
      at: r.created_at,
      kind: r.kind,
      step: r.step || null,
      error_class: r.error_class || null,
      http_status: r.http_status ?? null,
      duration_ms: r.duration_ms ?? null,
      build_sha: r.build_sha || null,
      detail: r.detail || null,
    })
  }

  for (const r of generations) {
    entries.push({
      type: 'generation',
      at: r.created_at,
      kind: r.kind || null,
      model: r.model || null,
      cost_usd: r.cost_usd === null || r.cost_usd === undefined ? null : Number(r.cost_usd),
    })
  }

  for (const r of stages) {
    entries.push({ type: 'stage', at: r.recorded_at, stage: r.stage, source: r.source || null })
  }

  for (const r of pursuits) {
    entries.push({
      type: 'pursuit',
      at: r.created_at,
      stage: r.stage || null,
      outcome: r.outcome || null,
      prev_stage: r.prev_stage || null,
    })
  }

  for (const r of signIns) {
    entries.push({ type: 'session', at: r.created_at, last_used_at: r.last_used_at || null, user_agent: r.user_agent || null })
  }

  // The one source where the omission is the point. current_step says WHERE
  // they were talking to Coach, turn_kind says whether a person typed it at all
  // (session_open / orientation_check / post_capture turns are the app's own
  // instructions, not questions), and rating says how it landed. What was said
  // is not here and is not reachable from here.
  for (const r of coachTurns) {
    entries.push({
      type: 'coach',
      at: r.created_at,
      step: r.current_step || null,
      turn_kind: r.turn_kind || 'user',
      rating: r.rating ?? null,
    })
  }

  // Newest first: a support conversation starts from what just happened.
  return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (adminLoginEmailsMissing()) {
    console.error('admin/support-timeline: ADMIN_LOGIN_EMAILS not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  if (!(await checkAdminAuth(req, res))) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const rawEmail = (req.query && typeof req.query.email === 'string') ? req.query.email.trim().toLowerCase() : ''
  if (!rawEmail) return res.status(400).json({ error: 'email required' })

  const days = parseDays(req.query && req.query.days)

  try {
    // Exact match first. The address in a support email is almost always the
    // one on the account, and an exact lookup is the one a person can predict.
    let userRows = await sql`
      SELECT id, email, first_name, last_name, created_at, last_login_at, prior_session_at,
             employment_status, suspended_at, suspended_reason, feature_flags, track,
             profile_updated_at,
             profile_state->>'step'  AS current_step,
             profile_state->'done'   AS done
      FROM users
      WHERE lower(email) = ${rawEmail}
      LIMIT 1
    `
    // Then the provider-normalized fallback, because someone writing in from
    // b.ob+jobs@gmail.com IS the account at bob@gmail.com, and a support tool
    // that cannot find them is no use.
    //
    // This scans every account's email, which is a deliberate trade. Two
    // alternatives were worse: reimplementing normalizeEmail in SQL means two
    // implementations of "same inbox" that can drift apart, which is the exact
    // failure that function was extracted to prevent; and a LIKE prefix filter
    // does not work at all here, because normalizeEmail REMOVES dots -- the
    // normalized local part 'bob' is not a prefix of the stored 'b.ob'. At 145
    // accounts an id+email scan is nothing, it runs ONLY when the indexed exact
    // match above found nothing, and a human typed the query. Revisit if the
    // account count reaches a scale where that stops being true.
    if (!userRows.length) {
      const target = normalizeEmail(rawEmail)
      const ids = await sql`SELECT id, email FROM users`
      const match = ids.find(c => normalizeEmail(c.email) === target)
      if (match) {
        userRows = await sql`
          SELECT id, email, first_name, last_name, created_at, last_login_at, prior_session_at,
                 employment_status, suspended_at, suspended_reason, feature_flags, track,
                 profile_updated_at,
                 profile_state->>'step'  AS current_step,
                 profile_state->'done'   AS done
          FROM users
          WHERE id = ${match.id}
          LIMIT 1
        `
      }
    }
    if (!userRows.length) return res.status(404).json({ error: 'No account with that email' })
    const u = userRows[0]

    const [supportEvents, generations, stages, pursuits, signIns, coachTurns, playbooks, snapshots, failureTally] = await Promise.all([
      sql`SELECT kind, step, error_class, http_status, duration_ms, build_sha, detail, created_at
          FROM support_events
          WHERE user_id = ${u.id} AND created_at >= NOW() - (${days} * INTERVAL '1 day')
          ORDER BY created_at DESC LIMIT 500`,
      sql`SELECT kind, model, cost_usd, created_at
          FROM generation_events
          WHERE user_id = ${u.id} AND created_at >= NOW() - (${days} * INTERVAL '1 day')
          ORDER BY created_at DESC LIMIT 500`,
      sql`SELECT stage, source, recorded_at
          FROM user_stage_events
          WHERE user_id = ${u.id} AND recorded_at >= NOW() - (${days} * INTERVAL '1 day')
          ORDER BY recorded_at DESC`,
      sql`SELECT stage, outcome, prev_stage, created_at
          FROM pursuit_status_events
          WHERE user_id = ${u.id} AND created_at >= NOW() - (${days} * INTERVAL '1 day')
          ORDER BY created_at DESC LIMIT 200`,
      sql`SELECT created_at, last_used_at, user_agent
          FROM sessions
          WHERE user_id = ${u.id} AND created_at >= NOW() - (${days} * INTERVAL '1 day')
          ORDER BY created_at DESC LIMIT 100`,
      // message and reply are NOT in this SELECT, deliberately. See the header.
      sql`SELECT current_step, turn_kind, rating, created_at
          FROM chat_messages
          WHERE user_id = ${u.id} AND created_at >= NOW() - (${days} * INTERVAL '1 day')
          ORDER BY created_at DESC LIMIT 500`,
      sql`SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE archived_at IS NOT NULL)::int AS archived
          FROM saved_playbooks WHERE user_id = ${u.id}`,
      sql`SELECT snapshotted_at FROM profile_state_snapshots
          WHERE user_id = ${u.id} ORDER BY snapshotted_at DESC LIMIT 30`,
      // Over the whole retained window, not just the requested one: "has this
      // ever broken for them" is a different question from "did it break this
      // month", and the answer to the first is what decides whether a report is
      // a one-off or a pattern.
      sql`SELECT kind, error_class, COUNT(*)::int AS n, MAX(created_at) AS last_at
          FROM support_events WHERE user_id = ${u.id}
          GROUP BY kind, error_class ORDER BY n DESC`,
    ])

    const timeline = buildTimeline({ supportEvents, generations, stages, pursuits, signIns, coachTurns })

    // Coach as counts, per step. The reduction happens here rather than in the
    // page so there is one place that decides what "Coach activity" means.
    const coachByStep = {}
    for (const t of coachTurns) {
      const key = t.current_step || '(none)'
      const b = coachByStep[key] || (coachByStep[key] = { turns: 0, userTurns: 0, thumbsUp: 0, thumbsDown: 0 })
      b.turns++
      if (!t.turn_kind || t.turn_kind === 'user') b.userTurns++
      if (t.rating === 1) b.thumbsUp++
      if (t.rating === -1) b.thumbsDown++
    }

    return res.status(200).json({
      account: {
        email: u.email,
        name: [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || null,
        created_at: u.created_at,
        last_login_at: u.last_login_at,
        prior_session_at: u.prior_session_at,
        employment_status: u.employment_status,
        suspended_at: u.suspended_at,
        suspended_reason: u.suspended_reason,
        feature_flags: u.feature_flags || [],
        track: u.track,
        current_step: u.current_step,
        done: Array.isArray(u.done) ? u.done : [],
        profile_updated_at: u.profile_updated_at,
        playbooks: (playbooks[0] && playbooks[0].n) || 0,
        playbooks_archived: (playbooks[0] && playbooks[0].archived) || 0,
        snapshots: snapshots.map(s => s.snapshotted_at),
      },
      days,
      failureTally,
      coachByStep,
      timeline,
    })
  } catch (err) {
    console.error('admin/support-timeline: failed', err && err.message)
    return res.status(500).json({ error: 'Lookup failed' })
  }
}
