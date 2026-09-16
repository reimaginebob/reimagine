// Direct Career Club donation metrics for the Economics tab of /admin/dashboard
// -- deliberately separate from NextPlacement's P&L in api/admin/economics.js,
// which is a different revenue stream with no Stripe link behind it at all.
//
// What this answers: of the registered user base, what share has ever
// donated, and how long after signup does a first donation tend to land.
// Aggregate only, by design -- Bob's own framing was "I don't need to see it
// was Susan or John," so this endpoint never returns a per-donor row, only
// counts and a bucketed distribution. That also keeps the payload itself
// outside anything the "anonymous behavioral analytics" language in
// src/legalDocs.js governs, since nothing here is a behavioral-analytics
// event or a per-user display; see the PR description for the one line
// proposed for that document.
//
// Source: the `donations` table (migrations/2026-09-16_donations.sql), written
// only by api/stripe-webhook.js from checkout.session.completed events on the
// Career Club Stripe account (acct_1IQLNEK4uJoqzRSd). A donation with no
// user_id (signed-out donor, or an outside donor with no Reimagine account)
// is real revenue but cannot join to a signup date, so it is reported as its
// own count rather than silently dropped or silently counted as a donor.
//
// Auth: signed-in session + ADMIN_LOGIN_EMAILS, same as api/admin/economics.js.

import { sql } from '../_lib/db.js'
import { checkAdminAuth, adminLoginEmailsMissing } from '../_lib/admin-auth.js'

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// Buckets chosen to show clustering rather than an average that hides it --
// immediately, within weeks, within months, or much later are different
// donor behaviors and the point of this view is telling them apart.
const BUCKETS = [
  { key: 'same_day', label: 'Same day', maxDays: 1 },
  { key: 'within_week', label: 'Within a week', maxDays: 7 },
  { key: 'within_month', label: '1–4 weeks', maxDays: 28 },
  { key: 'within_quarter', label: '1–3 months', maxDays: 90 },
  { key: 'within_half_year', label: '3–6 months', maxDays: 182 },
  { key: 'beyond', label: 'Over 6 months', maxDays: Infinity },
]

function bucketKeyFor(days) {
  for (const b of BUCKETS) if (days <= b.maxDays) return b.key
  return 'beyond'
}

function median(sortedNums) {
  const n = sortedNums.length
  if (n === 0) return null
  const mid = Math.floor(n / 2)
  return n % 2 === 1 ? sortedNums[mid] : (sortedNums[mid - 1] + sortedNums[mid]) / 2
}

async function loadPayload() {
  const totalUsersRows = await sql`SELECT COUNT(*)::int AS n FROM users`
  const totalUsers = num(totalUsersRows[0] && totalUsersRows[0].n)

  const unlinkedRows = await sql`SELECT COUNT(*)::int AS n FROM donations WHERE user_id IS NULL`
  const unlinkedDonations = num(unlinkedRows[0] && unlinkedRows[0].n)

  // One row per donor: their signup date and the timestamp of their first
  // linked donation. A donor who gave more than once still counts once here
  // -- this is donor rate and time-to-first-donation, not a donation count.
  const firstDonationRows = await sql`
    SELECT u.created_at AS signed_up_at, MIN(d.occurred_at) AS first_donation_at
      FROM donations d
      JOIN users u ON u.id = d.user_id
     WHERE d.user_id IS NOT NULL
     GROUP BY u.id, u.created_at`

  const gapsInDays = firstDonationRows
    .map((r) => Math.max(0, (new Date(r.first_donation_at) - new Date(r.signed_up_at)) / 86400000))
    .sort((a, b) => a - b)

  const distribution = BUCKETS.map((b) => ({ bucket: b.key, label: b.label, count: 0 }))
  const byKey = distribution.reduce((m, b) => { m[b.bucket] = b; return m }, {})
  for (const days of gapsInDays) byKey[bucketKeyFor(days)].count++

  const donorsLinked = gapsInDays.length

  return {
    total_users: totalUsers,
    donors_linked: donorsLinked,
    donor_rate_pct: totalUsers > 0 ? (donorsLinked / totalUsers) * 100 : 0,
    unlinked_donations: unlinkedDonations,
    median_days_to_first_donation: median(gapsInDays),
    mean_days_to_first_donation: donorsLinked > 0
      ? gapsInDays.reduce((s, d) => s + d, 0) / donorsLinked
      : null,
    distribution,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (adminLoginEmailsMissing()) {
    console.error('admin/donations: ADMIN_LOGIN_EMAILS not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  if ((await checkAdminAuth(req, res)) !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    return res.status(200).json({ ok: true, ...(await loadPayload()) })
  } catch (err) {
    console.error('admin/donations: query failed', err && err.message)
    return res.status(500).json({ error: 'Query failed' })
  }
}
