import { sql } from './_lib/db.js'
import { requireAuth } from './_lib/session.js'

// Returns this user's last 25 real (turn_kind='user') Coach exchanges, oldest
// first, so the client can rebuild the chat panel exactly as it read before a
// sign-out cleared the local copy. Deliberately excludes turn_kind values
// other than 'user'/null (proactive moments, session-open lines, etc.) --
// those render with banners/quick-reply affordances client-side that a plain
// message/reply pair cannot reconstruct; see the brief this shipped from
// (2026-09-13_coach-history-reload.md).
async function handler(req, res) {
  const rows = await sql`
    SELECT message, reply, created_at
    FROM chat_messages
    WHERE user_id = ${req.user.id}
      AND (turn_kind = 'user' OR turn_kind IS NULL)
    ORDER BY created_at DESC
    LIMIT 25
  `
  const turns = rows.reverse().flatMap(r => ([
    { role: 'user', content: r.message },
    { role: 'assistant', content: r.reply },
  ]))
  return res.status(200).json({ turns })
}

export default requireAuth(handler)
