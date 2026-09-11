// Coach-as-Concierge Phase 2a (Output/handoff/2026-09-08_coach-concierge-
// phase-2a-moments-core.md): guards the Moments catalog + evaluator core --
// the general mechanism the design's Section 5 asks for, sized to what this
// phase ships. One entry (Arrival on Put It to Work, migrated from the old
// one-shot orientation-route effect) and the coachMoments dedupe store. No
// server change: Arrival is static copy, so this is a client-only test.
// The session/screen quiet state Phase 2a originally shipped here was
// retired by batch item 1.1.4 (2026-09-10); see the Remind me later /
// Minimize Coach for now taps below instead (batch item 1.1.1).
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
check(moments.includes("key: 'ptw-arrival'"), `${MOMENTS}: the ptw-arrival entry is missing`)
check(moments.includes("screen: 'twoDoors'"), `${MOMENTS}: ptw-arrival is not scoped to the twoDoors screen`)
check(moments.includes("family: 'arrival'"), `${MOMENTS}: ptw-arrival is not tagged as the arrival family`)
check(moments.includes("significance: 'open'"), `${MOMENTS}: ptw-arrival does not open the panel from minimized -- Phase 1b's coachPresence significance link is missing`)
check(moments.includes('dismissible: true'), `${MOMENTS}: ptw-arrival is not marked dismissible -- it would not get the two quiet-state quick replies`)
check(moments.includes("promptCode: 'ptw_arrival'"), `${MOMENTS}: ptw-arrival's promptCode is missing or has drifted`)
check(moments.includes("eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!(ctx.outputs && ctx.outputs.p3)"),
  `${MOMENTS}: ptw-arrival's eligibility (flagged account + a built Personal Brand) has drifted`)
// Rewritten 2026-09-09 by the voice review (Output/handoff/2026-09-09_coach-
// voice-review.md, Section 1) -- the original wording ("anything already
// moving," "pick a direction," "build from your brand") was exactly the
// product-internal shorthand the review flagged. Design doc Section 12
// decision 4 updated to match.
check(moments.includes("Are you working on any job opportunities right now, like an application you\\'ve sent, someone who offered to refer you, or an interview coming up? If so, let\\'s start with that one. If not, we\\'ll look at the kinds of roles that fit you and build from there."),
  `${MOMENTS}: ptw-arrival's message text does not match Bob's confirmed copy (design Section 12, updated 2026-09-09 by the voice review)`)
check(moments.includes("label: 'Yes, I have one', value: 'in_motion'") && moments.includes("label: 'Not yet', value: 'fresh'"),
  `${MOMENTS}: ptw-arrival's quick replies have drifted from the confirmed labels/values`)
check(/onTap:\s*\(value,\s*ctx\)\s*=>\s*\{\s*if\s*\(value === 'in_motion'\)\s*\{\s*ctx\.markDone\('twoDoors'\);\s*ctx\.addNewOpportunity\(\)\s*\}\s*else if\s*\(value === 'fresh'\)\s*\{\s*ctx\.advance\('twoDoors', 'laneSelect'\)\s*\}\s*return true\s*\}/.test(moments),
  `${MOMENTS}: ptw-arrival's onTap no longer routes to exactly the same two actions the twoDoors screen's own door buttons perform`)

// --- The canonical prompt code ---
check(codes.includes("'ptw_arrival'"), `${CODES}: PROMPT_CODES is missing 'ptw_arrival'`)

// --- The old mechanism is fully retired, not just superseded ---
check(!app.includes('setSeenOrientationRoute') && !app.includes('orientationRouteFiredRef'),
  `${APP}: the old orientation-route setter/ref should be fully removed, not left dead alongside the new mechanism`)
check(!app.includes("checkinKey==='orientation-route'"),
  `${APP}: the old hardcoded orientation-route tap-handler branch should be removed -- the generic moment: branch replaces it`)
check(app.includes('const seenOrientationRouteRef=useRef(false)'),
  `${APP}: seenOrientationRouteRef (the read-only legacy migration guard) is missing`)

