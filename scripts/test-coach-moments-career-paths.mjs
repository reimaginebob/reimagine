// Coach-as-Concierge Phase 2b (Output/handoff/2026-09-08_coach-concierge-
// phase-2b-career-paths.md) + the Delivery fast-follow (Output/handoff/
// 2026-09-09_coach-concierge-phase-2c-delivery-remaining-sections.md):
// guards the Career Paths moments (Choice on chose-lane/chose-role,
// Delivery on all 9 generating Focus Playbook sections) and the server-side
// reaction dispatch they need -- the first entries in the Moments catalog
// whose reaction comes from the model rather than static copy. The shared
// evaluator mechanics (priority, generalized dedupe, fireMoment) that these
// entries exercise are guarded in scripts/test-coach-moments.mjs; this file
// covers what's specific to Career Paths: the catalog entries themselves,
// and api/coach.js's per-key reaction-text dispatch.
//
// The fast-follow pass also fixed two real defects in delivery-p6: outputs.
// p6 isn't reliably a string (bridgeStoryToProse normalizes it), and the
// section label sent to the server ignored the independent track (every
// Delivery entry now sends sectionLabel directly via focusLabelFor, so the
// server has one template instead of a per-key NAV_LABELS lookup).
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const MOMENTS = 'src/coach-moments.js'
const moments = fs.readFileSync(MOMENTS, 'utf8')
const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')
const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')
const CODES = 'src/coach-prompt-codes.js'
const codes = fs.readFileSync(CODES, 'utf8')

// --- career-paths-arrival: static, mirrors ptw-arrival's shape ---
check(moments.includes("key: 'career-paths-arrival'"), `${MOMENTS}: the career-paths-arrival entry is missing`)
check(moments.includes("screen: 'laneSelect'"), `${MOMENTS}: career-paths-arrival is not scoped to the laneSelect screen`)
check(!moments.includes("key: 'career-paths-arrival',\n    family: 'choice'"), `${MOMENTS}: career-paths-arrival should not be tagged as the choice family`)
// Rewritten 2026-09-09 by the voice review (Output/handoff/2026-09-09_coach-
// voice-review.md, Section 2) -- confirmed the laneSelect screen's own
// LANE_CARDS already carry a tagline + blurb per lane, so this copy
// deliberately does not restate them.
check(moments.includes('Career Paths shows you three kinds of roles you could go after, each one built from a different part of your background.'),
  `${MOMENTS}: career-paths-arrival's message text has drifted from the confirmed copy (updated 2026-09-09 by the voice review)`)

// --- The 2 Choice + 9 Delivery generated entries ---
const DELIVERY_SECTIONS = ['p5', 'p6', 'p9', 'salaryRead', 'p11', 'p_res', 'p8', 'p7', 'income']
for (const [key, screen, priority] of [['choice-lane', 'p4', 2], ['choice-role', 'focus', 2], ...DELIVERY_SECTIONS.map(s => [`delivery-${s}`, 'focus', 3])]) {
  check(moments.includes(`key: '${key}'`), `${MOMENTS}: the ${key} entry is missing`)
  check(moments.includes(`screen: '${screen}'`), `${MOMENTS}: ${key} is not scoped to the '${screen}' screen`)
  check(moments.includes(`priority: ${priority}`), `${MOMENTS}: ${key} does not carry priority ${priority}`)
}
check(moments.includes('generated: true,'), `${MOMENTS}: at least one entry should be marked generated: true`)
// 12 total as of Phase 3a: this file's own 11 (2 Choice + 9 Delivery) plus
// next-move, which scripts/test-coach-moments-next-move.mjs covers on its
// own terms -- counted here as a total-catalog sanity check, not a claim
// that all 12 belong to Career Paths' own scope.
// 20 total as of live-side brief PR 2 (2026-09-10): the original 12 (2
// Choice + 9 Delivery + next-move) plus 8 op-side generated entries (7
// delivery-op-* + op-next-move) -- scripts/test-coach-moments-ordering.mjs
// and this PR's own op-side coverage guard those on their own terms; this
// stays a total-catalog sanity check, not a claim of scope.
const generatedCount = (moments.match(/generated: true,/g) || []).length
check(generatedCount === 20, `${MOMENTS}: expected 20 generated entries total (2 Choice + 9 Delivery + next-move + 7 delivery-op-* + op-next-move), found ${generatedCount}`)

