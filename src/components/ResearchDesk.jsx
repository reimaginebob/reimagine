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
  openHit: { marginTop: 10, marginBottom: 6 },
  openBadge: { display: 'inline-block', padding: '6px 12px', background: '#E4F6EA', border: '1.5px solid #1A7F5A', borderRadius: 8, color: '#12603F', fontSize: 15, fontWeight: 700, fontFamily: 'system-ui, sans-serif' },
  openLink: { fontSize: 15, color: '#12603F', marginLeft: 8, fontFamily: 'system-ui, sans-serif' },
  openNone: { fontSize: 15, color: GRAYL, margin: '8px 0 6px', fontFamily: 'system-ui, sans-serif' },
  bandOk: { fontSize: 15, color: GRAYL, marginTop: 6, fontFamily: 'system-ui, sans-serif' },
  refine: { marginTop: 20, paddingTop: 18, borderTop: `1px solid ${BORDER}` },
  working: { display: 'flex', alignItems: 'center', gap: 10, background: '#EEF3FA', border: '1px solid #C3D4EA', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 16, color: '#1A3A63', fontFamily: 'system-ui, sans-serif' },
  spinner: { width: 12, height: 12, borderRadius: '50%', background: '#2C5C96', flexShrink: 0, animation: 'deskPulse 1.1s ease-in-out infinite' },
  stale: { opacity: 0.45, transition: 'opacity 120ms linear' },
  summary: { background: '#F4F6F9', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '12px 14px', marginBottom: 14, fontSize: 15, lineHeight: 1.55, color: GRAY, fontFamily: 'system-ui, sans-serif' },
  bandWarn: { fontSize: 15, color: '#8E5A12', background: '#FDF3E2', border: '1px solid #E2C48B', borderRadius: 6, padding: '8px 10px', marginTop: 6, lineHeight: 1.5, fontFamily: 'system-ui, sans-serif' },
}

const LANES = [
  { v: 'Familiar Ground', d: 'same kind of work, new seat' },
  { v: 'Industry Insider', d: 'same skills, wider set of organisations' },
  { v: 'Work That Matters', d: 'values-led pivot' },
]

// Same approach as the Coach copy fix (#463): strip the typography off a clone so
// a paste lands in the destination's own font, and keep everything structural.
const COPY_STRIP_PROPS = ['font-size', 'font-family', 'line-height', 'color']

