// Registration-to-donation funnel (2026-09-17 brief, part 2): what fraction
// of registered accounts ever give, and how long after they registered.
// Two numbers, not a dashboard of donor identities -- Bob explicitly does
// not want who gave or what they were doing on the site beforehand.
//
// No new capture. The donor-matching decision (PR #954, 2026-09-16 --
// migrations/2026-09-16_donations.sql) already ties a Stripe gift to
// `donations.reimagine_user_id`, and `users.created_at` already exists for
// every account. This is a query against data already sitting there.
//
// Deliberately a SEPARATE endpoint from api/admin/donations.js rather than
// an extra field on it: donations.js's job is the per-donor ledger (email,
// registered date, gift date, lifetime total) for verifying individual
// gifts against Stripe, and it is 'admin'-only for that reason. This one
// reports only the aggregate rate and a bucketed time-to-donate
// distribution -- no account-level detail anywhere in its output -- so it
// can be read with the same allowAnalyst access as api/admin/growth.js.
// Same live-computed, no-snapshot-table convention as donations.js.
//
// The one known data-quality issue carried over from the 2026-09-16 brief:
// a donor paying from an email that doesn't match their account email is
// unmatched today (reimagine_user_id NULL), which skews toward people
// searching quietly while employed. unmatched_donations is reported
// alongside the headline numbers rather than folded into them.

import { sql } from '../_lib/db.js'
import { checkAdminAuth, adminLoginEmailsMissing } from '../_lib/admin-auth.js'

const INTERNAL_EMAIL_SUFFIX = '%@career.club'

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// Bob's ask is the shape of the curve, not a single average -- these four
// buckets are the brief's own cut (same day / within a week / within a
// month / longer).
const GAP_BUCKETS = [
  { key: 'same_day', label: 'Same day', maxDays: 1 },
  { key: 'within_week', label: 'Within a week', maxDays: 7 },
  { key: 'within_month', label: 'Within a month', maxDays: 30 },
  { key: 'longer', label: 'Longer', maxDays: Infinity },
]

function bucketFor(days) {
  for (const b of GAP_BUCKETS) if (days <= b.maxDays) return b.key
  return GAP_BUCKETS[GAP_BUCKETS.length - 1].key
}

async function loadPayload() {
  const [{ total_users }] = await sql`
    SELECT COUNT(*)::int AS total_users
    FROM users
    WHERE lower(email) NOT LIKE ${INTERNAL_EMAIL_SUFFIX}
  `

  // One row per matched donor's first gift, gapped against registration.
  // reimagine_user_id IS NOT NULL excludes donations that never carried a
  // client_reference_id -- those are counted separately below as unmatched,
  // not silently dropped.
  const gapRows = await sql`
    WITH first_donation AS (
      SELECT reimagine_user_id, MIN(donated_at) AS first_donated_at
      FROM donations
      WHERE reimagine_user_id IS NOT NULL
      GROUP BY reimagine_user_id
    )
    SELECT GREATEST(0, EXTRACT(EPOCH FROM (fd.first_donated_at - u.created_at)))::float8 AS gap_seconds
    FROM first_donation fd
    JOIN users u ON u.id = fd.reimagine_user_id
    WHERE lower(u.email) NOT LIKE ${INTERNAL_EMAIL_SUFFIX}
  `

  const [{ unmatched_count }] = await sql`
    SELECT COUNT(*)::int AS unmatched_count
    FROM donations
    WHERE reimagine_user_id IS NULL
  `

  const histogram = Object.fromEntries(GAP_BUCKETS.map(b => [b.key, 0]))
  for (const row of gapRows) {
    histogram[bucketFor(num(row.gap_seconds) / 86400)]++
  }

  const donorCount = gapRows.length
  return {
    total_users: num(total_users),
    donor_count: donorCount,
    donation_rate: num(total_users) > 0 ? donorCount / num(total_users) : 0,
    time_to_donate: GAP_BUCKETS.map(b => ({ key: b.key, label: b.label, count: histogram[b.key] })),
    unmatched_donations: num(unmatched_count),
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (adminLoginEmailsMissing()) {
    console.error('admin/donation-funnel: ADMIN_LOGIN_EMAILS not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  // Read-only aggregate, no account-level detail; analyst access is enough.
  if (!(await checkAdminAuth(req, res, { allowAnalyst: true }))) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    return res.status(200).json({ ok: true, ...(await loadPayload()) })
  } catch (err) {
    console.error('admin/donation-funnel: query failed', err && err.message)
    return res.status(500).json({ error: 'Query failed' })
  }
}
