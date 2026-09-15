// Shared validator for the "next" redirect target carried through the
// magic-link flow (api/auth/request-link.js -> the emailed link ->
// api/auth/verify.js). Both ends must apply the exact same rule: a bare
// relative path only. Anything else is a potential open redirect (an
// attacker-controlled `next` on a link the user is asked to click), so a
// value that fails this check is dropped silently rather than surfaced as
// an error -- the sign-in itself must never fail because of a bad `next`.
export function sanitizeNextPath(next) {
  if (!next || typeof next !== 'string') return null
  if (!next.startsWith('/')) return null
  if (next.startsWith('//')) return null
  // A scheme-relative or absolute URL smuggled in via a `next` value that
  // still happens to start with a single slash, e.g. "/\evil.com" (browsers
  // treat backslashes as forward slashes) or "/%2F%2Fevil.com" -- decode
  // first so an encoded variant can't slip past the checks above.
  let decoded
  try {
    decoded = decodeURIComponent(next)
  } catch {
    return null
  }
  if (/^\/\\/.test(decoded) || decoded.startsWith('//')) return null
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded)) return null
  return next
}
