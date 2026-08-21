// Growth dashboard — the Growth tab of /admin/dashboard. Usage and progression
// metrics: the set an investor asks for, read from /api/admin/growth.
//
// Built around one framing: Reimagine is a finite-journey product. Someone
// arrives in transition, works through it, and the goal is that they leave with
// a job. Habit-product metrics read low here even when the product is working,
// so the spine is activation → progression → outcome, and return is measured in
// weeks since each user's own signup rather than against the calendar.
//
// Every metric carries its definition, served from the endpoint and rendered at
// the bottom of the page. A definition that drifts between one telling and the
// next is the fastest way to lose an audience.
//
// Charts are inline SVG and CSS bars. No new dependencies, same rule as the
// other tabs.
import { useState, useEffect, useCallback } from "react"
import DormantAccounts from "./DormantAccounts"

const NAVY = "#1A2540"
const GOLD = "#C8924A"
const GOLDL = "#A06828"
const BORDER = "#E2E5EA"
const CREAM = "#FBF8F2"
const GRAY = "#3D4A5C"
const GRAYL = "#6B7685"
const OK = "#2E7D52"
const ERR = "#C0432F"

const fmtInt = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n)).toLocaleString("en-US") : "—")
const fmtPct = (n) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? "—" : `${Math.round(Number(n) * 100)}%`)
const fmtNum1 = (n) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? "—" : Number(n).toFixed(1))
const fmtHours = (h) => {
  if (h === null || h === undefined || !Number.isFinite(Number(h))) return "—"
  const v = Number(h)
  if (v < 1) return `${Math.round(v * 60)} min`
  if (v < 48) return `${v.toFixed(1)} hrs`
  return `${(v / 24).toFixed(1)} days`
}
const fmtMinutes = (m) => {
  if (m === null || m === undefined || !Number.isFinite(Number(m))) return "—"
  const v = Number(m)
  if (v < 60) return `${Math.round(v)} min`
  return `${(v / 60).toFixed(1)} hrs`
}
const weekLabel = (iso) => {
  if (!iso) return "—"
  const [, m, d] = iso.split("-")
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${names[Number(m) - 1] || m} ${Number(d)}`
}

const STAGE_LABELS = {
  researching: "Researching", applied: "Applied", in_conversation: "In conversation",
  interviewing: "Interviewing", offer: "Offer", closed: "Closed", "(none)": "No stage set",
}
// The ladder, in order. Rendered in full even where a stage has no rows: a
// stage nobody has reached is information, not an absent row.
const STAGE_LADDER = ["researching", "applied", "in_conversation", "interviewing", "offer", "closed"]
const OUTCOME_LABELS = {
  accepted: "Accepted an offer", declined: "Declined an offer", not_selected: "Not selected",
  withdrew: "Withdrew", no_response: "No response",
}
const SOURCE_LABELS = {
  referral: "Someone recommended it", bob: "Bob Goodwin or Career Club", linkedin: "LinkedIn",
  media: "Newsletter, podcast, or article", search: "Web search", event: "Event or workshop",
  other: "Something else", "(not asked)": "Predates the question",
}

export default function GrowthDashboard({ token, refreshKey = 0 }) {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [liveAsOf, setLiveAsOf] = useState(null)

  const fetchData = useCallback(async (tok) => {
    if (!tok) return
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/admin/growth", { headers: { Authorization: `Bearer ${tok}` } })
      if (res.status === 200) {
        setPayload(await res.json())
        setLiveAsOf(new Date().toUTCString())
      } else {
        setError(`Request failed (HTTP ${res.status}).`)
      }
    } catch {
      setError("Network error reaching the growth endpoint.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(token) }, [token, refreshKey, fetchData])

  if (loading && !payload) return <div style={S.muted}>Loading growth…</div>
  if (error && !payload) return (
    <div style={S.errorBanner}><span>{error}</span><button onClick={() => fetchData(token)} style={S.retryBtn}>Retry</button></div>
  )
  if (!payload) return null

  const f = payload.funnel || {}
  const cohorts = payload.cohorts || []
  const tta = payload.time_to_activate || {}
  const depth = payload.depth || []
  const ret = payload.retention || {}
  const ses = payload.sessions || {}
  const pbv = payload.playbooks || {}
  const doors = payload.doors || {}
  const crossVol = payload.crossover_by_volume || []
  const pipeline = payload.pipeline || []
  const reached = payload.reached || []
  const outcomes = payload.outcomes || []
  const hist = payload.history_coverage || {}
  const rec = payload.recognition || {}
  const coach = payload.coach || {}
  const sources = payload.sources || []
  const defs = payload.definitions || {}
  const cfg = payload.settings || {}

  const rate = (a, b) => (b > 0 ? a / b : null)
  const br = f.branch || {}
  const activationRate = rate(f.activated, f.signups)
  const completionRate = rate(f.focus_complete, f.activated)

  // The trunk: what everyone shares before the product offers a choice.
  // Personal Brand is the real gate -- the sidebar renders behind
  // done.includes('p3'), so until it exists nobody reaches Put It to Work or
  // either door. Everything after it is a branch, not a rung.
  const funnelSteps = [
    { key: "signups", label: "Signed up", value: f.signups },
    { key: "gave_inputs", label: "Put material in", value: f.gave_inputs },
    { key: "personal_brand", label: "Generated a Personal Brand", value: f.personal_brand, accent: true },
  ]
  const reachedByStage = reached.reduce((m, r) => { m[r.stage] = r; return m }, {})
  const nowByStage = pipeline.reduce((m, p) => { m[p.stage] = p; return m }, {})
  const maxReached = Math.max(1, ...reached.map((r) => r.opportunities))
  const maxDepth = Math.max(1, ...depth.map((d) => d.users))
  const totalDepthUsers = depth.reduce((s, d) => s + d.users, 0)
  const medianDepth = (() => {
    if (totalDepthUsers === 0) return null
    let seen = 0
    for (const d of depth) { seen += d.users; if (seen >= totalDepthUsers / 2) return d.sections }
    return null
  })()

  return (
    <>
      <div style={S.headerRow}>
        <div style={S.muted}>
          {liveAsOf ? <>Live as of <strong style={{ color: NAVY }}>{liveAsOf}</strong></> : "Loading…"}
        </div>
        <button onClick={() => fetchData(token)} disabled={loading} style={S.refreshBtn}>{loading ? "…" : "Refresh"}</button>
      </div>

      <div style={S.callout}>
        <strong style={{ color: NAVY }}>Read this as a finite-journey product.</strong> People arrive in transition and the goal is that they finish and leave with a job — so the spine here is activation, then progression, then outcome. Return is counted in weeks from each person's own signup, not against the calendar, and rising time-in-app would be a warning rather than a win. Numbers this small are structured evidence, not trends.
      </div>

      <div style={S.panelGrid}>
        {/* The three headline numbers. Three, and only three -- the panel is
            named for them, and time-to-first-playbook has its own panel below
            with quartiles rather than a duplicated median here. */}
        <Panel title="The three numbers" wide>
          <div style={S.tileGrid}>
            <Stat label="Activation rate" value={fmtPct(activationRate)} sub={`${fmtInt(f.activated)} of ${fmtInt(f.signups)} — either door`} accent />
            <Stat label="Took the recommended door first" value={fmtPct(doors.opportunity_first_share)} sub={`${fmtInt(doors.opportunity_first)} of ${fmtInt(doors.covered)} timed`} />
            <Stat label="Crossed over to Focus" value={fmtPct(doors.crossover_rate)} sub={`${fmtInt(doors.crossed_to_focus)} of ${fmtInt(doors.opportunity_first)} opportunity-first`} />
          </div>
          <div style={S.calloutTight}>
            Activation now counts a first playbook through <strong style={{ color: NAVY }}>either</strong> door. It previously counted only a Focus Playbook, which is the door most people do not take — changed 2026-08-21, before these numbers went anywhere, and recorded in the definitions below. Finishing all seven Focus sections is {fmtPct(completionRate)} of activated ({fmtInt(f.focus_complete)} people) and sits in the branch panel where it belongs.
          </div>
        </Panel>

        {/* Activation funnel */}
        <Panel title="Activation funnel" wide>
          {funnelSteps.map((s, i) => {
            const prev = i === 0 ? null : funnelSteps[i - 1].value
            const width = f.signups > 0 ? (s.value / f.signups) * 100 : 0
            return (
              <div key={s.key} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
                  <span style={{ color: GRAY }}>{s.label}</span>
                  <span style={{ color: GRAYL }}>
                    <strong style={{ color: NAVY }}>{fmtInt(s.value)}</strong>
                    {prev !== null && prev > 0 && <> · {fmtPct(s.value / prev)} of the step above</>}
                  </span>
                </div>
                <div style={S.barTrack}>
                  <div style={{ width: `${Math.max(width, 0.5)}%`, height: "100%", background: s.accent ? GOLDL : GOLD, opacity: s.accent ? 1 : 0.65, borderRadius: 5 }} />
                </div>
              </div>
            )
          })}
          <div style={S.subSectionLabel}>Then the choice: Put It to Work</div>
          <div style={S.tileGrid}>
            <Stat label="Add an Opportunity" value={fmtInt(br.opportunity)} sub={`${fmtPct(rate(br.opportunity, f.personal_brand))} of those who got this far`} accent />
            <Stat label="Career Paths" value={fmtInt(br.career_paths)} sub={fmtPct(rate(br.career_paths, f.personal_brand))} />
            <Stat label="Both doors" value={fmtInt(br.both)} />
            <Stat label="Neither" value={fmtInt(br.neither)} danger={br.neither > 0} sub="reached the choice, took no door" />
          </div>
          <div style={S.calloutTight}>
            The trunk is cumulative — each rung counts only people who cleared the one above — so a conversion cannot exceed 100%. The two doors are counted side by side rather than stacked: <strong style={{ color: NAVY }}>neither is downstream of the other</strong>, and Add an Opportunity is the one Put It to Work recommends first to anyone with a live opening.
            {" "}Personal Brand is the real gate — the sidebar renders behind it, so the {fmtInt(Math.max(0, (f.signups || 0) - (f.personal_brand || 0)))} people who never generated one never reached the choice at all. That drop is upstream of everything the product recommends.
          </div>
        </Panel>

        {/* Cohorts */}
        <Panel title={`Cohorts by signup week — activation and return`} wide>
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead><tr>
                <Th>Signed up</Th><Th right>Signups</Th><Th right>Activated</Th><Th right>Rate</Th><Th right>All 7</Th>
                {Array.from({ length: cfg.return_weeks || 6 }, (_, i) => <Th key={i} right>W{i}</Th>)}
              </tr></thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.cohort_week}>
                    <Td>{weekLabel(c.cohort_week)}</Td>
                    <Td right>{fmtInt(c.signups)}</Td>
                    <Td right>{fmtInt(c.activated)}</Td>
                    <Td right><strong style={{ color: NAVY }}>{fmtPct(c.activation_rate)}</strong></Td>
                    <Td right>{fmtInt(c.focus_complete)}</Td>
                    {c.weeks.map((w, i) => {
                      const share = c.signups > 0 && w !== null ? w / c.signups : 0
                      return (
                        <td key={i} style={{
                          ...S.td, textAlign: "right",
                          background: w ? `rgba(200,146,74,${Math.min(0.1 + share * 0.55, 0.7)})` : "transparent",
                          color: share > 0.5 ? NAVY : GRAY, fontWeight: share > 0.5 ? 700 : 400,
                        }}>{w === null || w === 0 ? <span style={{ opacity: 0.35 }}>—</span> : w}</td>
                      )
                    })}
                  </tr>
                ))}
                {cohorts.length === 0 && <tr><Td colSpan={5 + (cfg.return_weeks || 6)} muted>No signups in the last {cfg.cohort_weeks || 12} weeks.</Td></tr>}
              </tbody>
            </table>
          </div>
          <div style={S.calloutTight}>
            Week 0 is a person's first seven days, so it should sit at or near the cohort size. A low W0 means people signed up and never came back. The number to watch over time is the <strong style={{ color: NAVY }}>Rate</strong> column climbing as the product improves — that is the strongest thing a young product can show.
          </div>
        </Panel>

        {/* Opportunity Playbooks — counted as playbooks, not just people */}
        <Panel title="Opportunity Playbooks — how much people build" wide>
          <div style={S.tileGrid}>
            <Stat label="People who built one" value={fmtInt(pbv.op_builders)} sub={`${fmtPct(rate(f.opportunity, f.activated))} of activated`} accent />
            <Stat label="Playbooks built" value={fmtInt(pbv.op_total)} />
            <Stat label="Per person who built any" value={fmtNum1(pbv.op_per_builder)} sub={`median ${fmtNum1(pbv.median_op_pb)}`} />
            <Stat label="Most by one person" value={fmtInt(pbv.max_op_pb)} />
            <Stat label="Focus Playbooks built" value={fmtInt(pbv.focus_total)} sub={`${fmtNum1(pbv.focus_per_builder)} per builder`} />
          </div>
          <div style={S.calloutTight}>
            Every other count on this page counts <strong style={{ color: NAVY }}>people</strong>. This panel counts what they made — one person can run several live opportunities at once, and "{fmtInt(pbv.op_builders)} people built one" and "{fmtInt(pbv.op_total)} playbooks exist" are very different products. Playbooks per builder is the depth-of-use number: it rises when the tool becomes where someone works rather than something they tried.
          </div>
        </Panel>

        {/* Which door, and what happens next */}
        <Panel title="Which door they take, and what happens next" wide>
          <div style={S.tileGrid}>
            <Stat label="Opportunity first" value={fmtInt(doors.opportunity_first)} sub={fmtPct(doors.opportunity_first_share)} accent />
            <Stat label="Career Paths first" value={fmtInt(doors.career_paths_first)} />
            <Stat label="Time to first playbook — Opportunity" value={fmtHours(doors.median_hours_opportunity)} sub="median" />
            <Stat label="Time to first playbook — Career Paths" value={fmtHours(doors.median_hours_career_paths)} sub="median" />
          </div>

          <div style={S.subSectionLabel}>Crossover</div>
          <div style={S.tileGrid}>
            <Stat label="Opportunity first, later built Focus" value={fmtPct(doors.crossover_rate)} sub={`${fmtInt(doors.crossed_to_focus)} of ${fmtInt(doors.opportunity_first)}`} accent />
            <Stat label="Career Paths first, later added an opportunity" value={fmtPct(doors.reverse_crossover_rate)} sub={`${fmtInt(doors.crossed_to_opportunity)} of ${fmtInt(doors.career_paths_first)}`} />
          </div>

          <div style={S.subSectionLabel}>Crossover against how many opportunities they ran</div>
          <table style={S.table}>
            <thead><tr><Th>Opportunities built</Th><Th right>People</Th><Th right>Later opened Focus</Th><Th right>Rate</Th></tr></thead>
            <tbody>
              {crossVol.map((r) => (
                <tr key={r.opportunities}>
                  <Td>{r.opportunities >= 3 ? "3 or more" : r.opportunities === 1 ? "1" : String(r.opportunities)}</Td>
                  <Td right>{fmtInt(r.users)}</Td>
                  <Td right>{fmtInt(r.crossed)}</Td>
                  <Td right><strong style={{ color: NAVY }}>{fmtPct(r.rate)}</strong></Td>
                </tr>
              ))}
              {crossVol.length === 0 && <tr><Td colSpan={4} muted>No timed playbooks yet.</Td></tr>}
            </tbody>
          </table>

          <div style={S.calloutTight}>
            <strong style={{ color: NAVY }}>This is the beachhead thesis, as a number.</strong> If the rate in that table climbs with the number of opportunities someone ran, repeated value is buying the right to introduce the wider work. If it stays flat, people are using Reimagine to go after jobs and the Focus story has not landed yet — which is worth knowing early either way.
            {" "}Ordering needs per-playbook timestamps, so this covers the {fmtInt(doors.covered)} account{doors.covered === 1 ? "" : "s"} whose playbooks were saved server-side.
          </div>
        </Panel>

        {/* Who signed up and stopped. Placed right under the funnel: the
            steepest fall on that chart is a list of real people, and this is
            the list. */}
        <Panel title="Signed up and stopped" wide>
          <DormantAccounts token={token} refreshKey={refreshKey} />
        </Panel>

        {/* Progression depth */}
        <Panel title="How far people get">
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {depth.map((d) => (
              <div key={d.sections} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: GRAYL, width: 74, flexShrink: 0 }}>
                  {d.sections === 0 ? "none" : `${d.sections} of 7`}
                </span>
                <div style={{ ...S.barTrack, flex: 1 }}>
                  <div style={{ width: `${(d.users / maxDepth) * 100}%`, height: "100%", background: d.sections === 7 ? OK : GOLD, opacity: d.sections === 7 ? 1 : 0.7, borderRadius: 5 }} />
                </div>
                <span style={{ fontSize: 14, color: NAVY, fontWeight: 600, width: 28, textAlign: "right" }}>{d.users}</span>
              </div>
            ))}
            {depth.length === 0 && <div style={S.muted}>No accounts yet.</div>}
          </div>
          <div style={S.muted}>Median: <strong style={{ color: NAVY }}>{medianDepth === null ? "—" : `${medianDepth} of 7`}</strong> sections generated.</div>
        </Panel>

        {/* Time to activate */}
        <Panel title="Time from signup to first playbook">
          <div style={S.tileGrid}>
            <Stat label="Fastest quarter" value={fmtHours(tta.p25_hours)} />
            <Stat label="Median" value={fmtHours(tta.median_hours)} accent />
            <Stat label="Slowest quarter" value={fmtHours(tta.p75_hours)} />
          </div>
          <div style={S.calloutTight}>
            Covers the {fmtInt(tta.users)} account{tta.users === 1 ? "" : "s"} whose playbooks were saved server-side — the only ones carrying a per-playbook timestamp. A long median usually means the orientation is asking for more than someone can give in one sitting.
          </div>
        </Panel>

        {/* Return behaviour */}
        <Panel title="Coming back">
          <div style={S.tileGrid}>
            <Stat label="Returned after day one" value={fmtPct(rate(ret.returned_after_day_one, ret.users))} sub={`${fmtInt(ret.returned_after_day_one)} of ${fmtInt(ret.users)}`} accent />
            <Stat label="Came back after a quiet fortnight" value={fmtInt(ret.resurrected)} sub={`${cfg.resurrect_days || 14}+ idle days`} />
            <Stat label="Active, last 7 days" value={fmtInt(ret.active_7d)} />
            <Stat label="Active, last 30 days" value={fmtInt(ret.active_30d)} />
            <Stat label="Median active days" value={fmtNum1(ret.median_active_days)} sub="per account, all time" />
          </div>
          <div style={S.calloutTight}>
            For a job search the resurrection number carries more weight than a flat retention line. People come back when their search moves — an interview, an offer, a rejection they need to regroup from. A second bump in the cohort table above is the same signal.
          </div>
        </Panel>

        {/* Working sessions */}
        <Panel title="Time in the system">
          <div style={S.tileGrid}>
            <Stat label="Median session" value={fmtMinutes(ses.median_minutes)} accent />
            <Stat label="Longer quarter" value={fmtMinutes(ses.p75_minutes)} />
            <Stat label="Actions per session" value={fmtNum1(ses.median_actions)} />
            <Stat label="Sessions" value={fmtInt(ses.sessions)} sub={`${fmtInt(ses.users)} accounts`} />
          </div>
          <div style={S.calloutTight}>
            A session is a run of actions with no gap over {cfg.session_gap_min || 30} minutes, measured first action to last — so whatever someone read after their final click is invisible and these are floors.
            {ses.earliest && <> Reconstructed from timestamped activity, which starts {new Date(ses.earliest).toISOString().slice(0, 10)}.</>}
            {" "}Present this as time to a finished section rather than time in app: framed as engagement, a rising number is one you would have to defend.
          </div>
        </Panel>

        {/* Recognition */}
        <Panel title="Does this sound like you?">
          <div style={S.tileGrid}>
            <Stat label="Recognition rate" value={fmtPct(rec.rate)} sub={`${fmtInt(rec.total)} answers`} accent />
            <Stat label="Yes" value={fmtInt(rec.yes)} />
            <Stat label="Mostly" value={fmtInt(rec.mostly)} />
            <Stat label="Not quite" value={fmtInt(rec.not_quite)} danger={rec.not_quite > 0} />
          </div>
          <div style={S.calloutTight}>
            A quality measure nobody else in this category reports. It answers the question that actually decides whether someone tells a friend.
          </div>
        </Panel>

        {/* Coach */}
        <Panel title="My Coach">
          <div style={S.tileGrid}>
            <Stat label="Accounts using it" value={fmtPct(rate(coach.users, ret.users))} sub={`${fmtInt(coach.users)} of ${fmtInt(ret.users)}`} accent />
            <Stat label="Median turns" value={fmtNum1(coach.median_turns)} sub="per user" />
            <Stat label="Total turns" value={fmtInt(coach.turns)} />
          </div>
        </Panel>

        {/* Opportunity outcomes — the ladder, from the stage history */}
        <Panel title="How far opportunities have got" wide>
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead><tr>
                <Th>Stage</Th><Th right>Ever reached</Th><Th right>People</Th><Th right>There now</Th>
              </tr></thead>
              <tbody>
                {STAGE_LADDER.map((code) => {
                  const r = reachedByStage[code] || { opportunities: 0, users: 0 }
                  const now = nowByStage[code] || { records: 0 }
                  const width = maxReached > 0 ? (r.opportunities / maxReached) * 100 : 0
                  return (
                    <tr key={code}>
                      <Td>
                        <div style={{ marginBottom: 4 }}>{STAGE_LABELS[code] || code}</div>
                        <div style={{ ...S.barTrack, maxWidth: 260 }}>
                          <div style={{ width: `${Math.max(width, 0.5)}%`, height: "100%", background: code === "offer" ? OK : GOLD, opacity: code === "offer" ? 1 : 0.7, borderRadius: 5 }} />
                        </div>
                      </Td>
                      <Td right><strong style={{ color: NAVY }}>{fmtInt(r.opportunities)}</strong></Td>
                      <Td right>{fmtInt(r.users)}</Td>
                      <Td right muted>{now.records || "—"}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={S.subSectionLabel}>How they ended</div>
          <table style={S.table}>
            <thead><tr><Th>Outcome</Th><Th right>Opportunities</Th><Th right>People</Th></tr></thead>
            <tbody>
              {outcomes.map((o) => (
                <tr key={o.outcome}>
                  <Td>{OUTCOME_LABELS[o.outcome] || o.outcome}</Td>
                  <Td right><strong style={{ color: o.outcome === "accepted" ? OK : NAVY }}>{fmtInt(o.opportunities)}</strong></Td>
                  <Td right>{fmtInt(o.users)}</Td>
                </tr>
              ))}
              {outcomes.length === 0 && <tr><Td colSpan={3} muted>No opportunity has been closed out yet.</Td></tr>}
            </tbody>
          </table>

          <div style={S.calloutTight}>
            <strong style={{ color: NAVY }}>Ever reached</strong> comes from the append-only stage history, so an opportunity still counts at "interviewing" long after it closed. It counts only stages someone actually set — a jump straight to offer does not credit interviewing.
            {hist.backfill_events > 0 && (
              <> {fmtInt(hist.backfill_events)} of these are seeded from where things stood when the log shipped, so for anything already closed by then the earlier path is unknown and unrecoverable.</>
            )}
            {hist.first_live_at
              ? <> Observed history starts <strong style={{ color: NAVY }}>{new Date(hist.first_live_at).toISOString().slice(0, 10)}</strong> and is complete from there.</>
              : <> No stage change has been observed yet; everything here is the seeded snapshot.</>}
            {pipeline.length === 0 && <> My Pipeline is still gated to pilot testers, so coverage is a handful of people — widening that is what turns this panel into the number worth quoting.</>}
          </div>
        </Panel>

        {/* Signup source */}
        <Panel title="Where people came from" wide>
          <table style={S.table}>
            <thead><tr><Th>Source</Th><Th right>Accounts</Th><Th right>Share</Th><Th right>With detail</Th></tr></thead>
            <tbody>
              {(() => {
                const asked = sources.filter((s) => s.source !== "(not asked)")
                const askedTotal = asked.reduce((n, s) => n + s.users, 0)
                return (
                  <>
                    {asked.map((s) => (
                      <tr key={s.source}>
                        <Td>{SOURCE_LABELS[s.source] || s.source}</Td>
                        <Td right>{fmtInt(s.users)}</Td>
                        <Td right><strong style={{ color: NAVY }}>{fmtPct(askedTotal > 0 ? s.users / askedTotal : null)}</strong></Td>
                        <Td right muted>{s.with_detail || "—"}</Td>
                      </tr>
                    ))}
                    {asked.length === 0 && <tr><Td colSpan={4} muted>Nobody has answered the question yet.</Td></tr>}
                    {sources.filter((s) => s.source === "(not asked)").map((s) => (
                      <tr key={s.source}>
                        <Td muted>Predates the question</Td>
                        <Td right muted>{fmtInt(s.users)}</Td>
                        <Td right muted>—</Td>
                        <Td right muted>—</Td>
                      </tr>
                    ))}
                  </>
                )
              })()}
            </tbody>
          </table>
          <div style={S.calloutTight}>
            Shares are of accounts that were asked. Accounts created before the question shipped sit on their own line rather than inside an "unknown" bucket — folding them in would understate every real share. The line to watch is <strong style={{ color: NAVY }}>someone recommended it</strong>: it is the only direct measure of the growth engine.
          </div>
        </Panel>

        {/* Definitions */}
        <Panel title="Definitions — fixed, and not to be moved" wide>
          <div style={S.calloutTight}>
            Write these down before the first conversation. An activation number that changed definition between the first meeting and the second costs more credibility than a low number ever does.
          </div>
          <table style={{ ...S.table, marginTop: 12 }}>
            <tbody>
              {Object.entries(defs).map(([k, v]) => (
                <tr key={k}>
                  <Td><strong style={{ color: NAVY }}>{DEF_LABELS[k] || k}</strong></Td>
                  <Td>{v}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  )
}

const DEF_LABELS = {
  activation: "Activated", orientation: "Orientation done", focusComplete: "Focus Playbook complete",
  opportunity: "Opportunity Playbook", activeDay: "Active day", returnWeek: "Return week",
  resurrection: "Resurrection", workingSession: "Working session", depth: "Depth", recognition: "Recognition",
  reached: "Ever reached", outcome: "Outcome",
  funnelStep: "Funnel step", playbooksPerBuilder: "Playbooks per builder",
  careerPaths: "Career Paths", crossover: "Crossover", trunk: "The trunk",
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
  // Guidance keeps the gold border-left treatment so it never reads as data
  // (CLAUDE.md section 8).
  callout: { borderLeft: `4px solid ${GOLD}`, background: "#FDF8F0", borderRadius: "0 10px 10px 0", padding: "12px 16px", fontSize: 14, lineHeight: 1.6, color: GRAY, marginBottom: 16 },
  calloutTight: { borderLeft: `4px solid ${GOLD}`, background: "#FDF8F0", borderRadius: "0 8px 8px 0", padding: "10px 12px", fontSize: 14, lineHeight: 1.55, color: GRAY, marginTop: 12 },
  tileGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 },
  tile: { background: CREAM, borderRadius: 10, padding: "12px 14px" },
  tileValue: { fontSize: 26, fontWeight: 700, lineHeight: 1.1, fontFamily: "Georgia, serif" },
  tileLabel: { fontSize: 12, color: GRAYL, marginTop: 4, lineHeight: 1.3 },
  tileSub: { color: GOLDL, fontStyle: "italic" },
  barTrack: { height: 10, background: CREAM, borderRadius: 5, overflow: "hidden" },
  subSectionLabel: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: GRAYL, margin: "18px 0 6px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { color: GRAYL, fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", padding: "6px 8px", borderBottom: `1px solid ${BORDER}` },
  td: { padding: "7px 8px", borderBottom: `1px solid ${BORDER}` },
  muted: { color: GRAYL, fontSize: 14, lineHeight: 1.5 },
  refreshBtn: { background: NAVY, border: `1px solid ${NAVY}`, color: "#FFFFFF", borderRadius: 8, padding: "8px 16px", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  errorBanner: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "#FDECEA", border: `1px solid ${ERR}55`, color: ERR, borderRadius: 10, padding: "12px 16px", marginBottom: 18, fontSize: 14 },
  retryBtn: { background: ERR, border: "none", color: "#FFFFFF", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
}
