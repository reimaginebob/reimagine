// Prebuild gate: the committed src/coach-nav-map.js must equal what the renderer
// produces RIGHT NOW from FEATURE_MAP + NAV_LABELS. Regenerate-in-memory and
// compare (no file write in CI). A rename in NAV_LABELS or a FEATURE_MAP change
// that wasn't regenerated → mismatch → fail. This is what makes renames unable
// to desync the coach prompt from what the UI renders.
//
// Also cross-checks that FEATURE_MAP's slug set equals CANONICAL_FEATURE_SLUGS
// (which derives from it) — a guard against a hand-edit elsewhere drifting.
import { renderCoachNavMap } from './lib/render-coach-nav-map.mjs'
import { COACH_NAV_MAP } from '../src/coach-nav-map.js'
import { FEATURE_MAP, CANONICAL_FEATURE_SLUGS } from '../src/coach-routing.js'

let failed = false

const fresh = renderCoachNavMap()
if (fresh !== COACH_NAV_MAP) {
  console.error('check-coach-nav-map: FAIL — src/coach-nav-map.js is STALE.')
  console.error('FEATURE_MAP (src/coach-routing.js) or NAV_LABELS (src/nav-labels.js) changed')
  console.error('without regenerating. Run:  npm run gen:coach-nav-map')
  failed = true
}

const mapSlugs = FEATURE_MAP.map(f => f.slug)
const a = JSON.stringify(mapSlugs)
const b = JSON.stringify(CANONICAL_FEATURE_SLUGS)
if (a !== b) {
  console.error('check-coach-nav-map: FAIL — FEATURE_MAP slugs != CANONICAL_FEATURE_SLUGS.')
  console.error(`  FEATURE_MAP: ${a}`)
  console.error(`  CANONICAL:   ${b}`)
  failed = true
}

if (failed) process.exit(1)
console.log(`check-coach-nav-map: OK (${FEATURE_MAP.length} features; nav map in sync with NAV_LABELS)`)
