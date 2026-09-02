// The Making Your Own Weather staircase, drawn as the person's own position.
//
// This is Bob's Career Club Corner slide, not a new metaphor. A few thousand job
// seekers have seen it on the Monday call, and the recognition is the point: the
// product should read as the continuation of that room rather than another tool.
// The five sections, their bullets and their order are his, verbatim.
//
// What the product adds is that the arrow is THIS person's. On Monday it points
// where the class is; here it points where they actually are, computed from what
// they have built (src/step-position.js).
//
// Three rules that are not negotiable:
//
//  - NO PERCENTAGE, no progress bar, no estimate of how close an offer is.
//    Nobody knows how far away the offer is, a bar stuck at 60% for six weeks is
//    a daily reminder of being stuck, and it is a promise the product cannot
//    keep. The stairs show preparation completed, which is honestly knowable,
//    and say nothing about proximity to a job.
//  - ATTITUDE CARRIES NO COMPLETION CHECK. It is step one and it is also the
//    keel under all five: "not just the starting point... what you carry with
//    you for the entire journey." Nobody finishes it.
//  - STEPS AHEAD STAY QUIET. The climb has a visible top so the dark has a
//    shape, and nobody is asked to look at it today.
import React from 'react'
import { Check } from 'lucide-react'
import { useIsMobile } from '../use-is-mobile.js'

// Bob's slide, word for word.
const SECTIONS = [
  { n: 1, name: 'Attitude',       items: ['KEEL', 'Resilience'] },
  { n: 2, name: 'Personal Brand', items: ['4 C’s', 'Tell Me About Yourself'] },
  { n: 3, name: 'Outreach',       items: ['Networking', 'Direct Contact'] },
  { n: 4, name: 'Interviewing',   items: ['STAR Stories', 'Remixing'] },
  { n: 5, name: 'Negotiating',    items: ['BATNA'] },
]

export default function Staircase({ step, keelLetter, keelGloss, stalled, C }) {
  const isMobile = useIsMobile()
  const here = Number(step) || 2

  // Bottom to top on a narrow screen, so the climb reads the way the staircase
  // does and the ground already covered sits under the person's feet rather than
  // scrolled past. A wide screen keeps the slide's left-to-right ascent.
  const order = isMobile ? [...SECTIONS].reverse() : SECTIONS

  return (
    <div data-print="hide" style={{ margin: '0 0 22px' }}>
      <div style={{
        display: isMobile ? 'flex' : 'grid',
        flexDirection: isMobile ? 'column' : undefined,
        gridTemplateColumns: isMobile ? undefined : 'repeat(5, minmax(0, 1fr))',
        gap: isMobile ? 6 : 0,
        alignItems: 'stretch',
      }}>
        {order.map(sec => {
          const isHere = sec.n === here
          // Attitude never carries a check: see the header. Everything else
          // behind the arrow is ground this person actually covered.
          const done = sec.n < here && sec.n !== 1
          const ahead = sec.n > here
          const bar = isHere ? C.gold : done ? C.gold : `${C.gray}30`
          return (
            <div key={sec.n} style={{
              display: 'flex', flexDirection: 'column', minWidth: 0,
              // The ascent. Each step sits higher than the one before it, which
              // is what makes it a staircase rather than a row of boxes.
              paddingTop: isMobile ? 0 : (5 - sec.n) * 34,
              background: isHere ? `${C.gold}0F` : 'transparent',
              borderRadius: 10,
              padding: isMobile ? '10px 12px' : undefined,
              border: isMobile && isHere ? `1px solid ${C.gold}` : isMobile ? `1px solid ${C.border}` : undefined,
            }}>
              <div style={{ height: 6, background: bar, borderRadius: isMobile ? 3 : '4px 4px 0 0', marginBottom: 10 }}/>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: isMobile ? 0 : '0 12px' }}>
                <div style={{
                  fontFamily: 'Georgia,serif', fontSize: isMobile ? 18 : 19, fontWeight: 700,
                  color: ahead ? C.gray : C.goldL, lineHeight: 1.25,
                }}>{sec.name}</div>
                {done && <Check size={15} color={C.gold} aria-label="built"/>}
              </div>
              <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: isMobile ? 0 : '0 12px' }}>
                {sec.items.map(it => (
                  <li key={it} style={{ fontSize: 15, color: ahead ? C.gray : C.grayL, lineHeight: 1.5 }}>&bull; {it}</li>
                ))}
              </ul>
              {sec.n === 1 && (
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '1px', color: C.goldL, margin: '8px 0 0', padding: isMobile ? 0 : '0 12px' }}>
                  NEVER FINISHED
                </div>
              )}
              {isHere && (
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '1.4px', color: C.goldL, margin: '10px 0 0', padding: isMobile ? 0 : '0 12px' }}>
                  YOU ARE HERE
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* The keel, drawn where Part One of the book says it belongs: under the
          whole thing, not as a stage anyone stands on. When the search has gone
          quiet this band is what comes forward — the arrow keeps its stair. */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap',
        background: `${C.gold}12`, borderLeft: `3px solid ${C.gold}`, borderRadius: 8,
        padding: '12px 16px', marginTop: 14,
      }}>
        <span style={{ fontFamily: 'Georgia,serif', fontSize: 19, fontWeight: 700, color: C.goldL, letterSpacing: '3px' }}>KEEL</span>
        <span style={{ fontSize: 16, color: C.grayL, lineHeight: 1.55 }}>
          The keel that runs under the entire journey.
          {keelLetter ? <> Right now: <strong style={{ color: C.cream }}>{keelLetter} &mdash; {keelGloss}</strong>.</> : null}
          {stalled ? ' The stairs hold; this is the part that carries a quiet stretch.' : ''}
        </span>
      </div>
    </div>
  )
}
