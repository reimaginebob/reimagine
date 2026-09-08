// Coach-as-Concierge Phase 2b (Output/handoff/2026-09-08_coach-concierge-
// phase-2b-career-paths.md): guards the four new Career Paths moments
// (Choice on chose-lane/chose-role, Delivery on p5/p6) and the server-side
// reaction dispatch they need -- the first entries in the Moments catalog
// whose reaction comes from the model rather than static copy. The shared
// evaluator mechanics (priority, generalized dedupe, fireMoment) that these
// entries exercise are guarded in scripts/test-coach-moments.mjs; this file
// covers what's specific to Career Paths: the catalog entries themselves,
// and api/coach.js's per-key reaction-text dispatch.
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
check(moments.includes('This is where we look at directions beyond the one you already have in hand'),
  `${MOMENTS}: career-paths-arrival's message text has drifted from the confirmed copy`)

// --- The four generated entries ---
for (const [key, screen, priority] of [['choice-lane', 'p4', 2], ['choice-role', 'focus', 2], ['delivery-p5', 'focus', 3], ['delivery-p6', 'focus', 3]]) {
  check(moments.includes(`key: '${key}'`), `${MOMENTS}: the ${key} entry is missing`)
  check(moments.includes(`screen: '${screen}'`), `${MOMENTS}: ${key} is not scoped to the '${screen}' screen`)
  check(moments.includes(`priority: ${priority}`), `${MOMENTS}: ${key} does not carry priority ${priority}`)
}
check(moments.includes('generated: true,'), `${MOMENTS}: at least one entry should be marked generated: true`)
const generatedCount = (moments.match(/generated: true,/g) || []).length
check(generatedCount === 4, `${MOMENTS}: expected exactly 4 generated entries (choice-lane, choice-role, delivery-p5, delivery-p6), found ${generatedCount}`)

// dedupeKey: Choice keys off role/lane identity alone; Delivery keys off
// the same identity but ALSO compares content (dedupeValue), so a rebuild
// re-fires it -- this is the load-bearing distinction from Choice.
check(moments.includes('dedupeKey: (ctx) => ctx.selectedLane') , `${MOMENTS}: choice-lane's dedupeKey (fire once per lane) is missing or has drifted`)
check((moments.match(/dedupeKey: \(ctx\) => `\$\{ctx\.selectedLane\}::\$\{ctx\.chosen\}`/g) || []).length === 3,
  `${MOMENTS}: expected the role-identity dedupeKey on choice-role, delivery-p5, and delivery-p6`)
check(moments.includes('dedupeValue: (ctx) => ctx.outputs.p5') && moments.includes('dedupeValue: (ctx) => ctx.outputs.p6'),
  `${MOMENTS}: Delivery's content-comparison dedupeValue (the re-fire-on-rebuild behavior) is missing for p5 and/or p6`)
check(!moments.includes("key: 'choice-lane',") || !/key: 'choice-lane',[\s\S]{0,400}dedupeValue:/.test(moments),
  `${MOMENTS}: choice-lane should NOT define dedupeValue -- Choice fires once per identity, it does not re-fire on any later change`)

// momentContext: what each generated entry sends the server.
check(moments.includes('momentContext: (ctx) => ({ lane: ctx.selectedLane, laneLabel: ctx.laneLabelFor(ctx.selectedLane) })'),
  `${MOMENTS}: choice-lane's momentContext has drifted`)
check(moments.includes('momentContext: (ctx) => ({ roleTitle: ctx.chosen, laneLabel: ctx.laneLabelFor(ctx.selectedLane) })'),
  `${MOMENTS}: choice-role's momentContext has drifted`)
check(moments.includes("momentContext: (ctx) => ({ section: 'p5', text: ctx.outputs.p5 })"),
  `${MOMENTS}: delivery-p5's momentContext has drifted`)
check(moments.includes("momentContext: (ctx) => ({ section: 'p6', text: ctx.outputs.p6 })"),
  `${MOMENTS}: delivery-p6's momentContext has drifted`)

// None of the four generated entries should carry a message/quickReplies/
// onTap of their own -- they have nothing to route to, only the two
// dismissal taps the evaluator/fireMoment already append generically.
for (const key of ['choice-lane', 'choice-role', 'delivery-p5', 'delivery-p6']) {
  const idx = moments.indexOf(`key: '${key}'`)
  const entryBlock = idx !== -1 ? moments.slice(idx, moments.indexOf('},', idx)) : ''
  check(!/\bmessage:/.test(entryBlock), `${MOMENTS}: ${key} should not carry a static message -- it is generated`)
  check(!/\bonTap:/.test(entryBlock), `${MOMENTS}: ${key} should not carry an onTap -- reflection-only, per the resolved Question C`)
}

