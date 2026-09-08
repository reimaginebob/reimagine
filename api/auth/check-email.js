import { sql } from '../_lib/db.js'
import { getClientIp, checkIpRateLimit, logIpEvent } from '../_lib/auth-rate-limit.js'

// Prelaunch audit, finding #2.3: this endpoint had no rate limit at all --
// unauthenticated and free, it is an account-enumeration oracle (does this
// email have a Reimagine account?). Per-IP cap only; there is nothing else to
// key on for a route whose whole job is answering a question about an email
// address that may not be the caller's own. Higher limit than request-link's
// own IP cap: this is a lighter, read-only check the client fires on every
// signup-flow keystroke-equivalent (once per email typed), not a send.
const IP_RATE_LIMIT_WINDOW_MIN = 15
const IP_RATE_LIMIT_MAX = 30

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const clientIp = getClientIp(req)
  const ipCheck = await checkIpRateLimit('check-email', clientIp, { windowMinutes: IP_RATE_LIMIT_WINDOW_MIN, limit: IP_RATE_LIMIT_MAX })
  if (ipCheck.limited) {
    return res.status(429).json({ error: 'Too many requests from this network. Try again shortly.', retryAt: ipCheck.retryAt.toISOString() })
  }
  await logIpEvent('check-email', clientIp)

  const { email } = req.body || {}
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const rows = await sql`SELECT 1 FROM users WHERE email = ${normalizedEmail} LIMIT 1`

  return res.status(200).json({ exists: rows.length > 0 })
}
