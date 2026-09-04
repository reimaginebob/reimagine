// Guards the orientation quality check (Coach-as-Concierge follow-on): Coach
// reads what someone actually wrote for Values, Reputation, Life Story,
// Location (employment status + search intake), and Priorities (the
// freeform deal-breakers field), and reacts on substance -- a real
// per-answer model judgment, never a length threshold or keyword list, and
// never the same framing for every field (Location/Priorities get an
// orient-and-acknowledge reaction, not the reflective fields' judged-for-
// specificity one). Source-level for the same reason its siblings are: this
// needs a live signed-in session and a real model call to exercise end to
// end, and cannot be run here.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

check(/import \{ hasConnectorBeta, hasPipelineCapture, hasNextStep, hasOnboardingConcierge \} from '\.\/_lib\/feature-flags\.js'/.test(coach),
  `${COACH}: hasOnboardingConcierge is not imported`)

// The judgment instructions themselves must actually ask for a real
// judgment, not a length rule -- this is the whole point of the feature, so
// pin the language down rather than just checking the function exists.
check(coach.includes('not a word-count checker'),
  `${COACH}: buildOrientationCheckTurnText lost its "judge on substance, not length" framing`)
check(coach.includes('could the same words describe almost anyone in a similar career'),
  `${COACH}: buildOrientationCheckTurnText lost its specificity test (distinctive vs. generic)`)
check(coach.includes('ask ONE real, specific question'),
  `${COACH}: buildOrientationCheckTurnText lost the instruction to ask one grounded follow-up when an answer is generic`)
check(coach.includes('do not manufacture a follow-up question where none is warranted'),
  `${COACH}: buildOrientationCheckTurnText lost the instruction NOT to push back on an already-specific answer`)

check(/const ORIENTATION_CHECK_LABELS = \{/.test(coach), `${COACH}: ORIENTATION_CHECK_LABELS is missing`)
for (const step of ['values', 'reputation', 'life-events', 'location', 'priorities', 'fit']) {
  check(coach.includes(`${step}:`) || new RegExp(`'${step}':`).test(coach),
    `${COACH}: ORIENTATION_CHECK_LABELS is missing the "${step}" key`)
}

// The authoritative gate: client's say-so alone is never enough.
check(/const orientationCheckRequested = orientationCheckShapeOk && !generalMode && hasOnboardingConcierge\(/.test(coach),
  `${COACH}: orientationCheckRequested does not re-check hasOnboardingConcierge server-side`)
check(/orientationCheckRequested \? buildOrientationCheckTurnText\(orientationCheck\.step, orientationCheck\.text\)/.test(coach),
  `${COACH}: the message construction no longer builds the orientation-check turn text for a granted request`)

// Location and Priorities must NOT share the reflective-fields framing --
// that would judge "what's going well in your search" for specificity,
// which is the wrong lens entirely. Confirm the dispatcher routes them to
// their own builders, and that those builders carry orient/acknowledge
// language rather than the depth-judgment language.
check(/if \(step === 'location'\) return buildSituationCheckText\(text\)/.test(coach),
  `${COACH}: buildOrientationCheckTurnText no longer routes 'location' to its own builder -- it would fall through to the reflective-depth framing`)
check(/if \(step === 'priorities'\) return buildDealBreakersCheckText\(text\)/.test(coach),
  `${COACH}: buildOrientationCheckTurnText no longer routes 'priorities' to its own builder -- it would fall through to the reflective-depth framing`)
check(coach.includes('This is not a specificity judgment like the reflective fields above') || coach.includes('is the first real read you have on where they stand'),
  `${COACH}: buildSituationCheckText lost its orient-not-judge framing`)
check(coach.includes('carry something more personal underneath') && coach.includes('calibrated to that'),
  `${COACH}: buildDealBreakersCheckText lost its practical-vs-personal calibration instruction`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(/const\[qualityCheckedFields,setQualityCheckedFields\]=useState\(\{\}\)/.test(app),
  `${APP}: qualityCheckedFields useState declaration is missing`)

// The trigger: six fields, each gated on done + a real content-changed
// check (not a flat "seen it once" flag -- editing an answer must re-ask).
check(app.includes("step:'values'") && app.includes("step:'reputation'") && app.includes("step:'life-events'") && app.includes("step:'location'") && app.includes("step:'priorities'") && app.includes("step:'fit'"),
  `${APP}: the quality-check effect no longer covers all six fields (values, reputation, life-events, location, priorities, fit)`)
// Priorities must skip firing on an empty deal-breakers field -- it is
// explicitly optional, and reacting to nothing would manufacture a check
// where there is nothing to check.
check(app.includes("combined:(profile.dealBreakers||'').trim()"),
  `${APP}: the priorities check no longer gates on non-empty deal-breakers content`)
// Location combines employment status with search intake so the check
// re-fires if either changes independently after an initial pass.
check(app.includes("combined:[employmentStatus,searchGoingWell,searchFocus].filter(Boolean).join(' ').trim()"),
  `${APP}: the location check no longer combines employment status and search intake for its dedupe key`)
check(/if\(qualityCheckedFields\[f\.step\]===f\.combined\)continue/.test(app),
  `${APP}: the quality-check effect lost its content-based dedupe -- it would either never re-ask after an edit, or ask every render`)
check(app.includes("orientationCheck:{step:stepId,text:sendText}"),
  `${APP}: the quality-check effect no longer posts orientationCheck to /api/coach in the expected shape`)
check(app.includes("if(res.status===204)"),
  `${APP}: the quality-check effect no longer handles a 204 (nothing to say) from the server`)

// Dedupe threading: both hydration paths and the autosave blob.
const hydrationHits = (app.match(/if\(d\.qualityCheckedFields&&typeof d\.qualityCheckedFields==='object'\)setQualityCheckedFields\(d\.qualityCheckedFields\)/g) || []).length
check(hydrationHits === 2,
  `${APP}: expected qualityCheckedFields hydration in both the local pe_v4 path and the server profile/load path -- found ${hydrationHits}`)
const saveBlobIdx = app.indexOf('const blob=JSON.stringify(')
check(app.slice(saveBlobIdx, saveBlobIdx + 500).includes('qualityCheckedFields'),
  `${APP}: qualityCheckedFields is missing from the autosave blob's JSON.stringify -- the dedupe would never actually persist`)
const saveDepsIdx = app.indexOf('saveRef.current=save')
check(app.slice(saveDepsIdx, saveDepsIdx + 600).includes('qualityCheckedFields'),
  `${APP}: qualityCheckedFields is missing from the autosave effect's dependency array`)

if (failures) {
  console.error(`test-orientation-quality-check: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-orientation-quality-check: OK (server gate re-checked, judgment instructions ask for substance not length, client trigger covers all three fields with content-based dedupe, threaded through both hydration paths and the autosave blob)')
}
