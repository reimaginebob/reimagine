import crypto from 'node:crypto'
import { sql } from './db.js'

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'pe_session'
const SESSION_DAYS = parseInt(process.env.SESSION_DAYS || '30', 10)

export function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url')
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function buildCookie(token, maxAgeSeconds, isProd) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ]
  if (isProd) parts.push('Secure')
  return parts.join('; ')
}

export function clearCookie(isProd) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ]
  if (isProd) parts.push('Secure')
  return parts.join('; ')
}

export function getSessionToken(req) {
  const cookieHeader = req.headers.cookie || ''
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`))
  return match ? match[1] : null
}

export async function createSession(userId, userAgent, ipAddress) {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await sql`
    INSERT INTO sessions (token, user_id, expires_at, user_agent, ip_address)
    VALUES (${token}, ${userId}, ${expiresAt.toISOString()}, ${userAgent}, ${ipAddress})
  `
  return { token, expiresAt }
}

export async function getSessionUser(req) {
  const token = getSessionToken(req)
  if (!token) return null
  const rows = await sql`
    SELECT u.id, u.email, u.first_name, u.last_name, u.created_at, u.last_login_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token} AND s.expires_at > NOW()
    LIMIT 1
  `
  if (rows.length === 0) return null
  await sql`UPDATE sessions SET last_used_at = NOW() WHERE token = ${token}`
  return rows[0]
}

export async function deleteSession(token) {
  await sql`DELETE FROM sessions WHERE token = ${token}`
}

export function requireAuth(handler) {
  return async (req, res) => {
    const user = await getSessionUser(req)
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }
    req.user = user
    return handler(req, res)
  }
}

export const SESSION_DAYS_VALUE = SESSION_DAYS
export const SESSION_COOKIE_NAME_VALUE = SESSION_COOKIE_NAME
