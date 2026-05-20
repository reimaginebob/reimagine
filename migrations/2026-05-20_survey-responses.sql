-- Survey-response repository: lands every inline-survey submission from the
-- complete page into Neon so the data is queryable, can be joined to other
-- Reimagine tables, and drives the daily-digest cron at api/survey/daily-
-- digest.js. Replaces the previous Apps-Script-to-Sheet pipeline, which had a
-- silent-error wrapper on the client and no programmatic query path.
--
-- Apply to the production Neon database BEFORE deploying the PR that adds
-- api/survey/submit.js, or the first survey submission will fail.
-- Verify with: \d survey_responses
--
-- Notes on the schema choices:
-- * users.id in production is UUID (originally drafted INTEGER in the brief;
--   corrected to match what is actually in users). The FK type here matches.
-- * user_id is nullable so anonymous or pre-signed-in submissions still
--   capture. ON DELETE SET NULL preserves response history if a user account
--   is later removed.
-- * nps_score is SMALLINT 0-10 with a CHECK constraint at the DB layer, so a
--   broken client cannot silently insert out-of-range scores.
-- * created_at is TIMESTAMPTZ with default NOW(); the daily-digest cron
--   queries on created_at >= NOW() - INTERVAL '24 hours'.
-- * Indexes: created_at DESC for the digest scan; user_id for joins back to
--   users when filtering responses for a specific account.

CREATE TABLE survey_responses (
  id              SERIAL PRIMARY KEY,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  nps_score       SMALLINT NOT NULL CHECK (nps_score BETWEEN 0 AND 10),
  most_valuable   TEXT,
  confidence      TEXT,
  accuracy        TEXT,
  open_text       TEXT,
  chosen_role     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX survey_responses_created_at_idx ON survey_responses(created_at DESC);
CREATE INDEX survey_responses_user_id_idx ON survey_responses(user_id);

-- Smoke check after apply:
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--     WHERE table_name = 'survey_responses' ORDER BY ordinal_position;
--   Expect nine columns: id (integer, no), user_id (uuid, yes),
--   nps_score (smallint, no), most_valuable (text, yes), confidence (text, yes),
--   accuracy (text, yes), open_text (text, yes), chosen_role (text, yes),
--   created_at (timestamp with time zone, no).
