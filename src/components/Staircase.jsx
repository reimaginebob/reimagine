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
import React, { useState } from 'react'
import { useIsMobile } from '../use-is-mobile.js'
import { KEEL_PRINCIPLES } from '../step-position.js'
import { STAIRCASE_EXPLAINERS } from '../data/staircase-explainers.js'
import StaircaseExplainer from './StaircaseExplainer.jsx'

// Bob's slide, word for word.
const SECTIONS = [
  { n: 1, name: 'Attitude',       items: ['KEEL', 'Resilience'] },
  { n: 2, name: 'Personal Brand', items: ['4 C’s', 'Tell Me About Yourself'] },
  { n: 3, name: 'Outreach',       items: ['Networking', 'Direct Contact'] },
  // Remixing IS SCOPE -- one lesson, and the acronym is named so someone who has
  // heard it on the Monday call recognises it here. The 5 Ps are Lesson 9B, the
  // human half of interviewing that no framework covers.
  { n: 4, name: 'Interviewing',   items: ['STAR Stories', 'Remixing (SCOPE)', 'The 5 P’s'] },
  { n: 5, name: 'Negotiating',    items: ['BATNA'] },
]

export default function Staircase({ step, keelLetter, keelGloss, stalled, positions = [], C, Btn, onGo, canGo }) {
  const isMobile = useIsMobile()
  // Which term's explainer is open. One at a time; null when none.
  const [openTerm, setOpenTerm] = useState(null)
  // A term is a control only where there is something behind it. A word that
  // looks tappable and does nothing is worse than a word that looks like a
  // word, and the whole point of the tap is that the term was unexplained.
  const explained = it => !!STAIRCASE_EXPLAINERS[it] && typeof Btn === 'function' && typeof onGo === 'function'
  const anyExplained = SECTIONS.some(sec => sec.items.some(explained))
  const here = Number(step) || 2
  // A search is several journeys at once, so the stairs hold the opportunities
  // rather than one arrow. Four markers at four heights is something the person
  // could not have told you at a glance; a single arrow was a restatement of
  // what they already knew.
  const byStep = new Map()
  for (const p of (Array.isArray(positions) ? positions : [])) {
    if (!p || !p.step) continue
    if (!byStep.has(p.step)) byStep.set(p.step, [])
    byStep.get(p.step).push(p)
  }

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
          // NO COMPLETION CHECKS. A tick behind the arrow claimed they had
          // finished a section, which is not something this can know: an offer
          // at one company put a check on Outreach while every other
          // opportunity was still in it. The stairs carry their work now, and
          // work is a fact where completion was a claim.
          const mine = byStep.get(sec.n) || []
          const behind = sec.n < here && sec.n !== 1
          const ahead = sec.n > here
          const bar = (isHere || behind || mine.length) ? C.gold : `${C.gray}30`
          return (
            <div key={sec.n} style={{
              display: 'flex', flexDirection: 'column', minWidth: 0,
              // The ascent. Each step sits higher than the one before it, which
              // is what makes it a staircase rather than a row of boxes.
              // THE ASCENT. React does not skip an undefined style value -- it
              // assigns the empty string, and `style.padding = ''` clears the
              // whole shorthand including padding-top. A `padding` key after
              // this one wiped the ascent every time and the five boxes sat
              // flat, so this was a row of cards rather than Bob's staircase.
              // Longhand on both branches; never reintroduce the shorthand here.
              paddingTop: isMobile ? 10 : (5 - sec.n) * 34,
              paddingBottom: isMobile ? 10 : 0,
              paddingLeft: isMobile ? 12 : 0,
              paddingRight: isMobile ? 12 : 0,
              background: isHere ? `${C.gold}0F` : 'transparent',
              borderRadius: 10,
              border: isMobile && isHere ? `1px solid ${C.gold}` : isMobile ? `1px solid ${C.border}` : undefined,
            }}>
              <div style={{ height: 6, background: bar, borderRadius: isMobile ? 3 : '4px 4px 0 0', marginBottom: 10 }}/>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: isMobile ? 0 : '0 12px' }}>
                <div style={{
                  fontFamily: 'Georgia,serif', fontSize: isMobile ? 18 : 19, fontWeight: 700,
                  color: ahead ? C.gray : C.goldL, lineHeight: 1.25,
                }}>{sec.name}</div>
              </div>
              {/* EVERY TERM EXPLAINS ITSELF. These are Bob's words from the
                  slide, and on the Monday call he says what each one means
                  before moving on. On screen they were nine unexplained pieces
                  of vocabulary, which reads as the product assuming a book the
                  person has not read. The dotted underline is the affordance;
                  16px because it is now something you press. */}
              <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: isMobile ? 0 : '0 12px' }}>
                {sec.items.map(it => (
                  <li key={it} style={{
                    fontSize: 16, color: ahead ? C.gray : C.grayL, lineHeight: 1.5,
                    display: 'flex', gap: 6, alignItems: 'baseline',
                  }}>
                    <span aria-hidden="true">&bull;</span>
                    {explained(it) ? (
                      <button
                        type="button"
                        onClick={() => setOpenTerm(it)}
                        aria-label={`What ${it} means`}
                        style={{
                          background: 'none', border: 'none', padding: 0, margin: 0,
                          font: 'inherit', fontSize: 16, color: 'inherit', textAlign: 'left',
                          cursor: 'pointer', lineHeight: 1.5,
                          textDecoration: 'underline dotted',
                          textDecorationColor: C.gold, textUnderlineOffset: 3,
                        }}
                      >{it}</button>
                    ) : <span>{it}</span>}
                  </li>
                ))}
              </ul>
              {sec.n === 1 && (
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '1px', color: C.goldL, margin: '8px 0 0', padding: isMobile ? 0 : '0 12px' }}>
                  NEVER FINISHED
                </div>
              )}
              {/* Their actual work, standing on the stair it is on. This is the
                  whole reason the picture is worth the space: it is their
                  search, not a diagram of the framework. */}
              {mine.length > 0 && (
                <div style={{ margin: '10px 0 0', padding: isMobile ? 0 : '0 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {mine.map(p => (
                    <div key={p.id} style={{
                      fontSize: 15, lineHeight: 1.35, color: C.cream, fontWeight: 600,
                      background: `${C.gold}1F`, border: `1px solid ${C.gold}55`, borderRadius: 6,
                      padding: '5px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }} title={p.title}>{p.title}</div>
                  ))}
                </div>
              )}
              {/* The one label that answers the question the screen exists to
                  answer, so it cannot be the same colour as everything else.
                  It was gold text on a gold tint on a warm screen and read as
                  more of the same. Solid navy is the actual contrast here --
                  a marker rather than another line of copy. */}
              {isHere && (
                <div style={{ margin: '10px 0 0', padding: isMobile ? 0 : '0 12px' }}>
                  <span style={{
                    display: 'inline-block', background: '#1A2540', color: '#FFFFFF',
                    fontSize: 15, fontWeight: 800, letterSpacing: '1.4px',
                    padding: '5px 10px', borderRadius: 6, lineHeight: 1.2,
                  }}>YOU ARE HERE</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* THE INVITATION. Nothing about a term looks pressable at a glance in a
          dense grid, and a feature nobody discovers is a feature that does not
          exist. Guidance treatment (gold rule + tint) per the standing rule
          that instructions never look like body copy. */}
      {anyExplained && (
        <div style={{
          background: `${C.gold}10`, borderLeft: `3px solid ${C.gold}`, borderRadius: 8,
          padding: isMobile ? '10px 12px' : '11px 16px', marginTop: 14,
          fontSize: 16, color: C.grayL, lineHeight: 1.55, textWrap: 'pretty',
        }}>
          Every term above opens a short explanation of what it means and what Reimagine does about it.
        </div>
      )}

      {/* THE KEEL BAND, and it has to teach itself.
          Almost nobody who lands on this screen has read the book, so opening
          on "KEEL" is opening in a code they do not speak -- a brand word where
          a plain one was needed. It now says what a keel IS before it says what
          the letters stand for, and spends the width it was already occupying
          on the four principles rather than one line and a lot of empty space.

          Bob's own wording for the letters, from Lesson 1. The sailboat image is
          his too, rephrased: the book's line uses the negative-parallel cadence
          the product strips from its own output, so it is put plainly here
          rather than quoted into UI copy. */}
      <div style={{
        background: `${C.gold}12`, borderLeft: `3px solid ${C.gold}`, borderRadius: 8,
        padding: isMobile ? '16px 16px' : '18px 22px', marginTop: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontFamily: 'Georgia,serif', fontSize: 19, fontWeight: 700, color: C.goldL, letterSpacing: '3px' }}>KEEL</span>
          <span style={{ fontSize: 16, color: C.grayL, lineHeight: 1.55, textWrap: 'pretty', flex: 1, minWidth: 260 }}>
            A keel is the weighted fin under a sailboat. It runs the whole length of the hull, and it is what keeps the boat steady when the wind picks up. Four things worth carrying the whole way:
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))',
          gap: isMobile ? 10 : 16, marginTop: 14,
        }}>
          {KEEL_PRINCIPLES.map(k => {
            // The letter this stair leans on hardest comes forward. The other
            // three stay legible rather than dimming out -- all four are
            // carried the whole way, and greying three of them would say the
            // opposite of what the section means.
            const live = keelLetter === k.letter && (k.gloss === keelGloss || !keelGloss)
            return (
              <div key={k.gloss} style={{
                background: live ? `${C.gold}22` : 'transparent',
                border: `1px solid ${live ? C.gold : `${C.gold}33`}`,
                borderRadius: 8, padding: '10px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: 'Georgia,serif', fontSize: 20, fontWeight: 700, color: C.goldL }}>{k.letter}</span>
                  <span style={{ fontSize: 15, color: C.cream, lineHeight: 1.4, fontWeight: live ? 700 : 500, textWrap: 'pretty' }}>{k.gloss}</span>
                </div>
              </div>
            )
          })}
        </div>

        {(keelLetter || stalled) && (
          <p style={{ fontSize: 15, color: C.grayL, lineHeight: 1.55, margin: '14px 0 0', textWrap: 'pretty' }}>
            {stalled
              ? 'A quiet stretch is the part of a search this carries you through. Your position has not moved backwards.'
              : `The one to lean on where you are standing today is highlighted.`}
          </p>
        )}
      </div>

      {openTerm && (
        <StaircaseExplainer
          term={openTerm}
          onClose={() => setOpenTerm(null)}
          onGo={onGo}
          canGo={canGo}
          C={C}
          Btn={Btn}
        />
      )}
    </div>
  )
}
