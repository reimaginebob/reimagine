// "Signed up and stopped" — the accounts panel on the Growth tab. Reads
// /api/admin/dormant, which returns email addresses (unlike the rest of the
// Growth tab, which is aggregates only).
//
// Three lists rather than one, because "did nothing" is three situations:
// people who never typed anything, people who gave us material and got nothing
// back, and people who saw their Personal Brand and stopped. The middle group
// is the one worth reaching — they spent effort, hit something, and left.
//
// Accounts whose likely duplicate is active are held out of the copy list by
// default. That person did their work, just on another account; writing to
// them about not having started would be wrong.
import { useState, useEffect, useCallback } from "react"

const NAVY = "#1A2540"
const GOLD = "#C8924A"
const GOLDL = "#A06828"
const BORDER = "#E2E5EA"
const CREAM = "#FBF8F2"
const GRAY = "#3D4A5C"
const GRAYL = "#6B7685"
const OK = "#2E7D52"
const ERR = "#C0432F"

const LISTS = [
  { key: "inputs_only", label: "Gave us material, got nothing back", blurb: "They typed or pasted something into the orientation and never generated. Whatever stopped them is a real product problem, and they are the ones who can tell you what it was." },
  { key: "nothing_at_all", label: "Never typed anything", blurb: "Signed up and left without entering a thing. Many are curiosity clicks; the ones who came back more than once are not." },
  { key: "brand_no_playbook", label: "Saw their Personal Brand, stopped", blurb: "They have seen the product's opening move and declined the next one. The most informative group about whether the first output lands." },
]

const SOURCE_LABELS = {
  referral: "Referral", bob: "Bob / Career Club", linkedin: "LinkedIn", media: "Media",
  search: "Search", event: "Event", other: "Other",
}
const DUP_KIND_LABELS = { case: "same address, different case", address: "same inbox", name: "same name" }

const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—")
const fmtInt = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n)).toLocaleString("en-US") : "—")

