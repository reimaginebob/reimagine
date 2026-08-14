// Hourly rogue-activity watchdog. Emails the operator (ADMIN_EMAILS) when an
// account — or the whole app — creates an abnormal number of playbooks in the
// last hour. Detection only: it never blocks anyone. This is Phase 1, built
// entirely on data we already keep (each saved playbook carries a createdAt in
// users.profile_state->'savedPlaybooks'); no new table.
//
// Phase 2 (a generation-events counter) extends this file to also catch
// generation/GTM-volume spikes and to enable optional auto-throttling; see the
// generation section below, which no-ops until that table exists.
//
// Auth mirrors the other crons: GET + Authorization: Bearer ${CRON_SECRET}.
// Scheduled hourly in vercel.json. Quiet when nothing trips (no email, 200 with
// a summary). Internal @career.club addresses are excluded from the PER-USER
// alert so admin testing does not self-page; app-wide totals include everyone.

import { sql } from '../_lib/db.js'
import { sendActivityAlertEmail } from '../_lib/email.js'

export const config = { maxDuration: 30 }

// Tunable starting thresholds. Set well above a real power user's peak so the
// alert only fires on genuinely abnormal volume; tighten once a baseline is seen.
const PER_USER_PLAYBOOKS_HR = 6   // a normal user builds a handful total; 6 in one hour is already unusual — alert early
const TOTAL_PLAYBOOKS_HR = 20     // app-wide spike — a runaway loop/bug or coordinated abuse

// Generation thresholds are used only once the Phase 2 generation_events table
// exists; the query below is wrapped so this file runs safely without it.
const PER_USER_GENERATIONS_HR = 80   // ~a handful of playbook builds' worth of generation calls
const TOTAL_GENERATIONS_HR = 250

function parseRecipients(raw) {
  return (raw || '').split(',').map(s => s.trim()).filter(Boolean)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('activity-watchdog: CRON_SECRET not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  if ((req.headers.authorization || '') !== `Bearer ${expected}`) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const alerts = []
  const summary = {}

  // --- Playbook-creation spikes (Phase 1; always on) ---
  try {
    const perUser = await sql`
      SELECT u.email AS email, COUNT(*)::int AS n
      FROM users u
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(u.profile_state->'savedPlaybooks', '[]'::jsonb)) AS pb
      WHERE (pb->>'createdAt')::timestamptz >= NOW() - INTERVAL '1 hour'
        AND lower(u.email) NOT LIKE '%@career.club'
      GROUP BY u.email
      HAVING COUNT(*) >= ${PER_USER_PLAYBOOKS_HR}
      ORDER BY n DESC
    `
    const totalRows = await sql`
      SELECT COUNT(*)::int AS total
      FROM users u
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(u.profile_state->'savedPlaybooks', '[]'::jsonb)) AS pb
      WHERE (pb->>'createdAt')::timestamptz >= NOW() - INTERVAL '1 hour'
    `
    const totalPlaybooks = (totalRows[0] && totalRows[0].total) || 0
    summary.playbooks = { totalLastHour: totalPlaybooks, offenders: perUser.length }
    for (const r of perUser) {
      alerts.push(`Account ${r.email} built ${r.n} playbooks in the last hour (alert threshold ${PER_USER_PLAYBOOKS_HR}).`)
    }
    if (totalPlaybooks >= TOTAL_PLAYBOOKS_HR) {
      alerts.push(`App-wide: ${totalPlaybooks} playbooks built in the last hour across all users (alert threshold ${TOTAL_PLAYBOOKS_HR}).`)
    }
  } catch (err) {
    console.error('activity-watchdog: playbook query failed', err && err.message)
    summary.playbooksError = true
  }

  // --- Generation-volume spikes (Phase 2; no-ops until generation_events exists) ---
  try {
    const genPerUser = await sql`
      SELECT u.email AS email, COUNT(*)::int AS n
      FROM generation_events g
      JOIN users u ON u.id = g.user_id
      WHERE g.created_at >= NOW() - INTERVAL '1 hour'
        AND lower(u.email) NOT LIKE '%@career.club'
      GROUP BY u.email
      HAVING COUNT(*) >= ${PER_USER_GENERATIONS_HR}
      ORDER BY n DESC
    `
    const genTotalRows = await sql`
      SELECT COUNT(*)::int AS total FROM generation_events WHERE created_at >= NOW() - INTERVAL '1 hour'
    `
    const totalGenerations = (genTotalRows[0] && genTotalRows[0].total) || 0
    summary.generations = { totalLastHour: totalGenerations, offenders: genPerUser.length }
    for (const r of genPerUser) {
      alerts.push(`Account ${r.email} triggered ${r.n} generations in the last hour (alert threshold ${PER_USER_GENERATIONS_HR}).`)
    }
    if (totalGenerations >= TOTAL_GENERATIONS_HR) {
      alerts.push(`App-wide: ${totalGenerations} generations in the last hour across all users (alert threshold ${TOTAL_GENERATIONS_HR}).`)
    }
  } catch {
    // generation_events not migrated yet (Phase 2) — skip this section silently.
    summary.generations = { pending: true }
  }

  // --- Notify the operator only when something tripped ---
  let emailed = false
  if (alerts.length) {
    const recipients = parseRecipients(process.env.ADMIN_EMAILS)
    if (recipients.length) {
      try {
        await sendActivityAlertEmail(recipients, 'Reimagine: unusual activity in the last hour', alerts)
        emailed = true
      } catch (err) {
        console.error('activity-watchdog: alert email failed', err && err.message)
      }
    } else {
      console.error('activity-watchdog: thresholds tripped but ADMIN_EMAILS is empty', { alerts })
    }
  }

  console.log('activity-watchdog run', { alerts: alerts.length, emailed, summary })
  return res.status(200).json({ ok: true, alerted: alerts.length > 0, emailed, alerts, summary })
}
