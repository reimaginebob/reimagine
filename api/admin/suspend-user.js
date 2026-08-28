// Admin control to pause / unpause a user account (rogue-activity safeguard).
// A pause is a reversible hold: enforcement lives in getSessionUser/requireAuth
// and the coach/claude endpoints (they reject when users.suspended_at is set).
// This endpoint just flips the flag.
//
// Auth: Bearer ADMIN_TOKEN (same token as the analytics dashboard, which is what
// calls this). POST only. Body: { email: string, action: 'pause' | 'unpause',
// reason?: string }. Idempotent.

import { sql } from '../_lib/db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const expected = process.env.ADMIN_TOKEN
  if (!expected) {
    console.error('admin/suspend-user: ADMIN_TOKEN not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  if ((req.headers.authorization || '') !== `Bearer ${expected}`) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const body = req.body || {}
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const action = typeof body.action === 'string' ? body.action.trim() : ''
  if (!email) return res.status(400).json({ error: 'email required' })
  if (action !== 'pause' && action !== 'unpause') {
    return res.status(400).json({ error: "action must be 'pause' or 'unpause'" })
  }
  const reason = (typeof body.reason === 'string' && body.reason.trim())
    ? body.reason.trim().slice(0, 200)
    : 'manual'

  try {
    const rows = action === 'pause'
      ? await sql`
          UPDATE users
          SET suspended_at = NOW(), suspended_reason = ${reason},
              hold_count = hold_count + 1, last_hold_at = NOW(), last_hold_reason = ${reason}
          WHERE lower(email) = lower(${email})
          RETURNING email, suspended_at`
      : await sql`
          UPDATE users
          SET suspended_at = NULL, suspended_reason = NULL
          WHERE lower(email) = lower(${email})
          RETURNING email, suspended_at`
    if (rows.length === 0) return res.status(404).json({ error: 'No account with that email' })
    const suspended = !!rows[0].suspended_at
    console.log('admin/suspend-user', { email, action, suspended })
    return res.status(200).json({ ok: true, email: rows[0].email, suspended })
  } catch (err) {
    console.error('admin/suspend-user: update failed', err && err.message)
    return res.status(500).json({ error: 'Update failed' })
  }
}
