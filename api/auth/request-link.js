import { sql } from '../_lib/db.js'
import { generateToken, hashToken } from '../_lib/session.js'
import { sendMagicLinkEmail } from '../_lib/email.js'

const TOKEN_EXPIRY_MINUTES = 15
// Rate limits keyed by email. Both windows must clear for a request to pass.
// 5 / 15 minutes covers mistypes, spam-folder retry, and a fresh link after
// expiry. 20 / hour catches abusive patterns while staying well below
// Resend's per-account ceilings.
const RATE_LIMIT_15MIN = 5
const RATE_LIMIT_1HOUR = 20

function getRequestOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}

function formatHHMMUtc(date) {
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
}

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

  // Dual-window rate limit. We query both windows in one round trip, then
  // compute the earliest moment the limiting window opens back up. When both
  // windows bind, the user waits until the later of the two recovery points.
  const counts = await sql`
    SELECT
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '15 minutes') AS c15,
      MIN(created_at) FILTER (WHERE created_at > NOW() - INTERVAL '15 minutes') AS min15,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') AS c60,
      MIN(created_at) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') AS min60
    FROM magic_link_tokens
    WHERE email = ${normalizedEmail}
  `
  const row = counts[0] || {}
  const c15 = parseInt(row.c15 || 0, 10)
  const c60 = parseInt(row.c60 || 0, 10)
  let retryAt = null
  if (c15 >= RATE_LIMIT_15MIN && row.min15) {
    retryAt = new Date(new Date(row.min15).getTime() + 15 * 60 * 1000)
  }
  if (c60 >= RATE_LIMIT_1HOUR && row.min60) {
    const next = new Date(new Date(row.min60).getTime() + 60 * 60 * 1000)
    if (!retryAt || next > retryAt) retryAt = next
  }
  if (retryAt) {
    const minutes = Math.max(1, Math.ceil((retryAt.getTime() - Date.now()) / 60000))
    const message = [
      'Too many sign-in attempts.',
      `For your security, we are pausing new sign-in links for this email until ${formatHHMMUtc(retryAt)} UTC (about ${minutes} minutes from now).`,
      'If you have a recent link in your email or spam folder, it should still work.',
      'If you need help, email support@career.club.',
    ].join('\n')
    return res.status(429).json({ error: message, retryAt: retryAt.toISOString() })
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

  // Build the verify URL from the request origin so preview deploys
  // authenticate against the preview domain and production against production.
  // The prior MAGIC_LINK_BASE_URL env override pinned every deploy to a single
  // host; removed because that was the exact cause of the preview-auth bug.
  const baseUrl = getRequestOrigin(req)
  const link = `${baseUrl}/auth/verify?token=${rawToken}`

  try {
    await sendMagicLinkEmail(normalizedEmail, link, firstName)
  } catch (err) {
    console.error('Resend send failure', err)
    return res.status(500).json({ error: 'Could not send email' })
  }

  return res.status(200).json({ ok: true })
}
