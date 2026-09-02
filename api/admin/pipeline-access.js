// Admin control to grant / revoke the assistant connector beta for an
// existing user, by email. In the test-user phase everyone invited is already a
// registered user, so this is a direct row update — no signup timing to track.
//
// Auth: Bearer ADMIN_TOKEN (same token as the analytics dashboard, which calls
// this). GET lists current testers; POST { email, action: 'grant'|'revoke' }.

import { sql } from '../_lib/db.js'
import { CONNECTOR_BETA_FLAG, GRANTABLE_FLAGS } from '../_lib/feature-flags.js'

// Named in api/_lib/feature-flags.js. The default is unchanged from when this
// endpoint served one pilot, so an older caller that sends no `flag` still
// grants the connector beta and nothing about its behaviour moved.
const DEFAULT_FLAG = CONNECTOR_BETA_FLAG

// Resolve the requested flag against the registry. Anything unregistered is
// rejected rather than written: a flag value nothing reads is a silent no-op
// that looks like a successful grant, which is the worst outcome for a pilot.
function resolveFlag(raw) {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_FLAG
  const f = typeof raw === 'string' ? raw.trim() : ''
  return Object.prototype.hasOwnProperty.call(GRANTABLE_FLAGS, f) ? f : null
}

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
      const flag = resolveFlag(req.query && req.query.flag)
      if (!flag) return res.status(400).json({ error: 'unknown flag' })
      const rows = await sql`SELECT email FROM users WHERE ${flag} = ANY(feature_flags) ORDER BY lower(email)`
      // `flags` lets the dashboard build its picker from the server's registry
      // rather than from a copy of it that can drift.
      return res.status(200).json({ testers: rows.map(r => r.email), flag, flags: GRANTABLE_FLAGS })
    }

    const body = req.body || {}
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const action = typeof body.action === 'string' ? body.action.trim() : ''
    if (!email) return res.status(400).json({ error: 'email required' })
    if (action !== 'grant' && action !== 'revoke') {
      return res.status(400).json({ error: "action must be 'grant' or 'revoke'" })
    }
    const flag = resolveFlag(body.flag)
    if (!flag) return res.status(400).json({ error: 'unknown flag' })

    const rows = action === 'grant'
      ? await sql`
          UPDATE users
          SET feature_flags = CASE WHEN ${flag} = ANY(feature_flags) THEN feature_flags ELSE array_append(feature_flags, ${flag}) END
          WHERE lower(email) = lower(${email})
          RETURNING email, (${flag} = ANY(feature_flags)) AS enabled`
      : await sql`
          UPDATE users
          SET feature_flags = array_remove(feature_flags, ${flag})
          WHERE lower(email) = lower(${email})
          RETURNING email, (${flag} = ANY(feature_flags)) AS enabled`
    if (rows.length === 0) return res.status(404).json({ error: 'No account with that email' })
    console.log('admin/pipeline-access', { email, action, flag, enabled: rows[0].enabled })
    return res.status(200).json({ ok: true, email: rows[0].email, flag, enabled: !!rows[0].enabled })
  } catch (err) {
    console.error('admin/pipeline-access: query failed', err && err.message)
    return res.status(500).json({ error: 'Update failed' })
  }
}
