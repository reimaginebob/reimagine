// Read-only admin endpoint that powers the Reimagine Daily Cowork artifact.
// Aggregates across the existing Neon tables (users, sessions, magic_link_
// tokens, survey_responses) plus the analytics_events table populated by
// api/admin/analytics-drain.js.
//
// Auth: Bearer token via ADMIN_TOKEN env var. Mirrors the CRON_SECRET pattern
// in api/survey/daily-digest.js verbatim with the env-var swap. Strict
// equality check; mismatch returns 403. Missing env var returns 500.
//
// Method: GET only.
//
// Query parameters:
//   range   - one of "24h" | "7d" | "30d". Default "7d". Anything else falls
//             back to 7d.
//   detail  - optional user UUID. When present, the response shape is the
//             per-user drill-in payload instead of the six-panel aggregate.
//
// savedPlaybooks-derived counts:
//   As of PR A (#164, 2026-06-05) src/App.jsx persists the savedPlaybooks
//   array to users.profile_state via the autosave PUT to /api/profile/save,
//   so per-playbook data is now queryable server-side. Panel 1 surfaces real
//   per-playbook counts (focus_playbooks_built / op_playbooks_built, summed
//   across each user's savedPlaybooks array filtered by record source), and
//   panel_1b_playbook_drill_in returns per-playbook records (title, lane,
//   source, schema version, sections built, timestamps).
//   The legacy per-user boolean proxies (focus_complete_users /
//   op_started_users) stay alongside during the transition: a legacy user who
//   has not triggered a state change since PR A landed has no server-side
//   savedPlaybooks yet, so the proxies remain the fallback until the data
//   backfills. Drop the proxies in a follow-up after ~2 weeks of bake.

import { sql } from '../_lib/db.js'

// Focus Playbook section IDs. Mirrors FOCUS_GROUPS in src/App.jsx (line
// ~3007). p10 is retired (single-line stub redirecting to p11 per
// CLAUDE.md section 5) and is intentionally excluded. `income` is a
// separate bonus stripe and is tracked on Panel 6, not as part of the
// Focus completion set.
const FOCUS_STEP_IDS = ['p5', 'p6', 'p7', 'p8', 'p9', 'p11', 'p_res']

// Funnel step IDs surfaced on Panel 2. Subset of FOCUS_STEP_IDS in the
// canonical sidebar order so the dashboard reads top-to-bottom the same
// way the user encounters them.
const FUNNEL_STEP_IDS = ['p5', 'p6', 'p9', 'p11', 'p_res', 'p8', 'p7']

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function rangeToInterval(range) {
  switch (range) {
    case '24h': return '24 hours'
    case '30d': return '30 days'
    case '7d':
    default:    return '7 days'
  }
}

// Parse the ADMIN_EMAILS env var into a normalized string[]. Split on comma,
// trim, lowercase, drop empties. Unset / empty / all-whitespace -> []. An
// empty array makes every `LOWER(email) <> ALL(${adminEmails}::text[])` clause
// a no-op (a `<> ALL` against an empty array is TRUE for every row), so the
// unset-env-var path preserves current behavior. The `::text[]` cast on the
// parameter is required: Neon's HTTP transport sends an empty JS array as an
// untyped parameter, and without the cast Postgres raises "could not determine
// data type" when the array is empty.
function parseAdminEmails(envValue) {
  if (typeof envValue !== 'string') return []
  return envValue
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0)
}

