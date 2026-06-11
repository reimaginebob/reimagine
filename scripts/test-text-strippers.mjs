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

import { stripCoachSpeak, applyContaminationPlaceholders, CONTAMINATION_PLACEHOLDERS, stripLogicFlipCadence, stripSincerityQualifiers, stripComparativeStanding, stripIntensifiers, stripHireabilityVerdict, stripFrameworkNames, stripFabricatedMarketData, ensureDistressSupport, detectResidualVoice, applyOutputStrippers } from '../src/text-strippers.mjs'

const AP19 = String.fromCharCode(0x2019) // typographic apostrophe the model emits

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

// "speaks to" / "shows up as" / "facilitate" swaps removed (ordinary English,
// meaning-drift risk) — these assert the phrases now pass through untouched.
assertEq('stripCoachSpeak: "speaks to" is preserved (swap removed)',
  stripCoachSpeak('This speaks to the broader pattern.'),
  'This speaks to the broader pattern.')

assertEq('stripCoachSpeak: "shows up as" is preserved (swap removed)',
  stripCoachSpeak('That capability shows up as cross-functional fluency.'),
  'That capability shows up as cross-functional fluency.')

// "leverage" is deliberately PRESERVED (Bob is fine with it; the swap broke a
// sentence in the fix-cycle re-run). These assert it passes through untouched.
assertEq('stripCoachSpeak: "leverage" is preserved (not swapped)',
  stripCoachSpeak('You can leverage your network here.'),
  'You can leverage your network here.')

assertEq('stripCoachSpeak: "utilize" -> "use"',
  stripCoachSpeak('You can utilize your existing relationships.'),
  'You can use your existing relationships.')

assertEq('stripCoachSpeak: "facilitate" is preserved (swap removed)',
  stripCoachSpeak('A program manager facilitate the cross-team work.'),
  'A program manager facilitate the cross-team work.')

// ---- stripCoachSpeak: case-insensitive matching ------------------------

assertEq('stripCoachSpeak: "Leverage" capitalized is also preserved',
  stripCoachSpeak('Leverage the work you have already done.'),
  'Leverage the work you have already done.')

assertEq('stripCoachSpeak: case-insensitive "Speaks To" also preserved',
  stripCoachSpeak('That Speaks To something deeper.'),
  'That Speaks To something deeper.')

// ---- stripCoachSpeak: word boundaries + inflection preservation -------

assertEq('stripCoachSpeak: "facilitator" untouched',
  stripCoachSpeak('A facilitator runs the workshop.'),
  'A facilitator runs the workshop.')

// "facilitate" swap removed — all inflections now pass through untouched.
assertEq('stripCoachSpeak: "facilitates" preserved (swap removed)',
  stripCoachSpeak('She facilitates the meeting weekly.'),
  'She facilitates the meeting weekly.')

assertEq('stripCoachSpeak: "facilitated" preserved (swap removed)',
  stripCoachSpeak('She facilitated the meeting last week.'),
  'She facilitated the meeting last week.')

assertEq('stripCoachSpeak: "facilitating" preserved (swap removed)',
  stripCoachSpeak('She is facilitating the meeting now.'),
  'She is facilitating the meeting now.')

assertEq('stripCoachSpeak: "leverages" preserved (no inflection swap)',
  stripCoachSpeak('She leverages her network often.'),
  'She leverages her network often.')

assertEq('stripCoachSpeak: "leveraged" preserved',
  stripCoachSpeak('She leveraged her network to land the meeting.'),
  'She leveraged her network to land the meeting.')

assertEq('stripCoachSpeak: "leveraging" preserved',
  stripCoachSpeak('She has been leveraging her network for years.'),
  'She has been leveraging her network for years.')

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

assertEq('stripCoachSpeak: multiple substitutions in one input (leverage preserved)',
  stripCoachSpeak('We leverage facilitation in service of utilizing growth.'),
  'We leverage facilitation for using growth.')
// Note: "leverage" is preserved; "facilitation" the noun is NOT touched by
// \bfacilitate\b (correct); "in service of" -> "for"; "utilizing" -> "using".

assertEq('stripCoachSpeak: substitutions across multiple sentences (leverage preserved)',
  stripCoachSpeak('She leverages her network. The work comes alive in nonprofit settings. That speaks to her conviction.'),
  'She leverages her network. The work thrives in nonprofit settings. That speaks to her conviction.')

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

// ---- Voice-gate-fix re-run (2026-06-09b): markdown-aware comparative -------

