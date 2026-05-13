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
//
// Why this version logs aggressively and double-deletes by email: an earlier
// version of this endpoint reported success (200, four 200-OK Neon queries)
// while the user row survived. The DELETE was matching zero rows even though
// the immediately-prior SELECT had returned the row by the same id. The
// fallback DELETE by email catches that case and the RETURNING clauses plus
// console.logs make the discrepancy visible in Vercel logs the next time it
// happens.

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

  console.log('[account/delete] session user:', {
    id: user.id,
    idType: typeof user.id,
    idLen: user.id && user.id.length,
    email: user.email,
  })

  try {
    // Chat history. RETURNING captures actual deleted ids. Wrapped because
    // the table might not exist on some preview branches; the user delete is
    // what matters for Start Fresh.
    let chatDeleted = []
    try {
      chatDeleted = await sql`DELETE FROM chat_messages WHERE user_id = ${user.id} RETURNING id`
    } catch (chatErr) {
      console.error('[account/delete] chat_messages delete failed (continuing):', chatErr)
    }
    console.log('[account/delete] chat_messages deleted:', chatDeleted.length)

    // Primary delete by id (matches the SELECT in getSessionUser).
    const byId = await sql`DELETE FROM users WHERE id = ${user.id} RETURNING id, email`
    console.log('[account/delete] users deleted by id:', byId)

    // Fallback delete by email. If byId matched zero rows but the user row
    // still exists for that email, this catches it. Defensive against any id
    // type/format drift between the SELECT and DELETE round trips that we
    // have not been able to reproduce locally but observed in production.
    let byEmail = []
    if (byId.length === 0 && user.email) {
      byEmail = await sql`DELETE FROM users WHERE email = ${user.email} RETURNING id, email`
      console.log('[account/delete] users deleted by email (fallback):', byEmail)
    }

    // Post-verify. If a row for this email still exists, something is very
    // wrong and we should NOT report success.
    const stillThere = await sql`SELECT id, email FROM users WHERE email = ${user.email} LIMIT 1`
    console.log('[account/delete] post-verify rows for email:', stillThere)

    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
    res.setHeader('Set-Cookie', clearCookie(isProd))

    const usersDeleted = byId.length + byEmail.length
    if (usersDeleted === 0 || stillThere.length > 0) {
      console.error('[account/delete] FAILED to remove user row', {
        sessionUserId: user.id,
        sessionUserEmail: user.email,
        byId,
        byEmail,
        stillThere,
      })
      return res.status(500).json({
        error: 'Account row not deleted',
        diag: {
          sessionUserId: user.id,
          byIdCount: byId.length,
          byEmailCount: byEmail.length,
          stillThereCount: stillThere.length,
        },
      })
    }

    return res.status(200).json({
      success: true,
      deleted: { users: usersDeleted, chatMessages: chatDeleted.length },
    })
  } catch (err) {
    console.error('[account/delete] error:', err)
    return res.status(500).json({ error: 'Failed to delete account' })
  }
}
