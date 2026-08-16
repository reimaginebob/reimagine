-- Backfill: normalize SELFCHECK slugs recorded before the parser fix.
--
-- parseSelfcheck compared the model's verdict to 'none' after only trim and
-- lowercase, so any markdown or punctuation wrapper turned a "none" verdict into
-- a matched feature. PR #389 (89d3eb4, 2026-08-13) added normalizeSlug and stopped
-- it happening again, but rows already written kept their wrappers: the insights
-- dashboard still lists '** none', 'none**' and 'personal-brand**' as distinct
-- features, and the three 'none' variants are still counted as matched turns. In
-- the 14 days to 2026-08-15 that showed "Surfaced a feature: 6" where the true
-- figure was 3.
--
-- This is presentation history only — no schema change, no user-visible data.
-- Forward-only and idempotent: both statements are no-ops on a second run, and on
-- any row already written by the fixed parser.
--
-- The trim set mirrors normalizeSlug in src/coach-routing.js. A canonical slug is
-- [a-z][a-z0-9-]*, so no trimmed character is ever load-bearing.

-- 1. Strip wrappers and case from stored feature slugs, so 'personal-brand**' and
--    'personal-brand' stop bucketing separately in the features panel.
UPDATE chat_messages
SET selfcheck_feature = lower(btrim(selfcheck_feature, ' *_`''".,;:!?'))
WHERE selfcheck_feature IS NOT NULL
  AND selfcheck_feature <> lower(btrim(selfcheck_feature, ' *_`''".,;:!?'));

-- 2. A verdict that normalizes to 'none' was never a match. Restore it to the
--    verdict the fixed parser would record today: none, no feature, not surfaced.
UPDATE chat_messages
SET selfcheck_verdict = 'none',
    selfcheck_feature = NULL,
    selfcheck_surfaced = 'none'
WHERE selfcheck_feature = 'none';
