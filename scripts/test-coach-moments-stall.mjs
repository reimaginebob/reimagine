// Coach-as-Concierge Phase 3b (Output/handoff/2026-09-09_coach-concierge-
// phase-3-build-nextmove-stall.md): guards `stall`, the one-question moment
// for someone who has visited the Focus Playbook repeatedly, or sat idle on
// it, without ever building anything. Thresholds confirmed by Bob: 90
// seconds idle, 3 visits with nothing built. Static (ptw-arrival's shape),
// not generated -- no server-side changes are needed for this entry at all.
//
// Scoped deliberately narrower than "any unbuilt section": stallEligible
// requires NOTHING built yet for the record, not just one remaining
// section, so Stall can never compete with Next move (which requires a
// Delivery to have already fired, which requires something built) for the
// same identity.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const MOMENTS = 'src/coach-moments.js'
const moments = fs.readFileSync(MOMENTS, 'utf8')
const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')
const CODES = 'src/coach-prompt-codes.js'
const codes = fs.readFileSync(CODES, 'utf8')

// --- The catalog entry itself ---
check(moments.includes("key: 'stall'"), `${MOMENTS}: the stall entry is missing`)
const stallIdx = moments.indexOf("key: 'stall'")
const stallBlock = stallIdx !== -1 ? moments.slice(stallIdx, moments.indexOf('\n  },', stallIdx)) : ''
check(stallBlock.includes("family: 'stall'"), `${MOMENTS}: stall is not tagged as the stall family`)
check(stallBlock.includes("screen: 'focus'"), `${MOMENTS}: stall is not scoped to the 'focus' screen`)
check(stallBlock.includes('dismissible: true'), `${MOMENTS}: stall is not marked dismissible`)
check(!stallBlock.includes('generated: true'), `${MOMENTS}: stall should be static, not generated -- it is one fixed question, not a judged read of content`)
check(stallBlock.includes("promptCode: 'stall'"), `${MOMENTS}: stall's promptCode is missing or has drifted`)
check(stallBlock.includes('eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.stallEligible'),
  `${MOMENTS}: stall's eligibility has drifted from reading the evaluator's own stallEligible computation`)
check(stallBlock.includes('dedupeKey: (ctx) => `${ctx.selectedLane}::${ctx.chosen}`'),
  `${MOMENTS}: stall's dedupeKey (fire once per identity, ever) is missing or has drifted`)
check(!/dedupeValue:/.test(stallBlock), `${MOMENTS}: stall should not define dedupeValue -- it fires once per identity, not on a content comparison`)
check(stallBlock.includes("message: 'You\\'ve come back to this a few times without building anything yet. What would make it worth doing right now — or would you rather look at something else?'"),
  `${MOMENTS}: stall's message text does not match Bob's confirmed copy`)
check(stallBlock.includes("{ label: 'Take me to Career Paths', value: 'stall-redirect' }"),
  `${MOMENTS}: stall's quick reply (redirect to Career Paths) is missing or has drifted`)
check(/onTap: \(value, ctx\) => \{\s*if \(value === 'stall-redirect'\) ctx\.advance\('focus', 'laneSelect'\)\s*return true\s*\}/.test(stallBlock),
  `${MOMENTS}: stall's onTap does not route the redirect tap to Career Paths via ctx.advance`)

// --- New client state: visit counting ---
check(app.includes('const[focusVisitCounts,setFocusVisitCounts]=useState({})'), `${APP}: focusVisitCounts state is missing`)
check(app.includes('const[stallIdleReached,setStallIdleReached]=useState(false)'), `${APP}: stallIdleReached state is missing`)
check(app.includes('const stallTimerRef=useRef(null)'), `${APP}: stallTimerRef is missing`)

const visitEffectIdx = app.indexOf('setFocusVisitCounts(c=>({...c,[idKey]:(c[idKey]||0)+1}))')
check(visitEffectIdx !== -1, `${APP}: the visit-counting effect is missing`)
const visitEffectBlock = visitEffectIdx !== -1 ? app.slice(visitEffectIdx - 200, visitEffectIdx + 150) : ''
check(visitEffectBlock.includes("if(step!=='focus'||!chosen)return"),
  `${APP}: the visit-counting effect does not guard on step==='focus' and a chosen role`)