assertEq('stripComparativeStanding: markdown bold breaks boundary -> still strips',
  stripComparativeStanding('**Your combination is rare.** Most senior leaders struggle. You do both.'),
  '**Your combination is rare.** You do both.')
assertEq('stripComparativeStanding: reversed you-first with curly contraction',
  stripComparativeStanding(`You clear that screen immediately. Many strong candidates don${AP19}t.`),
  'You clear that screen immediately.')
assertEq('stripComparativeStanding: inline curly contraction (apostrophe is NOT a quote)',
  stripComparativeStanding(`evidence of something most candidates claim but can${AP19}t point to.`),
  'evidence of something.')
assertEq('stripComparativeStanding: inline most-X-just-verb',
  stripComparativeStanding('you do it in environments most people just manage process for.'),
  'you do it in environments.')
assertTruthy('stripComparativeStanding: KEEP sourced (attribution verb) even with single quotes',
  stripComparativeStanding(`Most leaders miss this. ${AP19}You read fast,${AP19} she said.`).includes('she said'))
assertTruthy('stripComparativeStanding: KEEP where-clause (no grammar mangle)',
  stripComparativeStanding('environments where most people just manage process.').includes('where most people just manage'))
assertTruthy('stripComparativeStanding: idempotent',
  stripComparativeStanding(stripComparativeStanding('Most leaders stall. You move.')) === stripComparativeStanding('Most leaders stall. You move.'))

// ---- Voice-gate-fix re-run: markdown-aware intensifier --------------------

assertEq('stripIntensifiers: removes intensifier inside markdown bold',
  stripIntensifiers('You **actually care** about this.'),
  'You **care** about this.')
assertTruthy('stripIntensifiers: adjacent intensifiers collapse in one pass (idempotent)',
  stripIntensifiers('You really actually have it.') === stripIntensifiers(stripIntensifiers('You really actually have it.')))

// ---- Voice-gate-fix re-run: hire-ability verdict guard --------------------

assertTruthy('stripHireabilityVerdict: removes odds verdict header',
  !stripHireabilityVerdict('## Your odds in healthcare are excellent — but precise.\n\nYou have 14 years.').includes('are excellent'))
assertTruthy('stripHireabilityVerdict: removes Q&A verdict',
  !stripHireabilityVerdict('Your odds in healthcare broadly? Very strong. The role exists.').includes('Very strong'))
assertTruthy('stripHireabilityVerdict: removes sentence-initial candidate verdict',
  !stripHireabilityVerdict('You are a strong candidate. But that is not the question.').includes('a strong candidate. But'))
assertTruthy('stripHireabilityVerdict: KEEP conditional candidate framing',
  stripHireabilityVerdict('Whether you are a strong candidate depends on how you deploy them.').includes('Whether you are a strong candidate depends'))
assertTruthy('stripHireabilityVerdict: KEEP odds refusal (no positive qualifier)',
  stripHireabilityVerdict('Your odds are not a number I can give you.').includes('not a number'))

// ---- Voice-gate-fix re-run: framework names + tidy ------------------------

assertEq('stripFrameworkNames: Chapter N (descriptor) -> descriptor',
  stripFrameworkNames('Chapter 7 of the book (Tell Your Story) is where it happens.'),
  'Tell Your Story is where it happens.')
assertTruthy('stripFrameworkNames: Rock’s Fab Five neutralized',
  !stripFrameworkNames(`what I call Rock${AP19}s Fab Five:`).includes('Fab Five'))
assertEq('applyOutputStrippers: tidy recapitalizes the not-because artifact',
  applyOutputStrippers('You can keep doing this not because it is easy, but because you have before.'),
  'You can keep doing this because you have before.')

// ---- Voice-gate-fix re-run #2 (2026-06-09c) -------------------------------

// Fragment-free + markdown-aware logic-flip.
assertEq('stripLogicFlipCadence: cleft "What they are not is X. They are Y." -> keep Y whole (no fragment)',
  stripLogicFlipCadence('What they are not is a verdict on your worth. They are a signal about fit.'),
  'They are a signal about fit.')
assertEq('stripLogicFlipCadence: markdown-wrapped not ("is **not** X. It is Y.") reconstructs subject',
  stripLogicFlipCadence('What you feel is **not** evidence. It is the silence talking.'),
  'What you feel is the silence talking.')
assertTruthy('stripLogicFlipCadence: contracted still works after the rework',
  stripLogicFlipCadence(`That${AP19}s not weakness. It${AP19}s being human.`).trim() === `It${AP19}s being human.`)

