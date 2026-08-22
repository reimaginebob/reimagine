// Records newly-reached stage milestones into user_stage_events.
//
// Runs on a cron (daily, 06:00 UTC — see vercel.json). Every run compares each
// account's current state against what the log already holds and appends only
// what is new. The UNIQUE (user_id, stage) constraint makes it idempotent, so
// running it twice, or by hand, cannot double-count.
//
// Why a job rather than writing at the moment of the crossing: stage is derived
// from profile_state, which is replaced wholesale by an 800ms-debounced autosave
// (api/profile/save.js). There is no single place in the app where "the user
// just crossed into personal_brand" is knowable without re-deriving it, and
// scattering that derivation through the UI would put four copies of the
// definition in four files. One job, one definition, once a day.
//
// The cost of that choice is precision: a crossing is dated to when the job ran,
// not to the minute it happened, and rows written this way are marked
// source = 'observed' so the difference is visible. At a daily cadence, against
// a question measured in weeks, that is close enough.
//
// Auth: CRON_SECRET as a Bearer token (Vercel cron sends it), or ADMIN_TOKEN so
// it can be triggered by hand. Mirrors the pattern in the other cron endpoints.

import { sql } from '../_lib/db.js'

const FOCUS_STEP_IDS = ['p5', 'p6', 'p7', 'p8', 'p9', 'p11', 'p_res']

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  const adminToken = process.env.ADMIN_TOKEN
  const auth = req.headers.authorization || ''
  const ok = (cronSecret && auth === `Bearer ${cronSecret}`) ||
             (adminToken && auth === `Bearer ${adminToken}`)
  if (!ok) return res.status(403).json({ error: 'Forbidden' })

  try {
    // One statement per stage. Each inserts the accounts that currently qualify
    // and are not already in the log; ON CONFLICT drops the rest. NOW() is the
    // entered_at because this is the first run that saw them qualify.
    const inserted = {}

    const run = async (stage, rows) => { inserted[stage] = rows.length }

    run('signed_up', await sql`
      INSERT INTO user_stage_events (user_id, stage, entered_at, source)
      SELECT id, 'signed_up', created_at, 'derived' FROM users
      ON CONFLICT (user_id, stage) DO NOTHING
      RETURNING id`)

    run('gave_inputs', await sql`
      INSERT INTO user_stage_events (user_id, stage, entered_at, source)
      SELECT id, 'gave_inputs', NOW(), 'observed' FROM users
      WHERE NULLIF(TRIM(profile_state->'profile'->>'resume'), '')     IS NOT NULL
         OR NULLIF(TRIM(profile_state->'profile'->>'linkedin'), '')   IS NOT NULL
         OR NULLIF(TRIM(profile_state->'profile'->>'assess'), '')     IS NOT NULL
         OR NULLIF(TRIM(profile_state->'profile'->>'values'), '')     IS NOT NULL
         OR NULLIF(TRIM(profile_state->'profile'->>'passions'), '')   IS NOT NULL
         OR NULLIF(TRIM(profile_state->'profile'->>'lifeEvents'), '') IS NOT NULL
      ON CONFLICT (user_id, stage) DO NOTHING
      RETURNING id`)

    // Personal Brand prefers the generation log's real timestamp when there is
    // one; the fallback to NOW() only applies to an account that generated it
    // between two runs without a matching event row.
    run('personal_brand', await sql`
      INSERT INTO user_stage_events (user_id, stage, entered_at, source)
      SELECT u.id, 'personal_brand',
             COALESCE((SELECT MIN(g.created_at) FROM generation_events g
                        WHERE g.user_id = u.id AND g.kind = 'p3'), NOW()),
             CASE WHEN EXISTS (SELECT 1 FROM generation_events g
                                WHERE g.user_id = u.id AND g.kind = 'p3')
                  THEN 'derived' ELSE 'observed' END
      FROM users u
      WHERE NULLIF(TRIM(u.profile_state->'outputs'->>'p3'), '') IS NOT NULL
      ON CONFLICT (user_id, stage) DO NOTHING
      RETURNING id`)

    run('opportunity', await sql`
      INSERT INTO user_stage_events (user_id, stage, entered_at, source)
      SELECT u.id, 'opportunity',
             COALESCE((SELECT MIN(NULLIF(pb->>'createdAt', '')::timestamptz)
                         FROM jsonb_array_elements(COALESCE(u.profile_state->'savedPlaybooks', '[]'::jsonb)) pb
                        WHERE pb->>'source' = 'door2'), NOW()),
             'observed'
      FROM users u
      WHERE (u.profile_state->'done') ? 'op'
         OR NULLIF(TRIM(u.profile_state->'outputs'->>'op'), '') IS NOT NULL
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(u.profile_state->'savedPlaybooks', '[]'::jsonb)) pb
                     WHERE pb->>'source' = 'door2')
      ON CONFLICT (user_id, stage) DO NOTHING
      RETURNING id`)

    run('career_paths', await sql`
      INSERT INTO user_stage_events (user_id, stage, entered_at, source)
      SELECT u.id, 'career_paths',
             COALESCE((SELECT MIN(NULLIF(pb->>'createdAt', '')::timestamptz)
                         FROM jsonb_array_elements(COALESCE(u.profile_state->'savedPlaybooks', '[]'::jsonb)) pb
                        WHERE pb->>'source' = 'door1'), NOW()),
             'observed'
      FROM users u
      WHERE (u.profile_state->'done') ? 'laneSelect'
         OR NULLIF(TRIM(u.profile_state->'outputs'->>'p4'), '') IS NOT NULL
         OR NULLIF(TRIM(u.profile_state->'outputs'->>'p5'), '') IS NOT NULL
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(u.profile_state->'savedPlaybooks', '[]'::jsonb)) pb
                     WHERE pb->>'source' = 'door1')
      ON CONFLICT (user_id, stage) DO NOTHING
      RETURNING id`)

    run('focus_complete', await sql`
      INSERT INTO user_stage_events (user_id, stage, entered_at, source)
      SELECT id, 'focus_complete', NOW(), 'observed' FROM users
      WHERE profile_state->'done' ?& ${FOCUS_STEP_IDS}::text[]
      ON CONFLICT (user_id, stage) DO NOTHING
      RETURNING id`)

    const total = Object.values(inserted).reduce((a, b) => a + b, 0)
    console.log('admin/stage-snapshot', { total, ...inserted })
    return res.status(200).json({ ok: true, inserted, total })
  } catch (err) {
    console.error('admin/stage-snapshot: failed', err && err.message)
    return res.status(500).json({ error: 'Snapshot failed' })
  }
}
