// Vercel cron endpoint. Fires once a day per the schedule in vercel.json
// (currently 0 12 * * * = noon UTC = 7am Eastern during EST, 8am during EDT).
// Queries Neon for survey_responses in the last 24 hours and emails a digest
// to bob@career.club via Resend. On zero-response days the email STILL sends,
// with a heartbeat body, so the absence of a daily email is itself the signal
// that the cron is broken.
//
// Auth gate: Vercel attaches Authorization: Bearer <CRON_SECRET> to cron-
// triggered requests. We compare strictly; mismatch returns 403 and no
// email is sent.
//
// Errors are NOT silently swallowed. Database failures and Resend failures
// both raise to 500 so the cron run shows red in the Vercel dashboard and
// Bob notices the missing email.

import { Resend } from 'resend'
import { sql } from '../_lib/db.js'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_FROM = process.env.EMAIL_FROM
const TO_EMAIL = 'bob@career.club'

function escapeHtml(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDistribution(rows) {
  const buckets = new Array(11).fill(0)
  for (const r of rows) {
    const n = Number(r.nps_score)
    if (Number.isInteger(n) && n >= 0 && n <= 10) buckets[n]++
  }
  return buckets.map((c, i) => `${i}:${c}`).join('  ')
}

function average(rows) {
  if (rows.length === 0) return null
  const total = rows.reduce((a, r) => a + Number(r.nps_score || 0), 0)
  return (total / rows.length).toFixed(2)
}

function formatRowHtml(r) {
  const submitted = r.created_at ? new Date(r.created_at).toISOString() : '(unknown)'
  const user = r.user_id ? r.user_id : 'anonymous'
  const lines = [
    `<p><strong>NPS:</strong> ${escapeHtml(String(r.nps_score))}</p>`,
    r.most_valuable ? `<p><strong>Most valuable:</strong> ${escapeHtml(r.most_valuable)}</p>` : '',
    r.confidence ? `<p><strong>Confidence change:</strong> ${escapeHtml(r.confidence)}</p>` : '',
    r.accuracy ? `<p><strong>Accuracy:</strong> ${escapeHtml(r.accuracy)}</p>` : '',
    r.chosen_role ? `<p><strong>Chosen role:</strong> ${escapeHtml(r.chosen_role)}</p>` : '',
    r.open_text
      ? `<p><strong>Open text:</strong></p><blockquote style="border-left: 3px solid #C8924A; padding-left: 12px; color: #1A2540; margin: 0 0 12px;">${escapeHtml(r.open_text).replace(/\n/g, '<br>')}</blockquote>`
      : '',
    `<p style="font-size: 13px; color: #6B7280;">User: ${escapeHtml(user)}<br>Submitted: ${escapeHtml(submitted)}</p>`,
    `<hr style="border: none; border-top: 1px solid #E2E5EA; margin: 16px 0;">`,
  ]
  return lines.filter(Boolean).join('\n')
}

function formatRowText(r) {
  const submitted = r.created_at ? new Date(r.created_at).toISOString() : '(unknown)'
  const user = r.user_id ? r.user_id : 'anonymous'
  return [
    `NPS: ${r.nps_score}`,
    r.most_valuable ? `Most valuable: ${r.most_valuable}` : null,
    r.confidence ? `Confidence change: ${r.confidence}` : null,
    r.accuracy ? `Accuracy: ${r.accuracy}` : null,
    r.chosen_role ? `Chosen role: ${r.chosen_role}` : null,
    r.open_text ? `Open text: ${r.open_text}` : null,
    `User: ${user}`,
    `Submitted: ${submitted}`,
    '---',
  ]
    .filter(Boolean)
    .join('\n')
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('survey/daily-digest: CRON_SECRET not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  const auth = req.headers.authorization || ''
  if (auth !== `Bearer ${expected}`) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  let rows
  try {
    rows = await sql`
      SELECT id, nps_score, most_valuable, confidence, accuracy, open_text, chosen_role, created_at, user_id
      FROM survey_responses
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
    `
  } catch (err) {
    console.error('survey/daily-digest: query failed', err)
    return res.status(500).json({ error: 'Query failed' })
  }

  const count = rows.length
  const today = new Date().toISOString().slice(0, 10)
  const subject = `Reimagine NPS digest, ${today}`
  let textBody
  let htmlBody

  if (count === 0) {
    textBody = 'No responses in the last 24 hours. Digest is alive.'
    htmlBody = `<!DOCTYPE html><html><body style="font-family: Georgia, serif; color: #1A2540; line-height: 1.6; max-width: 640px; margin: 0 auto; padding: 32px 16px;">
<h2 style="font-family: Georgia, serif; font-size: 22px; color: #1A2540; margin: 0 0 12px;">Reimagine NPS digest, ${today}</h2>
<p style="font-size: 17px;">No responses in the last 24 hours. Digest is alive.</p>
<p style="font-size: 13px; color: #9CA3AF; margin-top: 32px;">If this email stops arriving for more than 24 hours, the cron is broken; check Vercel logs and CRON_SECRET.</p>
</body></html>`
  } else {
    const avg = average(rows)
    const dist = formatDistribution(rows)
    const summary = `${count} response${count === 1 ? '' : 's'} in the last 24 hours. Average NPS: ${avg}. Distribution (score:count): ${dist}.`

    textBody = [summary, '', ...rows.map(formatRowText)].join('\n\n')
    htmlBody = `<!DOCTYPE html><html><body style="font-family: Georgia, serif; color: #1A2540; line-height: 1.6; max-width: 640px; margin: 0 auto; padding: 32px 16px;">
<h2 style="font-family: Georgia, serif; font-size: 22px; color: #1A2540; margin: 0 0 12px;">Reimagine NPS digest, ${today}</h2>
<p style="font-size: 17px;"><strong>${count}</strong> response${count === 1 ? '' : 's'} in the last 24 hours.</p>
<p style="font-size: 17px;"><strong>Average NPS:</strong> ${avg}</p>
<p style="font-size: 15px; color: #4A5568;"><strong>Distribution (score:count):</strong> ${dist}</p>
<hr style="border: none; border-top: 2px solid #C8924A; margin: 20px 0;">
${rows.map(formatRowHtml).join('\n')}
</body></html>`
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: TO_EMAIL,
      subject,
      text: textBody,
      html: htmlBody,
    })
    if (error) {
      const message = error.message || JSON.stringify(error)
      throw new Error(`Resend send failed: ${message}`)
    }
    console.log('survey/daily-digest: sent', { id: data?.id, count })
  } catch (err) {
    console.error('survey/daily-digest: resend failed', err)
    return res.status(500).json({ error: 'Email send failed' })
  }

  return res.status(200).json({ ok: true, count, sent: true })
}
