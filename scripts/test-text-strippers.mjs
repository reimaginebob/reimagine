// Unit tests for src/text-strippers.mjs (Foundation B.1, PR #85).
// Wired into prebuild via package.json so a regression on stripCoachSpeak or
// applyContaminationPlaceholders fails the build before the bundle ships.
//
// Coverage:
//   1. stripCoachSpeak: each of the 8 substitutions applies on its target;
//      clean input passes through unchanged; idempotence
//      (stripCoachSpeak(stripCoachSpeak(x)) === stripCoachSpeak(x));
//      word-boundary correctness (facilitator NOT touched by facilitate);
//      multi-substitution-in-one-input.
//   2. applyContaminationPlaceholders: each of the 5 placeholders applies
//      on its target phrase; clean input passes through unchanged.

import { stripCoachSpeak, applyContaminationPlaceholders, CONTAMINATION_PLACEHOLDERS, stripLogicFlipCadence, stripSincerityQualifiers, stripComparativeStanding, stripIntensifiers, applyOutputStrippers } from '../src/text-strippers.mjs'

let failed = 0
let total = 0

function assertEq(label, actual, expected) {
  total++
  if (actual !== expected) {
    console.error(`FAIL: ${label}`)
    console.error(`  expected: ${JSON.stringify(expected)}`)
    console.error(`  got:      ${JSON.stringify(actual)}`)
    failed++
  }
}

function assertTruthy(label, cond, detail) {
  total++
  if (!cond) {
    console.error(`FAIL: ${label}`)
    if (detail) console.error(`  detail: ${detail}`)
    failed++
  }
}

// ---- stripCoachSpeak: per-substitution positive cases ------------------

assertEq('stripCoachSpeak: "in service of" -> "for"',
  stripCoachSpeak('The function exists in service of the mission.'),
  'The function exists for the mission.')

assertEq('stripCoachSpeak: "trace that line" -> "follow that"',
  stripCoachSpeak('You can trace that line through three roles.'),
  'You can follow that through three roles.')

assertEq('stripCoachSpeak: "comes alive in" -> "thrives in"',
  stripCoachSpeak('She comes alive in mission-driven work.'),
  'She thrives in mission-driven work.')

assertEq('stripCoachSpeak: "speaks to" -> "points to"',
  stripCoachSpeak('This speaks to the broader pattern.'),
  'This points to the broader pattern.')

assertEq('stripCoachSpeak: "shows up as" -> "looks like"',
  stripCoachSpeak('That capability shows up as cross-functional fluency.'),
  'That capability looks like cross-functional fluency.')

assertEq('stripCoachSpeak: "leverage" -> "use"',
  stripCoachSpeak('You can leverage your network here.'),
  'You can use your network here.')

assertEq('stripCoachSpeak: "utilize" -> "use"',
  stripCoachSpeak('You can utilize your existing relationships.'),
  'You can use your existing relationships.')

assertEq('stripCoachSpeak: "facilitate" -> "support"',
  stripCoachSpeak('A program manager facilitate the cross-team work.'),
  'A program manager support the cross-team work.')

// ---- stripCoachSpeak: case-insensitive matching ------------------------

assertEq('stripCoachSpeak: case-insensitive ("Leverage" capitalized)',
  stripCoachSpeak('Leverage the work you have already done.'),
  'use the work you have already done.')

assertEq('stripCoachSpeak: case-insensitive ("Speaks To" mixed case)',
  stripCoachSpeak('That Speaks To something deeper.'),
  'That points to something deeper.')

// ---- stripCoachSpeak: word boundaries + inflection preservation -------

assertEq('stripCoachSpeak: "facilitator" is NOT touched (word boundary blocks)',
  stripCoachSpeak('A facilitator runs the workshop.'),
  'A facilitator runs the workshop.')

assertEq('stripCoachSpeak: "facilitates" -> "supports" (s preserved)',
  stripCoachSpeak('She facilitates the meeting weekly.'),
  'She supports the meeting weekly.')

assertEq('stripCoachSpeak: "facilitated" -> "supported" (d preserved)',
  stripCoachSpeak('She facilitated the meeting last week.'),
  'She supported the meeting last week.')

