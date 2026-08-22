// What each account actually tried to generate, by step.
//
// Answers the question that splits a drop-out diagnosis in two without reading
// anything private: did this person ATTEMPT the step they never completed?
//
//   attempts, no output  ->  something broke, or the output was discarded
//   no attempts at all   ->  they never tried, which is a different problem
//                            entirely: either they did not know it was next, or
//                            they were getting what they needed elsewhere
//
// Auth: ADMIN_TOKEN, or ANALYST_TOKEN (read-only). No profile content, no
// generated text, no coach message bodies — step tags and counts only.
//
// Method: GET.
//   ?emails=a@b.com,c@d.com   restrict to specific accounts (comma-separated)
//
// ---------------------------------------------------------------------------
// THE CAVEAT THAT MAKES OR BREAKS THIS VIEW
// ---------------------------------------------------------------------------
// generation_events did not exist before 2026-08-15. For an account whose
// activity predates that, this endpoint has NO WINDOW — and zero attempts must
// never be read as "never tried". That distinction is the entire point of the
// `coverage` field, and any caller that ignores it will reach confident wrong
// conclusions about exactly the long-dormant accounts most worth understanding.
//
//   full     signed up after logging began; every attempt they made is here
//   partial  signed up before, active after; only the tail is visible
//   none     last activity predates logging; this endpoint knows nothing
//
// logging_started_at is read from the data rather than hardcoded, so it stays
// true if the table is ever pruned or rebuilt.

import { sql } from '../_lib/db.js'
import { checkAdminAuth, adminTokenMissing } from '../_lib/admin-auth.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (adminTokenMissing()) {
    console.error('admin/generation-attempts: ADMIN_TOKEN not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  if (!checkAdminAuth(req, { allowAnalyst: true })) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const raw = (req.query && typeof req.query.emails === 'string') ? req.query.emails : ''
  const emails = raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean).slice(0, 200)

  try {
    const startRows = await sql`SELECT MIN(created_at) AS started FROM generation_events`
    const loggingStarted = (startRows[0] && startRows[0].started) || null

    // One row per (user, step). Coach turns are included and tagged 'coach' --
    // they are generations in cost terms and useful context here, but they are
    // not a playbook step, so the caller can separate them.
    const rows = await sql`
      WITH base AS (
        SELECT u.id, u.email, u.created_at
        FROM users u
        WHERE (${emails.length === 0} OR LOWER(u.email) = ANY(${emails}::text[]))
      ),
      acts AS (
        SELECT user_id, MAX(at) AS last_at FROM (
          SELECT user_id, created_at AS at FROM sessions
          UNION ALL SELECT user_id, last_used_at FROM sessions
          UNION ALL SELECT user_id, created_at FROM generation_events WHERE user_id IS NOT NULL
          UNION ALL SELECT user_id, created_at FROM chat_messages WHERE user_id IS NOT NULL
        ) a GROUP BY user_id
      )
      SELECT
        b.email                                   AS email,
        b.created_at                              AS signed_up,
        a.last_at                                 AS last_activity,
        COALESCE(g.kind, '(untagged)')            AS step,
        COUNT(g.id)::int                          AS attempts,
        MIN(g.created_at)                         AS first_at,
        MAX(g.created_at)                         AS last_at
      FROM base b
      LEFT JOIN acts a ON a.user_id = b.id
      LEFT JOIN generation_events g ON g.user_id = b.id
      GROUP BY b.email, b.created_at, a.last_at, COALESCE(g.kind, '(untagged)')
      ORDER BY b.email`

    // Fold the per-step rows into one entry per account.
    const byEmail = new Map()
    for (const r of rows) {
      if (!byEmail.has(r.email)) {
        byEmail.set(r.email, {
          email: r.email,
          signed_up: r.signed_up,
          last_activity: r.last_activity || null,
          total_attempts: 0,
          steps: {},
          coach_turns: 0,
          first_attempt: null,
          last_attempt: null,
        })
      }
      const u = byEmail.get(r.email)
      // A LEFT JOIN with no matching events produces one row with attempts 0;
      // recording it as a step would invent a '(untagged)' entry for somebody
      // who simply has no events at all.
      if (r.attempts === 0) continue
      if (r.step === 'coach') u.coach_turns = r.attempts
      else u.steps[r.step] = r.attempts
      u.total_attempts += r.attempts
      if (!u.first_attempt || r.first_at < u.first_attempt) u.first_attempt = r.first_at
      if (!u.last_attempt || r.last_at > u.last_attempt) u.last_attempt = r.last_at
    }

    const startedMs = loggingStarted ? new Date(loggingStarted).getTime() : null
    const users = [...byEmail.values()].map((u) => {
      let coverage = 'full'
      if (startedMs === null) {
        coverage = 'none'
      } else if (new Date(u.signed_up).getTime() >= startedMs) {
        coverage = 'full'
      } else if (u.last_activity && new Date(u.last_activity).getTime() < startedMs) {
        coverage = 'none'
      } else {
        coverage = 'partial'
      }
      return { ...u, coverage }
    })

    return res.status(200).json({
      ok: true,
      as_of: new Date().toISOString(),
      logging_started_at: loggingStarted,
      // Repeated in the payload because it is the one thing a reader must not
      // miss: for coverage 'none', zero attempts means unknown, not never.
      coverage_note: "coverage 'none' means this endpoint has no window on that account — zero attempts is unknown, not never. 'partial' means only activity after logging_started_at is visible.",
      total: users.length,
      users,
    })
  } catch (err) {
    console.error('admin/generation-attempts: query failed', err && err.message)
    return res.status(500).json({ error: 'Query failed' })
  }
}
