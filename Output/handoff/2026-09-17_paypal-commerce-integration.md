# PayPal Commerce Platform on Pay It Forward

## Prompt for Code

Apply the changes in this brief to add a PayPal/Venmo/card option to the Pay It Forward panel, alongside the existing Stripe links (Stripe is untouched). Premise-verify against current `main` first, run the static gates, update the changelog, and follow the gh flow in CLAUDE.md §9 to open, watch, and merge the PR. Report the PR URL and merge SHA when done.

## Date / Type / Source

2026-09-17. New capability (gated pilot), consult-then-build. Source: Bob's cowork thread 2026-09-17 (Scott Faucheux, beta user, flagged that Venmo would help younger donors); vendor-side setup (PayPal Business account, Sandbox app, webhook subscription) already done by Bob.

## Pre-flight discovery (scope correction)

The originating brief named `SUPPORT_REIMAGINE` at App.jsx:7147 and asked for a diagnosis pass before building. Verified against `origin/main` (242 commits ahead of the stale local checkout this session started from):

- The constant is `SUPPORT_PANEL_COPY` at App.jsx:7198, component `SupportPanel` at App.jsx:7277, rendered from `Sidebar`'s `supportRail`. Line/name in the original ask were stale.
- `donations` table (`migrations/2026-09-16_donations.sql`) has no `provider` column today — Stripe-only schema, Stripe-prefixed columns throughout. Needs a migration (this brief adds `provider`, `status`, `paypal_order_id`, `paypal_capture_id`).
- `api/webhooks/stripe.js` verifies its signature with plain HMAC via `crypto`, no `stripe` npm package — the same local-verification convention `api/resend-webhook.js` uses for Svix. PayPal's V2 webhooks sign asymmetrically (rotating certificate), so this brief calls PayPal's own `/v1/notifications/verify-webhook-signature` endpoint rather than replicate that local-verification style with a cert cache — a deliberate deviation, not an oversight (see the header comment in `api/webhooks/paypal.js`).
- No `provider` awareness exists yet in `api/admin/donations.js`, `api/admin/donation-funnel.js`, or `src/DonationsDashboard.jsx` — all three currently say "(Stripe)" in comments or UI. Since this same PR starts writing PayPal rows into the same table those three read, leaving the labels alone would make `api/admin/donations.js`'s "Direct donations (Stripe)" block silently wrong the moment a PayPal gift lands. Folded into this PR as a small, additive fix (label change + a `providers` field on each donor row) rather than deferred — it is this PR's own correctness, not unrelated scope.
- `src/coach-routing.js`'s `FEATURE_MAP` has no entry for Pay It Forward / donations today. No Coach catalog change needed or made.
- The user guide's FAQ (`src/data/user-guide/faq-and-troubleshooting.md`) says "Each opens a Stripe checkout page in a new tab," which becomes incomplete once PayPal ships — but since this pilot gates to Bob (and named testers) first, updating the guide now would describe a capability most of the 145 accounts cannot see. Left alone this PR, per CLAUDE.md §8's pilot-documentation-partition convention; update it in the GA follow-up PR.
- No existing client-side env var (`import.meta.env.*`) usage anywhere in `src/` — this is the first one. Uses Vite's built-in `VITE_` prefix convention (no `vite.config.js` change needed).

## Files affected

| File | Change |
|---|---|
| `migrations/2026-09-17_donations-paypal-provider.sql` | New. Adds `provider`, `status`, `paypal_order_id`, `paypal_capture_id` to `donations`. |
| `api/_lib/paypal.js` | New. Shared OAuth token fetch (cached per warm instance), Sandbox/Live API base resolution (from `VERCEL_ENV`), small fetch wrapper. |
| `api/paypal/create-order.js` | New. `POST {amount, userId}` → creates a PayPal order, returns `orderId`. Does not write to `donations`. |
| `api/paypal/capture-order.js` | New. `POST {orderId}` → captures the order, returns status to the browser. Does not write to `donations`. |
| `api/webhooks/paypal.js` | New. Verifies signature via PayPal's own verify endpoint; records `PAYMENT.CAPTURE.COMPLETED`, updates status on `REFUNDED`/`REVERSED`, ignores `DECLINED`. Sole writer to `donations` for PayPal, mirroring how `api/webhooks/stripe.js` is the sole writer for Stripe. |
| `api/_lib/feature-flags.js` | Adds `PAYPAL_DONATE_FLAG` (`'paypal_donate'`), `hasPaypalDonate()`, and a `GRANTABLE_FLAGS` entry so Bob can grant named testers from the admin dashboard. |
| `src/PayPalDonate.jsx` | New. Loads the PayPal JS SDK on demand, renders the amount picker + PayPal Buttons, calls the two endpoints above. |
| `src/App.jsx` | Imports `PayPalDonate`; adds the `hasPaypalDonate` client mirror flag; threads it `App → Sidebar → SupportPanel`; renders `<PayPalDonate userId={userId}/>` inside `SupportPanel` below the existing "Give monthly" block, gated on the flag. |
| `.env.local.example` | Documents `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `VITE_PAYPAL_CLIENT_ID`. |
| `api/admin/donations.js` | Header comment updated for two providers; donor query adds `providers` (distinct array) per donor row. |
| `api/admin/donation-funnel.js` | Header comment updated for two providers (no query change — it was already provider-agnostic). |
| `src/DonationsDashboard.jsx` | "Direct donations (Stripe)" → "Direct donations"; copy generalized; donor table gets a Provider column. |

## Specific changes

See the diff — each file above is new or additive. The two load-bearing design decisions, spelled out because they are not obvious from the ask alone:

1. **The browser never writes a donation row.** `create-order.js` and `capture-order.js` only drive PayPal's own checkout flow and report status back to the UI; `api/webhooks/paypal.js` is the only writer. This mirrors `api/webhooks/stripe.js`'s existing division of labor exactly, and avoids two independent insert paths that could race or double-record the same gift.
2. **Sandbox/Live switching reads `VERCEL_ENV`, not a suffixed env var.** `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / `PAYPAL_WEBHOOK_ID` hold different values per Vercel environment (Preview = Sandbox app, Production = Live app, once promoted) — the same scoping model CLAUDE.md documents for `ADMIN_LOGIN_EMAILS`. The code picks the PayPal API host from `VERCEL_ENV === 'production'`, so Bob only ever sets the three names once per environment.