async function loadAggregate(rangeInterval, adminEmails) {
  // One Promise.all wave so panel queries fan out in parallel. Each entry
  // returns an array of rows from the Neon HTTP fetch transport.
  const [
    topLine,
    sessionsInRange,
    activeUsers,
    magicLinkStats,
    funnelRows,
    regenRows,
    bridgeRows,
    npsTrend,
    npsDist,
    npsByRole,
    npsOpenText,
    npsBuckets,
    surveyHeartbeat,
    surveyInRange,
    incomeUsage,
    drillInRows,
  ] = await Promise.all([
    // Panel 1: top-line counts (users + Focus / Op proxy counts).
    sql`
      SELECT
        (SELECT COUNT(*)::int FROM users
           WHERE LOWER(email) <> ALL(${adminEmails}::text[]))                                             AS total_users,
        (SELECT COUNT(*)::int FROM users
           WHERE created_at >= NOW() - (${rangeInterval})::interval
             AND LOWER(email) <> ALL(${adminEmails}::text[]))                                             AS users_in_range,
        (SELECT COUNT(*)::int FROM users
           WHERE profile_state->'done' ?& array['p5','p6','p7','p8','p9','p11','p_res']
             AND LOWER(email) <> ALL(${adminEmails}::text[]))                                             AS focus_complete_users,
        (SELECT COUNT(*)::int FROM users
           WHERE ((profile_state->'done') ? 'op'
                   OR (profile_state->'outputs'->>'op') IS NOT NULL)
             AND LOWER(email) <> ALL(${adminEmails}::text[]))                                             AS op_started_users,
        (SELECT COALESCE(SUM(
           (SELECT COUNT(*)::int FROM jsonb_array_elements(COALESCE(profile_state->'savedPlaybooks','[]'::jsonb)) AS pb
            WHERE pb->>'source' = 'door1')
        ), 0)::int FROM users
           WHERE LOWER(email) <> ALL(${adminEmails}::text[]))                                             AS focus_playbooks_built,
        (SELECT COALESCE(SUM(
           (SELECT COUNT(*)::int FROM jsonb_array_elements(COALESCE(profile_state->'savedPlaybooks','[]'::jsonb)) AS pb
            WHERE pb->>'source' = 'door2')
        ), 0)::int FROM users
           WHERE LOWER(email) <> ALL(${adminEmails}::text[]))                                             AS op_playbooks_built
    `,
    sql`
      SELECT COUNT(*)::int AS session_count
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.created_at >= NOW() - (${rangeInterval})::interval
        AND LOWER(u.email) <> ALL(${adminEmails}::text[])
    `,
    sql`
      SELECT COUNT(DISTINCT s.user_id)::int AS active_users
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.last_used_at >= NOW() - (${rangeInterval})::interval
        AND LOWER(u.email) <> ALL(${adminEmails}::text[])
    `,
    sql`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - (${rangeInterval})::interval)::int AS issued,
        COUNT(*) FILTER (WHERE used_at IS NOT NULL
                           AND used_at >= NOW() - (${rangeInterval})::interval)::int   AS used
      FROM magic_link_tokens
      WHERE LOWER(email) <> ALL(${adminEmails}::text[])
    `,
    // Panel 2: funnel per step. Counts of unique session_id that fired each
    // tracked event for each Focus step. session_id NULL is excluded so we
    // do not count "anonymous bucket" as a session.
    sql`
      SELECT
        event_data->>'step'           AS step,
        event_name,
        COUNT(DISTINCT session_id)::int AS sessions
      FROM analytics_events
      WHERE "timestamp" >= (EXTRACT(EPOCH FROM NOW() - (${rangeInterval})::interval) * 1000)::bigint
        AND event_name IN ('step_entered', 'generation_started', 'section_completed')
        AND event_data->>'step' = ANY(${FUNNEL_STEP_IDS})
        AND session_id IS NOT NULL
      GROUP BY event_data->>'step', event_name
    `,
    // Panel 4a: inferred regenerations per step. generation_started count
    // minus section_completed count per step (floored at 0). Coarse proxy;
    // see the design brief for the per-session inference we deliberately
    // dropped.
    sql`
      SELECT
        event_data->>'step' AS step,
        SUM(CASE WHEN event_name = 'generation_started' THEN 1 ELSE 0 END)::int AS started,
        SUM(CASE WHEN event_name = 'section_completed' THEN 1 ELSE 0 END)::int  AS completed
      FROM analytics_events
      WHERE "timestamp" >= (EXTRACT(EPOCH FROM NOW() - (${rangeInterval})::interval) * 1000)::bigint
        AND event_name IN ('generation_started', 'section_completed')
        AND event_data->>'step' IS NOT NULL
      GROUP BY event_data->>'step'
    `,
    // Panel 4b: Bridge Story pick distribution. block + optionIndex pairs.
    sql`
      SELECT
        event_data->>'block'       AS block,
        event_data->>'optionIndex' AS option_index,
        COUNT(*)::int              AS picks
      FROM analytics_events
      WHERE "timestamp" >= (EXTRACT(EPOCH FROM NOW() - (${rangeInterval})::interval) * 1000)::bigint
        AND event_name = 'bridge_block_picked'
      GROUP BY event_data->>'block', event_data->>'optionIndex'
      ORDER BY event_data->>'block', event_data->>'optionIndex'
    `,
    // Panel 3: NPS trend (daily count + average).
    sql`
      SELECT
        DATE_TRUNC('day', sr.created_at) AS day,
        COUNT(*)::int                  AS responses,
        ROUND(AVG(sr.nps_score)::numeric, 2) AS avg_nps
      FROM survey_responses sr
      JOIN users u ON u.id = sr.user_id
      WHERE sr.created_at >= NOW() - (${rangeInterval})::interval
        AND LOWER(u.email) <> ALL(${adminEmails}::text[])
      GROUP BY DATE_TRUNC('day', sr.created_at)
      ORDER BY day
    `,
    sql`
      SELECT sr.nps_score, COUNT(*)::int AS count
      FROM survey_responses sr
      JOIN users u ON u.id = sr.user_id
      WHERE sr.created_at >= NOW() - (${rangeInterval})::interval
        AND LOWER(u.email) <> ALL(${adminEmails}::text[])
      GROUP BY sr.nps_score
      ORDER BY sr.nps_score
    `,
    sql`
      SELECT sr.chosen_role, COUNT(*)::int AS responses,
        ROUND(AVG(sr.nps_score)::numeric, 2) AS avg_nps
      FROM survey_responses sr
      JOIN users u ON u.id = sr.user_id
      WHERE sr.created_at >= NOW() - (${rangeInterval})::interval
        AND sr.chosen_role IS NOT NULL
        AND LOWER(u.email) <> ALL(${adminEmails}::text[])
      GROUP BY sr.chosen_role
      ORDER BY responses DESC
    `,
    sql`
      SELECT sr.user_id, sr.nps_score, sr.chosen_role, sr.open_text, sr.created_at
      FROM survey_responses sr
      JOIN users u ON u.id = sr.user_id
      WHERE sr.open_text IS NOT NULL AND sr.open_text <> ''
        AND LOWER(u.email) <> ALL(${adminEmails}::text[])
      ORDER BY sr.created_at DESC
      LIMIT 25
    `,
    sql`
      SELECT
        SUM(CASE WHEN sr.nps_score >= 9 THEN 1 ELSE 0 END)::int AS promoters,
        SUM(CASE WHEN sr.nps_score BETWEEN 7 AND 8 THEN 1 ELSE 0 END)::int AS passives,
        SUM(CASE WHEN sr.nps_score <= 6 THEN 1 ELSE 0 END)::int AS detractors,
        COUNT(*)::int AS total
      FROM survey_responses sr
      JOIN users u ON u.id = sr.user_id
      WHERE sr.created_at >= NOW() - (${rangeInterval})::interval
        AND LOWER(u.email) <> ALL(${adminEmails}::text[])
    `,
    // Panel 5: system health.
    sql`
      SELECT MAX(sr.created_at) AS last_survey_at
      FROM survey_responses sr
      JOIN users u ON u.id = sr.user_id
      WHERE LOWER(u.email) <> ALL(${adminEmails}::text[])
    `,
    sql`
      SELECT COUNT(*)::int AS count
      FROM survey_responses sr
      JOIN users u ON u.id = sr.user_id
      WHERE sr.created_at >= NOW() - (${rangeInterval})::interval
        AND LOWER(u.email) <> ALL(${adminEmails}::text[])
    `,
    // Panel 6: Income Now usage. Both proxies (output present, OR step
    // marked done) because users can mark income done without leaving
    // output text in some flow combinations.
    sql`
      SELECT
        COUNT(*) FILTER (WHERE (profile_state->'outputs'->>'income') IS NOT NULL
                           AND (profile_state->'outputs'->>'income') <> '')::int AS users_with_income_output,
        COUNT(*) FILTER (WHERE (profile_state->'done') ? 'income')::int          AS users_with_income_done
      FROM users
      WHERE LOWER(email) <> ALL(${adminEmails}::text[])
    `,
    // Panel 1b: per-playbook drill-in. CROSS JOIN LATERAL unrolls each user's
    // savedPlaybooks array into one row per playbook. sections_built is
    // door1 = length of the `done` array; door2 = count of non-empty section
    // entries, handling both the {content,builtAt} object shape and the plain-
    // string p6 shape (post-PR #154 reshape) via the second OR clause. The
    // range filter keeps playbooks created in the window even for users created
    // outside it. LIMIT 500 is conservative; bump if volume needs it.
    sql`
      SELECT
        u.email,
        pb.value->>'title' AS title,
        pb.value->>'lane' AS lane,
        pb.value->>'source' AS source,
        (pb.value->>'schemaVersion')::int AS schema_version,
        pb.value->>'createdAt' AS created_at,
        pb.value->>'updatedAt' AS updated_at,
        CASE
          WHEN pb.value->>'source' = 'door1' THEN COALESCE(jsonb_array_length(pb.value->'done'), 0)
          WHEN pb.value->>'source' = 'door2' THEN (
            SELECT COUNT(*)::int FROM jsonb_each(COALESCE(pb.value->'sections', '{}'::jsonb)) AS s
            WHERE (s.value->>'content' IS NOT NULL AND s.value->>'content' <> '')
               OR (jsonb_typeof(s.value) = 'string' AND s.value::text <> '""')
          )
          ELSE 0
        END AS sections_built
      FROM users u
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(u.profile_state->'savedPlaybooks', '[]'::jsonb)) AS pb
      WHERE LOWER(u.email) <> ALL(${adminEmails}::text[])
        AND (u.created_at >= NOW() - (${rangeInterval})::interval OR (pb.value->>'createdAt')::timestamptz >= NOW() - (${rangeInterval})::interval)
      ORDER BY (pb.value->>'createdAt') DESC NULLS LAST
      LIMIT 500
    `,
  ])

  // Database connectivity check is implicit; if we got here, every query
  // above succeeded. Surface that as `db_ok: true` on the system-health
  // panel rather than a separate SELECT 1 round trip.

  const top = topLine[0] || {}
  const ml = magicLinkStats[0] || { issued: 0, used: 0 }
  const np = npsBuckets[0] || { promoters: 0, passives: 0, detractors: 0, total: 0 }
  const inc = incomeUsage[0] || { users_with_income_output: 0, users_with_income_done: 0 }

  // Reshape the funnel rows: { step -> { entered, generated, completed } }
  const funnelByStep = {}
  for (const sid of FUNNEL_STEP_IDS) funnelByStep[sid] = { entered: 0, generated: 0, completed: 0 }
  for (const row of funnelRows) {
    if (!funnelByStep[row.step]) continue
    if (row.event_name === 'step_entered')       funnelByStep[row.step].entered   = row.sessions
    if (row.event_name === 'generation_started') funnelByStep[row.step].generated = row.sessions
    if (row.event_name === 'section_completed')  funnelByStep[row.step].completed = row.sessions
  }
  const funnel = FUNNEL_STEP_IDS.map(sid => ({
    step:      sid,
    entered:   funnelByStep[sid].entered,
    generated: funnelByStep[sid].generated,
    completed: funnelByStep[sid].completed,
    drop_off_rate: funnelByStep[sid].entered > 0
      ? Number((1 - funnelByStep[sid].completed / funnelByStep[sid].entered).toFixed(3))
      : null,
  }))

  // Inferred regenerations per step (started - completed, floored at 0).
  const regenerations = regenRows.map(r => ({
    step: r.step,
    started: r.started,
    completed: r.completed,
    inferred_regenerations: Math.max(0, r.started - r.completed),
  }))

  const npsScore = np.total > 0
    ? Math.round(((np.promoters / np.total) * 100) - ((np.detractors / np.total) * 100))
    : null

  return {
    range_interval: rangeInterval,
    panel_1_top_line: {
      total_users:                  top.total_users          || 0,
      users_in_range:               top.users_in_range       || 0,
      focus_complete_users:         top.focus_complete_users || 0,
      op_started_users:             top.op_started_users     || 0,
      focus_playbooks_built:        top.focus_playbooks_built || 0,
      op_playbooks_built:           top.op_playbooks_built    || 0,
      sessions_in_range:            (sessionsInRange[0] && sessionsInRange[0].session_count) || 0,
      active_users_in_range:        (activeUsers[0]      && activeUsers[0].active_users)     || 0,
      magic_links_issued_in_range:  ml.issued || 0,
      magic_links_used_in_range:    ml.used   || 0,
      magic_link_conversion_rate:   (ml.issued > 0) ? Number((ml.used / ml.issued).toFixed(3)) : null,
    },
    panel_1b_playbook_drill_in: drillInRows.map(r => ({
      email:          r.email,
      title:          r.title,
      lane:           r.lane,
      source:         r.source,
      schema_version: r.schema_version,
      created_at:     r.created_at,
      updated_at:     r.updated_at,
      sections_built: r.sections_built,
    })),
    panel_2_funnel: funnel,
    panel_3_nps: {
      trend:        npsTrend,
      distribution: npsDist,
      by_role:      npsByRole,
      open_text:    npsOpenText,
      summary: {
        promoters:  np.promoters || 0,
        passives:   np.passives  || 0,
        detractors: np.detractors|| 0,
        total:      np.total     || 0,
        score:      npsScore,
      },
    },
    panel_4_quality_signals: {
      inferred_regenerations: regenerations,
      bridge_picks:           bridgeRows,
    },
    panel_5_system_health: {
      db_ok:                        true,
      last_survey_response_at:      (surveyHeartbeat[0] && surveyHeartbeat[0].last_survey_at) || null,
      survey_responses_in_range:    (surveyInRange[0]   && surveyInRange[0].count)            || 0,
    },
    panel_6_income_usage: {
      users_with_income_output: inc.users_with_income_output || 0,
      users_with_income_done:   inc.users_with_income_done   || 0,
    },
  }
}

