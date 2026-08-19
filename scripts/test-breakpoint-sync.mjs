// The mobile breakpoint lives in two languages: JS (the drawer and every
// conditional inline style read useIsMobile) and CSS (src/base.css swaps
// --card-pad at a media query, because ~54 inline call sites cannot each be
// handed a flag). Those two have to agree, or the card padding would tighten
// at one width while the layout switched at another — a drift that renders
// fine in both extremes and is wrong only in the band between them, which is
// exactly the kind of bug nobody notices for months.
//
// This asserts they agree. CSS max-width is exclusive of the breakpoint, so
// the media query must be BREAKPOINT - 1.

import fs from 'fs'

let failures = 0
const fail = m => { console.error(`test-breakpoint-sync: FAIL — ${m}`); failures++ }

const hookSrc = fs.readFileSync('src/use-is-mobile.js', 'utf8')
const cssSrc = fs.readFileSync('src/base.css', 'utf8')

const hookMatch = hookSrc.match(/export const MOBILE_BREAKPOINT\s*=\s*(\d+)/)
if (!hookMatch) {
  fail('could not find MOBILE_BREAKPOINT in src/use-is-mobile.js')
} else {
  const breakpoint = Number(hookMatch[1])

  // Every max-width media query in base.css must sit exactly one pixel below
  // the JS breakpoint. A new query at a different width is drift, not a
  // feature — add it deliberately and update this test with the reason.
  const queries = [...cssSrc.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)].map(m => Number(m[1]))

  if (queries.length === 0) {
    fail('src/base.css has no max-width media query; the responsive card padding is gone')
  }

  for (const q of queries) {
    if (q !== breakpoint - 1) {
      fail(`src/base.css has @media (max-width: ${q}px) but MOBILE_BREAKPOINT is ${breakpoint} (expected ${breakpoint - 1}px)`)
    }
  }

  // The whole point of the CSS file is that S.card/S.out can read the variable.
  if (!/--card-pad\s*:/.test(cssSrc)) fail('src/base.css no longer defines --card-pad')

  const appSrc = fs.readFileSync('src/App.jsx', 'utf8')
  const varUses = (appSrc.match(/var\(--card-pad\)/g) || []).length
  if (varUses < 2) {
    fail(`src/App.jsx references var(--card-pad) ${varUses} time(s); expected S.card and S.out to both use it`)
  }

  if (!failures) {
    console.log(`test-breakpoint-sync: OK (JS breakpoint ${breakpoint}, CSS max-width ${breakpoint - 1}px, --card-pad used ${varUses}x)`)
  }
}

process.exit(failures ? 1 : 0)
