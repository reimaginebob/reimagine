// SavedPlaybooks
//
// List of the user's saved playbooks. Two entry sources coexist in the same
// set: Door 1 (explicit Save to Your playbooks from the Focus page) and Door 2
// (auto-save on JD upload). The component renders nothing when the set is
// empty (no empty stub on Wide View). On the Wide View, this component is
// the fourth row after the three lane cards. PR2 introduces the Complete-page
// surface with a grid layout; PR1 only uses the wideView layout.
//
// Props:
//   savedPlaybooks  array of records (id, title, lane, source, createdAt,
//                   updatedAt, outputs, done, feedback, upstream, jd?)
//   onRestore       fn(rec) — atomic restore into live state
//   onDelete        fn(id) — remove from the saved set (component confirms first)
//   C               color tokens from App.jsx
//   layout          'wideView' | 'complete' (PR1 only uses 'wideView')
//   title           optional section heading override
//
// Voice rules: all visible copy below passes the voice gate (no em dashes,
// no logic-flip cadence, no banned AI-coach phrases, no typology labels).

import { useState } from 'react'
import { RotateCcw, Trash2, Briefcase, Pencil, Download } from 'lucide-react'

// Deliberate duplicate of LANE_LABELS in src/nav-labels.js. Keep the two in
// step: a lane missing here renders the card badge as "Saved", which reads as a
// bug rather than a label.
const LANE_LABEL_MAP = {
  familiar: 'Familiar Ground',
  insider: 'Industry Insider',
  wtm: 'Work That Matters',
  specific: 'Specific Role',
  independent: 'Your Practice',
}

// Focus titles nearly all open with a seniority/rank clause ("VP of", "Senior
// Director of", "Head of", ...). That lead-in is the least distinguishing part;
// muting it lets the function/sector tail — what actually tells two roles apart
// — carry the card. Applied to Door 1 (Focus) titles only; Door 2 (Opportunity)
// titles front-load the company, so they render whole. No match => title
// renders unchanged, so an unusual title is never mangled, only ever un-muted.
const FOCUS_TITLE_LEAD = /^(?:E?S?VP|Vice President|Senior Director|Executive Director|Managing Director|Director|Senior Manager|Manager|Global Head|Head|President|Chief [A-Za-z]+(?: [A-Za-z]+)? Officer|CEO|CFO|COO|CTO|CHRO|CPO|CMO|CIO)(?:\s+of)?[,:\s]+/i
function splitFocusTitle(title) {
  if (!title) return [null, title || '']
  const m = title.match(FOCUS_TITLE_LEAD)
  if (!m || m[0].length >= title.length) return [null, title]
  return [title.slice(0, m[0].length), title.slice(m[0].length)]
}

// p10 is the retired Interview Prep stub per CLAUDE.md and never generates
// content. Excluding it from the dashboard denominator so a fully-built
// playbook reads "8 of 8" instead of "8 of 9". App.jsx ROLE_SUBMODULES
// intentionally keeps p10 for legacy data shape; that inclusion is harmless
// because each record's p10 is an empty string.
const ROLE_OUTPUT_KEYS = ['p5','p6','p7','p8','p9','p11','p_res','income']
// The practice track builds six of those eight. The Role (p5) reads a job
// description against a candidate and Industry Background (p9) teaches the
// language of a sector you are entering; neither has a job to do for someone
// selling their own services, so neither is offered. Counted against all eight,
// a finished practice plan read "6 of 8" and could never reach the end.
const PRACTICE_OUTPUT_KEYS = ['p6','p7','p8','p11','p_res','income']