## Voice rules on inserted text

The only new user-facing copy is the section label ("Or pay with PayPal, Venmo, or card") and the success line ("Thank you — your gift went through."). Plain language, no banned constructions, no AI-coaching register. `SUPPORT_PANEL_COPY` itself is untouched.

## Static gates

- `npm run build` clean.
- `npm run prebuild` chain (test + lint + check-voice + check-sys-equality + check-prompt-refs + check-coach-nav-map + check-concierge-moment-map + check-scope-lenses + check-orphans + check-fontsize + check-btn-prominence + check-guide-refs) — see Implementer's checklist for the run.
- App.jsx EOF integrity preserved (line count / final closing tag checked before and after).
- Diff scope limited to the files named above.

## Runtime gate (post-merge, Bob or Cowork-Claude verifies)

1. Add `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `VITE_PAYPAL_CLIENT_ID` (Sandbox values) to the Preview environment in Vercel.
2. On the Preview deploy, sign in as an internal (`@career.club`) account, open Pay It Forward, confirm the PayPal section renders and a Sandbox test-buyer donation completes.
3. Confirm the webhook fires (`PAYMENT.CAPTURE.COMPLETED`) and a row lands in `donations` with `provider = 'paypal'`.
4. Confirm the Economics tab's Direct donations block shows the new row with `providers` including `paypal`.
5. Only then: add Live values to Production and promote.

## Constraints

Single PR. No effort estimates. PR title: `Add PayPal Commerce Platform to Pay It Forward (#paypal-donate flag)`.

## Out of scope

- User guide (`faq-and-troubleshooting.md`) and Coach catalog updates — deferred to the GA follow-up per the pilot-documentation-partition convention (§8); Pay It Forward has no `FEATURE_MAP` entry today regardless.
- PayPal recurring/subscription donations — the brief's own ask covers one-time gifts only; the existing Stripe $10/mo option has no PayPal equivalent yet.
- Local (cert-cached) PayPal webhook signature verification — using PayPal's remote verify endpoint instead; revisit only if webhook volume ever makes the latency matter.
- Refund/reversal capture-id extraction (`captureIdFromLinks` in `api/webhooks/paypal.js`) is written to the documented PayPal payload shape but unverified against a live Sandbox refund — confirm during the runtime gate above before relying on it for anything besides logging.

## Commit message

```
Add PayPal Commerce Platform to Pay It Forward

Second payment option (PayPal, Venmo, card) alongside the existing
Stripe links, gated behind paypal_donate so Bob QCs the Sandbox flow
before any named tester sees it. donations table gains a provider
column; api/webhooks/paypal.js is the sole writer, mirroring how
api/webhooks/stripe.js already owns Stripe's writes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

## Push

Branch `worktree-paypal-commerce-integration` (already cut off `origin/main`). Open PR via `gh pr create`, watch CI with `gh pr checks --watch`, squash-merge once green, per CLAUDE.md §9.

## Implementer's checklist

1. Pull / confirm branch is current with `origin/main`. ✅ (branched fresh off `origin/main`)
2. Premise-verify against current code. ✅ (this section)
3. Apply changes. ✅
4. Run gates: `npm run build`, `npm run prebuild` chain.
5. No user-guide/Coach changes this PR (documented above as deliberately out of scope).
6. Push, open PR, watch CI, squash-merge.
7. Report PR URL + merge SHA.
