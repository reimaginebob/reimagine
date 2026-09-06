// Guards src/data/guide-step-relevance.js against the exact failure mode it
// exists to prevent: a currentStep value silently falling through the
// cracks. Falling through isn't a crash -- resolveGuideBlock in
// api/coach.js fails open to the full guide for anything unmapped -- but it
// silently defeats the entire point of step-aware gating for that step,
// with nothing to notice it happened. This test makes an unmapped step a
// loud build failure instead of a quiet, permanent miss.
//
// Reads NAV_LABELS directly rather than hardcoding the step list, so a step
// added there in the future and never taught to this map fails here too.
import fs from 'node:fs'
import { NAV_LABELS } from '../src/nav-labels.js'
import {
  ALWAYS_ON_UNITS, FALLBACK_STEPS, CHAPTER_STEPS,
  FOCUS_PLAYBOOK_SECTION_STEPS, FOCUS_PLAYBOOK_PREAMBLE_STEPS,
} from '../src/data/guide-step-relevance.js'
import { FOCUS_PLAYBOOK_UNIT_ORDER } from './lib/split-focus-playbook.mjs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const mappedSteps = new Set([
  ...FALLBACK_STEPS,
  ...FOCUS_PLAYBOOK_PREAMBLE_STEPS,
  ...Object.values(CHAPTER_STEPS).flat(),
  ...Object.values(FOCUS_PLAYBOOK_SECTION_STEPS).flat(),
])

for (const step of Object.keys(NAV_LABELS)) {
  check(mappedSteps.has(step),
    `currentStep "${step}" (NAV_LABELS) has no entry anywhere in guide-step-relevance.js -- it will silently get the full, unnarrowed guide forever with nothing flagging that it was never mapped`)
}

// Every FOCUS_PLAYBOOK_SECTION_STEPS key must be a real split unit, and
// every real content unit (not preamble/tail, which are handled
// separately) must have a step mapping -- catches a typo'd unit name on
// either side, and an unmapped unit that would otherwise never be sent.
const contentUnits = FOCUS_PLAYBOOK_UNIT_ORDER.filter(u => u !== 'preamble' && u !== 'tail')
for (const unit of Object.keys(FOCUS_PLAYBOOK_SECTION_STEPS)) {
  check(contentUnits.includes(unit),
    `guide-step-relevance.js maps focus-playbook unit "${unit}", which does not exist in FOCUS_PLAYBOOK_UNIT_ORDER`)
}
for (const unit of contentUnits) {
  check(Object.prototype.hasOwnProperty.call(FOCUS_PLAYBOOK_SECTION_STEPS, unit),
    `focus-playbook unit "${unit}" has no step mapping in FOCUS_PLAYBOOK_SECTION_STEPS -- it will never be sent for any step`)
}

// ALWAYS_ON_UNITS must resolve to real chapters or split units -- a typo'd
// filename here would silently drop that content from every turn, not just
// narrowed ones.
const chapters = JSON.parse(fs.readFileSync('src/data/user-guide/ORDER.json', 'utf8')).chapters
for (const unit of ALWAYS_ON_UNITS) {
  const isSplitUnit = unit.startsWith('focus-playbook:')
  if (isSplitUnit) {
    const key = unit.slice('focus-playbook:'.length)
    check(FOCUS_PLAYBOOK_UNIT_ORDER.includes(key),
      `ALWAYS_ON_UNITS references "${unit}", which is not a real focus-playbook split unit`)
  } else {
    check(chapters.includes(unit),
      `ALWAYS_ON_UNITS references "${unit}", which is not a chapter listed in ORDER.json`)
  }
}

// Every CHAPTER_STEPS key must be a real chapter file, and focus-playbook.md
// itself must NOT appear there -- it's handled exclusively through the
// split units, and a whole-chapter entry for it would mean sending the
// entire 55K chapter AND its split slice on the same turn.
for (const file of Object.keys(CHAPTER_STEPS)) {
  check(chapters.includes(file), `CHAPTER_STEPS references "${file}", which is not a chapter listed in ORDER.json`)
}
check(!Object.keys(CHAPTER_STEPS).includes('focus-playbook.md'),
  `CHAPTER_STEPS maps focus-playbook.md whole -- it should only be reachable through FOCUS_PLAYBOOK_SECTION_STEPS/FOCUS_PLAYBOOK_PREAMBLE_STEPS`)

if (failures) {
  console.error(`test-guide-step-relevance: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log(`test-guide-step-relevance: OK (${Object.keys(NAV_LABELS).length} currentStep values all mapped, focus-playbook units and always-on references all resolve)`)
}
