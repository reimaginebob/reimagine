#!/usr/bin/env node
// One-time backfill of pre-launch donations by email match
// (Output/handoff/2026-09-17_donation-backfill-email-match.md).
//
// The account-linking capability (client_reference_id on the donate links,
// migrations/2026-09-16_donations.sql) only works forward from the moment
// it shipped. Every donation before then sits in `donations` with
// reimagine_user_id NULL, even though the donor's billing email
// (donor_email, captured by api/webhooks/stripe.js from Stripe's own
// customer_details.email / customer_email at insert time) very often
// matches a real Reimagine account. This script closes that gap by writing
// reimagine_user_id -- the SAME column the live webhook already writes --
// on rows where a case-insensitive email match is unambiguous.
//
// It does not touch the webhook, the donation-funnel endpoint, or the
// donor-detail endpoint. All three already read reimagine_user_id; this
// just makes more of it non-null. No fuzzy matching: a donation whose
// donor_email doesn't match, or matches more than one account, is left
// NULL and stays in the existing unattributed/unmatched count exactly as
// today -- wrong is worse than absent here, since a false match puts one
// person's gift in another person's history.
//
// Recurring donors (Karen Groll's pattern: a subscription's first charge
// plus later renewal invoices, each its own `donations` row sharing one
// donor_email) need no special handling here: this script matches each row
// independently by email, and api/admin/donations.js's own aggregation
// (MIN(donated_at) / SUM(amount_cents) / COUNT(*) grouped by
// reimagine_user_id) already collapses same-account rows into one donor
// with the earliest date as first_donated_at. As a side effect, once a
// recurring donor's first charge is matched, api/webhooks/stripe.js's
// invoice.payment_succeeded handler (which requires an already-linked row
// for that stripe_customer_id) will also start recording that donor's
// FUTURE renewals -- currently silently ignored as 'unlinked customer'.
//
// Usage:
//   node scripts/backfill-donation-user-ids.mjs             # dry run (default): report only, no writes
//   node scripts/backfill-donation-user-ids.mjs --apply     # write reimagine_user_id for unambiguous matches
//
// DATABASE_URL env var is required (same convention as scripts/migrate.mjs).
// Every match (dry-run or applied) is written to a timestamped JSON log
// file in the repo root (gitignored -- donor emails are real user data) so
// a bad match can be traced and reversed by donation id without guessing:
// reversing one is `UPDATE donations SET reimagine_user_id = NULL WHERE id = <id>`.

import { Pool } from '@neondatabase/serverless'
import fs from 'node:fs'
import path from 'node:path'

const APPLY = process.argv.includes('--apply')

function normEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required.')
    process.exit(1)
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    const unmatched = (await pool.query(
      `SELECT id, donor_email, stripe_customer_id, amount_cents, donated_at
       FROM donations
       WHERE reimagine_user_id IS NULL
       ORDER BY donated_at ASC`
    )).rows

    console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: ${unmatched.length} donation row(s) currently unmatched.\n`)

    const noEmail = unmatched.filter(d => !normEmail(d.donor_email))
    const withEmail = unmatched.filter(d => normEmail(d.donor_email))

    // One lookup for every distinct email, rather than one query per row.
    const distinctEmails = [...new Set(withEmail.map(d => normEmail(d.donor_email)))]
    const userRows = distinctEmails.length
      ? (await pool.query(
          `SELECT id, email, lower(email) AS norm_email
           FROM users
           WHERE lower(email) = ANY($1::text[])`,
          [distinctEmails]
        )).rows
      : []

    // norm_email -> array of {id, email}. More than one entry means the
    // email is ambiguous (users.email is UNIQUE but case-sensitive, so
    // 'Karen@x.com' and 'karen@x.com' could both exist as separate rows).
    const byNormEmail = new Map()
    for (const u of userRows) {
      if (!byNormEmail.has(u.norm_email)) byNormEmail.set(u.norm_email, [])
      byNormEmail.get(u.norm_email).push(u)
    }

    const matched = []
    const ambiguous = []
    const noAccount = []

    for (const d of withEmail) {
      const candidates = byNormEmail.get(normEmail(d.donor_email)) || []
      if (candidates.length === 1) {
        matched.push({ donation: d, user: candidates[0] })
      } else if (candidates.length > 1) {
        ambiguous.push({ donation: d, candidates })
      } else {
        noAccount.push(d)
      }
    }

    if (APPLY) {
      for (const { donation, user } of matched) {
        await pool.query(
          `UPDATE donations SET reimagine_user_id = $1 WHERE id = $2 AND reimagine_user_id IS NULL`,
          [user.id, donation.id]
        )
      }
    }

    console.log(`Matched (unambiguous email match):     ${matched.length}${APPLY ? ' -- written' : ' -- would be written with --apply'}`)
    for (const { donation, user } of matched) {
      console.log(`  donation ${donation.id}  ${donation.donor_email} -> user ${user.id} (${user.email})  $${(donation.amount_cents / 100).toFixed(2)}  ${donation.donated_at}`)
    }

    console.log(`\nSkipped -- ambiguous (email matches more than one account): ${ambiguous.length}`)
    for (const { donation, candidates } of ambiguous) {
      console.log(`  donation ${donation.id}  ${donation.donor_email} -> ${candidates.map(c => `${c.id} (${c.email})`).join(', ')}`)
    }

    console.log(`\nSkipped -- no matching account: ${noAccount.length}`)
    console.log(`Skipped -- no donor_email on record: ${noEmail.length}`)

    const log = {
      ranAt: new Date().toISOString(),
      mode: APPLY ? 'apply' : 'dry-run',
      matched: matched.map(({ donation, user }) => ({
        donation_id: donation.id,
        donor_email: donation.donor_email,
        amount_cents: donation.amount_cents,
        donated_at: donation.donated_at,
        matched_user_id: user.id,
        matched_user_email: user.email,
      })),
      ambiguous: ambiguous.map(({ donation, candidates }) => ({
        donation_id: donation.id,
        donor_email: donation.donor_email,
        candidate_user_ids: candidates.map(c => c.id),
      })),
      no_account_count: noAccount.length,
      no_email_count: noEmail.length,
    }
    const logPath = path.resolve(process.cwd(), `donation-backfill-${log.ranAt.replace(/[:.]/g, '-')}.json`)
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2))
    console.log(`\nLog written to ${logPath}`)

    if (!APPLY && matched.length > 0) {
      console.log(`\nThis was a dry run -- no rows were changed. Re-run with --apply to write reimagine_user_id for the ${matched.length} match(es) above.`)
    }
  } finally {
    await pool.end()
  }
}

main().catch(err => {
  console.error('\nBackfill failed:', err.message)
  process.exit(1)
})
