// Splits the "Corner — Never Registered for Reimagine (auto)" segment (the
// master 886-contact list, kept current by api/admin/corner-segment.js) into
// nine roughly-equal tranche segments for a staged send warm-up on a cold
// sending domain.
//
//   POST /api/admin/corner-segment-split
//   { "dryRun": true }
//
// Auth: signed-in session + ADMIN_LOGIN_EMAILS (api/_lib/admin-auth.js).
// Admin-only -- it creates segments and writes contact-segment membership.
//
// Why nine tranche segments rather than one send: Resend broadcasts send to
// a whole segment, and there is no way to target "N random contacts from
// segment X" in a single send. Getting real per-tranche metrics (the same
// pattern already used for the My Coach send, where each send is its own
// broadcast with a distinct broadcast ID) requires each tranche to be its
// own segment, sent as its own broadcast.
//
// Assignment is deterministic: contacts are stable-sorted by normalised
// email, then sliced into ninths. Rerunning against the same source
// membership reproduces the same split, and Resend's add-to-segment call is
// a no-op if the contact is already there (same idempotency property as
// corner-segment.js), so a rerun neither reassigns nor duplicates anyone.
// This is only safe to run once the source segment has stopped growing --
// splitting a still-growing list would reshuffle every tranche's membership
// on the next rerun, because the sort covers a different total each time.
//
// Tranche segments are created fresh in Resend the first time this runs and
// matched by exact name (reused, never duplicated) on any rerun.

import { checkAdminAuth, adminLoginEmailsMissing } from '../_lib/admin-auth.js'
import { normalizeEmail } from '../_lib/normalize-email.js'

// The master "never registered" segment. api/admin/corner-segment.js keeps
// this current. Not a secret -- account configuration.
const SOURCE_SEGMENT_ID = '29138278-5ee9-4c27-821b-64a3581a297a'

const TRANCHE_COUNT = 9
const trancheName = n => `Corner Nudge — Tranche ${n}`

const PAGE_SIZE = 100

// Resend's ceiling is 10 req/sec. Applied between every Resend call this
// endpoint makes -- page fetches, segment creation, and per-contact
// assignment -- same fix as corner-segment.js (PR #949).
const RESEND_DELAY_MS = 200

// A serverless function will not page through ~900 contacts, list/create up
// to nine segments, and write ~900 segment memberships inside a default
// timeout.
export const config = { maxDuration: 300 }

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function resendRequest(apiKey, url, { method = 'GET', body, parseJson = true } = {}) {
  const options = {
    method,
    headers: { Authorization: `Bearer ${apiKey}` },
  }
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }
  // One retry on a 429: self-healing if a run ever gets close to the
  // ceiling, without masking a sustained rate-limit problem behind repeated
  // retries.
  for (let attempt = 0; attempt < 2; attempt++) {
    const resp = await fetch(url, options)
    if (resp.ok) return parseJson ? resp.json() : null
    if (resp.status === 429 && attempt === 0) {
      await sleep(1000)
      continue
    }
    const text = await resp.text().catch(() => '')
    throw new Error(`${method} ${url.pathname} ${resp.status} ${text.slice(0, 200)}`)
  }
}

async function listSegmentContacts(apiKey, segmentId) {
  const out = []
  let after = null
  // Bounded rather than while(true): a paging bug that never terminates
  // would burn the function's whole budget and rate-limit the account.
  for (let page = 0; page < 50; page++) {
    if (page > 0) await sleep(RESEND_DELAY_MS)
    const url = new URL(`https://api.resend.com/segments/${segmentId}/contacts`)
    url.searchParams.set('limit', String(PAGE_SIZE))
    if (after) url.searchParams.set('after', after)
    const json = await resendRequest(apiKey, url)
    const data = Array.isArray(json.data) ? json.data : []
    out.push(...data)
    if (!json.has_more || data.length === 0) break
    after = data[data.length - 1].id
  }
  return out
}

