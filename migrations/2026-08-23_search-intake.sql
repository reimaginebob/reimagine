-- Search experience intake (consult 2026-08-20, docs/search-intake-brief.md).
-- Two free-text answers captured on the Orientation "Your Current Situation"
-- screen: what is going well in the person's search, and what they would like
-- to improve. Read by My Coach as dated background on where they came in.
--
-- Columns, NOT profile_state, for the same reason as 2026-08-13_employment-
-- status.sql: the profile blob is saved as a whole-object jsonb replace on a
-- debounce (api/profile/save.js), so a value written out-of-band is silently
-- lost when a stale tab's autosave lands after it. Written only by
-- api/search-intake.js.
--
-- Each field carries its OWN timestamp rather than sharing one, so revising
-- one answer does not make the other look freshly confirmed. The timestamps
-- are load-bearing, not bookkeeping: api/coach.js states the elapsed time in
-- words ("five months ago they said...") and drops the lines entirely past a
-- staleness threshold, which is what stops a day-one read from hardening into
-- a permanent label.
--
-- Column names are copy-neutral (search_focus, not search_to_improve) so a
-- later change to the on-screen wording does not strand the schema.
--
-- Values: free text, trimmed and length-capped by the endpoint. NULL means not
-- answered; '' means answered and then cleared. No backfill — existing users
-- are NULL and get the one-time prompt.
--
-- Forward-only, idempotent. Apply BEFORE the code that reads it deploys
-- (getSessionUser selects these on every authenticated request). Auto-applied
-- on prod deploy (scripts/deploy-migrate.mjs), so shipping this file is enough.
--
-- Verify with:
--   SELECT column_name, data_type FROM information_schema.columns
--     WHERE table_name='users' AND column_name LIKE 'search_%'
--     ORDER BY column_name;

ALTER TABLE users ADD COLUMN IF NOT EXISTS search_going_well            text;         -- "What's going well in your search right now?"
ALTER TABLE users ADD COLUMN IF NOT EXISTS search_going_well_updated_at timestamptz;  -- set on every write to that field
ALTER TABLE users ADD COLUMN IF NOT EXISTS search_focus                 text;         -- "What would you like to improve?"
ALTER TABLE users ADD COLUMN IF NOT EXISTS search_focus_updated_at      timestamptz;  -- set on every write to that field
