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

// Gating: reuses hasSectionRework, no independent-track or sightOn exclusion
// server-side (matching OPPORTUNITY_UPDATE_CAPTURE_NOTE's own precedent --
// the independent-track exclusion lives client-side).
check(/const opCardReworkNote = hasSectionRework\(\{ feature_flags: featureFlags, email: userEmail \}\) \? OP_CARD_REWORK_CAPTURE_NOTE : ''/.test(coach),
  `${COACH}: opCardReworkNote is not gated on hasSectionRework the same way opportunityUpdateNote is gated on hasPipelineCapture`)
const profileTemplateMatch = coach.match(/return `THIS USER'S REIMAGINE PROFILE[\s\S]*?`\n\}/)
check(!!profileTemplateMatch && profileTemplateMatch[0].includes('${opCardReworkNote}'),
  `${COACH}: opCardReworkNote is not spliced into the profile block template`)

// Trailer parser: reads section from the model's own json (unlike
// SECTIONREWORK, which trusts server-side context instead), validates
// against the fixed six-card enum, caps note length, never trusts an
// unvalidated section through to the client.
check(/const ocrMatch = strippedText\.match\(\/\^\\s\*OPCARDREWORK:\\s\*/.test(coach),
  `${COACH}: the OPCARDREWORK trailer regex is missing`)
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
const handlerBlock = handlerIdx !== -1 ? app.slice(handlerIdx, handlerIdx + 1400) : ''
check(handlerBlock.includes("activePlaybooks.find(r=>r&&r.source==='door2'&&String(r.title||'').toLowerCase().includes(oppName))"),
  `${APP}: does not resolve the opportunity by title the same way the opportunity-update handler does`)
check(handlerBlock.includes('const switchedView=currentSavedSlotIdRef.current!==targetRec.id') && handlerBlock.includes('if(switchedView)restoreFromSavedSlot(targetRec)'),
  `${APP}: does not switch the current slot to the matched opportunity before writing -- refineOpCard/generateOpSection operate on currentSavedSlotIdRef, so a write while a different opportunity is open would silently land on the wrong card`)
check(handlerBlock.includes("if(section==='p6')generateOpBridgeStory({refine:note})") && handlerBlock.includes('else refineOpCard(section,note)'),
  `${APP}: does not dispatch p6 through generateOpBridgeStory separately from refineOpCard, which explicitly declines to handle p6`)
check(handlerBlock.includes("I've opened it so you can watch it rebuild"),
  `${APP}: the confirmation does not say plainly that the view switched, when it did -- a silent screen change would read as a bug`)

if (failures) {
  console.error(`test-coach-op-card-rework: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-op-card-rework: OK (capture note broader than section rework and unanchored, gated on hasSectionRework, trailer validates its own section enum, Chat.jsx labels via OP_COUNTED_SECTIONS, quick-reply handler resolves by title and switches the current slot before writing)')
}
