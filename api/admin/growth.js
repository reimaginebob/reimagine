// Read-only usage and progression metrics for the Growth tab of
// /admin/dashboard. The set an investor asks for, computed from the tables we
// already have.
//
// Auth: Bearer ADMIN_TOKEN, same token as the other admin endpoints.
// Method: GET only. No range parameter -- every view here is either all-time,
// cohort-relative, or fixed to a named window, and a filter pill over cohort
// curves would mean nothing.
//
// The framing this endpoint is built around: Reimagine is a finite-journey
// product. Someone arrives in transition, works through it, and the goal is
// that they leave with a job. Habit-product metrics (daily actives, calendar
// retention, time in app) measure the wrong thing here and read low even when
// the product is working. So the spine is activation -> progression -> outcome,
// with return measured in weeks since each user's own signup rather than
// against the calendar.
//
// Every metric ships with its definition in the payload (DEFINITIONS below) and
// the tab renders them. Definitions that drift between one telling and the next
// are the fastest way to lose an audience, so they live in the response rather
// than in someone's memory.
//
// Deliberately does NOT read analytics_events: the Vercel drain stopped
// filling it (see the Panel 2 note in api/admin/analytics.js), so anything
// derived from it would quietly read as zero. Session behaviour is instead
// reconstructed from timestamped rows that carry a user_id.

import { sql } from '../_lib/db.js'

// The seven Focus Playbook sections, in sidebar order. Mirrors FOCUS_STEP_IDS
// in api/admin/analytics.js; p10 is retired and `income` is a separate bonus
// stripe, so neither counts toward depth.
const FOCUS_STEP_IDS = ['p5', 'p6', 'p7', 'p8', 'p9', 'p11', 'p_res']

// How many signup weeks the cohort table shows. Twelve keeps it readable and
// still covers a quarter.
const COHORT_WEEKS = 12
// Return columns per cohort row: week 0 (signup week) through week 5.
const RETURN_WEEKS = 6
// Idle gap that ends a working session. Thirty minutes is the common
// convention and it suits this product -- generating a section then reading it
// is one sitting, coming back that evening is another.
const SESSION_GAP_MIN = 30
// A return after this long idle counts as a resurrection rather than continuous
// use. Two weeks is long enough that the person had stopped.
const RESURRECT_DAYS = 14

const DEFINITIONS = {
  activation: 'Generated a first playbook: a saved Focus Playbook, or The Role written. One event, chosen once — every activation number on this page uses it.',
  orientation: 'Personal Brand generated. The first thing the product gives back, and the first point where someone can judge it.',
  focusComplete: 'All seven Focus Playbook sections marked done.',
  opportunity: 'Built an Opportunity Playbook against a real job. The expansion signal — the line between trying the tool and working in it.',
  activeDay: 'A day with a sign-in, a generation, or a coach turn. Reconstructed from rows that carry a user id; page views are not counted.',
  returnWeek: 'Weeks counted from each user\'s own signup date, not the calendar. Week 0 is their first seven days.',
  resurrection: `Came back after ${RESURRECT_DAYS}+ quiet days. For a job search this is the retention signal that matters — people return when their search moves.`,
  workingSession: `A run of actions with no gap longer than ${SESSION_GAP_MIN} minutes. Length is first action to last, so reading time after the final action is not counted — treat it as a floor.`,
  depth: 'How many of the seven Focus sections a person has generated.',
  recognition: 'Answers to "does this sound like you?" — the check-in on Personal Brand.',
  reached: 'Ever recorded at a stage, from the append-only stage history. An opportunity counts only at stages someone actually set — a jump straight to offer does not credit interviewing.',
  outcome: 'How an opportunity ended: accepted, declined, not selected, withdrew, or no response.',
}

