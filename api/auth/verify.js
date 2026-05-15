import { sql } from '../_lib/db.js'
import { hashToken, createSession, buildCookie } from '../_lib/session.js'

export default async function handler(req, res) {
  const { token } = req.query
  if (!token || typeof token !== 'string') {
    return res.redirect(302, '/?auth=invalid')
  }

  const tokenHash = hashToken(token)
  const rows = await sql`
    SELECT email, first_name, last_name, expires_at, used_at,
           privacy_accepted_at, privacy_version, terms_accepted_at, terms_version
    FROM magic_link_tokens
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `
  if (rows.length === 0) {
    return res.redirect(302, '/?auth=invalid')
  }
  const row = rows[0]
  if (row.used_at) {
    return res.redirect(302, '/?auth=used')
  }
  if (new Date(row.expires_at) < new Date()) {
    return res.redirect(302, '/?auth=expired')
  }

  await sql`UPDATE magic_link_tokens SET used_at = NOW() WHERE token_hash = ${tokenHash}`

  // Find or create user
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
    const created = await sql`
      INSERT INTO users (email, first_name, last_name, last_login_at,
        privacy_accepted_at, privacy_version, terms_accepted_at, terms_version)
      VALUES (${row.email}, ${row.first_name}, ${row.last_name}, NOW(),
        ${row.privacy_accepted_at}, ${row.privacy_version}, ${row.terms_accepted_at}, ${row.terms_version})
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
