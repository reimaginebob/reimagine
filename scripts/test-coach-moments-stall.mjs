// Coach-as-Concierge Phase 3b (Output/handoff/2026-09-09_coach-concierge-
// phase-3-build-nextmove-stall.md): guards `stall`, the one-question moment
// for someone who has visited the Focus Playbook repeatedly, or sat idle on
// it, without ever building anything. Thresholds confirmed by Bob: 90
// seconds idle, 3 visits with nothing built. Static (ptw-arrival's shape),
// not generated -- no server-side changes are needed for this entry at all.
//
// Scoped deliberately narrower than "any unbuilt section": stallEligible
// requires nothing BEYOND THE FREE FIRST SECTION built for the record, not
// just one remaining section, so Stall can never compete with Next move
// (which requires a Delivery to have already fired, which requires
// something -- beyond the free first section -- already built) for the
// same identity. The first-section exclusion is batch item 1.1.5's D3 fix
// (2026-09-10): that section auto-builds the instant a role is picked
// (switchToRole), so the original "nothing built at all" check could never
// be true in practice and Stall could never fire.
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
// Copy rewritten by batch item 1.1.5 (2026-09-10, APPROVED by Bob) --
// message/quickReplies are now functions of ctx (ctx.stallTarget names the
// actual next section), not fixed values.
check(stallBlock.includes('message: (ctx) => `Nothing is built for this role yet. Want me to build ${ctx.stallTarget.label} now, or would you rather look at other roles?`'),
  `${MOMENTS}: stall's message text does not match Bob's confirmed copy (batch item 1.1.5)`)
check(stallBlock.includes('{ label: `Build ${ctx.stallTarget.label}`, value: `stall-build:${ctx.stallTarget.id}` }'),
  `${MOMENTS}: stall's "Build {firstSectionLabel}" quick reply is missing or has drifted`)
check(stallBlock.includes("{ label: 'Show me other roles', value: 'stall-redirect' }"),
  `${MOMENTS}: stall's "Show me other roles" quick reply is missing or has drifted`)
check(/onTap: \(value, ctx\) => \{\s*if \(value\.startsWith\('stall-build:'\)\) ctx\.genSec\(value\.slice\('stall-build:'\.length\)\)\s*else if \(value === 'stall-redirect'\) ctx\.advance\('focus', 'laneSelect'\)\s*return true\s*\}/.test(stallBlock),
  `${MOMENTS}: stall's onTap does not route stall-build to ctx.genSec and stall-redirect to Career Paths via ctx.advance`)

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
// Widened for batch item 1.1.5's D3 fix (2026-09-10): the .slice(1) comment
// pushed the setTimeout line past the old +700 edge.
const timerEffectBlock = timerEffectIdx !== -1 ? app.slice(timerEffectIdx, timerEffectIdx + 900) : ''
check(timerEffectBlock.includes('setStallIdleReached(false)'),
  `${APP}: the idle timer does not reset stallIdleReached on every re-arm -- a stale true from a previous visit would leak into a new one`)
check(timerEffectBlock.includes("if(step!=='focus'||!chosen||generatingSection)return"),
  `${APP}: the idle timer does not skip arming while off-screen or mid-generation`)
// .slice(1) added by batch item 1.1.5's D3 fix (2026-09-10): the free first
// section (auto-built on landing) is excluded, or the timer could never
// arm in practice.
check(timerEffectBlock.includes('const nothingBuiltYet=focusOrderFor(isIndependent).slice(1).every(s=>!done.includes(s.id))'),
  `${APP}: the idle timer does not check "nothing beyond the free first section built" before arming -- it would waste a timer on a record Stall can never fire for`)
check(timerEffectBlock.includes('stallTimerRef.current=setTimeout(()=>setStallIdleReached(true),90000)'),
  `${APP}: the idle timer is not set to 90000ms (90 seconds), or no longer sets stallIdleReached when it elapses`)
check(app.includes('},[step,chosen,selectedLane,isIndependent,generatingSection,done])'),
  `${APP}: the idle-timer effect's dependency array has drifted -- it should re-arm on navigation and on a generation starting/finishing`)

// --- The evaluator: stallEligible computed once, ctx carries it, deps updated ---
check(app.includes('const stallOrder=focusOrderFor(isIndependent)'),
  `${APP}: stallOrder (the shared basis for stallEligible and stallTarget) is missing from the Moments evaluator`)
const stallEligibleIdx = app.indexOf('const stallEligible=(()=>{')
check(stallEligibleIdx !== -1, `${APP}: the stallEligible computation is missing from the Moments evaluator`)
const stallEligibleBlock = stallEligibleIdx !== -1 ? app.slice(stallEligibleIdx, stallEligibleIdx + 500) : ''
// .slice(1) added by batch item 1.1.5's D3 fix (2026-09-10): the free first
// section is excluded from the "nothing built" requirement.
check(stallEligibleBlock.includes('if(!stallOrder.slice(1).every(s=>!done.includes(s.id)))return false'),
  `${APP}: stallEligible does not require nothing beyond the free first section built -- this is what keeps it from ever competing with Next move`)
check(stallEligibleBlock.includes('return(focusVisitCounts[idKey]||0)>=3||stallIdleReached'),
  `${APP}: stallEligible no longer checks both the 3-visit threshold and the idle timer`)
// stallTarget (batch item 1.1.5): the section right after the free first
// one -- what Stall's "Build {label}" tap actually offers.
check(app.includes('const stallTarget=stallEligible&&stallOrder[1]?{id:stallOrder[1].id,label:stallOrder[1].label}:null'),
  `${APP}: stallTarget is missing or has drifted from the Moments evaluator`)
check(app.includes('const ctx={hasOnboardingConcierge,outputs,step,signedInUser,selectedLane,chosen,isIndependent,laneLabelFor,focusLabelFor,bridgeStoryToProse,markDone,addNewOpportunity,advance,nextMoveTarget,genSec,stallEligible,stallTarget}'),
  `${APP}: the evaluator's ctx no longer carries stallEligible and stallTarget`)
// coachDistressHold/coachMoodHold appended by the engine guardrails brief
// (2026-09-09) -- stall's own two fields are still present ahead of them.
// momentReevalTick appended 2026-09-10 (live-side brief PR 1, item 1).
check(app.includes(',focusVisitCounts,stallIdleReached,coachDistressHold,coachMoodHold,momentReevalTick])'),
  `${APP}: the evaluator effect's dependency array no longer includes focusVisitCounts and stallIdleReached -- a visit or an idle timeout would not cause it to reconsider`)

// --- Prompt codes ---
check(codes.includes("'stall',"), `${CODES}: PROMPT_CODES is missing 'stall'`)

if (failures) {
  console.error(`test-coach-moments-stall: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-moments-stall: OK (static one-question entry with Bob-approved copy naming the actual target section, eligible only when nothing beyond the free first (auto-built) section is built for the record -- the D3 fix -- driven by a 90s idle timer and a 3-visit counter that are both new client state, fires once per identity, Build tap routes to ctx.genSec and the redirect tap to Career Paths, no server-side plumbing needed since it is not generated)')
}