assertEq('stripCoachSpeak: "facilitating" -> "supporting" (ing preserved)',
  stripCoachSpeak('She is facilitating the meeting now.'),
  'She is supporting the meeting now.')

assertEq('stripCoachSpeak: "leverages" -> "uses" (s preserved)',
  stripCoachSpeak('She leverages her network often.'),
  'She uses her network often.')

assertEq('stripCoachSpeak: "leveraged" -> "used" (d preserved)',
  stripCoachSpeak('She leveraged her network to land the meeting.'),
  'She used her network to land the meeting.')

assertEq('stripCoachSpeak: "leveraging" -> "using" (ing preserved)',
  stripCoachSpeak('She has been leveraging her network for years.'),
  'She has been using her network for years.')

assertEq('stripCoachSpeak: "utilizing" -> "using" (ing preserved)',
  stripCoachSpeak('She has been utilizing her network for years.'),
  'She has been using her network for years.')

assertEq('stripCoachSpeak: "utilized" -> "used" (d preserved)',
  stripCoachSpeak('She utilized every connection available.'),
  'She used every connection available.')

// ---- stripCoachSpeak: clean input passes through ----------------------

assertEq('stripCoachSpeak: clean input unchanged',
  stripCoachSpeak('She used her network to reach the hiring manager directly.'),
  'She used her network to reach the hiring manager directly.')

assertEq('stripCoachSpeak: empty string unchanged', stripCoachSpeak(''), '')

assertEq('stripCoachSpeak: null unchanged', stripCoachSpeak(null), null)

assertEq('stripCoachSpeak: non-string unchanged', stripCoachSpeak(42), 42)

// ---- stripCoachSpeak: idempotence -------------------------------------

{
  const once = stripCoachSpeak('She leverages her network to facilitate growth.')
  const twice = stripCoachSpeak(once)
  assertEq('stripCoachSpeak: idempotent on substituted output', twice, once)
}

{
  const once = stripCoachSpeak('You comes alive in this work; you can leverage what you know.')
  const twice = stripCoachSpeak(once)
  assertEq('stripCoachSpeak: idempotent on multi-substitution output', twice, once)
}

// ---- stripCoachSpeak: multi-substitution in one input -----------------

assertEq('stripCoachSpeak: four substitutions in one input',
  stripCoachSpeak('We leverage facilitation in service of utilizing growth.'),
  'We use facilitation for using growth.')
// Note: "facilitation" the noun is NOT touched by \bfacilitate\b (correct).

assertEq('stripCoachSpeak: substitutions across multiple sentences (inflection preserved)',
  stripCoachSpeak('She leverages her network. The work comes alive in nonprofit settings. That speaks to her conviction.'),
  'She uses her network. The work thrives in nonprofit settings. That points to her conviction.')

// ---- applyContaminationPlaceholders: per-substitution positive cases --

assertEq('applyContaminationPlaceholders: "Pia Lopez" -> "[the user]"',
  applyContaminationPlaceholders('Then Pia Lopez walked into the room.'),
  'Then [the user] walked into the room.')

assertEq('applyContaminationPlaceholders: "food bank in Sacramento" -> placeholder',
  applyContaminationPlaceholders('She runs a food bank in Sacramento.'),
  'She runs a [their work setting].')

assertEq('applyContaminationPlaceholders: "the staff knows the regulars by name" -> placeholder',
  applyContaminationPlaceholders('It is the kind of place where the staff knows the regulars by name.'),
  'It is the kind of place where [a specific detail from their work].')

assertEq('applyContaminationPlaceholders: "caregiving years do not appear on a resume" -> placeholder',
  applyContaminationPlaceholders('Caregiving years do not appear on a resume.'),
  '[whatever years are missing from the resume].')

assertEq("applyContaminationPlaceholders: \"grant cycles and other people's good intentions\" -> placeholder",
  applyContaminationPlaceholders("Held together with grant cycles and other people's good intentions."),
  'Held together with [the constraints of their work].')

// ---- applyContaminationPlaceholders: pass-through and edge cases ------

