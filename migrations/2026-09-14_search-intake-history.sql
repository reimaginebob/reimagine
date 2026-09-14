-- Search intake answer history (launch capture foundation, 2026-09-14,
-- Output/handoff/2026-09-14_launch-capture-foundation.md, PR 2).
--
-- users.search_going_well / users.search_focus hold the CURRENT answer and are
-- updated in place: the Orientation screen tells people they can come back and
-- change them any time, and api/search-intake.js overwrites the column on every
-- change. That is right for Coach, which should read where someone is now. It
-- is wrong for the one thing these two answers are uniquely good for: a record
-- of how a person described their own search, in their own words, before
-- Reimagine taught them its vocabulary. Once overwritten, that first answer is
-- gone, and nightly profile_state_snapshots cannot recover it because these
-- fields live on the users row, not in the profile blob.
--
-- This table is append-only. api/search-intake.js adds a row whenever a field's
-- value actually changes (a clear counts; a blur with no change does not). The
-- earliest row per user and field is the protected first answer. Nothing ever
-- updates or deletes a row here except the account-deletion cascade.
--
-- source: 'app' for live writes; 'backfill' for the one-time copy of values
-- that already existed when this shipped. A backfilled row is the earliest
-- answer we still hold, not necessarily the first one ever given, and its
-- created_at is the column's own *_updated_at, the best time available.
--
-- Forward-only, idempotent: the backfill skips any user and field that already
-- has history, so a re-run adds nothing.

CREATE TABLE IF NOT EXISTS search_intake_history (
  id          bigserial   PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  field       text        NOT NULL CHECK (field IN ('going_well', 'focus')),
  value       text        NOT NULL,
  source      text        NOT NULL DEFAULT 'app',
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS search_intake_history_user_field_idx
  ON search_intake_history (user_id, field, created_at);

INSERT INTO search_intake_history (user_id, field, value, source, created_at)
SELECT u.id, 'going_well', u.search_going_well, 'backfill', COALESCE(u.search_going_well_updated_at, u.created_at, NOW())
FROM users u
WHERE NULLIF(TRIM(u.search_going_well), '') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM search_intake_history h WHERE h.user_id = u.id AND h.field = 'going_well');

INSERT INTO search_intake_history (user_id, field, value, source, created_at)
SELECT u.id, 'focus', u.search_focus, 'backfill', COALESCE(u.search_focus_updated_at, u.created_at, NOW())
FROM users u
WHERE NULLIF(TRIM(u.search_focus), '') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM search_intake_history h WHERE h.user_id = u.id AND h.field = 'focus');
