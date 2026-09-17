// Registration-to-donation funnel (2026-09-17 brief, part 2): donation rate
// and the time-to-donate distribution, aggregate only -- no donor identities
// here (that ledger is DonationsDashboard.jsx, 'admin'-only). Own endpoint
// (/api/admin/donation-funnel), own fetch, own render -- same reasoning as
// DonationsDashboard.jsx for why this stays a separate component rather than
// a field bolted onto that one.
//
// Same house style as DonationsDashboard.jsx: hand-drawn inline SVG bar
// chart, no charting library.
import { useState, useEffect, useCallback } from "react"

const NAVY = "#1A2540"
const GOLD = "#C8924A"
const GOLDL = "#A06828"
const BORDER = "#E2E5EA"
const GRAY = "#3D4A5C"
const GRAYL = "#6B7685"
const ERR = "#C0432F"

const fmtPct = (n) => (n === null || n === undefined || !Number.isFinite(Number(n))) ? "—" : `${(Number(n) * 100).toFixed(1)}%`

export default function DonationFunnelDashboard() {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/admin/donation-funnel", { credentials: "include" })
      if (res.status === 200) {
        setPayload(await res.json())
      } else {
        setError(`Request failed (HTTP ${res.status}).`)
      }
    } catch {
      setError("Network error reaching the donation-funnel endpoint.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading && !payload) return <div style={S.muted}>Loading donation funnel…</div>
  if (error && !payload) return (
    <div style={S.errorBanner}><span>{error}</span><button onClick={() => fetchData()} style={S.retryBtn}>Retry</button></div>
  )
  if (!payload) return null

  const buckets = payload.time_to_donate || []
  const maxCount = Math.max(1, ...buckets.map(b => b.count))

  return (
    <div style={{ marginTop: 28 }}>
      <div style={S.headerRow}>
        <h2 style={S.sectionTitle}>Donation funnel</h2>
        <button onClick={() => fetchData()} disabled={loading} style={S.refreshBtn}>{loading ? "…" : "Refresh"}</button>
      </div>

      <div style={S.callout}>
        What share of registered accounts ever give, and how long after they registered — the shape of the curve, not who gave.
        {payload.unmatched_donations > 0 && <> {payload.unmatched_donations} donation{payload.unmatched_donations === 1 ? "" : "s"} could not be matched to an account (a billing email that doesn't match the account email) and are not in the rate or curve below.</>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 18 }}>
        <Stat label="Donation rate" value={fmtPct(payload.donation_rate)} sub={`${payload.donor_count} of ${payload.total_users} registered accounts`} />
        <Stat label="Unmatched donations" value={payload.unmatched_donations} />
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
  statCard: { background: "#FFFFFF", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px" },
  statLabel: { fontSize: 15, color: GRAYL, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" },
  statValue: { fontSize: 26, color: NAVY, fontWeight: 700, fontFamily: "Georgia, serif", marginTop: 4 },
  statSub: { fontSize: 15, color: GRAYL, marginTop: 4 },
}
