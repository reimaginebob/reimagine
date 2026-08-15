// RFC 7591 Dynamic Client Registration. The MCP client (Claude) registers
// itself with its redirect URIs and gets a client_id. Public client (PKCE),
// so no client secret. Open registration is standard for MCP connectors; the
// real gate is the user consent + PKCE + exact redirect-uri match on authorize.

import { sql } from '../_lib/db.js'
import { randToken } from '../_lib/oauth.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  body = body || {}

  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter(u => typeof u === 'string' && /^https?:\/\//.test(u))
    : []
  if (redirectUris.length === 0) {
    return res.status(400).json({ error: 'invalid_redirect_uri', error_description: 'redirect_uris is required' })
  }
  const clientName = typeof body.client_name === 'string' ? body.client_name.slice(0, 120) : null
  const clientId = 'rc_' + randToken(16)

  try {
    await sql`INSERT INTO oauth_clients (client_id, redirect_uris, client_name)
              VALUES (${clientId}, ${JSON.stringify(redirectUris)}::jsonb, ${clientName})`
  } catch (err) {
    console.error('oauth/register failed', err)
    return res.status(500).json({ error: 'server_error' })
  }

  return res.status(201).json({
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: redirectUris,
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    client_name: clientName || undefined,
  })
}
