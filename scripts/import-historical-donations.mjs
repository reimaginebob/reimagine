#!/usr/bin/env node
// One-time historical import of pre-webhook donations
// (Output/handoff/2026-09-17_donation-backfill-email-match.md, extended:
// Bob's call was to go back to 2026-08-07).
//
// api/webhooks/stripe.js was never registered as a Stripe webhook endpoint
// until 2026-09-17 (see scripts/backfill-donation-user-ids.mjs's own header
// for the full story), so the `donations` table has zero rows for anything
// that happened before that. This script inserts the real history Stripe
// actually has for that gap, in the exact row shape api/webhooks/stripe.js
// itself writes -- so nothing downstream (api/admin/donations.js,
// api/admin/donation-funnel.js, the funnel/donor panels) needs to know the
// difference between a live row and an imported one.
//
// Fetches live from the Stripe REST API at run time -- donor names, emails,
// and Stripe object ids are real people's data and must never be hardcoded
// into a script that lives in git history. Filtered to the five "Pay It
// Forward" donation Payment Links (metadata.purpose ===
// 'reimagine_donor_support' -- confirmed via GET /v1/payment_links; every
// other link on this account is an unrelated coaching-session or course
// product and is deliberately excluded by id below), status complete/paid,
// created on or after CUTOFF below. No `stripe` npm package needed, same
// reasoning as api/webhooks/stripe.js: plain HTTPS calls with a Bearer key.
//
// Karen Groll's subscription is the recurring case the original brief
// called out by name: her checkout session (billing_reason
// subscription_create) plus each subsequent subscription_cycle renewal
// invoice on that subscription both become their own `donations` row here,
// sharing her donor_email -- so the email-match backfill
// (scripts/backfill-donation-user-ids.mjs) attributes both to the same
// account, and donations.js's own MIN(donated_at) aggregation (unchanged
// by this script) correctly takes the earlier checkout session as her
// first_donated_at rather than the later renewal.
//
// This script ONLY inserts raw rows (reimagine_user_id left NULL, exactly
// as a real webhook delivery with no client_reference_id would have
// written them -- none of these predate that field existing). It does not
// attempt email matching itself. Run scripts/backfill-donation-user-ids.mjs
// --apply afterward (or `npm run backfill:donations:full`) to attribute
// them.
//
// Usage:
//   node scripts/import-historical-donations.mjs             # dry run (default): report only, no writes
//   node scripts/import-historical-donations.mjs --apply     # insert (ON CONFLICT (dedupe_key) DO NOTHING, so a re-run is a no-op)
//
// Env vars required:
//   DATABASE_URL       same convention as scripts/migrate.mjs
//   STRIPE_SECRET_KEY  a Stripe API key for acct_1IQLNEK4uJoqzRSd with read
//                      access to Checkout Sessions and Invoices. A
//                      restricted key scoped to exactly those two
//                      resources is enough -- this script never writes to
//                      Stripe. Not required anywhere else in this app (the
//                      live webhook verifies signatures with plain HMAC and
//                      needs no Stripe key at all), so there is no existing
//                      Vercel env var to reuse; export it locally just for
//                      this run.

import { Pool } from '@neondatabase/serverless'

const APPLY = process.argv.includes('--apply')

// The five "Pay It Forward" donation Payment Links (SUPPORT_PANEL_COPY,
// src/App.jsx), identified by id via GET /v1/payment_links ->
// metadata.purpose === 'reimagine_donor_support'. Not PII -- these are
// Stripe's ids for the donation PRODUCT/link, not for any donor.
const DONATION_PAYMENT_LINK_IDS = [
  'plink_1U0jYnK4uJoqzRSdxfCAODYI', // $10/mo
  'plink_1U0jYlK4uJoqzRSdmVllPGVu', // Other/custom, once
  'plink_1U0jYjK4uJoqzRSdU3hrNEbL', // $100, once
  'plink_1U0jYiK4uJoqzRSdAJhI6IZZ', // $50, once
  'plink_1U0jYgK4uJoqzRSdYa6Ndpjb', // $20, once
]

// 2026-08-07T00:00:00Z, Bob's call on how far back to import.
const CUTOFF_UNIX = 1786060800

const STRIPE_API = 'https://api.stripe.com/v1'