// Verdict adverb + odds breadth.
assertTruthy('stripHireabilityVerdict: "a very strong candidate" (adverb)',
  !stripHireabilityVerdict(`You${AP19}re a very strong candidate for VP TA roles.`).includes('very strong candidate'))
assertTruthy('stripHireabilityVerdict: "the odds are as high as they get"',
  !stripHireabilityVerdict('The odds here are as high as they get. You are the profile.').includes('as high as they get'))
assertTruthy('stripHireabilityVerdict: KEEP conditional with adverb',
  stripHireabilityVerdict(`Whether you${AP19}re a very strong candidate depends on the role.`).includes('Whether you'))

// Market-data floor.
assertTruthy('stripFabricatedMarketData: drops asserted salary figure',
  !stripFabricatedMarketData('The average salary for that role is $185,000. Here is more.').includes('$185,000'))
assertTruthy('stripFabricatedMarketData: drops hiring-odds percentage',
  !stripFabricatedMarketData('You have a 70% chance of landing a role this quarter.').includes('70% chance'))
assertTruthy('stripFabricatedMarketData: KEEPS profile numbers ($4.2M, 22% to 9%)',
  stripFabricatedMarketData('You saved $4.2M and cut declines from 22% to 9%.') === 'You saved $4.2M and cut declines from 22% to 9%.')

// KEEL section + than/would comparatives.
assertTruthy('stripFrameworkNames: "the KEEL section" neutralized',
  !stripFrameworkNames('Re-read the KEEL section now.').includes('KEEL'))
assertTruthy('stripComparativeStanding: trailing "than most people show" dropped',
  !stripComparativeStanding(`you${AP19}ve communicated more care than most people show.`).includes('most people'))
assertTruthy('stripComparativeStanding: trailing "most people would ..." dropped',
  !stripComparativeStanding('execution under conditions most people would use as an excuse.').includes('most people'))
assertTruthy('stripComparativeStanding: KEEP where-clause',
  stripComparativeStanding('environments where most people just manage process.').includes('where most people just manage'))

// Distress safety-net — calibrated 2026-06-10. Fires ONLY on explicit,
// unambiguous beyond-job-search language (self-harm / not wanting to be alive).
// Ordinary search fatigue is discouragement and is coached by the prompt, NOT
// handed off here. The appended pointer contains the stable phrase "carry that
// alone".
const DP = 'carry that alone'
// Fires on explicit signals, appends the (single) pointer when none present:
assertTruthy('ensureDistressSupport: fires on explicit "want to die"',
  ensureDistressSupport('Honestly some days I just want to die.', 'I hear you.').includes(DP))
assertTruthy('ensureDistressSupport: fires on "better off dead"',
  ensureDistressSupport('I feel like everyone would be better off dead at this point.', 'I hear you.').includes(DP))
assertTruthy('ensureDistressSupport: fires on "don\'t want to be alive"',
  ensureDistressSupport(`Some mornings I don${AP19}t want to be alive.`, 'I hear you.').includes(DP))

// Does NOT fire on ordinary search fatigue — these get coached, not handed off:
assertTruthy('ensureDistressSupport: "can\'t keep doing this" is fatigue, NOT distress',
  !ensureDistressSupport(`I don${AP19}t know if I can keep doing this.`, 'A hard week. One small step?').includes(DP))
assertTruthy('ensureDistressSupport: "wonder if it is even worth continuing" is fatigue, NOT distress',
  !ensureDistressSupport(`Some days I wonder if it${AP19}s even worth continuing.`, 'A hard week. One small step?').includes(DP))
assertTruthy('ensureDistressSupport: "I am exhausted / not sure it is worth it" is fatigue',
  !ensureDistressSupport(`I am exhausted and I don${AP19}t know if it is worth it.`, 'A hard week. One small step?').includes(DP))
assertTruthy('ensureDistressSupport: "don\'t see the point anymore" is fatigue, NOT distress',
  !ensureDistressSupport(`I don${AP19}t see the point anymore.`, 'A hard week. One small step?').includes(DP))

// Guard: "don't want to die" affirms life — must NOT fire.
assertTruthy('ensureDistressSupport: "don\'t want to die" does NOT fire (affirming)',
  !ensureDistressSupport(`I don${AP19}t want to die wondering what if, so I keep going.`, 'Good. One small step?').includes(DP))

