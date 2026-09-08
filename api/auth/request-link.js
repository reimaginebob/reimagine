import { sql } from '../_lib/db.js'
import { generateToken, hashToken } from '../_lib/session.js'
import { sendMagicLinkEmail } from '../_lib/email.js'
import { isSignupSource } from '../../src/signup-sources.js'
import { isTrack } from '../../src/tracks.js'
import { isAllowedHost } from '../_lib/allowed-hosts.js'
import { getClientIp, checkIpRateLimit, logIpEvent } from '../_lib/auth-rate-limit.js'

const TOKEN_EXPIRY_MINUTES = 15
// Rate limits keyed by email. Both windows must clear for a request to pass.
// 5 / 15 minutes covers mistypes, spam-folder retry, and a fresh link after
// expiry. 20 / hour catches abusive patterns while staying well below
// Resend's per-account ceilings.
const RATE_LIMIT_15MIN = 5
const RATE_LIMIT_1HOUR = 20
// Per-IP, alongside the email-keyed limits above (finding #2.3): the email
// limit alone does nothing against one caller working through a list of
// many different target addresses. Higher than the email limit on purpose --
// one IP can legitimately represent several people (a household, an office),
// and the email limit is still doing the tighter per-recipient work.
const IP_RATE_LIMIT_WINDOW_MIN = 15
const IP_RATE_LIMIT_MAX = 15
// firstName/lastName are checked for non-empty below but had no upper
// bound (finding #2.3). 100 chars is generous for a real name and matches
// the existing signupSourceDetail precedent in this file.
const MAX_NAME_CHARS = 100

function getRequestOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  // Prelaunch audit, finding #2.3: x-forwarded-host (and, on a raw request
  // without Vercel in front, the Host header itself) is caller-supplied.
  // Vercel's edge probably normalizes it, but "probably" is exactly what the
  // audit flagged as unverified -- pin it to the same allowlist api/claude.js
  // already trusts for its origin check, and fall back to the production
  // host rather than build a magic link against an attacker-chosen domain.
  const safeHost = isAllowedHost(host) ? host : 'reimagine.career.club'
  return `${proto}://${safeHost}`
}

function formatHHMMUtc(date) {
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Per-IP limit (finding #2.3), independent of which recipient email the
  // caller sends -- see the constants above. Logged and checked before any
  // other work, same "gate first" shape as the email-keyed limit below.
  const clientIp = getClientIp(req)
  const ipCheck = await checkIpRateLimit('request-link', clientIp, { windowMinutes: IP_RATE_LIMIT_WINDOW_MIN, limit: IP_RATE_LIMIT_MAX })
  if (ipCheck.limited) {
    return res.status(429).json({ error: 'Too many sign-in requests from this network. Try again shortly.', retryAt: ipCheck.retryAt.toISOString() })
  }
  await logIpEvent('request-link', clientIp)

  const { email, firstName, lastName, privacyAccepted, privacyVersion, termsAccepted, termsVersion,
    signupSource, signupSourceDetail, track } = req.body || {}
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' })
  }
  const normalizedEmail = email.trim().toLowerCase()
  // Capped, not just presence-checked (finding #2.3) -- see MAX_NAME_CHARS.
  const cappedFirstName = typeof firstName === 'string' ? firstName.trim().slice(0, MAX_NAME_CHARS) : firstName
  const cappedLastName = typeof lastName === 'string' ? lastName.trim().slice(0, MAX_NAME_CHARS) : lastName

  const existing = await sql`SELECT 1 FROM users WHERE email = ${normalizedEmail} LIMIT 1`
  const isNewAccount = existing.length === 0
  if (isNewAccount) {
    if (!cappedFirstName || typeof cappedFirstName !== 'string' || !cappedFirstName.trim()) {
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

  // "How did you hear about us", carried the same way. New accounts only: a
  // returning user is not asked, and overwriting an existing answer would
  // replace a real first touch with a later recollection. An unrecognised code
  // is dropped rather than rejected -- the question is optional, and a failed
  // sign-in would be a steep price for a stale dropdown on a cached page.
  const tokenSource = (isNewAccount && isSignupSource(signupSource)) ? signupSource : null
  const tokenSourceDetail = (tokenSource && typeof signupSourceDetail === 'string' && signupSourceDetail.trim())
    ? signupSourceDetail.trim().slice(0, 200)
    : null

  // Which product track this account is arriving on, carried the same way and
  // for the same reason: the entry URL holds ?track=independent, but the click
  // that actually creates the account comes from the user's inbox on a URL that
  // no longer has it. New accounts only -- a returning user signing in through
  // the independent URL keeps whatever track they already have, because the
  // track governs which product they are using and their existing work was
  // built under it. Moving an existing account is the admin control's job
  // (api/admin/track-access.js), never a side effect of a sign-in. An
  // unrecognised code is dropped rather than rejected, on the same principle as
  // signup_source above: a failed sign-in is far too steep a price for a
  // mistyped link.
  const tokenTrack = (isNewAccount && isTrack(track)) ? track : null

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

  await sql`
    INSERT INTO magic_link_tokens (token_hash, email, first_name, last_name, expires_at, user_agent, ip_address, privacy_accepted_at, privacy_version, terms_accepted_at, terms_version, signup_source, signup_source_detail, track)
    VALUES (${tokenHash}, ${normalizedEmail}, ${cappedFirstName || null}, ${cappedLastName || null}, ${expiresAt.toISOString()}, ${userAgent}, ${clientIp}, ${tokenPrivacyAt}, ${tokenPrivacyVersion}, ${tokenTermsAt}, ${tokenTermsVersion}, ${tokenSource}, ${tokenSourceDetail}, ${tokenTrack})
  `

  // Build the verify URL from the request origin so preview deploys
  // authenticate against the preview domain and production against production.
  // The prior MAGIC_LINK_BASE_URL env override pinned every deploy to a single
  // host; removed because that was the exact cause of the preview-auth bug.
  const baseUrl = getRequestOrigin(req)
  const link = `${baseUrl}/auth/verify?token=${rawToken}`

  try {
    await sendMagicLinkEmail(normalizedEmail, link, cappedFirstName)
  } catch (err) {
    console.error('Resend send failure', err)
    return res.status(500).json({ error: 'Could not send email' })
  }

  return res.status(200).json({ ok: true })
}
