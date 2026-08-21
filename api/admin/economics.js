// Read-only unit economics for the Economics tab of /admin/dashboard, plus the
// two write actions the numbers depend on.
//
// Everything is computed live from users / generation_events / economics_inputs
// on each request. There is no snapshot table and no nightly job on purpose: at
// this scale the whole P&L is a handful of indexed aggregates, and a scheduled
// snapshot would buy nothing but a way for the history to grow holes on the
// mornings it fails to run. The only stored state is the part no query can
// derive -- the price and the fixed cost (economics_inputs) and who is actually
// a paying customer (users.paying_since).
//
// Auth: Bearer ADMIN_TOKEN, same token as api/admin/analytics.js.
//
// Method: GET for the payload. POST for the two operator writes:
//   { action: 'billing', email, paying_since }   -- mark or clear a customer
//   { action: 'inputs', effective_date, price_per_customer, fixed_monthly_cost, note }
//
// Cost coverage: generation_events rows written before the 2026-08-24 migration
// have a NULL cost_usd, because the token counts for those calls were never
// stored and nothing can backfill them. The payload reports where the cost
// history actually starts rather than letting the early months read as cheap.

import { sql } from '../_lib/db.js'

// Trailing windows. 30 days for the per-user and per-day views (long enough to
// smooth a quiet week, short enough to reflect the current product), 6 months
// for the P&L history.
const DAILY_WINDOW_DAYS = 30
const PNL_MONTHS = 6
const TOP_USERS = 25

// Interval literals are built as complete strings and cast (`$1::interval`)
// rather than concatenated in SQL. A bare `${n} || ' days'` sends an untyped
// integer parameter into the `||` operator, which Postgres cannot resolve.
const WINDOW_INTERVAL = `${DAILY_WINDOW_DAYS} days`
const WINDOW_INTERVAL_BACK = `${DAILY_WINDOW_DAYS - 1} days`
const PNL_INTERVAL_BACK = `${PNL_MONTHS - 1} months`

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Internal accounts. Their generations are real money and stay in the cost
// total, but they are testing, not customers, so they are reported on their own
// line -- at beta scale internal testing can be most of the API bill, and
// folding it into cost-per-customer would make every unit number look worse
// than it is.
const INTERNAL_EMAIL_SUFFIX = '%@career.club'

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// The assumptions in force for a given month: the latest row dated on or before
// the last day of that month. Falls back to the earliest row so a month that
// predates every entry still reports against something rather than zero.
function inputsForMonth(rows, monthEnd) {
  let chosen = null
  for (const r of rows) {
    if (r.effective_date <= monthEnd) chosen = r
  }
  return chosen || rows[rows.length - 1] || null
}

