// POST /api/account/accept-offer-disclaimer
// Records that the authenticated user has acknowledged the Offer &
// Negotiation AI-disclaimer gate (src/App.jsx, OfferDisclaimerGate.jsx).
// Called once per account before the first build of that card, and again
// if OFFER_DISCLAIMER_VERSION changes.

import { sql } from '../_lib/db.js'
import { getSessionUser } from '../_lib/session.js'
import { OFFER_DISCLAIMER_VERSION } from '../_lib/legal-versions.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await getSessionUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    await sql`
      UPDATE users
      SET offer_disclaimer_accepted_at = NOW(), offer_disclaimer_version = ${OFFER_DISCLAIMER_VERSION}
      WHERE id = ${user.id}
    `
    return res.status(200).json({ ok: true, version: OFFER_DISCLAIMER_VERSION })
  } catch (err) {
    console.error('[account/accept-offer-disclaimer] failure', err)
    return res.status(500).json({ error: 'Could not record acceptance' })
  }
}
