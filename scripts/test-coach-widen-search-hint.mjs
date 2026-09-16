// Coach-as-Concierge Phase 4 Part 2, widen-the-search PR3 (Output/handoff/
// 2026-09-09_concierge-batch-and-phase4-brief.md, §2.6): "What Coach does"
// half of the set -- a prompt principle, not a condition table, so Coach
// answers a real hint the moment it comes up in conversation, which the
// client-side engine (src/widen-search.js) has no way to see or act on.
// Copy approved by Bob 2026-09-16 (copy-approval item 6), revised the same
// day for OARS and follow-the-lead: an outright hint is still answered the
// moment it comes up, but a tone-only signal gets reflected and checked
// first (see HOW YOU LISTEN), and the pipeline shape is only raised when
// the conversation is already about how the search is going. It ships
// gated on hasOnboardingConcierge, same as the rest of the set.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

check(coach.includes('const WIDEN_SEARCH_HINT_NOTE ='),
  `${COACH}: WIDEN_SEARCH_HINT_NOTE is missing`)
const noteIdx = coach.indexOf('const WIDEN_SEARCH_HINT_NOTE =')
const noteLine = noteIdx !== -1 ? coach.slice(noteIdx, coach.indexOf('\n', noteIdx + 200)) : ''
// Source escapes the apostrophe (\') since the constant is single-quoted --
// same convention the file already uses elsewhere (e.g. "doesn\'t").
for (const hint of ["I\\'ve run out of people to talk to", "there\\'s nothing out there", "I don\\'t know anyone"]) {
  check(noteLine.includes(hint), `${COACH}: WIDEN_SEARCH_HINT_NOTE is missing the hint phrase "${hint}"`)
}
check(noteLine.includes('money is getting tight'), `${COACH}: WIDEN_SEARCH_HINT_NOTE is missing the money-getting-tight hint`)
check(noteLine.includes('Offer the path and leave the diagnosis out'),
  `${COACH}: WIDEN_SEARCH_HINT_NOTE dropped "offer the path, leave the diagnosis out"`)
check(noteLine.includes('For Income Now, respond to what they said and never probe the finances behind it'),
  `${COACH}: WIDEN_SEARCH_HINT_NOTE dropped the Income-Now-specific no-probing instruction`)
check(noteLine.includes('even if they recently asked Reimagine to wait on that offer'),
  `${COACH}: WIDEN_SEARCH_HINT_NOTE does not say an outright hint is answered regardless of a recent wait-on-it ask`)
check(noteLine.includes(`the wait applies to offers raised on Reimagine\\'s own initiative, and this is a reply to what they just said`),
  `${COACH}: WIDEN_SEARCH_HINT_NOTE does not distinguish an unprompted offer's wait from a reply to what the person just said`)

// OARS revision (2026-09-16): a tone-only signal is reflected and checked
// before the offer is made, and the pipeline shape is only raised when the
// conversation is already about how the search is going -- both new
// behaviors this brief adds on top of the outright-hint case above.
check(noteLine.includes('When it is only how they sound, reflect and check first (see HOW YOU LISTEN), and make the offer once they confirm'),
  `${COACH}: WIDEN_SEARCH_HINT_NOTE does not tell the model to reflect and check a tone-only signal before offering`)
check(noteLine.includes(`Bring up their pipeline (few live opportunities, nothing added or moving in a while) only when the conversation is already about how the search is going, and then as a question (see FOLLOW THE PERSON\\'S LEAD)`),
  `${COACH}: WIDEN_SEARCH_HINT_NOTE does not scope the pipeline hint to when the conversation is already about the search`)

// t01-19 follow-up (2026-09-12 live QA): the note told the model to "offer
// to start it, with the tap" but gave it no way to actually attach one --
// every hint got real, on-topic prose that never rendered the row's real
// buttons. The note must now instruct the model to end such a reply with a
// bare WIDENSEARCH: <key> trailer naming one of the real row keys, and
// say plainly that the line is never shown to the person.
check(noteLine.includes('WIDENSEARCH: <key>'),
  `${COACH}: WIDEN_SEARCH_HINT_NOTE does not instruct the model to emit a WIDENSEARCH: <key> trailer -- the offer has no way to attach its real buttons`)
// Key list derived from WIDEN_SEARCH_ROW_KEYS (src/coach-moments.js), not
// hand-typed -- 2026-09-16 revision, so a new row never needs a matching
// hand edit here. Source-text presence of the derivation is checked
// directly; scripts/test-coach-listening-prompt.mjs checks the BUILT
// prompt actually contains every current key, which a source-text check on
// this file alone cannot (the keys never appear as literal text here).
check(noteLine.includes(`WIDEN_SEARCH_ROW_KEYS.join(', ')`),
  `${COACH}: WIDEN_SEARCH_HINT_NOTE no longer derives its key list from WIDEN_SEARCH_ROW_KEYS -- a hand-typed list would drift from the real catalog again`)