async function loadDetail(userId) {
  const [userRow, sessionInfo, surveyRows] = await Promise.all([
    sql`
      SELECT id, email, first_name, last_name, created_at, last_login_at,
             privacy_version, terms_version, profile_state
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `,
    sql`
      SELECT
        COUNT(*)::int AS session_count,
        MAX(last_used_at) AS last_used_at
      FROM sessions
      WHERE user_id = ${userId}
    `,
    sql`
      SELECT id, nps_score, most_valuable, confidence, accuracy, chosen_role,
             open_text, created_at
      FROM survey_responses
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `,
  ])

  if (userRow.length === 0) return null
  const u = userRow[0]
  const ps = (u.profile_state && typeof u.profile_state === 'object') ? u.profile_state : {}

  // Derived signals from profile_state (the JSONB blob the client autosaves).
  // savedPlaybooks is intentionally absent from the autosave payload, so the
  // drill-in does not list per-playbook records. The outputs key set below
  // is the closest available signal of what the user has generated.
  const profileObj = (ps.profile && typeof ps.profile === 'object') ? ps.profile : {}
  const outputsObj = (ps.outputs && typeof ps.outputs === 'object') ? ps.outputs : {}
  const doneArr   = Array.isArray(ps.done) ? ps.done : []
  const populatedProfileFields = Object.entries(profileObj).filter(([, v]) => {
    if (v == null) return false
    if (typeof v === 'string') return v.trim().length > 0
    if (Array.isArray(v)) return v.length > 0
    if (typeof v === 'object') return Object.keys(v).length > 0
    return true
  }).map(([k]) => k)
  const outputsKeysWithContent = Object.entries(outputsObj).filter(([, v]) => {
    if (v == null) return false
    if (typeof v === 'string') return v.trim().length > 0
    if (typeof v === 'object') return Object.keys(v).length > 0
    return true
  }).map(([k]) => k)
  const focusComplete = FOCUS_STEP_IDS.every(sid => doneArr.includes(sid))

  return {
    user: {
      id:                u.id,
      email:             u.email,
      first_name:        u.first_name,
      last_name:         u.last_name,
      created_at:        u.created_at,
      last_login_at:     u.last_login_at,
      privacy_version:   u.privacy_version,
      terms_version:     u.terms_version,
    },
    sessions: {
      total:        (sessionInfo[0] && sessionInfo[0].session_count) || 0,
      last_used_at: (sessionInfo[0] && sessionInfo[0].last_used_at)  || null,
    },
    profile_signals: {
      step:                       ps.step || null,
      selected_lane:              ps.selectedLane || null,
      chosen:                     ps.chosen || null,
      populated_profile_fields:   populatedProfileFields,
      profile_completeness_count: populatedProfileFields.length,
      outputs_keys_with_content:  outputsKeysWithContent,
      done_steps:                 doneArr,
      focus_playbook_complete:    focusComplete,
      explored_role_titles_count: Array.isArray(ps.exploredRoleTitles) ? ps.exploredRoleTitles.length : 0,
    },
    nps_history: surveyRows,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const expected = process.env.ADMIN_TOKEN
  if (!expected) {
    console.error('admin/analytics: ADMIN_TOKEN not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  const auth = req.headers.authorization || ''
  if (auth !== `Bearer ${expected}`) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const range = req.query && typeof req.query.range === 'string' ? req.query.range : '7d'
  const rangeInterval = rangeToInterval(range)

  const detail = req.query && typeof req.query.detail === 'string' ? req.query.detail : null
  if (detail) {
    if (!UUID_RE.test(detail)) {
      return res.status(400).json({ error: 'detail must be a user UUID' })
    }
    try {
      const payload = await loadDetail(detail)
      if (!payload) return res.status(404).json({ error: 'User not found' })
      return res.status(200).json({ ok: true, range, detail_user_id: detail, payload })
    } catch (err) {
      console.error('admin/analytics: detail query failed', err && err.message)
      return res.status(500).json({ error: 'Query failed' })
    }
  }

  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS)

  try {
    const payload = await loadAggregate(rangeInterval, adminEmails)
    return res.status(200).json({ ok: true, range, ...payload })
  } catch (err) {
    console.error('admin/analytics: aggregate query failed', err && err.message)
    return res.status(500).json({ error: 'Query failed' })
  }
}