async function stripeGet(path, params) {
  const url = new URL(`${STRIPE_API}${path}`)
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Stripe GET ${path} failed: ${res.status} ${body.slice(0, 300)}`)
  }
  return res.json()
}

function asText(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function tsToIso(unixSeconds) {
  return new Date(unixSeconds * 1000).toISOString()
}

// Mirrors api/webhooks/stripe.js's own row shape exactly, so an imported
// row and a live one are indistinguishable to every downstream reader.
async function rowsForPaymentLink(linkId) {
  const rows = []
  const sessions = await stripeGet('/checkout/sessions', {
    payment_link: linkId,
    status: 'complete',
    'created[gte]': CUTOFF_UNIX,
    limit: 100,
  })
  for (const s of sessions.data || []) {
    if (s.payment_status !== 'paid') continue
    rows.push({
      dedupeKey: `cs:${s.id}`,
      stripeCustomerId: asText(s.customer),
      checkoutSessionId: asText(s.id),
      paymentIntentId: asText(s.payment_intent),
      invoiceId: null,
      amountCents: Number(s.amount_total) || 0,
      currency: (asText(s.currency) || 'usd').toLowerCase(),
      frequency: s.mode === 'subscription' ? 'monthly' : 'once',
      donorEmail: asText(s.customer_details && s.customer_details.email),
      donatedAt: tsToIso(s.created),
    })

    // A subscription's renewal charges are separate donations.js rows, each
    // its own invoice.payment_succeeded event -- pull every
    // subscription_cycle renewal on this subscription so far, same filter
    // the live webhook applies (subscription_create is skipped: that first
    // charge is already the checkout session above, and counting it twice
    // would double the donor's first gift).
    if (s.mode === 'subscription' && asText(s.subscription)) {
      const invoices = await stripeGet('/invoices', { subscription: s.subscription, limit: 100 })
      for (const inv of invoices.data || []) {
        if (inv.billing_reason !== 'subscription_cycle' || inv.status !== 'paid') continue
        rows.push({
          dedupeKey: `inv:${inv.id}`,
          stripeCustomerId: asText(inv.customer),
          checkoutSessionId: null,
          paymentIntentId: asText(inv.payment_intent),
          invoiceId: asText(inv.id),
          amountCents: Number(inv.amount_paid) || 0,
          currency: (asText(inv.currency) || 'usd').toLowerCase(),
          frequency: 'monthly',
          donorEmail: asText(inv.customer_email),
          donatedAt: tsToIso(inv.created),
        })
      }
    }
  }
  return rows
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required.')
    process.exit(1)
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY is required (read access to Checkout Sessions + Invoices).')
    process.exit(1)
  }

  const allRows = []
  for (const linkId of DONATION_PAYMENT_LINK_IDS) {
    allRows.push(...(await rowsForPaymentLink(linkId)))
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const existing = allRows.length
      ? (await pool.query(
          `SELECT dedupe_key FROM donations WHERE dedupe_key = ANY($1::text[])`,
          [allRows.map(r => r.dedupeKey)]
        )).rows.map(r => r.dedupe_key)
      : []

    console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: ${allRows.length} historical row(s) found since ${tsToIso(CUTOFF_UNIX)}, ${existing.length} already present (will no-op via ON CONFLICT).\n`)

    for (const r of allRows.sort((a, b) => a.donatedAt.localeCompare(b.donatedAt))) {
      const already = existing.includes(r.dedupeKey)
      const label = already ? '(already present)' : APPLY ? '(inserting)' : '(would insert)'
      // Donor email is real user data -- printed here only because this is
      // an interactive, human-run operator script, same as
      // backfill-donation-user-ids.mjs's own console output.
      console.log(`  ${label} ${r.donorEmail || '(no email)'}  $${(r.amountCents / 100).toFixed(2)}  ${r.frequency}  ${r.donatedAt}`)
      if (APPLY) {
        await pool.query(
          `INSERT INTO donations (
             dedupe_key, reimagine_user_id, stripe_customer_id, stripe_checkout_session_id,
             stripe_payment_intent_id, stripe_invoice_id, amount_cents, currency, frequency,
             donor_email, donated_at
           )
           VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz)
           ON CONFLICT (dedupe_key) DO NOTHING`,
          [r.dedupeKey, r.stripeCustomerId, r.checkoutSessionId, r.paymentIntentId, r.invoiceId,
           r.amountCents, r.currency, r.frequency, r.donorEmail, r.donatedAt]
        )
      }
    }

    if (!APPLY) {
      console.log(`\nThis was a dry run -- no rows were changed. Re-run with --apply to insert.`)
    } else {
      console.log(`\nDone. Next: node scripts/backfill-donation-user-ids.mjs --apply (or npm run backfill:donations:apply) to attribute these by email.`)
    }
  } finally {
    await pool.end()
  }
}

main().catch(err => {
  console.error('\nImport failed:', err.message)
  process.exit(1)
})
