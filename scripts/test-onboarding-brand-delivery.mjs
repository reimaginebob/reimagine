// Guards the Personal Brand delivery presence moment (Coach-as-Concierge,
// item 1, slice 3): Coach shows up on the p3 screen the first time a
// flagged account has a built brand, and takes over the existing "does this
// capture you?" check-in's job at twoDoors rather than letting both fire two
// screens apart. Source-level for the same reason its siblings are.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(/const\[seenBrandDeliveryMoment,setSeenBrandDeliveryMoment\]=useState\(false\)/.test(app),
  `${APP}: seenBrandDeliveryMoment useState declaration is missing`)

// The trigger: p3 arrival, brand actually present, not mid-generation, once
// ever for this account.
check(/if\(step!=='p3'\|\|loading\)return/.test(app),
  `${APP}: the brand-delivery effect no longer guards on step==='p3' && !loading`)
check(/if\(seenBrandDeliveryMoment\|\|brandDeliveryFiredRef\.current\)return/.test(app),
  `${APP}: the brand-delivery effect lost its dedupe guard (flag + session ref)`)

// The suppression mechanism: this effect must mark seenPbCheckin /
// pbCheckinFiredRef satisfied itself, rather than the existing twoDoors
// check-in effect being modified to know about this one. Verifying the
// existing effect is UNTOUCHED (still fires on its own original condition)
// is what proves the two never collide without adding a dependency between
// them.
const brandDeliveryIdx = app.indexOf("if(step!=='p3'||loading)return")
const brandDeliveryBlock = app.slice(brandDeliveryIdx, brandDeliveryIdx + 400)
check(brandDeliveryBlock.includes('pbCheckinFiredRef.current=true') && brandDeliveryBlock.includes('setSeenPbCheckin(true)'),
  `${APP}: the brand-delivery effect no longer marks the existing Personal Brand check-in satisfied -- both would fire back to back at p3 and twoDoors`)

const pbCheckinIdx = app.indexOf("if(step!=='twoDoors'||!signedInUser)return")
check(pbCheckinIdx !== -1, `${APP}: could not find the existing Personal Brand check-in effect to verify it is untouched`)
const pbCheckinBlock = app.slice(pbCheckinIdx, pbCheckinIdx + 300)
check(pbCheckinBlock.includes('if(seenPbCheckin||pbCheckinFiredRef.current)return'),
  `${APP}: the existing Personal Brand check-in's own guard changed shape -- the suppression relies on it reading seenPbCheckin exactly as before`)

// Dedupe threading: both hydration paths and the autosave blob.
const hydrationHits = (app.match(/if\(d\.seenBrandDeliveryMoment\)setSeenBrandDeliveryMoment\(true\)/g) || []).length
check(hydrationHits === 2,
  `${APP}: expected seenBrandDeliveryMoment hydration in both the local pe_v4 path and the server profile/load path -- found ${hydrationHits}`)
const saveBlobIdx = app.indexOf('const blob=JSON.stringify(')
check(app.slice(saveBlobIdx, saveBlobIdx + 400).includes('seenBrandDeliveryMoment'),
  `${APP}: seenBrandDeliveryMoment is missing from the autosave blob's JSON.stringify -- the dedupe would never actually persist`)
const saveDepsIdx = app.indexOf('saveRef.current=save')
check(app.slice(saveDepsIdx, saveDepsIdx + 500).includes('seenBrandDeliveryMoment'),
  `${APP}: seenBrandDeliveryMoment is missing from the autosave effect's dependency array`)

// The delivery message itself must offer a real chat-reply path AND still
// name the "Does this feel right?" box -- both are real affordances after
// the brand-rework bridge below, and the message should not pick one over
// the other.
const deliveryMsgIdx = app.indexOf('Your story just came together above')
check(deliveryMsgIdx !== -1, `${APP}: could not find the Personal Brand delivery message`)
const deliveryMsgBlock = app.slice(deliveryMsgIdx, deliveryMsgIdx + 300)
check(deliveryMsgBlock.includes('tell me right here and I will rework it'),
  `${APP}: the brand-delivery message no longer invites a chat reply as a real way to fix the brand`)
check(deliveryMsgBlock.includes('Does this feel right?'),
  `${APP}: the brand-delivery message no longer names the "Does this feel right?" box`)

// Brand rework bridge (2026-09-04): a chat reply during the p3 delivery
// moment can act on the brand directly, not just redirect to the DTFR box.
// Guards the full one-tap capture chain: prompt instruction -> trailer ->
// header -> client offer -> confirmed write through the SAME guarded path
// the DTFR box itself uses.
const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

check(coach.includes('const BRAND_REWORK_CAPTURE_NOTE ='),
  `${COACH}: BRAND_REWORK_CAPTURE_NOTE is missing`)