check(visitEffectBlock.includes('},[step,chosen,selectedLane])'),
  `${APP}: the visit-counting effect's dependency array has drifted -- it should fire once per real navigation, not per render`)

// --- New client state: the idle timer ---
const timerEffectIdx = app.indexOf('if(stallTimerRef.current){clearTimeout(stallTimerRef.current);stallTimerRef.current=null}')
check(timerEffectIdx !== -1, `${APP}: the idle-timer arming effect is missing`)
const timerEffectBlock = timerEffectIdx !== -1 ? app.slice(timerEffectIdx, timerEffectIdx + 700) : ''
check(timerEffectBlock.includes('setStallIdleReached(false)'),
  `${APP}: the idle timer does not reset stallIdleReached on every re-arm -- a stale true from a previous visit would leak into a new one`)
check(timerEffectBlock.includes("if(step!=='focus'||!chosen||generatingSection)return"),
  `${APP}: the idle timer does not skip arming while off-screen or mid-generation`)
check(timerEffectBlock.includes('const nothingBuiltYet=focusOrderFor(isIndependent).every(s=>!done.includes(s.id))'),
  `${APP}: the idle timer does not check "nothing built at all" before arming -- it would waste a timer on a record Stall can never fire for`)
check(timerEffectBlock.includes('stallTimerRef.current=setTimeout(()=>setStallIdleReached(true),90000)'),
  `${APP}: the idle timer is not set to 90000ms (90 seconds), or no longer sets stallIdleReached when it elapses`)
check(app.includes('},[step,chosen,selectedLane,isIndependent,generatingSection,done])'),
  `${APP}: the idle-timer effect's dependency array has drifted -- it should re-arm on navigation and on a generation starting/finishing`)

// --- The evaluator: stallEligible computed once, ctx carries it, deps updated ---
const stallEligibleIdx = app.indexOf('const stallEligible=(()=>{')
check(stallEligibleIdx !== -1, `${APP}: the stallEligible computation is missing from the Moments evaluator`)
const stallEligibleBlock = stallEligibleIdx !== -1 ? app.slice(stallEligibleIdx, stallEligibleIdx + 500) : ''
check(stallEligibleBlock.includes('if(!focusOrderFor(isIndependent).every(s=>!done.includes(s.id)))return false'),
  `${APP}: stallEligible does not require nothing built at all -- this is what keeps it from ever competing with Next move`)
check(stallEligibleBlock.includes('return(focusVisitCounts[idKey]||0)>=3||stallIdleReached'),
  `${APP}: stallEligible no longer checks both the 3-visit threshold and the idle timer`)
check(app.includes('const ctx={hasOnboardingConcierge,outputs,step,signedInUser,selectedLane,chosen,isIndependent,laneLabelFor,focusLabelFor,bridgeStoryToProse,markDone,addNewOpportunity,advance,nextMoveTarget,genSec,stallEligible}'),
  `${APP}: the evaluator's ctx no longer carries stallEligible`)
// coachDistressHold/coachMoodHold appended by the engine guardrails brief
// (2026-09-09) -- stall's own two fields are still present ahead of them.
check(app.includes(',focusVisitCounts,stallIdleReached,coachDistressHold,coachMoodHold])'),
  `${APP}: the evaluator effect's dependency array no longer includes focusVisitCounts and stallIdleReached -- a visit or an idle timeout would not cause it to reconsider`)

// --- Prompt codes ---
check(codes.includes("'stall',"), `${CODES}: PROMPT_CODES is missing 'stall'`)

if (failures) {
  console.error(`test-coach-moments-stall: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-moments-stall: OK (static one-question entry with confirmed copy, eligible only when nothing is built at all for the record, driven by a 90s idle timer and a 3-visit counter that are both new client state, fires once per identity, redirect tap routes to Career Paths, no server-side plumbing needed since it is not generated)')
}
