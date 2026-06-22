// Same-origin admin dashboard for My Coach question insights, served at
// /admin/coach-insights. Sibling to AdminDashboard.jsx; same auth model.
//
// Auth: an ADMIN_TOKEN (the same one AdminDashboard uses). On first load the
// token can arrive via ?t=<token> (then stripped from the URL) or from
// localStorage; it is sent as Authorization: Bearer to /api/admin/coach-insights
// and never left in the URL. If no valid token is present, a token form is shown.
//
// Reads /api/admin/coach-insights (aggregates over non-PII; the only raw text is
// the unmet-need question list). Self-contained inline styles in the app's
// cream / navy / amber palette; no new dependencies.
import { useState, useEffect, useCallback } from "react"

const NAVY = "#1A2540"
const GOLD = "#C8924A"
const GOLDL = "#A06828"
const BORDER = "#E2E5EA"
const CREAM = "#FBF8F2"
const GRAY = "#3D4A5C"
const GRAYL = "#6B7685"
const ERRC = "#C0432F"
const BARBG = "#EFEAdf"

const TOKEN_KEY = "reimagine-admin-token"
const WINDOWS = [7, 14, 30]
// Attribute keys shown as filterable distributions (topic/register/stage are the
// brief's required three; the rest follow). The server validates filters against
// the live taxonomy, so this list only controls render order.
const MIX_KEYS = ["topic", "register", "stage", "intent", "need_type", "tone", "specificity", "framework"]
const MIX_LABEL = {
  topic: "Topic", register: "Register", stage: "Search stage", intent: "Intent",
  need_type: "Need type", tone: "Tone", specificity: "Specificity", framework: "Framework",
}

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

function fmtDate(s) {
  if (!s) return ""
  try { return new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) } catch { return String(s) }
}

