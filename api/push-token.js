// Vercel serverless function: manages a user's phase-2 push token — the
// credential their assistant (via the Reimagine connector) presents to write
// pursuit status into My Search.
//
// Browser-only surface (cookie session + origin allowlist), gated on the
// connector beta flag. Only the SHA-256 hash is stored; the plaintext token
// is returned exactly once, on mint (POST), and never again.
//
//   GET    -> { connected: bool, createdAt }         (does a token exist?)
//   POST   -> { token, createdAt }                    (mint/rotate; plaintext once)
//   DELETE -> { ok: true }                            (revoke)

import crypto from 'node:crypto'
import { sql } from './_lib/db.js'
import { getSessionUser } from './_lib/session.js'
import { hasConnectorBeta } from './_lib/feature-flags.js'

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

export function hashPushToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export default async function handler(req, res) {
  const method = req.method
  if (method !== 'GET' && method !== 'POST' && method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const origin = req.headers.origin || req.headers.referer || ''
  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  let user
  try {
    user = await getSessionUser(req, res)
  } catch (err) {
    console.warn('push-token: session lookup failed', err)
    user = null
  }
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  if (user.suspended_at) {
    return res.status(403).json({ error: 'account_suspended' })
  }
  // Connector beta, not My Pipeline: the screen went GA on 2026-08-30, minting a
  // long-lived bearer token did not. See api/_lib/feature-flags.js.
  if (!hasConnectorBeta(user)) {
    return res.status(403).json({ error: 'Not enabled' })
  }

  try {
    if (method === 'GET') {
      const rows = await sql`SELECT push_token_hash, push_token_created_at FROM users WHERE id = ${user.id}::uuid LIMIT 1`
      const row = rows[0] || {}
      return res.status(200).json({ connected: !!row.push_token_hash, createdAt: row.push_token_created_at || null })
    }

    if (method === 'POST') {
      // Mint/rotate. 32 random bytes -> base64url. Store only the hash.
      const token = crypto.randomBytes(32).toString('base64url')
      const hash = hashPushToken(token)
      await sql`UPDATE users SET push_token_hash = ${hash}, push_token_created_at = NOW() WHERE id = ${user.id}::uuid`
      return res.status(200).json({ token, createdAt: new Date().toISOString() })
    }

    // DELETE -> revoke.
    await sql`UPDATE users SET push_token_hash = NULL, push_token_created_at = NULL WHERE id = ${user.id}::uuid`
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('push-token: query failed', err)
    return res.status(500).json({ error: 'Could not manage your connector token.' })
  }
}
