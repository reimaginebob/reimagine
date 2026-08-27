// Operator alerts that fire once rather than every time the condition is still
// true.
//
// The rogue-activity watchdog already emails ADMIN_EMAILS on every run where a
// threshold trips, which is right for that check: an account building playbooks
// in a loop is a NEW event each hour. Budget and outage alerts are the opposite
// shape — the condition persists, sometimes for days — and an alert that
// arrives every hour stops being read, which defeats the point of having one.
//
// alertOnce writes the key to ops_alerts first and sends second, so two
// concurrent serverless invocations cannot both send. If the send fails, the key
// is removed again so the next run retries rather than swallowing the alert.
//
// Cross-boundary note (CLAUDE.md section 8): .js extension, same as ./db.js.

import { sql } from './db.js'
import { sendActivityAlertEmail } from './email.js'

export function adminRecipients() {
  return (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean)
}

// Claim an alert key. Returns true only for the caller that actually claimed it.
//
// cooldownHours re-arms a key after a period (used for outage paging, where
// "still down 6 hours later" is worth saying again). Omit it for keys that
// should fire exactly once for their window — a budget threshold in a given
// month, for example, where the key itself already carries the window.
async function claim(key, cooldownHours) {
  if (cooldownHours > 0) {
    const interval = `${Math.round(cooldownHours)} hours`
    const rows = await sql`
      INSERT INTO ops_alerts (alert_key, sent_at) VALUES (${key}, NOW())
      ON CONFLICT (alert_key) DO UPDATE SET sent_at = NOW()
        WHERE ops_alerts.sent_at < NOW() - ${interval}::interval
      RETURNING alert_key`
    return rows.length > 0
  }
  const rows = await sql`
    INSERT INTO ops_alerts (alert_key) VALUES (${key})
    ON CONFLICT (alert_key) DO NOTHING
    RETURNING alert_key`
  return rows.length > 0
}

async function release(key) {
  try { await sql`DELETE FROM ops_alerts WHERE alert_key = ${key}` } catch { /* next run retries anyway */ }
}

// Send an operator alert at most once per key. Never throws: an alerting
// failure must not take down the request or cron that noticed the problem.
// Returns true when an email actually went out.
export async function alertOnce(key, subject, lines, opts = {}) {
  const to = adminRecipients()
  if (!to.length) {
    console.error('ops-alerts: condition tripped but ADMIN_EMAILS is empty', { key, lines })
    return false
  }
  let claimed = false
  try {
    claimed = await claim(key, Number(opts.cooldownHours) || 0)
  } catch (e) {
    // ops_alerts not migrated yet, or a DB hiccup. Log the alert so it is not
    // lost, but do not send — without the dedupe table an outage would email on
    // every single failed generation.
    console.error('ops-alerts: could not claim key, alert not sent', { key, error: e && e.message, lines })
    return false
  }
  if (!claimed) return false
  try {
    await sendActivityAlertEmail(to, subject, lines)
    console.log('ops-alerts: sent', { key, to: to.length })
    return true
  } catch (e) {
    console.error('ops-alerts: send failed, releasing key for retry', { key, error: e && e.message })
    await release(key)
    return false
  }
}
