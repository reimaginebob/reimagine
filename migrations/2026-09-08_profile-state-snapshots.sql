-- Nightly backup snapshot of every account's profile_state (finding #2.6,
-- 2026-09-08 prelaunch audit). Combined with finding #2.5 (the autosave
-- overwrite risk), a client bug that saved an empty or corrupted state had
-- no way back short of a full Neon point-in-time restore -- a whole-database
-- operation, not a per-user undo. One row per user per night, written by
-- api/admin/profile-snapshot.js (cron in vercel.json).
--
-- Unconditional, not a diff and not deduped against the prior night's
-- snapshot -- at 145 accounts and typical profile_state sizes this is
-- cheap. A pruning/retention policy is deliberately deferred (finding
-- #3.10, before-launch tier) rather than bundled into this fix.
CREATE TABLE IF NOT EXISTS profile_state_snapshots (
  id                bigserial PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_state     jsonb NOT NULL,
  source_updated_at timestamptz,
  snapshotted_at    timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS profile_state_snapshots_user_idx ON profile_state_snapshots (user_id, snapshotted_at DESC);