// Idempotence: a reply that already names a genuine support pointer is not duplicated.
assertTruthy('ensureDistressSupport: genuine "a friend or a counselor" pointer is NOT duplicated',
  !ensureDistressSupport('Some days I just want to die.', 'Please talk to a friend or a counselor about how heavy this feels.').includes(DP))
// No-op on a plain question.
assertTruthy('ensureDistressSupport: no-op on a non-distress message',
  ensureDistressSupport('How do I write my resume?', 'Here is how.') === 'Here is how.')

// ---- Voice-gate-fix re-run #3: contrast-subject comparatives + give-honest ----

assertEq('stripComparativeStanding: "Most X have Y. Yours run deeper." -> keep "Yours ..."',
  stripComparativeStanding('Most senior HR people have relationships. Yours run deeper than that.'),
  'Yours run deeper than that.')
assertEq('stripComparativeStanding: "Most X do Y. When you ..." -> keep "When you ..."',
  stripComparativeStanding('Most people show up in receive mode. When you show up trying to help, it transforms.'),
  'When you show up trying to help, it transforms.')
assertTruthy('stripComparativeStanding: KEEP "Your resume should be ready" (not a contrast)',
  stripComparativeStanding('Your resume should be ready before you apply.') === 'Your resume should be ready before you apply.')
assertTruthy('stripSincerityQualifiers: "I\'ll give you the honest read." sentence dropped',
  !stripSincerityQualifiers(`I${AP19}ll give you the honest read. What makes you different is the build.`).includes('honest read'))

// ---- detectResidualVoice (retry-loop detector) ----------------------------

assertTruthy('detectResidualVoice: flags "frankly," (sincerity)',
  detectResidualVoice('and frankly, it puts the focus on the wrong variable.').sincerity)
assertTruthy('detectResidualVoice: flags "Most senior TA leaders ..." (comparative)',
  detectResidualVoice('Most senior TA leaders have either tenure or impact.').comparative)
assertTruthy('detectResidualVoice: flags "before most people have named" (comparative)',
  detectResidualVoice('before most people have named the problem.').comparative)
assertTruthy('detectResidualVoice: clean coaching does NOT flag',
  !detectResidualVoice('You built a referral program that saved $4.2M. Lead with that.').comparative &&
  !detectResidualVoice('You built a referral program that saved $4.2M. Lead with that.').sincerity)
assertTruthy('detectResidualVoice: a refusal does NOT flag',
  !detectResidualVoice('I cannot render a verdict. The variables in your control are what matter.').comparative)
assertTruthy('detectResidualVoice: the distress pointer does NOT flag',
  !detectResidualVoice('Reach out to a friend, a counselor, or Bob at bob@career.club.').sincerity)

// ---- tidyOutput cosmetic nits (run-5 battery) -----------------------------

assertEq('tidyOutput: stray ",." collapses to "."',
  applyOutputStrippers('Health system? Yes,. You would walk in credible.'),
  'Health system? Yes. You would walk in credible.')
assertEq('tidyOutput: orphaned ** removed',
  applyOutputStrippers('You are a rare one.**\n\nHere is what I mean.'),
  'You are a rare one.\n\nHere is what I mean.')
assertEq('tidyOutput: empty bold from stripped intensifier removed',
  applyOutputStrippers('This is **really** important.'),
  'This is important.')
assertEq('tidyOutput: adjacent bolds preserved',
  applyOutputStrippers('**Strategy** and **Culture** matter.'),
  '**Strategy** and **Culture** matter.')
assertEq('tidyOutput: plain bold preserved',
  applyOutputStrippers('This is **important** work.'),
  'This is **important** work.')

// ---- Voice polish bundle (2026-06-10): broadened comparatives -------------

assertEq('stripComparativeStanding: "wider-than-average" keeps the adjective',
  stripComparativeStanding('You probably have a wider-than-average view of how organizations work.'),
  'You probably have a wider view of how organizations work.')
assertEq('stripComparativeStanding: spaced "than average" drops the two words',
  stripComparativeStanding('You have a broader than average understanding of systems.'),
  'You have a broader understanding of systems.')
assertTruthy('stripComparativeStanding: "better than 90% of candidates" dropped',
  !stripComparativeStanding('Your grandmother notebook is better material than 90% of what candidates lead with.').includes('90%'))
assertEq('stripComparativeStanding: "people who [Y] simply do not" ranking dropped',
  stripComparativeStanding('Someone who did all three knows things that people who stayed in one lane for twenty years simply do not.'),
  'Someone who did all three knows things.')
