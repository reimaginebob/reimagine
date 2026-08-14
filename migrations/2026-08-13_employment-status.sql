-- Employment status capture (consult 2026-08-13). One profile fact stored as a
-- column, NOT in profile_state, because the profile blob autosave is a whole-
-- column replace (api/profile/save.js) and would clobber an out-of-band tap from
-- a stale session. The column is written only by api/employment.js.
--
-- Values: 'employed' | 'in_transition' | 'role_ending' | NULL (not yet answered).
-- Updatable on purpose (someone who just landed changes their status) — the
-- endpoint does a plain UPDATE, no first-tap-wins constraint.
--
-- Forward-only, idempotent. Apply BEFORE deploying the code that reads/writes it
-- (getSessionUser selects employment_status on every authenticated request).
-- No backfill: existing users are NULL (unanswered) and get the sign-in prompt.
--
-- Verify with:
--   SELECT column_name, data_type FROM information_schema.columns
--     WHERE table_name='users' AND column_name LIKE 'employment%';

ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_status            text;         -- employed | in_transition | role_ending | NULL
ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_status_updated_at timestamptz;  -- set on every write, so a change ("I just landed") is timestamped