function sectionsBuilt(rec) {
  // Read the track off the record rather than threading a prop down two levels.
  // The card already renders this lane as its badge ("Your Practice"), so the
  // information is here -- and per-record is more correct than per-session: a
  // record counted right today stays counted right whoever opens it later.
  const independent = !!(rec && rec.lane === 'independent')
  if (rec.source === 'door2') {
    // v2 records (cards-only architecture): count built per-card sections. Six
    // counted cards, matching OP_COUNTED_KEYS in App.jsx (companyRead, p5, p6,
    // p_res, p_cover, p11); Interview Team is un-numbered and excluded. (Older
    // records simply have the new cards unbuilt.)
    if (rec.schemaVersion === 2 && rec.sections) {
      const sec = rec.sections
      const done = k => !!(sec[k] && sec[k].content && sec[k].content.trim())
      const p6  = !!(sec.p6  && (typeof sec.p6 === 'string' ? sec.p6.trim() : (sec.p6.content?.trim() || sec.p6.bridge_story)))
      const built = [done('companyRead'), done('p5'), p6, done('p_res'), done('p_cover'), done('p11')].filter(Boolean).length
      return { built, total: 6 }
    }
    // Legacy v1 fallback: preserve the original 1-of-1 formula so older records
    // (created before the cards-only architecture) read sensibly in the dashboard.
    const op = rec.outputs && rec.outputs.op
    return { built: op && op.length > 0 ? 1 : 0, total: 1 }
  }
  const keys = independent ? PRACTICE_OUTPUT_KEYS : ROLE_OUTPUT_KEYS
  const built = keys.reduce((n, k) => {
    const v = rec.outputs && rec.outputs[k]
    return n + (v && (typeof v === 'string' ? v.length > 0 : true) ? 1 : 0)
  }, 0)
  return { built, total: keys.length }
}

function relativeTime(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (!t) return ''
  const diff = Date.now() - t
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return min === 1 ? '1 minute ago' : `${min} minutes ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return hr === 1 ? '1 hour ago' : `${hr} hours ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return day === 1 ? '1 day ago' : `${day} days ago`
  const month = Math.floor(day / 30)
  if (month < 12) return month === 1 ? '1 month ago' : `${month} months ago`
  const year = Math.floor(day / 365)
  return year === 1 ? '1 year ago' : `${year} years ago`
}

function SourceBadge({ source, lane, C }) {
  if (source === 'door2') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: '#2A3F60', color: '#FFFFFF',
        fontSize: 15, fontWeight: 600,
        padding: '4px 10px', borderRadius: 6,
        letterSpacing: 0.2,
      }}>
        <Briefcase size={12}/>Opportunity
      </span>
    )
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: `${C.gold}18`, color: C.goldL,
      fontSize: 15, fontWeight: 600,
      padding: '4px 10px', borderRadius: 6,
      letterSpacing: 0.2,
    }}>
      {LANE_LABEL_MAP[lane] || 'Saved'}
    </span>
  )
}

