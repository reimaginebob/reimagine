// Same-origin admin analytics dashboard, served at /admin/dashboard.
// Replaces the cross-origin Cowork artifact (which hit CORS/CSP walls).
//
// Auth: a valid ADMIN_TOKEN. On first load the token can arrive via ?t=<token>
// (then stripped from the URL) or from localStorage. The page itself ships no
// secret; the token is entered by the admin, kept in localStorage, and sent as
// an Authorization: Bearer header to /api/admin/analytics (same origin, so no
// CORS preflight). If no valid token is present, a token-entry form is shown.
//
// Style: self-contained inline styles in the app's cream / navy / amber
// palette, Georgia for the title. No new dependencies; no Tailwind (the app
// uses inline styles).
import { useState, useEffect, useCallback, Fragment } from "react"
import FeedbackDashboard from "./FeedbackDashboard"

const NAVY = "#1A2540"
const GOLD = "#C8924A"
const GOLDL = "#A06828"
const BORDER = "#E2E5EA"
const CREAM = "#FBF8F2"
const GRAY = "#3D4A5C"
const GRAYL = "#6B7685"
const OK = "#4A9E72"
const ERR = "#C0432F"

const TOKEN_KEY = "reimagine-admin-token"
const RANGE_KEY = "reimagine-admin-range"
const RANGES = ["24h", "7d", "30d", "all"]

const STEP_LABELS = {
  p5: "The Role", p6: "Bridge Story", p7: "Go-to-Market", p8: "LinkedIn Remix",
  p9: "Industry Background", p11: "Interview Prep", p_res: "Resume Refresh",
}
const stepLabel = (s) => STEP_LABELS[s] || s

function readInitialRange() {
  try { const r = localStorage.getItem(RANGE_KEY); if (RANGES.includes(r)) return r } catch {}
  return "7d"
}

// Capture ?t=<token> on first load: prefer it over any stored token, persist
// it, then strip it from the URL so it does not linger in history / the bar.
function readInitialToken() {
  let urlToken = null
  try {
    const params = new URLSearchParams(window.location.search)
    const t = params.get("t")
    if (t) {
      urlToken = t
      params.delete("t")
      const qs = params.toString()
      window.history.replaceState({}, "", window.location.pathname + (qs ? "?" + qs : "") + window.location.hash)
    }
  } catch {}
  if (urlToken) return urlToken
  try { return localStorage.getItem(TOKEN_KEY) || null } catch { return null }
}