// dedupeKey: Choice keys off role/lane identity alone; Delivery keys off
// the same identity but ALSO compares content (dedupeValue), so a rebuild
// re-fires it -- this is the load-bearing distinction from Choice.
check(moments.includes('dedupeKey: (ctx) => ctx.selectedLane') , `${MOMENTS}: choice-lane's dedupeKey (fire once per lane) is missing or has drifted`)
// +1 as of Phase 3a (next-move), +1 again as of Phase 3b (stall): both
// share the identical role-identity dedupeKey shape (next-move's own
// dedupeVALUE is what makes it re-fire on a new target; stall has no
// dedupeValue at all, firing once per identity ever) -- their own test
// files cover their own shapes; this just keeps the count honest.
check((moments.match(/dedupeKey: \(ctx\) => `\$\{ctx\.selectedLane\}::\$\{ctx\.chosen\}`/g) || []).length === 1 + DELIVERY_SECTIONS.length + 1 + 1,
  `${MOMENTS}: expected the role-identity dedupeKey on choice-role, all ${DELIVERY_SECTIONS.length} Delivery entries, next-move, and stall`)
for (const s of DELIVERY_SECTIONS) {
  const expected = s === 'p6' ? 'dedupeValue: (ctx) => ctx.bridgeStoryToProse(ctx.outputs.p6)' : `dedupeValue: (ctx) => ctx.outputs.${s}`
  check(moments.includes(expected), `${MOMENTS}: delivery-${s}'s content-comparison dedupeValue is missing or has drifted`)
}
check(!moments.includes("key: 'choice-lane',") || !/key: 'choice-lane',[\s\S]{0,400}dedupeValue:/.test(moments),
  `${MOMENTS}: choice-lane should NOT define dedupeValue -- Choice fires once per identity, it does not re-fire on any later change`)

// momentContext: what each generated entry sends the server. Every Delivery
// entry sends sectionLabel (via focusLabelFor, independent-track-aware) and
// text -- p6 through bridgeStoryToProse, the rest as-is.
check(moments.includes('momentContext: (ctx) => ({ lane: ctx.selectedLane, laneLabel: ctx.laneLabelFor(ctx.selectedLane) })'),
  `${MOMENTS}: choice-lane's momentContext has drifted`)
check(moments.includes('momentContext: (ctx) => ({ roleTitle: ctx.chosen, laneLabel: ctx.laneLabelFor(ctx.selectedLane) })'),
  `${MOMENTS}: choice-role's momentContext has drifted`)
for (const s of DELIVERY_SECTIONS) {
  const text = s === 'p6' ? 'ctx.bridgeStoryToProse(ctx.outputs.p6)' : `ctx.outputs.${s}`
  const expected = `momentContext: (ctx) => ({ section: '${s}', sectionLabel: ctx.focusLabelFor('${s}', ctx.isIndependent), text: ${text} })`
  check(moments.includes(expected), `${MOMENTS}: delivery-${s}'s momentContext has drifted`)
}

// None of the 11 generated entries should carry a message/quickReplies/
// onTap of their own -- they have nothing to route to, only the two
// dismissal taps the evaluator/fireMoment already append generically.
for (const key of ['choice-lane', 'choice-role', ...DELIVERY_SECTIONS.map(s => `delivery-${s}`)]) {
  const idx = moments.indexOf(`key: '${key}'`)
  const entryBlock = idx !== -1 ? moments.slice(idx, moments.indexOf('},', idx)) : ''
  check(!/\bmessage:/.test(entryBlock), `${MOMENTS}: ${key} should not carry a static message -- it is generated`)
  check(!/\bonTap:/.test(entryBlock), `${MOMENTS}: ${key} should not carry an onTap -- reflection-only, per the resolved Question C`)
}

// The one deliberate promptCode naming exception, confirmed with Bob.
check(moments.includes("promptCode: 'delivery_comp_read'"), `${MOMENTS}: delivery-salaryRead's promptCode should be 'delivery_comp_read', not the awkward delivery_salaryread`)

