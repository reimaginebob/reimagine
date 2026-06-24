-- Unified feedback event store. One row per piece of feedback, normalized across
-- the three Neon-backed channels (Share Feedback free text, email NPS survey, and
-- My Coach reply thumbs). Powers the /admin/dashboard feedback views. Populated
-- by the api/admin/ingest-feedback cron, which maps source rows in, classifies
-- text-bearing events (sentiment + concern themes + one-line summary) with a
-- Haiku-class model, and derives sentiment for text-less events from the native
-- metric.
--
-- Apply to production Neon BEFORE deploying the ingest cron / dashboard endpoint.
-- Verify with: \d feedback_event
--
-- Schema notes:
-- * id is TEXT, deterministically `${source}:${source_record}`, so re-ingesting a
--   source row yields the same id (idempotent).
-- * UNIQUE (source, source_record) is the idempotency key: the cron inserts with
--   ON CONFLICT DO NOTHING, so a row is ingested exactly once no matter how often
--   the cron runs or how the backfill overlaps incremental runs.
-- * created_at is the SOURCE event time (mapped from the originating row), not the
--   ingest time. NULL only if a source row somehow lacks a timestamp.
-- * native_type / native_value carry the channel's native metric: 'nps' + score
--   (0-10) for the survey, 'thumb' + ±1 for coach replies, NULL for free text.
-- * themes is TEXT[] of concern-taxonomy codes (see src/feedback-taxonomy.js),
--   plus candidate:<label> when nothing in the taxonomy fits. Empty for text-less
--   events.
-- * status tracks the classification lifecycle: 'pending' (text-bearing, awaiting
--   model classification — retried on the next cron run), 'classified' (model
--   sentiment+themes+summary written), 'native' (text-less, sentiment derived from
--   the native metric, no themes).

CREATE TABLE feedback_event (
  id            TEXT PRIMARY KEY,
  source        TEXT NOT NULL,
  source_record TEXT NOT NULL,
  user_id       TEXT,
  email         TEXT,
  created_at    TIMESTAMPTZ,
  body          TEXT,
  native_type   TEXT,
  native_value  NUMERIC,
  surface       TEXT,
  lane          TEXT,
  output_ref    TEXT,
  commit_sha    TEXT,
  sentiment     TEXT,
  themes        TEXT[],
  summary       TEXT,
  status        TEXT,
  UNIQUE (source, source_record)
);

CREATE INDEX feedback_event_created_at_idx ON feedback_event(created_at DESC);
CREATE INDEX feedback_event_source_idx     ON feedback_event(source);
CREATE INDEX feedback_event_status_idx     ON feedback_event(status);
CREATE INDEX feedback_event_themes_gin      ON feedback_event USING GIN (themes);

-- Smoke check after apply:
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--     WHERE table_name = 'feedback_event' ORDER BY ordinal_position;
--   Expect: id (text,no), source (text,no), source_record (text,no),
--   user_id (text,yes), email (text,yes), created_at (timestamptz,yes),
--   body (text,yes), native_type (text,yes), native_value (numeric,yes),
--   surface (text,yes), lane (text,yes), output_ref (text,yes),
--   commit_sha (text,yes), sentiment (text,yes), themes (ARRAY,yes),
--   summary (text,yes), status (text,yes).
