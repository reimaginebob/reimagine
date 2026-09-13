// Corrections dashboard — the Corrections tab of /admin/dashboard. Replaces
// reviewing the "Reimagine Corrections Log" Google Sheet (dead since
// 2026-08-20; see migrations/2026-09-11_corrections-table.sql). Surfaces
// recurring themes (wrong fact, hallucination, the system not accepting a
// correction, sounds too AI) and flags corrections that implicate Personal
// Brand, since almost every Focus Playbook section is built from it.
//
// source is 'refinebox' for every row today -- Coach-as-Concierge profile
// edits that are functionally corrections are a deliberate later phase (see
// Output/session-continuity/2026-09-13_corrections-vs-coach-concierge-scope-question.md).
// The banner below says so explicitly rather than letting this read as a
// complete picture.
//
// Self-contained inline styles in the app's cream/navy/amber palette,
// matching AdminDashboard.jsx and FeedbackDashboard.jsx. No new dependencies.
import { useState, useEffect, useCallback } from "react"

const NAVY = "#1A2540"
const GOLD = "#C8924A"
const GOLDL = "#A06828"
const BORDER = "#E2E5EA"
const CREAM = "#FBF8F2"
const GRAY = "#3D4A5C"
const GRAYL = "#6B7685"
const ERR = "#C0432F"

const THEME_LABELS = {
  wrong_fact: "Wrong fact",
  hallucination: "Hallucination",
  wont_accept_correction: "Won't accept correction",
  ai_voice: "Sounds like AI",
  other: "Other",
}
const STEP_LABELS = {
  p1: "Resume Analysis", p2: "Wiring & Compass", p3: "Personal Brand", p4: "Wide View",
  p5: "The Role", p6: "Bridge Story", p7: "Go-to-Market", p8: "LinkedIn Remix",
  p9: "Industry Background", p11: "Interview Prep", p_res: "Resume Refresh", income: "Income Now",
}
const stepLabel = (s) => STEP_LABELS[s] || s
const themeLabel = (t) => THEME_LABELS[t] || t