// --- ctx carries what the new entries' functions need ---
// nextMoveTarget and genSec appended Phase 3a, stallEligible appended
// Phase 3b -- their own shapes are covered in test-coach-moments-next-
// move.mjs and test-coach-moments-stall.mjs; this just confirms Career
// Paths' own six fields are still present alongside them, not replaced.
// stallTarget appended by batch item 1.1.5 (2026-09-10); extended by live-
// side brief PR 2, same day, with the op-side fields (savedPlaybooks,
// opHasRecords, opNearestRecord, opPipelineArrivalCopy, opRecord,
// opNextMoveTarget, opInterviewCloseTarget, opResumeJumpTarget) -- Career
// Paths' own six fields are still present alongside both, not replaced.
check(app.includes('const ctx={hasOnboardingConcierge,outputs,step,signedInUser,selectedLane,chosen,isIndependent,laneLabelFor,focusLabelFor,bridgeStoryToProse,markDone,addNewOpportunity,advance,nextMoveTarget,genSec,stallEligible,stallTarget,savedPlaybooks,opHasRecords:!!opActiveRecords.length,opNearestRecord,opPipelineArrivalCopy,opRecord,opNextMoveTarget,opInterviewCloseTarget,opResumeJumpTarget,viewedSection,opArrivalFired,pursuitStatusLoaded}'),
  `${APP}: the evaluator's ctx is missing one of selectedLane/chosen/isIndependent/laneLabelFor/focusLabelFor/bridgeStoryToProse -- the catalog entries' eligible/dedupeKey/dedupeValue/momentContext functions need them`)

// --- Server: shape validation, authoritative gate, dispatch ---
check(coach.includes("const { message: rawMessage, history = [], currentStep, surface, general, sessionOpen, orientationCheck, postCaptureUpdate, returnSection, moment } = req.body || {}"),
  `${COACH}: moment is not destructured from the request body`)
// next-move appended Phase 3a -- its own payload/dispatch shape is covered
// in test-coach-moments-next-move.mjs. The op-side keys (7 delivery-op-* +
// op-next-move) appended by live-side brief PR 2 (2026-09-10).
check(coach.includes("const MOMENT_KEYS = ['choice-lane', 'choice-role', 'delivery-p5', 'delivery-p6', 'delivery-p9', 'delivery-salaryRead', 'delivery-p11', 'delivery-p_res', 'delivery-p8', 'delivery-p7', 'delivery-income', 'next-move', 'delivery-op-companyRead', 'delivery-op-salaryRead', 'delivery-op-p5', 'delivery-op-p_res', 'delivery-op-p_cover', 'delivery-op-p11', 'delivery-op-offerNegotiation', 'op-next-move']"),
  `${COACH}: MOMENT_KEYS is missing or has drifted from the 2 Choice + 9 Delivery keys plus next-move plus the op-side keys`)