check(noteLine.includes('never shown to the person'),
  `${COACH}: WIDEN_SEARCH_HINT_NOTE does not tell the model the trailer line is silent`)
check(noteLine.includes('Leave the buttons out of your prose'),
  `${COACH}: WIDEN_SEARCH_HINT_NOTE does not warn the model against describing the buttons instead of letting the trailer attach them`)

// Gated on hasOnboardingConcierge, the SAME flag every widen-the-search
// catalog row checks (src/coach-moments.js) -- not brandStepDone, since
// this note is about an active search (pipeline, opportunities), not an
// orientation-phase behavior.
check(coach.includes("const widenSearchHintNote = hasOnboardingConcierge({ feature_flags: featureFlags, email: userEmail }) ? WIDEN_SEARCH_HINT_NOTE : ''"),
  `${COACH}: widenSearchHintNote is not gated on hasOnboardingConcierge`)

// Lives in the per-user UNCACHED block (buildCoachProfileSlice), not
// SYSTEM_PROMPT_HEAD/buildSystemPromptStable -- that block is the one
// cached prefix every account shares; forking it per flag would undo the
// caching reorganization (cost lever 6.3.1). Confirm it never landed there.
check(!coach.slice(coach.indexOf('const SYSTEM_PROMPT_HEAD ='), coach.indexOf('const SYSTEM_PROMPT_TAIL =')).includes('WIDEN_SEARCH_HINT_NOTE'),
  `${COACH}: WIDEN_SEARCH_HINT_NOTE leaked into SYSTEM_PROMPT_HEAD -- that block is cached and identical for every account, so this would reach every one of the 145 accounts unflagged, not just Bob's`)

// Threaded into the main profile-slice template as the LAST note appended
// (production fix, 2026-09-12 second live QA round on bob+lindsey@
// career.club): originally sat right after coachNoteAgencyNote, buried
// under seven more capture notes before the model ever reached the actual
// conversation -- moved to the end, closest to generation, since a real
// hint-answering turn that also fired DISCOURAGEMENT (MOOD: low) reliably
// produced the mood trailer (governed by a much earlier, far more
// prominent instruction) but never the widen-search one.
check(coach.includes('${searchIntakeNoteThisTurn}${widenSearchHintNote}`'),
  `${COACH}: widenSearchHintNote is not the last note appended in the main profile-slice template -- see the 2026-09-12 production-gap fix for why position matters here`)

// Cross-references the SAME closing-line mechanism (SELFCHECK/MOOD) the
// model already follows reliably, and states plainly that a widen-search
// offer and DISCOURAGEMENT are not mutually exclusive -- both addressing
// the production gap's own root-cause hypothesis (the offer was losing to
// DISCOURAGEMENT's own explicit, much earlier closing-format spec).
check(noteLine.includes('LOG THIS THE SAME WAY YOU ALREADY LOG YOUR VERDICT'),
  `${COACH}: WIDEN_SEARCH_HINT_NOTE does not cross-reference the SELFCHECK/MOOD "Log your verdict" mechanism the model already follows reliably`)
check(noteLine.includes('Several of these hints are discouragement too') && noteLine.includes('coach the moment the way DISCOURAGEMENT describes, and make the concrete offer'),
  `${COACH}: WIDEN_SEARCH_HINT_NOTE does not state that a widen-search offer and DISCOURAGEMENT are compatible in the same reply`)

// Deliberately NOT threaded into the empty-profile branch (no state object
// at all) -- that branch is definitionally pre-Personal-Brand, before any
// pipeline or opportunity could exist to hint about.
const emptyProfileIdx = coach.indexOf("if (!state || typeof state !== 'object')")
const emptyProfileBlock = emptyProfileIdx !== -1 ? coach.slice(emptyProfileIdx, emptyProfileIdx + 3000) : ''
check(!emptyProfileBlock.includes('widenSearchHintNote'),
  `${COACH}: widenSearchHintNote should not appear in the empty-profile branch -- there is no pipeline or search yet to hint about pre-Personal-Brand`)

if (failures) {
  console.error(`test-coach-widen-search-hint: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-widen-search-hint: OK (WIDEN_SEARCH_HINT_NOTE carries the approved hint phrases, the OARS tone-check-in and on-topic-pipeline revisions, the offer-the-path/leave-the-diagnosis-out/never-probe-Income-Now rules, and its key list derived from WIDEN_SEARCH_ROW_KEYS -- gated on hasOnboardingConcierge in the per-user uncached block rather than the shared cached prefix, and correctly absent from the pre-brand empty-profile branch)')
}