// --- New state ---
check(app.includes('const[coachMoments,setCoachMoments]=useState({})'), `${APP}: coachMoments state is missing`)
check(app.includes('const momentFiredRef=useRef(new Set())'), `${APP}: momentFiredRef is missing`)
// quietUntilReload/quietScreens retired (batch item 1.1.4, 2026-09-10): the
// session/screen quiet state and its taps are gone, not superseded --
// verify the actual state declarations and taps are removed, not left dead
// alongside the new ones (a historical mention in an explanatory comment is
// fine and expected, so this checks the specific declarations/taps rather
// than a blanket substring absence).
check(!app.includes('const[quietUntilReload,setQuietUntilReload]=useState') && !app.includes('const[quietScreens,setQuietScreens]=useState'),
  `${APP}: the retired quietUntilReload/quietScreens state declarations should be fully removed, not left dead alongside the new taps`)
check(!app.includes("value==='moment-quiet-session'") && !app.includes("value==='moment-quiet-screen'"),
  `${APP}: the retired moment-quiet-session/moment-quiet-screen taps should be fully removed`)

// --- The evaluator effect ---
const evalIdx = app.indexOf('for(const entry of MOMENT_CATALOG){')
check(evalIdx !== -1, `${APP}: the Moments evaluator loop is missing`)
// Window widened Phase 2b (2026-09-08): the candidates-array + priority-sort
// restructure (needed once more than one entry can be eligible at once)
// pushed the static-branch checks further from evalIdx than 2a's straight-
// line loop did. Widened again Phase 3a (2026-09-09): the nextMoveTarget
// computation sits between the quiet-state check and evalIdx too. Widened
// again Phase 3b: stallEligible sits between nextMoveTarget and evalIdx.
// Widened again for the engine guardrails brief: the mood-hold skip sits
// inside the loop body now, ahead of the static-branch checks. Widened
// again for the next-move dedupeValue-null-crash fix (2026-09-09): eligible()
// now runs before dedupeKey/dedupeValue, pushing the static-branch checks a
// bit further still. Widened again for the live-side brief PR 1 ordering fix
// (2026-09-10): the momentInFlightRef in-flight check (with its explanatory
// comment) sits between "if(!picked)return" and the static-branch dispatch,
// pushing everything after it further from evalIdx again. Widened again for
// batch item 1.1.5's Stall rewrite (2026-09-10): entryMessage/
// entryQuickReplies (resolving message/quickReplies as either a plain value
// or a function of ctx) sit ahead of the static-branch dispatch now. Widened
// again for live-side brief PR 2 (2026-09-10): the op-side ctx computation
// (My Pipeline arrival, Opportunity Playbook arrival, Delivery, Next move,
// Interview-close, direction-resume-jump targets) sits between stallEligible
// and the ctx object itself, ahead of evalIdx -- pushing the backward edge
// well past the old -2400 edge.
const evalBlock = evalIdx !== -1 ? app.slice(evalIdx - 12500, evalIdx + 5600) : ''
// The old quiet-states early return is retired (batch item 1.1.4/1.1.7,
// 2026-09-10): it used to block the WHOLE evaluator from running, which was
// also the significance bug (observed B4, confirmed L8/L9) -- an ordinary
// moment now still fires and lands in chatMessages while minimized (feeding
// the header pill's preview), only a significant one (entry.significance
// ==='open') still pops the panel open.
check(!evalBlock.includes('if(quietUntilReload||quietScreens[step])return'),
  `${APP}: the retired quiet-states early return should be gone -- it used to block the entire evaluator, not just the reopen`)
check(evalBlock.includes("if(entry.key==='ptw-arrival'&&seenOrientationRouteRef.current)continue"),
  `${APP}: the evaluator is missing the legacy seenOrientationRouteRef guard -- an account that already answered this under the old mechanism would see it fire again`)
// Dedupe generalized Phase 2b: a sub-key + comparable value per entry
// (defaulting to '_' / 'fired', i.e. ptw-arrival's original once-ever
// shape) instead of one boolean slot per catalog row, plus a legacy read
// for a Phase 2a-shaped {firedAt} record.
check(evalBlock.includes("const legacyFired=subKey==='_'&&coachMoments[entry.key]&&coachMoments[entry.key].firedAt&&!coachMoments[entry.key]['_']"),
  `${APP}: the evaluator is missing the Phase 2a legacy-shape dedupe read -- an account with a flat {firedAt} record (from before Phase 2b) would be treated as never-fired`)
