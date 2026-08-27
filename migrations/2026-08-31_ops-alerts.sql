-- Operator alert de-duplication.
--
-- The budget watchdog and the upstream-failure pager both need to say a thing
-- ONCE. "You have crossed 75% of the month's API budget" is useful the first
-- time and noise every hour after that, and an alert that arrives hourly stops
-- being read, which is the failure mode the watchdog exists to prevent.
--
-- One row per alert that has been sent. The key encodes what the alert was
-- about and the window it belongs to (e.g. 'budget:2026-08:75'), so a new month
-- or a new threshold is a new key and fires again on its own.
--
-- Forward-only and idempotent, per CLAUDE.md section 7.
CREATE TABLE IF NOT EXISTS ops_alerts (
  alert_key TEXT PRIMARY KEY,
  sent_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detail    TEXT
);

-- Only used to age out old keys by hand; the lookups are all by primary key.
CREATE INDEX IF NOT EXISTS ops_alerts_sent_at_idx ON ops_alerts (sent_at);
