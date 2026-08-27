// Admin control to move an existing account onto a product track, or back to
// the standard product, by email.
//
// The track normally arrives with the account: the entry URL carries
// ?track=independent, it rides the magic-link token through the user's inbox,
// and api/auth/verify.js writes it once at account creation. That path covers
// everyone who follows the link they were sent. This endpoint exists for the
// case it does not cover -- a pilot tester who signed up through the normal
// front door before anyone sent them the right link, and now has an account on
// the wrong side of the fence.
//
// Deliberately a separate control rather than letting a sign-in switch tracks:
// the track decides which product someone is using, and their existing work was
// generated under that framing. Moving an account is a decision, so it gets a
// button rather than a URL anyone can send.
//
// Auth: Bearer ADMIN_TOKEN (same token as the analytics dashboard, which calls
// this). GET lists everyone currently on a track; POST { email, track } where
// track is a code from src/tracks.js, or null / '' to return the account to the
// standard product.

import { sql } from '../_lib/db.js'
import { isTrack } from '../../src/tracks.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const expected = process.env.ADMIN_TOKEN
  if (!expected) {
    console.error('admin/track-access: ADMIN_TOKEN not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  if ((req.headers.authorization || '') !== `Bearer ${expected}`) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT email, track FROM users WHERE track IS NOT NULL ORDER BY lower(email)`
      return res.status(200).json({ members: rows.map(r => ({ email: r.email, track: r.track })) })
    }

    const body = req.body || {}
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    // An explicit null / empty string is the documented way to clear a track and
    // return the account to the standard product, so it is not a missing value.
    const raw = body.track
    const clearing = raw === null || raw === '' || raw === undefined
    if (!email) return res.status(400).json({ error: 'email required' })
    if (!clearing && !isTrack(raw)) {
      return res.status(400).json({ error: 'track must be a known code, or null to clear it' })
    }
    const next = clearing ? null : raw

    const rows = await sql`
      UPDATE users SET track = ${next}
      WHERE lower(email) = lower(${email})
      RETURNING email, track`
    if (rows.length === 0) return res.status(404).json({ error: 'No account with that email' })
    console.log('admin/track-access', { email, track: rows[0].track })
    return res.status(200).json({ ok: true, email: rows[0].email, track: rows[0].track })
  } catch (err) {
    console.error('admin/track-access: query failed', err && err.message)
    return res.status(500).json({ error: 'Update failed' })
  }
}