check(evalBlock.includes('const stored=coachMoments[entry.key]&&coachMoments[entry.key][subKey]') && evalBlock.includes('if(legacyFired||(stored&&stored.value===dedupeValue))continue'),
  `${APP}: the evaluator's generalized dedupe check (sub-key + comparable value, plus the legacy-shape read) is missing or has drifted`)
check(evalBlock.includes('if(momentFiredRef.current.has(`${entry.key}:${subKey}`))continue'),
  `${APP}: the evaluator's same-session fired guard is missing or no longer keyed by entry+sub-key`)
check(evalBlock.includes('if(!entry.eligible(ctx))continue'),
  `${APP}: the evaluator does not defer to each entry's own eligibility function`)
check(evalBlock.includes('candidates.sort((a,b)=>(b.entry.priority||0)-(a.entry.priority||0))'),
  `${APP}: the evaluator does not arbitrate multiple simultaneously-eligible entries by priority`)
check(evalBlock.includes("setCoachMoments(m=>({...m,[entry.key]:{...m[entry.key],[subKey]:{value:dedupeValue,firedAt:new Date().toISOString()}}}))"),
  `${APP}: firing a moment does not record it in coachMoments under its sub-key -- it would fire again on the next render`)
check(evalBlock.includes('if(entry.generated){') && evalBlock.includes('fireMoment(entry,ctx)'),
  `${APP}: a generated entry does not dispatch through fireMoment`)
// Phase 4 §2.3 (Rows B/C) extracted the static branch's own message-firing
// logic into a standalone fireStaticEntryMessage function (near
// beginCoachRestore) so panel-lifecycle entries -- which never go through
// this screen-scoped evaluator loop at all -- can share it. The evaluator's
// static branch itself now just calls it; the checks below moved from
// evalBlock to fireStaticEntryMessage's own definition.
const staticFireIdx = app.indexOf('const fireStaticEntryMessage=(entry,ctx)=>{')
check(staticFireIdx !== -1, `${APP}: fireStaticEntryMessage is missing`)
const staticFireBlock = staticFireIdx !== -1 ? app.slice(staticFireIdx, staticFireIdx + 2400) : ''
check(evalBlock.includes('fireStaticEntryMessage(entry,ctx)'),
  `${APP}: the evaluator's static branch no longer calls fireStaticEntryMessage`)
// Taps decided (batch item 1.1.1, 2026-09-10): the old two dismissal taps
// (session/screen quiet) are replaced by one decline (Remind me later) and
// one presence control (Minimize Coach for now) -- superseding the
// 2026-09-09 voice-review rename this comment used to describe.
// entryMessage/entryQuickReplies added by batch item 1.1.5 (2026-09-10):
// message/quickReplies resolved as either a plain value or a function of
// ctx, since Stall's copy now names the actual target section -- the same
// support live-side brief PR 2's op- rows need for their own per-user
// interpolated copy (My Pipeline arrival's nearest-opportunity name, e.g.).
// No op-specific override of the tap pair itself; every op- entry uses the
// same shared Remind me later / Minimize Coach for now default.
check(staticFireBlock.includes("const entryMessage=typeof entry.message==='function'?entry.message(ctx):entry.message"),
  `${APP}: fireStaticEntryMessage no longer resolves entry.message as either a plain value or a function of ctx`)
check(staticFireBlock.includes("const entryQuickReplies=typeof entry.quickReplies==='function'?entry.quickReplies(ctx):entry.quickReplies"),
  `${APP}: fireStaticEntryMessage no longer resolves entry.quickReplies as either a plain value or a function of ctx`)
check(staticFireBlock.includes("entry.dismissible?[...entryQuickReplies,{label:'Remind me later',value:'moment-remind-later'},{label:'Minimize Coach for now',value:'moment-minimize'}]:entryQuickReplies"),
  `${APP}: a dismissible static entry's message does not append the Remind me later / Minimize Coach for now taps`)