assertEq('applyContaminationPlaceholders: clean input unchanged',
  applyContaminationPlaceholders('This is a profile about the actual user with their actual evidence.'),
  'This is a profile about the actual user with their actual evidence.')

assertEq('applyContaminationPlaceholders: empty string', applyContaminationPlaceholders(''), '')

assertEq('applyContaminationPlaceholders: null', applyContaminationPlaceholders(null), null)

assertEq('applyContaminationPlaceholders: similar but distinct (Maria Lopez) NOT touched',
  applyContaminationPlaceholders('Then Maria Lopez walked into the room.'),
  'Then Maria Lopez walked into the room.')

// ---- applyContaminationPlaceholders: multi-substitution in one input --

assertEq('applyContaminationPlaceholders: two contaminations in one input',
  applyContaminationPlaceholders('Pia Lopez runs a food bank in Sacramento.'),
  '[the user] runs a [their work setting].')

// ---- applyContaminationPlaceholders: guide-injection echoes (PR 1) -----

assertEq('applyContaminationPlaceholders: will-to-stay-breaking',
  applyContaminationPlaceholders('What runs through your work is the will to stay inside something while it is breaking.'),
  "What runs through your work is [the through-line in the user's own terms].")
assertEq('applyContaminationPlaceholders: mapping-the-entire-spend',
  applyContaminationPlaceholders('The savings came from mapping the entire spend.'),
  'The savings came from [what the user actually did].')

// ---- applyContaminationPlaceholders: export sanity --------------------

assertTruthy('CONTAMINATION_PLACEHOLDERS is an array of 7 entries',
  Array.isArray(CONTAMINATION_PLACEHOLDERS) && CONTAMINATION_PLACEHOLDERS.length === 7,
  `got length=${Array.isArray(CONTAMINATION_PLACEHOLDERS) ? CONTAMINATION_PLACEHOLDERS.length : typeof CONTAMINATION_PLACEHOLDERS}`)

// ---- stripLogicFlipCadence: positive cases (must rewrite) -------------
// 2026-06-01 (PR after #133): deterministic strip for the model-robust
// "X is not Y. It is Z." logic-flip cadence. Drops the negation sentence,
// keeps the positive claim with the original subject restored.

assertEq('stripLogicFlipCadence: plural ("These are not ... They are ...")',
  stripLogicFlipCadence('These are not optimizations. They are architectures.'),
  'These are architectures.')

assertEq('stripLogicFlipCadence: abstract noun-phrase subject (post-PR-132 smoke)',
  stripLogicFlipCadence('The answer to that question is not a feeling. It is architecture.'),
  'The answer to that question is architecture.')

assertEq('stripLogicFlipCadence: possessive singular subject',
  stripLogicFlipCadence('Your career is not about building products. It is about understanding how people experience reality.'),
  'Your career is about understanding how people experience reality.')

assertEq('stripLogicFlipCadence: demonstrative subject',
  stripLogicFlipCadence('This is not a coincidence. It is a pattern.'),
  'This is a pattern.')

assertEq('stripLogicFlipCadence: repeated (non-pronoun) subject',
  stripLogicFlipCadence('The plan is not a forecast. The plan is a commitment.'),
  'The plan is a commitment.')

// ---- stripLogicFlipCadence: negative cases (must stay unchanged) ------

assertEq('stripLogicFlipCadence: no positive counter-assertion stays unchanged',
  stripLogicFlipCadence('The plan is not finalized. It requires more input.'),
  'The plan is not finalized. It requires more input.')

assertEq('stripLogicFlipCadence: different subjects (no pivot) stays unchanged',
  stripLogicFlipCadence('She is not here. He is in the office.'),
  'She is not here. He is in the office.')

assertEq('stripLogicFlipCadence: single sentence stays unchanged',
  stripLogicFlipCadence('Healthcare is not consumer tech.'),
  'Healthcare is not consumer tech.')

assertEq('stripLogicFlipCadence: embedded "is not" without pivot pair stays unchanged',
  stripLogicFlipCadence('She knows the work is not easy and chooses it anyway.'),
  'She knows the work is not easy and chooses it anyway.')

