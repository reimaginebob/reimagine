// POST /api/account/send-legal-update
// Admin-only verification trigger for the legal-update notification email.
//
// SAFETY: this endpoint never iterates users and never sends to anyone other
// than the requesting admin's own verified address. It exists so the email
// template can be verified by sending a single test to bob@career.club. For a
// real future rollout, a separate, deliberate batch mechanism would be built;
// this is intentionally not that.
//
// Body: { summary?: string, privacy?: boolean, terms?: boolean }

import { getSessionUser } from '../_lib/session.js'
import { sendLegalUpdateEmail } from '../_lib/email.js'

const ADMIN_EMAIL = 'bob@career.club'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await getSessionUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  if ((user.email || '').trim().toLowerCase() !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { summary, privacy, terms } = req.body || {}
  const docs = { privacy: privacy !== false, terms: terms !== false }
  if (!docs.privacy && !docs.terms) {
    return res.status(400).json({ error: 'Specify at least one agreement' })
  }
  const summaryText =
    typeof summary === 'string' && summary.trim()
      ? summary.trim()
      : 'This is a verification send of the legal-update notification template. No agreement has actually changed.'

  try {
    // Recipient is forced to the admin's own address. Not configurable.
    await sendLegalUpdateEmail(ADMIN_EMAIL, summaryText, docs, user.first_name)
    return res.status(200).json({ ok: true, sentTo: ADMIN_EMAIL })
  } catch (err) {
    console.error('[account/send-legal-update] failure', err)
    return res.status(500).json({ error: 'Could not send test email' })
  }
}
