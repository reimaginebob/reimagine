// Browser endpoint for the "found by your assistant" interview-team suggestions.
// The connector stages interviewers into pursuit_interviewers (via api/mcp.js);
// this serves them to the app and deletes one when the user adopts or dismisses.
//
// - GET  -> list the caller's staged interviewers (all opportunities).
// - POST { interviewerId } -> delete that staged row (adopted or dismissed).
//
// Browser-only (cookie session + origin allowlist), my_search-gated.

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

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const origin = req.headers.origin || req.headers.referer || ''
  if (!isAllowedOrigin(origin)) return res.status(403).json({ error: 'Forbidden' })

  let user
  try {
    user = await getSessionUser(req, res)
  } catch (err) {
    console.warn('pursuit-interviewers: session lookup failed', err)
    user = null
  }
  if (!user || !user.id) return res.status(401).json({ error: 'Not authenticated' })
  if (user.suspended_at) return res.status(403).json({ error: 'account_suspended' })
  const flags = Array.isArray(user.feature_flags) ? user.feature_flags : []
  if (!flags.includes('my_search')) return res.status(403).json({ error: 'Not enabled' })

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT interviewer_id, record_id, name, title, notes, role
        FROM pursuit_interviewers
        WHERE user_id = ${user.id}::uuid
        ORDER BY created_at ASC`
      return res.status(200).json({ rows })
    }

    // POST -> delete one staged interviewer (adopted or dismissed).
    const body = req.body || {}
    const interviewerId = typeof body.interviewerId === 'string' ? body.interviewerId.trim() : ''
    if (!interviewerId) return res.status(400).json({ error: 'interviewerId required' })
    await sql`DELETE FROM pursuit_interviewers WHERE user_id = ${user.id}::uuid AND interviewer_id = ${interviewerId}`
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('pursuit-interviewers: query failed', err)
    return res.status(500).json({ error: 'Could not load suggestions.' })
  }
}