assertEq('stripLogicFlipCadence: negation then unrelated statement stays unchanged',
  stripLogicFlipCadence('The vendor is not ready. We will reschedule the launch.'),
  'The vendor is not ready. We will reschedule the launch.')

// ---- stripLogicFlipCadence: edge cases --------------------------------

assertEq('stripLogicFlipCadence: empty string unchanged', stripLogicFlipCadence(''), '')
assertEq('stripLogicFlipCadence: null unchanged', stripLogicFlipCadence(null), null)
assertEq('stripLogicFlipCadence: non-string unchanged', stripLogicFlipCadence(42), 42)
assertEq('stripLogicFlipCadence: clean prose unchanged',
  stripLogicFlipCadence('You build talent infrastructure at scale. The institutions need it.'),
  'You build talent infrastructure at scale. The institutions need it.')

{
  const once = stripLogicFlipCadence('This is not a coincidence. It is a pattern.')
  assertEq('stripLogicFlipCadence: idempotent on rewritten output', stripLogicFlipCadence(once), once)
}

// Mid-paragraph pivot (sentence boundary inside a larger block) still fires.
assertEq('stripLogicFlipCadence: pivot mid-paragraph fires, leading sentence preserved',
  stripLogicFlipCadence('You have compounded for fourteen years. These are not optimizations. They are architectures.'),
  'You have compounded for fourteen years. These are architectures.')

// ---- stripLogicFlipCadence: past-tense (was/were) widening -------------
// 2026-06-01: extend the two-sentence pivot to was/were. The present-tense
// fixtures above must still pass (no regression).

assertEq('stripLogicFlipCadence: past-tense pivot (shipped Sarah p6 round 2/3)',
  stripLogicFlipCadence('What stayed with me was not just the layoff. It was how badly they handled the goodbye.'),
  'What stayed with me was how badly they handled the goodbye.')

assertEq('stripLogicFlipCadence: canonical singular past',
  stripLogicFlipCadence('Your career was not about building products. It was about understanding how people experience reality.'),
  'Your career was about understanding how people experience reality.')

assertEq('stripLogicFlipCadence: plural past (were)',
  stripLogicFlipCadence('Those decisions were not coincidences. They were a pattern.'),
  'Those decisions were a pattern.')

assertEq('stripLogicFlipCadence: demonstrative past',
  stripLogicFlipCadence('That was not a setback. It was the moment everything changed.'),
  'That was the moment everything changed.')

assertEq('stripLogicFlipCadence: past no positive counter-assertion stays unchanged',
  stripLogicFlipCadence('The launch was not ready. It needed more testing.'),
  'The launch was not ready. It needed more testing.')

assertEq('stripLogicFlipCadence: past different subjects (no pivot) stays unchanged',
  stripLogicFlipCadence('She was not in the office. He was at the client site.'),
  'She was not in the office. He was at the client site.')

assertEq('stripLogicFlipCadence: past single sentence stays unchanged',
  stripLogicFlipCadence('The migration was not finished by Friday.'),
  'The migration was not finished by Friday.')

assertEq('stripLogicFlipCadence: past embedded "was not" without pivot pair stays unchanged',
  stripLogicFlipCadence('He knew the work was not easy and did it anyway.'),
  'He knew the work was not easy and did it anyway.')

// ---- stripLogicFlipCadence: less-about/more-about family --------------
// 2026-06-01: single-sentence comparison shape. Rewrites
// "[aux] less about X (and|,) more about Y" -> "[aux] about Y".

assertEq('stripLogicFlipCadence: less-about/more-about (shipped musician-ops p6 round 3)',
  stripLogicFlipCadence('the job is less about playing my own part and more about making the entire room play in time.'),
  'the job is about making the entire room play in time.')

assertEq('stripLogicFlipCadence: less-about possessive subject',
  stripLogicFlipCadence('Your career is less about titles and more about impact.'),
  'Your career is about impact.')

assertEq('stripLogicFlipCadence: less-about past tense',
  stripLogicFlipCadence('The work was less about the headcount and more about the rhythm.'),
  'The work was about the rhythm.')

