// Every Reimagine account with the stage it has reached. One endpoint, two
// consumers:
//
//   1. Segment checks — given a list of addresses (Corner registrants, or any
//      other list), which of them have Reimagine accounts and where did they
//      get to. Match on email against what this returns.
//   2. The stage-to-Resend sync — pushes `stage` onto each contact as a
//      property so Resend can segment on it.
//
// Built to serve both rather than twice, per Cowork's call on 2026-08-22.
//
// Auth: Bearer ADMIN_TOKEN. Method: GET only.
//
// PRIVACY: email and stage only. No name, no profile content, no generated
// output, nothing from a coach conversation. This endpoint exists to answer
// "who is where", and it should never grow past that — if a caller needs
// profile content, that is a different endpoint with a different name.

import { sql } from '../_lib/db.js'
import { checkAdminAuth, adminTokenMissing } from '../_lib/admin-auth.js'

// A day-count, not a stage. Someone can be both "opportunity" and recently
// active, and a campaign wants to segment on the first while suppressing on
// the second — so they are separate fields rather than one collapsed value.
const ACTIVE_DAYS = 14

// Single stage per account, most advanced first. `both_doors` and
// `focus_complete` are not in the original ask but exist in the data; giving
// them their own values is better than folding them into a neighbour and
// quietly mislabelling the most engaged accounts.
const STAGE_ORDER = [
  'focus_complete',
  'both_doors',
  'career_paths',
  'opportunity',
  'personal_brand_no_door',
  'gave_inputs_no_output',
  'signed_up_only',
]

function parseAdminEmails(envValue) {
  if (typeof envValue !== 'string') return []
  return envValue.split(',').map(e => e.trim().toLowerCase()).filter(e => e.length > 0)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (adminTokenMissing()) {
    console.error('admin/user-stages: ADMIN_TOKEN not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  // Read-only, so an analyst token is enough. This is the endpoint the
  // lifecycle-email work runs on.
  const level = checkAdminAuth(req, { allowAnalyst: true })
  if (!level) return res.status(403).json({ error: 'Forbidden' })

  // Internal accounts are excluded by default so a caller does not have to
  // remember to. ?include_internal=1 brings them back for reconciliation work.
  const includeInternal = req.query && req.query.include_internal === '1'
  const adminEmails = includeInternal ? [] : parseAdminEmails(process.env.ADMIN_EMAILS)

  try {
    const rows = await sql`
      WITH acts AS (
        SELECT user_id, MAX(at) AS last_at FROM (
          SELECT user_id, created_at AS at FROM sessions
          UNION ALL SELECT user_id, last_used_at FROM sessions
          UNION ALL SELECT user_id, created_at FROM generation_events WHERE user_id IS NOT NULL
          UNION ALL SELECT user_id, created_at FROM chat_messages WHERE user_id IS NOT NULL
        ) a GROUP BY user_id
      ),
      flags AS (
        SELECT
          u.email,
          a.last_at,
          (
            NULLIF(TRIM(u.profile_state->'profile'->>'resume'), '')     IS NOT NULL OR
            NULLIF(TRIM(u.profile_state->'profile'->>'linkedin'), '')   IS NOT NULL OR
            NULLIF(TRIM(u.profile_state->'profile'->>'assess'), '')     IS NOT NULL OR
            NULLIF(TRIM(u.profile_state->'profile'->>'values'), '')     IS NOT NULL OR
            NULLIF(TRIM(u.profile_state->'profile'->>'passions'), '')   IS NOT NULL OR
            NULLIF(TRIM(u.profile_state->'profile'->>'lifeEvents'), '') IS NOT NULL
          ) AS gave_inputs,
          NULLIF(TRIM(u.profile_state->'outputs'->>'p3'), '') IS NOT NULL AS personal_brand,
          ((u.profile_state->'done') ? 'op'
            OR NULLIF(TRIM(u.profile_state->'outputs'->>'op'), '') IS NOT NULL
            OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(u.profile_state->'savedPlaybooks', '[]'::jsonb)) pb
                        WHERE pb->>'source' = 'door2')) AS opportunity,
          ((u.profile_state->'done') ? 'laneSelect'
            OR NULLIF(TRIM(u.profile_state->'outputs'->>'p4'), '') IS NOT NULL
            OR NULLIF(TRIM(u.profile_state->'outputs'->>'p5'), '') IS NOT NULL
            OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(u.profile_state->'savedPlaybooks', '[]'::jsonb)) pb
                        WHERE pb->>'source' = 'door1')) AS career_paths,
          (u.profile_state->'done' ?& ARRAY['p5','p6','p7','p8','p9','p11','p_res']) AS focus_complete,
          (u.suspended_at IS NOT NULL) AS suspended
        FROM users u
        LEFT JOIN acts a ON a.user_id = u.id
        WHERE LOWER(u.email) <> ALL(${adminEmails}::text[])
      )
      SELECT
        email,
        last_at,
        CASE
          WHEN focus_complete                     THEN 'focus_complete'
          WHEN opportunity AND career_paths       THEN 'both_doors'
          WHEN career_paths                       THEN 'career_paths'
          WHEN opportunity                        THEN 'opportunity'
          WHEN personal_brand                     THEN 'personal_brand_no_door'
          WHEN gave_inputs                        THEN 'gave_inputs_no_output'
          ELSE 'signed_up_only'
        END AS stage,
        (last_at IS NOT NULL AND last_at >= NOW() - ${`${ACTIVE_DAYS} days`}::interval) AS active,
        suspended
      FROM flags
      ORDER BY email`

    const now = Date.now()
    const users = rows.map((r) => {
      const last = r.last_at ? new Date(r.last_at).getTime() : null
      return {
        email: r.email,
        stage: r.stage,
        active: !!r.active,
        last_activity: r.last_at || null,
        days_since_activity: last ? Math.floor((now - last) / 86400000) : null,
        // A paused account must never receive a nudge to come back and use a
        // product it is currently blocked from. Surfaced rather than filtered
        // out so a caller reconciling lists still sees the account exists.
        suspended: !!r.suspended,
      }
    })

    const counts = {}
    for (const s of STAGE_ORDER) counts[s] = 0
    for (const u of users) counts[u.stage] = (counts[u.stage] || 0) + 1

    return res.status(200).json({
      ok: true,
      auth: level,
      as_of: new Date().toISOString(),
      active_window_days: ACTIVE_DAYS,
      stage_order: STAGE_ORDER,
      total: users.length,
      counts,
      active_count: users.filter(u => u.active).length,
      suspended_count: users.filter(u => u.suspended).length,
      users,
    })
  } catch (err) {
    console.error('admin/user-stages: query failed', err && err.message)
    return res.status(500).json({ error: 'Query failed' })
  }
}