export default function CorrectionsDashboard({ refreshKey = 0 }) {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [stepFilter, setStepFilter] = useState("")
  const [themeFilter, setThemeFilter] = useState("")
  const [pbOnly, setPbOnly] = useState(false)
  const [classifyBusy, setClassifyBusy] = useState(false)
  const [classifyMsg, setClassifyMsg] = useState("")

  const fetchData = useCallback(async (step, theme, pb) => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ limit: "300" })
      if (step) params.set("step", step)
      if (theme) params.set("theme", theme)
      if (pb) params.set("pb", "1")
      const res = await fetch(`/api/admin/corrections?${params.toString()}`, { credentials: "include" })
      if (res.status === 200) {
        setPayload(await res.json())
      } else {
        setError(`Request failed (HTTP ${res.status}).`)
      }
    } catch {
      setError("Network error reaching the corrections endpoint.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(stepFilter, themeFilter, pbOnly) }, [stepFilter, themeFilter, pbOnly, refreshKey, fetchData])

  const classifyNext = async () => {
    setClassifyBusy(true); setClassifyMsg("")
    try {
      const res = await fetch("/api/admin/classify-corrections", { method: "POST", credentials: "include" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setClassifyMsg(data.error || `Failed (HTTP ${res.status})`); return }
      setClassifyMsg(data.classified > 0
        ? `Classified ${data.classified}. ${data.remaining} left.`
        : "Nothing left to classify.")
      fetchData(stepFilter, themeFilter, pbOnly)
    } catch {
      setClassifyMsg("Network error. Try again.")
    } finally {
      setClassifyBusy(false)
    }
  }

  if (loading && !payload) return <div style={S.muted}>Loading corrections…</div>
  if (error && !payload) return (
    <div style={S.errorBanner}><span>{error}</span><button onClick={() => fetchData(stepFilter, themeFilter, pbOnly)} style={S.retryBtn}>Retry</button></div>
  )
  if (!payload) return null

  const { total, totalPersonalBrandRelevant, pendingClassification, byStep, byTheme, corrections } = payload

  return (
    <div>
      <div style={S.banner}>
        Source shown per row. Only RefineBox corrections (the correction box under a generated section) are tracked here today — corrections made through My Coach conversation aren't captured yet. Treat these counts as a partial picture, not the whole one.
      </div>

      <div style={S.tileGrid}>
        <Stat label="Total corrections" value={total} />
        <Stat label="Personal Brand-relevant" value={totalPersonalBrandRelevant} accent />
        <Stat label="Awaiting theme" value={pendingClassification} />
      </div>

      <div style={S.classifyRow}>
        <button onClick={classifyNext} disabled={classifyBusy || pendingClassification === 0} style={S.classifyBtn}>
          {classifyBusy ? "Classifying…" : `Classify next batch${pendingClassification ? ` (${Math.min(25, pendingClassification)} of ${pendingClassification})` : ""}`}
        </button>
        {classifyMsg && <span style={S.classifyMsg}>{classifyMsg}</span>}
      </div>

      <Panel title="By theme">
        {byTheme.length === 0
          ? <div style={S.muted}>No corrections classified yet.</div>
          : <div style={S.themeBarWrap}>
              {byTheme.map((t) => (
                <button key={t.theme} onClick={() => setThemeFilter(themeFilter === t.theme ? "" : t.theme)}
                  style={themeFilter === t.theme ? S.themeChipActive : S.themeChip}>
                  {themeLabel(t.theme)} <strong>{t.n}</strong>
                </button>
              ))}
            </div>}
      </Panel>

      <Panel title="By section" wide>
        <table style={S.table}>
          <thead><tr><Th>Section</Th><Th right>Corrections</Th><Th right>Personal Brand-relevant</Th><Th>Last</Th></tr></thead>
          <tbody>
            {byStep.map((s) => (
              <tr key={s.step} onClick={() => setStepFilter(stepFilter === s.step ? "" : s.step)} style={{ cursor: "pointer", background: stepFilter === s.step ? CREAM : "transparent" }}>
                <Td>{stepLabel(s.step)}</Td>
                <Td right>{s.n}</Td>
                <Td right>{s.n_pb || "—"}</Td>
                <Td>{s.last_at ? new Date(s.last_at).toISOString().slice(0, 10) : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title={`Corrections (${corrections.length}${stepFilter || themeFilter || pbOnly ? " filtered" : ""})`} wide>
        <div style={S.filterRow}>
          {stepFilter && <FilterChip label={`Section: ${stepLabel(stepFilter)}`} onClear={() => setStepFilter("")} />}
          {themeFilter && <FilterChip label={`Theme: ${themeLabel(themeFilter)}`} onClear={() => setThemeFilter("")} />}
          <label style={S.pbToggle}>
            <input type="checkbox" checked={pbOnly} onChange={(e) => setPbOnly(e.target.checked)} />
            Personal Brand-relevant only
          </label>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead><tr><Th>When</Th><Th>Section</Th><Th>Theme</Th><Th>Correction</Th><Th>Flags</Th></tr></thead>
            <tbody>
              {corrections.map((c) => (
                <tr key={c.id}>
                  <Td muted>{c.created_at ? new Date(c.created_at).toISOString().slice(0, 10) : "—"}</Td>
                  <Td>{stepLabel(c.step)}</Td>
                  <Td>{c.theme ? themeLabel(c.theme) : <span style={S.muted}>—</span>}</Td>
                  <Td style={{ maxWidth: 420 }}>{c.correction_text}</Td>
                  <Td>
                    {c.personal_brand_confirmed && <span style={S.flagStrong} title="This correction's wording contradicts existing Personal Brand text">PB confirmed</span>}
                    {!c.personal_brand_confirmed && c.personal_brand_relevant && <span style={S.flag} title="This section is built from Personal Brand">PB relevant</span>}
                    {c.conflict_phrase && <span style={S.flag} title={`User chose "Apply anyway" on: ${c.conflict_phrase}`}>Voice conflict</span>}
                  </Td>
                </tr>
              ))}
              {corrections.length === 0 && <tr><Td colSpan={5} muted>No corrections match this filter.</Td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

function FilterChip({ label, onClear }) {
  return <span style={S.filterChip}>{label} <button onClick={onClear} style={S.filterChipX}>×</button></span>
}
function Panel({ title, children, wide }) {
  return (
    <section style={{ ...S.panel, ...(wide ? { gridColumn: "1 / -1" } : {}) }}>
      <h2 style={S.panelTitle}>{title}</h2>
      {children}
    </section>
  )
}
function Stat({ label, value, accent }) {
  return (
    <div style={S.tile}>
      <div style={{ ...S.tileValue, color: accent ? GOLDL : NAVY }}>{value === null || value === undefined ? "—" : value}</div>
      <div style={S.tileLabel}>{label}</div>
    </div>
  )
}
function Th({ children, right }) { return <th style={{ ...S.th, textAlign: right ? "right" : "left" }}>{children}</th> }
function Td({ children, right, muted, colSpan, style }) {
  return <td colSpan={colSpan} style={{ ...S.td, textAlign: right ? "right" : "left", color: muted ? GRAYL : GRAY, ...style }}>{children}</td>
}

const S = {
  muted: { color: GRAYL, fontSize: 15 },
  errorBanner: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "#FDECEA", border: `1px solid ${ERR}55`, color: ERR, borderRadius: 10, padding: "12px 16px", marginBottom: 18, fontSize: 15 },
  retryBtn: { background: ERR, border: "none", color: "#FFFFFF", borderRadius: 6, padding: "6px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  banner: { background: "#FBF3E7", border: `1px solid ${GOLD}55`, color: "#5C4322", borderRadius: 10, padding: "12px 16px", marginBottom: 18, fontSize: 15, lineHeight: 1.5 },
  tileGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 },
  tile: { background: CREAM, borderRadius: 10, padding: "12px 14px" },
  tileValue: { fontSize: 26, fontWeight: 700, lineHeight: 1.1, fontFamily: "Georgia, serif" },
  tileLabel: { fontSize: 15, color: GRAYL, marginTop: 4, lineHeight: 1.3 },
  classifyRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" },
  classifyBtn: { background: NAVY, border: `1px solid ${NAVY}`, color: "#FFFFFF", borderRadius: 8, padding: "10px 18px", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  classifyMsg: { fontSize: 15, color: GRAY },
  panel: { background: "#FFFFFF", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 2px rgba(26,37,64,0.04)", marginBottom: 16 },
  panelTitle: { fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 600, color: GOLDL, margin: "0 0 14px", borderBottom: `1px solid ${BORDER}`, paddingBottom: 8 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 15 },
  th: { color: GRAYL, fontWeight: 600, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.04em", padding: "6px 8px", borderBottom: `1px solid ${BORDER}` },
  td: { padding: "8px", borderBottom: `1px solid ${BORDER}`, verticalAlign: "top" },
  themeBarWrap: { display: "flex", flexWrap: "wrap", gap: 8 },
  themeChip: { background: CREAM, border: `1px solid ${BORDER}`, color: GRAY, borderRadius: 999, padding: "8px 16px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  themeChipActive: { background: GOLD, border: `1px solid ${GOLD}`, color: "#FFFFFF", borderRadius: 999, padding: "8px 16px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  filterRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" },
  filterChip: { background: CREAM, border: `1px solid ${BORDER}`, color: GRAY, borderRadius: 999, padding: "6px 10px 6px 14px", fontSize: 15, display: "inline-flex", alignItems: "center", gap: 6 },
  filterChipX: { background: "none", border: "none", color: GRAYL, fontSize: 16, cursor: "pointer", padding: "0 4px", fontFamily: "inherit" },
  pbToggle: { display: "flex", alignItems: "center", gap: 6, fontSize: 15, color: GRAY, cursor: "pointer" },
  flag: { display: "inline-block", background: CREAM, border: `1px solid ${BORDER}`, color: GRAY, borderRadius: 6, padding: "2px 8px", fontSize: 13, fontWeight: 600, marginRight: 6, marginBottom: 4 },
  flagStrong: { display: "inline-block", background: "#FBF3E7", border: `1px solid ${GOLD}`, color: GOLDL, borderRadius: 6, padding: "2px 8px", fontSize: 13, fontWeight: 700, marginRight: 6, marginBottom: 4 },
}
