// Pure renderer for the coach navigation map. Joins FEATURE_MAP
// (src/coach-routing.js) to the live UI labels in NAV_LABELS (src/nav-labels.js)
// and returns the prompt block the coach is fed. Imported by BOTH the generator
// (scripts/gen-coach-nav-map.mjs, which writes src/coach-nav-map.js) and the
// prebuild gate (scripts/check-coach-nav-map.mjs, which regenerates in memory and
// compares) — so there is exactly one rendering and it can't desync from render.
import { FEATURE_MAP } from '../../src/coach-routing.js'
import { NAV_LABELS } from '../../src/nav-labels.js'

function labelFor(f) {
  if (f.reach === 'community') return f.label
  const l = NAV_LABELS[f.labelId]
  if (!l) {
    throw new Error(
      `render-coach-nav-map: FEATURE_MAP '${f.slug}' labelId '${f.labelId}' ` +
      `is not in NAV_LABELS (src/nav-labels.js). Add it there, or fix labelId.`)
  }
  return l
}

const line = f =>
  `- ${labelFor(f)} — ${f.does}.${f.where ? ` Pointer: ${f.where}.` : ''}  [slug: ${f.slug}]`

export function renderCoachNavMap() {
  const standalone = FEATURE_MAP.filter(f => f.reach === 'standalone')
  const focus      = FEATURE_MAP.filter(f => f.reach === 'focus-gated')
  const community  = FEATURE_MAP.filter(f => f.reach === 'community')
  return [
    'REIMAGINE FEATURE MAP (what exists and where it lives — generated from the app, so these names match exactly what the person sees on screen):',
    '',
    'These features are their own step — point someone straight there:',
    ...standalone.map(line),
    '',
    `These live inside the Focus Playbook, reached through ${NAV_LABELS.laneSelect} once the person has picked a direction. Until they pick one, name the feature and say it is waiting in their Focus Playbook — do not pretend it is one click away:`,
    ...focus.map(line),
    '',
    'These are community, not in-app tools — no screen, no button. Point to them in prose (especially when someone is carrying the search alone):',
    ...community.map(line),
  ].join('\n')
}
