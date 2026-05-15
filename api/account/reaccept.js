// POST /api/account/reaccept
// Records that the authenticated user has re-accepted the latest MATERIAL
// version of the Privacy Agreement and/or Terms of Service. Called by
// src/LegalReacceptanceModal.jsx. In v1 this is never triggered (no material
// change has shipped); it is scaffolding for future version bumps.
//
// Body: { privacy?: boolean, terms?: boolean }

import { sql } from '../_lib/db.js'
import { getSessionUser } from '../_lib/session.js'
import { PRIVACY_VERSION_MATERIAL, TOS_VERSION_MATERIAL } from '../_lib/legal-versions.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await getSessionUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const { privacy, terms } = req.body || {}
  if (privacy !== true && terms !== true) {
    return res.status(400).json({ error: 'Nothing to re-accept' })
  }

  try {
    if (privacy === true) {
      await sql`
        UPDATE users
        SET privacy_accepted_at = NOW(), privacy_version = ${PRIVACY_VERSION_MATERIAL}
        WHERE id = ${user.id}
      `
    }
    if (terms === true) {
      await sql`
        UPDATE users
        SET terms_accepted_at = NOW(), terms_version = ${TOS_VERSION_MATERIAL}
        WHERE id = ${user.id}
      `
    }
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[account/reaccept] failure', err)
    return res.status(500).json({ error: 'Could not record acceptance' })
  }
}