async function listAllSegments(apiKey) {
  const out = []
  let after = null
  for (let page = 0; page < 10; page++) {
    if (page > 0) await sleep(RESEND_DELAY_MS)
    const url = new URL('https://api.resend.com/segments')
    url.searchParams.set('limit', '100')
    if (after) url.searchParams.set('after', after)
    const json = await resendRequest(apiKey, url)
    const data = Array.isArray(json.data) ? json.data : []
    out.push(...data)
    if (!json.has_more || data.length === 0) break
    after = data[data.length - 1].id
  }
  return out
}

// Contiguous ninths, as equal as Math.floor allows -- e.g. 886 contacts
// becomes four tranches of 99 and five of 98, not nine of ~98.4.
function splitIntoTranches(sortedContacts, count) {
  const base = Math.floor(sortedContacts.length / count)
  const remainder = sortedContacts.length % count
  const tranches = []
  let cursor = 0
  for (let n = 1; n <= count; n++) {
    const size = base + (n <= remainder ? 1 : 0)
    tranches.push({ n, contacts: sortedContacts.slice(cursor, cursor + size) })
    cursor += size
  }
  return tranches
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (adminLoginEmailsMissing()) {
    console.error('admin/corner-segment-split: ADMIN_LOGIN_EMAILS not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  // Read credentials must never reach a route that mutates the contact list.
  if ((await checkAdminAuth(req, res)) !== 'admin') return res.status(403).json({ error: 'Forbidden' })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('admin/corner-segment-split: RESEND_API_KEY not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  const body = req.body || {}
  // Anything other than an explicit false is a dry run.
  const dryRun = body.dryRun !== false

  try {
    const [contacts, existingSegments] = await (async () => {
      // Sequential, not Promise.all: both hit the same Resend rate limit
      // (PR #949).
      const c = await listSegmentContacts(apiKey, SOURCE_SEGMENT_ID)
      const s = await listAllSegments(apiKey)
      return [c, s]
    })()

    const sorted = [...contacts].sort((a, b) =>
      normalizeEmail(a.email).localeCompare(normalizeEmail(b.email)),
    )
    const existingByName = new Map(existingSegments.map(s => [s.name, s.id]))
    const tranches = splitIntoTranches(sorted, TRANCHE_COUNT).map(t => ({
      ...t,
      name: trancheName(t.n),
      segmentId: existingByName.get(trancheName(t.n)) || null,
    }))

    if (dryRun) {
      return res.status(200).json({
        ok: true,
        dry_run: true,
        source_segment_id: SOURCE_SEGMENT_ID,
        source_contacts: sorted.length,
        tranches: tranches.map(t => ({
          tranche: t.n,
          name: t.name,
          segment_id: t.segmentId,
          would_create: !t.segmentId,
          contact_count: t.contacts.length,
          sample: t.contacts.slice(0, 3).map(c => c.email),
        })),
      })
    }

    const results = []
    for (const t of tranches) {
      let segmentId = t.segmentId
      if (!segmentId) {
        await sleep(RESEND_DELAY_MS)
        const url = new URL('https://api.resend.com/segments')
        const created = await resendRequest(apiKey, url, { method: 'POST', body: { name: t.name } })
        segmentId = created.id
      }

      let added = 0
      const failures = []
      for (const c of t.contacts) {
        await sleep(RESEND_DELAY_MS)
        try {
          const url = new URL(`https://api.resend.com/contacts/${encodeURIComponent(c.id)}/segments/${segmentId}`)
          await resendRequest(apiKey, url, { method: 'POST', parseJson: false })
          added++
        } catch (err) {
          failures.push({ email: c.email, error: String(err && err.message).slice(0, 200) })
        }
      }

      console.log('admin/corner-segment-split', { tranche: t.n, segment_id: segmentId, added, failed: failures.length })
      results.push({
        tranche: t.n,
        name: t.name,
        segment_id: segmentId,
        contact_count: t.contacts.length,
        added,
        failed: failures.length,
        failures: failures.slice(0, 10),
      })
    }

    return res.status(200).json({
      ok: true,
      dry_run: false,
      source_segment_id: SOURCE_SEGMENT_ID,
      source_contacts: sorted.length,
      tranches: results,
    })
  } catch (err) {
    console.error('admin/corner-segment-split: failed', err && err.message)
    return res.status(500).json({ error: 'Failed', detail: String(err && err.message).slice(0, 200) })
  }
}
