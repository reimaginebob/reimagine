import { sql } from '../_lib/db.js'
import { generateToken, hashToken } from '../_lib/session.js'
import { sendMagicLinkEmail } from '../_lib/email.js'

const TOKEN_EXPIRY_MINUTES = 15
const RATE_LIMIT_PER_HOUR = 5

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, firstName, lastName } = req.body || {}
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' })
  }
  const normalizedEmail = email.trim().toLowerCase()

  const existing = await sql`SELECT 1 FROM users WHERE email = ${normalizedEmail} LIMIT 1`
  if (existing.length === 0) {
    if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
      return res.status(400).json({ error: 'First name required for new account' })
    }
  }

  // Rate limit: max 5 magic link requests per email per hour
  const recent = await sql`
    SELECT COUNT(*) AS count FROM magic_link_tokens
    WHERE email = ${normalizedEmail} AND created_at > NOW() - INTERVAL '1 hour'
  `
  if (parseInt(recent[0].count, 10) >= RATE_LIMIT_PER_HOUR) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' })
  }

  const rawToken = generateToken()
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000)
  const userAgent = req.headers['user-agent'] || ''
  const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || ''

  await sql`
    INSERT INTO magic_link_tokens (token_hash, email, first_name, last_name, expires_at, user_agent, ip_address)
    VALUES (${tokenHash}, ${normalizedEmail}, ${firstName || null}, ${lastName || null}, ${expiresAt.toISOString()}, ${userAgent}, ${ipAddress})
  `

  const baseUrl = process.env.MAGIC_LINK_BASE_URL || 'https://reimagine2-two.vercel.app'
  const link = `${baseUrl}/auth/verify?token=${rawToken}`

  try {
    await sendMagicLinkEmail(normalizedEmail, link, firstName)
  } catch (err) {
    console.error('Resend send failure', err)
    return res.status(500).json({ error: 'Could not send email' })
  }

  return res.status(200).json({ ok: true })
}
