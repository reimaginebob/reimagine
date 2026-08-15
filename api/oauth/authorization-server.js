// RFC 8414 Authorization Server Metadata. Advertises the authorize/token/
// registration endpoints and PKCE support so the MCP client can run the flow.

import { baseUrl } from '../_lib/oauth.js'

export default function handler(req, res) {
  const b = baseUrl(req)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  return res.status(200).json({
    issuer: b,
    authorization_endpoint: `${b}/api/oauth/authorize`,
    token_endpoint: `${b}/api/oauth/token`,
    registration_endpoint: `${b}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['pipeline'],
  })
}
