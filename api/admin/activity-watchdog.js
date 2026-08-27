// Hourly watchdog. Two jobs, both detection-only from the operator's side.
//
//   1. Rogue activity: an account, or the whole app, creating an abnormal
//      number of playbooks or generations in the last hour.
//   2. API budget: how far through the month's Anthropic spend cap we are, and
//      whether the burn rate ends the month over it. Added after 2026-08-15,
//      when the cap was reached mid-month, generation stopped app-wide, and the
//      first anyone knew of it was users reading the raw upstream error.
//
// The two use different alerting on purpose. Rogue activity emails every hour
// its condition holds, because each hour is a new event. Budget warnings go
// through alertOnce (api/_lib/ops-alerts.js), keyed by month and threshold,
// because the condition persists for days and an hourly repeat would train the
// operator to ignore the mail.
//
// Emails the operator (ADMIN_EMAILS) when an
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
import { sendActivityAlertEmail, sendAccountHoldEmail } from '../_lib/email.js'
import { loadBudgetStatus, BUDGET_THRESHOLDS } from '../_lib/budget.js'
import { alertOnce } from '../_lib/ops-alerts.js'

// Auto-pause an account by email if it is not already paused. Returns true only on
// the transition, so the user is emailed and the alert announces it once — not
// every hour the account stays over the line. Best-effort; never throws.
async function autoPause(email, reason) {
  try {
    const rows = await sql`UPDATE users SET suspended_at = NOW(), suspended_reason = ${reason} WHERE lower(email) = lower(${email}) AND suspended_at IS NULL RETURNING email`
    if (rows.length) {
      try { await sendAccountHoldEmail(email) } catch (e) { console.error('watchdog: hold email failed', e && e.message) }
      return true
    }
    return false
  } catch (e) { console.error('watchdog: auto-pause failed', e && e.message); return false }
}

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

