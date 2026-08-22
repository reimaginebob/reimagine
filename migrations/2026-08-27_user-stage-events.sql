-- When each account first reached each stage of the journey.
--
-- The Growth tab computes stage membership live, from current state. That
-- answers "who is stuck today" and cannot answer "who moved, and when" — which
-- is the question any lifecycle campaign has to be judged on. Without a record
-- of movement there is no baseline, and without a baseline the first campaign's
-- numbers mean nothing.
--
-- Stages here are MILESTONES, not a membership snapshot. Nobody un-generates a
-- Personal Brand or un-builds a playbook, so the journey is forward-only and one
-- row per (user, stage) is the whole model. That is why the table carries a
-- UNIQUE constraint rather than a weekly snapshot of everybody: it is smaller,
-- it cannot double-count, and re-running the job is a no-op.
--
-- entered_at is nullable on purpose. Three sources, and the difference matters:
--
--   'derived'  a real timestamp recovered from data that was already dated —
--              savedPlaybooks carry createdAt, generation_events carry
--              created_at. These are accurate.
--   'undated'  the account has reached the stage but nothing recorded when.
--              entered_at is NULL. Counting these in a weekly movement chart
--              would invent a spike on the day this shipped, so the dashboard
--              excludes them from movement and reports the count separately.
--   'observed' the crossing was seen by the periodic job. Accurate to when the
--              job ran, which is close enough at a weekly cadence.
--
-- Backfill below is idempotent (ON CONFLICT DO NOTHING) and can be re-run.
--
-- Forward-only. The writer (api/admin/stage-snapshot.js) swallows its errors, so
-- this can apply before or after the code deploys.
--
-- Verify with:
--   SELECT stage, source, COUNT(*) FROM user_stage_events GROUP BY 1,2 ORDER BY 1,2;

CREATE TABLE IF NOT EXISTS user_stage_events (
  id          bigserial   PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage       text        NOT NULL,
  entered_at  timestamptz,
  source      text        NOT NULL DEFAULT 'observed',
  recorded_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, stage)
);

CREATE INDEX IF NOT EXISTS user_stage_events_stage_idx   ON user_stage_events (stage, entered_at);
CREATE INDEX IF NOT EXISTS user_stage_events_entered_idx ON user_stage_events (entered_at);

-- ---------------------------------------------------------------------------
-- Backfill 1: signed_up. Always dated — it is the users row itself.
-- ---------------------------------------------------------------------------
INSERT INTO user_stage_events (user_id, stage, entered_at, source)
SELECT id, 'signed_up', created_at, 'derived' FROM users
ON CONFLICT (user_id, stage) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Backfill 2: personal_brand, from the generation log where possible.
-- generation_events only starts 2026-08-15, so anyone who generated their
-- Personal Brand before that lands in the 'undated' pass below.
-- ---------------------------------------------------------------------------
INSERT INTO user_stage_events (user_id, stage, entered_at, source)
SELECT g.user_id, 'personal_brand', MIN(g.created_at), 'derived'
FROM generation_events g
WHERE g.user_id IS NOT NULL AND g.kind = 'p3'
GROUP BY g.user_id
ON CONFLICT (user_id, stage) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Backfill 3: the two doors, from savedPlaybooks. These carry a per-playbook
-- createdAt and reach back further than the generation log, to whenever the
-- account last saved state server-side.
-- ---------------------------------------------------------------------------
INSERT INTO user_stage_events (user_id, stage, entered_at, source)
SELECT u.id, 'opportunity', MIN(NULLIF(pb->>'createdAt', '')::timestamptz), 'derived'
FROM users u
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(u.profile_state->'savedPlaybooks', '[]'::jsonb)) pb
WHERE pb->>'source' = 'door2' AND NULLIF(pb->>'createdAt', '') IS NOT NULL
GROUP BY u.id
ON CONFLICT (user_id, stage) DO NOTHING;

INSERT INTO user_stage_events (user_id, stage, entered_at, source)
SELECT u.id, 'career_paths', MIN(NULLIF(pb->>'createdAt', '')::timestamptz), 'derived'
FROM users u
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(u.profile_state->'savedPlaybooks', '[]'::jsonb)) pb
WHERE pb->>'source' = 'door1' AND NULLIF(pb->>'createdAt', '') IS NOT NULL
GROUP BY u.id
ON CONFLICT (user_id, stage) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Backfill 4: the undated pass. Everyone whose current state says they reached
-- a stage but for whom nothing above supplied a date. entered_at stays NULL so
-- these never appear as movement on a date they did not happen.
-- ---------------------------------------------------------------------------
INSERT INTO user_stage_events (user_id, stage, entered_at, source)
SELECT id, 'gave_inputs', NULL, 'undated' FROM users
WHERE NULLIF(TRIM(profile_state->'profile'->>'resume'), '')     IS NOT NULL
   OR NULLIF(TRIM(profile_state->'profile'->>'linkedin'), '')   IS NOT NULL
   OR NULLIF(TRIM(profile_state->'profile'->>'assess'), '')     IS NOT NULL
   OR NULLIF(TRIM(profile_state->'profile'->>'values'), '')     IS NOT NULL
   OR NULLIF(TRIM(profile_state->'profile'->>'passions'), '')   IS NOT NULL
   OR NULLIF(TRIM(profile_state->'profile'->>'lifeEvents'), '') IS NOT NULL
ON CONFLICT (user_id, stage) DO NOTHING;

INSERT INTO user_stage_events (user_id, stage, entered_at, source)
SELECT id, 'personal_brand', NULL, 'undated' FROM users
WHERE NULLIF(TRIM(profile_state->'outputs'->>'p3'), '') IS NOT NULL
ON CONFLICT (user_id, stage) DO NOTHING;

INSERT INTO user_stage_events (user_id, stage, entered_at, source)
SELECT id, 'opportunity', NULL, 'undated' FROM users
WHERE (profile_state->'done') ? 'op'
   OR NULLIF(TRIM(profile_state->'outputs'->>'op'), '') IS NOT NULL
ON CONFLICT (user_id, stage) DO NOTHING;

INSERT INTO user_stage_events (user_id, stage, entered_at, source)
SELECT id, 'career_paths', NULL, 'undated' FROM users
WHERE (profile_state->'done') ? 'laneSelect'
   OR NULLIF(TRIM(profile_state->'outputs'->>'p4'), '') IS NOT NULL
   OR NULLIF(TRIM(profile_state->'outputs'->>'p5'), '') IS NOT NULL
ON CONFLICT (user_id, stage) DO NOTHING;

INSERT INTO user_stage_events (user_id, stage, entered_at, source)
SELECT id, 'focus_complete', NULL, 'undated' FROM users
WHERE profile_state->'done' ?& ARRAY['p5','p6','p7','p8','p9','p11','p_res']
ON CONFLICT (user_id, stage) DO NOTHING;
