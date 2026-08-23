// Works out which Career Club Corner registrants do NOT have a Reimagine
// account, and puts them into a segment ready to broadcast to.
//
//   POST /api/admin/corner-segment
//   { "dryRun": true, "limit": 200 }
//
// Auth: ADMIN_TOKEN only. It writes to the live contact list.
//
// Why this exists: the Corner campaign is "try Reimagine", and sending it to
// somebody who already uses Reimagine is the single most obvious way to look
// like you do not know your own customers. Bob's rule from 2026-08-22 is that
// having an account excludes you by definition — no dedupe pass, no judgement.
//
// Why a segment rather than the app sending it: 969 recipients, one message,
// nobody needing personalisation. Resend broadcasts handle batching and
// throttling; writing that for a single send would be work for its own sake.
// The stage-tailored campaign is the opposite case and the app sends that one.
//
// Matching is on the NORMALISED address (api/_lib/normalize-email.js), so a
// Corner registrant who signed up to Reimagine with the same Gmail written
// differently — a dot, a +tag — is correctly recognised as an existing user and
// excluded. Matching raw strings would leak those people into the campaign.
//
// Idempotent: adding a contact already in the segment is harmless, so a run that
// times out or gets interrupted can simply be run again. Large lists are capped
// per run and the response reports what is left.

import { sql } from '../_lib/db.js'
import { checkAdminAuth, adminTokenMissing } from '../_lib/admin-auth.js'
import { normalizeEmail } from '../_lib/normalize-email.js'

// Resend segment ids. Not secrets — account configuration.
const CORNER_SEGMENT_ID = 'b064d947-e4ae-4a08-ac99-1155a9d45e31' // "Corner Registrants"
// The destination. Currently named "General" and empty; the plan allows only
// three segments so this is the spare. Rename it in the Resend dashboard once
// populated, or somebody will broadcast to it thinking it means something else.
const TARGET_SEGMENT_ID = '29138278-5ee9-4c27-821b-64a3581a297a'

const DEFAULT_LIMIT = 200
const MAX_LIMIT = 500
const PAGE_SIZE = 100

// A serverless function will not page through a thousand contacts and write
// several hundred segment memberships inside a default timeout.
export const config = { maxDuration: 300 }

async function listSegmentContacts(apiKey, segmentId) {
  const out = []
  let after = null
  // Bounded rather than while(true): a paging bug that never terminates would
  // burn the function's whole budget and rate-limit the account.
  for (let page = 0; page < 50; page++) {
    const url = new URL(`https://api.resend.com/segments/${segmentId}/contacts`)
    url.searchParams.set('limit', String(PAGE_SIZE))
    if (after) url.searchParams.set('after', after)
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
    if (!resp.ok) {
      const body = await resp.text().catch(() => '')
      throw new Error(`segment contacts ${resp.status} ${body.slice(0, 200)}`)
    }
    const json = await resp.json()
    const data = Array.isArray(json.data) ? json.data : []
    out.push(...data)
    if (!json.has_more || data.length === 0) break
    after = data[data.length - 1].id
  }
  return out
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (adminTokenMissing()) {
    console.error('admin/corner-segment: ADMIN_TOKEN not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  // Read credentials must never reach a route that mutates the contact list.
  if (checkAdminAuth(req) !== 'admin') return res.status(403).json({ error: 'Forbidden' })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('admin/corner-segment: RESEND_API_KEY not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  const body = req.body || {}
  // Anything other than an explicit false is a dry run.
  const dryRun = body.dryRun !== false
  const rawLimit = Number(body.limit)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), MAX_LIMIT) : DEFAULT_LIMIT

  try {
    const [corner, userRows, targetExisting] = await Promise.all([
      listSegmentContacts(apiKey, CORNER_SEGMENT_ID),
      sql`SELECT email FROM users`,
      listSegmentContacts(apiKey, TARGET_SEGMENT_ID),
    ])

    const userKeys = new Set(userRows.map(r => normalizeEmail(r.email)))
    const alreadyInTarget = new Set(targetExisting.map(c => normalizeEmail(c.email)))

    const eligible = []
    let excludedHasAccount = 0
    let excludedUnsubscribed = 0
    let alreadyDone = 0

    for (const c of corner) {
      const key = normalizeEmail(c.email)
      if (userKeys.has(key)) { excludedHasAccount++; continue }
      // No point adding somebody who has opted out; the broadcast would skip
      // them anyway and the segment would misrepresent its own reach.
      if (c.unsubscribed) { excludedUnsubscribed++; continue }
      if (alreadyInTarget.has(key)) { alreadyDone++; continue }
      eligible.push({ id: c.id, email: c.email })
    }

    const batch = eligible.slice(0, limit)

    if (dryRun) {
      return res.status(200).json({
        ok: true,
        dry_run: true,
        corner_contacts: corner.length,
        reimagine_accounts: userRows.length,
        excluded_has_account: excludedHasAccount,
        excluded_unsubscribed: excludedUnsubscribed,
        already_in_target: alreadyDone,
        eligible_total: eligible.length,
        would_add_now: batch.length,
        remaining_after_this_run: Math.max(0, eligible.length - batch.length),
        target_segment_id: TARGET_SEGMENT_ID,
        target_segment_note: 'Currently named "General" in Resend. Rename it once populated so nobody broadcasts to it by mistake.',
        sample: batch.slice(0, 10).map(c => c.email),
      })
    }

    const added = []
    const failed = []
    for (const c of batch) {
      try {
        const resp = await fetch(
          `https://api.resend.com/contacts/${encodeURIComponent(c.id)}/segments/${TARGET_SEGMENT_ID}`,
          { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` } },
        )
        if (!resp.ok) {
          const t = await resp.text().catch(() => '')
          throw new Error(`${resp.status} ${t.slice(0, 160)}`)
        }
        added.push(c.email)
      } catch (err) {
        failed.push({ email: c.email, error: String(err && err.message).slice(0, 200) })
      }
    }

    console.log('admin/corner-segment', { added: added.length, failed: failed.length, remaining: eligible.length - batch.length })
    return res.status(200).json({
      ok: true,
      dry_run: false,
      added: added.length,
      failed: failed.length,
      remaining: Math.max(0, eligible.length - batch.length),
      target_segment_id: TARGET_SEGMENT_ID,
      failures: failed.slice(0, 20),
    })
  } catch (err) {
    console.error('admin/corner-segment: failed', err && err.message)
    return res.status(500).json({ error: 'Failed', detail: String(err && err.message).slice(0, 200) })
  }
}
