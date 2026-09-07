-- Close-reason capture (Coach-as-Concierge deletion/retraction follow-on,
-- 2026-09-07). One row per (user, opportunity) recording why a pursuit
-- ended, if the person has any read on it -- captured through Coach chat,
-- never volunteered by the model, always a one-tap confirm.
--
-- `reason_code` is one of the bounded keys in src/pursuit-close-reasons.js
-- (CLOSE_REASON_CODES), validated before a row is ever written, same
-- discipline as user_activity_facts.activity against its own catalog.
-- `initiated_by` defaults to 'unknown' rather than NULL so an aggregate
-- query never has to special-case a missing value.
--
-- The reason this is its own table rather than a field inside profile_state
-- or the opportunity's own notes: `reason_code` is the one piece of data in
-- this whole product explicitly designed to be looked at in aggregate,
-- across every account, on a later date (a genuinely different build,
-- deliberately not this one) -- and that only works cleanly if the
-- category has been correct from day one. `detail` (their own words) rides
-- along in the same row but is never part of that future aggregate; only
-- `reason_code` ever would be.
--
-- record_id is the client-minted savedPlaybooks id, same shape and same
-- reasoning as pursuit_status.record_id (2026-08-16_my-search-foundation.sql)
-- -- text, FKs to nothing, no server-side validation; the (user_id) FK ON
-- DELETE CASCADE is the only referential guarantee.
--
-- Forward-only and idempotent; re-running is a no-op.
--
-- Verify with:
--   SELECT to_regclass('public.pursuit_close_reasons');

CREATE TABLE IF NOT EXISTS pursuit_close_reasons (
  user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_id    text        NOT NULL,
  reason_code  text        NOT NULL,
  initiated_by text        NOT NULL DEFAULT 'unknown',
  detail       text,
  learned_at   timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, record_id)
);