// --- ctx carries what the new entries' functions need ---
check(app.includes('const ctx={hasOnboardingConcierge,outputs,step,signedInUser,selectedLane,chosen,laneLabelFor,markDone,addNewOpportunity,advance}'),
  `${APP}: the evaluator's ctx is missing selectedLane/chosen/laneLabelFor -- the new entries' eligible/dedupeKey/dedupeValue/momentContext functions need them`)

// --- Server: shape validation, authoritative gate, dispatch ---
check(coach.includes("const { message: rawMessage, history = [], currentStep, surface, general, sessionOpen, orientationCheck, postCaptureUpdate, returnSection, moment } = req.body || {}"),
  `${COACH}: moment is not destructured from the request body`)
check(coach.includes("const MOMENT_KEYS = ['choice-lane', 'choice-role', 'delivery-p5', 'delivery-p6']"),
  `${COACH}: MOMENT_KEYS is missing or has drifted from the four Career Paths keys`)
check(/function momentPayloadOk\(key, m\) \{/.test(coach), `${COACH}: momentPayloadOk (per-key required-field validation) is missing`)
check(coach.includes("if (key === 'delivery-p5' || key === 'delivery-p6') return typeof m.text === 'string' && !!m.text.trim()"),
  `${COACH}: Delivery's payload check does not require a non-empty text field -- an absent one would reach clip() as undefined and throw`)
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

// --- The four reaction-text builders ---
check(/function buildChoiceLaneReactionText\(laneLabel\) \{/.test(coach), `${COACH}: buildChoiceLaneReactionText is missing`)
check(/function buildChoiceRoleReactionText\(roleTitle, laneLabel\) \{/.test(coach), `${COACH}: buildChoiceRoleReactionText is missing`)
check(/function buildFocusDeliveryReactionText\(sectionLabel, text\) \{/.test(coach), `${COACH}: buildFocusDeliveryReactionText is missing`)
check(coach.includes('function buildMomentTurnText(key, ctx) {'), `${COACH}: buildMomentTurnText dispatch is missing`)
check(coach.includes("if (key === 'delivery-p5') return buildFocusDeliveryReactionText(NAV_LABELS.p5, ctx.text)") && coach.includes("if (key === 'delivery-p6') return buildFocusDeliveryReactionText(NAV_LABELS.p6, ctx.text)"),
  `${COACH}: buildMomentTurnText does not dispatch delivery-p5/delivery-p6 through the shared Delivery template with the right NAV_LABELS section label`)
// Delivery's template follows the Brand richness precedent: a genuine
// strength, at most one invitation-framed suggestion, positive framing
// throughout -- never a bare correction.
check(coach.includes('framed as an invitation ("if you\'d like...") never a correction'),
  `${COACH}: buildFocusDeliveryReactionText no longer frames its suggestion as an invitation -- this is the positive-framing rule the design's Delivery family and Brand richness's own template both depend on`)

// --- No new plumbing needed for effort/isSilentTurn -- both already treat
// any non-'user' turnKind identically, confirmed during Phase 2's own
// premise-verification. Guard that this stays true rather than re-deriving it. ---
check(coach.includes("const isSilentTurn = turnKind && turnKind !== 'user'"), `${COACH}: isSilentTurn no longer generalizes over turnKind -- a new turnKind value would need explicit handling`)
check(coach.includes("const effort = turnKind === 'user' ? 'medium' : 'low'"), `${COACH}: effort no longer generalizes over turnKind`)

// --- Prompt codes ---
for (const code of ['career_paths_arrival', 'choice_lane', 'choice_role', 'delivery_p5', 'delivery_p6']) {
  check(codes.includes(`'${code}'`), `${CODES}: PROMPT_CODES is missing '${code}'`)
}

if (failures) {
  console.error(`test-coach-moments-career-paths: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-moments-career-paths: OK (career-paths-arrival static entry, the four generated Choice/Delivery entries with correct dedupe granularity and momentContext, ctx wiring, and the server-side moment turn kind reusing the existing silent-turn dispatch with new per-key reaction-text builders)')
}
