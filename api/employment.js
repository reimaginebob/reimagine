// Vercel serverless function: records one user's employment status into the
// users.employment_status column. Written by the app's own triggers (Orientation
// field, one-tap sign-in/Coach prompt) — all app-decided, never model-decided.
//
// - POST only.
// - Origin check against the Reimagine allowlist (same shape as api/pb-checkin.js).
// - Signed-in only; writes the caller's own row.
// - Body: { status: 'employed' | 'in_transition' | 'role_ending' }.
// - Plain UPDATE (updatable): status changes, and the change is usually the good
//   news. Stamps employment_status_updated_at every time.

import { sql } from './_lib/db.js'
import { getSessionUser } from './_lib/session.js'

const ALLOWED_HOSTS = new Set([
  'reimagine2-two.vercel.app',
  'reimagine.career.club',
  'localhost:5173',
  'localhost:3000',
])

function isAllowedOrigin(rawOrigin) {
  if (!rawOrigin) return false
  try {
    const u = new URL(rawOrigin)
    const hostWithPort = u.port ? `${u.hostname}:${u.port}` : u.hostname
    if (ALLOWED_HOSTS.has(u.hostname) || ALLOWED_HOSTS.has(hostWithPort)) return true
    if (u.hostname.endsWith('.vercel.app') && u.hostname.includes('reimagine')) return true
    return false
  } catch {
    return false
  }
}

const VALID_STATUSES = new Set(['employed', 'in_transition', 'role_ending'])

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const origin = req.headers.origin || req.headers.referer || ''
  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const body = req.body || {}
  const status = typeof body.status === 'string' ? body.status.trim() : ''
  if (!VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: 'status must be one of employed | in_transition | role_ending' })
  }

  let user
  try {
    user = await getSessionUser(req, res)
  } catch (err) {
    console.warn('employment: session lookup failed', err)
    user = null
  }
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    await sql`
      UPDATE users
      SET employment_status = ${status}, employment_status_updated_at = NOW()
      WHERE id = ${user.id}::uuid
    `
    return res.status(200).json({ ok: true, status })
  } catch (err) {
    console.error('employment: update failed', err)
    return res.status(500).json({ error: 'Could not record your status.' })
  }
}
