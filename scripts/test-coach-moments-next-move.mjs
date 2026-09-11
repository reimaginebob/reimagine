// Coach-as-Concierge Phase 3a (Output/handoff/2026-09-09_coach-concierge-
// phase-3-build-nextmove-stall.md): guards `next-move`, the first Moments
// entry that is both `generated` (a real model call names why the next
// section follows) AND actionable (a "Build {label}" tap starts a real
// generation). Every entry before it was one or the other, never both --
// see the header comment above the MOMENT_CATALOG array in coach-moments.js
// for the shape this had to extend and why.
//
// The target section is resolved deterministically client-side (the next
// unbuilt Focus Playbook section after the one most recently reacted to by
// Delivery) before the model is ever called, per Phase 3's own scope-
// reduction finding -- so there is no BUILD trailer, no server-side
// situation.notBuilt validation, and no SYSTEM_PROMPT_STABLE change. This
// file covers what's specific to Next move; the shared evaluator mechanics
// (priority, dedupe, fireMoment, the tap handler) are guarded in
// test-coach-moments.mjs and test-coach-moments-career-paths.mjs.
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
const GUIDE = 'src/data/user-guide/my-coach.md'
const guide = fs.readFileSync(GUIDE, 'utf8')

// --- The catalog entry itself ---
check(moments.includes("key: 'next-move'"), `${MOMENTS}: the next-move entry is missing`)
const nmIdx = moments.indexOf("key: 'next-move'")
const nmBlock = nmIdx !== -1 ? moments.slice(nmIdx, moments.indexOf('\n  },', nmIdx)) : ''
check(nmBlock.includes("family: 'next_move'"), `${MOMENTS}: next-move is not tagged as the next_move family`)
check(nmBlock.includes("screen: 'focus'"), `${MOMENTS}: next-move is not scoped to the 'focus' screen`)
check(nmBlock.includes('generated: true'), `${MOMENTS}: next-move is not marked generated -- it needs a real model call for "why this follows"`)
check(nmBlock.includes('dismissible: true'), `${MOMENTS}: next-move is not marked dismissible`)
check(nmBlock.includes("promptCode: 'next_move'"), `${MOMENTS}: next-move's promptCode is missing or has drifted`)
check(nmBlock.includes('eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.nextMoveTarget'),
  `${MOMENTS}: next-move's eligibility (flagged account + a resolved nextMoveTarget) has drifted`)
check(nmBlock.includes('dedupeKey: (ctx) => `${ctx.selectedLane}::${ctx.chosen}`'),
  `${MOMENTS}: next-move's dedupeKey (fire once per role identity, re-fire on a new target) is missing or has drifted`)
check(nmBlock.includes('dedupeValue: (ctx) => `${ctx.nextMoveTarget.anchorLabel}::${ctx.nextMoveTarget.nextId}`'),
  `${MOMENTS}: next-move's dedupeValue does not compare both the anchor and the offered next section -- either one changing should re-fire it`)
check(nmBlock.includes('momentContext: (ctx) => ({ justBuiltLabel: ctx.nextMoveTarget.anchorLabel, nextLabel: ctx.nextMoveTarget.nextLabel })'),
  `${MOMENTS}: next-move's momentContext has drifted`)

// --- The action tap: the new capability this entry introduces ---
check(nmBlock.includes("actionReply: (ctx) => ({ label: `Build ${ctx.nextMoveTarget.nextLabel}`, value: `build_next:${ctx.nextMoveTarget.nextId}` })"),
  `${MOMENTS}: next-move's actionReply (the "Build {label}" tap) is missing or has drifted`)
check(/onTap: \(value, ctx\) => \{\s*if \(value\.startsWith\('build_next:'\)\) ctx\.genSec\(value\.slice\('build_next:'\.length\)\)\s*return true\s*\}/.test(nmBlock),
  `${MOMENTS}: next-move's onTap does not parse the target section out of the tapped value and call ctx.genSec with it`)
// No hand-authored message or quickReplies -- both come from the model
// call (fireMoment) and actionReply respectively, not static copy.
check(!/\bmessage:/.test(nmBlock), `${MOMENTS}: next-move should not carry a static message -- it is generated`)
check(!/\bquickReplies:/.test(nmBlock), `${MOMENTS}: next-move should not carry static quickReplies -- actionReply plus the generic dismissal taps cover it`)

