// OAuth Authorization endpoint (Authorization Code + PKCE).
//
// GET  -> validate the request, resolve the Reimagine session (cookie), and
//         render a consent screen. The user is already signed into Reimagine in
//         this browser, so "log in" collapses to a single Allow click.
// POST -> the consent form posts back here; on Allow we mint a single-use auth
//         code (bound to user + client + redirect_uri + PKCE challenge) and
//         redirect to the client's redirect_uri with code + state.
//
// Security: response_type must be `code`; client_id must be registered; the
// redirect_uri must exactly match a registered one (checked BEFORE we ever
// redirect, to avoid open redirects); PKCE S256 required; only users in the
// connector beta can grant (CONNECTOR_BETA_FLAG, api/_lib/feature-flags.js).

import { sql } from '../_lib/db.js'
import { getSessionUser } from '../_lib/session.js'
import { randToken, sha256Hex, baseUrl, esc } from '../_lib/oauth.js'
import { hasConnectorBeta } from '../_lib/feature-flags.js'

function readParams(req) {
  if (req.method === 'POST') {
    let b = req.body
    if (typeof b === 'string') { try { b = Object.fromEntries(new URLSearchParams(b)) } catch { b = {} } }
    return b || {}
  }
  return req.query || {}
}

async function getClient(clientId) {
  if (!clientId) return null
  const rows = await sql`SELECT client_id, redirect_uris FROM oauth_clients WHERE client_id = ${clientId} LIMIT 1`
  return rows[0] || null
}

function redirectWith(res, redirectUri, params) {
  const u = new URL(redirectUri)
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v)
  res.setHeader('Location', u.toString())
  return res.status(302).end()
}

function errorPage(res, code, title, message) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.status(code).send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head><body style="margin:0;font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;background:#F5F6F8;color:#1A2540"><div style="max-width:460px;margin:12vh auto;background:#fff;border:1px solid #E2E5EA;border-radius:14px;padding:32px 36px"><h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">${esc(title)}</h1><p style="font-size:16px;line-height:1.6;color:#3D4A5C;margin:0">${message}</p></div></body></html>`)
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const p = readParams(req)
  const clientId = p.client_id
  const redirectUri = p.redirect_uri
  const responseType = p.response_type
  const codeChallenge = p.code_challenge
  const codeChallengeMethod = p.code_challenge_method
  const state = p.state
  const scope = p.scope || 'pipeline'

  // Validate the client + redirect_uri BEFORE any redirect (open-redirect guard).
  const client = await getClient(clientId)
  if (!client) return errorPage(res, 400, 'Connection error', 'This app is not registered. Try adding the connector again from Claude.')
  const allowed = Array.isArray(client.redirect_uris) ? client.redirect_uris : []
  if (!redirectUri || !allowed.includes(redirectUri)) {
    return errorPage(res, 400, 'Connection error', 'The redirect address does not match what this app registered. For your safety we stopped here.')
  }

  // From here, request errors can be reported back to the client via redirect.
  if (responseType !== 'code') return redirectWith(res, redirectUri, { error: 'unsupported_response_type', state })
  if (!codeChallenge || codeChallengeMethod !== 'S256') return redirectWith(res, redirectUri, { error: 'invalid_request', error_description: 'PKCE S256 required', state })

  // Who is this? (Reimagine session cookie in the same browser.)
  let user = null
  try { user = await getSessionUser(req, res) } catch { user = null }
  if (!user || !user.id) {
    return errorPage(res, 401, 'Sign in to Reimagine first', 'Open <a href="https://reimagine.career.club" style="color:#C8924A">reimagine.career.club</a> in this browser and sign in, then come back and click Connect again.')
  }
  // Connector beta, not My Pipeline: the screen went GA on 2026-08-30, granting
  // an outside assistant a credential did not. See api/_lib/feature-flags.js.
  if (!hasConnectorBeta(user)) {
    return errorPage(res, 403, 'Not available yet', 'The assistant connector is in limited beta and is not enabled on your account.')
  }

  // POST = the user answered the consent screen.
  if (req.method === 'POST') {
    if (p.decision !== 'approve') return redirectWith(res, redirectUri, { error: 'access_denied', state })
    const code = randToken(32)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    try {
      await sql`INSERT INTO oauth_codes (code_hash, user_id, client_id, redirect_uri, code_challenge, scope, expires_at)
                VALUES (${sha256Hex(code)}, ${user.id}::uuid, ${clientId}, ${redirectUri}, ${codeChallenge}, ${scope}, ${expiresAt})`
    } catch (err) {
      console.error('oauth/authorize code insert failed', err)
      return redirectWith(res, redirectUri, { error: 'server_error', state })
    }
    return redirectWith(res, redirectUri, { code, state })
  }

  // GET = render the consent screen. All params round-trip as hidden fields.
  const hidden = { response_type: responseType, client_id: clientId, redirect_uri: redirectUri, code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod, state, scope }
  const hiddenInputs = Object.entries(hidden).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('')
  const b = baseUrl(req)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.status(200).send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect Claude to Reimagine</title></head>
<body style="margin:0;font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;background:#F5F6F8;color:#1A2540">
  <div style="max-width:480px;margin:8vh auto;background:#fff;border:1px solid #E2E5EA;border-radius:16px;padding:32px 36px">
    <div style="font-size:15px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#C8924A;margin-bottom:14px">Reimagine</div>
    <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:700;margin:0 0 10px">Let your assistant update your pipeline?</h1>
    <p style="font-size:16px;line-height:1.65;color:#3D4A5C;margin:0 0 18px">You're signed in as <strong>${esc(user.email || 'your account')}</strong>. Approving lets your connected assistant:</p>
    <ul style="font-size:16px;line-height:1.7;color:#3D4A5C;margin:0 0 8px 20px;padding:0">
      <li>See the opportunities in your pipeline and their status</li>
      <li>Update an opportunity's stage, dates, and next step</li>
    </ul>
    <div style="background:#C8924A10;border-left:3px solid #C8924A;border-radius:8px;padding:12px 16px;font-size:15px;color:#2D3748;line-height:1.6;margin:14px 0 22px">It can only touch your pipeline — nothing else in your account. To disconnect it later, email info@career.club and we will revoke it for you.</div>
    <form method="POST" action="${b}/api/oauth/authorize" style="display:flex;gap:12px">
      ${hiddenInputs}
      <button type="submit" name="decision" value="approve" style="flex:1;background:#C8924A;color:#fff;border:none;border-radius:8px;padding:12px 16px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit">Allow</button>
      <button type="submit" name="decision" value="deny" style="background:transparent;color:#3D4A5C;border:1px solid #E2E5EA;border-radius:8px;padding:12px 18px;font-size:16px;cursor:pointer;font-family:inherit">Deny</button>
    </form>
  </div>
</body></html>`)
}
