-- Receives every Vercel Web Analytics event for the Reimagine project via the
-- Data Drain configured at Project -> Settings -> Data Drains in the Vercel
-- dashboard. The drain endpoint at api/admin/analytics-drain.js parses and
-- inserts; the read endpoint at api/admin/analytics.js queries this table
-- alongside the existing user / session / survey tables to power the
-- Reimagine Daily Cowork artifact.
--
-- Apply to the production Neon database BEFORE deploying the PR that adds
-- api/admin/analytics-drain.js, or the first drain delivery will fail and
-- Vercel will mark the drain unhealthy.
-- Verify with: \d analytics_events
--
-- Notes on schema choices:
-- * id is BIGSERIAL because Vercel sends thousands of events per day at any
--   non-trivial volume; SERIAL (INTEGER) would exhaust within a year of
--   meaningful traffic.
-- * "timestamp" is BIGINT (epoch ms from Vercel's payload), distinct from
--   received_at which is when our endpoint persisted the row. The column is
--   double-quoted in queries because `timestamp` is a reserved word.
-- * session_id and device_id are BIGINT per the schema vercel.analytics.v2
--   sample (both are numeric in the documented payload).
-- * event_data is JSONB so we can query into custom event payloads
--   (e.g., event_data->>'step' for step_entered counts) without parsing.
-- * No FK to users -- the events are anonymous and user attribution is
--   best-effort via session / device joins where applicable.

CREATE TABLE analytics_events (
  id              BIGSERIAL PRIMARY KEY,
  schema          TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  event_name      TEXT,
  event_data      JSONB,
  "timestamp"     BIGINT NOT NULL,
  project_id      TEXT,
  owner_id        TEXT,
  session_id      BIGINT,
  device_id       BIGINT,
  origin          TEXT,
  path            TEXT,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX analytics_events_timestamp_idx ON analytics_events("timestamp" DESC);
CREATE INDEX analytics_events_event_name_idx ON analytics_events(event_name);
CREATE INDEX analytics_events_session_id_idx ON analytics_events(session_id);
CREATE INDEX analytics_events_path_idx ON analytics_events(path);

-- Smoke check after apply:
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--     WHERE table_name = 'analytics_events' ORDER BY ordinal_position;
--   Expect 13 columns matching the CREATE TABLE above.
