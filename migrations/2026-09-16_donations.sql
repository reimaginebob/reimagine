-- Direct Career Club donations (Stripe account acct_1IQLNEK4uJoqzRSd), tracked
-- separately from NextPlacement's revenue in the admin dashboard's economics
-- section. NextPlacement's numbers (users.paying_since, economics_inputs) are
-- operator-entered and carry no payment-processor link at all; this table is
-- the first place a Stripe event lands in this database.
--
-- Linking mechanism: the donate.stripe.com Payment Links in
-- SUPPORT_PANEL_COPY (src/App.jsx) get `?client_reference_id=<users.id>`
-- appended client-side for a signed-in user. Stripe carries that value
-- through checkout and returns it on the resulting checkout.session.completed
-- webhook event (api/stripe-webhook.js), which is the only writer of this
-- table. A donor who was signed out, or whose id Stripe failed to relay,
-- lands here with user_id NULL rather than being dropped -- the row is still
-- real revenue, just not joinable to an account.
--
-- Scope: this captures the CHECKOUT event, not every later charge. A one-time
-- gift is one checkout session, so it is captured in full. The $10/mo option
-- is a subscription; only its first checkout (the signup) lands here, not
-- each month's renewal charge -- correct for what this table exists to
-- answer (donor rate, and time from registration to FIRST donation), wrong
-- if a future feature needs total donation revenue over time.
CREATE TABLE IF NOT EXISTS donations (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        REFERENCES users(id),
  stripe_event_id    text        NOT NULL,
  stripe_session_id  text,
  amount_cents       integer     NOT NULL,
  currency           text        NOT NULL,
  -- 'once' | 'monthly', from the Checkout Session's mode ('payment' vs
  -- 'subscription'). Not an enum: Stripe's own vocabulary, no reason to
  -- diverge from it.
  frequency          text        NOT NULL,
  occurred_at        timestamptz NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT NOW()
);

-- Webhook retries redeliver the same event id; this is what makes the
-- handler's ON CONFLICT DO NOTHING idempotent (same pattern as
-- email_events.event_id in api/resend-webhook.js).
CREATE UNIQUE INDEX IF NOT EXISTS donations_stripe_event_idx ON donations (stripe_event_id);
-- Serves the per-donor first-donation join in api/admin/donations.js.
CREATE INDEX IF NOT EXISTS donations_user_idx ON donations (user_id, occurred_at);
