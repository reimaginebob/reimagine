// Admin-only connector revocation for the MCP OAuth server.
//
// Exists because the consent screen (api/oauth/authorize.js) tells the user they
// can disconnect, and until this endpoint there was no code path anywhere that
// disconnected: no revoke, no UI, no admin action, no DELETE outside the refresh
// rotation line. A granted connector was permanent short of deleting the account.
//
//   GET  ?email=<addr>   -> what this account has connected (grants + push token)
//   POST { email }                    -> full disconnect: every grant AND the
//                                        push token (see below)
//   POST { email, client_id }         -> that one grant only; push token untouched
//
// Why the push token is in scope. api/mcp.js resolves a bearer against
// oauth_tokens FIRST and falls back to users.push_token_hash, which has no TTL
// and no scope. Deleting OAuth rows alone would leave a user who ever minted a
// push token with working connector access, so "disconnect everything" has to
// clear both or the word "disconnect" is not true. A targeted single-client
// revoke leaves it alone, because that is a narrower request.
//
// Keyed on email, not user_id + client_id. A maintainer acting on an inbound
// support mail has an email address; client_id is `rc_<random>` minted at
// registration and surfaced nowhere in the product, so an id-only endpoint
// cannot be used in the one situation it exists for. GET is how you find a
// client_id if you need the narrow form.
//
// Auth: Bearer ADMIN_TOKEN, header only (the shape api/admin/suspend-user.js
// uses). No ?t= query fallback here: unlike the read-only dashboards, this
// endpoint destroys credentials, and a token in a query string lands in access
// logs and browser history.
//
// Not added to scripts/smoke-preview.mjs: it needs an admin token, and preview
// readiness must not depend on one.

import { sql } from '../_lib/db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const expected = process.env.ADMIN_TOKEN
  if (!expected) {
    console.error('oauth/revoke: ADMIN_TOKEN not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  if ((req.headers.authorization || '') !== `Bearer ${expected}`) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const src = req.method === 'GET' ? (req.query || {}) : (req.body || {})
  const email = typeof src.email === 'string' ? src.email.trim() : ''
  if (!email) return res.status(400).json({ error: 'email required' })
  const clientId = typeof src.client_id === 'string' && src.client_id.trim()
    ? src.client_id.trim()
    : null

  try {
    const users = await sql`SELECT id, email FROM users WHERE lower(email) = lower(${email}) LIMIT 1`
    const user = users[0]
    if (!user) return res.status(404).json({ error: 'No account with that email' })

    if (req.method === 'GET') {
      const grants = await sql`
        SELECT t.client_id, c.client_name, t.scope, t.created_at, t.expires_at, t.refresh_expires_at
        FROM oauth_tokens t
        LEFT JOIN oauth_clients c ON c.client_id = t.client_id
        WHERE t.user_id = ${user.id}::uuid
        ORDER BY t.created_at DESC`
      const pushRows = await sql`SELECT push_token_hash, push_token_created_at FROM users WHERE id = ${user.id}::uuid LIMIT 1`
      const push = pushRows[0] || {}
      return res.status(200).json({
        email: user.email,
        user_id: user.id,
        grants,
        push_token: { connected: !!push.push_token_hash, created_at: push.push_token_created_at || null },
      })
    }

    // POST. Targeted revoke touches one client; the unqualified form is a full
    // disconnect and takes the push token with it.
    const revoked = clientId
      ? await sql`DELETE FROM oauth_tokens WHERE user_id = ${user.id}::uuid AND client_id = ${clientId} RETURNING client_id`
      : await sql`DELETE FROM oauth_tokens WHERE user_id = ${user.id}::uuid RETURNING client_id`

    let pushRevoked = false
    if (!clientId) {
      const cleared = await sql`
        UPDATE users SET push_token_hash = NULL, push_token_created_at = NULL
        WHERE id = ${user.id}::uuid AND push_token_hash IS NOT NULL
        RETURNING id`
      pushRevoked = cleared.length > 0
    }

    // Pending authorization codes for this user would otherwise still be
    // redeemable into a fresh grant for up to five minutes after a revoke.
    const codes = clientId
      ? await sql`DELETE FROM oauth_codes WHERE user_id = ${user.id}::uuid AND client_id = ${clientId} RETURNING code_hash`
      : await sql`DELETE FROM oauth_codes WHERE user_id = ${user.id}::uuid RETURNING code_hash`

    console.log('oauth/revoke ok', {
      email: user.email,
      client_id: clientId || 'ALL',
      grants_revoked: revoked.length,
      codes_revoked: codes.length,
      push_revoked: pushRevoked,
    })
    return res.status(200).json({
      ok: true,
      email: user.email,
      client_id: clientId || null,
      grants_revoked: revoked.length,
      codes_revoked: codes.length,
      push_revoked: pushRevoked,
    })
  } catch (err) {
    console.error('oauth/revoke failed', {
      email,
      client_id: clientId,
      message: err?.message || String(err),
    })
    return res.status(500).json({ error: 'Revoke failed' })
  }
}