assertTruthy('stripComparativeStanding: "than the average candidate" (singular) dropped',
  !stripComparativeStanding('You bring more polish than the average candidate shows up with.').includes('average candidate'))
// Markdown-aware: emphasis around the percentage clause still strips.
assertTruthy('stripComparativeStanding: markdown-wrapped "than 90% of candidates" dropped',
  !stripComparativeStanding('That is **better material than 90% of candidates** bring.').includes('90%'))
// Guards: must NOT touch legit constructions.
assertTruthy('stripComparativeStanding: KEEP "rather than average" construction',
  stripComparativeStanding('Aim higher rather than average results.').includes('rather than average'))
assertTruthy('stripComparativeStanding: KEEP a real metric ("more than 30% of plan")',
  stripComparativeStanding('You grew revenue by more than 30% of plan that year.').includes('more than 30% of plan'))
assertTruthy('stripComparativeStanding: KEEP object clause "people who do not have a network"',
  stripComparativeStanding('This is advice that helps people who do not have a network yet.').includes('people who do not have a network'))
// detectResidualVoice picks up the new forms for the retry loop.
assertTruthy('detectResidualVoice: flags "wider-than-average"',
  detectResidualVoice('a wider-than-average view').comparative)
assertTruthy('detectResidualVoice: flags "than 90% of candidates"',
  detectResidualVoice('better than 90% of candidates').comparative)

// ---- Voice polish bundle (2026-06-10): source / framework names -----------

assertEq('stripFrameworkNames: "the five P’s" (apostrophe) neutralized',
  stripFrameworkNames(`The Potential dimension of the five P${AP19}s matters here.`),
  'The Potential dimension of these points matters here.')
assertEq('stripFrameworkNames: "the book — STAR" section label neutralized',
  stripFrameworkNames('The full model is in the book — STAR.'),
  'The full model is in the methodology.')
assertEq('stripFrameworkNames: "from the book" dropped',
  stripFrameworkNames('These attitude principles from the book apply here.'),
  'These attitude principles apply here.')
assertEq('stripFrameworkNames: "Phase 1" -> user-facing step name',
  stripFrameworkNames('If you have not run Phase 1 yet, start there.'),
  'If you have not run the Personal Brand step yet, start there.')
assertEq('stripFrameworkNames: "the Making Your Own Weather approach" -> "this approach"',
  stripFrameworkNames('Use the Making Your Own Weather approach to outreach.'),
  'Use this approach to outreach.')
assertEq('stripFrameworkNames: bare "the book" -> "this work"',
  stripFrameworkNames('The direct outreach model the book describes works.'),
  'The direct outreach model this work describes works.')
assertTruthy('stripFrameworkNames: standalone "Making Your Own Weather" neutralized',
  !stripFrameworkNames('This idea comes from Making Your Own Weather.').includes('Making Your Own Weather'))
assertTruthy('stripFrameworkNames: "the four C’s" neutralized',
  !stripFrameworkNames(`Think about the four C${AP19}s here.`).includes('four C'))

// ---- Discouragement exemplars (2026-06-11): authors stay unnamed ----------
// The seven discouragement angles are Frankl/Covey-derived; the ideas ship, the
// names never do. Backstop for the in-prompt no-naming rule (api/coach.js).
assertEq('stripFrameworkNames: "Covey writes about the circle of concern/control" rewritten clean',
  stripFrameworkNames('Stephen Covey writes about the circle of concern and the circle of control.'),
  "there's a useful distinction between what's outside your hands and what's in your hands.")
assertTruthy('stripFrameworkNames: "Stephen Covey" name never survives',
  !/covey/i.test(stripFrameworkNames('As Stephen Covey put it, you choose your response.')))
assertTruthy('stripFrameworkNames: bare "Covey" name neutralized',
  !/covey/i.test(stripFrameworkNames('Like Covey, focus on what you control.')))
assertTruthy('stripFrameworkNames: "Viktor Frankl" name never survives',
  !/frankl/i.test(stripFrameworkNames('Viktor Frankl wrote about the space between stimulus and response.')))
assertEq('stripFrameworkNames: "your circle of control" -> plain language',
  stripFrameworkNames('Focus on your circle of control.'),
  "Focus on what's in your hands.")

// ---- Report ----------------------------------------------------------

if (failed > 0) {
  console.error(`\ntest-text-strippers: ${failed} of ${total} cases failed.`)
  process.exit(1)
}
console.log(`test-text-strippers: OK (${total} cases passed)`)
