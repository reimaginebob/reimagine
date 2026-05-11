import { sql } from '../_lib/db.js'
import { requireAuth } from '../_lib/session.js'

async function handler(req, res) {
  const rows = await sql`SELECT profile_state, profile_updated_at FROM users WHERE id = ${req.user.id} LIMIT 1`
  if (rows.length === 0) return res.status(404).json({ error: 'User not found' })
  return res.status(200).json({ profile: rows[0].profile_state, updatedAt: rows[0].profile_updated_at })
}

export default requireAuth(handler)
