// Economics dashboard — the Economics tab of /admin/dashboard. Unit economics
// over the same Neon tables the Analytics tab reads, plus the two operator
// writes the numbers depend on: who is a paying customer, and what the price
// and fixed monthly cost are.
//
// Data comes from the admin-gated /api/admin/economics endpoint (same
// ADMIN_TOKEN as the other tabs), computed live on each request — there is no
// snapshot table behind this.
//
// Charts are hand-drawn inline SVG rather than a charting library. The two
// shapes here are a bar series and a table; a dependency would add ~100KB to a
// bundle every user downloads for a page only admins open, and this file
// follows the same no-new-dependencies rule as AdminDashboard.jsx.
//
// Self-contained inline styles in the app's cream/navy/amber palette.
import { useState, useEffect, useCallback } from "react"
// NAV_LABELS is the single render-true label source (CLAUDE.md section 6).
// A third copy of the step names in this file would be exactly the drift
// that rule exists to prevent.
import { NAV_LABELS } from "./nav-labels"

const NAVY = "#1A2540"
const GOLD = "#C8924A"
const GOLDL = "#A06828"
const BORDER = "#E2E5EA"
const CREAM = "#FBF8F2"
const GRAY = "#3D4A5C"
const GRAYL = "#6B7685"
const OK = "#2E7D52"
const ERR = "#C0432F"

const fmtUsd = (n, cents) => {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—"
  const v = Number(n)
  const neg = v < 0
  const abs = Math.abs(v)
  const s = cents || abs < 100
    ? abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(abs).toLocaleString("en-US")
  return `${neg ? "−" : ""}$${s}`
}
const fmtInt = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n)).toLocaleString("en-US") : "—")
const fmtTokens = (n) => {
  const v = Number(n) || 0
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${Math.round(v / 1e3)}K`
  return String(Math.round(v))
}
const monthLabel = (m) => {
  if (!m || m.length < 7) return m || "—"
  const [y, mo] = m.split("-")
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${names[Number(mo) - 1] || mo} ${y}`
}

const UNIT_STAGE_LABELS = {
  focus_complete: 'Completed all seven sections',
  both_doors: 'Both doors',
  career_paths: 'Career Paths only',
  opportunity: 'Opportunity only',
  personal_brand_no_door: 'Personal Brand, no door',
  earlier: 'Never got a Personal Brand',
}
// Most engaged first, so the row a paying customer resembles is at the top.
const UNIT_STAGE_ORDER = ['focus_complete', 'both_doors', 'career_paths', 'opportunity', 'personal_brand_no_door', 'earlier']