export default function AdminDashboard() {
  const [token, setToken] = useState(() => readInitialToken())
  const [authed, setAuthed] = useState(false)
  const [payload, setPayload] = useState(null)
  const [range, setRange] = useState(() => readInitialRange())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)       // non-auth fetch error (500 / network)
  const [authError, setAuthError] = useState(null) // invalid-token message for the form
  const [liveAsOf, setLiveAsOf] = useState(null)
  const [tokenInput, setTokenInput] = useState("")
  const [expandedUser, setExpandedUser] = useState(null) // email of the expanded power-user row
  const [tab, setTab] = useState("analytics") // "analytics" | "feedback"

  // Single call doubles as the auth probe and the data fetch: a 200 means the
  // token is valid AND we have data; a 403 means the token is wrong.
  const fetchData = useCallback(async (tok, rng, { fromForm = false } = {}) => {
    if (!tok) { setAuthed(false); return }
    setLoading(true); setError(null); setAuthError(null)
    try {
      const res = await fetch(`/api/admin/analytics?range=${encodeURIComponent(rng)}`, {
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (res.status === 200) {
        const json = await res.json()
        setPayload(json)
        setAuthed(true)
        setToken(tok)
        try { localStorage.setItem(TOKEN_KEY, tok) } catch {}
        setLiveAsOf(new Date().toUTCString())
      } else if (res.status === 403) {
        setAuthed(false)
        setPayload(null)
        try { localStorage.removeItem(TOKEN_KEY) } catch {}
        if (fromForm) setAuthError("Invalid token. Try again.")
      } else {
        setError(`Request failed (HTTP ${res.status}).`)
      }
    } catch (e) {
      setError("Network error reaching the analytics endpoint.")
    } finally {
      setLoading(false)
    }
  }, [])

  // On mount, if a token is present, attempt the fetch. Intentionally runs
  // once; range/token changes are driven explicitly via pickRange/refresh.
  useEffect(() => { if (token) fetchData(token, range) }, [])

  const pickRange = (r) => {
    setRange(r)
    try { localStorage.setItem(RANGE_KEY, r) } catch {}
    if (token) fetchData(token, r)
  }
  const refresh = () => { if (token) fetchData(token, range) }
  const submitToken = (e) => {
    e.preventDefault()
    const t = tokenInput.trim()
    if (t) fetchData(t, range, { fromForm: true })
  }
  const signOut = () => {
    try { localStorage.removeItem(TOKEN_KEY) } catch {}
    setToken(null); setAuthed(false); setPayload(null); setTokenInput("")
  }

  // ---- Token-entry form (unauthenticated) ----
  if (!authed) {
    return (
      <div style={S.page}>
        <div style={S.authWrap}>
          <h1 style={S.authTitle}>Reimagine Daily</h1>
          <p style={S.authSub}>Admin analytics. Enter your access token to continue.</p>
          <form onSubmit={submitToken} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="ADMIN_TOKEN"
              autoFocus
              style={S.input}
            />
            <button type="submit" disabled={loading || !tokenInput.trim()} style={S.primaryBtn}>
              {loading ? "Checking…" : "Open dashboard"}
            </button>
          </form>
          {authError && <div style={S.authErr}>{authError}</div>}
          {error && <div style={S.authErr}>{error}</div>}
        </div>
      </div>
    )
  }

  // ---- Authenticated dashboard ----
  const p1 = (payload && payload.panel_1_top_line) || {}
  const drillIn = (payload && payload.panel_1b_playbook_drill_in) || []
  // Pivot the per-playbook drill-in rows into a per-user rollup, ranked by total
  // playbooks for the selected period (heaviest builders on top).
  const userRollup = (() => {
    const m = new Map()
    for (const d of drillIn) {
      const email = d.email || "(unknown)"
      let u = m.get(email)
      if (!u) { u = { email, total: 0, focus: 0, op: 0, sections: 0, last: "" }; m.set(email, u) }
      u.total += 1
      if (d.source === "door1") u.focus += 1
      else if (d.source === "door2") u.op += 1
      u.sections += d.sections_built || 0
      const ts = d.updated_at || d.created_at || ""
      if (ts > u.last) u.last = ts
    }
    return [...m.values()].sort((a, b) => b.total - a.total || b.sections - a.sections)
  })()
  const funnel = (payload && payload.panel_2_funnel) || []
  const nps = (payload && payload.panel_3_nps) || {}
  const quality = (payload && payload.panel_4_quality_signals) || {}
  const health = (payload && payload.panel_5_system_health) || {}
  const income = (payload && payload.panel_6_income_usage) || {}

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Header */}
        <div style={S.headerRow}>
          <div>
            <h1 style={S.title}>Reimagine Daily</h1>
            <div style={S.subhead}>
              {liveAsOf ? <>Live as of <strong style={{ color: NAVY }}>{liveAsOf}</strong></> : "Loading…"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {tab === "analytics" && <>
              {RANGES.map((r) => (
                <button key={r} onClick={() => pickRange(r)} style={r === range ? S.pillActive : S.pill}>{r}</button>
              ))}
              <button onClick={refresh} disabled={loading} style={S.refreshBtn}>{loading ? "…" : "Refresh"}</button>
            </>}
            <button onClick={signOut} style={S.signOutBtn}>Sign out</button>
          </div>
        </div>

        {/* Tab bar: Analytics (existing) | Feedback (feedback_event views) */}
        <div style={S.tabBar}>
          <button onClick={() => setTab("analytics")} style={tab === "analytics" ? S.tabActive : S.tab}>Analytics</button>
          <button onClick={() => setTab("feedback")} style={tab === "feedback" ? S.tabActive : S.tab}>Feedback</button>
        </div>

        {tab === "feedback" && <FeedbackDashboard token={token} />}

        {tab === "analytics" && <>
        {error && (
          <div style={S.errorBanner}>
            <span>{error}</span>
            <button onClick={refresh} style={S.retryBtn}>Retry</button>
          </div>
        )}

        {/* Panel grid */}
        <div style={S.panelGrid}>
          {/* Panel 1: top-line */}
          <Panel title="Top-line">
            <div style={S.tileGrid}>
              <Stat label="Total users" value={p1.total_users} />
              <Stat label="New users (range)" value={p1.users_in_range} />
              <Stat label="Focus playbooks built" value={p1.focus_playbooks_built} accent />
              <Stat label="Op playbooks built" value={p1.op_playbooks_built} accent />
              <Stat label="Focus-complete users" value={p1.focus_complete_users} sub="proxy" />
              <Stat label="Op-started users" value={p1.op_started_users} sub="proxy" />
              <Stat label="Sessions (range)" value={p1.sessions_in_range} />
              <Stat label="Active users (range)" value={p1.active_users_in_range} />
              <Stat label="Magic links issued" value={p1.magic_links_issued_in_range} />
              <Stat label="Magic links used" value={p1.magic_links_used_in_range} />
              <Stat label="Link conversion" value={fmtRate(p1.magic_link_conversion_rate)} />
            </div>
          </Panel>

          {/* Panel 2: funnel */}
          <Panel title="Funnel per step">
            <table style={S.table}>
              <thead><tr>
                <Th>Step</Th><Th right>Entered</Th><Th right>Generated</Th><Th right>Completed</Th><Th right>Drop-off</Th>
              </tr></thead>
              <tbody>
                {funnel.map((f) => (
                  <tr key={f.step}>
                    <Td>{stepLabel(f.step)}</Td>
                    <Td right>{f.entered}</Td>
                    <Td right>{f.generated}</Td>
                    <Td right>{f.completed}</Td>
                    <Td right>{fmtRate(f.drop_off_rate)}</Td>
                  </tr>
                ))}
                {funnel.length === 0 && <tr><Td colSpan={5} muted>No funnel events in range.</Td></tr>}
              </tbody>
            </table>
          </Panel>

          {/* Panel 3: NPS */}
          <Panel title="NPS">
            <div style={S.tileGrid}>
              <Stat label="Score" value={nps.summary ? fmtNum(nps.summary.score) : "—"} accent />
              <Stat label="Promoters" value={nps.summary ? nps.summary.promoters : 0} />
              <Stat label="Passives" value={nps.summary ? nps.summary.passives : 0} />
              <Stat label="Detractors" value={nps.summary ? nps.summary.detractors : 0} />
              <Stat label="Responses" value={nps.summary ? nps.summary.total : 0} />
            </div>
            <div style={S.subSectionLabel}>Open text</div>
            <div style={S.feed}>
              {(nps.open_text || []).length === 0 && <div style={S.muted}>No open-text responses in range.</div>}
              {(nps.open_text || []).map((o, i) => (
                <div key={i} style={S.feedItem}>
                  <div style={{ color: GRAY, lineHeight: 1.5 }}>{o.text || o.comment || JSON.stringify(o)}</div>
                  {(o.score != null || o.role) && (
                    <div style={S.feedMeta}>{o.score != null ? `score ${o.score}` : ""}{o.role ? ` · ${o.role}` : ""}</div>
                  )}
                </div>
              ))}
            </div>
          </Panel>

          {/* Panel 4: quality signals */}
          <Panel title="Quality signals">
            <div style={S.subSectionLabel}>Inferred regenerations per step</div>
            <table style={S.table}>
              <thead><tr><Th>Step</Th><Th right>Started</Th><Th right>Completed</Th><Th right>Regens</Th></tr></thead>
              <tbody>
                {(quality.inferred_regenerations || []).map((r) => (
                  <tr key={r.step}>
                    <Td>{stepLabel(r.step)}</Td><Td right>{r.started}</Td><Td right>{r.completed}</Td>
                    <Td right><strong style={{ color: r.inferred_regenerations > 0 ? GOLDL : GRAY }}>{r.inferred_regenerations}</strong></Td>
                  </tr>
                ))}
                {(quality.inferred_regenerations || []).length === 0 && <tr><Td colSpan={4} muted>No data in range.</Td></tr>}
              </tbody>
            </table>
            <div style={S.subSectionLabel}>Bridge Story picks</div>
            <table style={S.table}>
              <thead><tr><Th>Block</Th><Th>Option</Th><Th right>Picks</Th></tr></thead>
              <tbody>
                {(quality.bridge_picks || []).map((b, i) => (
                  <tr key={i}><Td>{b.block}</Td><Td>{b.option_index}</Td><Td right>{b.picks}</Td></tr>
                ))}
                {(quality.bridge_picks || []).length === 0 && <tr><Td colSpan={3} muted>No picks in range.</Td></tr>}
              </tbody>
            </table>
          </Panel>

          {/* Panel 5: system health */}
          <Panel title="System health">
            <div style={S.tileGrid}>
              <Stat label="Database" value={health.db_ok ? "OK" : "DOWN"} accent={health.db_ok} danger={!health.db_ok} />
              <Stat label="Survey responses (range)" value={health.survey_responses_in_range} />
            </div>
            <div style={{ ...S.muted, marginTop: 10 }}>
              Last survey response: {health.last_survey_response_at ? new Date(health.last_survey_response_at).toUTCString() : "—"}
            </div>
          </Panel>

          {/* Panel 6: income now */}
          <Panel title="Income Now usage">
            <div style={S.tileGrid}>
              <Stat label="Output present" value={income.users_with_income_output} />
              <Stat label="Marked done" value={income.users_with_income_done} />
            </div>
          </Panel>

          {/* Panel 1b: playbooks pivoted by user, ranked by total built this period. */}
          <Panel title={`Power users — by playbooks (${userRollup.length} users, ${drillIn.length} playbooks)`} wide>
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead><tr>
                  <Th right>#</Th><Th>User</Th><Th right>Playbooks</Th><Th right>Focus</Th><Th right>Op</Th><Th right>Sections</Th><Th>Last active</Th>
                </tr></thead>
                <tbody>
                  {userRollup.map((u, i) => {
                    const open = expandedUser === u.email
                    const rows = drillIn.filter((d) => (d.email || "(unknown)") === u.email)
                    return (
                      <Fragment key={u.email}>
                        <tr onClick={() => setExpandedUser(open ? null : u.email)} style={{ cursor: "pointer", background: open ? CREAM : "transparent" }}>
                          <Td right muted>{i + 1}</Td>
                          <Td>{(open ? "▾ " : "▸ ") + u.email}</Td>
                          <Td right><strong style={{ color: NAVY }}>{u.total}</strong></Td>
                          <Td right>{u.focus || "—"}</Td>
                          <Td right>{u.op || "—"}</Td>
                          <Td right>{u.sections}</Td>
                          <Td>{u.last ? new Date(u.last).toISOString().slice(0, 10) : "—"}</Td>
                        </tr>
                        {open && (
                          <tr>
                            <Td colSpan={7}>
                              <table style={{ ...S.table, margin: "4px 0 8px", background: CREAM }}>
                                <thead><tr>
                                  <Th>Title</Th><Th>Lane</Th><Th>Source</Th><Th right>v</Th><Th right>Sections</Th><Th>Created</Th>
                                </tr></thead>
                                <tbody>
                                  {rows.map((d, j) => (
                                    <tr key={j}>
                                      <Td>{d.title || "—"}</Td>
                                      <Td>{d.lane || "—"}</Td>
                                      <Td>{d.source}</Td>
                                      <Td right>{d.schema_version}</Td>
                                      <Td right>{d.sections_built}</Td>
                                      <Td>{d.created_at ? new Date(d.created_at).toISOString().slice(0, 10) : "—"}</Td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </Td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                  {userRollup.length === 0 && <tr><Td colSpan={7} muted>No playbooks saved server-side in range yet.</Td></tr>}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
        </>}
      </div>
    </div>
  )
}

// ---- formatting helpers ----
function fmtNum(n) { return (n === null || n === undefined) ? "—" : n }
function fmtRate(r) { return (r === null || r === undefined) ? "—" : `${Math.round(r * 100)}%` }

// ---- presentational sub-components ----
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
function Th({ children, right }) {
  return <th style={{ ...S.th, textAlign: right ? "right" : "left" }}>{children}</th>
}
function Td({ children, right, muted, colSpan }) {
  return <td colSpan={colSpan} style={{ ...S.td, textAlign: right ? "right" : "left", color: muted ? GRAYL : GRAY }}>{children}</td>
}

const S = {
  page: { minHeight: "100vh", background: CREAM, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", color: GRAY, padding: "clamp(16px, 4vw, 40px)", boxSizing: "border-box" },
  container: { maxWidth: 1180, margin: "0 auto" },
  headerRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 },
  title: { fontFamily: "Georgia, serif", fontSize: "clamp(28px, 5vw, 38px)", fontWeight: 700, color: NAVY, margin: 0, lineHeight: 1.15 },
  subhead: { fontSize: 14, color: GRAYL, marginTop: 6 },
  tabBar: { display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${BORDER}` },
  tab: { background: "transparent", border: "none", borderBottom: "2px solid transparent", color: GRAYL, padding: "8px 16px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: -1 },
  tabActive: { background: "transparent", border: "none", borderBottom: `2px solid ${GOLD}`, color: NAVY, padding: "8px 16px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: -1 },
  pill: { background: "#FFFFFF", border: `1px solid ${BORDER}`, color: GRAY, borderRadius: 999, padding: "7px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  pillActive: { background: GOLD, border: `1px solid ${GOLD}`, color: "#FFFFFF", borderRadius: 999, padding: "7px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  refreshBtn: { background: NAVY, border: `1px solid ${NAVY}`, color: "#FFFFFF", borderRadius: 8, padding: "7px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  signOutBtn: { background: "transparent", border: "none", color: GRAYL, fontSize: 13, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" },
  errorBanner: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "#FDECEA", border: `1px solid ${ERR}55`, color: ERR, borderRadius: 10, padding: "12px 16px", marginBottom: 18, fontSize: 14 },
  retryBtn: { background: ERR, border: "none", color: "#FFFFFF", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  panelGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 },
  panel: { background: "#FFFFFF", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 2px rgba(26,37,64,0.04)" },
  panelTitle: { fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 600, color: GOLDL, margin: "0 0 14px", borderBottom: `1px solid ${BORDER}`, paddingBottom: 8 },
  tileGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 },
  tile: { background: CREAM, borderRadius: 10, padding: "12px 14px" },
  tileValue: { fontSize: 26, fontWeight: 700, lineHeight: 1.1, fontFamily: "Georgia, serif" },
  tileLabel: { fontSize: 12, color: GRAYL, marginTop: 4, lineHeight: 1.3 },
  tileSub: { color: GOLDL, fontStyle: "italic" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { color: GRAYL, fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", padding: "6px 8px", borderBottom: `1px solid ${BORDER}` },
  td: { padding: "7px 8px", borderBottom: `1px solid ${BORDER}` },
  subSectionLabel: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: GRAYL, margin: "16px 0 6px" },
  feed: { display: "flex", flexDirection: "column", gap: 10, maxHeight: 280, overflowY: "auto" },
  feedItem: { background: CREAM, borderRadius: 8, padding: "10px 12px", fontSize: 14 },
  feedMeta: { fontSize: 12, color: GRAYL, marginTop: 4 },
  muted: { color: GRAYL, fontSize: 14 },
  // auth form
  authWrap: { maxWidth: 380, margin: "12vh auto 0", background: "#FFFFFF", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 28 },
  authTitle: { fontFamily: "Georgia, serif", fontSize: 30, fontWeight: 700, color: NAVY, margin: "0 0 6px" },
  authSub: { fontSize: 14, color: GRAYL, margin: "0 0 20px", lineHeight: 1.5 },
  input: { width: "100%", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px", fontSize: 16, fontFamily: "inherit", color: NAVY, outline: "none", boxSizing: "border-box" },
  primaryBtn: { background: GOLD, border: `1px solid ${GOLD}`, color: "#FFFFFF", borderRadius: 8, padding: "12px 16px", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  authErr: { marginTop: 14, color: ERR, fontSize: 14 },
}
