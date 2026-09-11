// F1 twenty-minute session, item 5: the Compensation Read Delivery reply
// offered to "add a Compensation Read for one of your other law-firm-
// adjacent directions once you've got a live opening" -- a [Do it now] tap
// with nothing to act on, since the enrichment depends on a live opening the
// account does not have yet.
//
// Fix: buildFocusDeliveryReactionText (api/coach.js), the single shared
// prompt every delivery-* moment dispatches through, now instructs the model
// to only offer something actionable right now, and to treat a future-event-
// conditional idea the same as "nothing would make it better" -- end the
// read, silence allowed, rather than an offer [Do it now] cannot act on.
//
// Two voice-pattern gaps surfaced by the same production log, closed
// alongside this fix (CLAUDE.md's "pair the instruction with a detection or
// stripping mechanism" rule):
//   1. "that's not just averaging four numbers together, it's judging which
//      ones" -- a not-X-it's-Y logic-flip in contracted-subject,
//      parallel-gerund form that every existing logic-flip-* HARD_PATTERN
//      missed (they all require the literal word is/are/was/were before
//      "not", and "that's" is a contraction, not that word as a standalone
//      token). New pattern: logic-flip-contraction-parallel-gerund.
//   2. "Straight answer: ..." opened a typed reply -- a truth-announcement
//      colon-label sibling to "the honest answer" that no existing
//      sincerity pattern covered. New pattern: truth-label-opener (hard
//      pattern) + a matching deterministic stripper in
//      stripSincerityQualifiers (src/text-strippers.js).
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// api/coach.js constructs its DB and email clients eagerly at module load
// (same reasoning as test-coach-trailers.mjs's own comment on this); dummy
// values let the module load without a real connection, and neither client
// is ever touched by buildMomentTurnText.
process.env.DATABASE_URL ||= 'postgres://user:pass@localhost/dummy'
process.env.RESEND_API_KEY ||= 'dummy'
process.env.ANTHROPIC_API_KEY ||= 'dummy'

const COACH = 'api/coach.js'
const VOICE = 'src/voice-patterns.js'
const STRIPPERS = 'src/text-strippers.js'
const coach = fs.readFileSync(COACH, 'utf8')
const voice = fs.readFileSync(VOICE, 'utf8')
const strippers = fs.readFileSync(STRIPPERS, 'utf8')

// 1. Prompt instruction: buildFocusDeliveryReactionText no longer lets the
// model offer something contingent on a future event.
const fnIdx = coach.indexOf('function buildFocusDeliveryReactionText(sectionLabel, text, key) {')
check(fnIdx !== -1, `${COACH}: could not find buildFocusDeliveryReactionText`)
const fnBlock = fnIdx !== -1 ? coach.slice(fnIdx, fnIdx + 1800) : ''
check(fnBlock.includes('never something that depends on an event that has not happened yet'),
  `${COACH}: buildFocusDeliveryReactionText no longer forbids offering something contingent on a future event`)
check(fnBlock.includes('treat that the same as having nothing to add') && fnBlock.includes('If nothing would make it better, say it is good as it is and stop'),
  `${COACH}: buildFocusDeliveryReactionText no longer falls back to ending the read (silence allowed) when the only idea is future-conditional`)

// 2. Functional check: import buildMomentTurnText and confirm the actual
// text sent for delivery-salaryRead (the reported surface) carries the new
// constraint, not just some other delivery-* key.
const { buildMomentTurnText } = await import(new URL('../api/coach.js', import.meta.url))
const text = buildMomentTurnText('delivery-salaryRead', { section: 'salaryRead', sectionLabel: 'Compensation Read', text: 'Four comparable postings put base salary between $145,000 and $172,000.' })
check(text.includes('never something that depends on an event that has not happened yet'),
  'buildMomentTurnText(delivery-salaryRead, ...): the generated prompt text does not carry the future-conditional-offer constraint')

// 3. New voice patterns exist with the right shape.
check(voice.includes("name: 'logic-flip-contraction-parallel-gerund'"),
  `${VOICE}: logic-flip-contraction-parallel-gerund pattern is missing`)
check(voice.includes("name: 'truth-label-opener'"),
  `${VOICE}: truth-label-opener pattern is missing`)

// 4. Functional check on detectVoiceViolations: both reported production
// sentences are now caught, and an ordinary sentence that superficially
// resembles each is not (no new false positives).
const { detectVoiceViolations } = await import(new URL('../src/voice-patterns.js', import.meta.url))

const gerundHit = detectVoiceViolations("that's not just averaging four numbers together, it's judging which ones", { scope: 'runtime' })
check(gerundHit.some(v => v.name === 'logic-flip-contraction-parallel-gerund'),
  'detectVoiceViolations: the exact reported sentence ("that\'s not just averaging...") is not caught')

const gerundOrdinary = detectVoiceViolations("If it's not raining by noon, it's worth checking the forecast again.", { scope: 'runtime' })
check(!gerundOrdinary.some(v => v.name === 'logic-flip-contraction-parallel-gerund'),
  'detectVoiceViolations: an ordinary conditional ("if it\'s not raining...") was flagged as a false positive')

const labelHit = detectVoiceViolations('Straight answer: Interview Prep is the stronger build right now.', { scope: 'runtime' })
check(labelHit.some(v => v.name === 'truth-label-opener'),
  'detectVoiceViolations: "Straight answer:" opener is not caught')

const labelOrdinary = detectVoiceViolations('Give the interviewer a straight answer when they ask about the gap.', { scope: 'runtime' })
check(!labelOrdinary.some(v => v.name === 'truth-label-opener'),
  'detectVoiceViolations: an ordinary use of "straight answer" (no colon label) was flagged as a false positive')

// 5. Deterministic stripper: stripSincerityQualifiers now removes the
// colon-label form, matching how it already removes "the honest answer".
check(strippers.includes('const LABEL_ANSWER_RE'), `${STRIPPERS}: LABEL_ANSWER_RE is missing`)
const { stripSincerityQualifiers } = await import(new URL('../src/text-strippers.js', import.meta.url))
const stripped = stripSincerityQualifiers('Straight answer: Interview Prep is the stronger build right now.')
check(!/straight answer/i.test(stripped), 'stripSincerityQualifiers: "Straight answer:" label survived the strip')
check(stripped.trim().startsWith('Interview Prep'), 'stripSincerityQualifiers: the claim after the label was damaged, not just the label removed')

if (failures) {
  console.error(`test-coach-delivery-future-offer: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-delivery-future-offer: OK (Delivery no longer offers an enrichment gated on a future event, falling back to ending the read instead; the contracted-subject parallel-gerund logic-flip and the "Straight answer:" colon-label truth-announcement are both now detected and, for the label form, deterministically stripped)')
}
