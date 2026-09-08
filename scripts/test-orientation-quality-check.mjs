// Guards the orientation quality check (Coach-as-Concierge follow-on): Coach
// reads what someone actually wrote or uploaded for Resume, LinkedIn,
// Assessment, Values, Reputation, Life Story, Location (employment status +
// search intake), and Priorities (the freeform deal-breakers field), and
// reacts on substance -- a real per-answer model judgment, never a length
// threshold, keyword list, or canned "thanks for adding X," and never the
// same framing for every field (Resume/LinkedIn/Assessment get a genuine
// first-read reaction, Location/Priorities get an orient-and-acknowledge
// reaction, the reflective fields get a judged-for-specificity one).
// Source-level for the same reason its siblings are: this needs a live
// signed-in session and a real model call to exercise end to end, and
// cannot be run here.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

check(/import \{[^}]*\bhasOnboardingConcierge\b[^}]*\} from '\.\/_lib\/feature-flags\.js'/.test(coach),
  `${COACH}: hasOnboardingConcierge is not imported`)

// The judgment instructions themselves must actually ask for a real
// judgment, not a length rule -- this is the whole point of the feature, so
// pin the language down rather than just checking the function exists.
check(coach.includes('not a word-count checker'),
  `${COACH}: buildOrientationCheckTurnText lost its "judge on substance, not length" framing`)
check(coach.includes('could the same words describe almost anyone in a similar career'),
  `${COACH}: buildOrientationCheckTurnText lost its specificity test (distinctive vs. generic)`)
check(coach.includes('do not manufacture a follow-up question where none is warranted'),
  `${COACH}: buildOrientationCheckTurnText lost the instruction NOT to push back on an already-specific answer`)

// The follow-up itself: caught live asking about honesty AND sports AND
// family in one reply, with each question presuming its own answer ("was
// there a moment this cost you", "a sport that shaped how you lead a
// team") instead of drawing the person out. Pin down both fixes: one
// thread per reply, and an open question rather than a hypothesis handed
// to them to confirm.
check(coach.includes('ONE thread only'),
  `${COACH}: buildReflectiveDepthCheckText lost the instruction to follow up on a single topic, not several stacked into one reply`)
check(coach.includes('leading the witness'),
  `${COACH}: buildReflectiveDepthCheckText lost the instruction against a leading question that supplies its own answer`)
check(coach.includes('gets asked what integrity actually means to them and why it matters to them, not a guess'),
  `${COACH}: buildReflectiveDepthCheckText lost its open-question example`)