// --- fireMoment: the shared extension that makes an actionable generated
// entry possible at all (Choice/Delivery still get none of this since
// they define no actionReply) ---
check(app.includes('const action=entry.actionReply?[entry.actionReply(ctx)]:[]'),
  `${APP}: fireMoment no longer computes an entry-specific action reply from actionReply(ctx)`)
// Dismissal taps updated by batch item 1.1.1 (2026-09-10): Remind me later
// + Minimize Coach for now replace the retired session/screen quiet taps,
// still trailing the entry's own action reply. Widened again for the
// live-side brief PR 2 production fix's offer detection (2026-09-10): an
// offerTap (Delivery-only -- next-move's family is 'next_move', so this is
// always empty for next-move itself) can now lead ahead of action, but
// action still comes immediately before the shared Remind/Minimize pair.
check(app.includes("const quickReplies=entry.dismissible?[...offerTap,...action,{label:'Remind me later',value:'moment-remind-later'},{label:'Minimize Coach for now',value:'moment-minimize'}]:[...offerTap,...action]"),
  `${APP}: fireMoment's quickReplies no longer lead with the entry's own action reply ahead of the Remind me later / Minimize Coach for now taps`)

// --- The tap handler: genSec threaded through so an actionable onTap can
// actually start a build ---
check(app.includes('if(entry&&entry.onTap)return entry.onTap(value,{markDone,addNewOpportunity,advance,genSec,'),
  `${APP}: the moment tap handler no longer passes genSec into onTap's ctx -- next-move's onTap could not start a build`)

