-- Per-user token for one-click survey answers in email.
--
-- The drop-out survey asks people what got in the way, and each answer is a
-- link in the email. Requiring a sign-in before answering would collapse the
-- response rate, so the link has to identify the person on its own.
--
-- A stored random token rather than a signed one, deliberately:
--   * no new environment variable to set and no secret to rotate
--   * rotating any other credential cannot silently break links already sitting
--     in people's inboxes
--   * a single user's token can be reset without touching anybody else
--
-- 18 random bytes, base64 with the URL-unsafe characters translated out — 24
-- characters, no padding. gen_random_bytes comes from pgcrypto, already enabled
-- in 001_init.sql.
--
-- SCOPE OF THIS TOKEN, and it must stay this narrow: it identifies a person to
-- api/survey/respond.js and nothing else. It cannot sign anyone in, cannot read
-- a profile, and cannot reach any other endpoint. The worst a leaked link can do
-- is record a survey answer for that person — which is why the answer is
-- overwritable rather than write-once, so a wrong one can be corrected by
-- clicking again.
--
-- The DEFAULT means every account created from here on gets one automatically;
-- the UPDATE backfills the accounts that already exist.
--
-- Forward-only and idempotent.
--
-- Verify with:
--   SELECT COUNT(*) FILTER (WHERE survey_token IS NULL) AS missing FROM users;

ALTER TABLE users ADD COLUMN IF NOT EXISTS survey_token text;

ALTER TABLE users
  ALTER COLUMN survey_token
  SET DEFAULT translate(encode(gen_random_bytes(18), 'base64'), '+/', '-_');

UPDATE users
   SET survey_token = translate(encode(gen_random_bytes(18), 'base64'), '+/', '-_')
 WHERE survey_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_survey_token_idx ON users (survey_token);
