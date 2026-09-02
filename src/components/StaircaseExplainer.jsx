// One term on the staircase, explained.
//
// WHY THIS EXISTS. The staircase names ten things -- KEEL, the 4 C's, SCOPE,
// BATNA -- and almost nobody who lands on that screen has read Making Your Own
// Weather. Naming a framework at someone who does not have it is the same
// failure as calling a feature by its internal ID: it looks like the product
// assuming knowledge the person was never given. Every term is now a control
// that explains itself and then says what Reimagine does about it.
//
// The second half is the one that earns the modal. Much of this product's value
// is invisible until someone knows the problem it solves, and the staircase is
// the one screen where the problems are already named and in order. So each
// explainer ends on features, by name, with a way in.
//
// THREE THINGS THIS MUST NOT DO:
//
//  - NEVER a button to a gated feature. A control that lands on a "pick a
//    direction first" wall is the soft version of a dead link. Gated features
//    are NAMED, with what opens them, and carry no button. That is the postcard:
//    the view from a stair not yet reached, which is what makes the climb worth
//    starting. `canGo` extends the same rule to anything the app cannot serve
//    right now, so a button here can never land on a blank screen.
//  - NEVER invent a feature to round out a term. Every row below points at
//    something that ships today, checked against FEATURE_MAP.
//  - NEVER speak a label the UI does not render. Button text comes from
//    NAV_LABELS, the single label source, rather than the row's own name -- the
//    Career Club Corner row opens Job Search Resources, and the button has to
//    say so.
import React, { useEffect, useRef } from 'react'
import { useIsMobile } from '../use-is-mobile.js'
import { NAV_LABELS } from '../nav-labels.js'
import { STAIRCASE_EXPLAINERS, NEEDS_LABEL } from '../data/staircase-explainers.js'

export default function StaircaseExplainer({ term, onClose, onGo, canGo, C, Btn }) {
  const isMobile = useIsMobile()
  const closeRef = useRef(null)

  // Escape closes, and focus lands on the close control so the way out is the
  // first thing a keyboard or screen reader reaches. This opens over a screen
  // someone is reading; it has to be as easy to leave as to open.
  useEffect(() => {
    const onKey = ev => { if (ev.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    if (closeRef.current) closeRef.current.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const ex = STAIRCASE_EXPLAINERS[term]
  if (!ex) return null

  const paras = String(ex.what || '').split('\n\n').filter(Boolean)
  const bullets = Array.isArray(ex.bullets) ? ex.bullets : []
  const gives = Array.isArray(ex.gives) ? ex.gives : []

  return (
    <div data-print="hide" onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.55)', zIndex: 1300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: isMobile ? 12 : 24,
    }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={ex.title} style={{
        background: '#FFFFFF', borderRadius: 14, position: 'relative',
        padding: isMobile ? '24px 20px' : '30px 34px',
        maxWidth: 640, width: '100%',
        maxHeight: 'calc(100dvh - 48px)', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <button ref={closeRef} onClick={onClose} aria-label="Close" style={{
          position: 'absolute', top: 12, right: 14, background: 'transparent',
          border: 'none', color: '#718096', fontSize: 26, cursor: 'pointer',
          padding: 4, lineHeight: 1, fontFamily: 'inherit',
        }}>&times;</button>

        <h2 style={{
          fontFamily: 'Georgia,serif', fontSize: isMobile ? 23 : 26, fontWeight: 700,
          color: C.cream, margin: '0 0 14px', paddingRight: 30, lineHeight: 1.3, textWrap: 'balance',
        }}>{ex.title}</h2>

        {paras.map((p, i) => (
          <p key={i} style={{
            fontSize: 17, color: C.gray, lineHeight: 1.65,
            margin: i === paras.length - 1 && !bullets.length ? 0 : '0 0 13px',
            textWrap: 'pretty',
          }}>{p}</p>
        ))}

        {/* THE ACROSTIC. KEEL and SCOPE are mnemonics, and a mnemonic run
            together as prose stops being one -- the letters going down the left
            edge are the entire reason the word is memorable. The letter leads
            the row in the serif so it reads as the spine of the list. */}
        {bullets.length > 0 && (
          <ul style={{ listStyle: 'none', margin: '4px 0 0', padding: 0 }}>
            {bullets.map((b, i) => (
              <li key={b.lead} style={{
                display: 'flex', gap: 12, alignItems: 'baseline',
                padding: '9px 0', borderTop: i ? `1px solid ${C.border}` : 'none',
              }}>
                <span aria-hidden="true" style={{
                  fontFamily: 'Georgia,serif', fontSize: 22, fontWeight: 700, color: C.gold,
                  lineHeight: 1, width: '1.1em', flex: 'none', textAlign: 'center',
                }}>{b.letter}</span>
                <span style={{ fontSize: 16.5, color: C.gray, lineHeight: 1.55, textWrap: 'pretty' }}>
                  <b style={{ color: C.cream, fontWeight: 700 }}>{b.lead}</b>
                  {b.rest ? ` — ${b.rest}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}

        {ex.outro && (
          <p style={{ fontSize: 17, color: C.gray, lineHeight: 1.65, margin: '14px 0 0', textWrap: 'pretty' }}>{ex.outro}</p>
        )}

        {gives.length > 0 && (
          <div style={{ marginTop: 24, paddingTop: 18, borderTop: `1px solid ${C.border}` }}>
            <div style={{
              fontSize: 15, fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase',
              color: C.goldL, margin: '0 0 12px',
            }}>What Reimagine gives you for it</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {gives.map(g => {
                const gated = !!g.needs
                // A button only where the app can actually serve the screen.
                // Everything else is named with what opens it -- see the header.
                const live = !gated && g.to && (typeof canGo === 'function' ? canGo(g.to) : true)
                const dest = (g.to && NAV_LABELS[g.to]) || g.label
                return (
                  <div key={g.label}
                    // Self-describing rows: the gated/open decision is the one
                    // rule in this file a refactor could invert without looking
                    // wrong, so it is readable from the markup and asserted per
                    // row in scripts/test-staircase-explainer.mjs. Two rows can
                    // point at the same screen -- BATNA names both Compare
                    // offers (gated) and My Pipeline (open), both `pipeline` --
                    // so a document-wide search cannot tell which row owns a
                    // button, and the test needs the boundary.
                    data-give={g.label}
                    data-door={live ? 'open' : 'none'}
                    style={{
                      background: gated ? '#F5F6F8' : `${C.gold}10`,
                      borderLeft: `3px solid ${gated ? '#8A94A6' : C.gold}`,
                      borderRadius: 8, padding: '12px 14px',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 16.5, fontWeight: 700, color: C.cream }}>{g.label}</span>
                      {gated && (
                        <span style={{
                          fontSize: 15, color: '#5A6B87', border: '1px solid #C3CAD6',
                          borderRadius: 20, padding: '1px 9px', lineHeight: 1.45,
                        }}>{NEEDS_LABEL[g.needs] || g.needs}</span>
                      )}
                    </div>
                    <p style={{ fontSize: 16, color: C.gray, lineHeight: 1.6, margin: 0, textWrap: 'pretty' }}>{g.does}</p>
                    {live && (
                      <div style={{ marginTop: 10 }}>
                        <Btn small onClick={() => { onClose(); onGo(g.to) }}>Open {dest}</Btn>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