async function loadPayload() {
  // --- Assumptions, oldest first so inputsForMonth can walk forward ---
  const inputsRows = await sql`
    SELECT to_char(effective_date, 'YYYY-MM-DD') AS effective_date,
           price_per_customer::float8            AS price_per_customer,
           fixed_monthly_cost::float8            AS fixed_monthly_cost,
           note,
           updated_at
      FROM economics_inputs
     ORDER BY effective_date ASC`

  // --- Headcount: customers, active users, and what is not yet recorded ---
  const headRows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE paying_since IS NOT NULL AND paying_since <= CURRENT_DATE)::int AS paying_customers,
      COUNT(*) FILTER (WHERE paying_since IS NULL AND lower(email) NOT LIKE ${INTERNAL_EMAIL_SUFFIX})::int AS unrecorded_users,
      COUNT(*) FILTER (WHERE lower(email) NOT LIKE ${INTERNAL_EMAIL_SUFFIX})::int AS external_users,
      COUNT(*)::int AS total_users,
      COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '30 days')::int AS active_30d
    FROM users`
  const head = headRows[0] || {}

  // --- Where the cost history actually begins ---
  const coverageRows = await sql`
    SELECT
      MIN(created_at) FILTER (WHERE cost_usd IS NOT NULL) AS first_costed_at,
      COUNT(*) FILTER (WHERE cost_usd IS NOT NULL)::int   AS costed_rows,
      COUNT(*) FILTER (WHERE cost_usd IS NULL)::int       AS uncosted_rows
    FROM generation_events`
  const coverage = coverageRows[0] || {}

  // --- Month-to-date spend, split customer / internal / unattributed ---
  // Signed-out early-orientation generations log a NULL user_id; they are real
  // spend with nobody to attribute it to, so they get their own bucket rather
  // than being dropped or silently charged to customers.
  const mtdCostRows = await sql`
    SELECT
      COALESCE(SUM(g.cost_usd) FILTER (WHERE u.id IS NOT NULL AND lower(u.email) NOT LIKE ${INTERNAL_EMAIL_SUFFIX}), 0)::float8 AS customer_cost,
      COALESCE(SUM(g.cost_usd) FILTER (WHERE lower(u.email) LIKE ${INTERNAL_EMAIL_SUFFIX}), 0)::float8                          AS internal_cost,
      COALESCE(SUM(g.cost_usd) FILTER (WHERE g.user_id IS NULL), 0)::float8                                                     AS unattributed_cost,
      COUNT(*)::int                                                                                                             AS generations
    FROM generation_events g
    LEFT JOIN users u ON u.id = g.user_id
    WHERE g.created_at >= date_trunc('month', NOW())`
  const mtd = mtdCostRows[0] || {}

  // --- Token mix month to date. Cache reads dominate the token count and are a
  // tenth the price, so the split is the difference between a believable cost
  // number and a wild one; surfacing it also makes a cache regression visible.
  const mixRows = await sql`
    SELECT
      COALESCE(SUM(input_tokens), 0)::float8       AS input_tokens,
      COALESCE(SUM(output_tokens), 0)::float8      AS output_tokens,
      COALESCE(SUM(cache_write_tokens), 0)::float8 AS cache_write_tokens,
      COALESCE(SUM(cache_read_tokens), 0)::float8  AS cache_read_tokens,
      COALESCE(SUM(web_searches), 0)::int          AS web_searches
    FROM generation_events
    WHERE created_at >= date_trunc('month', NOW()) AND cost_usd IS NOT NULL`
  const mix = mixRows[0] || {}

  // --- Monthly P&L history. generate_series so a month with no activity still
  // appears as a row (fixed costs were paid whether or not anyone generated).
  const monthRows = await sql`
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', NOW()) - ${PNL_INTERVAL_BACK}::interval,
        date_trunc('month', NOW()),
        '1 month'::interval
      ) AS m
    )
    SELECT
      to_char(months.m, 'YYYY-MM')                       AS month,
      to_char((months.m + INTERVAL '1 month' - INTERVAL '1 day'), 'YYYY-MM-DD') AS month_end,
      (SELECT COUNT(*) FROM users u
        WHERE u.paying_since IS NOT NULL
          AND u.paying_since <= (months.m + INTERVAL '1 month' - INTERVAL '1 day')::date)::int AS paying_customers,
      (SELECT COALESCE(SUM(g.cost_usd), 0) FROM generation_events g
        WHERE g.created_at >= months.m AND g.created_at < months.m + INTERVAL '1 month')::float8 AS api_cost,
      (SELECT COUNT(*) FROM generation_events g
        WHERE g.created_at >= months.m AND g.created_at < months.m + INTERVAL '1 month')::int AS generations,
      (SELECT COUNT(*) FROM users u
        WHERE u.created_at >= months.m AND u.created_at < months.m + INTERVAL '1 month')::int AS signups
    FROM months
    ORDER BY months.m ASC`

  // --- Daily cost, trailing window ---
  const dailyRows = await sql`
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
           COUNT(*)::int                                        AS generations,
           COALESCE(SUM(cost_usd), 0)::float8                   AS cost
      FROM generation_events
     WHERE created_at >= date_trunc('day', NOW()) - ${WINDOW_INTERVAL_BACK}::interval
     GROUP BY 1
     ORDER BY 1 ASC`

  // --- Cost per user, trailing window. Coach turns are broken out because they
  // are the cheap, frequent half of the bill and a user who looks heavy on
  // generation count may be light on cost.
  const perUserRows = await sql`
    SELECT
      u.email                                                                       AS email,
      (u.paying_since IS NOT NULL)                                                  AS paying,
      COUNT(*) FILTER (WHERE COALESCE(g.kind, '') <> 'coach')::int                  AS generations,
      COUNT(*) FILTER (WHERE g.kind = 'coach')::int                                 AS coach_turns,
      COALESCE(SUM(g.cost_usd), 0)::float8                                          AS cost
    FROM generation_events g
    JOIN users u ON u.id = g.user_id
    WHERE g.created_at >= NOW() - ${WINDOW_INTERVAL}::interval
    GROUP BY u.email, u.paying_since
    ORDER BY cost DESC, generations DESC
    LIMIT ${TOP_USERS}`

  // --- Assemble the P&L, applying each month's own assumptions ---
  const months = monthRows.map((r) => {
    const inp = inputsForMonth(inputsRows, r.month_end)
    const price = inp ? num(inp.price_per_customer) : 0
    const fixed = inp ? num(inp.fixed_monthly_cost) : 0
    const revenue = num(r.paying_customers) * price
    const apiCost = num(r.api_cost)
    return {
      month: r.month,
      paying_customers: num(r.paying_customers),
      signups: num(r.signups),
      generations: num(r.generations),
      revenue,
      fixed_cost: fixed,
      api_cost: apiCost,
      net: revenue - fixed - apiCost,
    }
  })

  const current = inputsForMonth(inputsRows, new Date().toISOString().slice(0, 10)) || null
  const price = current ? num(current.price_per_customer) : 0
  const fixed = current ? num(current.fixed_monthly_cost) : 0

  const payingCustomers = num(head.paying_customers)
  const customerCost = num(mtd.customer_cost)
  const internalCost = num(mtd.internal_cost)
  const unattributedCost = num(mtd.unattributed_cost)
  const totalApiCost = customerCost + internalCost + unattributedCost
  const revenue = payingCustomers * price

  // --- Breakeven. Contribution per customer, not a regression: the honest
  // question is how many customers the fixed base needs, given what one costs
  // to serve. Variable cost per customer comes from the trailing window rather
  // than month-to-date so an early-month reading is not divided by two days.
  const windowCostRows = await sql`
    SELECT COALESCE(SUM(g.cost_usd), 0)::float8 AS cost,
           COUNT(DISTINCT g.user_id)::int       AS users
      FROM generation_events g
      JOIN users u ON u.id = g.user_id
     WHERE g.created_at >= NOW() - ${WINDOW_INTERVAL}::interval
       AND lower(u.email) NOT LIKE ${INTERNAL_EMAIL_SUFFIX}`
  const w = windowCostRows[0] || {}
  const activeCustomerCount = num(w.users)
  const variablePerCustomer = activeCustomerCount > 0 ? num(w.cost) / activeCustomerCount : 0
  const contribution = price - variablePerCustomer
  const customersNeeded = contribution > 0 ? Math.ceil(fixed / contribution) : null

  // Signup rate over the P&L window, used only to translate the gap into a
  // rough number of months. Labelled as a straight-line read on the dashboard;
  // it is arithmetic on a small base, not a forecast.
  const signupMonths = months.filter((m) => m.signups > 0).length
  const signupsPerMonth = signupMonths > 0
    ? months.reduce((s, m) => s + m.signups, 0) / months.length
    : 0

  return {
    as_of: new Date().toISOString(),
    inputs: current,
    inputs_history: inputsRows.slice().reverse(),
    coverage: {
      first_costed_at: coverage.first_costed_at || null,
      costed_rows: num(coverage.costed_rows),
      uncosted_rows: num(coverage.uncosted_rows),
    },
    headcount: {
      paying_customers: payingCustomers,
      unrecorded_users: num(head.unrecorded_users),
      external_users: num(head.external_users),
      total_users: num(head.total_users),
      active_30d: num(head.active_30d),
    },
    month_to_date: {
      revenue,
      fixed_cost: fixed,
      api_cost_customers: customerCost,
      api_cost_internal: internalCost,
      api_cost_unattributed: unattributedCost,
      api_cost_total: totalApiCost,
      net: revenue - fixed - totalApiCost,
      generations: num(mtd.generations),
      // What the top line would read if every external account were paying.
      // Shown alongside, never instead of, the recorded number.
      revenue_if_all_paid: num(head.external_users) * price,
    },
    token_mix: {
      input_tokens: num(mix.input_tokens),
      output_tokens: num(mix.output_tokens),
      cache_write_tokens: num(mix.cache_write_tokens),
      cache_read_tokens: num(mix.cache_read_tokens),
      web_searches: num(mix.web_searches),
    },
    months,
    daily: dailyRows.map((r) => ({ day: r.day, generations: num(r.generations), cost: num(r.cost) })),
    per_user: perUserRows.map((r) => ({
      email: r.email,
      paying: !!r.paying,
      generations: num(r.generations),
      coach_turns: num(r.coach_turns),
      cost: num(r.cost),
    })),
    breakeven: {
      price_per_customer: price,
      fixed_monthly_cost: fixed,
      variable_per_customer: variablePerCustomer,
      contribution_per_customer: contribution,
      customers_needed: customersNeeded,
      customers_now: payingCustomers,
      gap: customersNeeded === null ? null : Math.max(0, customersNeeded - payingCustomers),
      signups_per_month: signupsPerMonth,
      months_to_breakeven: (customersNeeded !== null && signupsPerMonth > 0)
        ? Math.max(0, customersNeeded - payingCustomers) / signupsPerMonth
        : null,
      window_days: DAILY_WINDOW_DAYS,
      window_users: activeCustomerCount,
    },
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const expected = process.env.ADMIN_TOKEN
  if (!expected) {
    console.error('admin/economics: ADMIN_TOKEN not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  if ((req.headers.authorization || '') !== `Bearer ${expected}`) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (req.method === 'GET') {
    try {
      return res.status(200).json({ ok: true, ...(await loadPayload()) })
    } catch (err) {
      console.error('admin/economics: query failed', err && err.message)
      return res.status(500).json({ error: 'Query failed' })
    }
  }

  const body = req.body || {}
  const action = typeof body.action === 'string' ? body.action.trim() : ''

  try {
    // Mark (or clear) a user as a paying customer. Clearing is a correction
    // path, not a churn record -- a cancelled customer is a second thing this
    // does not model, and pretending otherwise would put a wrong number on the
    // revenue line.
    if (action === 'billing') {
      const email = typeof body.email === 'string' ? body.email.trim() : ''
      if (!email) return res.status(400).json({ error: 'email required' })
      const raw = typeof body.paying_since === 'string' ? body.paying_since.trim() : ''
      if (raw && !DATE_RE.test(raw)) {
        return res.status(400).json({ error: 'paying_since must be YYYY-MM-DD, or empty to clear' })
      }
      const since = raw || null
      const rows = await sql`
        UPDATE users SET paying_since = ${since}::date
         WHERE lower(email) = lower(${email})
         RETURNING email, to_char(paying_since, 'YYYY-MM-DD') AS paying_since`
      if (rows.length === 0) return res.status(404).json({ error: 'No account with that email' })
      console.log('admin/economics: billing', { email, paying_since: since })
      return res.status(200).json({ ok: true, email: rows[0].email, paying_since: rows[0].paying_since })
    }

    // Change the assumptions. Writes a new dated row, so a report for an
    // earlier month keeps the price and fixed cost that were true then.
    if (action === 'inputs') {
      const effective = typeof body.effective_date === 'string' ? body.effective_date.trim() : ''
      if (!DATE_RE.test(effective)) return res.status(400).json({ error: 'effective_date must be YYYY-MM-DD' })
      const price = Number(body.price_per_customer)
      const fixed = Number(body.fixed_monthly_cost)
      if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'price_per_customer must be a number' })
      if (!Number.isFinite(fixed) || fixed < 0) return res.status(400).json({ error: 'fixed_monthly_cost must be a number' })
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : null
      await sql`
        INSERT INTO economics_inputs (effective_date, price_per_customer, fixed_monthly_cost, note)
        VALUES (${effective}::date, ${price}, ${fixed}, ${note})
        ON CONFLICT (effective_date) DO UPDATE
           SET price_per_customer = EXCLUDED.price_per_customer,
               fixed_monthly_cost = EXCLUDED.fixed_monthly_cost,
               note               = EXCLUDED.note,
               updated_at         = NOW()`
      console.log('admin/economics: inputs', { effective, price, fixed })
      return res.status(200).json({ ok: true, effective_date: effective })
    }

    return res.status(400).json({ error: "action must be 'billing' or 'inputs'" })
  } catch (err) {
    console.error('admin/economics: update failed', err && err.message)
    return res.status(500).json({ error: 'Update failed' })
  }
}
