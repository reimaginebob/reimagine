// Grounding fix (batch item 14, Output/handoff/2026-09-09_concierge-batch-and-
// phase4-brief.md, 2026-09-10 revision; production report L4): p_cover (Cover
// Letter) was already in FOCUS_SECTIONS.door2 and buildPlaybookExpansion would
// include its text regardless of intent -- but with no intent match bumping it
// to the front of that loop's ordering and no larger FOCUS_INTENT_CAP, it sat
// near the end of a fixed section order and could be crowded out of the
// 15000-char FOCUS_TOTAL_CAP entirely by earlier, larger built sections on the
// same playbook. Reproduced: asked directly about the cover letter, Coach said
// it had no text in front of it. The fix adds a `cover` intent branch to
// detectIntent and an INTENT_SECTION.door2.cover -> 'p_cover' mapping.
//
// api/coach.js cannot be imported live in this harness (it opens a DB
// connection at module load) -- detectIntent has no such dependency, so this
// test extracts its literal source via new Function (the established pattern
// in scripts/test-p3-amend-modes.mjs) and calls it directly for real
// behavioral coverage, rather than only asserting the source text exists.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

// --- Extract detectIntent's literal source and evaluate it standalone ---
const startMarker = 'function detectIntent(message) {'
const startIdx = coach.indexOf(startMarker)
check(startIdx !== -1, `${COACH}: detectIntent is missing`)
const bodyStart = startIdx + startMarker.length
const endIdx = coach.indexOf('\n}', bodyStart)
check(endIdx !== -1, `${COACH}: could not find detectIntent's closing brace`)
const detectIntentSrc = startIdx !== -1 && endIdx !== -1 ? coach.slice(bodyStart, endIdx) : ''
const detectIntent = new Function('message', detectIntentSrc)

if (detectIntentSrc) {
  check(detectIntent('Can you help me with my cover letter?') === 'cover',
    `detectIntent: "Can you help me with my cover letter?" should resolve to the 'cover' intent`)
  check(detectIntent('What should my cover letter say about the gap?') === 'cover',
    `detectIntent: a mid-sentence "cover letter" mention should still resolve to 'cover'`)
  check(detectIntent('Cover Letter feedback please') === 'cover',
    `detectIntent: case-insensitive "Cover Letter" should resolve to 'cover'`)
  // 'cover' is checked before 'interview'/'pitch' -- a message naming both should
  // still resolve to the deliberately-added intent, not fall through to an
  // unrelated earlier branch that happens to also match.
  check(detectIntent('Before my interview, can you review my cover letter?') === 'cover',
    `detectIntent: "cover letter" should win even when "interview" also appears in the same message`)
  // Unrelated intents are untouched by this addition.
  check(detectIntent('Can you help me prep for the interview?') === 'interview',
    `detectIntent: an unrelated interview question should still resolve to 'interview', not regress`)
  check(detectIntent('What is my resume missing?') === 'resume',
    `detectIntent: an unrelated resume question should still resolve to 'resume', not regress`)
  check(detectIntent('How is the weather today?') === null,
    `detectIntent: a message matching no intent should still return null`)
}

// --- The map entry that routes the 'cover' intent to the right section ---
check(coach.includes("door2: { interview: 'p11', pitch: 'p6', resume: 'p_res', company: 'companyRead', salary: 'salaryRead', cover: 'p_cover' }"),
  `${COACH}: INTENT_SECTION.door2 is missing the cover -> p_cover mapping, or has drifted`)

// --- The section itself already exists on both the candidates list and the
// display-name map -- confirms the fix's premise (this was a routing gap, not
// a missing section) rather than re-adding something already there ---
check(coach.includes("door2: ['p5', 'companyRead', 'salaryRead', 'p6', 'p11', 'p_res', 'p_cover', 'offerNegotiation']"),
  `${COACH}: FOCUS_SECTIONS.door2 no longer includes p_cover -- the section this fix routes to would not be surfaced at all`)
check(coach.includes("p_cover: 'COVER LETTER'"),
  `${COACH}: SECTION_NAME is missing the p_cover -> 'COVER LETTER' label`)

if (failures) {
  console.error(`test-coach-cover-letter-intent: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-cover-letter-intent: OK (detectIntent resolves cover-letter questions to the \'cover\' intent, evaluated behaviorally via its extracted source rather than only checked for presence; INTENT_SECTION.door2 routes that intent to p_cover so buildPlaybookExpansion bumps it to the front of its ordering and gives it the larger intent cap instead of letting it be crowded out of the total budget by earlier sections; unrelated intents are unaffected)')
}
