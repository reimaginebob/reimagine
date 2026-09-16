# Direct donation tracking — what shipped

**Date:** 2026-09-16
**Type:** Direct prompt from Bob to Claude Code (no preceding Cowork-Claude brief)
**Source:** "Direct donation tracking in the admin dashboard's economics section"

## What was asked

Track direct Career Club donations (the career.club Stripe account,
`acct_1IQLNEK4uJoqzRSd`) in the admin Economics tab, kept separate from the
existing NextPlacement / paying-customer numbers: registration-to-first-gift
gap per donor, donor rate (donors ÷ all registered accounts), and a
distribution of that gap across all donors.

## What the investigation found (premise check, before any code)

- **The donation flow is five static `donate.stripe.com` Payment Links**
  (`SUPPORT_PANEL_COPY`, `src/App.jsx`), opened client-side in a new tab. No
  backend route, no `stripe` npm dependency, no `client_reference_id` or
  `metadata` anywhere in the repo. Every live charge on the account confirmed
  this: `customer: null`, `metadata: {}`.
- **The account's own webhook endpoint is disabled** and points at
  `https://career.club/wp-admin/admin-ajax.php?action=stripe_webhook` — a
  WordPress handler, unrelated to Reimagine. There was no live path from a
  Stripe event into this codebase at all.
- **The "NextPlacement economics" premise did not hold.** The only thing
  resembling it — `Output/handoff/2026-08-22_economics-what-shipped.md` and
  `api/admin/economics.js` / `src/EconomicsDashboard.jsx` — is the general
  paying-customer P&L (`users.paying_since`, an operator-set flag), with no
  Stripe involvement and no NextPlacement-specific tracking. The Stripe
  account has no NextPlacement product either (`GET /v1/products` came back
  with the "Support Reimagine" donation product, several old individual
  coaching/course products, and nothing else). **There was nothing to cross
  with**, so the "confirm which account NextPlacement points to" concern
  didn't apply — flagging this back rather than building a reconciliation
  against a tracker that doesn't exist.
- `users.created_at` (`migrations/001_init.sql`) is the registration
  timestamp; already used this way elsewhere in `economics.js`.

## The linking approach

Bob's brief assumed a static Payment Link couldn't carry a per-user
identifier and proposed replacing it with a server-created Checkout Session.
That turned out not to be necessary: **Stripe Payment Links support a
`?client_reference_id=` URL parameter**
(https://docs.stripe.com/payment-links/url-parameters), and it round-trips
onto the resulting Checkout Session and the `checkout.session.completed`
webhook untouched. Confirmed against Stripe's own docs before building on it.

This means:
- No new Stripe **secret** key anywhere in this repo. `SupportPanel`
  (`src/App.jsx`) already knows the signed-in user's id client-side and just
  appends it to the existing five links (`withDonorRef`). The five Payment
  Link URLs themselves are untouched.
- The only new credential is the webhook **signing** secret
  (`STRIPE_WEBHOOK_SECRET`), which only verifies inbound events — it can't
  charge anything or read account data.
- Signature verification is plain HMAC (`api/webhooks/stripe.js`), the same
  pattern `api/resend-webhook.js` already uses for Svix. No `stripe` npm
  package was added.

## What shipped

| File | Change |
|---|---|
| `migrations/2026-09-16_donations.sql` | New `donations` table. |
| `api/webhooks/stripe.js` | New webhook receiver: `checkout.session.completed` (first gift, one-time or month 1 of the $10/mo plan) and `invoice.payment_succeeded` filtered to `billing_reason: subscription_cycle` (month 2+ of a recurring gift only — the first invoice is already captured via the checkout event, and this filter is also what keeps this account's unrelated coaching/course subscriptions from ever being mistaken for a donation). |
| `api/admin/donations.js` | New admin-only GET endpoint: donor rate, avg/median gap, a fixed-bucket distribution, and a per-donor table. Same auth as `economics.js`. Excludes `@career.club` accounts from the denominator and the donor list (same convention `economics.js` already applies to `paying_customers`) — otherwise Bob's own Sept 15 test charge sits in the numbers. |
| `src/DonationsDashboard.jsx` | New component, "Direct donations (Stripe)" — its own fetch, own panel, rendered below `EconomicsDashboard` in the Economics tab. Deliberately a separate file and a separate number from the paying-customer P&L. |
| `src/AdminDashboard.jsx` | Renders `DonationsDashboard` in the `economics` tab. |
| `src/App.jsx` | `SupportPanel` now takes `userId` and appends it via `withDonorRef`; `Sidebar` threads `signedInUser.id` down to it. |
| `.env.local.example` | Documents `STRIPE_WEBHOOK_SECRET`. |

No feature flag: the dashboard addition is admin-only (already gated by
`ADMIN_LOGIN_EMAILS`), and the `client_reference_id` query-param addition to
the donate links is invisible plumbing, not a new user-facing capability —
the donate flow itself is unchanged. No user guide / Coach catalog update
for the same reason: `EconomicsDashboard` has no user-guide entry either,
being internal admin tooling.

## What's forward-looking, not retroactive

A donation only gets a `reimagine_user_id` if it happened **after** this
shipped and the donor was signed in when they clicked. Every historical
charge on the account (including Bob's own Sept 15 test) has no
`client_reference_id` and will show up under "unattributed" in the
dashboard, not silently dropped, but also not backfilled — an email-match
backfill was considered and rejected (per the original brief) as
unreliable, since a Stripe billing email doesn't have to match the account
email.

## Still open — two things only Bob can do

1. **Create the live webhook endpoint** on the career.club Stripe account
   (Dashboard → Developers → Webhooks → Add endpoint):
   URL `https://reimagine.career.club/api/webhooks/stripe`, events
   `checkout.session.completed` and `invoice.payment_succeeded`.
2. **Add the resulting signing secret** as `STRIPE_WEBHOOK_SECRET` in
   Vercel (production), then redeploy so the function picks it up (env is
   injected at build time, per CLAUDE.md §8's DB-credential-rotation note —
   same mechanic applies to any env var).

Until both are done, `/api/admin/donations` will run and show zero donors
(the table just stays empty) rather than error.
