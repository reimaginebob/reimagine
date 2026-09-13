// Puts every registered Reimagine account into the "Reimagine — All Registered
// Users" Resend segment, ready to broadcast to.
//
//   POST /api/admin/reimagine-segment
//   { "dryRun": true, "limit": 200 }
//
// Auth: signed-in session + ADMIN_LOGIN_EMAILS (api/_lib/admin-auth.js).
// Admin-only -- it writes to the live contact list.
//
// Membership only; this sends nothing. New accounts join the segment at
// creation (api/auth/verify.js), so this is the initial backfill and the
// safety net for a missed signup, not the thing that keeps it current.
//
// Deliberately NOT api/admin/send-campaign.js's audience: that one drops anyone
// active in the last fortnight, which is right for win-back mail and wrong for
// an announcement. Deliberately NOT corner-segment.js's "General" segment,
// which is reserved for Corner people who have no account.
//
// Excluded: suspended accounts, and the operator ADMIN_EMAILS addresses (same
// exclusion send-campaign.js applies). Opt-outs are not filtered here — the
// contact keeps its unsubscribe status and Resend broadcasts skip it.
//
// Idempotent: people already in the segment are skipped, and adding a member
// twice is harmless, so a run that times out or is interrupted can simply be
// run again. The response reports what is left.

import { sql } from '../_lib/db.js'
import { checkAdminAuth, adminLoginEmailsMissing } from '../_lib/admin-auth.js'
import { normalizeEmail } from '../_lib/normalize-email.js'
import {
  ALL_USERS_SEGMENT_ID,
  addToAllUsersSegment,
  listSegmentContacts,
  parseAdminEmails,
} from '../_lib/resend-segments.js'

const DEFAULT_LIMIT = 200
const MAX_LIMIT = 500
// Stop starting new contacts with headroom left, so a slow or rate-limited run
// returns an honest "remaining" count instead of being killed mid-response.
const TIME_BUDGET_MS = 240_000

export const config = { maxDuration: 300 }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (adminLoginEmailsMissing()) {
    console.error('admin/reimagine-segment: ADMIN_LOGIN_EMAILS not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  // Read credentials must never reach a route that mutates the contact list.
  if ((await checkAdminAuth(req, res)) !== 'admin') return res.status(403).json({ error: 'Forbidden' })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('admin/reimagine-segment: RESEND_API_KEY not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  const startedAt = Date.now()
  const body = req.body || {}
  // Anything other than an explicit false is a dry run.
  const dryRun = body.dryRun !== false
  const rawLimit = Number(body.limit)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), MAX_LIMIT) : DEFAULT_LIMIT
  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS)

  try {
    const [userRows, [counts], targetExisting] = await Promise.all([
      sql`
        SELECT id, email, first_name, last_name
        FROM users
        WHERE suspended_at IS NULL
          AND LOWER(email) <> ALL(${adminEmails}::text[])
        ORDER BY created_at ASC`,
      sql`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE suspended_at IS NOT NULL)::int AS suspended,
               COUNT(*) FILTER (WHERE suspended_at IS NULL
                                  AND LOWER(email) = ANY(${adminEmails}::text[]))::int AS internal
        FROM users`,
      listSegmentContacts(apiKey, ALL_USERS_SEGMENT_ID),
    ])

    const alreadyInTarget = new Set(targetExisting.map(c => normalizeEmail(c.email)))
    const seen = new Set()
    const eligible = []
    let alreadyDone = 0
    let duplicateMailbox = 0

    for (const u of userRows) {
      const key = normalizeEmail(u.email)
      if (alreadyInTarget.has(key)) { alreadyDone++; continue }
      // Two accounts on the same inbox (a Gmail dot or +tag variant) would get
      // the broadcast twice.
      if (seen.has(key)) { duplicateMailbox++; continue }
      seen.add(key)
      eligible.push(u)
    }

    const batch = eligible.slice(0, limit)

    if (dryRun) {
      return res.status(200).json({
        ok: true,
        dry_run: true,
        total_accounts: counts.total,
        excluded_suspended: counts.suspended,
        excluded_internal: counts.internal,
        eligible_accounts: userRows.length,
        already_in_segment: alreadyDone,
        skipped_duplicate_mailbox: duplicateMailbox,
        eligible_total: eligible.length,
        would_add_now: batch.length,
        remaining_after_this_run: Math.max(0, eligible.length - batch.length),
        segment_contacts_now: targetExisting.length,
        target_segment_id: ALL_USERS_SEGMENT_ID,
        sample: batch.slice(0, 10).map(u => u.email),
      })
    }

    const added = []
    const failed = []
    let attempted = 0
    for (const u of batch) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break
      attempted++
      try {
        await addToAllUsersSegment(apiKey, { email: u.email, firstName: u.first_name, lastName: u.last_name })
        added.push(u.email)
      } catch (err) {
        failed.push({ email: u.email, error: String(err && err.message).slice(0, 200) })
      }
    }

    const remaining = Math.max(0, eligible.length - attempted)
    console.log('admin/reimagine-segment', { added: added.length, failed: failed.length, remaining })
    return res.status(200).json({
      ok: true,
      dry_run: false,
      added: added.length,
      failed: failed.length,
      remaining,
      stopped_for_time: attempted < batch.length,
      target_segment_id: ALL_USERS_SEGMENT_ID,
      failures: failed.slice(0, 20),
    })
  } catch (err) {
    console.error('admin/reimagine-segment: failed', err && err.message)
    return res.status(500).json({ error: 'Failed', detail: String(err && err.message).slice(0, 200) })
  }
}
