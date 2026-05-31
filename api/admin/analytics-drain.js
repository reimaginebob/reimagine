// Receives the Vercel Web Analytics Data Drain stream for the Reimagine
// project. Configured at Vercel dashboard -> Project -> Settings -> Data
// Drains -> Add Drain (type: Web Analytics, delivery: HTTP, endpoint: this
// URL, signing secret stored in VERCEL_DRAIN_SECRET).
//
// What this endpoint does:
//   1. Verifies the HMAC-SHA1 signature against the raw request body using
//      VERCEL_DRAIN_SECRET. Mismatch returns 403 with Vercel's expected error
//      shape so the drain dashboard surfaces a useful error.
//   2. Parses the payload. Vercel sends one of:
//        - JSON array of event objects (default for the "JSON" delivery
//          encoding)
//        - NDJSON (one JSON object per line, no trailing comma)
//        - A single JSON object (edge case observed when a drain delivers
//          exactly one event)
//      All three shapes are tolerated.
//   3. Validates each event row has the minimum required fields (schema,
//      eventType, timestamp). Rows missing any of these are dropped (counted
//      in the response as `dropped`) so a single malformed row does not fail
//      a whole batch and trigger a Vercel retry.
//   4. Bulk-inserts the valid rows into analytics_events in one round trip
//      using UNNEST of parallel arrays. The read endpoint at api/admin/
//      analytics.js queries this table for the funnel and quality-signals
//      panels of the Reimagine Daily Cowork artifact.
//
// Why getRawBody and not req.body:
//   @vercel/node parses req.body via a lazy getter; the first reference to
//   req.body consumes the request stream. We need the raw bytes to compute
//   the HMAC signature, so this handler MUST NOT touch req.body anywhere.
//   The Next.js Pages-router `export const config = { api: { bodyParser:
//   false } }` pattern does not apply to the bare-handler / @vercel/node
//   runtime this repo uses; simply not referencing req.body is the supported
//   mechanism. See the pre-implementation Code consult of 2026-05-30 for
//   the full investigation.
//
// Failure-mode contract:
//   - Missing VERCEL_DRAIN_SECRET env var               -> 500 { error: 'Server misconfigured' }
//   - Method other than POST                            -> 405 { error: 'Method not allowed' }
//   - Body read failure                                 -> 400 { error: 'Could not read body' }
//   - Signature missing or mismatched                   -> 403 { code: 'invalid_signature', error: "signature didn't match" }
//   - Unparseable body                                  -> 400 { error: 'Could not parse body' }
//   - Database insert failure                           -> 500 { error: 'Insert failed' }  (Vercel will retry per its drain retry policy)
//   - Success                                           -> 200 { ok: true, ingested: N, dropped: M }

import crypto from 'crypto'
import getRawBody from 'raw-body'
import { sql } from '../_lib/db.js'

const MAX_BODY_BYTES = 10 * 1024 * 1024 // 10 MB cap; Vercel drain batches are well below this.

function parsePayload(rawBody) {
  // Try JSON first (covers both single-object and array deliveries).
  const text = rawBody.toString('utf8').trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed
    if (parsed && typeof parsed === 'object') return [parsed]
  } catch {
    // Fall through to NDJSON.
  }
  // NDJSON fallback. Split on newlines; ignore blanks; JSON.parse each line.
  // Lines that fail to parse are dropped silently here; the caller's row
  // validation will not see them.
  const out = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const obj = JSON.parse(trimmed)
      if (obj && typeof obj === 'object') out.push(obj)
    } catch {
      // skip
    }
  }
  return out
}

function asBigIntOrNull(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
  if (typeof v === 'string' && /^-?\d+$/.test(v)) return v
  return null
}

