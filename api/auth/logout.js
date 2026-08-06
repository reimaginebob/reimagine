import { getSessionToken, deleteSession, clearCookie } from '../_lib/session.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Clear the cookie FIRST and unconditionally — no cookie means no auth, so the
  // user is signed out even if the session-row delete below hiccups. (Previously
  // deleteSession ran first with no guard: if it threw, logout 500'd having
  // cleared nothing, and the client treated that as success.)
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  res.setHeader('Set-Cookie', clearCookie(isProd))

  const token = getSessionToken(req)
  if (token) {
    try { await deleteSession(token) }
    catch (err) { console.error('logout: deleteSession failed (cookie already cleared)', err) }
  }
  return res.status(200).json({ ok: true })
}
