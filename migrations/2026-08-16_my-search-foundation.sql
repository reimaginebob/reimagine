-- My Search MVP foundation (brief 2026-08-14). Two independent additions:
--  1. users.feature_flags — the per-user pilot gate. A list, not a boolean, so
--     the next pilot reuses the column. Carried onto /api/me by getSessionUser.
--  2. pursuit_status — one row per Opportunity Playbook record, the status layer
--     behind My Search. NOT in profile_state: profile save is a whole-column
--     jsonb replace on an 800ms debounce (api/profile/save.js), so an out-of-band
--     writer (the Coach-capture endpoint now, a push connector later) would be
--     clobbered. Same reasoning as 2026-08-13_employment-status.sql.
--
--     record_id is the client-minted savedPlaybooks id (src/App.jsx newSavedId,
--     `sp_...`), which lives only in profile_state and is never server-validated.
--     It is therefore text and FKs to nothing. The (user_id) FK ON DELETE CASCADE
--     is the only referential guarantee — it purges a user's rows on account
--     deletion (api/account/delete.js) with no edit there. Single-record orphans
--     are handled by a reconcile-on-load prune in the client, not by an FK.
--
-- Dated 2026-08-16 to sort after the existing 2026-08-15_* files (folder
-- tidiness only; scripts/migrate.mjs keys on per-file name, not a watermark, so
-- ordering is not load-bearing). Forward-only, idempotent — safe to re-run.
--
-- Apply BEFORE the code that reads/writes it deploys. Auto-applied on prod deploy
-- (scripts/deploy-migrate.mjs) so shipping this file in the PR is enough.
--
-- Verify with:
--   SELECT column_name, data_type FROM information_schema.columns
--     WHERE table_name='users' AND column_name='feature_flags';
--   SELECT column_name, data_type FROM information_schema.columns
--     WHERE table_name='pursuit_status' ORDER BY ordinal_position;

ALTER TABLE users ADD COLUMN IF NOT EXISTS feature_flags text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS pursuit_status (
  user_id              uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_id            text        NOT NULL,
  stage                text,        -- researching | applied | in_conversation | interviewing | offer | closed | NULL
  next_conversation_at timestamptz,
  next_move            text,        -- free text; NUL-stripped by the endpoint
  closed_at            timestamptz,
  outcome              text,        -- accepted | declined | not_selected | withdrew | no_response | NULL (meaningful when stage=closed)
  updated_at           timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, record_id)
);
