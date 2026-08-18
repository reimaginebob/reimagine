// OAuth Token endpoint. Exchanges an authorization code (with PKCE) for an
// access token, and refreshes. Public client (no secret) — the auth code +
// PKCE verifier + exact redirect_uri are the proof.

import { sql } from '../_lib/db.js'
import { randToken, sha256Hex, verifyPkceS256, ACCESS_TOKEN_TTL_SECONDS } from '../_lib/oauth.js'

// How long a grant lives before the user has to re-consent. The access token
// rotates hourly; this is the outer bound on the whole grant.
const REFRESH_TOKEN_TTL_DAYS = 90

function readBody(req) {
  let b = req.body
  if (typeof b === 'string') { try { b = Object.fromEntries(new URLSearchParams(b)) } catch { b = {} } }
  return b || {}
}

function fail(res, status, error, description) {
  return res.status(status).json({ error, error_description: description })
}

// refreshExpiresAt is the outer bound on the GRANT, not on this token pair.
// On the authorization_code grant it is minted fresh (90 days). On a refresh it
// is carried forward from the token being rotated, NOT reset — otherwise a
// client that refreshes on any cadence under 90 days holds an immortal grant by
// another route, which is the bug this whole change exists to close.
async function issueTokens(res, userId, clientId, scope, refreshExpiresAt) {
  const accessToken = randToken(32)
  const refreshToken = randToken(32)
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString()
  await sql`INSERT INTO oauth_tokens (access_token_hash, refresh_token_hash, user_id, client_id, scope, expires_at, refresh_expires_at)
            VALUES (${sha256Hex(accessToken)}, ${sha256Hex(refreshToken)}, ${userId}::uuid, ${clientId}, ${scope || null}, ${expiresAt}, ${refreshExpiresAt})`
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

      // Single-use, atomically. DELETE ... RETURNING is one statement, so two
      // concurrent redemptions of the same code compete for the row lock:
      // exactly one gets a row back, the other gets zero and fails cleanly. The
      // previous SELECT-then-DELETE pair let both readers pass the SELECT and
      // mint two token pairs from one code.
      //
      // The delete is unconditional on expiry (the expiry check moved into JS
      // below) so redeeming an expired code also reaps its row, instead of
      // leaving dead rows behind for a cleanup job that does not exist yet.
      const rows = await sql`
        DELETE FROM oauth_codes
        WHERE code_hash = ${sha256Hex(code)}
        RETURNING user_id, client_id, redirect_uri, code_challenge, scope, expires_at`
      const row = rows[0]
      if (!row) return fail(res, 400, 'invalid_grant', 'code invalid or expired')
      if (!row.expires_at || new Date(row.expires_at).getTime() <= Date.now()) {
        return fail(res, 400, 'invalid_grant', 'code invalid or expired')
      }

      if (row.client_id !== clientId) return fail(res, 400, 'invalid_grant', 'client mismatch')
      if (row.redirect_uri !== redirectUri) return fail(res, 400, 'invalid_grant', 'redirect_uri mismatch')
      if (!verifyPkceS256(verifier, row.code_challenge)) return fail(res, 400, 'invalid_grant', 'PKCE verification failed')

      const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
      return await issueTokens(res, row.user_id, clientId, row.scope, refreshExpiresAt)
    }

    if (grantType === 'refresh_token') {
      const { refresh_token: refreshToken, client_id: clientId } = p
      if (!refreshToken) return fail(res, 400, 'invalid_request', 'missing refresh_token')
      // refresh_expires_at, NOT expires_at: the latter is the access token's
      // 3600s TTL, so gating refresh on it would reject every refresh an hour
      // after issue — precisely when a client refreshes. The predicate also
      // excludes NULL, so a row minted in the window between the migration
      // applying and this code serving fails closed rather than open.
      const rows = await sql`SELECT user_id, client_id, scope, refresh_expires_at FROM oauth_tokens WHERE refresh_token_hash = ${sha256Hex(refreshToken)} AND refresh_expires_at > NOW() LIMIT 1`
      const row = rows[0]
      if (!row) return fail(res, 400, 'invalid_grant', 'refresh_token invalid or expired')
      if (clientId && row.client_id !== clientId) return fail(res, 400, 'invalid_grant', 'client mismatch')
      // Rotate: drop the old token pair, issue a fresh one. The grant's expiry
      // rides along unchanged so rotation cannot extend it.
      await sql`DELETE FROM oauth_tokens WHERE refresh_token_hash = ${sha256Hex(refreshToken)}`
      return await issueTokens(res, row.user_id, row.client_id, row.scope, row.refresh_expires_at)
    }

    return fail(res, 400, 'unsupported_grant_type', `grant_type ${grantType} not supported`)
  } catch (err) {
    console.error('oauth/token failed', err)
    return fail(res, 500, 'server_error', 'token issuance failed')
  }
}