assertEq('stripLogicFlipCadence: less-about comma form',
  stripLogicFlipCadence('Bridge Story is less about your career, more about your conviction.'),
  'Bridge Story is about your conviction.')

assertEq('stripLogicFlipCadence: "knows less about" (no aux, no more-about) stays unchanged',
  stripLogicFlipCadence('She knows less about pricing than the analysts do.'),
  'She knows less about pricing than the analysts do.')

assertEq('stripLogicFlipCadence: "less about X than Y" (sibling shape, out of scope) stays unchanged',
  stripLogicFlipCadence('I care less about the title than the work.'),
  'I care less about the title than the work.')

assertEq('stripLogicFlipCadence: standalone "more about" stays unchanged',
  stripLogicFlipCadence('Tell me more about your last role.'),
  'Tell me more about your last role.')

assertEq('stripLogicFlipCadence: "less about ... more toward" (not both "about") stays unchanged',
  stripLogicFlipCadence('The conversation drifted less about strategy and more toward execution details, which is when the meeting went sideways.'),
  'The conversation drifted less about strategy and more toward execution details, which is when the meeting went sideways.')

// ---- stripSincerityQualifiers: positive cases (must rewrite) ----------
// 2026-06-01 (PR after #133): deterministic strip for the noun-phrase and
// adverbial sincerity-qualifier prefixes. Removes the qualifier, restores
// the surviving claim's capital first letter.

assertEq('stripSincerityQualifiers: "The honest read:" colon form',
  stripSincerityQualifiers('The honest read: the conviction is general.'),
  'The conviction is general.')

assertEq('stripSincerityQualifiers: "The honest read is that" form',
  stripSincerityQualifiers('The honest read is that the conviction is general.'),
  'The conviction is general.')

assertEq('stripSincerityQualifiers: "The honest answer is that" form',
  stripSincerityQualifiers("The honest answer is that we don't know yet."),
  "We don't know yet.")

assertEq('stripSincerityQualifiers: "To be honest," lead-in',
  stripSincerityQualifiers('To be honest, the offer was thin.'),
  'The offer was thin.')

assertEq('stripSincerityQualifiers: "Honestly," lead-in',
  stripSincerityQualifiers("Honestly, the data doesn't support that."),
  "The data doesn't support that.")

assertEq('stripSincerityQualifiers: "Frankly," lead-in',
  stripSincerityQualifiers('Frankly, this is the right call.'),
  'This is the right call.')

// ---- stripSincerityQualifiers: negative cases (must stay unchanged) ---

assertEq('stripSincerityQualifiers: descriptive "an honest review" unchanged',
  stripSincerityQualifiers('She gave him an honest review of his presentation.'),
  'She gave him an honest review of his presentation.')

assertEq('stripSincerityQualifiers: predicate adjective "was honest" unchanged',
  stripSincerityQualifiers('His feedback was honest and useful.'),
  'His feedback was honest and useful.')

assertEq('stripSincerityQualifiers: "Honesty" as a noun unchanged',
  stripSincerityQualifiers('Honesty is one of her values.'),
  'Honesty is one of her values.')

assertEq('stripSincerityQualifiers: mid-sentence "honest dialogue" unchanged',
  stripSincerityQualifiers('They valued honest dialogue over politeness.'),
  'They valued honest dialogue over politeness.')

// ---- stripSincerityQualifiers: edge cases -----------------------------

assertEq('stripSincerityQualifiers: empty string unchanged', stripSincerityQualifiers(''), '')
assertEq('stripSincerityQualifiers: null unchanged', stripSincerityQualifiers(null), null)
assertEq('stripSincerityQualifiers: non-string unchanged', stripSincerityQualifiers(42), 42)

{
  const once = stripSincerityQualifiers('The honest read: the conviction is general.')
  assertEq('stripSincerityQualifiers: idempotent on stripped output', stripSincerityQualifiers(once), once)
}

// Qualifier after a sentence boundary mid-paragraph still fires.
assertEq('stripSincerityQualifiers: qualifier mid-paragraph fires, leading sentence preserved',
  stripSincerityQualifiers('The venue is specific. To be honest, the offer was thin.'),
  'The venue is specific. The offer was thin.')

