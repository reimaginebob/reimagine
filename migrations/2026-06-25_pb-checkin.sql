-- Personal Brand coach check-in. Backs the one-tap check-in My Coach shows the
-- first time a user reaches "Put it to Work" (twoDoors): "does your Personal
-- Brand capture who you are?" with a Yes / Mostly / Not quite tap. The tap is the
-- measurable signal; it flows through the ingest cron into feedback_event,
-- hardcoded to surface='personal-brand' and marked solicited.
--
-- Apply to production Neon BEFORE deploying the check-in write endpoint / ingest.
--
-- Two changes:
-- 1) feedback_event.solicited — distinguishes feedback we ASKED for (this
--    check-in) from spontaneous feedback (the existing channels). DEFAULT false
--    backfills every existing row as spontaneous; the check-in ingest sets true.
-- 2) coach_checkin_responses — the source table for taps. UNIQUE (user_id,
--    checkin_key) enforces once-per-user at the DB layer (the client also dedupes
--    via the seenPbCheckin flag); the write endpoint inserts ON CONFLICT DO
--    NOTHING so the first tap is the recorded signal.

ALTER TABLE feedback_event ADD COLUMN IF NOT EXISTS solicited BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE coach_checkin_responses (
  id          SERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  email       TEXT,
  checkin_key TEXT NOT NULL,
  answer      TEXT NOT NULL CHECK (answer IN ('yes', 'mostly', 'not_quite')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, checkin_key)
);

CREATE INDEX coach_checkin_responses_created_at_idx ON coach_checkin_responses(created_at DESC);

-- Smoke check after apply:
--   SELECT column_name, data_type FROM information_schema.columns
--     WHERE table_name='coach_checkin_responses' ORDER BY ordinal_position;
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='feedback_event' AND column_name='solicited';
