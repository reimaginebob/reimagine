-- Account suspension / pause (rogue-activity safeguard). A reversible hold on an
-- account: when suspended_at is set, the user cannot generate, save, or use the
-- coach — every authed path rejects them and the client shows a hold message.
-- Clearing suspended_at restores them instantly. Data is untouched (a pause, not
-- a delete). Set manually by an admin (api/admin/suspend-user) or automatically
-- by the watchdog / a real-time generation cap (follow-up PR).
--
-- suspended_at:     NULL = active; a timestamp = paused (when).
-- suspended_reason: short internal note ('manual', 'auto: 6 playbooks/hr', ...).
--
-- Forward-only, idempotent. APPLY BEFORE DEPLOYING the code that reads it:
-- getSessionUser selects suspended_at on EVERY authenticated request, so a deploy
-- ahead of the migration would 500 every signed-in request (as the 2026-08-14
-- credential outage did). No backfill: existing users are NULL (active).
--
-- Verify with:
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='users' AND column_name LIKE 'suspended%';

ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at     timestamptz;  -- NULL = active; set = paused
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason text;