function PlaybookCard({ rec, onRestore, onDelete, onRename, onDownload, C }) {
  const { built, total } = sectionsBuilt(rec)
  const door2 = rec.source === 'door2'
  const [titleLead, titleRest] = door2 ? [null, rec.title] : splitFocusTitle(rec.title)
  const borderColor = door2 ? '#2A3F6055' : C.border
  const canRename = typeof onRename === 'function'
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(rec.title)
  const [titleHover, setTitleHover] = useState(false)
  const startEdit = () => { setDraft(rec.title); setEditing(true) }
  const commitEdit = () => {
    setEditing(false)
    const t = draft.trim()
    if (t && t !== rec.title) onRename(rec.id, t)
  }
  const cancelEdit = () => { setDraft(rec.title); setEditing(false) }
  const handleDelete = () => {
    if (typeof window !== 'undefined' && window.confirm(`Remove "${rec.title}"? It moves to Archived — you can restore it any time within 90 days.`)) {
      onDelete(rec.id)
    }
  }
  return (
    <div style={{
      background: '#FFFFFF',
      border: `1.5px solid ${borderColor}`,
      borderLeft: door2 ? `4px solid #2A3F60` : `1.5px solid ${borderColor}`,
      borderRadius: 14,
      padding: '22px 26px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing && canRename ? (
            <input
              value={draft}
              autoFocus
              maxLength={120}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitEdit() } else if (e.key === 'Escape') { cancelEdit() } }}
              aria-label="Playbook title"
              style={{ width: '100%', fontSize: 20, fontWeight: 700, color: '#1A2540', marginBottom: 8, fontFamily: 'inherit', border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 8px', boxSizing: 'border-box' }}
            />
          ) : (
            <div
              onClick={canRename ? startEdit : undefined}
              onMouseEnter={canRename ? () => setTitleHover(true) : undefined}
              onMouseLeave={canRename ? () => setTitleHover(false) : undefined}
              title={canRename ? 'Rename' : undefined}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 8, cursor: canRename ? 'pointer' : 'default' }}
            >
              <span
                title={rec.title}
                style={{
                  flex: 1, minWidth: 0,
                  fontSize: 20, fontWeight: 700, color: '#1A2540', lineHeight: 1.3,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  minHeight: '2.6em',
                  textDecoration: canRename && titleHover ? 'underline' : 'none',
                  textDecorationColor: C.gold, textUnderlineOffset: 3,
                }}>
                {titleLead ? <><span style={{ color: '#8592A6' }}>{titleLead}</span>{titleRest}</> : rec.title}
              </span>
              {canRename && (
                <Pencil size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 3, color: titleHover ? C.gold : '#9AA6B8', opacity: titleHover ? 1 : 0.75, transition: 'color 0.12s, opacity 0.12s' }}/>
              )}
            </div>
          )}
          <SourceBadge source={rec.source} lane={rec.lane} C={C}/>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 15, color: C.gray }}>
        <div>{built} of {total} {total === 1 ? 'section' : 'sections'} built</div>
        {rec.updatedAt ? <div>· {relativeTime(rec.updatedAt)}</div> : null}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
        <button
          onClick={() => onRestore(rec)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: C.gold, color: '#FFFFFF', border: 'none',
            padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
            fontSize: 15, fontWeight: 600, fontFamily: 'inherit',
          }}>
          <RotateCcw size={14}/>Open
        </button>
        {onDownload && (
          <button
            onClick={() => onDownload(rec)}
            aria-label={`Download ${rec.title} as a Markdown file`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'transparent', color: C.gray, border: `1px solid ${C.border}`,
              padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
              fontSize: 15, fontWeight: 500, fontFamily: 'inherit',
            }}>
            <Download size={13}/>Markdown
          </button>
        )}
        <button
          onClick={handleDelete}
          aria-label={`Remove ${rec.title} from Your playbooks`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'transparent', color: C.gray, border: `1px solid ${C.border}`,
            padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
            fontSize: 15, fontWeight: 500, fontFamily: 'inherit',
          }}>
          <Trash2 size={13}/>Remove
        </button>
      </div>
    </div>
  )
}

function AddButton({ label, onClick, C }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: C.gold, color: '#FFFFFF', border: 'none',
      padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
      fontSize: 15, fontWeight: 600, fontFamily: 'inherit',
    }}>{label}</button>
  )
}

// Where the opportunities went. My Pipeline took ownership of the Opportunity
// records on 2026-08-30, and this page stopped listing them — but it kept
// counting them in its header, so someone whose saved set is all opportunities
// (common: Door 2 is the recommended first move) read "5 of 10 saved" above an
// empty shelf and concluded their work was gone. At least one did, and rebuilt
// the same playbook three times in an evening. The count is gone from the
// header and this says where the work is instead. Renders only when the person
// actually has opportunities, so it never advertises a screen with nothing on it.
function MovedToPipeline({ count, onGo, C, independent }) {
  if (!count || typeof onGo !== 'function') return null
  return (
    <div style={{
      background: `${C.gold}10`, borderLeft: `3px solid ${C.gold}`, borderRadius: 8,
      padding: '16px 18px', marginBottom: 24,
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#1A2540', marginBottom: 6 }}>
        Your {count === 1 ? 'opportunity is' : 'opportunities are'} in My Pipeline
      </div>
      <div style={{ fontSize: 16, color: C.grayL, lineHeight: 1.6, marginBottom: 12 }}>
        {count === 1 ? 'The opportunity you added lives' : `The ${count} opportunities you have added live`} on My Pipeline, with where each one stands, when you next talk, and what you are doing next. {independent ? 'This page holds your practice plan.' : 'This page holds the directions you explore from Career Paths.'}
      </div>
      <button type="button" onClick={onGo} style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: C.gold, color: '#FFFFFF', border: 'none',
        padding: '10px 18px', borderRadius: 8, cursor: 'pointer',
        fontSize: 16, fontWeight: 600, fontFamily: 'inherit',
      }}>Go to My Pipeline</button>
    </div>
  )
}

