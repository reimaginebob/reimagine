-- Per-generation cost capture, plus the two things a P&L needs that no query
-- can derive. Backs the Economics tab of /admin/dashboard.
--
-- 1. generation_events gains token + cost columns. The table already logged one
--    row per generation for the rogue-activity watchdog, but the Anthropic
--    usage object was thrown away into a console.log line, so nothing in the
--    database could answer "what does a user cost". Cost is computed at write
--    time from api/_lib/usage-cost.js and stored in dollars: published model
--    prices change, and a July row repriced in December would silently
--    misstate July. Token counts are kept alongside for diagnosis -- cache hit
--    rate is most of the variance in what a generation costs.
--
-- 2. economics_inputs holds the assumptions: price per customer and fixed
--    monthly cost. One row per change, keyed by the date it takes effect; a
--    report for a given month reads the latest row on or before that month.
--    A handful of rows a year, NOT a daily snapshot -- everything else on the
--    P&L recomputes live from these tables in well under a second at this
--    scale, and a nightly snapshot job would only add a way for the history to
--    grow holes when it fails to run.
--
-- users.paying_since marks who is actually a customer. The active-user count is
-- a login count; without this the revenue line silently bills pilots, admins,
-- and free accounts. NULL (where every row starts) means "not recorded as
-- paying", and the dashboard reports the unrecorded count rather than assuming.
--
-- Forward-only and idempotent. No deploy-order hazard: the writes in
-- api/claude.js and api/coach.js are best-effort and swallow their errors, so
-- this can apply before or after the code deploys. Applying it is what starts
-- the cost history -- nothing backfills, because the token counts for past
-- generations were never stored.
--
-- Verify with:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'generation_events' ORDER BY ordinal_position;
--   SELECT * FROM economics_inputs;

ALTER TABLE generation_events ADD COLUMN IF NOT EXISTS model              text;
ALTER TABLE generation_events ADD COLUMN IF NOT EXISTS input_tokens       integer;
ALTER TABLE generation_events ADD COLUMN IF NOT EXISTS output_tokens      integer;
ALTER TABLE generation_events ADD COLUMN IF NOT EXISTS cache_write_tokens integer;
ALTER TABLE generation_events ADD COLUMN IF NOT EXISTS cache_read_tokens  integer;
ALTER TABLE generation_events ADD COLUMN IF NOT EXISTS web_searches       integer;
-- numeric(12,6): one generation costs fractions of a cent, and six decimals
-- keep a cache-heavy $0.000012 row from rounding away to zero.
ALTER TABLE generation_events ADD COLUMN IF NOT EXISTS cost_usd           numeric(12,6);

ALTER TABLE users ADD COLUMN IF NOT EXISTS paying_since date;

CREATE TABLE IF NOT EXISTS economics_inputs (
  effective_date     date PRIMARY KEY,
  price_per_customer numeric(12,2) NOT NULL,
  fixed_monthly_cost numeric(12,2) NOT NULL,
  note               text,
  updated_at         timestamptz NOT NULL DEFAULT NOW()
);

-- Seed: the figures stated in the NextPlacement economics brief. Dated
-- 2026-01-01 so it also covers the months already in the database. Editable
-- from the Economics tab; a change writes a NEW row rather than rewriting this
-- one, so last month's report keeps last month's assumptions.
INSERT INTO economics_inputs (effective_date, price_per_customer, fixed_monthly_cost, note)
VALUES ('2026-01-01', 450.00, 1260.00, 'Opening figures from the NextPlacement economics brief')
ON CONFLICT (effective_date) DO NOTHING;
