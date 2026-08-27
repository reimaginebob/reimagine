-- Which product track an account is on.
--
-- Reimagine has had exactly one front door: a career strategy tool for people
-- pursuing a role. "Go Independent" is a second entry track for people who have
-- already decided to work for themselves and need positioning, clients, and
-- pricing instead of a job search. It reuses Orientation, Personal Brand,
-- Go-to-Market and Income Now; what changes is the framing at the front door and
-- where the flow lands afterward.
--
-- NULL is the standard product and always will be. A track code (today only
-- 'independent') is the exception, so every existing account and every account
-- that arrives through the normal front door needs no value and no backfill.
-- The codes live in src/tracks.js, validated on the way in.
--
-- Two rows, carried exactly the way signup_source is
-- (2026-08-25_signup-source.sql): the entry URL carries ?track=independent, the
-- signup form posts it to api/auth/request-link.js, which parks it on the
-- magic_link_tokens row, and api/auth/verify.js copies it onto the users row
-- when the account is created. It rides the token because the token is the only
-- thing that survives the round trip through the user's inbox -- the click that
-- actually creates the account comes from an email client, on a URL that no
-- longer carries the parameter.
--
-- Set on account creation only. A returning user signing in through the
-- independent URL is not switched, and an existing value is never overwritten by
-- a sign-in: the track governs which product someone is using, and flipping it
-- mid-session would strand work built under the other framing. The one way to
-- change an existing account is the deliberate admin control
-- (api/admin/track-access.js), which is how a pilot tester who signed up on the
-- wrong URL gets moved.
--
-- Forward-only and idempotent. No deploy-order hazard: both writers tolerate
-- NULL, and request-link.js writes the column only when the request carries a
-- track.
--
-- Verify with:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'users' AND column_name = 'track';

ALTER TABLE magic_link_tokens ADD COLUMN IF NOT EXISTS track text;

ALTER TABLE users ADD COLUMN IF NOT EXISTS track text;

CREATE INDEX IF NOT EXISTS users_track_idx ON users (track) WHERE track IS NOT NULL;
