import { sql } from '../_lib/db.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email } = req.body || {}
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const rows = await sql`SELECT 1 FROM users WHERE email = ${normalizedEmail} LIMIT 1`

  return res.status(200).json({ exists: rows.length > 0 })
}
