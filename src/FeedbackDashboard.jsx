// Feedback dashboard — the Feedback tab of /admin/dashboard. Renders the six
// views over feedback_event: KPI row, by-channel cards, by-theme stacked bar,
// theme x channel matrix, surface x sentiment table, recurring-concern callout,
// and a theme/channel-filterable feed. Data comes from the admin-gated
// /api/admin/feedback-dashboard endpoint (same ADMIN_TOKEN as the analytics tab).
//
// Self-contained inline styles in the app's cream/navy/amber palette, matching
// AdminDashboard.jsx. No new dependencies.
import { useState, useEffect, useCallback } from "react"

const NAVY = "#1A2540"
const GOLD = "#C8924A"
const GOLDL = "#A06828"
const BORDER = "#E2E5EA"
const CREAM = "#FBF8F2"
const GRAY = "#3D4A5C"
const GRAYL = "#6B7685"

// Sentiment palette, reused across every view so colours read consistently.
const SENT = {
  positive: { label: "Positive", color: "#4A9E72" },
  negative: { label: "Negative", color: "#C0432F" },
  neutral: { label: "Neutral", color: "#8A94A3" },
  mixed: { label: "Mixed", color: "#C8924A" },
}
const SENT_ORDER = ["positive", "negative", "neutral", "mixed"]

