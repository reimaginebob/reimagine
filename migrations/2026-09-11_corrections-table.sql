-- Replaces the "Reimagine Corrections Log" Google Sheet as the durable record
-- of user corrections. The Sheet depended on a client -> Apps Script POST that
-- went silently dead around 2026-08-20 (deployment/URL drift -- see CLAUDE.md
-- §8 "Apps Script redeploy"); the corrections themselves were never lost, since
-- recordCorrection() also writes them into profile_state.profile.corrections,
-- which syncs to Postgres on every autosave like the rest of the profile.
--
-- This table gives that data a queryable home and stops depending on any
-- external hop. Going forward, api/profile/save.js upserts every correction
-- present in the incoming profile.corrections array on every save (id is the
-- client-generated natural key, ON CONFLICT DO NOTHING), so capture is a
-- byproduct of the same autosave path already proven reliable -- no new
-- client wiring, no fire-and-forget POST to maintain.
--
-- Columns follow the shape already spec'd in
-- docs/architecture/v2-corrections-schema.md for the eventual V2 migration,
-- with two adjustments made now that accounts (and req.user.id) exist:
-- user_id is a real FK for querying by current account, and captured_at
-- records when a row was written here (vs. created_at, which is the
-- client-stamped moment of the correction itself, preserved from backfill).
-- original_inference and field_type stay NULL for now, exactly as the V2
-- spec anticipated for Sheet-era rows -- unchanged in shape, just built early.
--
-- Forward-only, idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS corrections (
  id                    text        PRIMARY KEY,   -- client-generated, e.g. corr_1715000000000_abc12
  user_id               uuid        REFERENCES users(id) ON DELETE CASCADE,
  user_email            text,                       -- snapshot at correction time
  user_name             text,                       -- snapshot at correction time
  step                  text        NOT NULL,
  step_display_name     text,
  section_output_length integer,
  correction_text       text        NOT NULL,
  original_inference    text,                       -- NULL until a capture path fills it in
  field_type            text,                       -- NULL until a classifier backfill runs
  app_version           text,
  browser               text,
  created_at            timestamptz,                -- client-stamped correction time
  captured_at           timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS corrections_step_created_idx ON corrections (step, created_at DESC);
CREATE INDEX IF NOT EXISTS corrections_user_created_idx ON corrections (user_id, created_at DESC);

-- One-time backfill from profile_state.profile.corrections for every account.
-- The feature has only existed since 2026-05-10, so this recovers the full
-- history, not just the last 90 days. Idempotent (ON CONFLICT DO NOTHING) and
-- guarded against malformed entries (missing id, missing/unparseable
-- created_at) rather than failing the whole deploy.
INSERT INTO corrections (
  id, user_id, user_email, user_name, step, step_display_name,
  section_output_length, correction_text, app_version, browser, created_at
)
SELECT
  elem->>'id',
  u.id,
  u.email,
  NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), ''),
  elem->>'step',
  elem->>'stepDisplayName',
  NULLIF(elem->>'sectionOutputLength', '')::integer,
  COALESCE(elem->>'text', elem->>'correctionText', ''),
  elem->>'appVersion',
  elem->>'browser',
  CASE WHEN elem->>'created_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN (elem->>'created_at')::timestamptz END
FROM users u
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(u.profile_state->'profile'->'corrections') = 'array'
       THEN u.profile_state->'profile'->'corrections' ELSE '[]'::jsonb END) elem
WHERE elem->>'id' IS NOT NULL
ON CONFLICT (id) DO NOTHING;
