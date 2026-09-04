// Guards the per-step "why this matters" narration (Coach-as-Concierge, item
// 1, slice 2): a short line from Coach on arrival at each orientation step
// listed in src/data/orientation-narration.js. Source-level for the same
// reason its sibling tests are -- this needs a real signed-in browser session
// to exercise end to end.
import fs from 'node:fs'
import { ORIENTATION_NARRATION } from '../src/data/orientation-narration.js'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// Every entry has real, non-trivial content -- an empty or placeholder line
// would silently open the coach bubble with nothing worth saying.
const keys = Object.keys(ORIENTATION_NARRATION)
check(keys.length >= 8, `expected at least 8 narrated steps, found ${keys.length}`)
for (const k of keys) {
  const v = ORIENTATION_NARRATION[k]
  check(typeof v === 'string' && v.trim().length >= 40, `orientation-narration.js: "${k}" is missing or too short to be a real explanation`)
}
// The steps every account (not just Go Independent) passes through must be
// covered -- losing one of these silently drops that step's narration.
for (const required of ['resume', 'linkedin', 'assessment', 'values', 'priorities', 'reputation', 'life-events', 'skills']) {
  check(keys.includes(required), `orientation-narration.js: missing required step "${required}"`)
}

const VOICE = 'scripts/check-voice.mjs'
const voice = fs.readFileSync(VOICE, 'utf8')
check(voice.includes("'src/data/orientation-narration.js'"),
  `${VOICE}: orientation-narration.js is not in FILES_TO_CHECK -- this prose would ship with no voice-gate coverage at all`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(app.includes('import { ORIENTATION_NARRATION } from "./data/orientation-narration.js"'),
  `${APP}: ORIENTATION_NARRATION is not imported`)

// The trigger effect itself: fires on step entry, gated on the same flag as
// slice 1, and stops entirely once outputs.p3 exists (the "no longer
// first-time" guard -- without it, an existing account revisiting an early
// step to edit an answer would get narration for a feature that postdates
// their onboarding).
check(/if\(outputs&&outputs\.p3\)return/.test(app),
  `${APP}: the per-step narration effect lost its outputs.p3 guard -- it would fire for someone editing an answer long after onboarding, not just first-time users`)
check(/const line=ORIENTATION_NARRATION\[step\]/.test(app),
  `${APP}: the per-step narration effect no longer looks up content by step id`)
check(/if\(narratedOrientationSteps\.includes\(step\)\|\|narratedOrientationStepsFiredRef\.current\.has\(step\)\)return/.test(app),
  `${APP}: the per-step narration effect lost its dedupe guard (persisted array + session ref)`)

// Dedupe threading: useState, both hydration paths, and the autosave blob
// (JSON.stringify plus its effect's dependency array) all need to carry
// narratedOrientationSteps.
check(/const\[narratedOrientationSteps,setNarratedOrientationSteps\]=useState\(\[\]\)/.test(app),
  `${APP}: narratedOrientationSteps useState declaration is missing`)
const hydrationHits = (app.match(/if\(Array\.isArray\(d\.narratedOrientationSteps\)\)setNarratedOrientationSteps\(d\.narratedOrientationSteps\)/g) || []).length
check(hydrationHits === 2,
  `${APP}: expected narratedOrientationSteps hydration in both the local pe_v4 path and the server profile/load path -- found ${hydrationHits}`)
// Substring checks against the blob/deps neighborhood, not an exact-suffix
// regex: later slices append their own dedupe fields after this one, which
// would break a regex anchored on this field being last.
const saveBlobIdx = app.indexOf('const blob=JSON.stringify(')
check(app.slice(saveBlobIdx, saveBlobIdx + 400).includes('narratedOrientationSteps'),
  `${APP}: narratedOrientationSteps is missing from the autosave blob's JSON.stringify -- the dedupe would never actually persist`)
const saveDepsIdx = app.indexOf('saveRef.current=save')
check(app.slice(saveDepsIdx, saveDepsIdx + 500).includes('narratedOrientationSteps'),
  `${APP}: narratedOrientationSteps is missing from the autosave effect's dependency array`)

// The "this is optional" apology framing: Coach should lead with why an
// input is worth giving, not open by flagging it as skippable friction.
for (const [step, text] of Object.entries(ORIENTATION_NARRATION)) {
  check(!/^(this one is optional|this is (the step i would prioritize if you only add one )?optional)/i.test(text.trim()),
    `orientation-narration.js: "${step}" still opens by apologizing for being optional instead of leading with its value`)
}
check(!ORIENTATION_NARRATION['life-events'].includes('Entirely optional, and'),
  `orientation-narration.js: "life-events" still leads its closing reassurance with "Entirely optional" instead of folding privacy in as a plain fact`)

// Same positive-framing principle, different shape: opening with a
// prohibition aimed at the person ("Do not X") reads as a correction before
// they have done anything, not an invitation.
for (const [step, text] of Object.entries(ORIENTATION_NARRATION)) {
  check(!/^(do not|don't)\b/i.test(text.trim()),
    `orientation-narration.js: "${step}" opens with a "do not" directive instead of leading with the positive ask`)
}

if (failures) {
  console.error(`test-onboarding-narration: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log(`test-onboarding-narration: OK (${keys.length} steps narrated, voice-gated, trigger correctly gated on outputs.p3 and per-step dedupe, dedupe threaded through both hydration paths and the autosave blob)`)
}
