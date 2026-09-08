// One allowlist of Reimagine's real hosts, shared by every endpoint that
// needs to know "is this actually us." Extracted from api/claude.js
// (prelaunch audit, finding #2.3) so api/auth/request-link.js can pin the
// magic-link base URL to the same list instead of trusting x-forwarded-host
// outright.
export const ALLOWED_HOSTS = new Set([
  'reimagine2-two.vercel.app',
  'reimagine.career.club',
  'localhost:5173',
  'localhost:3000',
])

function isAllowedHostname(hostname) {
  if (!hostname) return false
  if (ALLOWED_HOSTS.has(hostname)) return true
  // Vercel preview deploys for this project.
  if (hostname.endsWith('.vercel.app') && hostname.includes('reimagine')) return true
  return false
}

// Origin/Referer header check (api/claude.js's original use): the header
// carries a full origin, e.g. "https://reimagine.career.club".
export function isAllowedOrigin(rawOrigin) {
  if (!rawOrigin) return false
  try {
    const u = new URL(rawOrigin)
    const hostWithPort = u.port ? `${u.hostname}:${u.port}` : u.hostname
    return isAllowedHostname(u.hostname) || isAllowedHostname(hostWithPort)
  } catch {
    return false
  }
}

// Host header check: x-forwarded-host/host carry a bare hostname[:port], not
// a full URL, so this skips the URL-parsing step isAllowedOrigin needs.
export function isAllowedHost(hostWithMaybePort) {
  if (!hostWithMaybePort || typeof hostWithMaybePort !== 'string') return false
  const hostname = hostWithMaybePort.split(':')[0]
  return isAllowedHostname(hostWithMaybePort) || isAllowedHostname(hostname)
}
