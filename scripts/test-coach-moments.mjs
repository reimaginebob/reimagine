// Coach-as-Concierge Phase 2a (Output/handoff/2026-09-08_coach-concierge-
// phase-2a-moments-core.md): guards the Moments catalog + evaluator core --
// the general mechanism the design's Section 5 asks for, sized to what this
// phase ships. One entry (Arrival on Put It to Work, migrated from the old
// one-shot orientation-route effect), the coachMoments dedupe store, both
// dismissal affordances, and the session-scoped quiet state. No server
// change: Arrival is static copy, so this is a client-only test.
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
check(app.includes('const[quietUntilReload,setQuietUntilReload]=useState(false)'), `${APP}: quietUntilReload state is missing`)
check(app.includes('const[quietScreens,setQuietScreens]=useState({})'), `${APP}: quietScreens state is missing`)

// --- The evaluator effect ---
const evalIdx = app.indexOf('for(const entry of MOMENT_CATALOG){')
check(evalIdx !== -1, `${APP}: the Moments evaluator loop is missing`)
// Window widened Phase 2b (2026-09-08): the candidates-array + priority-sort
// restructure (needed once more than one entry can be eligible at once)
// pushed the static-branch checks further from evalIdx than 2a's straight-
// line loop did.
const evalBlock = evalIdx !== -1 ? app.slice(evalIdx - 400, evalIdx + 2300) : ''
check(evalBlock.includes('if(quietUntilReload||quietScreens[step])return'),
  `${APP}: the evaluator does not respect the two quiet states before considering any entry`)
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
// 'Not on this screen' -> 'Stay quiet on this screen' 2026-09-09 by the
// voice review (Section 8): the old label read as a location description,
// not an instruction the user is giving Coach.
check(evalBlock.includes("entry.dismissible?[...entry.quickReplies,{label:'I\\'m good for now',value:'moment-quiet-session'},{label:'Stay quiet on this screen',value:'moment-quiet-screen'}]:entry.quickReplies"),
  `${APP}: a dismissible static entry's message does not append the two dismissal quick replies`)
check(evalBlock.includes('checkinKey:`moment:${entry.key}`'),
  `${APP}: the fired message's checkinKey is not the generic moment:<key> shape the tap handler expects`)
check(evalBlock.includes("if(entry.significance==='open')setCoachPresence('open')"),
  `${APP}: a significant static entry does not open the panel from minimized (Phase 1b's coachPresence)`)
check(evalBlock.includes("if(entry.promptCode)logPromptEngagement(entry.promptCode,'hub_arrival','shown')"),
  `${APP}: the evaluator does not log a 'shown' engagement event when a static moment fires, unlike every other one-shot arrival prompt`)

// --- fireMoment (Phase 2b): the model-generated-reaction sibling of
// fireOrientationCheck, same POST-and-push shape. ---
const fireMomentIdx = app.indexOf('const fireMoment=(entry,ctx)=>{')
check(fireMomentIdx !== -1, `${APP}: fireMoment is missing`)
const fireMomentBlock = fireMomentIdx !== -1 ? app.slice(fireMomentIdx, fireMomentIdx + 1600) : ''
check(app.includes('const momentFetchingRef=useRef({})'), `${APP}: momentFetchingRef state is missing`)
check(fireMomentBlock.includes('if(momentFetchingRef.current[trackKey])return'), `${APP}: fireMoment is missing its in-flight guard`)
check(fireMomentBlock.includes("body:JSON.stringify({moment:{key:entry.key,...entry.momentContext(ctx)},history:chatMessages.slice(-10),currentStep:step,situation:computeSituation(),surface:'sidebar'})"),
  `${APP}: fireMoment's /api/coach request body has drifted -- moment.key + momentContext, history, currentStep, situation, and surface are all expected`)
check(fireMomentBlock.includes("setChatMessages(m=>[...m,{role:'assistant',banner:true,content:reply,checkinKey:`moment:${entry.key}`,quickReplies}])"),
  `${APP}: fireMoment does not push the model's reply into chat with the generic moment:<key> checkinKey`)

// --- The generic tap handler ---
const tapIdx = app.indexOf("checkinKey.startsWith('moment:')")
check(tapIdx !== -1, `${APP}: the generic moment: tap handler is missing`)
const tapBlock = tapIdx !== -1 ? app.slice(tapIdx - 100, tapIdx + 700) : ''
check(tapBlock.includes("const key=checkinKey.slice(7)"), `${APP}: the tap handler does not parse the moment key out of the checkinKey`)
check(tapBlock.includes('const entry=MOMENT_CATALOG.find(e=>e.key===key)'), `${APP}: the tap handler does not resolve the fired entry from the catalog`)
check(tapBlock.includes("quiet?'declined':'accepted'"), `${APP}: the tap handler does not log accept/decline based on which value was tapped`)
check(tapBlock.includes("if(value==='moment-quiet-session'){setQuietUntilReload(true);return true}"), `${APP}: the 'I'm good for now' tap does not set the session-scoped quiet state`)
check(tapBlock.includes("if(value==='moment-quiet-screen'){setQuietScreens(s=>({...s,[step]:true}));return true}"), `${APP}: the 'Not on this screen' tap does not set the per-screen quiet state`)
check(tapBlock.includes('if(entry&&entry.onTap)return entry.onTap(value,{markDone,addNewOpportunity,advance})'),
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
  console.log('test-coach-moments: OK (ptw-arrival catalog entry with confirmed copy, old orientation-route mechanism fully retired with a read-only legacy dedupe guard, generic evaluator + tap handler wired for dismissal/quiet, coachMoments threaded through stateForSave and both hydration paths, twoDoors callout gated not deleted)')
}
