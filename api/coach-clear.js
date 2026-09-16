// My Coach's "Clear" button (src/components/Chat.jsx). Stamps
// users.chat_cleared_at so the visible transcript stays empty on every
// signed-in device going forward -- see migrations/2026-09-16_coach-chat-
// clear.sql for why this is a display boundary, not a delete: chat_messages
// rows are untouched, and GET /api/coach-history (the rehydration read on
// sign-in / reload) is the only reader that filters on this column.
//
// POST only, session-authenticated (requireAuth), no body. Best-effort from
// the client's point of view -- Chat.jsx fires this alongside its own local
// reset rather than blocking on it, the same fire-and-forget shape as
// api/coach-prompt-engagement.js -- but it still does the real write and
// returns a real status so a caller that wants to know can check.
import { sql } from './_lib/db.js'
import { requireAuth } from './_lib/session.js'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    // RETURNING (2026-09-16 follow-up): the device that tapped Clear never
    // recorded its own reimagine_chat_cleared_at_applied marker (Chat.jsx),
    // so its NEXT load saw /api/me's chat_cleared_at as newer than the
    // (missing) marker and reset the transcript again -- wiping any real
    // conversation held after the clear. Handing the exact value the
    // database just stamped back to the caller lets it record that same
    // value as already-applied immediately, closing that gap.
    const rows = await sql`UPDATE users SET chat_cleared_at = NOW() WHERE id = ${req.user.id} RETURNING chat_cleared_at`
    return res.status(200).json({ ok: true, clearedAt: rows[0].chat_cleared_at })
  } catch (err) {
    console.error('coach-clear: update failed', err && err.message)
    return res.status(500).json({ error: 'Could not clear.' })
  }
}

export default requireAuth(handler)