function asTextOrNull(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v
  return String(v)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.VERCEL_DRAIN_SECRET
  if (!secret) {
    console.error('analytics-drain: VERCEL_DRAIN_SECRET not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  // Read the raw request stream. Never touch req.body in this handler; see
  // the file-level comment for the @vercel/node body-parser caveat.
  let rawBody
  try {
    rawBody = await getRawBody(req, { limit: MAX_BODY_BYTES })
  } catch (err) {
    console.error('analytics-drain: getRawBody failed', err && err.message)
    return res.status(400).json({ error: 'Could not read body' })
  }

  // HMAC-SHA1 signature check. Use timingSafeEqual after a length guard,
  // because timingSafeEqual throws on length mismatch.
  const expected = crypto.createHmac('sha1', secret).update(rawBody).digest('hex')
  const provided = req.headers['x-vercel-signature'] || ''
  if (typeof provided !== 'string' || provided.length !== expected.length) {
    return res.status(403).json({ code: 'invalid_signature', error: "signature didn't match" })
  }
  let signatureOk = false
  try {
    signatureOk = crypto.timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'))
  } catch {
    signatureOk = false
  }
  if (!signatureOk) {
    return res.status(403).json({ code: 'invalid_signature', error: "signature didn't match" })
  }

  // Parse the payload into an array of candidate event objects.
  let events
  try {
    events = parsePayload(rawBody)
  } catch (err) {
    console.error('analytics-drain: parse failed', err && err.message)
    return res.status(400).json({ error: 'Could not parse body' })
  }

  if (events.length === 0) {
    // A zero-event drain delivery is legal (e.g., a test ping). Return 200
    // so Vercel marks the drain healthy.
    return res.status(200).json({ ok: true, ingested: 0, dropped: 0 })
  }

  // Validate each event has the minimum required fields. Drop the row
  // (not the batch) if any are missing.
  const rows = []
  let dropped = 0
  for (const e of events) {
    if (!e || typeof e !== 'object') {
      dropped++
      continue
    }
    const schema = asTextOrNull(e.schema)
    const eventType = asTextOrNull(e.eventType ?? e.type)
    const timestamp = asBigIntOrNull(e.timestamp)
    if (!schema || !eventType || timestamp === null) {
      dropped++
      continue
    }
    rows.push({
      schema,
      eventType,
      eventName: asTextOrNull(e.eventName ?? e.name),
      eventData: (e.eventData !== undefined ? e.eventData : (e.data !== undefined ? e.data : null)),
      timestamp,
      projectId: asTextOrNull(e.projectId ?? e.project_id),
      ownerId: asTextOrNull(e.ownerId ?? e.owner_id),
      sessionId: asBigIntOrNull(e.sessionId ?? e.session_id),
      deviceId: asBigIntOrNull(e.deviceId ?? e.device_id),
      origin: asTextOrNull(e.origin),
      path: asTextOrNull(e.path),
    })
  }

  if (rows.length === 0) {
    return res.status(200).json({ ok: true, ingested: 0, dropped })
  }

  // Bulk insert via UNNEST of parallel arrays. One SQL statement, one HTTP
  // round trip, all parameters bound. The ::jsonb[] cast on a text[] of
  // JSON strings parses each element into a JSONB value.
  const schemas      = rows.map(r => r.schema)
  const eventTypes   = rows.map(r => r.eventType)
  const eventNames   = rows.map(r => r.eventName)
  const eventDatas   = rows.map(r => r.eventData == null ? null : JSON.stringify(r.eventData))
  const timestamps   = rows.map(r => r.timestamp)
  const projectIds   = rows.map(r => r.projectId)
  const ownerIds     = rows.map(r => r.ownerId)
  const sessionIds   = rows.map(r => r.sessionId)
  const deviceIds    = rows.map(r => r.deviceId)
  const origins      = rows.map(r => r.origin)
  const paths        = rows.map(r => r.path)

  try {
    await sql`
      INSERT INTO analytics_events
        (schema, event_type, event_name, event_data, "timestamp",
         project_id, owner_id, session_id, device_id, origin, path)
      SELECT * FROM UNNEST(
        ${schemas}::text[],
        ${eventTypes}::text[],
        ${eventNames}::text[],
        ${eventDatas}::jsonb[],
        ${timestamps}::bigint[],
        ${projectIds}::text[],
        ${ownerIds}::text[],
        ${sessionIds}::bigint[],
        ${deviceIds}::bigint[],
        ${origins}::text[],
        ${paths}::text[]
      )
    `
  } catch (err) {
    console.error('analytics-drain: insert failed', err && err.message, { rowCount: rows.length })
    return res.status(500).json({ error: 'Insert failed' })
  }

  console.log('analytics-drain: ingested', { ingested: rows.length, dropped })
  return res.status(200).json({ ok: true, ingested: rows.length, dropped })
}
