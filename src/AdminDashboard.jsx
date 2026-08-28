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
import EconomicsDashboard from "./EconomicsDashboard"
import GrowthDashboard from "./GrowthDashboard"

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
// Employment status (panel_1c). Display labels + a stable row order; the API
// returns 'unanswered' for users who have not provided it yet.
const EMPLOYMENT_LABELS = { employed: "Currently Employed", in_transition: "In Transition", role_ending: "Role Ending Soon", unanswered: "Not yet answered" }
const EMPLOYMENT_ORDER = ["employed", "in_transition", "role_ending", "unanswered"]

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
  // Account pause/unpause control (rogue-activity safeguard).
  const [suspendEmail, setSuspendEmail] = useState("")
  const [suspendBusy, setSuspendBusy] = useState(false)
  const [suspendMsg, setSuspendMsg] = useState("")
  const [rowBusy, setRowBusy] = useState("") // email of the row currently unpausing
  const doSuspend = async (action) => {
    const email = suspendEmail.trim()
    if (!email) { setSuspendMsg("Enter an email address first."); return }
    setSuspendBusy(true); setSuspendMsg("")
    try {
      const res = await fetch("/api/admin/suspend-user", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setSuspendMsg(data.error || `Failed (HTTP ${res.status})`); return }
      setSuspendMsg(data.suspended ? `Paused ${data.email}.` : `Unpaused ${data.email} — they're active again.`)
    } catch { setSuspendMsg("Network error. Try again.") }
    finally { setSuspendBusy(false) }
  }
  // My Pipeline (my_search) beta access control. Test users are already
  // registered, so this is a direct grant/revoke by email.
  const [pipelineEmail, setPipelineEmail] = useState("")
  const [pipelineBusy, setPipelineBusy] = useState(false)
  const [pipelineMsg, setPipelineMsg] = useState("")
  const [testers, setTesters] = useState([])
  const fetchTesters = useCallback(async (tok) => {
    try {
      const res = await fetch("/api/admin/pipeline-access", { headers: { Authorization: `Bearer ${tok}` } })
      if (res.ok) { const d = await res.json(); setTesters(Array.isArray(d.testers) ? d.testers : []) }
    } catch { /* leave the list as-is */ }
  }, [])
  const doPipeline = async (action) => {
    const email = pipelineEmail.trim()
    if (!email) { setPipelineMsg("Enter an email address first."); return }
    setPipelineBusy(true); setPipelineMsg("")
    try {
      const res = await fetch("/api/admin/pipeline-access", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setPipelineMsg(data.error || `Failed (HTTP ${res.status})`); return }
      setPipelineMsg(data.enabled ? `Granted My Pipeline to ${data.email}.` : `Revoked My Pipeline from ${data.email}.`)
      setPipelineEmail("")
      fetchTesters(token)
    } catch { setPipelineMsg("Network error. Try again.") }
    finally { setPipelineBusy(false) }
  }
  // Product track. The track normally arrives with the account (the entry URL
  // rides the magic-link token), so this is only for moving someone who signed
  // up through the wrong door.
  const [trackEmail, setTrackEmail] = useState("")
  const [trackBusy, setTrackBusy] = useState(false)
  const [trackMsg, setTrackMsg] = useState("")
  const [trackMembers, setTrackMembers] = useState([])
  const fetchTrackMembers = useCallback(async (tok) => {
    try {
      const res = await fetch("/api/admin/track-access", { headers: { Authorization: `Bearer ${tok}` } })
      if (res.ok) { const d = await res.json(); setTrackMembers(Array.isArray(d.members) ? d.members : []) }
    } catch { /* leave the list as-is */ }
  }, [])
  const doTrack = async (track) => {
    const email = trackEmail.trim()
    if (!email) { setTrackMsg("Enter an email address first."); return }
    setTrackBusy(true); setTrackMsg("")
    try {
      const res = await fetch("/api/admin/track-access", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, track }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setTrackMsg(data.error || `Failed (HTTP ${res.status})`); return }
      setTrackMsg(data.track
        ? `${data.email} is now on Go Independent. They'll see it on their next page load.`
        : `${data.email} is back on the standard product.`)
      setTrackEmail("")
      fetchTrackMembers(token)
    } catch { setTrackMsg("Network error. Try again.") }
    finally { setTrackBusy(false) }
  }
  const [tab, setTab] = useState("analytics") // "analytics" | "feedback" | "growth" | "economics"
  // Bumped by the header Refresh button so child tabs that own their own fetch
  // can react to it.
  const [refreshKey, setRefreshKey] = useState(0)

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
  useEffect(() => { if (authed && token) fetchTesters(token) }, [authed, token, fetchTesters])
  useEffect(() => { if (authed && token) fetchTrackMembers(token) }, [authed, token, fetchTrackMembers])

  const pickRange = (r) => {
    setRange(r)
    try { localStorage.setItem(RANGE_KEY, r) } catch {}
    if (token) fetchData(token, r)
  }
  // Refresh drives both tabs: the analytics fetch lives here, and the bumped
  // key is what the Feedback tab's effect watches (it owns its own fetch).
  const refresh = () => {
    if (token) fetchData(token, range)
    setRefreshKey((k) => k + 1)
  }
  // Per-row Unpause on the Paused-accounts panel: lift the hold, then refresh so
  // the row drops off the list.
  const unpauseRow = async (email) => {
    setRowBusy(email)
    try {
      const res = await fetch("/api/admin/suspend-user", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, action: "unpause" }),
      })
      if (res.ok) refresh()
    } catch { /* leave the row; the operator can retry */ }
    finally { setRowBusy("") }
  }
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
  const employment = ((payload && payload.panel_1c_employment) || []).slice().sort((a, b) => EMPLOYMENT_ORDER.indexOf(a.status) - EMPLOYMENT_ORDER.indexOf(b.status))
  const searchIntake = (payload && payload.panel_1e_search_intake) || []
  const paused = (payload && payload.panel_1d_paused_accounts) || []
  // Currently-held subset. The panel now carries released accounts too, so the
  // count in its title has to distinguish "act on this" from "this happened".
  const onHold = paused.filter((p) => p.on_hold)
  const funnel = (payload && payload.panel_2_funnel) || []
  const nps = (payload && payload.panel_3_nps) || {}
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
            {/* The three admin screens are separate URLs with no navigation
                between them, so each one had to be typed. These are the other
                two. Plain anchors on purpose: each screen is its own entry into
                the SPA and holds its own gate. */}
            <div style={S.adminNav}>
              <a href="/admin/desk" style={S.adminNavLink}>Reimagine Backdoor</a>
              <span style={S.adminNavSep}>·</span>
              <a href="/admin/coach-insights" style={S.adminNavLink}>Coach insights</a>
            </div>
          </div>
          {/* The range pills drive Analytics and Feedback from one control, so a
              range picked on one tab still applies after switching. Economics is
              left out on purpose: its windows are structural (month to date, the
              trailing 30 days, six months of P&L), not a filter. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {(tab === "analytics" || tab === "feedback") && <>
              {RANGES.map((r) => (
                <button key={r} onClick={() => pickRange(r)} style={r === range ? S.pillActive : S.pill}>{r}</button>
              ))}
              <button onClick={refresh} disabled={loading} style={S.refreshBtn}>{loading ? "…" : "Refresh"}</button>
            </>}
            <button onClick={signOut} style={S.signOutBtn}>Sign out</button>
          </div>
        </div>

        {/* Tab bar: Analytics (existing) | Feedback (feedback_event views)
            | Growth (activation, cohorts, progression, outcomes)
            | Economics (unit economics over generation_events cost capture) */}
        <div style={S.tabBar}>
          <button onClick={() => setTab("analytics")} style={tab === "analytics" ? S.tabActive : S.tab}>Analytics</button>
          <button onClick={() => setTab("feedback")} style={tab === "feedback" ? S.tabActive : S.tab}>Feedback</button>
          <button onClick={() => setTab("growth")} style={tab === "growth" ? S.tabActive : S.tab}>Growth</button>
          <button onClick={() => setTab("economics")} style={tab === "economics" ? S.tabActive : S.tab}>Economics</button>
        </div>

        {tab === "feedback" && <FeedbackDashboard token={token} range={range} refreshKey={refreshKey} />}
        {tab === "growth" && <GrowthDashboard token={token} refreshKey={refreshKey} />}
        {tab === "economics" && <EconomicsDashboard token={token} />}

        {tab === "analytics" && <>
        {error && (
          <div style={S.errorBanner}>
            <span>{error}</span>
            <button onClick={refresh} style={S.retryBtn}>Retry</button>
          </div>
        )}

        {/* Panel grid */}
        <div style={S.panelGrid}>
          {/* Account controls: pause / unpause a user (rogue-activity safeguard) */}
          <Panel title="Account controls">
            <div style={{ fontSize: 14, color: "#4A5568", lineHeight: 1.5, marginBottom: 10 }}>
              Pause an account (blocks generating, saving, and the coach) or lift a pause. Reversible — nothing is deleted. Paste the email from an alert.
            </div>
            <input value={suspendEmail} onChange={(e) => setSuspendEmail(e.target.value)} placeholder="user@example.com"
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", fontSize: 15, border: "1px solid #E2E5EA", borderRadius: 8, marginBottom: 10, fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => doSuspend("pause")} disabled={suspendBusy}
                style={{ background: "#C0392B", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 15, fontWeight: 600, cursor: suspendBusy ? "default" : "pointer", opacity: suspendBusy ? 0.6 : 1, fontFamily: "inherit" }}>Pause</button>
              <button onClick={() => doSuspend("unpause")} disabled={suspendBusy}
                style={{ background: "transparent", color: "#1A2540", border: "1px solid #E2E5EA", borderRadius: 8, padding: "9px 18px", fontSize: 15, cursor: suspendBusy ? "default" : "pointer", opacity: suspendBusy ? 0.6 : 1, fontFamily: "inherit" }}>Unpause</button>
            </div>
            {suspendMsg && <div style={{ fontSize: 14, color: "#1A2540", marginTop: 10 }}>{suspendMsg}</div>}
          </Panel>

          {/* My Pipeline beta access: grant / revoke the my_search flag by email */}
          <Panel title={`My Pipeline access (${testers.length})`}>
            <div style={{ fontSize: 14, color: "#4A5568", lineHeight: 1.5, marginBottom: 10 }}>
              Grant or revoke the My Pipeline beta for a registered user by email. Takes effect on their next page load.
            </div>
            <input value={pipelineEmail} onChange={(e) => setPipelineEmail(e.target.value)} placeholder="user@example.com"
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", fontSize: 15, border: "1px solid #E2E5EA", borderRadius: 8, marginBottom: 10, fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => doPipeline("grant")} disabled={pipelineBusy}
                style={{ background: "#C8924A", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 15, fontWeight: 600, cursor: pipelineBusy ? "default" : "pointer", opacity: pipelineBusy ? 0.6 : 1, fontFamily: "inherit" }}>Grant</button>
              <button onClick={() => doPipeline("revoke")} disabled={pipelineBusy}
                style={{ background: "transparent", color: "#1A2540", border: "1px solid #E2E5EA", borderRadius: 8, padding: "9px 18px", fontSize: 15, cursor: pipelineBusy ? "default" : "pointer", opacity: pipelineBusy ? 0.6 : 1, fontFamily: "inherit" }}>Revoke</button>
            </div>
            {pipelineMsg && <div style={{ fontSize: 14, color: "#1A2540", marginTop: 10 }}>{pipelineMsg}</div>}
            {testers.length > 0 && <div style={{ marginTop: 12, fontSize: 14, color: "#4A5568" }}>
              <div style={{ fontWeight: 600, color: "#1A2540", marginBottom: 4 }}>Current testers</div>
              {testers.map((e) => <div key={e} style={{ padding: "2px 0" }}>{e}</div>)}
            </div>}
          </Panel>

          {/* Go Independent: move an account between product tracks by email */}
          <Panel title={`Go Independent access (${trackMembers.length})`}>
            <div style={{ fontSize: 15, color: "#4A5568", lineHeight: 1.5, marginBottom: 10 }}>
              Testers normally arrive on the track by signing up through <code>/?track=independent</code>, which carries
              it through the sign-in email. Use this when someone signed up through the normal front door instead.
            </div>
            <input value={trackEmail} onChange={(e) => setTrackEmail(e.target.value)} placeholder="user@example.com"
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", fontSize: 15, border: "1px solid #E2E5EA", borderRadius: 8, marginBottom: 10, fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => doTrack("independent")} disabled={trackBusy}
                style={{ background: "#C8924A", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 15, fontWeight: 600, cursor: trackBusy ? "default" : "pointer", opacity: trackBusy ? 0.6 : 1, fontFamily: "inherit" }}>Move to Go Independent</button>
              <button onClick={() => doTrack(null)} disabled={trackBusy}
                style={{ background: "transparent", color: "#1A2540", border: "1px solid #E2E5EA", borderRadius: 8, padding: "9px 18px", fontSize: 15, cursor: trackBusy ? "default" : "pointer", opacity: trackBusy ? 0.6 : 1, fontFamily: "inherit" }}>Back to standard</button>
            </div>
            {trackMsg && <div style={{ fontSize: 15, color: "#1A2540", marginTop: 10 }}>{trackMsg}</div>}
            {trackMembers.length > 0 && <div style={{ marginTop: 12, fontSize: 15, color: "#4A5568" }}>
              <div style={{ fontWeight: 600, color: "#1A2540", marginBottom: 4 }}>On Go Independent</div>
              {trackMembers.map((m) => <div key={m.email} style={{ padding: "2px 0" }}>{m.email}</div>)}
            </div>}
          </Panel>

          {/* Account holds: the current hold list plus every account that has been
              held before and is active again. Lifting a hold nulls both suspension
              columns, so before the hold_count / last_hold_* columns a released
              account left no trace at all — and "was this person ever locked out?"
              is the question a support email actually asks. Held-now rows sort
              first and keep the per-row Unpause; released rows are history. */}
          <Panel title={`Account holds (${onHold.length} on hold, ${paused.length - onHold.length} released)`} wide>
            {paused.length === 0
              ? <div style={{ fontSize: 14, color: "#4A5568" }}>No account has ever been placed on hold.</div>
              : <table style={S.table}>
                  <thead><tr><Th>Email</Th><Th>Status</Th><Th>Why</Th><Th>When</Th><Th>Times held</Th><Th right>Action</Th></tr></thead>
                  <tbody>
                    {paused.map((p) => (
                      <tr key={p.email}>
                        <Td>{p.email}</Td>
                        <Td>{p.on_hold
                          ? <span style={{ color: "#C0392B", fontWeight: 600 }}>On hold</span>
                          : <span style={{ color: "#4A5568" }}>Released</span>}</Td>
                        <Td>{p.reason || p.last_hold_reason || "—"}</Td>
                        <Td>{(p.suspended_at || p.last_hold_at) ? new Date(p.suspended_at || p.last_hold_at).toLocaleString() : "—"}</Td>
                        <Td>{p.hold_count || (p.on_hold ? 1 : 0)}</Td>
                        <Td right>
                          {p.on_hold
                            ? <button onClick={() => unpauseRow(p.email)} disabled={rowBusy === p.email}
                                style={{ background: "#2E7D52", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 14, fontWeight: 600, cursor: rowBusy === p.email ? "default" : "pointer", opacity: rowBusy === p.email ? 0.6 : 1, fontFamily: "inherit" }}>
                                {rowBusy === p.email ? "…" : "Unpause"}
                              </button>
                            : <span style={{ color: "#9CA3AF" }}>—</span>}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>}
          </Panel>
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

          {/* Panel 1c: employment status crossed with door usage */}
          <Panel title="Employment status">
            <table style={S.table}>
              <thead><tr>
                <Th>Status</Th><Th right>Users</Th><Th right>Focus-complete</Th><Th right>Op-started</Th>
              </tr></thead>
              <tbody>
                {employment.map((e) => (
                  <tr key={e.status}>
                    <Td>{EMPLOYMENT_LABELS[e.status] || e.status}</Td>
                    <Td right>{e.users}</Td>
                    <Td right>{e.focus_complete}</Td>
                    <Td right>{e.op_started}</Td>
                  </tr>
                ))}
                {employment.length === 0 && <tr><Td colSpan={4} muted>No employment data yet.</Td></tr>}
              </tbody>
            </table>
          </Panel>

          {/* Panel 1e: search intake, in the users' own words. Raw answers rather
              than a breakdown on purpose — at this user count reading them is
              worth more than any chart, and they are what would decide a tag set
              if one ever earns its keep. */}
          <Panel title="What people said about their search" wide>
            {searchIntake.length === 0 && <p style={{ ...S.td, color: GRAYL, margin: 0 }}>Nobody has answered these yet.</p>}
            {searchIntake.map((r, i) => (
              <div key={r.email} style={{ padding: "14px 0", borderTop: i === 0 ? "none" : `1px solid ${BORDER}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ fontSize: 14, color: NAVY, wordBreak: "break-all" }}>{r.email}</span>
                  <span style={{ fontSize: 13, color: GRAYL, whiteSpace: "nowrap" }}>{(r.focus_at || r.going_well_at) ? new Date(r.focus_at || r.going_well_at).toLocaleDateString() : "—"}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                  {[["Going well", r.going_well], ["Would like to improve", r.focus]].map(([label, text]) => (
                    <div key={label}>
                      <div style={{ ...S.th, padding: "0 0 4px" }}>{label}</div>
                      <div style={{ fontSize: 14, lineHeight: 1.6, color: text ? GRAY : GRAYL }}>{text || "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
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
  adminNav: { display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" },
  adminNavLink: { fontSize: 16, color: GOLDL, fontWeight: 600, textDecoration: "none" },
  adminNavSep: { fontSize: 16, color: BORDER },
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