check(staticFireBlock.includes('checkinKey:`moment:${entry.key}`'),
  `${APP}: the fired message's checkinKey is not the generic moment:<key> shape the tap handler expects`)
check(staticFireBlock.includes("if(entry.significance==='open')setCoachPresence('open')"),
  `${APP}: a significant static entry does not open the panel from minimized (Phase 1b's coachPresence)`)
check(staticFireBlock.includes("if(entry.promptCode)logPromptEngagement(entry.promptCode,'hub_arrival','shown')"),
  `${APP}: fireStaticEntryMessage does not log a 'shown' engagement event when a static moment fires, unlike every other one-shot arrival prompt`)

// --- fireMoment (Phase 2b): the model-generated-reaction sibling of
// fireOrientationCheck, same POST-and-push shape. ---
const fireMomentIdx = app.indexOf('const fireMoment=(entry,ctx)=>{')
check(fireMomentIdx !== -1, `${APP}: fireMoment is missing`)
// Widened for the live-side brief PR 1 ordering fix (2026-09-10): setting
// momentInFlightRef synchronously (with its explanatory comment) between the
// in-flight guard and the async IIFE pushed the POST body / setChatMessages
// lines further from fireMomentIdx. Widened again for batch item 1.1.1's tap
// rewrite (2026-09-10): the explanatory comment ahead of the new quickReplies
// line pushed setChatMessages further still.
// Widened again for the live-side brief PR 2 production fix's offer
// detection (2026-09-10): the offerTap comment/computation ahead of
// setChatMessages pushed it further still.
const fireMomentBlock = fireMomentIdx !== -1 ? app.slice(fireMomentIdx, fireMomentIdx + 3500) : ''
check(app.includes('const momentFetchingRef=useRef({})'), `${APP}: momentFetchingRef state is missing`)
check(fireMomentBlock.includes('if(momentFetchingRef.current[trackKey])return'), `${APP}: fireMoment is missing its in-flight guard`)
check(fireMomentBlock.includes("body:JSON.stringify({moment:{key:entry.key,...entry.momentContext(ctx)},history:chatMessages.slice(-10),currentStep:step,situation:computeSituation(),surface:'sidebar'})"),
  `${APP}: fireMoment's /api/coach request body has drifted -- moment.key + momentContext, history, currentStep, situation, and surface are all expected`)
check(fireMomentBlock.includes("setChatMessages(m=>[...m,{role:'assistant',banner:true,content:reply,checkinKey:`moment:${entry.key}`,quickReplies}])"),
  `${APP}: fireMoment does not push the model's reply into chat with the generic moment:<key> checkinKey`)

// --- The generic tap handler ---
const tapIdx = app.indexOf("checkinKey.startsWith('moment:')")
check(tapIdx !== -1, `${APP}: the generic moment: tap handler is missing`)
// Window widened Phase 3a (2026-09-09): a new comment ahead of the onTap
// dispatch line (explaining genSec) pushed it past the old +700 edge.
// Widened again for batch item 1.1.1 (2026-09-10): the retired-taps
// explanatory comment plus the new moment-minimize branch (surface-aware
// dispatch to beginCoachMinimize/setCoachOpen) sit between the entry lookup
// and the onTap dispatch line now. Widened again for live-side brief PR 2
// (2026-09-10): the five op-side onTap ctx closures (openOpRecord,
// generateOpSectionFor, opNextMoveOnTap, opInterviewCloseOnTap,
// opResumeJumpOnTap) push the window further still.
// Widened again for the live-side brief PR 2 production fix's "Do it now"
// dispatch branch (2026-09-10), which sits between the Minimize branch and
// the onTap delegation line.
const tapBlock = tapIdx !== -1 ? app.slice(tapIdx - 100, tapIdx + 3800) : ''
check(tapBlock.includes("const key=checkinKey.slice(7)"), `${APP}: the tap handler does not parse the moment key out of the checkinKey`)
check(tapBlock.includes('const entry=MOMENT_CATALOG.find(e=>e.key===key)'), `${APP}: the tap handler does not resolve the fired entry from the catalog`)
check(tapBlock.includes("declined?'declined':'accepted'"), `${APP}: the tap handler does not log accept/decline based on which value was tapped`)
check(tapBlock.includes("const declined=value==='moment-remind-later'||value==='moment-minimize'"),
  `${APP}: the tap handler's declined check no longer covers both moment-remind-later and moment-minimize`)
