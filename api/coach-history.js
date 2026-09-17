import { sql } from './_lib/db.js'
import { requireAuth } from './_lib/session.js'

// Returns this user's last 25 real (turn_kind='user') Coach exchanges, oldest
// first, so the client can rebuild the chat panel exactly as it read before a
// sign-out cleared the local copy. Deliberately excludes turn_kind values
// other than 'user'/null (proactive moments, session-open lines, etc.) --
// those render with banners/quick-reply affordances client-side that a plain
// message/reply pair cannot reconstruct; see the brief this shipped from
// (2026-09-13_coach-history-reload.md).
//
// chat_cleared_at (2026-09-16, My Coach's Clear button, see migrations/
// 2026-09-16_coach-chat-clear.sql) excludes anything at or before that
// timestamp -- a display boundary the person set themselves, not a data
// loss. The rows still exist; this is the one read that respects the cut.
async function handler(req, res) {
  const rows = await sql`
    SELECT m.message, m.reply, m.created_at
    FROM chat_messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.user_id = ${req.user.id}
      AND (m.turn_kind = 'user' OR m.turn_kind IS NULL)
      AND (u.chat_cleared_at IS NULL OR m.created_at > u.chat_cleared_at)
    ORDER BY m.created_at DESC
    LIMIT 25
  `
  const turns = rows.reverse().flatMap(r => ([
    { role: 'user', content: r.message },
    { role: 'assistant', content: r.reply },
  ]))
  return res.status(200).json({ turns })
}

export default requireAuth(handler)
