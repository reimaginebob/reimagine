// PlaybookSectionRail
//
// Sticky vertical navigation rail for the Focus Playbook page. Lists each
// section in FOCUS_GROUPS / FOCUS_ORDER sequence, with a per-section number
// circle that fills with a check icon once the section is built. Click any
// row to scroll to that section's anchor; the parent owns the scroll
// behavior via the onJump callback.
//
// Props:
//   sections     array of {id, label, num, isBonus?} in display order
//   done         array of done step ids (App.jsx state)
//   onJump       fn(id) -> scrolls the page to that section's anchor
//   C            color tokens passed from App.jsx for visual consistency
//   title        optional opportunity/role name pinned at the top of the
//                rail so it stays visible as the body scrolls (falsy = no pin)
//   titleKicker  optional uppercase eyebrow above the title (e.g. "ROLE",
//                "OPPORTUNITY") giving the pinned name context
//
// Voice rules: all visible copy passes the voice gate (no em dashes, no
// banned constructions). The component is hidden from print via the
// data-print="hide" attribute carried by the wrapping div.

import { Check, Eye, MessageCircle } from 'lucide-react'

function Row({ section, isDone, onJump, C }) {
  const handleClick = () => { if (onJump) onJump(section.id) }
  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 10px',
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        fontSize: 15,
        color: isDone ? '#1A2540' : C.gray,
        fontWeight: isDone ? 600 : 500,
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = `${C.gold}14` }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        border: `1.5px solid ${isDone ? C.ok : C.border}`,
        background: isDone ? C.ok : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        fontSize: 15, fontWeight: 700,
        color: isDone ? '#FFFFFF' : C.gray,
      }}>
        {isDone ? <Check size={12} color="#FFFFFF" strokeWidth={3}/> : (section.num || '')}
      </div>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {section.label}
      </span>
    </button>
  )
}

export default function PlaybookSectionRail({ sections, done, onJump, C, title, titleKicker, onViewJd, onTalkToCoach, mobile = false }) {
  if (!sections || sections.length === 0) return null
  const isDoneFor = (id) => Array.isArray(done) && done.includes(id)
  // Split sections into the numbered playbook set and the Bonus set
  // (Income Now) so the rail can show a visual separator without imposing
  // structure inside the section data shape.
  const numbered = sections.filter(s => !s.isBonus)
  const bonus = sections.filter(s => s.isBonus)
  return (
    <nav
      data-print="hide"
      aria-label="Playbook sections"
      style={{
        position: mobile ? 'static' : 'sticky',
        top: 16,
        width: mobile ? '100%' : 200,
        flexShrink: 0,
        background: '#FFFFFF',
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '12px 8px',
        maxHeight: mobile ? 'none' : 'calc(100dvh - 80px)',
        overflowY: mobile ? 'visible' : 'auto',
      }}
    >
      {title && (
        <div style={{ padding: '2px 10px 12px', marginBottom: 10, borderBottom: `1px solid ${C.border}` }}>
          {titleKicker && (
            <div style={{
              fontSize: 15, fontWeight: 700, letterSpacing: '1.2px',
              textTransform: 'uppercase', color: C.gold, marginBottom: 4,
            }}>
              {titleKicker}
            </div>
          )}
          <div
            title={title}
            style={{
              fontFamily: 'Georgia,serif', fontSize: 16, fontWeight: 700,
              color: '#1A2540', lineHeight: 1.3,
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {title}
          </div>
          {/* Talk to My Coach. Sits directly under the opportunity's name, above
              the job-description link, because this is the thing a person reaches
              for most and the rail is the only block that stays on screen while
              they scroll the sections. It opens the Coach with NOTHING typed --
              the pre-filled "give me your read" prompt lives on the pipeline card
              and is a different job. The Coach already knows which opportunity is
              open, so a next move stated here lands on the right card without the
              person naming the company. */}
          {onTalkToCoach && (
            <button
              type="button"
              onClick={onTalkToCoach}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                width: '100%', boxSizing: 'border-box', marginTop: 12,
                padding: '9px 12px', background: 'transparent',
                border: `1px solid ${C.gold}`, borderRadius: 8,
                color: C.gold, fontFamily: 'inherit', fontSize: 16, fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <MessageCircle size={15}/> Talk to My Coach
            </button>
          )}
          {onViewJd && (
            <button
              type="button"
              onClick={onViewJd}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                marginTop: 8, padding: 0, background: 'transparent', border: 'none',
                color: C.gold, fontFamily: 'inherit', fontSize: 15, fontWeight: 600,
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <Eye size={13}/> View job description
            </button>
          )}
        </div>
      )}
      <div style={{
        fontSize: 15, fontWeight: 700, letterSpacing: '1.2px',
        textTransform: 'uppercase', color: C.gold,
        padding: '4px 10px 8px',
      }}>
        Sections
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {numbered.map(section => (
          <Row key={section.id} section={section} isDone={isDoneFor(section.id)} onJump={onJump} C={C}/>
        ))}
      </div>
      {bonus.length > 0 && (
        <>
          <div style={{
            fontSize: 15, fontWeight: 700, letterSpacing: '1.2px',
            textTransform: 'uppercase', color: C.goldL,
            padding: '14px 10px 6px',
            borderTop: `1px solid ${C.border}`,
            marginTop: 10,
          }}>
            Bonus
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {bonus.map(section => (
              <Row key={section.id} section={section} isDone={isDoneFor(section.id)} onJump={onJump} C={C}/>
            ))}
          </div>
        </>
      )}
    </nav>
  )
}
