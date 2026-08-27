import { sql } from '../_lib/db.js'
import { hashToken, createSession, buildCookie } from '../_lib/session.js'

// Magic-link verification is deliberately tolerant of email-security scanners
// and link-preview bots, which pre-fetch the URLs inside an email before the
// human ever clicks. Two guards work together to stop the "sign-in loop" those
// pre-fetches used to cause (a scanner consumed the one-time token, so the
// human's real click landed on an already-used token and got bounced back to
// the sign-in screen):
//
//   1. Only GET redeems a token. HEAD (and any other method), which many
//      scanners use to probe a link, returns 200 with NO side effects — a scan
//      never creates a user, mints a session, or touches the token.
//
//   2. The token is redeemable for its full (short, 15-minute) expiry window
//      rather than exactly once. A scanner's GET no longer "steals" the token:
//      the human's real click still redeems it and mints their own session.
//      This trades strict one-time-use for a link that works more than once
//      within its 15-minute life — an accepted tradeoff (Bob, 2026-08-15) to
//      keep scanning email gateways from locking users out.
//
// Do NOT re-add a `used_at`-based single-use rejection here. That block is
// exactly what reintroduces the scanner loop. `used_at` is now first-use audit
// only (see the COALESCE update below).
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  // Guard 1: never mutate state on a non-GET probe.
  if (req.method !== 'GET') {
    return res.status(200).end()
  }

  const { token } = req.query
  if (!token || typeof token !== 'string') {
    return res.redirect(302, '/?auth=invalid')
  }

  const tokenHash = hashToken(token)
  const rows = await sql`
    SELECT email, first_name, last_name, expires_at, used_at,
           privacy_accepted_at, privacy_version, terms_accepted_at, terms_version,
           signup_source, signup_source_detail, track
    FROM magic_link_tokens
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `
  if (rows.length === 0) {
    return res.redirect(302, '/?auth=invalid')
  }
  const row = rows[0]
  // Guard 2: expiry is the only bar to redemption — a set `used_at` no longer
  // blocks, so a pre-fetched link still works when the human clicks it.
  if (new Date(row.expires_at) < new Date()) {
    return res.redirect(302, '/?auth=expired')
  }

  // Stamp first use for audit without blocking reuse within the expiry window.
  await sql`UPDATE magic_link_tokens SET used_at = COALESCE(used_at, NOW()) WHERE token_hash = ${tokenHash}`

  // Find or create user. ON CONFLICT keeps concurrent redemptions (a scanner's
  // GET racing the human's click on a brand-new signup) from colliding on the
  // UNIQUE email constraint — either redemption resolves to the same user row.
  const existing = await sql`SELECT id FROM users WHERE email = ${row.email} LIMIT 1`
  let userId
  if (existing.length > 0) {
    userId = existing[0].id
    await sql`UPDATE users SET last_login_at = NOW() WHERE id = ${userId}`
  } else {
    // Carry the acceptance captured on the signup form (stored on the token
    // row by request-link.js) onto the new users row. New accounts always
    // reach this branch with these populated; the legal gate in
    // request-link.js guarantees a token row cannot exist for a new account
    // without acceptance.
    // signup_source rides along on the same principle: captured on the form,
    // parked on the token, written once when the account is created. The
    // ON CONFLICT branch deliberately touches only last_login_at, so a racing
    // second redemption cannot overwrite it.
    // track (which product the account is on) rides the token for the same
    // reason and is written under the same once-only rule.
    const created = await sql`
      INSERT INTO users (email, first_name, last_name, last_login_at,
        privacy_accepted_at, privacy_version, terms_accepted_at, terms_version,
        signup_source, signup_source_detail, track)
      VALUES (${row.email}, ${row.first_name}, ${row.last_name}, NOW(),
        ${row.privacy_accepted_at}, ${row.privacy_version}, ${row.terms_accepted_at}, ${row.terms_version},
        ${row.signup_source || null}, ${row.signup_source_detail || null}, ${row.track || null})
      ON CONFLICT (email) DO UPDATE SET last_login_at = NOW()
      RETURNING id
    `
    userId = created[0].id
  }

  const userAgent = req.headers['user-agent'] || ''
  const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || ''
  const { token: sessionToken } = await createSession(userId, userAgent, ipAddress)

  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  const SESSION_DAYS = parseInt(process.env.SESSION_DAYS || '30', 10)
  res.setHeader('Set-Cookie', buildCookie(sessionToken, SESSION_DAYS * 24 * 60 * 60, isProd))
  return res.redirect(302, '/?auth=ok')
}