export default function FeedbackDashboard({ token }) {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [liveAsOf, setLiveAsOf] = useState(null)
  const [filterTheme, setFilterTheme] = useState("")
  const [filterChannel, setFilterChannel] = useState("")

  const fetchData = useCallback(async (tok) => {
    if (!tok) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/admin/feedback-dashboard`, { headers: { Authorization: `Bearer ${tok}` } })
      if (res.status === 200) {
        setPayload(await res.json())
        setLiveAsOf(new Date().toUTCString())
      } else {
        setError(`Request failed (HTTP ${res.status}).`)
      }
    } catch (e) {
      setError("Network error reaching the feedback endpoint.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(token) }, [token, fetchData])

  if (loading && !payload) return <div style={S.muted}>Loading feedback…</div>
  if (error && !payload) return (
    <div style={S.errorBanner}><span>{error}</span><button onClick={() => fetchData(token)} style={S.retryBtn}>Retry</button></div>
  )
  if (!payload) return null

  const { kpis, byChannel, byTheme, matrix, surfaceSentiment, recurringConcerns, feed } = payload

  const pct = (n) => (n == null ? "—" : `${Math.round(n * 100)}%`)
  const maxThemeTotal = Math.max(1, ...byTheme.map(t => t.total))

  const feedRows = feed.filter(r =>
    (!filterChannel || r.source === filterChannel) &&
    (!filterTheme || (r.themes || []).some(t => t.code === filterTheme))
  )

  return (
    <div>
      <div style={S.subhead}>
        {liveAsOf ? <>Feedback live as of <strong style={{ color: NAVY }}>{liveAsOf}</strong></> : "Loading…"}
        <button onClick={() => fetchData(token)} disabled={loading} style={S.miniRefresh}>{loading ? "…" : "Refresh"}</button>
      </div>

      {/* KPI ROW */}
      <div style={S.kpiRow}>
        <Kpi label="Total events" value={kpis.totalEvents} accent />
        <Kpi label="NPS" value={kpis.nps == null ? "—" : kpis.nps} accent />
        <Kpi label="Negative share" value={pct(kpis.negativeShare)} sub={`${kpis.negativeCount}/${kpis.withSentiment} tagged`} />
        <Kpi label="Recurring concerns" value={kpis.recurringConcernCount} sub={`themes ≥ 5 & negative-leaning`} />
      </div>

      {/* RECURRING-CONCERN CALLOUT */}
      <div style={recurringConcerns.length ? S.calloutWarn : S.calloutOk}>
        {recurringConcerns.length ? (
          <>
            <strong style={{ color: SENT.negative.color }}>Recurring concerns</strong>
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {recurringConcerns.map(c => (
                <span key={c.theme} style={S.concernPill}>{c.label} · {c.negative}/{c.total} negative</span>
              ))}
            </div>
          </>
        ) : (
          <span><strong style={{ color: SENT.positive.color }}>No recurring concerns.</strong> No concern theme has reached 5+ negative-leaning events yet.</span>
        )}
      </div>

      <div style={S.grid}>
        {/* BY-CHANNEL CARDS */}
        <Panel title="By channel" wide>
          <div style={S.channelGrid}>
            {byChannel.map(ch => (
              <div key={ch.source} style={S.channelCard}>
                <div style={S.channelHead}>
                  <span style={S.channelName}>{ch.label}</span>
                  <span style={S.channelVol}>{ch.volume} {ch.volume === 1 ? "event" : "events"}</span>
                </div>
                <div style={S.nativeLine}>{nativeMetric(ch)}</div>
                <SentimentBar split={ch.sentiment} />
                <SentimentCounts split={ch.sentiment} />
              </div>
            ))}
          </div>
        </Panel>

        {/* BY-THEME STACKED BAR */}
        <Panel title="By concern theme" wide>
          <Legend />
          {byTheme.length === 0 && <div style={S.muted}>No themed events yet.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {byTheme.map(t => (
              <div key={t.theme} style={S.themeRow}>
                <div style={S.themeLabel} title={t.theme}>{t.label}</div>
                <div style={S.themeBarWrap}>
                  <div style={{ ...S.themeBarTrack, width: `${(t.total / maxThemeTotal) * 100}%` }}>
                    {SENT_ORDER.map(s => t[s] > 0 && (
                      <div key={s} title={`${SENT[s].label}: ${t[s]}`} style={{ width: `${(t[s] / t.total) * 100}%`, background: SENT[s].color, height: "100%" }} />
                    ))}
                  </div>
                  <span style={S.themeTotal}>{t.total}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* THEME x CHANNEL MATRIX */}
        <Panel title="Theme × channel" wide>
          {matrix.themes.length === 0 ? <div style={S.muted}>No themed events yet.</div> : (
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead><tr>
                  <Th>Theme</Th>
                  {matrix.channels.map(c => <Th key={c.source} right>{c.label}</Th>)}
                  <Th right>Total</Th>
                </tr></thead>
                <tbody>
                  {matrix.cells.map(row => {
                    const rowTotal = row.counts.reduce((a, b) => a + b, 0)
                    const label = matrix.themes.find(t => t.theme === row.theme)?.label || row.theme
                    return (
                      <tr key={row.theme}>
                        <Td>{label}</Td>
                        {row.counts.map((n, i) => <Td key={i} right>{n || <span style={{ color: BORDER }}>·</span>}</Td>)}
                        <Td right><strong style={{ color: NAVY }}>{rowTotal}</strong></Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* SURFACE x SENTIMENT TABLE */}
        <Panel title="Surface × sentiment" wide>
          <table style={S.table}>
            <thead><tr>
              <Th>Surface</Th>
              {SENT_ORDER.map(s => <Th key={s} right>{SENT[s].label}</Th>)}
              <Th right>Total</Th>
            </tr></thead>
            <tbody>
              {surfaceSentiment.map(row => (
                <tr key={row.surface}>
                  <Td>{row.label}</Td>
                  {SENT_ORDER.map(s => <Td key={s} right>{row[s] || <span style={{ color: BORDER }}>·</span>}</Td>)}
                  <Td right><strong style={{ color: NAVY }}>{row.total}</strong></Td>
                </tr>
              ))}
              {surfaceSentiment.length === 0 && <tr><Td colSpan={6} muted>No events yet.</Td></tr>}
            </tbody>
          </table>
        </Panel>

        {/* FEED */}
        <Panel title={`Feed (${feedRows.length}${feedRows.length !== feed.length ? ` of ${feed.length}` : ""})`} wide>
          <div style={S.filterRow}>
            <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)} style={S.select}>
              <option value="">All channels</option>
              {byChannel.map(c => <option key={c.source} value={c.source}>{c.label}</option>)}
            </select>
            <select value={filterTheme} onChange={e => setFilterTheme(e.target.value)} style={S.select}>
              <option value="">All themes</option>
              {byTheme.map(t => <option key={t.theme} value={t.theme}>{t.label}</option>)}
            </select>
            {(filterChannel || filterTheme) && (
              <button onClick={() => { setFilterChannel(""); setFilterTheme("") }} style={S.clearBtn}>Clear</button>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead><tr>
                <Th>Channel</Th><Th>Surface</Th><Th>Themes</Th><Th>Sentiment</Th><Th right>Native</Th><Th>Date</Th><Th>Build</Th>
              </tr></thead>
              <tbody>
                {feedRows.map(r => (
                  <tr key={r.id}>
                    <Td>{r.sourceLabel}</Td>
                    <Td>{r.surfaceLabel || <span style={{ color: GRAYL }}>—</span>}</Td>
                    <Td>{r.themes.length ? r.themes.map(t => t.label).join(", ") : <span style={{ color: GRAYL }}>—</span>}</Td>
                    <Td>{r.sentiment ? <SentTag s={r.sentiment} /> : <span style={{ color: GRAYL }}>—</span>}</Td>
                    <Td right>{fmtNative(r)}</Td>
                    <Td>{r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "—"}</Td>
                    <Td>{r.commitSha ? <code style={S.sha}>{String(r.commitSha).slice(0, 7)}</code> : <span style={{ color: GRAYL }}>—</span>}</Td>
                  </tr>
                ))}
                {feedRows.length === 0 && <tr><Td colSpan={7} muted>No events match the filter.</Td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  )
}

// ---- helpers ----
function nativeMetric(ch) {
  if (!ch.native) return <span style={{ color: GRAYL }}>Free text · no native metric</span>
  if (ch.native.type === "nps") {
    if (ch.native.responses === 0) return <span style={{ color: GRAYL }}>No responses</span>
    return <span>NPS <strong style={{ color: NAVY }}>{ch.native.nps}</strong> · avg {ch.native.avg} · {ch.native.promoters}P / {ch.native.passives}N / {ch.native.detractors}D ({ch.native.responses})</span>
  }
  if (ch.native.type === "thumb") {
    return <span>👍 <strong style={{ color: SENT.positive.color }}>{ch.native.up}</strong> · 👎 <strong style={{ color: SENT.negative.color }}>{ch.native.down}</strong> · net {ch.native.net >= 0 ? "+" : ""}{ch.native.net}</span>
  }
  return null
}
function fmtNative(r) {
  if (r.nativeType === "nps") return <span title="NPS score">{r.nativeValue}</span>
  if (r.nativeType === "thumb") return r.nativeValue > 0 ? "👍" : "👎"
  return <span style={{ color: GRAYL }}>—</span>
}

// ---- presentational ----
function Panel({ title, children, wide }) {
  return (
    <section style={{ ...S.panel, ...(wide ? { gridColumn: "1 / -1" } : {}) }}>
      <h2 style={S.panelTitle}>{title}</h2>
      {children}
    </section>
  )
}
function Kpi({ label, value, sub, accent }) {
  return (
    <div style={S.kpi}>
      <div style={{ ...S.kpiValue, color: accent ? GOLDL : NAVY }}>{value}</div>
      <div style={S.kpiLabel}>{label}{sub ? <span style={S.kpiSub}> · {sub}</span> : null}</div>
    </div>
  )
}
function SentimentBar({ split }) {
  const total = split.withSentiment || 0
  if (!total) return <div style={{ ...S.sentBar, background: BORDER }} />
  return (
    <div style={S.sentBar}>
      {SENT_ORDER.map(s => split[s] > 0 && (
        <div key={s} title={`${SENT[s].label}: ${split[s]}`} style={{ width: `${(split[s] / total) * 100}%`, background: SENT[s].color, height: "100%" }} />
      ))}
    </div>
  )
}
function SentimentCounts({ split }) {
  return (
    <div style={S.sentCounts}>
      {SENT_ORDER.map(s => (
        <span key={s} style={{ color: split[s] ? SENT[s].color : GRAYL }}>{SENT[s].label[0]} {split[s]}</span>
      ))}
    </div>
  )
}
function SentTag({ s }) {
  return <span style={{ ...S.sentTag, background: `${SENT[s].color}1A`, color: SENT[s].color }}>{SENT[s].label}</span>
}
function Legend() {
  return (
    <div style={S.legend}>
      {SENT_ORDER.map(s => (
        <span key={s} style={S.legendItem}><span style={{ ...S.legendDot, background: SENT[s].color }} />{SENT[s].label}</span>
      ))}
    </div>
  )
}
function Th({ children, right }) { return <th style={{ ...S.th, textAlign: right ? "right" : "left" }}>{children}</th> }
function Td({ children, right, muted, colSpan }) {
  return <td colSpan={colSpan} style={{ ...S.td, textAlign: right ? "right" : "left", color: muted ? GRAYL : GRAY }}>{children}</td>
}

const S = {
  subhead: { fontSize: 14, color: GRAYL, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 },
  miniRefresh: { background: "transparent", border: `1px solid ${BORDER}`, color: GRAY, borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" },
  kpiRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 16 },
  kpi: { background: "#FFFFFF", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "16px 18px", boxShadow: "0 1px 2px rgba(26,37,64,0.04)" },
  kpiValue: { fontSize: 32, fontWeight: 700, lineHeight: 1.05, fontFamily: "Georgia, serif" },
  kpiLabel: { fontSize: 12, color: GRAYL, marginTop: 6, lineHeight: 1.3 },
  kpiSub: { color: GOLDL, fontStyle: "italic" },
  calloutOk: { background: "#F0F6F2", border: `1px solid #4A9E7244`, borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 14, color: GRAY },
  calloutWarn: { background: "#FDECEA", border: `1px solid #C0432F44`, borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 14, color: GRAY },
  concernPill: { background: "#FFFFFF", border: `1px solid #C0432F55`, color: "#C0432F", borderRadius: 999, padding: "4px 12px", fontSize: 13, fontWeight: 600 },
  grid: { display: "grid", gridTemplateColumns: "1fr", gap: 16 },
  panel: { background: "#FFFFFF", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 2px rgba(26,37,64,0.04)" },
  panelTitle: { fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 600, color: GOLDL, margin: "0 0 14px", borderBottom: `1px solid ${BORDER}`, paddingBottom: 8 },
  channelGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 },
  channelCard: { background: CREAM, borderRadius: 12, padding: "14px 16px" },
  channelHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 },
  channelName: { fontWeight: 700, color: NAVY, fontSize: 15 },
  channelVol: { fontSize: 13, color: GRAYL },
  nativeLine: { fontSize: 13, color: GRAY, marginBottom: 10, minHeight: 18 },
  sentBar: { display: "flex", width: "100%", height: 12, borderRadius: 6, overflow: "hidden", background: "#EEF0F3" },
  sentCounts: { display: "flex", justifyContent: "space-between", gap: 8, marginTop: 6, fontSize: 12, fontWeight: 600 },
  legend: { display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: GRAYL },
  legendItem: { display: "inline-flex", alignItems: "center", gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 3, display: "inline-block" },
  themeRow: { display: "flex", alignItems: "center", gap: 12 },
  themeLabel: { width: 150, flexShrink: 0, fontSize: 13, color: GRAY, textAlign: "right" },
  themeBarWrap: { display: "flex", alignItems: "center", gap: 8, flex: 1 },
  themeBarTrack: { display: "flex", height: 16, borderRadius: 5, overflow: "hidden", minWidth: 2 },
  themeTotal: { fontSize: 13, color: GRAYL, fontWeight: 600, minWidth: 18 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { color: GRAYL, fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", padding: "6px 8px", borderBottom: `1px solid ${BORDER}` },
  td: { padding: "7px 8px", borderBottom: `1px solid ${BORDER}` },
  sentTag: { borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600 },
  filterRow: { display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" },
  select: { border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 12px", fontSize: 14, fontFamily: "inherit", color: NAVY, background: "#FFFFFF" },
  clearBtn: { background: "transparent", border: "none", color: GOLDL, fontSize: 13, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" },
  sha: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, color: GRAYL },
  muted: { color: GRAYL, fontSize: 14 },
  errorBanner: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "#FDECEA", border: `1px solid #C0432F55`, color: "#C0432F", borderRadius: 10, padding: "12px 16px", fontSize: 14 },
  retryBtn: { background: "#C0432F", border: "none", color: "#FFFFFF", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
}
