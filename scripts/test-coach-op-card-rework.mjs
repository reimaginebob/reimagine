// Guards Card Rework (2026-09-06), Phase 1 of
// Output/handoff/2026-09-06_coach-opportunity-playbook-proactive-signals.md.
// Extends the "a chat correction reworks specific content" pattern already
// shipped for the Focus Playbook (section rework) to Opportunity Playbook
// cards, without requiring the conversation to be anchored to that card's
// own screen -- Coach can propose reworking a built card from anywhere in a
// conversation about that opportunity, on a correction or new steering
// information alike (a recruiter's "push the supply chain angle harder" was
// never wrong; it's new information the card should reflect). Reuses
// SECTION_REWORK_FLAG rather than a new flag (Bob's confirmed decision).
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const FLAGS = 'api/_lib/feature-flags.js'
const flags = fs.readFileSync(FLAGS, 'utf8')

check(flags.includes('Extended 2026-09-06 to also gate Card Rework'),
  `${FLAGS}: SECTION_REWORK_FLAG's header comment was not updated to reflect its broader scope -- it would misdescribe what the flag now gates`)

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

// The capture note itself: broader trigger (steering input, not just
// corrections), no screen-anchoring (names both opportunity and section),
// never claims to have written anything.
check(coach.includes('const OP_CARD_REWORK_CAPTURE_NOTE ='),
  `${COACH}: OP_CARD_REWORK_CAPTURE_NOTE is missing`)
check(coach.includes('new information they only just learned'),
  `${COACH}: the capture note does not cover steering input distinct from a correction`)
check(coach.includes('OPCARDREWORK: {"opportunity"') && coach.includes('"section":"p_res"'),
  `${COACH}: the capture note's trailer example is missing or no longer names both opportunity and section`)
check(coach.includes('NEVER SAY YOU HAVE UPDATED, REWORKED, OR CHANGED ANYTHING'),
  `${COACH}: the capture note does not forbid claiming an unmade write`)
check(coach.includes('Only propose a card that is already built'),
  `${COACH}: the capture note does not restrict itself to already-built cards`)

// Gating: reuses hasSectionRework, plus the same independent-track exclusion
// as the other four My Pipeline notes (My Coach review, finding #2.6c --
// the client already required !isIndependent at the mount props, so a
// flagged independent-track account previously had the model emit an
// OPCARDREWORK offer the client silently discarded).
check(/const opCardReworkNote = hasSectionRework\(\{ feature_flags: featureFlags, email: userEmail \}\) && !independent \? OP_CARD_REWORK_CAPTURE_NOTE : ''/.test(coach),
  `${COACH}: opCardReworkNote is not gated on hasSectionRework && !independent the same way the other My Pipeline notes are`)
const profileTemplateMatch = coach.match(/return `THIS USER'S REIMAGINE PROFILE[\s\S]*?`\n\}/)
check(!!profileTemplateMatch && profileTemplateMatch[0].includes('${opCardReworkNote}'),
  `${COACH}: opCardReworkNote is not spliced into the profile block template`)

// Trailer parser: reads section from the model's own json (unlike
// SECTIONREWORK, which trusts server-side context instead), validates
// against the fixed six-card enum, caps note length, never trusts an
// unvalidated section through to the client.
check(coach.includes("extractTrailer(strippedText, 'OPCARDREWORK')"),
  `${COACH}: the OPCARDREWORK trailer parser is missing`)
check(coach.includes("['companyRead', 'p5', 'p6', 'p_res', 'p_cover', 'p11'].includes(section)"),
  `${COACH}: the op-card-rework parser does not validate section against the fixed enum`)
check(/if \(validSection && note\) opCardReworkB64 = Buffer\.from/.test(coach),
  `${COACH}: opCardReworkB64 is not built only when both section and note are valid`)
check(coach.includes("res.setHeader('X-Coach-Op-Card-Rework', opCardReworkB64)"),
  `${COACH}: the X-Coach-Op-Card-Rework response header is not set`)

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

check(chat.includes("import { OP_COUNTED_SECTIONS } from '../playbook-sections.js'"),
  `${CHAT}: does not import OP_COUNTED_SECTIONS -- the canonical, cross-boundary-safe label source that scripts/test-playbook-sections.mjs already keeps in sync with App.jsx's own OP_CARD_LABELS, rather than a second driftable copy`)
check(chat.includes('opCardReworkCaptureActive = false,'),
  `${CHAT}: Chat() is missing the opCardReworkCaptureActive prop`)
check(chat.includes("const ocrHeader = res.headers.get('X-Coach-Op-Card-Rework') || null"),
  `${CHAT}: does not read the X-Coach-Op-Card-Rework header`)
check(chat.includes('if (opCardReworkCaptureActive && ocrHeader)'),
  `${CHAT}: the op-card-rework capture block is not gated on its capture-active prop`)
check(chat.includes("checkinKey: 'op-card-rework',"),
  `${CHAT}: the tap offer does not carry the op-card-rework checkinKey`)