// Mirrors parseAdminEmails in api/admin/analytics.js. Duplicated rather than
// shared: it is eight lines of pure parsing with fixed semantics, and a shared
// helper across api/admin/* would be a new import surface for no gain. The
// `::text[]` cast on the parameter is required -- Neon sends an empty JS array
// untyped, and Postgres cannot infer the type of an empty array.
function parseAdminEmails(envValue) {
  if (typeof envValue !== 'string') return []
  return envValue
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0)
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

async function loadPayload(adminEmails) {
  const [
    funnel,
    cohortSizes,
    cohortReturns,
    timeToActivate,
    depth,
    returnBehaviour,
    sessions,
    pipeline,
    reached,
    outcomes,
    historyCoverage,
    recognition,
    coach,
    sources,
  ] = await Promise.all([

    // --- 1. Activation funnel, all-time -----------------------------------
    // State-based rather than event-based so it covers every account,
    // including the ones that predate server-side playbook saving.
    // The per-user flags are computed in a CTE and only then aggregated. Same
    // result as putting the tests inside FILTER clauses, but the EXISTS
    // subqueries sit in a plain SELECT list where they are unambiguously legal.
    sql`
      WITH flags AS (
        SELECT
          NULLIF(TRIM(profile_state->'outputs'->>'p3'), '') IS NOT NULL AS orientation,
          (NULLIF(TRIM(profile_state->'outputs'->>'p5'), '') IS NOT NULL
            OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(profile_state->'savedPlaybooks', '[]'::jsonb)) pb
                        WHERE pb->>'source' = 'door1')) AS activated,
          (profile_state->'done' ?& ${FOCUS_STEP_IDS}::text[]) AS focus_complete,
          ((profile_state->'done') ? 'op'
            OR NULLIF(TRIM(profile_state->'outputs'->>'op'), '') IS NOT NULL
            OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(profile_state->'savedPlaybooks', '[]'::jsonb)) pb
                        WHERE pb->>'source' = 'door2')) AS opportunity
        FROM users
        WHERE LOWER(email) <> ALL(${adminEmails}::text[])
      )
      SELECT
        COUNT(*)::int                                    AS signups,
        COUNT(*) FILTER (WHERE orientation)::int         AS orientation,
        COUNT(*) FILTER (WHERE activated)::int           AS activated,
        COUNT(*) FILTER (WHERE focus_complete)::int      AS focus_complete,
        COUNT(*) FILTER (WHERE opportunity)::int         AS opportunity
      FROM flags`,

    // --- 2. Cohort sizes + activation by signup week ----------------------
    sql`
      WITH flags AS (
        SELECT
          to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS cohort_week,
          (NULLIF(TRIM(profile_state->'outputs'->>'p5'), '') IS NOT NULL
            OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(profile_state->'savedPlaybooks', '[]'::jsonb)) pb
                        WHERE pb->>'source' = 'door1')) AS activated,
          (profile_state->'done' ?& ${FOCUS_STEP_IDS}::text[]) AS focus_complete
        FROM users
        WHERE LOWER(email) <> ALL(${adminEmails}::text[])
          AND created_at >= date_trunc('week', NOW()) - ${`${COHORT_WEEKS - 1} weeks`}::interval
      )
      SELECT
        cohort_week,
        COUNT(*)::int                               AS signups,
        COUNT(*) FILTER (WHERE activated)::int      AS activated,
        COUNT(*) FILTER (WHERE focus_complete)::int AS focus_complete
      FROM flags
      GROUP BY cohort_week
      ORDER BY cohort_week`,

    // --- 3. Week-N return, per cohort -------------------------------------
    // Weeks are counted from each user's own signup moment, so week 0 is their
    // first seven days rather than the remainder of a calendar week.
    sql`
      WITH base AS (
        SELECT id, created_at, to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS cohort_week
        FROM users
        WHERE LOWER(email) <> ALL(${adminEmails}::text[])
          AND created_at >= date_trunc('week', NOW()) - ${`${COHORT_WEEKS - 1} weeks`}::interval
      ),
      acts AS (
        SELECT user_id, created_at AS at FROM sessions
        UNION ALL SELECT user_id, last_used_at FROM sessions
        UNION ALL SELECT user_id, created_at FROM generation_events WHERE user_id IS NOT NULL
        UNION ALL SELECT user_id, created_at FROM chat_messages WHERE user_id IS NOT NULL
      ),
      spans AS (
        SELECT b.cohort_week, b.id,
               FLOOR(EXTRACT(EPOCH FROM (a.at - b.created_at)) / 604800)::int AS wk
        FROM base b
        JOIN acts a ON a.user_id = b.id
        WHERE a.at >= b.created_at
      )
      SELECT cohort_week, wk, COUNT(DISTINCT id)::int AS users
      FROM spans
      WHERE wk >= 0 AND wk < ${RETURN_WEEKS}
      GROUP BY 1, 2
      ORDER BY 1, 2`,

    // --- 4. Time from signup to first saved playbook ----------------------
    // Only savedPlaybooks carries a per-playbook timestamp, so this covers
    // accounts whose playbooks were saved server-side. Reported with that
    // population size so the median is read against the right denominator.
    sql`
      WITH firsts AS (
        SELECT u.id, u.created_at,
               MIN(NULLIF(pb->>'createdAt', '')::timestamptz) AS first_pb
        FROM users u
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(u.profile_state->'savedPlaybooks', '[]'::jsonb)) pb
        WHERE LOWER(u.email) <> ALL(${adminEmails}::text[])
          AND pb->>'source' = 'door1'
        GROUP BY u.id, u.created_at
      )
      SELECT
        COUNT(*)::int AS users,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_pb - created_at)) / 3600)::float8 AS median_hours,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_pb - created_at)) / 3600)::float8 AS p25_hours,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_pb - created_at)) / 3600)::float8 AS p75_hours
      FROM firsts
      WHERE first_pb IS NOT NULL AND first_pb >= created_at`,

    // --- 5. Progression depth: sections generated per user ----------------
    sql`
      WITH base AS (
        SELECT id, profile_state FROM users
        WHERE LOWER(email) <> ALL(${adminEmails}::text[])
      ),
      d AS (
        SELECT b.id,
               (SELECT COUNT(*) FROM unnest(${FOCUS_STEP_IDS}::text[]) AS s(sid)
                 WHERE NULLIF(TRIM(b.profile_state->'outputs'->>s.sid), '') IS NOT NULL)::int AS sections
        FROM base b
      )
      SELECT sections, COUNT(*)::int AS users
      FROM d GROUP BY sections ORDER BY sections`,

    // --- 6. Return behaviour ----------------------------------------------
    sql`
      WITH base AS (
        SELECT id, created_at FROM users
        WHERE LOWER(email) <> ALL(${adminEmails}::text[])
      ),
      acts AS (
        SELECT user_id, created_at AS at FROM sessions
        UNION ALL SELECT user_id, last_used_at FROM sessions
        UNION ALL SELECT user_id, created_at FROM generation_events WHERE user_id IS NOT NULL
        UNION ALL SELECT user_id, created_at FROM chat_messages WHERE user_id IS NOT NULL
      ),
      days AS (
        SELECT DISTINCT b.id, date_trunc('day', a.at)::date AS d, b.created_at
        FROM base b JOIN acts a ON a.user_id = b.id
        WHERE a.at >= b.created_at
      ),
      gaps AS (
        SELECT id, d, d - LAG(d) OVER (PARTITION BY id ORDER BY d) AS gap
        FROM days
      )
      SELECT
        (SELECT COUNT(*)::int FROM base)                                                        AS users,
        (SELECT COUNT(DISTINCT id)::int FROM days WHERE d > created_at::date)                   AS returned_after_day_one,
        (SELECT COUNT(DISTINCT id)::int FROM gaps WHERE gap > ${RESURRECT_DAYS})                AS resurrected,
        (SELECT COUNT(DISTINCT id)::int FROM days WHERE d >= (NOW() - INTERVAL '7 days')::date) AS active_7d,
        (SELECT COUNT(DISTINCT id)::int FROM days WHERE d >= (NOW() - INTERVAL '30 days')::date) AS active_30d,
        (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY n)::float8
           FROM (SELECT id, COUNT(*)::int AS n FROM days GROUP BY id) t)                        AS median_active_days`,

    // --- 7. Working sessions ----------------------------------------------
    // A run of actions with no gap longer than SESSION_GAP_MIN. Length is
    // first action to last, so it is a floor: whatever someone read after
    // their last click is invisible here.
    sql`
      WITH acts AS (
        SELECT s.user_id, s.created_at AS at FROM sessions s
        UNION ALL SELECT g.user_id, g.created_at FROM generation_events g WHERE g.user_id IS NOT NULL
        UNION ALL SELECT c.user_id, c.created_at FROM chat_messages c WHERE c.user_id IS NOT NULL
      ),
      filtered AS (
        SELECT a.user_id, a.at
        FROM acts a JOIN users u ON u.id = a.user_id
        WHERE LOWER(u.email) <> ALL(${adminEmails}::text[])
      ),
      marked AS (
        SELECT user_id, at,
               CASE WHEN LAG(at) OVER (PARTITION BY user_id ORDER BY at) IS NULL
                      OR at - LAG(at) OVER (PARTITION BY user_id ORDER BY at) > ${`${SESSION_GAP_MIN} minutes`}::interval
                    THEN 1 ELSE 0 END AS is_new
        FROM filtered
      ),
      grouped AS (
        SELECT user_id, at,
               SUM(is_new) OVER (PARTITION BY user_id ORDER BY at ROWS UNBOUNDED PRECEDING) AS grp
        FROM marked
      ),
      sess AS (
        SELECT user_id, grp, MIN(at) AS started, MAX(at) AS ended, COUNT(*)::int AS actions
        FROM grouped GROUP BY user_id, grp
      )
      SELECT
        COUNT(*)::int                                                                          AS sessions,
        COUNT(DISTINCT user_id)::int                                                           AS users,
        MIN(started)                                                                           AS earliest,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (ended - started)) / 60)::float8 AS median_minutes,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (ended - started)) / 60)::float8 AS p75_minutes,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY actions)::float8                           AS median_actions,
        COUNT(*) FILTER (WHERE actions = 1)::int                                               AS single_action_sessions
      FROM sess`,

    // --- 8. Pipeline outcomes ---------------------------------------------
    // Stage is the current state, not a history: pursuit_status holds one row
    // per opportunity and updates in place, so "reached interviewing" cannot be
    // recovered for a record that has since closed. Counts are therefore where
    // things stand now.
    sql`
      SELECT
        COALESCE(p.stage, '(none)')::text AS stage,
        COUNT(*)::int                     AS records,
        COUNT(DISTINCT p.user_id)::int    AS users
      FROM pursuit_status p
      JOIN users u ON u.id = p.user_id
      WHERE LOWER(u.email) <> ALL(${adminEmails}::text[])
      GROUP BY 1
      ORDER BY records DESC`,

    // --- 8b. Stages ever reached, from the append-only history -------------
    // The counterpart to the query above: that one is where things stand, this
    // one is where they have been. An opportunity is counted at every stage it
    // was actually recorded at -- a jump from applied straight to offer does
    // not silently credit "interviewing", because nobody observed it.
    sql`
      SELECT
        e.stage                                                            AS stage,
        COUNT(DISTINCT (e.user_id::text || ':' || e.record_id))::int       AS opportunities,
        COUNT(DISTINCT e.user_id)::int                                     AS users
      FROM pursuit_status_events e
      JOIN users u ON u.id = e.user_id
      WHERE e.stage IS NOT NULL
        AND LOWER(u.email) <> ALL(${adminEmails}::text[])
      GROUP BY e.stage`,

    // --- 8c. Outcomes ever recorded ----------------------------------------
    sql`
      SELECT
        e.outcome                                                          AS outcome,
        COUNT(DISTINCT (e.user_id::text || ':' || e.record_id))::int       AS opportunities,
        COUNT(DISTINCT e.user_id)::int                                     AS users
      FROM pursuit_status_events e
      JOIN users u ON u.id = e.user_id
      WHERE e.outcome IS NOT NULL
        AND LOWER(u.email) <> ALL(${adminEmails}::text[])
      GROUP BY e.outcome`,

    // --- 8d. How much of the history was observed vs seeded ----------------
    // A backfilled row says only where an opportunity stood the day the log
    // shipped; the stages a closed record passed through beforehand were never
    // written and cannot be recovered. Reported so the page can say so.
    sql`
      SELECT
        COUNT(*) FILTER (WHERE source = 'live')::int      AS live_events,
        COUNT(*) FILTER (WHERE source = 'backfill')::int  AS backfill_events,
        MIN(created_at) FILTER (WHERE source = 'live')    AS first_live_at
      FROM pursuit_status_events`,

    // --- 9. Recognition: "does this sound like you?" -----------------------
    sql`
      SELECT answer, COUNT(*)::int AS n
      FROM coach_checkin_responses c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE u.id IS NULL OR LOWER(u.email) <> ALL(${adminEmails}::text[])
      GROUP BY answer`,

    // --- 10. Coach engagement ----------------------------------------------
    sql`
      SELECT
        COUNT(DISTINCT c.user_id)::int AS users,
        COUNT(*)::int                  AS turns,
        (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY n)::float8
           FROM (SELECT COUNT(*)::int AS n FROM chat_messages cm
                  JOIN users u2 ON u2.id = cm.user_id
                  WHERE LOWER(u2.email) <> ALL(${adminEmails}::text[])
                  GROUP BY cm.user_id) t) AS median_turns
      FROM chat_messages c
      JOIN users u ON u.id = c.user_id
      WHERE LOWER(u.email) <> ALL(${adminEmails}::text[])`,

    // --- 11. Where signups came from ---------------------------------------
    // Accounts created before the question shipped hold NULL. Reported as
    // "predates the question" rather than as an unknown source, because those
    // are different things and folding them together would understate every
    // real share.
    sql`
      SELECT
        COALESCE(signup_source, '(not asked)') AS source,
        COUNT(*)::int                          AS users,
        COUNT(*) FILTER (WHERE NULLIF(TRIM(signup_source_detail), '') IS NOT NULL)::int AS with_detail
      FROM users
      WHERE LOWER(email) <> ALL(${adminEmails}::text[])
      GROUP BY 1
      ORDER BY users DESC`,
  ])

  // --- Assemble the cohort matrix ----------------------------------------
  const returnsByWeek = new Map()
  for (const r of cohortReturns) {
    if (!returnsByWeek.has(r.cohort_week)) returnsByWeek.set(r.cohort_week, {})
    returnsByWeek.get(r.cohort_week)[num(r.wk)] = num(r.users)
  }
  const cohorts = cohortSizes.map((c) => {
    const ret = returnsByWeek.get(c.cohort_week) || {}
    return {
      cohort_week: c.cohort_week,
      signups: num(c.signups),
      activated: num(c.activated),
      focus_complete: num(c.focus_complete),
      activation_rate: num(c.signups) > 0 ? num(c.activated) / num(c.signups) : null,
      // Week 0 is a user's first seven days, so it should be at or near the
      // cohort size; a low week 0 means people never came back after signing up.
      weeks: Array.from({ length: RETURN_WEEKS }, (_, i) => (ret[i] === undefined ? null : ret[i])),
    }
  })

  const f = funnel[0] || {}
  const t = timeToActivate[0] || {}
  const r = returnBehaviour[0] || {}
  const s = sessions[0] || {}
  const c = coach[0] || {}
  const rec = recognition.reduce((m, row) => { m[row.answer] = num(row.n); return m }, {})
  const recTotal = (rec.yes || 0) + (rec.mostly || 0) + (rec.not_quite || 0)

  return {
    as_of: new Date().toISOString(),
    definitions: DEFINITIONS,
    settings: { cohort_weeks: COHORT_WEEKS, return_weeks: RETURN_WEEKS, session_gap_min: SESSION_GAP_MIN, resurrect_days: RESURRECT_DAYS },
    funnel: {
      signups: num(f.signups),
      orientation: num(f.orientation),
      activated: num(f.activated),
      focus_complete: num(f.focus_complete),
      opportunity: num(f.opportunity),
    },
    cohorts,
    time_to_activate: {
      users: num(t.users),
      median_hours: t.median_hours === null || t.median_hours === undefined ? null : num(t.median_hours),
      p25_hours: t.p25_hours === null || t.p25_hours === undefined ? null : num(t.p25_hours),
      p75_hours: t.p75_hours === null || t.p75_hours === undefined ? null : num(t.p75_hours),
    },
    depth: depth.map((d) => ({ sections: num(d.sections), users: num(d.users) })),
    retention: {
      users: num(r.users),
      returned_after_day_one: num(r.returned_after_day_one),
      resurrected: num(r.resurrected),
      active_7d: num(r.active_7d),
      active_30d: num(r.active_30d),
      median_active_days: r.median_active_days === null || r.median_active_days === undefined ? null : num(r.median_active_days),
    },
    sessions: {
      sessions: num(s.sessions),
      users: num(s.users),
      earliest: s.earliest || null,
      median_minutes: s.median_minutes === null || s.median_minutes === undefined ? null : num(s.median_minutes),
      p75_minutes: s.p75_minutes === null || s.p75_minutes === undefined ? null : num(s.p75_minutes),
      median_actions: s.median_actions === null || s.median_actions === undefined ? null : num(s.median_actions),
      single_action_sessions: num(s.single_action_sessions),
    },
    pipeline: pipeline.map((p) => ({ stage: p.stage, records: num(p.records), users: num(p.users) })),
    reached: reached.map((p) => ({ stage: p.stage, opportunities: num(p.opportunities), users: num(p.users) })),
    outcomes: outcomes.map((p) => ({ outcome: p.outcome, opportunities: num(p.opportunities), users: num(p.users) })),
    history_coverage: {
      live_events: num((historyCoverage[0] || {}).live_events),
      backfill_events: num((historyCoverage[0] || {}).backfill_events),
      first_live_at: (historyCoverage[0] || {}).first_live_at || null,
    },
    recognition: {
      yes: rec.yes || 0,
      mostly: rec.mostly || 0,
      not_quite: rec.not_quite || 0,
      total: recTotal,
      rate: recTotal > 0 ? (rec.yes || 0) / recTotal : null,
    },
    coach: {
      users: num(c.users),
      turns: num(c.turns),
      median_turns: c.median_turns === null || c.median_turns === undefined ? null : num(c.median_turns),
    },
    sources: sources.map((x) => ({ source: x.source, users: num(x.users), with_detail: num(x.with_detail) })),
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const expected = process.env.ADMIN_TOKEN
  if (!expected) {
    console.error('admin/growth: ADMIN_TOKEN not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  if ((req.headers.authorization || '') !== `Bearer ${expected}`) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS)
    return res.status(200).json({ ok: true, ...(await loadPayload(adminEmails)) })
  } catch (err) {
    console.error('admin/growth: query failed', err && err.message)
    return res.status(500).json({ error: 'Query failed' })
  }
}