check(coach.includes('a reaction is not a correction'),
  `${COACH}: BRAND_REWORK_CAPTURE_NOTE lost its instruction distinguishing a genuine correction from a mere reaction, compliment, or question`)
check(/if \(currentStep === 'p3' && hasPersonalBrand && hasOnboardingConcierge\(/.test(coach),
  `${COACH}: the brand-rework note is no longer gated on currentStep==='p3' && hasPersonalBrand && hasOnboardingConcierge -- it would leak to other steps, accounts without a built brand, or non-flagged accounts`)
check(coach.includes('profileBlock += BRAND_REWORK_CAPTURE_NOTE'),
  `${COACH}: the gated brand-rework note is no longer appended to profileBlock -- the instruction would never reach the model`)
check(/const brMatch = strippedText\.match\(\/\^\\s\*BRANDREWORK:/.test(coach),
  `${COACH}: the BRANDREWORK: trailer parser is missing`)
check(coach.includes("res.setHeader('X-Coach-Brand-Rework', brandReworkB64)"),
  `${COACH}: the X-Coach-Brand-Rework response header is no longer emitted`)

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

check(chat.includes('brandReworkCaptureActive = false'),
  `${CHAT}: the brandReworkCaptureActive prop is missing from Chat's destructured props`)
check(chat.includes("res.headers.get('X-Coach-Brand-Rework')"),
  `${CHAT}: Chat no longer reads the X-Coach-Brand-Rework header`)
check(chat.includes("checkinKey: 'brand-rework'") && chat.includes("label: 'Yes, rework it'"),
  `${CHAT}: the brand-rework one-tap offer (checkinKey + confirm button) is missing`)
check(chat.includes('Want me to rework it with that?'),
  `${CHAT}: the brand-rework offer no longer shows the note back before acting on it -- every sibling capture shows exactly what it is about to do before the tap`)

// Both <Chat> mount points must pass the prop, or the capture works in one
// surface (the floating bubble) and silently not the other (the embedded
// myCoach panel) -- the same discipline the pipeline-capture brief used.
const chatMountHits = (app.match(/brandReworkCaptureActive=\{hasOnboardingConcierge&&step==='p3'\}/g) || []).length
check(chatMountHits === 2,
  `${APP}: expected brandReworkCaptureActive passed at both <Chat> call sites -- found ${chatMountHits}`)

// The write path: MUST route through submitCorrection (Track 6 conflict
// detection) with a proceed callback that mirrors the REAL p3 "Does this
// feel right?" box's onRegenerate exactly (recordCorrection -> out('p3','')
// -> refreshP3). NOT the generic refineSec/gp/go machinery used by the
// downstream Focus sections (p5/p6/p7/p8/p9/p11/p_res/income) -- gp has no
// 'p3' case (it builds prompts FROM p3 for those sections, not p3 itself),
// so calling refineSec('p3', ...) would throw. Personal Brand's own
// build/regen path is refreshP3, called directly by its real RefineBox at
// sectionId="p3" (src/App.jsx, onRegenerate).
const brandReworkBranchIdx = app.indexOf("checkinKey==='brand-rework'")
check(brandReworkBranchIdx !== -1, `${APP}: the checkinKey==='brand-rework' branch is missing from handleEmploymentQuickReply`)
const brandReworkBranchBlock = app.slice(brandReworkBranchIdx, brandReworkBranchIdx + 500)
check(brandReworkBranchBlock.includes("submitCorrection('p3',note,()=>{"),
  `${APP}: the brand-rework write no longer routes through submitCorrection with a proceed callback -- calling refreshP3 directly would skip the conflict-detection guard the DTFR box itself gets`)
check(brandReworkBranchBlock.includes('refreshP3(note,prevBrand,prevPres)'),
  `${APP}: the brand-rework proceed callback no longer calls refreshP3 -- this is Personal Brand's real build/regen path, not the generic refineSec used by downstream Focus sections`)
check(!brandReworkBranchBlock.includes('refineSec('),
  `${APP}: the brand-rework branch calls refineSec -- gp() has no 'p3' case, so refineSec('p3', ...) throws; use refreshP3 (this is the actual bug the first draft of this feature shipped with)`)
check(brandReworkBranchBlock.includes("if(value==='dismiss')return true"),
  `${APP}: the brand-rework branch no longer handles a decline ('Not now') as a no-op`)

if (failures) {
  console.error(`test-onboarding-brand-delivery: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-onboarding-brand-delivery: OK (trigger correctly gated, existing PB check-in untouched but pre-satisfied to prevent a back-to-back duplicate, dedupe threaded through both hydration paths and the autosave blob, brand-rework bridge routes through submitCorrection+refreshP3 -- not the generic refineSec -- at both Chat mounts)')
}