export default function DormantAccounts({ token, refreshKey = 0 }) {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [list, setList] = useState("inputs_only")
  const [includeTwins, setIncludeTwins] = useState(false)
  const [copied, setCopied] = useState("")
  const [showDupes, setShowDupes] = useState(false)

  const fetchData = useCallback(async (tok) => {
    if (!tok) return
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/admin/dormant", { headers: { Authorization: `Bearer ${tok}` } })
      if (res.status === 200) setPayload(await res.json())
      else setError(`Request failed (HTTP ${res.status}).`)
    } catch {
      setError("Network error reaching the accounts endpoint.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(token) }, [token, refreshKey, fetchData])

  if (loading && !payload) return <div style={S.muted}>Loading accounts…</div>
  if (error && !payload) return (
    <div style={S.errorBanner}><span>{error}</span><button onClick={() => fetchData(token)} style={S.retryBtn}>Retry</button></div>
  )
  if (!payload) return null

  const totals = payload.totals || {}
  const rows = payload[list] || []
  const shown = includeTwins ? rows : rows.filter((r) => !r.twin_is_active)
  const heldBack = rows.length - shown.length
  const meta = LISTS.find((l) => l.key === list) || LISTS[0]

  const copyEmails = async () => {
    const text = shown.map((r) => r.email).join(", ")
    try {
      await navigator.clipboard.writeText(text)
      setCopied(`${shown.length} address${shown.length === 1 ? "" : "es"} copied.`)
      setTimeout(() => setCopied(""), 4000)
    } catch {
      setCopied("Could not reach the clipboard — select the table instead.")
    }
  }

  return (
    <>
      <div style={S.calloutTight}>
        <strong style={{ color: NAVY }}>"Did nothing" is three different situations</strong>, so they are three lists. The counts below are of people, and an account whose likely duplicate is busy elsewhere is held out of the copy list by default — that person did their work, just not on this account.
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "14px 0 10px" }}>
        {LISTS.map((l) => (
          <button key={l.key} onClick={() => setList(l.key)} style={l.key === list ? S.pillActive : S.pill}>
            {l.label} · {fmtInt((payload[l.key] || []).length)}
          </button>
        ))}
      </div>

      <div style={S.muted}>{meta.blurb}</div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "12px 0" }}>
        <button onClick={copyEmails} disabled={shown.length === 0} style={S.primaryBtn}>
          Copy {fmtInt(shown.length)} address{shown.length === 1 ? "" : "es"}
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, color: GRAY, cursor: "pointer" }}>
          <input type="checkbox" checked={includeTwins} onChange={(e) => setIncludeTwins(e.target.checked)} style={{ width: 18, height: 18, accentColor: GOLD, cursor: "pointer" }} />
          Include the {fmtInt(heldBack)} whose duplicate is active
        </label>
        {copied && <span style={{ fontSize: 15, color: OK, fontWeight: 600 }}>{copied}</span>}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={S.table}>
          <thead><tr>
            <Th>Email</Th><Th>Name</Th><Th>Signed up</Th><Th right>Days ago</Th>
            <Th>Last seen</Th><Th right>Visits</Th><Th right>Fields filled</Th><Th>Source</Th><Th>Duplicate</Th>
          </tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.email} style={r.twin_is_active ? { background: CREAM } : undefined}>
                <Td>{r.email}</Td>
                <Td>{r.name || <span style={{ opacity: 0.4 }}>—</span>}</Td>
                <Td>{fmtDate(r.created_at)}</Td>
                <Td right>{fmtInt(r.days_since_signup)}</Td>
                <Td>
                  {fmtDate(r.last_activity)}
                  {r.days_active_span === 0 && r.last_activity && <span style={{ color: GRAYL }}> · same day</span>}
                </Td>
                <Td right>{fmtInt(r.sessions)}</Td>
                <Td right>{r.input_fields > 0 ? <strong style={{ color: GOLDL }}>{r.input_fields}</strong> : <span style={{ opacity: 0.4 }}>0</span>}</Td>
                <Td muted>{r.signup_source ? (SOURCE_LABELS[r.signup_source] || r.signup_source) : "—"}</Td>
                <Td>
                  {r.duplicate_of.length === 0
                    ? <span style={{ opacity: 0.4 }}>—</span>
                    : <span style={{ color: r.twin_is_active ? ERR : GRAYL, fontSize: 13 }}>
                        {r.twin_is_active ? "active twin: " : "twin: "}{r.duplicate_of.join(", ")}
                      </span>}
                </Td>
              </tr>
            ))}
            {shown.length === 0 && <tr><Td colSpan={9} muted>Nobody in this group.</Td></tr>}
          </tbody>
        </table>
      </div>

      {(payload.duplicates || []).length > 0 && (
        <>
          <button onClick={() => setShowDupes(!showDupes)} style={{ ...S.pill, marginTop: 14 }}>
            {showDupes ? "Hide" : "Show"} {fmtInt(totals.duplicate_clusters)} duplicate group{totals.duplicate_clusters === 1 ? "" : "s"}
          </button>
          {showDupes && (
            <div style={{ marginTop: 12 }}>
              <div style={S.calloutTight}>
                Three checks: the same address written in different cases, the same inbox reached by a different spelling (a <code>+tag</code>, or Gmail dots), and the same first and last name on two addresses. A name match on two genuinely different people is possible — treat these as candidates, not verdicts.
              </div>
              <table style={{ ...S.table, marginTop: 12 }}>
                <thead><tr><Th>Match</Th><Th>Accounts</Th><Th right>Any active</Th></tr></thead>
                <tbody>
                  {payload.duplicates.map((d, i) => (
                    <tr key={i}>
                      <Td muted>{DUP_KIND_LABELS[d.kind] || d.kind}</Td>
                      <Td>
                        {d.accounts.map((a) => (
                          <div key={a.email} style={{ padding: "2px 0" }}>
                            {a.email}
                            <span style={{ color: GRAYL, fontSize: 13 }}>
                              {" · "}{fmtDate(a.created_at)}
                              {a.active ? <strong style={{ color: OK }}> · active</strong> : " · dormant"}
                            </span>
                          </div>
                        ))}
                      </Td>
                      <Td right>{d.any_active ? <strong style={{ color: OK }}>yes</strong> : "no"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  )
}

function Th({ children, right }) {
  return <th style={{ ...S.th, textAlign: right ? "right" : "left" }}>{children}</th>
}
function Td({ children, right, muted, colSpan }) {
  return <td colSpan={colSpan} style={{ ...S.td, textAlign: right ? "right" : "left", color: muted ? GRAYL : GRAY }}>{children}</td>
}

const S = {
  calloutTight: { borderLeft: `4px solid ${GOLD}`, background: "#FDF8F0", borderRadius: "0 8px 8px 0", padding: "10px 12px", fontSize: 14, lineHeight: 1.55, color: GRAY },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { color: GRAYL, fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", padding: "6px 8px", borderBottom: `1px solid ${BORDER}` },
  td: { padding: "7px 8px", borderBottom: `1px solid ${BORDER}` },
  pill: { background: "#FFFFFF", border: `1px solid ${BORDER}`, color: GRAY, borderRadius: 999, padding: "7px 16px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  pillActive: { background: GOLD, border: `1px solid ${GOLD}`, color: "#FFFFFF", borderRadius: 999, padding: "7px 16px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  primaryBtn: { background: NAVY, border: `1px solid ${NAVY}`, color: "#FFFFFF", borderRadius: 8, padding: "9px 18px", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  muted: { color: GRAYL, fontSize: 14, lineHeight: 1.5 },
  errorBanner: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "#FDECEA", border: `1px solid ${ERR}55`, color: ERR, borderRadius: 10, padding: "12px 16px", fontSize: 14 },
  retryBtn: { background: ERR, border: "none", color: "#FFFFFF", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
}
