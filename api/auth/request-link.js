import { sql } from '../_lib/db.js'
import { generateToken, hashToken } from '../_lib/session.js'
import { sendMagicLinkEmail } from '../_lib/email.js'

const TOKEN_EXPIRY_MINUTES = 15
const RATE_LIMIT_PER_HOUR = 5

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, firstName, lastName, privacyAccepted, privacyVersion, termsAccepted, termsVersion } =
    req.body || {}
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' })
  }
  const normalizedEmail = email.trim().toLowerCase()

  const existing = await sql`SELECT 1 FROM users WHERE email = ${normalizedEmail} LIMIT 1`
  const isNewAccount = existing.length === 0
  if (isNewAccount) {
    if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
      return res.status(400).json({ error: 'First name required for new account' })
    }
    // Legal acceptance gate (defense in depth; the signup form already blocks
    // submit until both boxes are checked). Only enforced for new accounts:
    // returning users re-authenticate without re-accepting, and users created
    // before this gate shipped are grandfathered.
    if (privacyAccepted !== true || termsAccepted !== true) {
      return res.status(400).json({ error: 'legal_not_accepted' })
    }
  }

  // Acceptance is captured on the signup form but the user row is not created
  // until the magic link is clicked (api/auth/verify.js). Carry the acceptance
  // (timestamp = now, the moment the form was submitted) on the token row;
  // verify.js copies it onto the new users row at creation.
  const nowIso = new Date().toISOString()
  const tokenPrivacyAt = isNewAccount ? nowIso : null
  const tokenPrivacyVersion = isNewAccount && typeof privacyVersion === 'string' ? privacyVersion : null
  const tokenTermsAt = isNewAccount ? nowIso : null
  const tokenTermsVersion = isNewAccount && typeof termsVersion === 'string' ? termsVersion : null

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
    INSERT INTO magic_link_tokens (token_hash, email, first_name, last_name, expires_at, user_agent, ip_address, privacy_accepted_at, privacy_version, terms_accepted_at, terms_version)
    VALUES (${tokenHash}, ${normalizedEmail}, ${firstName || null}, ${lastName || null}, ${expiresAt.toISOString()}, ${userAgent}, ${ipAddress}, ${tokenPrivacyAt}, ${tokenPrivacyVersion}, ${tokenTermsAt}, ${tokenTermsVersion})
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
