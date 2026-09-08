import { sql } from './db.js'

// Prelaunch audit, finding #2.3: shared per-IP rate limiter for the
// magic-link auth flow. api/auth/request-link.js's rate limit was keyed on
// recipient email only -- unlimited third-party addresses could each
// receive emails from career.club, a spam-reputation risk on a young
// sending domain -- and api/auth/check-email.js had no rate limit at all,
// making it an unauthenticated account-enumeration oracle. Both routes now
// log every check here (regardless of outcome) and are capped per IP,
// independent of which email address the caller varies.
//
// windowMinutes/limit are numbers the audit itself could not measure against
// production traffic (Section 9: "no production data was read"); each
// caller documents its own starting point and why.

export function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim()
  return (req.socket && req.socket.remoteAddress) || ''
}

// Fails OPEN on a counting hiccup or a missing IP, matching the generation
// cap's own precedent (api/claude.js) -- a DB blip or a broken proxy must
// never lock a real signup out.
export async function checkIpRateLimit(route, ipAddress, { windowMinutes, limit }) {
  if (!ipAddress) return { limited: false }
  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS n, MIN(created_at) AS earliest
      FROM auth_ip_events
      WHERE route = ${route} AND ip_address = ${ipAddress}
        AND created_at > NOW() - (${windowMinutes} * INTERVAL '1 minute')
    `
    const n = (rows[0] && rows[0].n) || 0
    if (n >= limit && rows[0].earliest) {
      const retryAt = new Date(new Date(rows[0].earliest).getTime() + windowMinutes * 60 * 1000)
      return { limited: true, retryAt }
    }
    return { limited: false }
  } catch (e) {
    console.error(`auth-rate-limit: ${route} IP check skipped:`, e && e.message)
    return { limited: false }
  }
}

// Best-effort; a failed log must never take the auth flow down, same as
// every other logging call in this codebase (api/claude.js's logGeneration,
// among others).
export async function logIpEvent(route, ipAddress) {
  if (!ipAddress) return
  try {
    await sql`INSERT INTO auth_ip_events (route, ip_address) VALUES (${route}, ${ipAddress})`
  } catch (e) {
    console.error(`auth-rate-limit: ${route} IP log failed:`, e && e.message)
  }
}
