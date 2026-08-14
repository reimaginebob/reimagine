// api/health-db.js
//
// Production DB-liveness probe. A monitor hits this on an interval; a non-200
// means the app cannot reach or authenticate to the database and should page
// someone. This is SEPARATE from api/health.js on purpose: health.js mirrors
// api/claude.js's import topology for the bundler smoke gate and must stay
// import-free, whereas this endpoint deliberately touches the DB. Do NOT add
// this route to scripts/smoke-preview.mjs — merge readiness should not depend on
// preview-DB availability.
//
// The response body is generic ({ ok } only); the real error is logged
// server-side so it shows up in Vercel runtime errors (the same place the
// 2026-08-14 credential outage was diagnosed) without exposing DB detail (host,
// user, auth failure text) to unauthenticated callers.
//
// This exists because the 2026-08-14 outage — a rotated Neon password with the
// running deployment still on the old credential — was invisible to /api/health
// (no DB) and /api/me (short-circuits before querying when there is no session).

import { sql } from './_lib/db.js'

export const config = { maxDuration: 10 }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const rows = await sql`SELECT 1 AS ok`
    if (rows && rows[0] && rows[0].ok === 1) {
      return res.status(200).json({ ok: true, db: true, ts: Date.now() })
    }
    console.error('health-db: unexpected result', rows)
    return res.status(503).json({ ok: false, db: false })
  } catch (err) {
    console.error('health-db: query failed', err && err.message)
    return res.status(503).json({ ok: false, db: false })
  }
}
