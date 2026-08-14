-- Generation events log (rogue-activity watchdog, Phase 2). One row per
-- /api/claude generation, written best-effort from api/claude.js — a failed
-- insert never affects the reply. Powers the hourly activity-watchdog's
-- generation-volume alerts (and, later, optional per-account throttling).
--
-- user_id is best-effort: signed-out early-orientation generations log NULL.
-- kind is the Reimagine step tag (e.g. 'p7' = Go-to-Market), nullable.
--
-- Forward-only, idempotent. NO deploy-order hazard: the app only logs into this
-- table after it exists (the insert is swallowed on failure), and the watchdog's
-- generation section is wrapped to no-op until the table is present. So this can
-- be applied before OR after the code deploys; applying it is what "turns on"
-- the generation counter.
--
-- Retention: high-volume, append-only. Prune periodically (a later nightly job
-- can DELETE rows older than ~30 days); not required for correctness.
--
-- Verify with:
--   SELECT to_regclass('public.generation_events');

CREATE TABLE IF NOT EXISTS generation_events (
  id         bigserial PRIMARY KEY,
  user_id    uuid,
  kind       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS generation_events_created_at_idx  ON generation_events (created_at);
CREATE INDEX IF NOT EXISTS generation_events_user_created_idx ON generation_events (user_id, created_at);