// --- genSec/gp/go lifted to component scope, and FOCUS_ORDER to a pure
// module function -- both needed so the evaluator (component scope) and
// the 'focus' render case (still using the same functions) share one
// definition instead of two copies drifting apart ---
check(/^const focusOrderFor = \(independent\) => independent \? \[/m.test(app),
  `${APP}: focusOrderFor is not a module-level pure function of independent -- FOCUS_ORDER is still trapped inside the 'focus' render case`)
check(/^  const gp=\(id\)=>/m.test(app), `${APP}: gp is not defined at component scope`)
check(/^  const go=\(id\)=>/m.test(app), `${APP}: go is not defined at component scope`)
check(/^  const genSec=\(id\)=>id==='p6'\?generateP6\(\):generateSection\(id,gp\(id\),go\(id\)\)$/m.test(app),
  `${APP}: genSec is not defined at component scope, or its body has drifted`)
check(app.includes('const FOCUS_ORDER=focusOrderFor(isIndependent)'),
  `${APP}: the 'focus' render case no longer aliases FOCUS_ORDER from the lifted focusOrderFor -- either it kept a second inline copy, or lost the reference entirely`)

// --- nextMoveTarget: computed once in the evaluator, anchored on the most
// recently Delivery-reacted-to section (by firedAt), not "first unbuilt
// overall" -- the distinction that makes out-of-order builds work right ---
const targetIdx = app.indexOf('const nextMoveTarget=(()=>{')
check(targetIdx !== -1, `${APP}: the nextMoveTarget computation is missing from the Moments evaluator`)
const targetBlock = targetIdx !== -1 ? app.slice(targetIdx, targetIdx + 900) : ''
check(targetBlock.includes('const order=focusOrderFor(isIndependent)'),
  `${APP}: nextMoveTarget does not resolve the Focus Playbook's own build order via focusOrderFor`)
check(targetBlock.includes('coachMoments[`delivery-${s.id}`]&&coachMoments[`delivery-${s.id}`][idKey]'),
  `${APP}: nextMoveTarget no longer reads each section's own delivery-* dedupe record to find the most recently reacted-to one`)
check(targetBlock.includes('const nextSec=order.slice(anchorIdx+1).find(s=>!done.includes(s.id))'),
  `${APP}: nextMoveTarget does not find the next unbuilt section strictly after the anchor -- this is what makes out-of-order builds resolve correctly`)
// stallEligible appended Phase 3b -- next-move's own fields are still
// present alongside it, not replaced; test-coach-moments-stall.mjs covers
// stallEligible's own shape.
// stallTarget appended by batch item 1.1.5; extended by live-side brief
// PR 2, same day, with the op-side fields; next-move's own fields are
// still present alongside both, not replaced.
check(app.includes('const ctx={hasOnboardingConcierge,outputs,step,signedInUser,selectedLane,chosen,isIndependent,done,laneLabelFor,focusLabelFor,bridgeStoryToProse,markDone,addNewOpportunity,advance,nextMoveTarget,genSec,stallEligible,stallTarget,savedPlaybooks,opHasRecords:!!opActiveRecords.length,opNearestRecord,opPipelineArrivalCopy,opRecord,opNextMoveTarget,opInterviewCloseTarget,opResumeJumpTarget,viewedSection,opArrivalFired,pursuitStatusLoaded}'),
  // done added by Phase 4 §2.3's coach-intro entry (Output/handoff/2026-09-
  // 09_concierge-batch-and-phase4-brief.md).
  `${APP}: the evaluator's ctx no longer carries nextMoveTarget and genSec -- next-move's own eligible/dedupeKey/dedupeValue/momentContext/actionReply/onTap all need them`)
// momentReevalTick appended 2026-09-10 (live-side brief PR 1, item 1): forces
// a re-pick the instant an in-flight generated moment settles. savedPlaybooks/
// activePlaybooks/pursuitStatus/connNetwork/connManual/connSearch appended by
// live-side brief PR 2, same day, for the op-side ctx fields above.
check(app.includes(',done,isIndependent,focusVisitCounts,stallIdleReached,coachDistressHold,coachMoodHold,momentReevalTick,savedPlaybooks,activePlaybooks,pursuitStatus,pursuitStatusLoaded,connNetwork,connManual,connSearch,activeSectionTick])'),
  `${APP}: the evaluator effect's dependency array no longer includes done -- a build completing without an accompanying outputs/coachMoments change would leave nextMoveTarget stale`)

// --- Server: shape validation, dispatch ---
check(coach.includes("'next-move'") && coach.includes('const MOMENT_KEYS ='),
  `${COACH}: MOMENT_KEYS is missing next-move`)
check(coach.includes("if (key === 'next-move') return typeof m.justBuiltLabel === 'string' && !!m.justBuiltLabel.trim() && typeof m.nextLabel === 'string' && !!m.nextLabel.trim()"),
  `${COACH}: momentPayloadOk's next-move check is missing or has drifted -- an absent field would reach the template as undefined`)
check(/function buildNextMoveReactionText\(justBuiltLabel, nextLabel\) \{/.test(coach), `${COACH}: buildNextMoveReactionText is missing`)
check(coach.includes("if (key === 'next-move') return buildNextMoveReactionText(ctx.justBuiltLabel, ctx.nextLabel)"),
  `${COACH}: buildMomentTurnText no longer dispatches next-move to its own builder`)
// The model names why it follows; it never gets to pick the section --
// the scope-reduction finding this brief resolved on.
check(coach.includes('The next section Reimagine builds, in order, is ${nextLabel}'),
  `${COACH}: buildNextMoveReactionText no longer states the deterministic target directly -- the model must not be left to infer or choose it`)
check(coach.includes('${PLAIN_ENGLISH}'), `${COACH}: buildNextMoveReactionText should reference the shared PLAIN_ENGLISH instruction like every other reaction template`)

// --- Prompt codes (derived from MOMENT_CATALOG -- check the real exported value) ---
const { PROMPT_CODES } = await import('../src/coach-prompt-codes.js')
check(PROMPT_CODES.includes('next_move'), `${CODES}: PROMPT_CODES is missing 'next_move'`)

// --- Docs: Next move is a genuinely new capability (Coach's first ability
// to trigger an action beyond writing a profile field) -- CLAUDE.md's
// docs-stay-current rule means the My Coach chapter's "what it won't do"
// line needed to stop implying Coach can only ever point at a step. ---
check(guide.includes('the next Focus Playbook section it offers to build'),
  `${GUIDE}: the "what it won't do" section still implies Coach can never start a build -- Next move makes this untrue`)
check(guide.includes('a one-tap offer to build that section too'),
  `${GUIDE}: the "what it can do" section does not mention Next move's build offer`)

if (failures) {
  console.error(`test-coach-moments-next-move: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-moments-next-move: OK (next-move is generated AND actionable -- a real model call names why the next section follows, a Build tap starts it via the lifted component-scope genSec; fireMoment and the tap handler both carry the small additive extensions this needed; nextMoveTarget is anchored on the most recently Delivery-reacted-to section, not first-unbuilt-overall; server dispatch and docs both cover the new capability)')
}