// ---- Voice-gate fix (2026-06-09): comparative-standing -----------------

assertEq('stripComparativeStanding: "Most X ... . You ..." drops group sentence',
  stripComparativeStanding('Most senior HR people optimize existing systems. You build them.'),
  'You build them.')
assertEq('stripComparativeStanding: second group/you pair',
  stripComparativeStanding('Most HR leaders live in the people silo. You translate decisions into outcomes.'),
  'You translate decisions into outcomes.')
assertEq('stripComparativeStanding: inline "most people ... cannot match" removed',
  stripComparativeStanding('gives you a human opening most people in your space cannot match:'),
  'gives you a human opening:')
assertEq('stripComparativeStanding: KEEP sourced quote (attribution verb)',
  stripComparativeStanding('Most leaders miss this. She said you read a P&L fast.'),
  'Most leaders miss this. She said you read a P&L fast.')
assertEq('stripComparativeStanding: KEEP option comparison (no group/you flattery)',
  stripComparativeStanding('This offer closes the gap more than the other.'),
  'This offer closes the gap more than the other.')

// ---- Voice-gate fix: broadened logic-flip ------------------------------

assertEq('stripLogicFlipCadence: contracted "That\'s not X. It\'s Y." keeps affirmative',
  stripLogicFlipCadence('That’s not weakness. It’s being human.'),
  'It’s being human.')
assertEq('stripLogicFlipCadence: "aren\'t ... they\'re" pair',
  stripLogicFlipCadence('These aren’t icebreakers. They’re active gathering.'),
  'They’re active gathering.')
assertEq('stripLogicFlipCadence: negated lexical verb, same subject',
  stripLogicFlipCadence('You didn’t come through an MBA. You came through experience.'),
  'You came through experience.')
assertEq('stripLogicFlipCadence: appositive "X, not Y" after copula',
  stripLogicFlipCadence('A conversation is an exchange, not a transaction.'),
  'A conversation is an exchange.')
assertEq('stripLogicFlipCadence: "not because X, but because Y"',
  stripLogicFlipCadence('It works not because you perform, but because you have something real.'),
  'It works because you have something real.')
assertTruthy('stripLogicFlipCadence: idempotent on contracted form',
  stripLogicFlipCadence(stripLogicFlipCadence('That’s not weakness. It’s being human.')) === stripLogicFlipCadence('That’s not weakness. It’s being human.'))

// ---- Voice-gate fix: mid-sentence sincerity ----------------------------

assertEq('stripSincerityQualifiers: "I need to be honest with you - X" -> X',
  stripSincerityQualifiers('I need to be honest with you — I don’t have it yet.'),
  'I don’t have it yet.')
assertEq('stripSincerityQualifiers: "here\'s the honest answer:" prefix removed',
  stripSincerityQualifiers('So here’s the honest answer: you are strong.'),
  'you are strong.')
assertEq('stripSincerityQualifiers: "this is where brutal honesty comes in" dropped',
  stripSincerityQualifiers('And this is where brutal honesty comes in. None of it shows.'),
  'None of it shows.')

// ---- Voice-gate fix: intensifiers --------------------------------------

assertEq('stripIntensifiers: mid-sentence "actually" removed',
  stripIntensifiers('You actually have something real.'),
  'You have something real.')
assertEq('stripIntensifiers: sentence-initial "Honestly," recapitalizes',
  stripIntensifiers('Honestly, you are ready.'),
  'You are ready.')
assertTruthy('stripIntensifiers: idempotent',
  stripIntensifiers(stripIntensifiers('You really actually have it.')) === stripIntensifiers('You really actually have it.'))

// applyOutputStrippers runs the full chain.
assertTruthy('applyOutputStrippers: comparative + intensifier in one pass',
  applyOutputStrippers('Most leaders stall. You actually move.').trim() === 'You move.')

// ---- Report ----------------------------------------------------------

if (failed > 0) {
  console.error(`\ntest-text-strippers: ${failed} of ${total} cases failed.`)
  process.exit(1)
}
console.log(`test-text-strippers: OK (${total} cases passed)`)
