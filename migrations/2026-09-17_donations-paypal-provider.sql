-- Adds PayPal Commerce Platform as a second donation provider alongside
-- Stripe (migrations/2026-09-16_donations.sql). See Output/handoff/
-- 2026-09-17_paypal-commerce-integration.md.
--
-- `provider` defaults 'stripe' so every existing row backfills for free and
-- every write api/webhooks/stripe.js already makes needs no change.
--
-- `status` is new because PayPal's webhook (unlike Stripe's, which this repo
-- only ever wires to checkout.session.completed / invoice.payment_succeeded)
-- is subscribed to DECLINED, REFUNDED and REVERSED as well as COMPLETED --
-- api/webhooks/paypal.js updates a row's status in place rather than
-- inserting a second row for the same gift. Defaults 'completed' so every
-- existing Stripe row (which this repo has never tracked a refund state
-- for) reads the same as it always has.
--
-- paypal_order_id / paypal_capture_id mirror the stripe_* columns' role:
-- identifiers used only to look a PayPal donation back up (the capture
-- webhook re-delivers on retry; a refund/reversal event needs to find the
-- original completed row by capture id). dedupe_key keeps the existing
-- prefix convention ('cs:'/'inv:' for Stripe) with 'pp:<capture id>' for
-- PayPal, so a webhook retry is a no-op the same way it already is for
-- Stripe, and both providers keep working through the ONE existing
-- ON CONFLICT (dedupe_key) DO NOTHING in recordDonation.
ALTER TABLE donations ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe';
ALTER TABLE donations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';
ALTER TABLE donations ADD COLUMN IF NOT EXISTS paypal_order_id text;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS paypal_capture_id text;

-- Serves the refund/reversal lookup in api/webhooks/paypal.js (find the row
-- to update by capture id). Partial: only PayPal rows ever populate this.
CREATE INDEX IF NOT EXISTS donations_paypal_capture_idx
  ON donations (paypal_capture_id) WHERE paypal_capture_id IS NOT NULL;