// Firm / Practice / Profile / Source are four DIFFERENT pages: the firm, its
// practice, the person, and the page that establishes the specialty claim. When
// the model returns the same URL twice, a second link labelled "Source" reads as
// corroboration and is not — it is the same page wearing a second label. Keep the
// first label for any given URL and drop the repeats, comparing without a
// trailing slash so "/about" and "/about/" count as one.
function dedupeLinks(pairs) {
  const seen = new Set()
  return pairs.filter(([, u]) => {
    if (!u || typeof u !== 'string') return false
    const key = u.trim().replace(/\/+$/, '').toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// The seniority band the search actually goes out with is picked by the FIRST
// matching rule in priority order, so a title naming two levels silently keeps
// only the higher one: "Director or VP" searches VP and drops Director entirely.
// That inference was invisible until now. BANDS is for DISPLAY only — it never
// decides the band, it just reports which other levels the title mentions so a
// compound title stops failing quietly.
const BANDS = [
  ['C-suite', /\b(chief|c-?suite|cxo|ceo|cfo|coo|cto|cmo|cro|cpo|ciso|president)\b/i],
  ['SVP/EVP', /\bsvp\b|\bevp\b|senior vice president|executive vice president/i],
  ['VP', /\bvp\b|vice president|head of/i],
  ['Director', /\b(director|principal|lead)\b/i],
]
function bandsMentioned(title) {
  const t = String(title || '')
  return BANDS.filter(([, re]) => re.test(t)).map(([name]) => name)
}

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

export default function ResearchDesk({ onRun, onRefine, onOutreach, onExportCsv, onExportCompaniesCsv, inferBand }) {
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
  const [note, setNote] = useState('')
  const [refining, setRefining] = useState(false)
  const [seed, setSeed] = useState('')
  const [outreach, setOutreach] = useState('')
  const [writing, setWriting] = useState(false)
  // What is happening right now, reported by the work itself. `acting` names
  // WHICH control started it, so that control can show its own state instead of
  // the feedback appearing somewhere else on the page.
  const [status, setStatus] = useState('')
  const [acting, setActing] = useState('')

  // "More like this" and "What about X?" are the same mechanic as a refine note —
  // the prompt takes a `focus` string and an `exclude` list — so they compose a
  // good note rather than needing anything new on the prompt side. Both append,
  // because the intent is "add more of this kind", not "that was wrong".
  const moreLikeThis = (m) => refine(
    `Find more firms like ${m.firm}${m.specialty ? ` — ${m.specialty}` : ''}. Match that shape: ${m.kind === 'practice' ? 'a named practice inside a larger firm' : 'an independent boutique where the firm itself is the specialty'}. Do not return ${m.firm} again.`,
    'append',
    'more:' + m.firm
  )
  const askAboutFirm = () => {
    if (!seed.trim()) return
    const q = seed.trim()
    setSeed('')
    refine(`The person running this search thinks ${q} belongs on this list. Check whether ${q} genuinely specialises in this function, industry and seniority. If it does, include it and find more firms like it. If it does not, leave it out — do not include it just because it was named.`, 'append', 'seed')
  }

  // One bag for every tool's fields. Switching tools keeps what was typed, so a
  // role title entered for recruiters is still there for target companies.
  const [f, setF] = useState({
    roleTitle: '', industry: '', geo: '', sector: '', city: '', country: 'United States',
    remote: 'Open to remote', lane: 'Industry Insider', draw: '', knownFor: '',
    constraints: '', background: '',
    companyName: '', companyIndustry: '', companyAsk: '',
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const working = busy || refining || writing
  const band = inferBand ? inferBand(f.roleTitle) : ''
  const mentioned = bandsMentioned(f.roleTitle)

  const ready = tool === 'recruiters'
    ? f.roleTitle.trim() && f.industry.trim()
    : tool === 'company'
      ? f.companyName.trim()
      : f.roleTitle.trim() && (f.city.trim() || f.remote)

  const run = async () => {
    setBusy(true); setErr(null); setOut(null); setCopied(false); setActing('run'); setStatus('Starting…')
    try {
      const result = await onRun(tool, f, setStatus)
      setOut(result)
      setNote('')
      setOutreach('')
    } catch (e) {
      setErr((e && e.message) || 'That did not come back. Try again in a moment.')
    }
    setBusy(false); setActing(''); setStatus('')
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


  // Iterate rather than start over. The recruiter prompt takes the note as a
  // focus AND skips the firms already shown; the company prompt rebuilds the list
  // against the note and keeps the rest of the result. Both were already capable
  // of this — the desk simply was not asking.
  const refine = async (explicitNote, mode, who) => {
    const useNote = (typeof explicitNote === 'string' && explicitNote) ? explicitNote : note
    if (!useNote.trim() || !out) return
    setRefining(true); setErr(null); setCopied(false); setActing(who || 'refine'); setStatus('Starting…')
    try {
      const result = await onRefine(tool, f, useNote, out, mode || 'replace', setStatus)
      setOut(result)
      setNote('')
    } catch (e) {
      setErr((e && e.message) || 'That redo did not come back. Try rephrasing what is off.')
    }
    setRefining(false); setActing(''); setStatus('')
  }

  // One reusable note the person edits per firm, not one per contact. It ships
  // in the playbook's recruiter card and had no route into the desk.
  const writeOutreach = async () => {
    setWriting(true); setErr(null); setActing('outreach'); setStatus('Starting…')
    try {
      setOutreach(await onOutreach(f, out, setStatus))
    } catch (e) {
      setErr((e && e.message) || 'The note did not come back. Try again.')
    }
    setWriting(false); setActing(''); setStatus('')
  }

  if (access !== 'ok') return null

  return (
    <div style={S.page}>
      {/* Inline because there is no CSS framework here. Reduced motion stops the
          pulse and leaves a solid dot, so the cue survives without the movement. */}
      <style>{`@keyframes deskPulse{0%,100%{opacity:.25}50%{opacity:1}}
@media (prefers-reduced-motion: reduce){[data-desk-spinner]{animation:none!important;opacity:1!important}}`}</style>
      <h1 style={S.h1}>Reimagine Backdoor</h1>
      <p style={S.sub}>
        Reimagine's research, run on what you type instead of on someone's profile — for people who are not users.
      </p>

      <div style={S.note}>
        <strong>Nothing here is saved.</strong> The person you are researching never signed up, so there is no
        account to attach their details to. What you type lives on this screen and is gone when you reload it,
        and none of it reaches your own profile.
      </div>

      {working ? (
        <div style={S.working} role="status" aria-live="polite">
          <span style={S.spinner} data-desk-spinner aria-hidden="true" />
          <span>{status || 'Working…'}</span>
        </div>
      ) : null}

      <div style={S.tabs}>
        <button style={S.tab(tool === 'recruiters')} onClick={() => { setTool('recruiters'); setOut(null); setErr(null) }}>Executive Recruiters</button>
        <button style={S.tab(tool === 'companies')} onClick={() => { setTool('companies'); setOut(null); setErr(null) }}>Target Companies</button>
        <button style={S.tab(tool === 'company')} onClick={() => { setTool('company'); setOut(null); setErr(null) }}>Company Read</button>
      </div>

      <div style={S.panel}>
        {tool === 'company' ? (
          <>
            <div style={S.row}>
              <div style={S.half}>
                <Field label="Company">
                  <input style={S.inp} value={f.companyName} onChange={e => set('companyName', e.target.value)} placeholder="Whatnot" />
                </Field>
              </div>
              <div style={S.half}>
                <Field label="Industry" hint="Picks which rubric the read is judged against.">
                  <input style={S.inp} value={f.companyIndustry} onChange={e => set('companyIndustry', e.target.value)} placeholder="Secondhand and resale marketplaces" />
                </Field>
              </div>
            </div>
            <Field label="What do you want to know?" hint="Optional. Leave blank for the standard read.">
              <textarea style={S.ta} value={f.companyAsk} onChange={e => set('companyAsk', e.target.value)} placeholder="How stable are they, and who owns the growth number?" />
            </Field>
            <Field label="Who is this for?" hint="Optional. Supply a person and the read covers fit; leave it blank and it stays a cold read on the company and says what it would need to judge fit.">
              <textarea style={S.ta} value={f.knownFor} onChange={e => set('knownFor', e.target.value)} placeholder="Retail sales and sales management, ten years running his own online vintage business." />
            </Field>
          </>
        ) : tool === 'recruiters' ? (
          <>
            <Field label="Role title" hint="One level per run. The search goes out for a single seniority band, read from this title.">
              <input style={S.inp} value={f.roleTitle} onChange={e => set('roleTitle', e.target.value)} placeholder="VP of Marketing" />
              {f.roleTitle.trim() ? (
                <div style={mentioned.length > 1 ? S.bandWarn : S.bandOk}>
                  Searching <strong>{band}</strong> level.
                  {mentioned.length > 1
                    ? ` This title also names ${mentioned.filter(b => b !== band).join(' and ')} — those are not included. Run them as separate searches to cover both.`
                    : ''}
                </div>
              ) : null}
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
            <div style={{ display: 'flex', gap: 8 }}>
              {/* The recruiter shortlist already had a CSV export in the Focus
                  Playbook; the desk just was not offering it. Copy keeps the
                  links live in a rich target (Gmail, Docs); the CSV keeps them
                  as their own column, which survives anywhere. */}
              {tool === 'recruiters' && Array.isArray(out.matches) && out.matches.length
                ? <button style={S.small} onClick={() => onExportCsv(out.matches, f.roleTitle || 'recruiters')}>Download CSV</button>
                : null}
              {tool === 'companies' && Array.isArray(out.part_2_company_list) && out.part_2_company_list.length
                ? <button style={S.small} onClick={() => onExportCompaniesCsv(out.part_2_company_list, f.roleTitle || 'companies')}>Download CSV</button>
                : null}
              <button style={S.small} onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
          </div>
          {tool === 'recruiters' ? <SearchSummary data={out} f={f} band={band} /> : null}
          <div ref={outRef} style={refining ? S.stale : undefined}>
            {tool === 'recruiters'
              ? <Recruiters data={out} onMoreLikeThis={moreLikeThis} busy={refining} acting={acting} />
              : tool === 'company'
                ? <CompanyRead data={out} />
                : <Companies data={out} />}
            {outreach ? (
              <div style={S.card}>
                <p style={S.cardName}>Outreach note</p>
                <p style={{ ...S.body, whiteSpace: 'pre-wrap' }}>{outreach}</p>
              </div>
            ) : null}
          </div>
          {tool === 'recruiters' && !outreach ? (
            <button style={{ ...S.small, marginTop: 12 }} disabled={writing} onClick={writeOutreach}>
              {writing ? 'Writing…' : 'Write an outreach note for these firms'}
            </button>
          ) : null}
          {tool === 'companies' ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button style={S.small} disabled={refining} onClick={() => refine('Find additional companies that fit the same target. Do not repeat any already listed.', 'append', 'more')}>{acting === 'more' ? 'Finding…' : 'Find more companies'}</button>
              <button style={S.small} disabled={refining} onClick={() => refine('Redo the hiring-executive read for this target.', 'part1', 'part1')}>{acting === 'part1' ? 'Redoing…' : 'Redo the hiring-executive read'}</button>
              <button style={S.small} disabled={refining} onClick={() => refine('Rewrite the outreach template for this target.', 'part3', 'part3')}>{acting === 'part3' ? 'Rewriting…' : 'Rewrite the outreach'}</button>
            </div>
          ) : null}
          {tool === 'recruiters' ? (
            <div style={S.refine}>
              <label style={S.label}>Missing something obvious?</label>
              <div style={S.hint}>Name a firm you expected to see. It gets checked against this exact target, and if it fits, more like it are added.</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input style={{ ...S.inp, flex: '1 1 260px' }} value={seed} onChange={e => setSeed(e.target.value)} placeholder="O'Connell Group" />
                <button style={S.run(refining || !seed.trim())} disabled={refining || !seed.trim()} onClick={askAboutFirm}>{acting === 'seed' ? 'Checking…' : 'Check it and find more'}</button>
              </div>
            </div>
          ) : null}
          <div style={S.refine}>
            <label style={S.label}>Refine this</label>
            <div style={S.hint}>
              {tool === 'recruiters'
                ? 'Say what is off or what you want more of. It runs again with that in mind and skips the firms above.'
                : 'Say what is off or what you want more of. It rebuilds the company list against your note and keeps the rest.'}
            </div>
            <textarea
              style={S.ta}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={tool === 'recruiters'
                ? 'More boutiques, fewer of the big generalists. Midwest-based where possible.'
                : 'Too many enterprise names — lean smaller and founder-led.'}
            />
            <button style={S.run(refining || !note.trim())} disabled={refining || !note.trim()} onClick={refine}>
              {acting === 'refine' ? 'Redoing…' : 'Run it again with this'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// What the search actually went out as. The levers are all here, so a short list
// reads as a set of choices rather than a black box: narrow the title, drop the
// industry to something broader, clear the geography, or name a firm below.
function SearchSummary({ data, f, band }) {
  const echo = data && data.criteriaEcho
  const returned = data && typeof data.returned === 'number' ? data.returned : null
  const kept = (data && Array.isArray(data.matches)) ? data.matches.length : 0
  const dropped = returned !== null ? returned - kept : 0
  return (
    <div style={S.summary}>
      <div><strong>Searched:</strong> {[f.roleTitle && `${f.roleTitle} (${band} level)`, f.industry, f.geo].filter(Boolean).join(' · ')}</div>
      {echo ? <div style={{ marginTop: 4 }}><strong>Read as:</strong> {echo}</div> : null}
      {returned !== null ? (
        <div style={{ marginTop: 4 }}>
          <strong>{kept}</strong> shown{dropped > 0 ? `, ${dropped} dropped for having no citable source` : ''}. The ceiling is 10, and a short list is on purpose — it is told not to pad.
        </div>
      ) : null}
    </div>
  )
}

function Recruiters({ data, onMoreLikeThis, busy, acting }) {
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
          {/* A live search is opportunistic and deliberately narrow — same function
              AND same seniority, never a guess — so most rows will not have one.
              Silence made "none found" indistinguishable from "not looked for",
              so absence is stated. Green badge matches the user-facing card. */}
          {m.openSearchSignal && m.openSearchSignal.description ? (
            <div style={S.openHit}>
              <span style={S.openBadge}>{m.kind === 'practice' ? 'This practice is running a search that fits right now' : 'This firm has a relevant search open right now'}</span>
              {m.openSearchSignal.sourceUrl
                ? <a href={m.openSearchSignal.sourceUrl} target="_blank" rel="noopener noreferrer" style={S.openLink}>{m.openSearchSignal.description}</a>
                : <span style={S.openLink}>{m.openSearchSignal.description}</span>}
            </div>
          ) : (
            <p style={S.openNone}>No live search found for this function at this level.</p>
          )}
          <p style={{ margin: 0 }}>
            {dedupeLinks([['Firm', m.url], ['Practice', m.practiceUrl], ['Profile', m.leaderProfileUrl], ['Source', m.sourceUrl]])
              .map(([label, u], k) => <a key={k} href={u} target="_blank" rel="noopener noreferrer" style={{ ...S.link, marginRight: 12 }}>{label}</a>)}
          </p>
          <button style={{ ...S.small, marginTop: 10 }} disabled={busy} onClick={() => onMoreLikeThis(m)}>
            {acting === 'more:' + m.firm ? 'Finding…' : 'More firms like this'}
          </button>
        </div>
      ))}
    </>
  )
}

// companyRead returns prose, not JSON. Rendered through the same markdown-ish
// treatment the rest of the desk uses for free text.
function CompanyRead({ data }) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  if (!text.trim()) return <p style={S.body}>Nothing came back. Try again, or add the industry so the read has a rubric to work against.</p>
  return <p style={{ ...S.body, whiteSpace: 'pre-wrap' }}>{text}</p>
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