export default function EconomicsDashboard({ token }) {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [liveAsOf, setLiveAsOf] = useState(null)

  // Billing control
  const [billEmail, setBillEmail] = useState("")
  const [billDate, setBillDate] = useState("")
  const [billBusy, setBillBusy] = useState(false)
  const [billMsg, setBillMsg] = useState("")

  // Assumptions control
  const [showInputs, setShowInputs] = useState(false)
  const [inPrice, setInPrice] = useState("")
  const [inFixed, setInFixed] = useState("")
  const [inDate, setInDate] = useState("")
  const [inNote, setInNote] = useState("")
  const [inBusy, setInBusy] = useState(false)
  const [inMsg, setInMsg] = useState("")

  const fetchData = useCallback(async (tok) => {
    if (!tok) return
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/admin/economics", { headers: { Authorization: `Bearer ${tok}` } })
      if (res.status === 200) {
        setPayload(await res.json())
        setLiveAsOf(new Date().toUTCString())
      } else {
        setError(`Request failed (HTTP ${res.status}).`)
      }
    } catch {
      setError("Network error reaching the economics endpoint.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(token) }, [token, fetchData])

  const post = async (body) => {
    const res = await fetch("/api/admin/economics", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, data }
  }

  const saveBilling = async (clear) => {
    const email = billEmail.trim()
    if (!email) { setBillMsg("Enter an email address first."); return }
    setBillBusy(true); setBillMsg("")
    try {
      const r = await post({ action: "billing", email, paying_since: clear ? "" : billDate.trim() })
      if (!r.ok) { setBillMsg(r.data.error || `Failed (HTTP ${r.status})`); return }
      setBillMsg(r.data.paying_since
        ? `${r.data.email} is a paying customer from ${r.data.paying_since}.`
        : `Cleared the billing date on ${r.data.email}.`)
      setBillEmail(""); setBillDate("")
      fetchData(token)
    } catch { setBillMsg("Network error. Try again.") }
    finally { setBillBusy(false) }
  }

  const saveInputs = async () => {
    setInBusy(true); setInMsg("")
    try {
      const r = await post({
        action: "inputs",
        effective_date: inDate.trim(),
        price_per_customer: Number(inPrice),
        fixed_monthly_cost: Number(inFixed),
        note: inNote.trim(),
      })
      if (!r.ok) { setInMsg(r.data.error || `Failed (HTTP ${r.status})`); return }
      setInMsg(`Saved, effective ${r.data.effective_date}.`)
      setShowInputs(false)
      fetchData(token)
    } catch { setInMsg("Network error. Try again.") }
    finally { setInBusy(false) }
  }

  if (loading && !payload) return <div style={S.muted}>Loading economics…</div>
  if (error && !payload) return (
    <div style={S.errorBanner}><span>{error}</span><button onClick={() => fetchData(token)} style={S.retryBtn}>Retry</button></div>
  )
  if (!payload) return null

  const inputs = payload.inputs || {}
  const head = payload.headcount || {}
  const mtd = payload.month_to_date || {}
  const be = payload.breakeven || {}
  const mix = payload.token_mix || {}
  const cov = payload.coverage || {}
  const daily = payload.daily || []
  const unit = payload.unit_cost || {}
  const months = payload.months || []
  const perUser = payload.per_user || []

  const profitable = Number(mtd.net) >= 0

  return (
    <>
      <div style={S.headerRow}>
        <div style={S.muted}>
          {liveAsOf ? <>Live as of <strong style={{ color: NAVY }}>{liveAsOf}</strong></> : "Loading…"}
          {" · "}
          {fmtUsd(inputs.price_per_customer)}/customer, {fmtUsd(inputs.fixed_monthly_cost)}/month fixed
          {inputs.effective_date ? ` (since ${inputs.effective_date})` : ""}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => {
            setShowInputs(!showInputs)
            setInPrice(String(inputs.price_per_customer ?? ""))
            setInFixed(String(inputs.fixed_monthly_cost ?? ""))
            setInDate(new Date().toISOString().slice(0, 10))
            setInNote("")
          }} style={S.smallBtn}>{showInputs ? "Cancel" : "Change assumptions"}</button>
          <button onClick={() => fetchData(token)} disabled={loading} style={S.refreshBtn}>{loading ? "…" : "Refresh"}</button>
        </div>
      </div>

      {/* What this page is reading, and what it cannot know. Instruction copy
          gets the accented treatment rather than a gray paragraph. */}
      <div style={S.callout}>
        <strong style={{ color: NAVY }}>Where these numbers come from.</strong> Revenue is the {fmtInt(head.paying_customers)} account{head.paying_customers === 1 ? "" : "s"} with a billing date recorded, times the price above — not the user count.
        {head.unrecorded_users > 0 && <> {fmtInt(head.unrecorded_users)} external account{head.unrecorded_users === 1 ? " has" : "s have"} no billing date, so {head.unrecorded_users === 1 ? "it is" : "they are"} counted as free. Mark customers at the bottom of this page.</>}
        {" "}API cost is metered per generation from the Anthropic response.
        {cov.first_costed_at
          ? <> Cost history starts <strong style={{ color: NAVY }}>{new Date(cov.first_costed_at).toISOString().slice(0, 10)}</strong>{cov.uncosted_rows > 0 ? <> — {fmtInt(cov.uncosted_rows)} earlier generation{cov.uncosted_rows === 1 ? "" : "s"} predate cost capture and read as $0.</> : "."}</>
          : <> <strong style={{ color: ERR }}>No costed generations yet</strong> — cost capture starts collecting on deploy and nothing backfills.</>}
      </div>

      {showInputs && (
        <div style={{ ...S.panel, marginBottom: 16 }}>
          <h2 style={S.panelTitle}>Change assumptions</h2>
          <div style={S.calloutTight}>
            This writes a new dated entry. Earlier months keep the price and fixed cost that were true then, so past reports do not move.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginTop: 12 }}>
            <label style={S.field}><span style={S.fieldLabel}>Price per customer / month</span>
              <input value={inPrice} onChange={(e) => setInPrice(e.target.value)} inputMode="decimal" style={S.input} /></label>
            <label style={S.field}><span style={S.fieldLabel}>Fixed cost / month</span>
              <input value={inFixed} onChange={(e) => setInFixed(e.target.value)} inputMode="decimal" style={S.input} /></label>
            <label style={S.field}><span style={S.fieldLabel}>Effective from</span>
              <input value={inDate} onChange={(e) => setInDate(e.target.value)} placeholder="YYYY-MM-DD" style={S.input} /></label>
            <label style={S.field}><span style={S.fieldLabel}>Note (optional)</span>
              <input value={inNote} onChange={(e) => setInNote(e.target.value)} style={S.input} /></label>
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={saveInputs} disabled={inBusy} style={S.primaryBtn}>{inBusy ? "Saving…" : "Save"}</button>
          </div>
          {inMsg && <div style={{ fontSize: 14, color: NAVY, marginTop: 10 }}>{inMsg}</div>}
          {(payload.inputs_history || []).length > 1 && (
            <table style={{ ...S.table, marginTop: 14 }}>
              <thead><tr><Th>Effective</Th><Th right>Price</Th><Th right>Fixed</Th><Th>Note</Th></tr></thead>
              <tbody>
                {payload.inputs_history.map((h) => (
                  <tr key={h.effective_date}>
                    <Td>{h.effective_date}</Td>
                    <Td right>{fmtUsd(h.price_per_customer)}</Td>
                    <Td right>{fmtUsd(h.fixed_monthly_cost)}</Td>
                    <Td muted>{h.note || "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div style={S.panelGrid}>
        {/* Month-to-date P&L */}
        <Panel title="Month to date">
          <table style={S.table}>
            <tbody>
              <Line label="Revenue" value={mtd.revenue} sub={`${fmtInt(head.paying_customers)} paying × ${fmtUsd(inputs.price_per_customer)}`} />
              <Line label="Fixed costs" value={-Math.abs(Number(mtd.fixed_cost) || 0)} />
              <Line label="API — customers" value={-Math.abs(Number(mtd.api_cost_customers) || 0)} cents />
              <Line label="API — internal testing" value={-Math.abs(Number(mtd.api_cost_internal) || 0)} sub="@career.club accounts" cents />
              {Number(mtd.api_cost_unattributed) > 0 &&
                <Line label="API — signed out" value={-Math.abs(Number(mtd.api_cost_unattributed) || 0)} sub="no account on the generation" cents />}
              <tr>
                <td style={{ ...S.td, borderTop: `2px solid ${BORDER}`, fontWeight: 700, color: NAVY }}>Net</td>
                <td style={{ ...S.td, borderTop: `2px solid ${BORDER}`, textAlign: "right", fontWeight: 700, fontFamily: "Georgia, serif", fontSize: 20, color: profitable ? OK : ERR }}>
                  {fmtUsd(mtd.net)}
                </td>
              </tr>
            </tbody>
          </table>
          <div style={{ ...S.muted, marginTop: 10 }}>
            {fmtInt(mtd.generations)} generations so far this month.
            {Number(inputs.price_per_customer) > 0 && head.external_users > 0 && (
              <> If all {fmtInt(head.external_users)} external accounts were paying, revenue would read {fmtUsd(mtd.revenue_if_all_paid)}.</>
            )}
          </div>
        </Panel>

        {/* Cost per user - the pro forma input */}
        <Panel title="What a user costs to serve" wide>
          <div style={S.calloutTight}>
            <strong style={{ color: NAVY }}>For a pro forma, use the modelled journey figure rather than the average.</strong> Most accounts have barely touched the product, so an average across all of them understates what a paying customer costs, and understating cost is the dangerous direction. The modelled figure prices one generation of each step a full journey needs, so it does not move with how many people happened to use the product this week.
          </div>

          <div style={{ ...S.tileGrid, marginTop: 14 }}>
            <Stat label="Modelled full journey" value={fmtUsd(unit.modelled_full_journey, true)} sub={`${fmtInt(unit.modelled_steps_priced)} of ${fmtInt(unit.modelled_steps_total)} steps priced`} accent />
            <Stat label="Median, active accounts" value={fmtUsd((unit.spread || {}).median, true)} sub={`${fmtInt((unit.spread || {}).accounts)} accounts`} />
            <Stat label="Mean, active accounts" value={fmtUsd((unit.spread || {}).mean, true)} />
            <Stat label="Top 10%" value={fmtUsd((unit.spread || {}).p90, true)} />
            <Stat label="Heaviest account" value={fmtUsd((unit.spread || {}).max, true)} />
          </div>

          <div style={S.subSectionLabel}>Cost against how far someone got</div>
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead><tr>
                <Th>Got as far as</Th><Th right>Accounts</Th><Th right>Spent anything</Th>
                <Th right>Mean cost</Th><Th right>Generations</Th><Th right>Coach turns</Th>
              </tr></thead>
              <tbody>
                {UNIT_STAGE_ORDER.map((code) => {
                  const r = (unit.by_stage || []).find((x) => x.stage === code)
                  if (!r) return null
                  return (
                    <tr key={code}>
                      <Td>{UNIT_STAGE_LABELS[code] || code}</Td>
                      <Td right>{fmtInt(r.accounts)}</Td>
                      <Td right>{fmtInt(r.accounts_with_spend)}</Td>
                      <Td right><strong style={{ color: NAVY }}>{fmtUsd(r.mean_cost, true)}</strong></Td>
                      <Td right>{fmtInt(r.generations)}</Td>
                      <Td right muted>{fmtInt(r.coach_turns)}</Td>
                    </tr>
                  )
                })}
                {(unit.by_stage || []).length === 0 && <tr><Td colSpan={6} muted>No costed generations yet.</Td></tr>}
              </tbody>
            </table>
          </div>

          <div style={S.subSectionLabel}>Cost per generation, by step</div>
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead><tr><Th>Step</Th><Th right>Generations</Th><Th right>Mean</Th><Th right>Median</Th><Th right>Total</Th></tr></thead>
              <tbody>
                {(unit.by_step || []).map((r) => (
                  <tr key={r.step}>
                    <Td>{r.step === "coach" ? "My Coach turn" : (NAV_LABELS[r.step] || r.step)}</Td>
                    <Td right>{fmtInt(r.generations)}</Td>
                    <Td right><strong style={{ color: NAVY }}>{fmtUsd(r.mean_cost, true)}</strong></Td>
                    <Td right muted>{fmtUsd(r.median_cost, true)}</Td>
                    <Td right>{fmtUsd(r.total_cost, true)}</Td>
                  </tr>
                ))}
                {(unit.by_step || []).length === 0 && <tr><Td colSpan={5} muted>No costed generations yet.</Td></tr>}
              </tbody>
            </table>
          </div>

          <div style={S.calloutTight}>
            <strong style={{ color: NAVY }}>Read the modelled figure as a floor.</strong> It counts one generation of each step and nothing else, so no regenerations, no coach turns, no Opportunity Playbooks. Real customers do all three, so budget above it rather than at it. The gap between mean and median in the tiles tells you how lopsided the spread is: a mean far above the median means a few heavy accounts are carrying it, and the median is the safer planning number.
            {cov.first_costed_at && <> Cost capture began {new Date(cov.first_costed_at).toISOString().slice(0, 10)}, so this is a short window. The per-step figures hold up better than the per-account ones as a result.</>}
          </div>
        </Panel>

        {/* Breakeven */}
        <Panel title="Breakeven">
          <div style={S.tileGrid}>
            <Stat label="Customers needed" value={be.customers_needed === null ? "—" : fmtInt(be.customers_needed)} accent />
            <Stat label="Paying today" value={fmtInt(be.customers_now)} />
            <Stat label="Gap" value={be.gap === null ? "—" : fmtInt(be.gap)} danger={Number(be.gap) > 0} />
            <Stat label="Cost to serve one" value={fmtUsd(be.variable_per_customer, true)} sub={`${be.window_days}d`} />
          </div>
          <div style={S.calloutTight}>
            {be.customers_needed === null
              ? <>Cost to serve one customer is at or above the price, so no customer count covers the fixed base. Check the cost-per-user table below.</>
              : <>
                  {fmtUsd(be.fixed_monthly_cost)} of fixed cost ÷ {fmtUsd(be.contribution_per_customer, true)} left over per customer = <strong style={{ color: NAVY }}>{fmtInt(be.customers_needed)} customers</strong>.
                  {be.months_to_breakeven !== null && Number(be.gap) > 0 && (
                    <> At the last {months.length} months' average of {(Number(be.signups_per_month) || 0).toFixed(1)} signups/month, that is roughly {Math.ceil(Number(be.months_to_breakeven))} month{Math.ceil(Number(be.months_to_breakeven)) === 1 ? "" : "s"} — straight-line arithmetic on a small base, not a forecast.</>
                  )}
                  {Number(be.gap) === 0 && <> Already there.</>}
                </>}
          </div>
          <div style={{ ...S.muted, marginTop: 8 }}>
            Cost to serve is the trailing {be.window_days} days across {fmtInt(be.window_users)} external account{be.window_users === 1 ? "" : "s"}.
          </div>
        </Panel>

        {/* Daily API cost */}
        <Panel title={`Daily API cost — last ${daily.length} active day${daily.length === 1 ? "" : "s"}`} wide>
          {daily.length === 0
            ? <div style={S.muted}>No generations logged yet.</div>
            : <DailyChart rows={daily} />}
        </Panel>

        {/* Token mix */}
        <Panel title="Token mix, month to date">
          <div style={S.tileGrid}>
            <Stat label="Cache reads" value={fmtTokens(mix.cache_read_tokens)} sub="0.1× rate" accent />
            <Stat label="Cache writes" value={fmtTokens(mix.cache_write_tokens)} sub="1.25× rate" />
            <Stat label="Input" value={fmtTokens(mix.input_tokens)} />
            <Stat label="Output" value={fmtTokens(mix.output_tokens)} sub="5× rate" />
            <Stat label="Web searches" value={fmtInt(mix.web_searches)} sub="$0.01 ea" />
          </div>
          <div style={S.calloutTight}>
            Cached reads cost a tenth of fresh input. If that share falls, cost per generation climbs without anything else changing — this is the first place a caching regression shows up.
          </div>
        </Panel>

        {/* Monthly P&L */}
        <Panel title="P&L by month" wide>
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead><tr>
                <Th>Month</Th><Th right>Paying</Th><Th right>Signups</Th><Th right>Generations</Th>
                <Th right>Revenue</Th><Th right>Fixed</Th><Th right>API</Th><Th right>Net</Th>
              </tr></thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month}>
                    <Td>{monthLabel(m.month)}</Td>
                    <Td right>{fmtInt(m.paying_customers)}</Td>
                    <Td right>{fmtInt(m.signups)}</Td>
                    <Td right>{fmtInt(m.generations)}</Td>
                    <Td right>{fmtUsd(m.revenue)}</Td>
                    <Td right>{fmtUsd(m.fixed_cost)}</Td>
                    <Td right>{fmtUsd(m.api_cost, true)}</Td>
                    <Td right><strong style={{ color: Number(m.net) >= 0 ? OK : ERR }}>{fmtUsd(m.net)}</strong></Td>
                  </tr>
                ))}
                {months.length === 0 && <tr><Td colSpan={8} muted>No months to report.</Td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Cost per user */}
        <Panel title={`Cost per account — last 30 days (top ${perUser.length})`} wide>
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead><tr>
                <Th right>#</Th><Th>Account</Th><Th>Billing</Th><Th right>Generations</Th><Th right>Coach turns</Th><Th right>API cost</Th>
              </tr></thead>
              <tbody>
                {perUser.map((u, i) => (
                  <tr key={u.email}>
                    <Td right muted>{i + 1}</Td>
                    <Td>{u.email}</Td>
                    <Td>{u.paying ? <span style={{ color: OK, fontWeight: 600 }}>Paying</span> : <span style={{ color: GRAYL }}>Not recorded</span>}</Td>
                    <Td right>{fmtInt(u.generations)}</Td>
                    <Td right>{fmtInt(u.coach_turns)}</Td>
                    <Td right><strong style={{ color: NAVY }}>{fmtUsd(u.cost, true)}</strong></Td>
                  </tr>
                ))}
                {perUser.length === 0 && <tr><Td colSpan={6} muted>No costed generations in the last 30 days.</Td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Billing control */}
        <Panel title="Mark a paying customer" wide>
          <div style={S.calloutTight}>
            The database records logins, not payments. Set the date an account started paying and it joins the revenue line from that month forward. Leave the date blank and press Clear to undo a mistake — this is a correction, not a cancellation record.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginTop: 12 }}>
            <label style={{ ...S.field, minWidth: 240, flex: 1 }}><span style={S.fieldLabel}>Email</span>
              <input value={billEmail} onChange={(e) => setBillEmail(e.target.value)} placeholder="user@example.com" style={S.input} /></label>
            <label style={{ ...S.field, minWidth: 160 }}><span style={S.fieldLabel}>Paying since</span>
              <input value={billDate} onChange={(e) => setBillDate(e.target.value)} placeholder="YYYY-MM-DD" style={S.input} /></label>
            <button onClick={() => saveBilling(false)} disabled={billBusy} style={S.primaryBtn}>{billBusy ? "…" : "Save"}</button>
            <button onClick={() => saveBilling(true)} disabled={billBusy} style={S.smallBtn}>Clear</button>
          </div>
          {billMsg && <div style={{ fontSize: 14, color: NAVY, marginTop: 10 }}>{billMsg}</div>}
        </Panel>
      </div>
    </>
  )
}

// Daily cost bars. viewBox + width:100% so it scales with the panel; the
// tallest bar sets the scale and the value is printed above it, which is the
// only label a 30-bar series has room for.
function DailyChart({ rows }) {
  const W = 640, H = 150, PAD_B = 22, PAD_T = 18
  const max = Math.max(...rows.map((r) => Number(r.cost) || 0), 0.000001)
  const slot = W / rows.length
  const barW = Math.max(2, Math.min(22, slot * 0.7))
  const peak = rows.reduce((a, b) => (Number(b.cost) > Number(a.cost) ? b : a), rows[0])
  const total = rows.reduce((s, r) => s + (Number(r.cost) || 0), 0)
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" role="img"
        aria-label={`Daily API cost, ${rows.length} days, total ${total.toFixed(2)} dollars`}
        style={{ display: "block", overflow: "visible" }}>
        <line x1="0" y1={H - PAD_B} x2={W} y2={H - PAD_B} stroke={BORDER} strokeWidth="1" />
        {rows.map((r, i) => {
          const v = Number(r.cost) || 0
          const h = Math.max(1, ((H - PAD_B - PAD_T) * v) / max)
          const x = i * slot + (slot - barW) / 2
          const isPeak = r.day === peak.day
          return (
            <g key={r.day}>
              <rect x={x} y={H - PAD_B - h} width={barW} height={h} rx="2"
                fill={isPeak ? GOLDL : GOLD} opacity={isPeak ? 1 : 0.75}>
                <title>{`${r.day} · ${r.generations} generations · $${v.toFixed(4)}`}</title>
              </rect>
              {isPeak && (
                <text x={x + barW / 2} y={H - PAD_B - h - 5} textAnchor="middle" fontSize="11" fill={NAVY} fontWeight="700">
                  {`$${v.toFixed(2)}`}
                </text>
              )}
            </g>
          )
        })}
        <text x="0" y={H - 6} fontSize="11" fill={GRAYL}>{rows[0].day}</text>
        <text x={W} y={H - 6} fontSize="11" fill={GRAYL} textAnchor="end">{rows[rows.length - 1].day}</text>
      </svg>
      <div style={{ ...S.muted, marginTop: 8 }}>
        {fmtUsd(total, true)} across these {rows.length} day{rows.length === 1 ? "" : "s"} · busiest day {peak.day} at {fmtUsd(peak.cost, true)}. Hover a bar for its detail.
      </div>
    </>
  )
}

// ---- presentational sub-components (mirrors AdminDashboard.jsx) ----
function Panel({ title, children, wide }) {
  return (
    <section style={{ ...S.panel, ...(wide ? { gridColumn: "1 / -1" } : {}) }}>
      <h2 style={S.panelTitle}>{title}</h2>
      {children}
    </section>
  )
}
function Stat({ label, value, sub, accent, danger }) {
  const color = danger ? ERR : accent ? GOLDL : NAVY
  return (
    <div style={S.tile}>
      <div style={{ ...S.tileValue, color }}>{value === null || value === undefined ? "—" : value}</div>
      <div style={S.tileLabel}>{label}{sub ? <span style={S.tileSub}> · {sub}</span> : null}</div>
    </div>
  )
}
function Line({ label, value, sub, cents }) {
  const v = Number(value) || 0
  return (
    <tr>
      <td style={S.td}>{label}{sub ? <span style={{ color: GRAYL, fontSize: 13 }}> · {sub}</span> : null}</td>
      <td style={{ ...S.td, textAlign: "right", color: v < 0 ? GRAY : NAVY, fontWeight: 600 }}>{fmtUsd(v, cents)}</td>
    </tr>
  )
}
function Th({ children, right }) {
  return <th style={{ ...S.th, textAlign: right ? "right" : "left" }}>{children}</th>
}
function Td({ children, right, muted, colSpan }) {
  return <td colSpan={colSpan} style={{ ...S.td, textAlign: right ? "right" : "left", color: muted ? GRAYL : GRAY }}>{children}</td>
}

const S = {
  headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 },
  panelGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 },
  panel: { background: "#FFFFFF", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 2px rgba(26,37,64,0.04)" },
  panelTitle: { fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 600, color: GOLDL, margin: "0 0 14px", borderBottom: `1px solid ${BORDER}`, paddingBottom: 8 },
  // Guidance gets the gold border-left treatment so it never reads as body copy
  // or as data (CLAUDE.md section 8).
  callout: { borderLeft: `4px solid ${GOLD}`, background: "#FDF8F0", borderRadius: "0 10px 10px 0", padding: "12px 16px", fontSize: 14, lineHeight: 1.6, color: GRAY, marginBottom: 16 },
  calloutTight: { borderLeft: `4px solid ${GOLD}`, background: "#FDF8F0", borderRadius: "0 8px 8px 0", padding: "10px 12px", fontSize: 14, lineHeight: 1.55, color: GRAY, marginTop: 12 },
  tileGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 },
  tile: { background: CREAM, borderRadius: 10, padding: "12px 14px" },
  tileValue: { fontSize: 26, fontWeight: 700, lineHeight: 1.1, fontFamily: "Georgia, serif" },
  tileLabel: { fontSize: 12, color: GRAYL, marginTop: 4, lineHeight: 1.3 },
  tileSub: { color: GOLDL, fontStyle: "italic" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { color: GRAYL, fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", padding: "6px 8px", borderBottom: `1px solid ${BORDER}` },
  td: { padding: "7px 8px", borderBottom: `1px solid ${BORDER}` },
  field: { display: "flex", flexDirection: "column", gap: 4 },
  fieldLabel: { fontSize: 12, color: GRAYL, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 },
  input: { border: `1px solid ${BORDER}`, borderRadius: 8, padding: "9px 12px", fontSize: 16, fontFamily: "inherit", color: NAVY, outline: "none", boxSizing: "border-box", width: "100%" },
  primaryBtn: { background: GOLD, border: `1px solid ${GOLD}`, color: "#FFFFFF", borderRadius: 8, padding: "9px 18px", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  smallBtn: { background: "transparent", border: `1px solid ${BORDER}`, color: NAVY, borderRadius: 8, padding: "8px 16px", fontSize: 16, cursor: "pointer", fontFamily: "inherit" },
  refreshBtn: { background: NAVY, border: `1px solid ${NAVY}`, color: "#FFFFFF", borderRadius: 8, padding: "8px 16px", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  muted: { color: GRAYL, fontSize: 14, lineHeight: 1.5 },
  errorBanner: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "#FDECEA", border: `1px solid ${ERR}55`, color: ERR, borderRadius: 10, padding: "12px 16px", marginBottom: 18, fontSize: 14 },
  retryBtn: { background: ERR, border: "none", color: "#FFFFFF", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
}
