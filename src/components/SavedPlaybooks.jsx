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

import { RotateCcw, Trash2, Briefcase } from 'lucide-react'

const LANE_LABEL_MAP = {
  familiar: 'Familiar Ground',
  insider: 'Industry Insider',
  wtm: 'Work That Matters',
  specific: 'Specific Role',
}

// p10 is the retired Interview Prep stub per CLAUDE.md and never generates
// content. Excluding it from the dashboard denominator so a fully-built
// playbook reads "8 of 8" instead of "8 of 9". App.jsx ROLE_SUBMODULES
// intentionally keeps p10 for legacy data shape; that inclusion is harmless
// because each record's p10 is an empty string.
const ROLE_OUTPUT_KEYS = ['p5','p6','p7','p8','p9','p11','p_res','income']

function sectionsBuilt(rec) {
  if (rec.source === 'door2') {
    const op = rec.outputs && rec.outputs.op
    return { built: op && op.length > 0 ? 1 : 0, total: 1 }
  }
  const built = ROLE_OUTPUT_KEYS.reduce((n, k) => {
    const v = rec.outputs && rec.outputs[k]
    return n + (v && (typeof v === 'string' ? v.length > 0 : true) ? 1 : 0)
  }, 0)
  return { built, total: ROLE_OUTPUT_KEYS.length }
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
        fontSize: 12, fontWeight: 600,
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
      fontSize: 12, fontWeight: 600,
      padding: '4px 10px', borderRadius: 6,
      letterSpacing: 0.2,
    }}>
      {LANE_LABEL_MAP[lane] || 'Saved'}
    </span>
  )
}

function PlaybookCard({ rec, onRestore, onDelete, C }) {
  const { built, total } = sectionsBuilt(rec)
  const door2 = rec.source === 'door2'
  const borderColor = door2 ? '#2A3F6055' : C.border
  const handleDelete = () => {
    if (typeof window !== 'undefined' && window.confirm(`Remove "${rec.title}" from Your playbooks?`)) {
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
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1A2540', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis' }}>{rec.title}</div>
          <SourceBadge source={rec.source} lane={rec.lane} C={C}/>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 14, color: C.gray }}>
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
        <button
          onClick={handleDelete}
          aria-label={`Remove ${rec.title} from Your playbooks`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'transparent', color: C.gray, border: `1px solid ${C.border}`,
            padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
            fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
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

function Section({ heading, records, addLabel, onAdd, emptyCopy, onRestore, onDelete, C }) {
  const showAdd = typeof onAdd === 'function'
  // Complete-page recap (no add handler) omits empty sections; the dashboard
  // (add handler present) shows the empty state with its add affordance.
  if (!showAdd && records.length === 0) return null
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '0 0 14px', flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 700, color: '#1A2540', margin: 0 }}>{heading}</h2>
        {showAdd && <AddButton label={addLabel} onClick={onAdd} C={C}/>}
      </div>
      {records.length > 0
        ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {records.map(rec => (
              <PlaybookCard key={rec.id} rec={rec} onRestore={onRestore} onDelete={onDelete} C={C}/>
            ))}
          </div>
        )
        : (
          <div style={{ background: '#FFFFFF', border: `1.5px solid ${C.border}`, borderRadius: 14, padding: '22px 26px', color: C.grayL, fontSize: 16, lineHeight: 1.6 }}>{emptyCopy}</div>
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
export default function SavedPlaybooks({ savedPlaybooks, onRestore, onDelete, C, layout = 'complete', title, onAddDirection, onAddOpportunity }) {
  const focus = (savedPlaybooks || []).filter(r => r && r.source !== 'door2')
  const opp = (savedPlaybooks || []).filter(r => r && r.source === 'door2')
  if (focus.length === 0 && opp.length === 0 && !onAddDirection && !onAddOpportunity) return null
  const suppressHeading = title === null
  return (
    <div style={{ marginTop: suppressHeading ? 18 : 36 }}>
      {!suppressHeading && title && (
        <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 700, color: '#1A2540', margin: '0 0 14px' }}>{title}</h2>
      )}
      <Section
        heading="Focus Playbooks"
        records={focus}
        addLabel="Start a new direction"
        onAdd={onAddDirection}
        emptyCopy="No Focus Playbooks yet. Explore directions across Familiar Ground, Industry Insider, and Work That Matters."
        onRestore={onRestore} onDelete={onDelete} C={C}/>
      <Section
        heading="Opportunity Playbooks"
        records={opp}
        addLabel="Add an Opportunity"
        onAdd={onAddOpportunity}
        emptyCopy="No Opportunity Playbooks yet. Bring a job description and Reimagine builds a playbook tuned to that exact role."
        onRestore={onRestore} onDelete={onDelete} C={C}/>
    </div>
  )
}
