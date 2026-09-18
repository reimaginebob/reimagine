-- Which partner organization's link a new account arrived on.
--
-- Bob is distributing individual links to job search groups, corporate
-- alumni networks, and business-school alumni chapters (e.g.
-- reimagine.career.club/?via=pwc-alumni) inside the flyer, newsletter blurb,
-- or LinkedIn post each partner redistributes to its own members. This counts
-- how many new accounts each partner link actually sends.
--
-- Independent of signup_source (2026-08-25_signup-source.sql): signup_source
-- is what the person SAYS when asked; referral_partner is which link they
-- actually CLICKED. Carrying both lets the two be compared rather than
-- conflated. This must never be folded into signup_source's outplacement/
-- referral codes -- see the NextPlacement boundary comment in
-- src/signup-sources.js. If a NextPlacement partner link is ever minted under
-- this same mechanism, it needs that same boundary respected here too.
--
-- Carried exactly the way track and signup_source are
-- (2026-08-27_independent-track.sql): the entry URL carries ?via=<tag>, the
-- signup form posts it to api/auth/request-link.js, which parks it on the
-- magic_link_tokens row, and api/auth/verify.js copies it onto the users row
-- when the account is created. It rides the token because the token is the
-- only thing that survives the round trip through the user's inbox.
--
-- Format-validated in src/referral-partner.js, not list-validated: partners
-- are added outside the codebase (Bob's own tracker spreadsheet), and a
-- canonical list would mean a PR per partner. Values are freeform lowercase
-- tags, not codes from a fixed set.
--
-- Set on account creation only. A returning user is not asked, and an
-- existing value is never overwritten by a later sign-in -- the answer is
-- about how the account first arrived.
--
-- Existing accounts keep NULL. Nothing backfills.
--
-- Forward-only and idempotent, and both writers tolerate NULL. One deploy-
-- order note that does NOT apply to a normal merge (migrations auto-apply on
-- every production deploy before the new code serves, same as
-- signup_source/track before it): it DOES apply to a Vercel *preview* used to
-- functional-test this change before merge, because previews share the
-- production database but skip migrations. Apply this migration to
-- production first in that case -- see the implementation brief.
--
-- Verify with:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'users' AND column_name = 'referral_partner';

ALTER TABLE magic_link_tokens ADD COLUMN IF NOT EXISTS referral_partner text;

ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_partner text;

CREATE INDEX IF NOT EXISTS users_referral_partner_idx ON users (referral_partner) WHERE referral_partner IS NOT NULL;
