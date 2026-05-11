import { getSessionToken, deleteSession, clearCookie } from '../_lib/session.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = getSessionToken(req)
  if (token) await deleteSession(token)

  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  res.setHeader('Set-Cookie', clearCookie(isProd))
  return res.status(200).json({ ok: true })
}