check(tapBlock.includes("if(value==='moment-remind-later')return true"),
  `${APP}: the 'Remind me later' tap no longer just declines -- it should have no broader session/screen effect (batch item 1.1.1)`)
check(tapBlock.includes("if(conciergeEmbedded)beginCoachMinimize()") && tapBlock.includes('else setCoachOpen(false)'),
  `${APP}: the 'Minimize Coach for now' tap does not dispatch to beginCoachMinimize (embedded) / setCoachOpen(false) (floating)`)
// genSec added Phase 3a (Next move): its onTap starts a build the same way
// the Focus Playbook screen's own Generate button does. Live-side brief PR
// 2 extends the same ctx object with the op-side equivalents.
check(tapBlock.includes('if(entry&&entry.onTap)return entry.onTap(value,{markDone,addNewOpportunity,advance,genSec,'),
  `${APP}: the tap handler does not delegate to the entry's own onTap with the App-level actions it needs`)

// --- Hydration (both paths) + autosave ---
const hydrationHits = (app.match(/if\(d\.seenOrientationRoute\)seenOrientationRouteRef\.current=true;if\(d\.coachMoments&&typeof d\.coachMoments==='object'\)setCoachMoments\(d\.coachMoments\);/g) || []).length
check(hydrationHits === 2, `${APP}: expected the legacy-guard read + coachMoments hydration in both the local pe_v4 path and the server profile/load path, found ${hydrationHits}`)
const saveBlobIdx = app.indexOf('const stateForSave={')
const saveBlobBlock = app.slice(saveBlobIdx, saveBlobIdx + 700)
check(saveBlobBlock.includes('coachMoments') && !saveBlobBlock.includes('seenOrientationRoute'),
  `${APP}: stateForSave should carry coachMoments and no longer carry seenOrientationRoute (nothing writes that key going forward)`)
const saveDepsIdx = app.indexOf('saveRef.current=save')
const saveDepsBlock = app.slice(saveDepsIdx, saveDepsIdx + 700)
check(saveDepsBlock.includes('coachMoments') && !saveDepsBlock.includes('seenOrientationRoute'),
  `${APP}: the autosave effect's dependency array should include coachMoments and no longer include seenOrientationRoute`)

// --- The existing Personal Brand check-in still excludes flagged accounts
// (ported from the retired test-onboarding-routing.mjs, which this file
// supersedes): that slot belongs to the ptw-arrival moment now, and a
// flagged account whose brand predates this feature could otherwise reach
// twoDoors with neither dedupe flag set, letting the old check-in claim
// the visit instead of the new one. ---
const pbCheckinIdx = app.indexOf("if(step!=='twoDoors'||!signedInUser)return")
check(pbCheckinIdx !== -1, `${APP}: could not find the existing Personal Brand check-in effect`)
const pbCheckinBlock = app.slice(Math.max(0, pbCheckinIdx - 60), pbCheckinIdx + 60)
check(pbCheckinBlock.includes('if(hasOnboardingConcierge)return'),
  `${APP}: the existing Personal Brand check-in no longer excludes onboarding_concierge accounts -- it could collide with the ptw-arrival moment at twoDoors`)

// --- The twoDoors CoachingCallout is gated, not deleted (it is unconditional
// today and reaches every account, not just flagged ones) ---
check(app.includes("{!hasOnboardingConcierge&&<CoachingCallout>If you have a current opportunity you're pursuing, start here."),
  `${APP}: the twoDoors CoachingCallout must be gated on !hasOnboardingConcierge, not removed outright -- non-flagged accounts get no other guidance on this screen`)

if (failures) {
  console.error(`test-coach-moments: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-moments: OK (ptw-arrival catalog entry with confirmed copy, old orientation-route mechanism fully retired with a read-only legacy dedupe guard, generic evaluator + tap handler wired for Remind me later/Minimize Coach for now (the old session/screen quiet state is fully retired), coachMoments threaded through stateForSave and both hydration paths, twoDoors callout gated not deleted)')
}
