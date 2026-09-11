-- Offer & Negotiation AI-disclaimer acknowledgment (Tier 1 of the disclaimer
-- rollout; see the ToS update in the sibling PR for Tier 3).
--
-- The card gates its first build per account behind a one-time acknowledgment
-- that its output is an AI suggestion, not professional advice, and that any
-- decision on the offer is the user's own. Mirrors the terms_accepted_at /
-- terms_version pattern already used for ToS re-acceptance.
--
-- offer_disclaimer_accepted_at: when the user checked the box and continued.
-- offer_disclaimer_version:     which version of the disclaimer text they saw
--                                (src/config/legal.js OFFER_DISCLAIMER_VERSION).
--                                A future copy change bumps this so accounts
--                                that already accepted an older version are
--                                asked again, same idea as TOS_VERSION_MATERIAL.
--
-- Forward-only, idempotent.

ALTER TABLE users ADD COLUMN IF NOT EXISTS offer_disclaimer_accepted_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS offer_disclaimer_version    text;
