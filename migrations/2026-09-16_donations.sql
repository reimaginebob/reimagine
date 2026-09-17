-- Direct Career Club donations (the "Pay It Forward" Stripe links,
-- SUPPORT_PANEL_COPY in src/App.jsx), captured as they happen by
-- api/webhooks/stripe.js. Deliberately its own table, not a row shape
-- bolted onto economics_inputs / users.paying_since: donations are a
-- different revenue stream from NextPlacement and the paying-customer
-- economics numbers, and CLAUDE.md's "never blend two measurements into
-- one number" rule applies here the same as everywhere else. Read by
-- api/admin/donations.js for the Economics tab's Direct Donations block.
--
-- Before this table, a Stripe payment carried nothing that tied it back to
-- a Reimagine account: every donate.stripe.com Payment Link was static,
-- so every charge showed customer:null and metadata:{}. The fix is not a
-- new backend checkout flow -- Stripe Payment Links already support a
-- `?client_reference_id=` URL parameter that round-trips onto the
-- resulting Checkout Session and its `checkout.session.completed` webhook
-- (https://docs.stripe.com/payment-links/url-parameters). SupportPanel
-- (src/App.jsx) appends the signed-in user's id there. A donor who was not
-- signed in when they clicked still gets a row here (so the Stripe-side
-- total stays complete) but reimagine_user_id is NULL and the row is
-- excluded from the per-user metrics -- there is no reliable way to
-- attribute it after the fact (a billing email does not have to match the
-- account email).
CREATE TABLE IF NOT EXISTS donations (
  id                          bigserial   PRIMARY KEY,
  reimagine_user_id           uuid        REFERENCES users(id) ON DELETE SET NULL,
  stripe_customer_id          text,
  -- 'cs:<checkout session id>' for the first payment (one-time, or a new
  -- subscription's first month), 'inv:<invoice id>' for a recurring
  -- month 2+ charge. Unique so a Stripe webhook retry (any non-2xx is
  -- redelivered) is a no-op rather than a duplicate donation.
  dedupe_key                  text        NOT NULL UNIQUE,
  stripe_checkout_session_id  text,
  stripe_payment_intent_id    text,
  stripe_invoice_id           text,
  amount_cents                integer     NOT NULL,
  currency                    text        NOT NULL DEFAULT 'usd',
  -- 'once' | 'monthly', from the Checkout Session's mode ('payment' vs
  -- 'subscription'). Not an enum for the same reason support_events.kind
  -- isn't: api/webhooks/stripe.js owns the allowed set.
  frequency                   text        NOT NULL,
  donor_email                 text,
  donated_at                  timestamptz NOT NULL,
  created_at                  timestamptz NOT NULL DEFAULT NOW()
);

-- Serves the per-donor first-donation lookup in api/admin/donations.js.
CREATE INDEX IF NOT EXISTS donations_user_idx ON donations (reimagine_user_id, donated_at);
-- Serves the recurring-charge lookup in api/webhooks/stripe.js (find the
-- reimagine_user_id already linked to this Stripe customer).
CREATE INDEX IF NOT EXISTS donations_customer_idx ON donations (stripe_customer_id);