export default function CoachInsights() {
  const [token, setToken] = useState(() => readInitialToken())
  const [authed, setAuthed] = useState(false)
  const [payload, setPayload] = useState(null)
  const [days, setDays] = useState(14)
  const [filter, setFilter] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [authError, setAuthError] = useState(null)
  const [tokenInput, setTokenInput] = useState("")

  const fetchData = useCallback(async (tok, d, flt, { fromForm = false } = {}) => {
    if (!tok) { setAuthed(false); return }
    setLoading(true); setError(null); setAuthError(null)
    const qs = new URLSearchParams({ days: String(d) })
    for (const [k, v] of Object.entries(flt || {})) qs.set(k, v)
    try {
      const res = await fetch(`/api/admin/coach-insights?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (res.status === 200) {
        setPayload(await res.json())
        setAuthed(true)
        setToken(tok)
        try { localStorage.setItem(TOKEN_KEY, tok) } catch {}
      } else if (res.status === 403) {
        setAuthed(false); setPayload(null)
        try { localStorage.removeItem(TOKEN_KEY) } catch {}
        if (fromForm) setAuthError("Invalid token. Try again.")
      } else {
        setError(`Request failed (HTTP ${res.status}).`)
      }
    } catch (e) {
      setError("Network error reaching the insights endpoint.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (token) fetchData(token, days, filter) }, [])

  const pickDays = (d) => { setDays(d); if (token) fetchData(token, d, filter) }
  const refresh = () => { if (token) fetchData(token, days, filter) }
  const toggleFilter = (k, v) => {
    const next = { ...filter }
    if (next[k] === v) delete next[k]; else next[k] = v
    setFilter(next)
    if (token) fetchData(token, days, next)
  }
  const clearFilters = () => { setFilter({}); if (token) fetchData(token, days, {}) }
  const submitToken = (e) => { e.preventDefault(); const t = tokenInput.trim(); if (t) fetchData(t, days, filter, { fromForm: true }) }
  const signOut = () => { try { localStorage.removeItem(TOKEN_KEY) } catch {}; setToken(null); setAuthed(false); setPayload(null); setTokenInput("") }

  // ---- Token-entry form ----
  if (!authed) {
    return (
      <div style={S.page}>
        <div style={S.authWrap}>
          <h1 style={S.authTitle}>My Coach insights</h1>
          <p style={S.authSub}>Admin only. Enter your access token to continue.</p>
          <form onSubmit={submitToken} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="ADMIN_TOKEN" autoFocus style={S.input} />
            <button type="submit" disabled={loading || !tokenInput.trim()} style={S.primaryBtn}>{loading ? "Checking…" : "Open insights"}</button>
          </form>
          {authError && <div style={S.authErr}>{authError}</div>}
          {error && <div style={S.authErr}>{error}</div>}
        </div>
      </div>
    )
  }

  const p = payload || {}
  const totals = p.totals || { messages: 0, tagged: 0 }
  const vb = p.verdictBreakdown || { matched: 0, none: 0, null: 0, nonePct: 0 }
  const distribution = p.distribution || {}
  const features = p.featureBreakdown || []
  const unmet = p.unmetQuestions || []
  const aq = p.answerQuality || { up: 0, down: 0, helpfulPct: 0, downByTopic: {}, downByRegister: {} }
  const rated = p.ratedExchanges || null
  const contentReview = !!p.contentReview
  const activeFilters = Object.entries(filter)

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.headerRow}>
          <div>
            <h1 style={S.title}>My Coach — question insights</h1>
            <div style={S.subhead}>
              {p.generatedAt ? <>As of <strong style={{ color: NAVY }}>{fmtDate(p.generatedAt)}</strong></> : "Loading…"}
              {p.taxonomyVersion != null && <span style={{ color: GRAYL }}> · taxonomy v{p.taxonomyVersion}</span>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {WINDOWS.map((d) => (
              <button key={d} onClick={() => pickDays(d)} style={d === days ? S.pillActive : S.pill}>{d}d</button>
            ))}
            <button onClick={refresh} disabled={loading} style={S.refreshBtn}>{loading ? "…" : "Refresh"}</button>
            <button onClick={signOut} style={S.signOutBtn}>Sign out</button>
          </div>
        </div>

        {error && <div style={S.errorBanner}><span>{error}</span><button onClick={refresh} style={S.retryBtn}>Retry</button></div>}

        {activeFilters.length > 0 && (
          <div style={S.filterRow}>
            <span style={{ color: GRAYL, fontSize: 13 }}>Filtered:</span>
            {activeFilters.map(([k, v]) => (
              <button key={k} onClick={() => toggleFilter(k, v)} style={S.filterChip} title="Click to remove">{MIX_LABEL[k] || k}: {v} ✕</button>
            ))}
            <button onClick={clearFilters} style={S.clearBtn}>Clear all</button>
          </div>
        )}

        {/* Headline: volume + the empty-handed rate (the unmet-need signal) */}
        <div style={S.headlineGrid}>
          <Stat label="Questions in window" value={totals.messages} />
          <Stat label="Tagged" value={totals.tagged} sub={`v${p.taxonomyVersion ?? "?"}`} />
          <Stat label="Coach found a feature" value={vb.matched} accent />
          <Stat label="Came up empty (none)" value={vb.none} sub={`${vb.nonePct}% of answered`} big danger />
          <Stat label="No self-check logged" value={vb.null} sub="pre-migration / legacy" />
        </div>

        {/* Unmet-need questions, front and center. Raw text rides the review gate. */}
        <Panel title={`Unmet-need questions (${unmet.length})`} subtitle={contentReview ? "Coach self-check returned “none” — newest first." : "Coach self-check returned “none” — counts/tags shown; question text behind the review gate."}>
          {unmet.length === 0 ? <div style={S.empty}>No unmet-need questions in this window.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {unmet.map((u, i) => {
                const a = u.attributes || {}
                const chips = ["topic", "need_type", "tone", "stage"].map(k => a[k]).filter(Boolean)
                return (
                  <div key={i} style={S.unmetItem}>
                    <div style={S.unmetMeta}>
                      <span>{fmtDate(u.created_at)}</span>
                      {u.current_step && <span style={S.stepTag}>{u.current_step}</span>}
                      {chips.map((c, j) => <span key={j} style={S.tagChip}>{c}</span>)}
                    </div>
                    <div style={S.unmetText}>{contentReview ? u.message : <span style={{ color: GRAYL, fontStyle: "italic" }}>content review off — pending policy</span>}</div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>

        {/* Attribute mixes */}
        <div style={S.mixGrid}>
          {MIX_KEYS.map((k) => (
            <Panel key={k} title={MIX_LABEL[k] || k} subtitle="Click a value to filter">
              <DistBars dist={distribution[k] || {}} activeVal={filter[k]} onPick={(v) => toggleFilter(k, v)} />
            </Panel>
          ))}
        </div>

        {/* Feature breakdown */}
        <Panel title="Features surfaced (matched turns)">
          {features.length === 0 ? <div style={S.empty}>No matched turns in this window.</div> : (
            <DistBars dist={Object.fromEntries(features.map(f => [f.feature, f.n]))} />
          )}
        </Panel>

        {/* Answer quality — numeric tier always on; raw exchanges behind the gate */}
        <Panel title="Answer quality" subtitle="Per-reply thumbs from users">
          {(aq.up + aq.down) === 0 ? <div style={S.empty}>No ratings in this window yet.</div> : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 14 }}>
                <Stat label="Helpful" value={aq.up} accent />
                <Stat label="Not helpful" value={aq.down} danger />
                <Stat label="% helpful" value={`${aq.helpfulPct}%`} big />
              </div>
              <div style={S.mixGrid}>
                <Panel title="Thumbs-down by topic" subtitle="Click a value to filter">
                  <DistBars dist={aq.downByTopic} activeVal={filter.topic} onPick={(v) => toggleFilter("topic", v)} />
                </Panel>
                <Panel title="Thumbs-down by register" subtitle="Click a value to filter">
                  <DistBars dist={aq.downByRegister} activeVal={filter.register} onPick={(v) => toggleFilter("register", v)} />
                </Panel>
              </div>
            </>
          )}
          {contentReview && rated ? (
            <div style={{ marginTop: 16 }}>
              <div style={S.panelSub}>Rated exchanges (de-identified) — newest first</div>
              {rated.length === 0 ? <div style={S.empty}>No rated exchanges.</div> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
                  {rated.map((r, i) => {
                    const a = r.attributes || {}
                    const chips = ["topic", "register", "need_type"].map(k => a[k]).filter(Boolean)
                    return (
                      <div key={i} style={{ ...S.unmetItem, borderLeft: `3px solid ${r.rating === -1 ? ERRC : "#4A9E72"}` }}>
                        <div style={S.unmetMeta}>
                          <span style={{ color: r.rating === -1 ? ERRC : "#2F7D54", fontWeight: 500 }}>{r.rating === -1 ? "Not helpful" : "Helpful"}</span>
                          <span>{fmtDate(r.rated_at)}</span>
                          {chips.map((c, j) => <span key={j} style={S.tagChip}>{c}</span>)}
                        </div>
                        {r.comment && <div style={{ ...S.unmetText, fontStyle: "italic" }}>“{r.comment}”</div>}
                        <div style={{ fontSize: 13, color: GRAYL, marginTop: 4 }}>Q: {r.message}</div>
                        <div style={{ fontSize: 13, color: GRAY, marginTop: 2 }}>A: {r.reply}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 16 }}><div style={S.empty}>Content review off — pending policy. Numeric counts above are live; question / reply / comment text stays hidden until COACH_CONTENT_REVIEW is enabled.</div></div>
          )}
        </Panel>
      </div>
    </div>
  )
}

function DistBars({ dist, activeVal, onPick }) {
  const entries = Object.entries(dist).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return <div style={S.empty}>No data.</div>
  const max = Math.max(...entries.map(e => e[1]), 1)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {entries.map(([val, n]) => {
        const pct = Math.round((n / max) * 100)
        const active = activeVal === val
        const clickable = !!onPick && val !== "(null)"
        return (
          <div key={val} onClick={clickable ? () => onPick(val) : undefined}
            style={{ ...S.barRow, cursor: clickable ? "pointer" : "default", background: active ? "#F3ECDD" : "transparent" }}>
            <div style={S.barLabel}>{val}</div>
            <div style={S.barTrack}><div style={{ ...S.barFill, width: `${pct}%`, background: active ? GOLDL : GOLD }} /></div>
            <div style={S.barN}>{n}</div>
          </div>
        )
      })}
    </div>
  )
}

function Panel({ title, subtitle, children }) {
  return (
    <div style={S.panel}>
      <div style={S.panelHead}>
        <div style={S.panelTitle}>{title}</div>
        {subtitle && <div style={S.panelSub}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value, sub, accent, big, danger }) {
  return (
    <div style={S.stat}>
      <div style={{ ...S.statVal, color: danger ? ERRC : accent ? GOLDL : NAVY, fontSize: big ? 34 : 26 }}>{value ?? "—"}</div>
      <div style={S.statLabel}>{label}</div>
      {sub && <div style={S.statSub}>{sub}</div>}
    </div>
  )
}

const S = {
  page: { minHeight: "100vh", background: CREAM, fontFamily: "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif", color: NAVY, padding: "0 0 64px" },
  container: { maxWidth: 1080, margin: "0 auto", padding: "28px 20px" },
  authWrap: { maxWidth: 380, margin: "12vh auto", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 28 },
  authTitle: { fontFamily: "Georgia,serif", fontSize: 24, margin: "0 0 6px", color: NAVY },
  authSub: { color: GRAYL, fontSize: 14, margin: "0 0 18px" },
  input: { padding: "11px 12px", borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 15, fontFamily: "inherit" },
  primaryBtn: { padding: "11px 14px", borderRadius: 9, border: "none", background: NAVY, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  authErr: { marginTop: 12, color: ERRC, fontSize: 14 },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 18 },
  title: { fontFamily: "Georgia,serif", fontSize: 26, margin: "0 0 4px", color: NAVY },
  subhead: { color: GRAYL, fontSize: 13 },
  pill: { padding: "6px 12px", borderRadius: 999, border: `1px solid ${BORDER}`, background: "#fff", color: GRAY, fontSize: 13, cursor: "pointer" },
  pillActive: { padding: "6px 12px", borderRadius: 999, border: `1px solid ${NAVY}`, background: NAVY, color: "#fff", fontSize: 13, cursor: "pointer" },
  refreshBtn: { padding: "6px 12px", borderRadius: 9, border: `1px solid ${BORDER}`, background: "#fff", color: GRAY, fontSize: 13, cursor: "pointer" },
  signOutBtn: { padding: "6px 12px", borderRadius: 9, border: "none", background: "transparent", color: GRAYL, fontSize: 13, cursor: "pointer", textDecoration: "underline" },
  errorBanner: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "#FBEBE8", border: `1px solid ${ERRC}`, borderRadius: 9, padding: "10px 14px", color: ERRC, marginBottom: 16 },
  retryBtn: { padding: "4px 10px", borderRadius: 7, border: `1px solid ${ERRC}`, background: "#fff", color: ERRC, fontSize: 13, cursor: "pointer" },
  filterRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 },
  filterChip: { padding: "4px 10px", borderRadius: 999, border: `1px solid ${GOLDL}`, background: "#F3ECDD", color: GOLDL, fontSize: 13, cursor: "pointer" },
  clearBtn: { padding: "4px 8px", border: "none", background: "transparent", color: GRAYL, fontSize: 13, cursor: "pointer", textDecoration: "underline" },
  headlineGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 18 },
  stat: { background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 14px" },
  statVal: { fontWeight: 700, lineHeight: 1.1 },
  statLabel: { color: GRAY, fontSize: 13, marginTop: 6 },
  statSub: { color: GRAYL, fontSize: 12, marginTop: 2 },
  panel: { background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 16px", marginBottom: 16 },
  panelHead: { marginBottom: 12 },
  panelTitle: { fontFamily: "Georgia,serif", fontSize: 17, color: NAVY },
  panelSub: { color: GRAYL, fontSize: 12, marginTop: 2 },
  mixGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16 },
  barRow: { display: "flex", alignItems: "center", gap: 10, borderRadius: 6, padding: "3px 4px" },
  barLabel: { width: 170, fontSize: 13, color: GRAY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  barTrack: { flex: 1, height: 14, background: BARBG, borderRadius: 7, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 7 },
  barN: { width: 40, textAlign: "right", fontSize: 13, color: NAVY, fontWeight: 600 },
  unmetItem: { borderLeft: `3px solid ${GOLD}`, padding: "8px 0 8px 12px" },
  unmetMeta: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, color: GRAYL, marginBottom: 4 },
  stepTag: { background: NAVY, color: "#fff", borderRadius: 999, padding: "1px 8px", fontSize: 11 },
  tagChip: { background: "#F3ECDD", color: GOLDL, borderRadius: 999, padding: "1px 8px", fontSize: 11 },
  unmetText: { fontSize: 15, color: NAVY, lineHeight: 1.5 },
  empty: { color: GRAYL, fontSize: 14, padding: "8px 0" },
}
