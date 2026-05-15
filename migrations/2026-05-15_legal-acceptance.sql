-- Phase 1 migration: Privacy + Terms acceptance gate.
-- Apply to the production Neon database BEFORE deploying the Phase 2 code.
-- Verify with: \d users   and   \d magic_link_tokens
--
-- All columns are nullable. Rows that exist before this migration runs keep
-- NULL in every column. The application treats NULL privacy_version /
-- terms_version on a users row as "grandfathered, do not prompt for
-- re-acceptance" (re-acceptance for grandfathered users is deferred to V2).
--
-- The magic_link_tokens columns carry the acceptance captured on the signup
-- form. The user row is created only when the magic link is clicked
-- (api/auth/verify.js), so request-link.js writes acceptance onto the token
-- row and verify.js copies it onto the new users row at creation time. The
-- acceptance timestamp is therefore the moment the form was submitted.

ALTER TABLE users
  ADD COLUMN privacy_accepted_at TIMESTAMPTZ,
  ADD COLUMN privacy_version TEXT,
  ADD COLUMN terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN terms_version TEXT;

ALTER TABLE magic_link_tokens
  ADD COLUMN privacy_accepted_at TIMESTAMPTZ,
  ADD COLUMN privacy_version TEXT,
  ADD COLUMN terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN terms_version TEXT;