check(/function momentPayloadOk\(key, m\) \{/.test(coach), `${COACH}: momentPayloadOk (per-key required-field validation) is missing`)
check(coach.includes("if (key.startsWith('delivery-')) return typeof m.text === 'string' && !!m.text.trim() && typeof m.sectionLabel === 'string' && !!m.sectionLabel.trim()"),
  `${COACH}: Delivery's payload check does not require non-empty text AND sectionLabel fields for every delivery- key -- an absent one would reach clip() as undefined and throw, or leave the reaction unlabeled`)
check(coach.includes('const momentShapeOk = !!(moment && typeof moment === \'object\' && typeof moment.key === \'string\' && MOMENT_KEYS.includes(moment.key) && momentPayloadOk(moment.key, moment))'),
  `${COACH}: momentShapeOk is missing or has drifted`)
check(coach.includes('&& !momentShapeOk)') && coach.includes("return res.status(400).json({ error: 'message required' })"),
  `${COACH}: the top-level message-required guard does not account for momentShapeOk`)
check(coach.includes('const momentRequested = momentShapeOk && !generalMode && hasOnboardingConcierge({ feature_flags: featureFlags, email: user.email })'),
  `${COACH}: momentRequested's authoritative gate is missing or has drifted -- the client's say-so alone must not grant it`)
check(coach.includes('momentRequested ? buildMomentTurnText(moment.key, moment)'),
  `${COACH}: the message-resolution chain does not call buildMomentTurnText for a requested moment`)
check(/export function computeTurnKind\(rawMessage, \{ orientationCheckRequested, postCaptureUpdateRequested, momentRequested, sessionOpenRequested \}\) \{/.test(coach),
  `${COACH}: computeTurnKind's signature is missing momentRequested`)
check(coach.includes("if (momentRequested) return 'moment'"), `${COACH}: computeTurnKind does not return 'moment' for a requested moment`)
check(coach.includes('const turnKind = computeTurnKind(rawMessage, { orientationCheckRequested, postCaptureUpdateRequested, momentRequested, sessionOpenRequested })'),
  `${COACH}: computeTurnKind is not called with momentRequested`)

// --- The reaction-text builders: one template shared by all 9 Delivery keys ---
check(/function buildChoiceLaneReactionText\(laneLabel\) \{/.test(coach), `${COACH}: buildChoiceLaneReactionText is missing`)
check(/function buildChoiceRoleReactionText\(roleTitle, laneLabel\) \{/.test(coach), `${COACH}: buildChoiceRoleReactionText is missing`)
check(/function buildFocusDeliveryReactionText\(sectionLabel, text\) \{/.test(coach), `${COACH}: buildFocusDeliveryReactionText is missing`)
check(coach.includes('function buildMomentTurnText(key, ctx) {'), `${COACH}: buildMomentTurnText dispatch is missing`)
check(coach.includes("if (key.startsWith('delivery-')) return buildFocusDeliveryReactionText(ctx.sectionLabel, ctx.text)"),
  `${COACH}: buildMomentTurnText no longer dispatches every delivery- key through the shared template using the client-supplied sectionLabel -- a per-key NAV_LABELS lookup here would miss the independent track`)
// Delivery's template follows the Brand richness precedent: a genuine
// strength, at most one invitation-framed suggestion, positive framing
// throughout -- never a bare correction. Wording tightened 2026-09-09 by
// the voice review (Section 5) to the same "If you want, we could add..."
// offer shape Brand richness and Choice now use; "never a correction" is
// achieved structurally by the "if nothing would make it better, say it is
// good as it is and stop" branch rather than a stated caveat.
check(coach.includes('as an offer: "If you want, we could add..."') && coach.includes('If nothing would make it better, say it is good as it is and stop'),
  `${COACH}: buildFocusDeliveryReactionText no longer frames its suggestion as an invitation-shaped offer with a genuine-stop branch -- this is the positive-framing rule the design's Delivery family and Brand richness's own template both depend on`)

// --- No new plumbing needed for effort/isSilentTurn -- both already treat
// any non-'user' turnKind identically, confirmed during Phase 2's own
// premise-verification. Guard that this stays true rather than re-deriving it. ---
check(coach.includes("const isSilentTurn = turnKind && turnKind !== 'user'"), `${COACH}: isSilentTurn no longer generalizes over turnKind -- a new turnKind value would need explicit handling`)
check(coach.includes("const effort = turnKind === 'user' ? 'medium' : 'low'"), `${COACH}: effort no longer generalizes over turnKind`)

// --- Prompt codes ---
for (const code of ['career_paths_arrival', 'choice_lane', 'choice_role', 'delivery_p5', 'delivery_p6', 'delivery_p9', 'delivery_comp_read', 'delivery_p11', 'delivery_p_res', 'delivery_p8', 'delivery_p7', 'delivery_income']) {
  check(codes.includes(`'${code}'`), `${CODES}: PROMPT_CODES is missing '${code}'`)
}

if (failures) {
  console.error(`test-coach-moments-career-paths: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-moments-career-paths: OK (career-paths-arrival static entry, 2 Choice + 9 Delivery generated entries with correct dedupe granularity and momentContext -- including the p6 bridgeStoryToProse fix and independent-track-aware sectionLabel on every Delivery entry -- ctx wiring, and the server-side moment turn kind reusing the existing silent-turn dispatch with one shared Delivery template)')
}
