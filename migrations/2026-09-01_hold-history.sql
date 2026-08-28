-- Account-hold history (rogue-activity safeguard, audit trail).
--
-- Unpausing an account sets suspended_at = NULL and suspended_reason = NULL, so
-- the moment a hold is lifted every trace of it is gone. There was no way to ask
-- "was this account ever held, when, and why" — which is exactly the question
-- worth asking when a user writes in saying they were locked out. These three
-- columns are written when a hold is APPLIED and are never cleared, so lifting a
-- hold no longer erases the fact that it happened.
--
-- hold_count:       how many times this account has ever been placed on hold.
-- last_hold_at:     when the most recent hold was applied.
-- last_hold_reason: why ('manual', 'auto: 17 playbooks/hr', ...).
--
-- Deliberately three columns on users rather than a new table: the operator
-- question is "has this ever happened to this person," not "replay the whole
-- history." If per-hold detail is ever needed, an append-only table supersedes
-- these and they can be dropped.
--
-- No backfill is possible: holds lifted before this shipped left nothing behind.
-- Existing rows start at hold_count = 0, which reads as "no hold on record"
-- rather than "never held" — the distinction matters for accounts touched
-- before 2026-08-28.
--
-- Forward-only, idempotent. No deploy-order hazard: the columns are written by
-- the pause paths and read only by the admin dashboard, and migrations apply
-- before the build.
--
-- Verify with:
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='users' AND column_name LIKE '%hold%';

ALTER TABLE users ADD COLUMN IF NOT EXISTS hold_count       integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_hold_at     timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_hold_reason text;
