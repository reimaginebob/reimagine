// Research Desk — internal, @career.club only (brief 2026-08-16).
//
// Runs Reimagine's existing research prompts on typed input instead of on a
// user's profile, for people who are not Reimagine users: a friend, a client, a
// prospect. The only route before this was walking a demo persona far enough to
// unlock the Focus Playbook, after which THAT persona's profile drove the
// ranking — the wrong answer for someone else.
//
// Presentational on purpose. Every prompt, helper and API call it needs lives at
// module scope in App.jsx and is not exported; importing them here would make
// App.jsx <-> ResearchDesk a cycle, so App.jsx passes one `onRun(tool, intake)`
// and owns the prompt-building. This file owns intake, rendering and copy.
//
// Stores nothing, anywhere. These people never signed up and agreed to nothing,
// so there is no account to attach a retained document to. State is local and
// dies on reload. Nothing here touches profile_state.
import { useState, useRef, useEffect } from 'react'

const NAVY = '#1A2540'
const GOLD = '#C8924A'
const GOLDL = '#A06828'
const BORDER = '#E2E5EA'
const CREAM = '#FBF8F2'
const GRAY = '#3D4A5C'
const GRAYL = '#6B7685'

const S = {
  page: { maxWidth: 960, margin: '0 auto', padding: '28px 22px 80px', fontFamily: 'Georgia, serif', color: NAVY },
  h1: { fontSize: 30, fontWeight: 700, margin: '0 0 6px' },
  sub: { fontSize: 17, color: GRAY, lineHeight: 1.6, margin: '0 0 20px', fontFamily: 'system-ui, sans-serif' },
  tabs: { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  tab: on => ({
    background: on ? NAVY : '#fff', color: on ? '#fff' : GRAY,
    border: `1px solid ${on ? NAVY : BORDER}`, borderRadius: 8,
    padding: '9px 16px', fontSize: 16, fontWeight: on ? 600 : 400,
    cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
  }),
  panel: { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '22px 24px', marginBottom: 18 },
  note: { borderLeft: `3px solid ${GOLD}`, background: CREAM, padding: '12px 16px', borderRadius: 4, fontSize: 16, lineHeight: 1.6, color: NAVY, fontFamily: 'system-ui, sans-serif', marginBottom: 20 },
  field: { marginBottom: 14 },
  label: { display: 'block', fontSize: 15, fontWeight: 600, color: NAVY, marginBottom: 5, fontFamily: 'system-ui, sans-serif' },
  hint: { fontSize: 15, color: GRAYL, lineHeight: 1.5, marginBottom: 6, fontFamily: 'system-ui, sans-serif' },
  inp: { width: '100%', boxSizing: 'border-box', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px', fontSize: 17, fontFamily: 'system-ui, sans-serif', color: NAVY },
  ta: { width: '100%', boxSizing: 'border-box', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px', fontSize: 17, fontFamily: 'system-ui, sans-serif', color: NAVY, minHeight: 70, resize: 'vertical' },
  row: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  half: { flex: '1 1 220px' },
  run: dis => ({
    background: dis ? '#C9CFDA' : GOLD, color: '#fff', border: 'none', borderRadius: 8,
    padding: '11px 22px', fontSize: 17, fontWeight: 600, cursor: dis ? 'default' : 'pointer',
    fontFamily: 'system-ui, sans-serif',
  }),
  small: { background: 'transparent', border: `1px solid ${BORDER}`, color: GRAYL, borderRadius: 8, padding: '6px 12px', fontSize: 16, cursor: 'pointer', fontFamily: 'system-ui, sans-serif' },
  err: { background: '#FBEBE8', border: '1px solid #C0432F', color: '#8E2F1F', borderRadius: 8, padding: '10px 14px', fontSize: 16, marginBottom: 14, fontFamily: 'system-ui, sans-serif' },
  card: { border: `1px solid ${BORDER}`, borderRadius: 10, padding: '16px 18px', marginBottom: 12 },
  cardName: { fontSize: 19, fontWeight: 700, margin: '0 0 4px' },
  meta: { fontSize: 15, color: GRAYL, marginBottom: 8, fontFamily: 'system-ui, sans-serif' },
  body: { fontSize: 17, lineHeight: 1.6, color: GRAY, margin: '0 0 6px', fontFamily: 'system-ui, sans-serif' },
  tag: c => ({ display: 'inline-block', fontSize: 15, color: c, border: `1px solid ${c}`, borderRadius: 20, padding: '2px 10px', marginRight: 6, fontFamily: 'system-ui, sans-serif' }),
  link: { color: GOLDL, fontSize: 15, fontFamily: 'system-ui, sans-serif' },
}

const LANES = [
  { v: 'Familiar Ground', d: 'same kind of work, new seat' },
  { v: 'Industry Insider', d: 'same skills, wider set of organisations' },
  { v: 'Work That Matters', d: 'values-led pivot' },
]

// Same approach as the Coach copy fix (#463): strip the typography off a clone so
// a paste lands in the destination's own font, and keep everything structural.
const COPY_STRIP_PROPS = ['font-size', 'font-family', 'line-height', 'color']

// Field MUST stay at module scope. Defined inside the component it is a new
// component type on every render, so React unmounts and remounts the subtree on
// each keystroke — the input loses focus and only the first character lands.
function Field({ label, hint, children }) {
  return (
    <div style={S.field}>
      <label style={S.label}>{label}</label>
      {hint ? <div style={S.hint}>{hint}</div> : null}
      {children}
    </div>
  )
}

export default function ResearchDesk({ onRun }) {
  // Self-gating: App.jsx renders this before signedInUser exists in its scope, so
  // the check lives here. 'checking' and 'denied' both render nothing — a wrong
  // address must not learn that the route exists.
  const [access, setAccess] = useState('checking')
  useEffect(() => {
    let live = true
    fetch('/api/me', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : { user: null }))
      .then(d => {
        if (!live) return
        const email = (d && d.user && d.user.email) || ''
        setAccess(/@career\.club$/i.test(email) ? 'ok' : 'denied')
      })
      .catch(() => { if (live) setAccess('denied') })
    return () => { live = false }
  }, [])

  const [tool, setTool] = useState('recruiters')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [out, setOut] = useState(null)
  const [copied, setCopied] = useState(false)
  const outRef = useRef(null)

  // One bag for every tool's fields. Switching tools keeps what was typed, so a
  // role title entered for recruiters is still there for target companies.
  const [f, setF] = useState({
    roleTitle: '', industry: '', geo: '', sector: '', city: '', country: 'United States',
    remote: 'Open to remote', lane: 'Industry Insider', draw: '', knownFor: '',
    constraints: '', background: '',
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const ready = tool === 'recruiters'
    ? f.roleTitle.trim() && f.industry.trim()
    : f.roleTitle.trim() && (f.city.trim() || f.remote)

  const run = async () => {
    setBusy(true); setErr(null); setOut(null); setCopied(false)
    try {
      const result = await onRun(tool, f)
      setOut(result)
    } catch (e) {
      setErr((e && e.message) || 'That did not come back. Try again in a moment.')
    }
    setBusy(false)
  }

  const copy = async () => {
    const el = outRef.current
    if (!el) return
    const clone = el.cloneNode(true)
    clone.querySelectorAll('*').forEach(n => {
      if (n.style) COPY_STRIP_PROPS.forEach(p => n.style.removeProperty(p))
    })
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new window.ClipboardItem({
          'text/html': new Blob([clone.innerHTML], { type: 'text/html' }),
          'text/plain': new Blob([el.innerText || ''], { type: 'text/plain' }),
        })])
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(el.innerText || '')
      }
      setCopied(true)
    } catch { /* clipboard blocked */ }
  }


  if (access !== 'ok') return null

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Reimagine Backdoor</h1>
      <p style={S.sub}>
        Reimagine's research, run on what you type instead of on someone's profile — for people who are not users.
      </p>

      <div style={S.note}>
        <strong>Nothing here is saved.</strong> The person you are researching never signed up, so there is no
        account to attach their details to. What you type lives on this screen and is gone when you reload it,
        and none of it reaches your own profile.
      </div>

      <div style={S.tabs}>
        <button style={S.tab(tool === 'recruiters')} onClick={() => { setTool('recruiters'); setOut(null); setErr(null) }}>Executive Recruiters</button>
        <button style={S.tab(tool === 'companies')} onClick={() => { setTool('companies'); setOut(null); setErr(null) }}>Target Companies</button>
      </div>

      <div style={S.panel}>
        {tool === 'recruiters' ? (
          <>
            <Field label="Role title" hint="The seniority band is read from this — “VP of Marketing”, “Director of Operations”.">
              <input style={S.inp} value={f.roleTitle} onChange={e => set('roleTitle', e.target.value)} placeholder="VP of Marketing" />
            </Field>
            <Field label="Industry">
              <input style={S.inp} value={f.industry} onChange={e => set('industry', e.target.value)} placeholder="Financial services" />
            </Field>
            <Field label="Geography" hint="Optional, and a preference rather than a filter — retained search at this level is usually national, so a firm outside the area still shows up when it is the right specialist.">
              <input style={S.inp} value={f.geo} onChange={e => set('geo', e.target.value)} placeholder="Midwest, or Cincinnati / Chicago" />
            </Field>
          </>
        ) : (
          <>
            <div style={S.row}>
              <div style={S.half}>
                <Field label="Target role or function">
                  <input style={S.inp} value={f.roleTitle} onChange={e => set('roleTitle', e.target.value)} placeholder="Sales manager" />
                </Field>
              </div>
              <div style={S.half}>
                <Field label="Target sector" hint="Optional. Fill it in when you already know where to look; leave it blank to let the lane decide.">
                  <input style={S.inp} value={f.sector} onChange={e => set('sector', e.target.value)} placeholder="Secondhand and resale marketplaces" />
                </Field>
              </div>
            </div>
            <div style={S.row}>
              <div style={S.half}>
                <Field label="City">
                  <input style={S.inp} value={f.city} onChange={e => set('city', e.target.value)} placeholder="Cincinnati" />
                </Field>
              </div>
              <div style={S.half}>
                <Field label="Country">
                  <input style={S.inp} value={f.country} onChange={e => set('country', e.target.value)} />
                </Field>
              </div>
              <div style={S.half}>
                <Field label="Remote">
                  <select style={S.inp} value={f.remote} onChange={e => set('remote', e.target.value)}>
                    <option>Open to remote</option>
                    <option>Remote only</option>
                    <option>On-site or hybrid, local only</option>
                  </select>
                </Field>
              </div>
            </div>
            <Field label="Which kind of move">
              <select style={S.inp} value={f.lane} onChange={e => set('lane', e.target.value)}>
                {LANES.map(l => <option key={l.v} value={l.v}>{l.v} — {l.d}</option>)}
              </select>
            </Field>
            <Field label="What draws them to this work?" hint="This orders the list. Companies with a genuine connection to what they care about rank above ones that only fit on paper, so a sentence beats a word.">
              <textarea style={S.ta} value={f.draw} onChange={e => set('draw', e.target.value)} placeholder="Has run his own online vintage clothing business for ten years and loves the category. Hates the idea of a corporate job." />
            </Field>
            <Field label="What are they known for?" hint="How people describe them, what they get called in for.">
              <textarea style={S.ta} value={f.knownFor} onChange={e => set('knownFor', e.target.value)} placeholder="Retail sales and sales management; knows the resale business end to end from running his own store." />
            </Field>
            <Field label="Constraints" hint="Compensation floor, anything they will not consider. Applied as weights on the ranking, never as a hard filter.">
              <textarea style={S.ta} value={f.constraints} onChange={e => set('constraints', e.target.value)} placeholder="Needs at least $80,000. Not interested in a large corporate environment." />
            </Field>
            <Field label="Background" hint="Optional. Paste a resume or a few lines of history.">
              <textarea style={S.ta} value={f.background} onChange={e => set('background', e.target.value)} />
            </Field>
          </>
        )}

        {err ? <div style={S.err}>{err}</div> : null}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button style={S.run(busy || !ready)} disabled={busy || !ready} onClick={run}>
            {busy ? 'Researching…' : 'Run'}
          </button>
          {busy ? <span style={{ ...S.hint, marginBottom: 0 }}>Live web research — this takes a minute or two.</span> : null}
        </div>
      </div>

      {out ? (
        <div style={S.panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 }}>
            <strong style={{ fontSize: 19 }}>{tool === 'recruiters' ? 'Recruiters' : 'Target companies'}</strong>
            <button style={S.small} onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <div ref={outRef}>
            {tool === 'recruiters' ? <Recruiters data={out} /> : <Companies data={out} />}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Recruiters({ data }) {
  const matches = (data && Array.isArray(data.matches)) ? data.matches : []
  if (!matches.length) return <p style={S.body}>Nothing came back that could be traced to a first-party source. Try a broader industry, or a different way of naming the function.</p>
  return (
    <>
      {matches.map((m, i) => (
        <div key={i} style={S.card}>
          <p style={S.cardName}>{m.firm}</p>
          <div style={S.meta}>
            <span style={S.tag(m.kind === 'practice' ? GOLDL : NAVY)}>{m.kind === 'practice' ? 'Practice at a larger firm' : 'Boutique'}</span>
            <span style={S.tag(m.confidence === 'high' ? '#2F7D54' : m.confidence === 'medium' ? GOLDL : GRAYL)}>{m.confidence} confidence</span>
          </div>
          {m.practice ? <p style={S.body}><strong>Practice:</strong> {m.practice}</p> : null}
          {m.specialty ? <p style={S.body}>{m.specialty}</p> : null}
          {m.leaderName
            ? <p style={S.body}><strong>{m.leaderName}</strong>{m.leaderTitle ? `, ${m.leaderTitle}` : ''}</p>
            : <p style={{ ...S.body, color: GRAYL }}>No individual confirmed by a first-party source — approach the firm or the practice.</p>}
          {m.openSearchSignal && m.openSearchSignal.description
            ? <p style={S.body}><strong>Open search:</strong> {m.openSearchSignal.description}</p> : null}
          <p style={{ margin: 0 }}>
            {[['Firm', m.url], ['Practice', m.practiceUrl], ['Profile', m.leaderProfileUrl], ['Source', m.sourceUrl]]
              .filter(([, u]) => u)
              .map(([label, u], k) => <a key={k} href={u} target="_blank" rel="noopener noreferrer" style={{ ...S.link, marginRight: 12 }}>{label}</a>)}
          </p>
        </div>
      ))}
    </>
  )
}

function Companies({ data }) {
  if (typeof data === 'string') return <p style={{ ...S.body, whiteSpace: 'pre-wrap' }}>{data}</p>
  const list = Array.isArray(data && data.part_2_company_list) ? data.part_2_company_list : []
  return (
    <>
      {data && data.quick_takeaway ? <p style={S.body}>{data.quick_takeaway}</p> : null}
      {data && data.part_1_hiring_executive ? (
        <div style={S.card}>
          <p style={S.cardName}>Who does the hiring</p>
          <p style={{ ...S.body, whiteSpace: 'pre-wrap' }}>{data.part_1_hiring_executive}</p>
        </div>
      ) : null}
      {list.map((c, i) => (
        <div key={i} style={S.card}>
          <p style={S.cardName}>{i + 1}. {c.name}</p>
          <div style={S.meta}>{[c.industry, c.size, c.hq].filter(Boolean).join(' · ')}</div>
          {c.what ? <p style={S.body}>{c.what}</p> : null}
          {c.fit ? <p style={S.body}><strong>Fit:</strong> {c.fit}</p> : null}
          {c.growth ? <p style={S.body}><strong>Signal:</strong> {c.growth}</p> : null}
          {c.contact ? <p style={S.body}><strong>Contact:</strong> {c.contact}{c.source ? ` (${c.source})` : ''}</p> : null}
          <p style={{ margin: 0 }}>
            {[['Website', c.website], ['LinkedIn', c.contactLinkedIn]]
              .filter(([, u]) => u)
              .map(([label, u], k) => <a key={k} href={u} target="_blank" rel="noopener noreferrer" style={{ ...S.link, marginRight: 12 }}>{label}</a>)}
          </p>
        </div>
      ))}
      {data && data.part_3_outreach_template ? (
        <div style={S.card}>
          <p style={S.cardName}>Outreach</p>
          <p style={{ ...S.body, whiteSpace: 'pre-wrap' }}>{typeof data.part_3_outreach_template === 'string' ? data.part_3_outreach_template : JSON.stringify(data.part_3_outreach_template, null, 2)}</p>
        </div>
      ) : null}
      {data && data.part_4_linkedin_tweak ? (
        <div style={S.card}>
          <p style={S.cardName}>LinkedIn tweak</p>
          <p style={{ ...S.body, whiteSpace: 'pre-wrap' }}>{typeof data.part_4_linkedin_tweak === 'string' ? data.part_4_linkedin_tweak : JSON.stringify(data.part_4_linkedin_tweak, null, 2)}</p>
        </div>
      ) : null}
    </>
  )
}
