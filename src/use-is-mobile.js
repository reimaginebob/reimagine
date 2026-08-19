// Single source of truth for "is this a narrow screen?"
//
// Reimagine has no CSS framework — everything is inline React styles — so a
// media query in a stylesheet can only reach these layouts by forcing its way
// past them with !important (that is what src/print.css has to do for paper).
// For the ONE structural decision that has to open and close at runtime — the
// navigation rail becoming a slide-out drawer — a hook is the honest tool: the
// component already renders its own styles, so it can render a different set.
//
// MOBILE_BREAKPOINT is the contract. Below it the rail goes off-canvas and the
// content column takes the full width; at or above it every caller renders
// exactly what it rendered before this hook existed, so desktop is untouched
// by construction rather than by careful review.
//
// 768 is the standard tablet-portrait line and sits comfortably above the
// widest phone landscape (932px is iPhone Pro Max landscape, so phones in
// landscape correctly get the DESKTOP layout — that path already worked and
// the drawer would be a regression there).
//
// This replaces the older isSmallPortrait check (orientation:portrait AND
// width<500), which existed only to raise the "rotate your phone" advisory
// banner. That banner described a limitation we have now fixed, so it and its
// state were removed with the layout work.

import { useState, useEffect } from 'react'

export const MOBILE_BREAKPOINT = 768

const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

// SSR/no-matchMedia guard: default to the desktop layout. Vercel serves this
// as a client-rendered SPA, but a false "mobile" during a pre-paint pass would
// flash the drawer closed on a laptop, which is the worse failure.
const read = () => (typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia(query).matches
  : false)

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(read)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const onChange = e => setIsMobile(e.matches)
    // Re-read on mount: the initial useState ran before this effect, and an
    // orientation change between the two would otherwise be missed.
    setIsMobile(mql.matches)
    // addEventListener on MediaQueryList is Safari 14+; addListener is the
    // fallback for anything older still in the field.
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    }
    mql.addListener(onChange)
    return () => mql.removeListener(onChange)
  }, [])

  return isMobile
}
