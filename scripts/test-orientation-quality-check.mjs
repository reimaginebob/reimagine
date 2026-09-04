// Guards the orientation quality check (Coach-as-Concierge follow-on): Coach
// reads what someone actually wrote for Values, Reputation, or Life Story
// and judges it on substance, not word count -- a real per-answer model
// judgment, not a length threshold or keyword list. Source-level for the
// same reason its siblings are: this needs a live signed-in session and a
// real model call to exercise end to end, and cannot be run here.
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
for (const step of ['values', 'reputation', 'life-events']) {
  check(coach.includes(`${step}:`) || new RegExp(`'${step}':`).test(coach),
    `${COACH}: ORIENTATION_CHECK_LABELS is missing the "${step}" key`)
}

// The authoritative gate: client's say-so alone is never enough.
check(/const orientationCheckRequested = orientationCheckShapeOk && !generalMode && hasOnboardingConcierge\(/.test(coach),
  `${COACH}: orientationCheckRequested does not re-check hasOnboardingConcierge server-side`)
check(/orientationCheckRequested \? buildOrientationCheckTurnText\(orientationCheck\.step, orientationCheck\.text\)/.test(coach),
  `${COACH}: the message construction no longer builds the orientation-check turn text for a granted request`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(/const\[qualityCheckedFields,setQualityCheckedFields\]=useState\(\{\}\)/.test(app),
  `${APP}: qualityCheckedFields useState declaration is missing`)

// The trigger: three fields, each gated on done + a real content-changed
// check (not a flat "seen it once" flag -- editing an answer must re-ask).
check(app.includes("step:'values'") && app.includes("step:'reputation'") && app.includes("step:'life-events'"),
  `${APP}: the quality-check effect no longer covers all three fields (values, reputation, life-events)`)
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