check(/const ORIENTATION_CHECK_LABELS = \{/.test(coach), `${COACH}: ORIENTATION_CHECK_LABELS is missing`)
for (const step of ['resume', 'linkedin', 'assessment', 'values', 'reputation', 'life-events', 'location', 'priorities', 'fit']) {
  check(coach.includes(`${step}:`) || new RegExp(`'${step}':`).test(coach),
    `${COACH}: ORIENTATION_CHECK_LABELS is missing the "${step}" key -- without it, a request for this step is shape-invalid and gets a 400`)
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
// Caught live: the model named an unrequested framework ("circle of
// concern"/"circle of control") to explain a job-search pattern, reading as
// a teaching moment instead of a friend saying "yeah, that happens." Pin the
// guard against naming or teaching any framework/method/model in this reply.
check(coach.includes('NEVER by naming, labeling, or teaching a framework, method, or model'),
  `${COACH}: buildSituationCheckText lost its guard against naming or teaching a framework -- this is the fix for the live "circle of concern" incident`)
check(coach.includes('a person telling a friend what\'s going on, not a student being taught a course'),
  `${COACH}: buildSituationCheckText lost its friend-not-teacher register instruction`)
check(coach.includes('carry something more personal underneath') && coach.includes('calibrated to that'),
  `${COACH}: buildDealBreakersCheckText lost its practical-vs-personal calibration instruction`)

// Resume/LinkedIn/Assessment: routed to their own builders (not the
// reflective-depth or situation framing), each asking for a genuine reaction
// rather than a canned "thanks for adding X" -- a fixed acknowledgment is
// exactly the mechanical read this feature exists to avoid. LinkedIn's
// specifically must carry the honesty guard against inventing a
// resume/LinkedIn mismatch that is not actually there.
check(/if \(step === 'resume'\) return buildResumeReactionText\(text\)/.test(coach),
  `${COACH}: buildOrientationCheckTurnText no longer routes 'resume' to its own builder`)
check(/if \(step === 'linkedin'\) return buildLinkedInReactionText\(text\)/.test(coach),
  `${COACH}: buildOrientationCheckTurnText no longer routes 'linkedin' to its own builder`)
check(/if \(step === 'assessment'\) return buildAssessmentReactionText\(text\)/.test(coach),
  `${COACH}: buildOrientationCheckTurnText no longer routes 'assessment' to its own builder`)
check(coach.includes('not a generic "great start" or "thanks for uploading."'),
  `${COACH}: buildResumeReactionText lost its instruction against a canned acknowledgment`)
check(coach.includes('Never invent a mismatch that is not actually there'),
  `${COACH}: buildLinkedInReactionText lost its guard against fabricating a resume/LinkedIn cross-reference`)
check(coach.includes('their resume is included below it for cross-reference'),
  `${COACH}: buildLinkedInReactionText no longer tells the model the resume text may be attached`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(/const\[qualityCheckedFields,setQualityCheckedFields\]=useState\(\{\}\)/.test(app),
  `${APP}: qualityCheckedFields useState declaration is missing`)

// The trigger: nine fields, each gated on done + a real content-changed
// check (not a flat "seen it once" flag -- editing an answer must re-ask).
check(app.includes("step:'resume'") && app.includes("step:'linkedin'") && app.includes("step:'assessment'") && app.includes("step:'values'") && app.includes("step:'reputation'") && app.includes("step:'life-events'") && app.includes("step:'location'") && app.includes("step:'priorities'") && app.includes("step:'fit'"),
  `${APP}: the quality-check effect no longer covers all nine fields (resume, linkedin, assessment, values, reputation, life-events, location, priorities, fit)`)
// LinkedIn's own text carries the resume alongside it (when one exists) so
// the model can make a real cross-reference -- losing this silently
// degrades the LinkedIn reaction to a check with no way to ever notice a
// mismatch, no matter how well the prompt asks for one.
check(app.includes("For cross-reference, here is the resume they already gave you"),
  `${APP}: the linkedin field no longer includes the resume text for cross-reference`)
// Priorities must skip firing on an empty deal-breakers field -- it is
// explicitly optional, and reacting to nothing would manufacture a check
// where there is nothing to check.
check(app.includes("combined:(profile.dealBreakers||'').trim()"),
  `${APP}: the priorities check no longer gates on non-empty deal-breakers content`)
// Location combines employment status with search intake so the check
// re-fires if either changes independently after an initial pass.
check(app.includes("combined:[employmentStatus,searchGoingWell,searchFocus].filter(Boolean).join(' ').trim()"),
  `${APP}: the location check no longer combines employment status and search intake for its dedupe key`)
check(/if\(qualityCheckedFields\[f\.step\]===f\.combined\)return/.test(app),
  `${APP}: fireOrientationCheck lost its content-based dedupe -- it would either never re-ask after an edit, or ask every render`)

// The ordering fix (narration holds off until a real reaction is no longer
// owed) MUST be a plain, synchronous, render-time computation, not a
// counter one effect increments via setState and another effect reads --
// a state update is not visible to a sibling effect in the SAME commit (it
// schedules a future render), so that shape loses the race exactly when
// both effects fire together: narration always wins, because it reads the
// counter before the other effect's increment has taken effect. This is
// the actual bug caught live (reputation's reaction landing AFTER the
// priorities narration it should have preceded) after the first version of
// this fix (an in-flight useState counter) shipped in #699.
check(!app.includes('orientationCheckInFlight'),
  `${APP}: orientationCheckInFlight (the racy useState-counter version of the ordering fix) is back -- it does not work across sibling effects in the same commit, see the comment above orientationCheckFields`)
check(app.includes('const orientationCheckPending=orientationCheckFields.some(f=>f.done&&f.combined&&qualityCheckedFields[f.step]!==f.combined)'),
  `${APP}: orientationCheckPending is missing or no longer derived synchronously from done/profile/qualityCheckedFields -- this is what makes the ordering fix correct on first read instead of racing a sibling effect`)
check(/if\(orientationCheckPending\)return/.test(app),
  `${APP}: the narration effect no longer holds off on orientationCheckPending`)
// Both effects must build their field list from the SAME array, not two
// independently maintained copies that can drift out of sync with each
// other (a step added to one and not the other silently breaks either the
// ordering fix or the check itself for that step).
const orientationCheckFieldsIdx = app.indexOf('const orientationCheckFields=[')
check(orientationCheckFieldsIdx !== -1, `${APP}: orientationCheckFields is missing`)
check(app.includes('for(const f of orientationCheckFields){'),
  `${APP}: the quality-check effect no longer iterates the shared orientationCheckFields array -- it may have grown its own separate copy again, which is exactly the drift this refactor removed`)
check(app.includes("orientationCheck:{step:stepId,text:sendText}"),
  `${APP}: the quality-check effect no longer posts orientationCheck to /api/coach in the expected shape`)
check(app.includes("if(res.status===204)"),
  `${APP}: the quality-check effect no longer handles a 204 (nothing to say) from the server`)

// A failed check (a non-OK response, or a network error) MUST release
// orientationCheckFiredRef for that step, or the field is permanently
// blocked from retrying for the rest of the browser session -- caught live
// as "got nothing" for a field across an entire orientation pass, which one
// transient failure with no self-heal is exactly consistent with.
// qualityCheckedFields staying unset (the pre-existing half of the retry
// story) only helps a future attempt if the fired-ref also forgets this one.
const qcFetchIdx = app.indexOf("orientationCheck:{step:stepId,text:sendText}")
const notOkIdx = qcFetchIdx !== -1 ? app.indexOf("if(!res.ok){", qcFetchIdx) : -1
check(notOkIdx !== -1, `${APP}: the quality-check fetch no longer branches on a non-OK response`)
check(app.slice(notOkIdx, notOkIdx + 900).includes('orientationCheckFiredRef.current=rest'),
  `${APP}: a non-OK response no longer releases orientationCheckFiredRef -- one failed check would permanently block retries for that field within this session`)
const catchIdx = app.indexOf("}catch{", notOkIdx)
check(catchIdx !== -1, `${APP}: the quality-check fetch no longer has a catch block for network failures`)
check(app.slice(catchIdx, catchIdx + 400).includes('orientationCheckFiredRef.current=rest'),
  `${APP}: a network failure (catch) no longer releases orientationCheckFiredRef -- same permanent-block bug as the non-OK case above`)

// "Coach is thinking" indicator (2026-09-04, reported live): this fetch can
// take several seconds and the person is usually already on the next screen
// by the time it lands, with nothing to say Coach was ever working on it. A
// count (not a flag) because more than one field can be in flight at once;
// must increment before the fetch and decrement in a finally so it releases
// on every exit path (204, non-OK, success, and a thrown network error).
check(app.includes('const[coachThinkingCount,setCoachThinkingCount]=useState(0)'),
  `${APP}: coachThinkingCount state is missing`)
check(app.includes('setCoachThinkingCount(c=>c+1)'),
  `${APP}: the quality-check fetch no longer increments coachThinkingCount before firing`)
check(app.includes('}finally{\n        setCoachThinkingCount(c=>c-1)\n      }'),
  `${APP}: coachThinkingCount is no longer released in a finally block -- it would get stuck "thinking" forever on whichever exit path lost the decrement`)
// Dedupe threading: both hydration paths and the autosave blob.
const hydrationHits = (app.match(/if\(d\.qualityCheckedFields&&typeof d\.qualityCheckedFields==='object'\)setQualityCheckedFields\(d\.qualityCheckedFields\)/g) || []).length
check(hydrationHits === 2,
  `${APP}: expected qualityCheckedFields hydration in both the local pe_v4 path and the server profile/load path -- found ${hydrationHits}`)
const saveBlobIdx = app.indexOf('const blob=JSON.stringify(')
check(app.slice(saveBlobIdx, saveBlobIdx + 700).includes('qualityCheckedFields'),
  `${APP}: qualityCheckedFields is missing from the autosave blob's JSON.stringify -- the dedupe would never actually persist`)
const saveDepsIdx = app.indexOf('saveRef.current=save')
check(app.slice(saveDepsIdx, saveDepsIdx + 600).includes('qualityCheckedFields'),
  `${APP}: qualityCheckedFields is missing from the autosave effect's dependency array`)

// coachThinkingCount is purely a display signal: it must never be threaded
// into the autosave blob or either hydration path. In-flight state cannot
// survive a reload (there is no in-flight request left to resume), so
// persisting it would let a stale "thinking" dot stick forever with no
// request ever coming to release it via the finally block above.
check(!app.slice(saveBlobIdx, saveBlobIdx + 500).includes('coachThinkingCount'),
  `${APP}: coachThinkingCount is in the autosave blob -- it is transient in-flight state and must not persist across a reload`)
check(!app.slice(saveDepsIdx, saveDepsIdx + 600).includes('coachThinkingCount'),
  `${APP}: coachThinkingCount is in the autosave effect's dependency array -- it is transient in-flight state and must not persist across a reload`)

// My Coach review, finding #3.3: the check effect fired on the same render
// that added a step to `done`, ahead of the profile blob's own 800ms
// autosave debounce, so the server's ANCHOR 1 (profile_state) was typically
// stale by the time the reaction turn ran. Flushing the debounced save
// before the fetch keeps ANCHOR 1 current.
const fireCheckIdx = app.indexOf('const fireOrientationCheck=(f)=>{')
check(fireCheckIdx !== -1, `${APP}: fireOrientationCheck is missing`)
const fireCheckBlock = fireCheckIdx !== -1 ? app.slice(fireCheckIdx, fireCheckIdx + 1600) : ''
check(fireCheckBlock.indexOf('if(saveRef.current)await saveRef.current()') !== -1
  && fireCheckBlock.indexOf('if(saveRef.current)await saveRef.current()') < fireCheckBlock.indexOf("fetch('/api/coach'"),
  `${APP}: fireOrientationCheck no longer flushes the debounced autosave before the fetch -- ANCHOR 1 can arrive stale`)

// My Coach review, finding #3.4: the old single effect re-fired on ANY
// change to a listed profile field, including a Coach-driven write made
// mid-conversation while the person was nowhere near that field's own
// screen -- one tap produced two unrequested turns. The 8 screen-tied
// fields must now fire from doAdvance (the moment the person actually
// leaves that field's own screen), not from a render-driven effect keyed
// on live profile values.
check(app.includes('fireOrientationCheck(orientationCheckFields.find(f=>f.step===from));setStep(to)'),
  `${APP}: doAdvance no longer fires the per-step orientation check at the moment the person leaves that step`)
check(!/profile\.values,profile\.passions,profile\.rep,profile\.lifeEvents,profile\.dealBreakers/.test(app),
  `${APP}: a render-driven effect keyed on live profile field values is back -- this is exactly what let a Coach-driven write re-trigger a check mid-session`)

// brand-richness is not tied to a screen -- it is tied to a Personal Brand
// rebuild -- so it keeps its own effect, independent of doAdvance, gated on
// outputs (not the 8 fields' deps) so an unrelated field write elsewhere
// cannot touch it and a genuine rebuild still refires it.
check(/useEffect\(\(\)=>\{\s*fireOrientationCheck\(orientationCheckFields\.find\(f=>f\.step==='brand-richness'\)\)\s*\},\[outputs,signedInUser,hasOnboardingConcierge,qualityCheckedFields,isDemo,isTest\]\)/.test(app),
  `${APP}: brand-richness no longer has its own outputs-driven effect, separate from the 8 screen-tied fields`)

// One-time catch-up sweep: a field already `done` with no reaction on
// record (a prior transient failure, or an account that completed a step
// before this feature existed) still needs to be checked once, but on
// mount/hydration -- not on every render a profile field happens to change,
// which was the render-driven behavior finding #3.4 removes.
check(app.includes('const orientationCheckCaughtUpRef=useRef(false)'),
  `${APP}: orientationCheckCaughtUpRef is missing -- the catch-up sweep would re-run on every qualifying render instead of once`)
const catchUpIdx = app.indexOf('if(orientationCheckCaughtUpRef.current)return')
check(catchUpIdx !== -1, `${APP}: the catch-up sweep no longer guards on orientationCheckCaughtUpRef`)
check(app.slice(Math.max(0, catchUpIdx - 400), catchUpIdx).includes('hydrationStable'),
  `${APP}: the catch-up sweep no longer gates on hydrationStable -- it could sweep against pre-load empty profile/done state`)

if (failures) {
  console.error(`test-orientation-quality-check: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-orientation-quality-check: OK (server gate re-checked, judgment instructions ask for substance not length, resume/linkedin/assessment get a genuine reaction instead of a canned acknowledgment, client trigger covers all nine fields with content-based dedupe, threaded through both hydration paths and the autosave blob, the 8 screen-tied fields fire from doAdvance rather than a render-driven effect, the debounced autosave is flushed before the fetch, brand-richness keeps its own outputs-driven effect, and a one-time hydration-gated sweep catches up any field left unchecked from a prior visit)')
}
