// OAuth Token endpoint. Exchanges an authorization code (with PKCE) for an
// access token, and refreshes. Public client (no secret) — the auth code +
// PKCE verifier + exact redirect_uri are the proof.

import { sql } from '../_lib/db.js'
import { randToken, sha256Hex, verifyPkceS256, ACCESS_TOKEN_TTL_SECONDS } from '../_lib/oauth.js'

function readBody(req) {
  let b = req.body
  if (typeof b === 'string') { try { b = Object.fromEntries(new URLSearchParams(b)) } catch { b = {} } }
  return b || {}
}

function fail(res, status, error, description) {
  return res.status(status).json({ error, error_description: description })
}

async function issueTokens(res, userId, clientId, scope) {
  const accessToken = randToken(32)
  const refreshToken = randToken(32)
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString()
  await sql`INSERT INTO oauth_tokens (access_token_hash, refresh_token_hash, user_id, client_id, scope, expires_at)
            VALUES (${sha256Hex(accessToken)}, ${sha256Hex(refreshToken)}, ${userId}::uuid, ${clientId}, ${scope || null}, ${expiresAt})`
  return res.status(200).json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: scope || 'pipeline',
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const p = readBody(req)
  const grantType = p.grant_type

  try {
    if (grantType === 'authorization_code') {
      const { code, code_verifier: verifier, client_id: clientId, redirect_uri: redirectUri } = p
      if (!code || !verifier || !clientId || !redirectUri) return fail(res, 400, 'invalid_request', 'missing parameters')

      const rows = await sql`SELECT user_id, client_id, redirect_uri, code_challenge, scope FROM oauth_codes WHERE code_hash = ${sha256Hex(code)} AND expires_at > NOW() LIMIT 1`
      const row = rows[0]
      if (!row) return fail(res, 400, 'invalid_grant', 'code invalid or expired')
      // Single-use: consume immediately.
      await sql`DELETE FROM oauth_codes WHERE code_hash = ${sha256Hex(code)}`

      if (row.client_id !== clientId) return fail(res, 400, 'invalid_grant', 'client mismatch')
      if (row.redirect_uri !== redirectUri) return fail(res, 400, 'invalid_grant', 'redirect_uri mismatch')
      if (!verifyPkceS256(verifier, row.code_challenge)) return fail(res, 400, 'invalid_grant', 'PKCE verification failed')

      return await issueTokens(res, row.user_id, clientId, row.scope)
    }

    if (grantType === 'refresh_token') {
      const { refresh_token: refreshToken, client_id: clientId } = p
      if (!refreshToken) return fail(res, 400, 'invalid_request', 'missing refresh_token')
      const rows = await sql`SELECT user_id, client_id, scope FROM oauth_tokens WHERE refresh_token_hash = ${sha256Hex(refreshToken)} LIMIT 1`
      const row = rows[0]
      if (!row) return fail(res, 400, 'invalid_grant', 'refresh_token invalid')
      if (clientId && row.client_id !== clientId) return fail(res, 400, 'invalid_grant', 'client mismatch')
      // Rotate: drop the old token pair, issue a fresh one.
      await sql`DELETE FROM oauth_tokens WHERE refresh_token_hash = ${sha256Hex(refreshToken)}`
      return await issueTokens(res, row.user_id, row.client_id, row.scope)
    }

    return fail(res, 400, 'unsupported_grant_type', `grant_type ${grantType} not supported`)
  } catch (err) {
    console.error('oauth/token failed', err)
    return fail(res, 500, 'server_error', 'token issuance failed')
  }
}