// Dollars for an operator email. Cents below $100, whole dollars above, so a
// budget line reads as money rather than as a float.
function fmtUsd(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '$—'
  return v < 100
    ? `$${v.toFixed(2)}`
    : `$${Math.round(v).toLocaleString('en-US')}`
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
      const paused = await autoPause(r.email, `auto: ${r.n} playbooks/hr`)
      alerts.push(`Account ${r.email} built ${r.n} playbooks in the last hour — ${paused ? 'AUTO-PAUSED' : 'already paused'} (threshold ${PER_USER_PLAYBOOKS_HR}).`)
    }
    if (totalPlaybooks >= TOTAL_PLAYBOOKS_HR) {
      alerts.push(`App-wide: ${totalPlaybooks} playbooks built in the last hour across all users (alert threshold ${TOTAL_PLAYBOOKS_HR}).`)
    }
  } catch (err) {
    console.error('activity-watchdog: playbook query failed', err && err.message)
    summary.playbooksError = true
  }

  // --- Generation-volume spikes (Phase 2; no-ops until generation_events exists) ---
  // kind = 'coach' rows are excluded from both counts. My Coach turns began
  // logging to this table for cost reporting; they are not playbook generations
  // and counting them here would drift the thresholds without anyone changing
  // them.
  try {
    const genPerUser = await sql`
      SELECT u.email AS email, COUNT(*)::int AS n
      FROM generation_events g
      JOIN users u ON u.id = g.user_id
      WHERE g.created_at >= NOW() - INTERVAL '1 hour'
        AND lower(u.email) NOT LIKE '%@career.club'
        AND COALESCE(g.kind, '') <> 'coach'
      GROUP BY u.email
      HAVING COUNT(*) >= ${PER_USER_GENERATIONS_HR}
      ORDER BY n DESC
    `
    const genTotalRows = await sql`
      SELECT COUNT(*)::int AS total FROM generation_events
       WHERE created_at >= NOW() - INTERVAL '1 hour' AND COALESCE(kind, '') <> 'coach'
    `
    const totalGenerations = (genTotalRows[0] && genTotalRows[0].total) || 0
    summary.generations = { totalLastHour: totalGenerations, offenders: genPerUser.length }
    for (const r of genPerUser) {
      const paused = await autoPause(r.email, `auto: ${r.n} generations/hr`)
      alerts.push(`Account ${r.email} triggered ${r.n} generations in the last hour — ${paused ? 'AUTO-PAUSED' : 'already paused'} (threshold ${PER_USER_GENERATIONS_HR}).`)
    }
    if (totalGenerations >= TOTAL_GENERATIONS_HR) {
      alerts.push(`App-wide: ${totalGenerations} generations in the last hour across all users (alert threshold ${TOTAL_GENERATIONS_HR}).`)
    }
  } catch {
    // generation_events not migrated yet (Phase 2) — skip this section silently.
    summary.generations = { pending: true }
  }

  // --- API budget (2026-08-15 incident) -----------------------------------
  // The spend cap is the one failure that takes the whole product down at once,
  // and nothing was watching it. Two separate warnings, because they arrive at
  // different times:
  //
  //   * a threshold crossing (50/75/90/100% of the month's cap) says where the
  //     month stands right now;
  //   * a burn-rate projection says the month ENDS over the cap even though
  //     today's number looks fine. That is the one that buys time to act.
  //
  // These do NOT ride the alerts array below: that email fires every hour its
  // condition holds, which is right for a runaway account and wrong for a
  // budget, where the condition persists for days. They go through alertOnce,
  // keyed by month and threshold, so each one is said exactly once.
  let budget = null
  try {
    budget = await loadBudgetStatus()
    summary.budget = budget && budget.ok
      ? {
        configured: budget.configured,
        spend_usd: Math.round(budget.spend_usd * 100) / 100,
        pct_of_cap: budget.pct_of_cap === null ? null : Math.round(budget.pct_of_cap),
        projected_month_end_usd: Math.round(budget.projected_month_end_usd * 100) / 100,
      }
      : { error: true }

    if (budget && budget.ok && !budget.configured) {
      // Silence here would look exactly like "everything is fine". Say it once
      // a month instead.
      await alertOnce(`budget:${budget.month}:unconfigured`,
        'Reimagine: no API budget configured — the spend watchdog is not watching anything', [
          `ANTHROPIC_MONTHLY_BUDGET_USD is not set, so nothing can warn you before the Anthropic spend cap is reached (the 2026-08-15 failure).`,
          `Reimagine has logged ${fmtUsd(budget.spend_usd)} of API spend so far in ${budget.month}, across ${budget.generations_this_month} generations, currently running at about ${fmtUsd(budget.daily_run_rate_usd)}/day.`,
          `Set ANTHROPIC_MONTHLY_BUDGET_USD in Vercel to the same monthly limit configured on the Anthropic account, then redeploy production — env is injected at build time.`,
        ])
    }

    if (budget && budget.ok && budget.configured) {
      // Highest threshold reached, announced once per month per threshold. The
      // key is the month plus the level, so August's 75% mail does not suppress
      // September's.
      const crossed = BUDGET_THRESHOLDS.filter(t => budget.pct_of_cap >= t)
      const top = crossed.length ? crossed[crossed.length - 1] : null
      if (top !== null) {
        const spent = fmtUsd(budget.spend_usd)
        const cap = fmtUsd(budget.cap_usd)
        const subject = top >= 100
          ? 'Reimagine: API budget for the month is SPENT'
          : `Reimagine: ${top}% of the month's API budget spent`
        const lines = top >= 100
          ? [
            `Reimagine has logged ${spent} against a ${cap} monthly budget for ${budget.month}. Generation is at or past the cap; if Anthropic is enforcing it, every generation in the app is failing right now and users are seeing the "temporarily unable to generate" message.`,
            `Raise the limit on the Anthropic account, or accept the outage until ${budget.month} rolls over.`,
            `${budget.generations_this_month} generations this month. ${fmtUsd(budget.spend_today_usd)} today, ${fmtUsd(budget.spend_last_hour_usd)} in the last hour.`,
          ]
          : [
            `Reimagine has logged ${spent} of a ${cap} monthly budget for ${budget.month} — ${Math.round(budget.pct_of_cap)}% — with ${budget.days_remaining.toFixed(1)} days left in the month.`,
            `At the current rate of about ${fmtUsd(budget.daily_run_rate_usd)}/day, the month ends around ${fmtUsd(budget.projected_month_end_usd)}.`,
            `${budget.generations_this_month} generations this month. ${fmtUsd(budget.spend_today_usd)} today, ${fmtUsd(budget.spend_last_hour_usd)} in the last hour.`,
            budget.note,
          ]
        await alertOnce(`budget:${budget.month}:${top}`, subject, lines)
      }

      // The projection warning. Fires once per month, and only once enough of
      // the month has run for a rate to mean anything.
      if (budget.projection_over_cap) {
        await alertOnce(`budget:${budget.month}:projection`,
          'Reimagine: this month is on course to run out of API budget', [
            `${budget.month} is ${Math.round((budget.days_elapsed / budget.days_in_month) * 100)}% through and Reimagine has logged ${fmtUsd(budget.spend_usd)} of a ${fmtUsd(budget.cap_usd)} budget.`,
            `At about ${fmtUsd(budget.daily_run_rate_usd)}/day the month ends around ${fmtUsd(budget.projected_month_end_usd)} — roughly ${Math.round(budget.projected_pct_of_cap)}% of the cap.`,
            `Today's number still looks fine; the rate does not. Raising the limit now avoids the app-wide outage that hitting the cap causes.`,
            budget.note,
          ])
      }
    }
  } catch (err) {
    console.error('activity-watchdog: budget check failed', err && err.message)
    summary.budgetError = true
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
  // budget rides on the response so the run can be inspected by hand without
  // waiting for a threshold to trip. Its own alerts are sent above, once each.
  return res.status(200).json({ ok: true, alerted: alerts.length > 0, emailed, alerts, summary, budget })
}
