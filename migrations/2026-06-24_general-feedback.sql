-- General-feedback repository: lands every free-text note from the header
-- "Share feedback" panel into Neon. This is the in-app feedback write path that
-- replaced the retired post-session NPS survey. Kept deliberately distinct from
-- survey_responses (the NPS table, read paths + digest preserved) and from
-- output_feedback (the per-output thumbs mechanism).
--
-- Apply to the production Neon database BEFORE deploying the PR that adds
-- api/feedback/submit.js, or the first feedback submission will fail.
-- Verify with: \d general_feedback
--
-- Notes on the schema choices:
-- * user_id is TEXT (not a UUID FK) to keep this table decoupled from the users
--   table; the panel records a note regardless of whether the session resolves.
--   It holds the users.id value (a UUID) as text when signed in, else NULL.
-- * email is captured alongside user_id, both server-side from the session, so a
--   note can be followed up on without a join. NULL for anonymous notes.
-- * body is the only required field (NOT NULL); the panel disables Send until the
--   textarea has non-whitespace content, and the API rejects an empty body.
-- * surface / selected_lane / context_ref / commit_sha are the silently-gathered
--   context (current step, lane, focused role/output, build SHA). All nullable.
-- * created_at is TIMESTAMPTZ with default NOW().

CREATE TABLE general_feedback (
  id              SERIAL PRIMARY KEY,
  user_id         TEXT,
  email           TEXT,
  body            TEXT NOT NULL,
  surface         TEXT,
  selected_lane   TEXT,
  context_ref     TEXT,
  commit_sha      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX general_feedback_created_at_idx ON general_feedback(created_at DESC);
CREATE INDEX general_feedback_user_id_idx ON general_feedback(user_id);

-- Smoke check after apply:
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--     WHERE table_name = 'general_feedback' ORDER BY ordinal_position;
--   Expect nine columns: id (integer, no), user_id (text, yes), email (text, yes),
--   body (text, no), surface (text, yes), selected_lane (text, yes),
--   context_ref (text, yes), commit_sha (text, yes),
--   created_at (timestamp with time zone, no).
