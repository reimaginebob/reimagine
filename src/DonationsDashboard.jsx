// Direct donations — Stripe (career.club account). A distinct block within
// the Economics tab, deliberately NOT merged into EconomicsDashboard's
// paying-customer numbers: donations and NextPlacement / paying-customer
// revenue are two different things (CLAUDE.md; Output/handoff/2026-09-16_
// direct-donation-tracking.md). Own endpoint (/api/admin/donations), own
// fetch, own render — the only thing it shares with EconomicsDashboard is
// the tab it renders inside of.
//
// Same house style as EconomicsDashboard.jsx: hand-drawn inline SVG bar
// chart, no charting library (a dependency would add weight to a bundle
// every user downloads for a page only admins open).
import { useState, useEffect, useCallback } from "react"

const NAVY = "#1A2540"
const GOLD = "#C8924A"
const GOLDL = "#A06828"
const BORDER = "#E2E5EA"
const GRAY = "#3D4A5C"
const GRAYL = "#6B7685"
const ERR = "#C0432F"

const fmtUsd = (cents) => {
  if (cents === null || cents === undefined || !Number.isFinite(Number(cents))) return "—"
  return `$${(Number(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
const fmtPct = (n) => (n === null || n === undefined || !Number.isFinite(Number(n))) ? "—" : `${(Number(n) * 100).toFixed(1)}%`
const fmtDays = (n) => (n === null || n === undefined) ? "—" : (n < 1 ? "<1 day" : `${Number(n).toFixed(1)} days`)
const fmtDate = (iso) => iso ? new Date(iso).toISOString().slice(0, 10) : "—"

export default function DonationsDashboard() {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/admin/donations", { credentials: "include" })
      if (res.status === 200) {
        setPayload(await res.json())
      } else {
        setError(`Request failed (HTTP ${res.status}).`)
      }
    } catch {
      setError("Network error reaching the donations endpoint.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading && !payload) return <div style={S.muted}>Loading donations…</div>
  if (error && !payload) return (
    <div style={S.errorBanner}><span>{error}</span><button onClick={() => fetchData()} style={S.retryBtn}>Retry</button></div>
  )
  if (!payload) return null

  const buckets = payload.gap_buckets || []
  const maxCount = Math.max(1, ...buckets.map(b => b.count))
  const donors = payload.donors || []

  return (
    <div style={{ marginTop: 28 }}>
      <div style={S.headerRow}>
        <h2 style={S.sectionTitle}>Direct donations (Stripe)</h2>
        <button onClick={() => fetchData()} disabled={loading} style={S.refreshBtn}>{loading ? "…" : "Refresh"}</button>
      </div>

      <div style={S.callout}>
        Career Club donations taken through the career.club Stripe account, kept separate from the paying-customer numbers above — a different revenue stream, not a second way of counting the same one.
        {" "}A donation counts toward a person below only if they were signed in to Reimagine at the moment they gave; Stripe carries no other way to connect a payment to an account.
        {payload.unattributed.count > 0 && <> {payload.unattributed.count} donation{payload.unattributed.count === 1 ? "" : "s"} totaling {fmtUsd(payload.unattributed.cents)} could not be matched to a signed-in account and are not in the numbers below.</>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 18 }}>
        <Stat label="Donor rate" value={fmtPct(payload.donor_rate)} sub={`${payload.donor_count} of ${payload.total_users} registered accounts`} />
        <Stat label="Median time to first gift" value={fmtDays(payload.median_gap_days)} />
        <Stat label="Average time to first gift" value={fmtDays(payload.avg_gap_days)} />
      </div>

      <div style={S.panel}>
        <h3 style={S.panelTitle}>Time from registration to first donation</h3>
        {payload.donor_count === 0
          ? <div style={S.muted}>No donations linked to an account yet.</div>
          : <svg viewBox={`0 0 640 ${40 * buckets.length + 10}`} width="100%" style={{ maxWidth: 640, display: "block" }}>
              {buckets.map((b, i) => {
                const y = i * 40 + 8
                const w = Math.max(2, (b.count / maxCount) * 400)
                return (
                  <g key={b.key}>
                    <text x="0" y={y + 15} fontSize="15" fill={GRAY}>{b.label}</text>
                    <rect x="150" y={y} width={w} height="20" rx="4" fill={GOLD} />
                    <text x={150 + w + 8} y={y + 15} fontSize="15" fill={NAVY} fontWeight="700">{b.count}</text>
                  </g>
                )
              })}
            </svg>}
      </div>

      {donors.length > 0 && (
        <div style={{ ...S.panel, marginTop: 16 }}>
          <h3 style={S.panelTitle}>Donors</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead><tr><Th>Email</Th><Th>Registered</Th><Th>First gift</Th><Th right>Gap</Th><Th right>Lifetime</Th><Th right>Gifts</Th></tr></thead>
              <tbody>
                {donors.map(d => (
                  <tr key={d.email} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td style={S.td}>{d.email}</td>
                    <td style={S.td}>{fmtDate(d.registered_at)}</td>
                    <td style={S.td}>{fmtDate(d.first_donated_at)}</td>
                    <td style={{ ...S.td, textAlign: "right" }}>{fmtDays(d.gap_days)}</td>
                    <td style={{ ...S.td, textAlign: "right" }}>{fmtUsd(d.lifetime_cents)}</td>
                    <td style={{ ...S.td, textAlign: "right" }}>{d.donation_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div style={S.statCard}>
      <div style={S.statLabel}>{label}</div>
      <div style={S.statValue}>{value}</div>
      {sub && <div style={S.statSub}>{sub}</div>}
    </div>
  )
}

function Th({ children, right }) {
  return <th style={{ textAlign: right ? "right" : "left", fontSize: 15, color: GRAYL, fontWeight: 700, padding: "0 8px 8px 8px", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>{children}</th>
}

const S = {
  headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 },
  sectionTitle: { fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 700, color: NAVY, margin: 0 },
  panel: { background: "#FFFFFF", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 2px rgba(26,37,64,0.04)" },
  panelTitle: { fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 600, color: GOLDL, margin: "0 0 14px", borderBottom: `1px solid ${BORDER}`, paddingBottom: 8 },
  callout: { borderLeft: `4px solid ${GOLD}`, background: "#FDF8F0", borderRadius: "0 10px 10px 0", padding: "12px 16px", fontSize: 15, lineHeight: 1.6, color: GRAY, marginBottom: 16 },
  muted: { color: GRAYL, fontSize: 15, lineHeight: 1.5 },
  errorBanner: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "#FDECEA", border: `1px solid ${ERR}55`, color: ERR, borderRadius: 10, padding: "12px 16px", marginBottom: 18, fontSize: 15 },
  retryBtn: { background: ERR, border: "none", color: "#FFFFFF", borderRadius: 6, padding: "8px 16px", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  refreshBtn: { background: NAVY, border: `1px solid ${NAVY}`, color: "#FFFFFF", borderRadius: 8, padding: "8px 16px", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 15 },
  td: { padding: "8px", fontSize: 15, color: GRAY, whiteSpace: "nowrap" },
  statCard: { background: "#FFFFFF", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px" },
  statLabel: { fontSize: 15, color: GRAYL, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" },
  statValue: { fontSize: 26, color: NAVY, fontWeight: 700, fontFamily: "Georgia, serif", marginTop: 4 },
  statSub: { fontSize: 15, color: GRAYL, marginTop: 4 },
}
