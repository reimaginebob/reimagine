// RFC 9728 Protected Resource Metadata for the MCP endpoint. Claude fetches this
// (pointed at by the MCP 401's WWW-Authenticate resource_metadata) to discover
// which authorization server protects /api/mcp.

import { baseUrl } from '../_lib/oauth.js'

export default function handler(req, res) {
  const b = baseUrl(req)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  return res.status(200).json({
    resource: `${b}/api/mcp`,
    authorization_servers: [b],
    scopes_supported: ['pipeline'],
    bearer_methods_supported: ['header'],
  })
}
