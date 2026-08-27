// How much of this month's Anthropic budget Reimagine has spent, and whether
// the month is on course to run out before it ends.
//
// This exists because of the 2026-08-15 incident: the monthly spend cap on the
// Anthropic account was reached mid-month, generation stopped app-wide, and the
// first anyone knew of it was users seeing an error. Nothing was watching the
// number. The cost data to watch it with was already being written on every
// generation (generation_events.cost_usd, Economics tab) — nothing read it
// against a ceiling.
//
// Two questions, because they fail at different times:
//   1. How far through the budget are we RIGHT NOW? (thresholds: 50/75/90/100%)
//   2. At the current burn rate, does the month END over the cap? A month that
//      is 40% spent on day 8 is fine on question 1 and already lost on 2.
//
// THE CAP IS CONFIGURED, NOT DISCOVERED. Anthropic does not expose the account
// spend limit over the API, so ANTHROPIC_MONTHLY_BUDGET_USD holds it and has to
// be kept in step with the console by hand. Set it to the same number as the
// monthly limit on the Anthropic account. With it unset, the watchdog reports
// unconfigured and says so once a month rather than quietly watching nothing.
//
// WHAT THIS COUNTS. Every priced row in generation_events: playbook generations
// and My Coach turns (api/claude.js, api/coach.js) and the two daily classifier
// crons. It cannot see spend on the same Anthropic account from anything
// outside this app, so treat it as a floor on the account's bill, not the bill.

import { sql } from './db.js'

// Percent-of-cap points that get an operator email. 100 is included so the
// moment the budget is actually gone is announced as its own event, not left to
// be inferred from the 90% mail sent some hours earlier.
export const BUDGET_THRESHOLDS = [50, 75, 90, 100]

// Below this fraction of the month elapsed, the end-of-month projection is
// arithmetic on too little data to act on (one heavy afternoon on the 1st
// projects a catastrophic month). Reported, but not alerted on.
const PROJECTION_MIN_ELAPSED = 0.15

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function configuredCap() {
  const raw = process.env.ANTHROPIC_MONTHLY_BUDGET_USD
  if (raw === undefined || raw === null || String(raw).trim() === '') return null
  const n = Number(String(raw).trim())
  return Number.isFinite(n) && n > 0 ? n : null
}

// loadBudgetStatus: the whole picture in one round trip's worth of aggregates.
// Never throws — a budget check failing must not take down the cron or the
// dashboard request that called it. On failure it returns `ok: false` with the
// error, so the caller can say "the budget check did not run" rather than
// showing a reassuring zero.
export async function loadBudgetStatus() {
  const cap = configuredCap()
  try {
    const rows = await sql`
      SELECT
        COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= date_trunc('month', NOW())), 0)::float8 AS month_cost,
        COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= date_trunc('day',   NOW())), 0)::float8 AS today_cost,
        COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour'), 0)::float8  AS hour_cost,
        COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW()))::int                      AS month_generations
      FROM generation_events`
    const r = rows[0] || {}

    // Month arithmetic in UTC, matching date_trunc above and the UTC reset the
    // Anthropic limit uses. Fractional elapsed days, so a reading taken at
    // 09:00 on the 3rd is not divided by 3.
    const now = new Date()
    const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    const monthEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    const daysInMonth = (monthEnd - monthStart) / 86400000
    const elapsedDays = Math.max((now.getTime() - monthStart) / 86400000, 0.25)
    const elapsedFraction = elapsedDays / daysInMonth

    const spend = num(r.month_cost)
    const dailyRate = spend / elapsedDays
    const projected = dailyRate * daysInMonth
    const pct = cap ? (spend / cap) * 100 : null
    const projectedPct = cap ? (projected / cap) * 100 : null

    // The highest threshold actually reached, or null below the lowest.
    let crossed = null
    if (pct !== null) {
      for (const t of BUDGET_THRESHOLDS) if (pct >= t) crossed = t
    }

    return {
      ok: true,
      configured: cap !== null,
      cap_usd: cap,
      month: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
      spend_usd: spend,
      spend_today_usd: num(r.today_cost),
      spend_last_hour_usd: num(r.hour_cost),
      generations_this_month: num(r.month_generations),
      remaining_usd: cap === null ? null : Math.max(0, cap - spend),
      pct_of_cap: pct,
      daily_run_rate_usd: dailyRate,
      projected_month_end_usd: projected,
      projected_pct_of_cap: projectedPct,
      threshold_crossed: crossed,
      // Only meaningful once enough of the month has run to have a rate.
      projection_reliable: elapsedFraction >= PROJECTION_MIN_ELAPSED,
      projection_over_cap: cap !== null && elapsedFraction >= PROJECTION_MIN_ELAPSED && projected > cap,
      days_in_month: daysInMonth,
      days_elapsed: elapsedDays,
      days_remaining: Math.max(0, daysInMonth - elapsedDays),
      as_of: now.toISOString(),
      note: 'Counts every priced generation Reimagine logs. Spend on the same Anthropic account from anything outside this app is invisible here, so read this as a floor on the bill.',
    }
  } catch (err) {
    console.error('budget: query failed', err && err.message)
    return { ok: false, configured: cap !== null, cap_usd: cap, error: 'Budget query failed' }
  }
}
