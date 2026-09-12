// Coach-as-Concierge Phase 4 Part 2, widen-the-search PR3 (Output/handoff/
// 2026-09-09_concierge-batch-and-phase4-brief.md, §2.6): "What Coach does"
// half of the set -- a prompt principle, not a condition table, so Coach
// answers a real hint the moment it comes up in conversation, which the
// client-side engine (src/widen-search.js) has no way to see or act on.
// Copy DRAFT -- Bob has not signed off on the exact wording; it ships gated
// on hasOnboardingConcierge, same as the rest of the set, for his own live
// read on his own account before anyone else sees it.
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
check(noteLine.includes('Offer the path; do not diagnose them'),
  `${COACH}: WIDEN_SEARCH_HINT_NOTE dropped "offer the path, never diagnose"`)
check(noteLine.includes('For Income Now specifically, respond to what they said and never probe the finances behind it'),
  `${COACH}: WIDEN_SEARCH_HINT_NOTE dropped the Income-Now-specific no-probing instruction`)
check(noteLine.includes('even if Reimagine has recently offered one of these and been asked to wait on it'),
  `${COACH}: WIDEN_SEARCH_HINT_NOTE does not say a hint is answered regardless of any recent snooze -- a reply, not a repeat unprompted offer`)

// t01-19 follow-up (2026-09-12 live QA): the note told the model to "offer
// to start it, with the tap" but gave it no way to actually attach one --
// every hint got real, on-topic prose that never rendered the row's real
// buttons. The note must now instruct the model to end such a reply with a
// bare WIDENSEARCH: <key> trailer naming one of the five real row keys, and
// say plainly that the line is never shown to the person.
check(noteLine.includes('WIDENSEARCH: <key>'),
  `${COACH}: WIDEN_SEARCH_HINT_NOTE does not instruct the model to emit a WIDENSEARCH: <key> trailer -- the offer has no way to attach its real buttons`)
for (const rowKey of ['widen-recruiters', 'widen-linkedin-contacts', 'widen-networking-groups', 'widen-career-club-corner', 'widen-income-now']) {
  check(noteLine.includes(rowKey), `${COACH}: WIDEN_SEARCH_HINT_NOTE does not list the real row key "${rowKey}" for the model to use in its trailer`)
}
check(noteLine.includes('never shown to the person'),
  `${COACH}: WIDEN_SEARCH_HINT_NOTE does not tell the model the trailer line is silent`)
check(noteLine.includes('do not describe the buttons in your prose'),
  `${COACH}: WIDEN_SEARCH_HINT_NOTE does not warn the model against describing the buttons instead of letting the trailer attach them`)

// Gated on hasOnboardingConcierge, the SAME flag every widen-the-search
// catalog row checks (src/coach-moments.js) -- not brandStepDone, since
// this note is about an active search (pipeline, opportunities), not an
// orientation-phase behavior like ORIENTATION_LISTENING_NOTE above it.
check(coach.includes("const widenSearchHintNote = hasOnboardingConcierge({ feature_flags: featureFlags, email: userEmail }) ? WIDEN_SEARCH_HINT_NOTE : ''"),
  `${COACH}: widenSearchHintNote is not gated on hasOnboardingConcierge`)

// Lives in the per-user UNCACHED block (buildCoachProfileSlice), not
// SYSTEM_PROMPT_HEAD/buildSystemPromptStable -- that block is the one
// cached prefix every account shares; forking it per flag would undo the
// caching reorganization (cost lever 6.3.1). Confirm it never landed there.
check(!coach.slice(coach.indexOf('const SYSTEM_PROMPT_HEAD ='), coach.indexOf('const SYSTEM_PROMPT_TAIL =')).includes('WIDEN_SEARCH_HINT_NOTE'),
  `${COACH}: WIDEN_SEARCH_HINT_NOTE leaked into SYSTEM_PROMPT_HEAD -- that block is cached and identical for every account, so this would reach every one of the 145 accounts unflagged, not just Bob's`)

// Threaded into the main profile-slice template, right after
// coachNoteAgencyNote and before the always-on capture notes.
check(coach.includes('${coachNoteAgencyNote}${widenSearchHintNote}${VALUES_CAPTURE_NOTE}'),
  `${COACH}: widenSearchHintNote is not appended in the main profile-slice template`)

// Deliberately NOT threaded into the empty-profile branch (no state object
// at all) -- that branch is definitionally pre-Personal-Brand, before any
// pipeline or opportunity could exist to hint about, unlike
// ORIENTATION_LISTENING_NOTE which is itself an orientation-phase behavior.
const emptyProfileIdx = coach.indexOf("if (!state || typeof state !== 'object')")
const emptyProfileBlock = emptyProfileIdx !== -1 ? coach.slice(emptyProfileIdx, emptyProfileIdx + 3000) : ''
check(!emptyProfileBlock.includes('widenSearchHintNote'),
  `${COACH}: widenSearchHintNote should not appear in the empty-profile branch -- there is no pipeline or search yet to hint about pre-Personal-Brand`)

if (failures) {
  console.error(`test-coach-widen-search-hint: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-widen-search-hint: OK (WIDEN_SEARCH_HINT_NOTE carries the brief\'s hint phrases and the offer-the-path/never-diagnose/never-probe-Income-Now rules, gated on hasOnboardingConcierge in the per-user uncached block rather than the shared cached prefix, and correctly absent from the pre-brand empty-profile branch)')
}
