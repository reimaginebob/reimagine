// Read-only view of direct Career Club donations for the "Direct donations
// (Stripe)" block of the Economics tab (/admin/dashboard). Deliberately a
// separate endpoint from api/admin/economics.js -- donations (career.club
// Stripe account, acct_1IQLNEK4uJoqzRSd) are a different revenue stream from
// NextPlacement and the paying-customer economics numbers (users.paying_since,
// economics_inputs), and CLAUDE.md's "never blend two measurements into one
// number" rule applies here the same as everywhere else.
// See Output/handoff/2026-09-16_direct-donation-tracking.md.
//
// Data comes from the `donations` table (migrations/2026-09-16_donations.sql),
// written by api/webhooks/stripe.js as Stripe events arrive. Nothing here
// calls Stripe directly, and there is no snapshot table -- computed live on
// each request, same as economics.js.
//
// Auth: same as economics.js (api/_lib/admin-auth.js).

import { sql } from '../_lib/db.js'
import { checkAdminAuth, adminLoginEmailsMissing } from '../_lib/admin-auth.js'

// Same exclusion economics.js applies to paying_customers: internal
// accounts are staff testing, not the population these numbers describe.
// Bob's own test donation (Sept 15, $20) would otherwise sit in the donor
// list and skew the rate on a base of 145 accounts.
const INTERNAL_EMAIL_SUFFIX = '%@career.club'

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// Fixed day-ranges for the registration-to-first-donation distribution.
// Bob's ask is to see whether donations cluster right after signup, much
// later, or spread evenly -- buckets answer that at a glance without a
// scatterplot for what is still a small-N chart at this scale.
const GAP_BUCKETS = [
  { key: 'same_day', label: 'Same day', maxDays: 1 },
  { key: 'within_week', label: '1–7 days', maxDays: 7 },
  { key: 'within_month', label: '8–30 days', maxDays: 30 },
  { key: 'within_quarter', label: '31–90 days', maxDays: 90 },
  { key: 'within_year', label: '91–365 days', maxDays: 365 },
  { key: 'over_year', label: 'Over a year', maxDays: Infinity },
]

function bucketFor(days) {
  for (const b of GAP_BUCKETS) if (days <= b.maxDays) return b.key
  return GAP_BUCKETS[GAP_BUCKETS.length - 1].key
}

function medianOf(nums) {
  if (!nums.length) return null
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  const v = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
  return Math.round(v * 10) / 10
}

async function loadPayload() {
  const [{ total_users }] = await sql`
    SELECT COUNT(*)::int AS total_users
    FROM users
    WHERE lower(email) NOT LIKE ${INTERNAL_EMAIL_SUFFIX}
  `

  // One row per donor: their first donation, joined back to registration.
  // reimagine_user_id IS NOT NULL excludes donations that never carried a
  // client_reference_id (predate this tracking, or the donor was signed
  // out) -- those are surfaced separately below, not silently dropped.
  const donorRows = await sql`
    WITH first_donation AS (
      SELECT reimagine_user_id,
             MIN(donated_at)           AS first_donated_at,
             SUM(amount_cents)::bigint AS lifetime_cents,
             COUNT(*)::int             AS donation_count
      FROM donations
      WHERE reimagine_user_id IS NOT NULL
      GROUP BY reimagine_user_id
    )
    SELECT u.email, u.created_at, fd.first_donated_at, fd.lifetime_cents, fd.donation_count,
           GREATEST(0, EXTRACT(EPOCH FROM (fd.first_donated_at - u.created_at)))::float8 AS gap_seconds
    FROM first_donation fd
    JOIN users u ON u.id = fd.reimagine_user_id
    WHERE lower(u.email) NOT LIKE ${INTERNAL_EMAIL_SUFFIX}
    ORDER BY fd.first_donated_at DESC
  `

  const [{ unattributed_count, unattributed_cents }] = await sql`
    SELECT COUNT(*)::int AS unattributed_count,
           COALESCE(SUM(amount_cents), 0)::bigint AS unattributed_cents
    FROM donations
    WHERE reimagine_user_id IS NULL
  `

  const histogram = Object.fromEntries(GAP_BUCKETS.map(b => [b.key, 0]))
  const gapDaysList = []
  const donors = donorRows.map(d => {
    const gapDays = Math.round((num(d.gap_seconds) / 86400) * 10) / 10
    histogram[bucketFor(gapDays)]++
    gapDaysList.push(gapDays)
    return {
      email: d.email,
      registered_at: d.created_at,
      first_donated_at: d.first_donated_at,
      gap_days: gapDays,
      lifetime_cents: num(d.lifetime_cents),
      donation_count: num(d.donation_count),
    }
  })

  const donorCount = donors.length
  const avgGapDays = donorCount > 0
    ? Math.round((gapDaysList.reduce((a, b) => a + b, 0) / donorCount) * 10) / 10
    : null

  return {
    total_users: num(total_users),
    donor_count: donorCount,
    donor_rate: num(total_users) > 0 ? donorCount / num(total_users) : 0,
    avg_gap_days: avgGapDays,
    median_gap_days: medianOf(gapDaysList),
    gap_buckets: GAP_BUCKETS.map(b => ({ key: b.key, label: b.label, count: histogram[b.key] })),
    donors,
    unattributed: { count: num(unattributed_count), cents: num(unattributed_cents) },
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