check(chat.includes("const label = (OP_COUNTED_SECTIONS.find(s => s.key === section) || {}).label || section"),
  `${CHAT}: the tap offer does not name the card by its user-facing label via OP_COUNTED_SECTIONS`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(/const OP_CARD_LABELS=\{companyRead:/.test(app),
  `${APP}: OP_CARD_LABELS is no longer defined inline -- scripts/test-playbook-sections.mjs's drift check against OP_COUNTED_SECTIONS depends on finding it here`)
check((app.match(/opCardReworkCaptureActive=\{hasPipeline&&!isIndependent&&hasSectionRework\}/g) || []).length === 2,
  `${APP}: opCardReworkCaptureActive is not wired identically at both <Chat> mount sites`)

// The quick-reply write path: resolves the opportunity by title (falling
// back to coachSaveTarget, exactly like opportunity-update above it),
// switches the current slot before writing (refineOpCard/generateOpSection
// operate on currentSavedSlotIdRef, not a passed id -- unlike
// savePursuit/updateOpPanel, which the opportunity-update handler uses on an
// arbitrary matched id without switching views), and dispatches p6 through
// generateOpBridgeStory rather than refineOpCard, which explicitly excludes it.
const handlerIdx = app.indexOf("if(checkinKey==='op-card-rework'){")
check(handlerIdx !== -1, `${APP}: the op-card-rework quick-reply handler is missing`)
const handlerBlock = handlerIdx !== -1 ? app.slice(handlerIdx, handlerIdx + 700) : ''
// Title resolution (2026-09-07, same-name opportunity resolution fix): the
// handler now resolves through the shared resolveOpportunityByName instead
// of calling activePlaybooks.find directly. The actual write logic
// (slot-switch, p6 dispatch, confirmation copy) moved into execOpCardRework
// so a disambiguation tap can call the same code a unique-match tap does --
// look there for what the write actually does.
check(handlerBlock.includes('resolveOpportunityByName(activePlaybooks,data.opportunity)'),
  `${APP}: does not resolve the opportunity by title the same way the other opportunity mechanisms do`)
const execIdx = app.indexOf('const execOpCardRework=')
check(execIdx !== -1, `${APP}: execOpCardRework is missing -- the op-card-rework write logic should live in its own function, shared with the disambiguation-tap path`)
const execBlock = execIdx !== -1 ? app.slice(execIdx, execIdx + 1400) : ''
check(execBlock.includes('const switchedView=currentSavedSlotIdRef.current!==targetRec.id') && execBlock.includes('restoreFromSavedSlot(targetRec)'),
  `${APP}: does not switch the current slot to the matched opportunity before writing -- refineOpCard/generateOpSection operate on currentSavedSlotIdRef, so a write while a different opportunity is open would silently land on the wrong card`)
check(execBlock.includes("if(section==='p6')generateOpBridgeStory({refine:note})") && execBlock.includes('else refineOpCard(section,note)'),
  `${APP}: does not dispatch p6 through generateOpBridgeStory separately from refineOpCard, which explicitly declines to handle p6`)
check(execBlock.includes("I've opened it so you can watch it rebuild"),
  `${APP}: the confirmation does not say plainly that the view switched, when it did -- a silent screen change would read as a bug`)

// My Coach review, finding #4.4: restoreFromSavedSlot's setOutputs/
// setChosen/setStep are async state updates, so calling
// refineOpCard/generateOpBridgeStory synchronously right after it (the
// original shape) read the PREVIOUS opportunity's outputs/chosen from a
// now-stale closure, rebuilding the card against the wrong opportunity's
// data. The rework is now queued and only actually dispatched once the
// switch has landed in a real render.
check(execBlock.includes('_pendingOpCardReworkRef.current={slotId:targetRec.id,section,note}'),
  `${APP}: a slot-switching rework no longer queues itself instead of firing synchronously against a stale closure -- this is the exact bug in finding #4.4`)
check(!/if\(switchedView\)restoreFromSavedSlot\(targetRec\)\s*\n\s*if\(section==='p6'\)generateOpBridgeStory/.test(app),
  `${APP}: refineOpCard/generateOpBridgeStory appear to run synchronously right after restoreFromSavedSlot again -- this is finding #4.4's stale-closure bug`)
const pendingEffectIdx = app.indexOf('const pending=_pendingOpCardReworkRef.current')
check(pendingEffectIdx !== -1, `${APP}: the deferred op-card-rework effect is missing`)
const pendingEffectBlock = pendingEffectIdx !== -1 ? app.slice(pendingEffectIdx, pendingEffectIdx + 350) : ''
check(pendingEffectBlock.includes('currentSavedSlotIdRef.current!==pending.slotId'),
  `${APP}: the deferred op-card-rework effect no longer guards against a second, newer switch superseding this one`)
check(pendingEffectBlock.includes("if(pending.section==='p6')generateOpBridgeStory({refine:pending.note})") && pendingEffectBlock.includes('else refineOpCard(pending.section,pending.note)'),
  `${APP}: the deferred op-card-rework effect no longer dispatches p6 through generateOpBridgeStory separately from refineOpCard`)
const pendingEffectDepsIdx = app.indexOf('},[step,outputs,chosen])', pendingEffectIdx)
check(pendingEffectDepsIdx !== -1 && pendingEffectDepsIdx - pendingEffectIdx < 400,
  `${APP}: the deferred op-card-rework effect is not keyed on [step,outputs,chosen] -- outputs always gets a fresh reference from restoreFromSavedSlot, which is what guarantees this effect re-runs on the render where the switch actually lands`)

if (failures) {
  console.error(`test-coach-op-card-rework: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-op-card-rework: OK (capture note broader than section rework and unanchored, gated on hasSectionRework, trailer validates its own section enum, Chat.jsx labels via OP_COUNTED_SECTIONS, quick-reply handler resolves by title and switches the current slot before writing, a slot-switching rework is queued and deferred to the render where the switch actually lands instead of firing against a stale closure)')
}
