// Shared helpers for the MCP OAuth 2.1 authorization server.

import crypto from 'node:crypto'

export function sha256Hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex')
}

export function randToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url')
}

// PKCE S256: challenge === base64url(sha256(verifier)).
export function verifyPkceS256(verifier, challenge) {
  if (!verifier || !challenge) return false
  const computed = crypto.createHash('sha256').update(verifier).digest('base64url')
  // constant-time compare
  const a = Buffer.from(computed)
  const b = Buffer.from(challenge)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// Absolute origin of this deployment, from the forwarded headers (prod-correct).
export function baseUrl(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim()
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}

// HTML-escape for values interpolated into the consent page.
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

export const ACCESS_TOKEN_TTL_SECONDS = 3600
