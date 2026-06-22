// Per-reply thumbs feedback for My Coach. User-authenticated (magic-link session
// via getSessionUser — NOT ADMIN_TOKEN). Records/updates a rating (+ optional
// comment) for a reply the requester OWNS; ownership is enforced in the WHERE so a
// user can only rate their own message. Ratings are changeable and undoable
// (rating:null clears the rating, comment, and timestamp).
//
// CSRF: the session cookie is HttpOnly + SameSite=Lax, so a cross-site POST won't
// carry it and getSessionUser returns null (401) — no separate origin check needed.
//
// Privacy: rating_comment is PII. It is stored here and only ever surfaced on the
// admin dashboard behind the content-review gate, never alongside identity.

import { getSessionUser } from './_lib/session.js'
import { sql } from './_lib/db.js'

const MAX_COMMENT = 2000

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getSessionUser(req, res)
  if (!user) return res.status(401).json({ error: 'Not signed in' })

  const { messageId, rating, comment } = req.body || {}
  if (!messageId || typeof messageId !== 'string') {
    return res.status(400).json({ error: 'messageId required' })
  }
  // rating must be exactly 1, -1, or null (null = undo/clear).
  if (!(rating === 1 || rating === -1 || rating === null)) {
    return res.status(400).json({ error: 'rating must be 1, -1, or null' })
  }

  // null rating = full undo: clear rating, comment, timestamp. Otherwise stamp now
  // and store the (capped) comment if one was supplied.
  const isClear = rating === null
  const commentVal = (!isClear && typeof comment === 'string' && comment.trim())
    ? comment.trim().slice(0, MAX_COMMENT)
    : null
  const ratedAt = isClear ? null : new Date().toISOString()

  try {
    const rows = await sql`
      UPDATE chat_messages
      SET rating = ${rating}, rating_comment = ${commentVal}, rated_at = ${ratedAt}
      WHERE id = ${messageId} AND user_id = ${user.id}
      RETURNING id
    `
    // 0 rows == not the requester's message (or it doesn't exist). Same response
    // either way so it can't be used to probe for others' message ids.
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Message not found' })
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('coach-rate: update failed', err && err.message)
    return res.status(500).json({ error: 'Update failed' })
  }
}
