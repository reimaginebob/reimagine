// POST /api/account/delete
// Deletes the authenticated user's row and associated data, then clears the
// session cookie. Lets the same email sign back in as a brand-new user.
//
// Tables affected (verified against live schema in db/migrations/001_init.sql
// and api/chat.js):
//   - chat_messages WHERE user_id = ${user.id}  (explicit DELETE; the
//     migration for this table is not in repo but api/chat.js confirms the
//     user_id column. Deleting first defensively avoids FK constraint
//     errors if the table lacks ON DELETE CASCADE.)
//   - users WHERE id = ${user.id}  (the main row; ON DELETE CASCADE on
//     sessions.user_id automatically clears the user's session rows.)
//
// Tables intentionally kept:
//   - magic_link_tokens  (keyed by email, no FK to users; tokens expire on
//     their own and do not block the user from signing back in with a new
//     magic link.)

import { sql } from '../_lib/db.js'
import { getSessionUser, clearCookie } from '../_lib/session.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await getSessionUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    // Delete chat history first. If chat_messages does not have ON DELETE
    // CASCADE, deleting the user row would fail with a FK constraint error.
    try {
      await sql`DELETE FROM chat_messages WHERE user_id = ${user.id}`
    } catch (chatErr) {
      // If chat_messages table is missing or the column name differs, log
      // but continue. The main user delete is what matters for Start Fresh.
      console.error('chat_messages delete failed (continuing):', chatErr)
    }

    // Main delete. ON DELETE CASCADE on sessions.user_id clears sessions
    // automatically.
    await sql`DELETE FROM users WHERE id = ${user.id}`

    // Clear the session cookie so the browser stops sending the stale token.
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
    res.setHeader('Set-Cookie', clearCookie(isProd))

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Account delete error:', err)
    return res.status(500).json({ error: 'Failed to delete account' })
  }
}