function Section({ heading, records, addLabel, onAdd, emptyCopy, onRestore, onDelete, onRename, onDownload, C, hideHeading }) {
  const showAdd = typeof onAdd === 'function'
  // Complete-page recap (no add handler) omits empty sections; the dashboard
  // (add handler present) shows the empty state with its add affordance.
  if (!showAdd && records.length === 0) return null
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '0 0 14px', flexWrap: 'wrap' }}>
        {!hideHeading && <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 700, color: '#1A2540', margin: 0 }}>{heading}</h2>}
        {showAdd && <AddButton label={addLabel} onClick={onAdd} C={C}/>}
      </div>
      {records.length > 0
        ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {records.map(rec => (
              <PlaybookCard key={rec.id} rec={rec} onRestore={onRestore} onDelete={onDelete} onRename={onRename} onDownload={onDownload} C={C}/>
            ))}
          </div>
        )
        : (
          <div style={{ background: `${C.gold}10`, borderLeft: `3px solid ${C.gold}`, borderRadius: 8, padding: '14px 18px', color: C.grayL, fontSize: 16, lineHeight: 1.6 }}>{emptyCopy}</div>
        )}
    </div>
  )
}

// Two sections: Focus Playbooks (door1) and Opportunity Playbooks (door2).
// They are conceptually different artifacts users navigate differently, so the
// dashboard delineates them rather than mixing them in one flat grid. The add
// affordances (onAddDirection / onAddOpportunity) render per-section only when
// provided (the My Playbooks dashboard); the Complete-page recap omits them and
// hides empty sections. The split is a pure render-layer filter on rec.source;
// no schema change. The `layout` prop is retained for caller compatibility but
// the grid is now owned per-section (the legacy wideView path is vestigial).
export default function SavedPlaybooks({ savedPlaybooks, onRestore, onDelete, onRename, onDownload, C, layout = 'complete', title, onAddDirection, onAddOpportunity, focusOnly = false, independent = false, onGoToPipeline }) {
  const focus = (savedPlaybooks || []).filter(r => r && r.source !== 'door2')
  // focusOnly: My Pipeline owns the Opportunity records, so this component renders
  // Focus only and never shows a duplicate Opportunity section (gated to flagged
  // users at the call site; default path is unchanged).
  const door2 = (savedPlaybooks || []).filter(r => r && r.source === 'door2')
  const opp = focusOnly ? [] : door2
  const movedCount = focusOnly ? door2.length : 0
  if (focus.length === 0 && opp.length === 0 && !movedCount && !onAddDirection && !(focusOnly ? false : onAddOpportunity)) return null
  const suppressHeading = title === null
  return (
    <div style={{ marginTop: suppressHeading ? 18 : 36 }}>
      {!suppressHeading && title && (
        <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 700, color: '#1A2540', margin: '0 0 14px' }}>{title}</h2>
      )}
      <MovedToPipeline count={movedCount} onGo={onGoToPipeline} C={C} independent={independent}/>
      {/* On the practice track this section holds exactly one record, the
          practice plan, and it is built once. "Explore More Roles" called
          startNewDirection, which sets the step to laneSelect -- the Career
          Paths flow this track deliberately never runs. A door to a room that
          is not there. Closed, and the heading stops calling a practice a
          collection of roles. */}
      <Section
        heading={independent ? 'Your Practice' : 'Focus Playbooks'}
        hideHeading={focusOnly && suppressHeading}
        records={focus}
        addLabel="Explore More Roles"
        onAdd={independent ? undefined : onAddDirection}
        emptyCopy={independent ? 'Your practice plan will appear here once you have built it.' : 'No Focus Playbooks yet. Explore directions across Familiar Ground, Industry Insider, and Work That Matters.'}
        onRestore={onRestore} onDelete={onDelete} onRename={onRename} onDownload={onDownload} C={C}/>
      {!focusOnly && (
        <Section
          heading="Opportunity Playbooks"
          records={opp}
          addLabel="Add an Opportunity"
          onAdd={onAddOpportunity}
          emptyCopy="No Opportunity Playbooks yet. Bring a job description and Reimagine builds a playbook tuned to that exact role."
          onRestore={onRestore} onDelete={onDelete} onRename={onRename} onDownload={onDownload} C={C}/>
      )}
    </div>
  )
}
