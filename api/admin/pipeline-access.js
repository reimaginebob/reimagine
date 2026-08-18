// Admin control to grant / revoke My Pipeline (the `my_search` flag) for an
// existing user, by email. In the test-user phase everyone invited is already a
// registered user, so this is a direct row update — no signup timing to track.
//
// Auth: Bearer ADMIN_TOKEN (same token as the analytics dashboard, which calls
// this). GET lists current testers; POST { email, action: 'grant'|'revoke' }.

import { sql } from '../_lib/db.js'

const FLAG = 'my_search'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const expected = process.env.ADMIN_TOKEN
  if (!expected) {
    console.error('admin/pipeline-access: ADMIN_TOKEN not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  if ((req.headers.authorization || '') !== `Bearer ${expected}`) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT email FROM users WHERE ${FLAG} = ANY(feature_flags) ORDER BY lower(email)`
      return res.status(200).json({ testers: rows.map(r => r.email) })
    }

    const body = req.body || {}
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const action = typeof body.action === 'string' ? body.action.trim() : ''
    if (!email) return res.status(400).json({ error: 'email required' })
    if (action !== 'grant' && action !== 'revoke') {
      return res.status(400).json({ error: "action must be 'grant' or 'revoke'" })
    }

    const rows = action === 'grant'
      ? await sql`
          UPDATE users
          SET feature_flags = CASE WHEN ${FLAG} = ANY(feature_flags) THEN feature_flags ELSE array_append(feature_flags, ${FLAG}) END
          WHERE lower(email) = lower(${email})
          RETURNING email, (${FLAG} = ANY(feature_flags)) AS enabled`
      : await sql`
          UPDATE users
          SET feature_flags = array_remove(feature_flags, ${FLAG})
          WHERE lower(email) = lower(${email})
          RETURNING email, (${FLAG} = ANY(feature_flags)) AS enabled`
    if (rows.length === 0) return res.status(404).json({ error: 'No account with that email' })
    console.log('admin/pipeline-access', { email, action, enabled: rows[0].enabled })
    return res.status(200).json({ ok: true, email: rows[0].email, enabled: !!rows[0].enabled })
  } catch (err) {
    console.error('admin/pipeline-access: query failed', err && err.message)
    return res.status(500).json({ error: 'Update failed' })
  }
}
