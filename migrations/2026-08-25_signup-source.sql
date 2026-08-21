-- Where new accounts heard about Reimagine.
--
-- Word of mouth is the stated growth engine and nothing measured it: every
-- account looked identical on arrival, so "how did they find us" could only be
-- answered by asking people one at a time. This is the smallest capture that
-- answers it -- an optional question on the signup form, one code per account.
--
-- Two columns, not one: signup_source is a code from src/signup-sources.js
-- (countable, groupable), signup_source_detail is the optional free text the
-- follow-up collects for the codes that ask one -- who referred them, which
-- newsletter, which event. Keeping the free text out of the code column is what
-- lets the count stay a count.
--
-- Carried the same way legal acceptance is (2026-05-15_legal-acceptance.sql):
-- the signup form posts it to api/auth/request-link.js, which stores it on the
-- magic_link_tokens row, and api/auth/verify.js copies it onto the users row
-- when the account is created. It rides the token because that is the only
-- thing that survives the round trip through the user's inbox.
--
-- Only ever set on account creation. A returning user is not asked again, and
-- an existing row is never overwritten -- the answer is about how they arrived,
-- and re-asking would replace a true first-touch with a fuzzy recollection.
--
-- Existing accounts keep NULL. Nothing backfills; the split is meaningful from
-- the first signup after this deploys, and the Growth tab reports how many
-- accounts predate the question rather than folding them into "unknown".
--
-- Forward-only and idempotent. No deploy-order hazard: request-link.js writes
-- the columns only if the request carries a source, and both writers tolerate
-- NULL.
--
-- Verify with:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'users' AND column_name LIKE 'signup_source%';

ALTER TABLE magic_link_tokens ADD COLUMN IF NOT EXISTS signup_source        text;
ALTER TABLE magic_link_tokens ADD COLUMN IF NOT EXISTS signup_source_detail text;

ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_source        text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_source_detail text;

CREATE INDEX IF NOT EXISTS users_signup_source_idx ON users (signup_source);
