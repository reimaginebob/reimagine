// Unit tests for src/voice-patterns.mjs. Wired into prebuild via package.json
// so a regression on any of the named patterns fails the build before the
// bundle ships.
//
// Coverage (2026-05-21 KYV polish brief, post-consult):
//   1. Each of the six new/widened patterns fires on the corresponding
//      production-failure string from the Personal Brand output that
//      surfaced this brief.
//   2. The widened ai-coaching-sit-with does NOT fire on the three
//      legitimate user-guide phrasings the consult flagged
//      (`01-what-is-reimagine.md:13` "the question you are sitting with,"
//      `03-quality-of-your-inputs.md:103` and `04-orientation-phase.md:158`
//      "sit with the [questions]").
//   3. The mind-reading-sense-of whitelist does NOT fire on "sense of
//      humor" / "sense of timing."
//   4. detectDimensionalFitRegression fires on the dedicated-paragraph
//      failure shape and returns null on the rewritten worked example.

import { detectVoiceViolations, detectDimensionalFitRegression } from '../src/voice-patterns.mjs'

const cases = [
  // [label, expected-pattern-name-or-null, input]

  // Item 1: widened ai-coaching-sit-with. Fires on "worth sitting with"
  // (production failure shape), the original deictic forms still fire, the
  // new banned phrases fire, the user-guide phrasings do NOT fire.
  ['ai-coaching: worth sitting with (production failure)', 'ai-coaching-sit-with',
    'The question worth sitting with: is healthcare still part of the story you want to tell.'],
  ['ai-coaching: sit with this (original deictic still fires)', 'ai-coaching-sit-with',
    'Sit with this. The answer will come.'],
  ['ai-coaching: take a moment to consider (new)', 'ai-coaching-sit-with',
    'Take a moment to consider what this means for you.'],
  ['ai-coaching: get curious about (new)', 'ai-coaching-sit-with',
    'Get curious about which part of the work feels most alive.'],
  ['ai-coaching: honor your process (new sibling of honor your journey)', 'ai-coaching-sit-with',
    'Honor your process and trust the timing.'],
  ['ai-coaching legit: are sitting with (user-guide 01) does NOT fire', null,
    'If that is the question you are sitting with, Reimagine is for you.'],
  ['ai-coaching legit: sit with the four questions (user-guide 03) does NOT fire', null,
    'If you do not have anything in writing, sit with the four questions for a few minutes.'],
  ['ai-coaching legit: sit with the questions (user-guide 04) does NOT fire', null,
    'If you have nothing in writing, sit with the questions for a moment.'],

  // Item 2: logic-flip-less-about-more-about. All three production-failure
  // shapes fire.
  ['logic-flip-less-about: industry / mission', 'logic-flip-less-about-more-about',
    'The next move is less about which industry and more about which mission.'],
  ['logic-flip-less-about: scale operate / next role', 'logic-flip-less-about-more-about',
    'The scalability question is less about whether you can operate at scale and more about whether the next role is the right one.'],
  ['logic-flip-less-about: than variant', 'logic-flip-less-about-more-about',
    'It is less about the title than more about the work that role gets to do.'],

  // Item 3: four mind-reading patterns.
  ['mind-reading-season-of: production failure', 'mind-reading-season-of',
    'The job-search experience suggests you are in a season of reassessment.'],
  ['mind-reading-season-of: user-guide phrasing also fires at runtime', 'mind-reading-season-of',
    'a season of caregiving that built your tolerance for ambiguity'],
  ['mind-reading-sense-of: legacy (production failure)', 'mind-reading-sense-of',
    'The Africa education project gave you a sense of legacy.'],
  ['mind-reading-sense-of: purpose', 'mind-reading-sense-of',
    'Your sense of purpose comes through in the work you choose.'],
  ['mind-reading-sense-of: agency (whitelist addition)', 'mind-reading-sense-of',
    'There is a sense of agency in how you describe your career arc.'],
  ['mind-reading-sense-of whitelist: humor does NOT fire', null,
    'Your sense of humor lands well in interviews.'],
  ['mind-reading-sense-of whitelist: timing does NOT fire', null,
    'The hire reads as a sense of timing question more than a fit question.'],
  ['mind-reading-gave-you: the Africa project gave you a sense of legacy', 'mind-reading-gave-you',
    'the Africa project gave you a sense of legacy that runs through later choices'],
  ['mind-reading-gave-you: gives you the certainty to', 'mind-reading-gave-you',
    'The pattern gives you the certainty to move into adjacent roles.'],
  ['mind-reading-shaped-your: left you with a conviction (variant)', 'mind-reading-shaped-your',
    'That experience left you with a conviction about how teams should work.'],
  ['mind-reading-shaped-your: shaped your drive', 'mind-reading-shaped-your',
    'Crisis counseling shaped your drive to stay inside complexity rather than abstract from it.'],
  ['mind-reading-shaped-your: built your sense', 'mind-reading-shaped-your',
    'Years of operating in turnarounds built your sense for which signal to trust.'],
]

let failed = 0
for (const [label, expectedName, input] of cases) {
  const violations = detectVoiceViolations(input, { includeSoft: false, scope: 'runtime' })
  if (expectedName === null) {
    // Must not fire.
    if (violations.length > 0) {
      console.error(`FAIL: ${label}`)
      console.error(`  input:    ${JSON.stringify(input)}`)
      console.error(`  expected: no match`)
      console.error(`  got:      ${violations.map(v => v.name).join(', ')}`)
      failed++
    }
  } else {
    // Must fire and include expectedName.
    const names = violations.map(v => v.name)
    if (!names.includes(expectedName)) {
      console.error(`FAIL: ${label}`)
      console.error(`  input:    ${JSON.stringify(input)}`)
      console.error(`  expected: ${expectedName}`)
      console.error(`  got:      ${names.length === 0 ? '(no matches)' : names.join(', ')}`)
      failed++
    }
  }
}

// Item 6: detectDimensionalFitRegression unit tests.
// Failure-shape fixture: six dedicated dimension paragraphs of equal length,
// each titled with **Dimension**. Modeled on the 2026-05-21 production
// failure described in the brief. Does not need verbatim production output;
// the detector matches on the shape, not the content.
const failureShape = [
  '**Function** is senior research leadership, named clearly by the work and confirmed by the wiring. Long-form sentence to round out the paragraph for the test fixture.',
  '**Industry** is open. The pattern has held across multiple sectors over the years, which keeps the door open for the next move to be cross-sector or stay in the current one.',
  '**Position in the value chain** points toward operating roles inside the company. Advisory or consulting moves would be a tension with the reputation answers and the story so far.',
  '**Scale** is the dimension worth examining. The career has run at one order of magnitude; the next chapter may ask for testing the operational moves at ten times that.',
  '**Pace** is a match. Operationally complex and time-pressured work is what energizes; nothing in the inputs suggests an attraction to slower cycles.',
  '**Mission** is the dimension with the least signal in the inputs. Mission-driven companies are named as appealing, with no specific cause or domain named yet.',
].join('\n\n')

// Clean shape: a snippet from the rewritten worked example, dimensions
// woven into 2-3 short paragraphs with inline bolded keywords rather than
// dedicated per-dimension paragraphs.
const cleanShape = [
  'The fit across dimensions is mostly confirming. **Function** is operational leadership, named clearly by the work and confirmed by the wiring. **Industry** is open: your pattern has held across three sectors. The dimension that will shape the next move is mission. **Position in the value chain** points firmly to operator roles inside the company. **Pace** is a match.',
  'The dimension worth examining is **scale**. You have run $180M well. The data supports moving to a billion-plus, and the moves that worked at one order of magnitude need to be tested at ten times that.',
  '**Mission** is the dimension with the least signal in your inputs. Come back to this dimension once Two Doors surfaces a direction.',
].join('\n\n')

const dimFailure = detectDimensionalFitRegression(failureShape)
if (!dimFailure || dimFailure.name !== 'dimensional-fit-regression') {
  console.error('FAIL: detectDimensionalFitRegression should fire on failure-shape fixture')
  console.error(`  got: ${JSON.stringify(dimFailure)}`)
  failed++
} else if (dimFailure.count < 5) {
  console.error(`FAIL: detectDimensionalFitRegression counted ${dimFailure.count} dedicated paragraphs (expected >= 5)`)
  failed++
}

const dimClean = detectDimensionalFitRegression(cleanShape)
if (dimClean !== null) {
  console.error('FAIL: detectDimensionalFitRegression should NOT fire on clean inline-woven shape')
  console.error(`  got: ${JSON.stringify(dimClean)}`)
  failed++
}

// --- Foundation A.5 (2026-05-26) formula-* patterns ---------------------
//
// Step-scoped to p3 only; appliesTo: ['runtime']. Positive cases assert the
// formulaic surface fires; negative cases assert overlapping vocabulary in
// non-stock prose does NOT false-positive. The combined-detection case
// asserts multiple patterns in one output are all reported (the corrective
// callout enumerates them). The step-filter cases assert formula-* fire
// only when the detector is called with step: 'p3'.
//
// Each entry: [label, expectedName-or-null, input, step].
const formulaCases = [
  // formula-three-sources-converge: stock tripartite opener.
  ['formula-three-sources-converge: stock opener fires', 'formula-three-sources-converge',
    'Three sources converge on it. Your career shows the rest.', 'p3'],
  ['formula-three-sources-converge: varied opener does not fire', null,
    'Multiple sources point in the same direction, but the strongest read comes from one specific moment.', 'p3'],

  // formula-two-patterns-one-fact: likely substitute frame.
  ['formula-two-patterns-one-fact: substitute opener fires', 'formula-two-patterns-one-fact',
    'Two patterns and one fact: you choose pre-playbook problems.', 'p3'],
  ['formula-two-patterns-one-fact: varied counts in prose do not fire', null,
    'There are two patterns running through your career and several facts that anchor them.', 'p3'],

  // formula-career-shows-it: first-of-line transition.
  ['formula-career-shows-it: line-start fires', 'formula-career-shows-it',
    'You build research practice where none exists yet.\nYour career shows it.\nYour reputation describes the same move.', 'p3'],
  ['formula-career-shows-it: not at line start does not fire', null,
    'In several places your career shows a pattern of choosing operationally complex environments.', 'p3'],

  // formula-reputation-describes-same: stock connector to reputation source.
  ['formula-reputation-describes-same: with answers fires', 'formula-reputation-describes-same',
    'Your reputation answers describe you the same way.', 'p3'],
  ['formula-reputation-describes-same: without answers fires (variant)', 'formula-reputation-describes-same',
    'Your reputation describes you the same way.', 'p3'],
  ['formula-reputation-describes-same: varied reputation prose does not fire', null,
    'Your reputation describes you as someone who builds research where the category is still forming.', 'p3'],

  // formula-cliftonstrengths-same-way: stock connector to assessment source.
  ['formula-cliftonstrengths-same-way: shows the same fires', 'formula-cliftonstrengths-same-way',
    'Your CliftonStrengths read shows the same way of thinking.', 'p3'],
  ['formula-cliftonstrengths-same-way: same way of thinking variant fires', 'formula-cliftonstrengths-same-way',
    'Your CliftonStrengths profile names the same way of thinking.', 'p3'],
  ['formula-cliftonstrengths-same-way: varied CS prose does not fire', null,
    'Your CliftonStrengths places Strategic in your top 5, which maps to choosing pre-playbook problems.', 'p3'],

  // formula-story-locates-source: stock close to the multi-source walk.
  ['formula-story-locates-source: fires', 'formula-story-locates-source',
    'Your story locates the source of the through-line.', 'p3'],
  ['formula-story-locates-source: varied story prose does not fire', null,
    'Your story is unusual: cross-functional jumps in a domain that punishes them.', 'p3'],

  // formula-stock-closer-push-back: stock wager-naming closer.
  ['formula-stock-closer-push-back: stock closer fires', 'formula-stock-closer-push-back',
    'If the framing of operating depth misses, push back.', 'p3'],
  ['formula-stock-closer-push-back: varied close does not fire', null,
    "If something here misses, tell me and I'll rewrite the lead.", 'p3'],

  // formula-converge-on-it: the broader marker for the convergence frame.
  ['formula-converge-on-it: fires', 'formula-converge-on-it',
    'Multiple lines converge on it: career, reputation, story.', 'p3'],
  ['formula-converge-on-it: converges-without-on-it does not fire', null,
    'Your career arc converges across two industries that rarely share talent.', 'p3'],
]

let formulaFailed = 0
for (const [label, expectedName, input, step] of formulaCases) {
  const violations = detectVoiceViolations(input, { includeSoft: false, scope: 'runtime', step })
  if (expectedName === null) {
    if (violations.some(v => typeof v.name === 'string' && v.name.startsWith('formula-'))) {
      console.error(`FAIL: ${label}`)
      console.error(`  input:    ${JSON.stringify(input)}`)
      console.error(`  expected: no formula-* match`)
      console.error(`  got:      ${violations.map(v => v.name).join(', ')}`)
      failed++; formulaFailed++
    }
  } else {
    const names = violations.map(v => v.name)
    if (!names.includes(expectedName)) {
      console.error(`FAIL: ${label}`)
      console.error(`  input:    ${JSON.stringify(input)}`)
      console.error(`  expected: ${expectedName}`)
      console.error(`  got:      ${names.length === 0 ? '(no matches)' : names.join(', ')}`)
      failed++; formulaFailed++
    }
  }
}

// Combined detection: four formula patterns in one output. The variance-
// instructing corrective callout in callClaudeWithVoiceGate enumerates each
// fired surface so the model knows the full shape it produced. This test
// asserts the detector reports all four (not just the first match).
{
  const combinedFormula = 'Three sources converge on it.\nYour career shows it.\nYour reputation describes you the same way. Your story locates the source.'
  const combinedViolations = detectVoiceViolations(combinedFormula, { includeSoft: false, scope: 'runtime', step: 'p3' })
  const combinedNames = combinedViolations.map(v => v.name)
  const expectedCombined = [
    'formula-three-sources-converge',
    'formula-converge-on-it',
    'formula-career-shows-it',
    'formula-reputation-describes-same',
    'formula-story-locates-source',
  ]
  const missing = expectedCombined.filter(n => !combinedNames.includes(n))
  if (missing.length > 0) {
    console.error(`FAIL: combined formula detection missing ${missing.join(', ')}`)
    console.error(`  got: ${combinedNames.join(', ')}`)
    failed++; formulaFailed++
  }
}

// Step filter: formula-* are universal as of Foundation B (PR #84). The
// previous p3-only scoping was relaxed because the p4 umbrella produces
// p3-shape analytical prose and is the second observed surface for these
// AI stock-template phrasings. Assert formula-* fire under undefined /
// 'p3' / 'p4' / 'p7' all the same.
{
  const stepFilterInput = 'Three sources converge on it. Your story locates the source.'
  for (const step of [undefined, 'p3', 'p4', 'p7']) {
    const v = detectVoiceViolations(stepFilterInput, { includeSoft: false, scope: 'runtime', step })
    if (!v.some(x => typeof x.name === 'string' && x.name.startsWith('formula-'))) {
      console.error(`FAIL: step filter: formula-* should fire when step=${JSON.stringify(step)}`)
      console.error(`  got: ${v.map(x => x.name).join(', ')}`)
      failed++; formulaFailed++
    }
  }
}

// --- 2026-05-27 Voice guide application patterns (PR 2 replay) -------
//
// Five families, all appliesTo:['runtime'], no step constraint (universal
// across modules). Positive case: the formulaic surface fires. Negative
// case: overlapping vocabulary in non-stock prose does NOT false-positive.
// Combined-detection case after the per-pattern loop asserts a single
// output with violations across multiple families reports them all so
// buildVarianceCorrective can aggregate.
//
// Each entry: [label, expectedName-or-null, input].
const voiceGuideCases = [
  // process-* (talk to the reader, not about the output)
  ['process-the-framing-here: fires', 'process-the-framing-here',
    'The framing here is that you build conviction from evidence.'],
  ['process-the-framing-here: framing-as-verb does not fire', null,
    'You are framing the decision well; that is the move.'],

  ['process-the-framing-of-x-is-the-wager: fires', 'process-the-framing-of-x-is-the-wager',
    'The framing of operating depth as the through-line is the wager.'],
  ['process-the-framing-of-x-is-the-wager: wager-elsewhere does not fire', null,
    'Your willingness to make a wager on yourself is part of what got you here.'],

  ['process-the-interpretive-wager: fires', 'process-the-interpretive-wager',
    'The interpretive wager is that operating depth, not strategic vision, is the through-line.'],
  ['process-the-interpretive-wager: wager-without-interpretive does not fire', null,
    'A wager you might consider is whether the next role rewards depth or breadth.'],

  ['process-let-me-explain: fires', 'process-let-me-explain',
    'Let me explain how this works in practice.'],
  ['process-let-me-explain: explain-elsewhere does not fire', null,
    'You can explain your background in a sentence; that is rare.'],

  ['process-let-me-walk-you-through: fires', 'process-let-me-walk-you-through',
    'Let me walk you through the dimensional fit reading.'],
  ['process-let-me-walk-you-through: walk-elsewhere does not fire', null,
    'You walk into the interview already familiar with the territory.'],

  ['process-what-i-will-do-here: fires (will do)', 'process-what-i-will-do-here',
    'What I will do here is map the strongest evidence to the three lanes.'],
  ['process-what-i-will-do-here: fires (am going to share)', 'process-what-i-will-do-here',
    'What I am going to share matters because it shapes the next move.'],
  ['process-what-i-will-do-here: third-person variant does not fire', null,
    'What this work will do here is open three directions worth exploring.'],

  // framework-* (Bob's framework names never reach the reader)
  ['framework-four-cs: fires (4 Cs)', 'framework-four-cs',
    'Per the 4 Cs framework, conviction precedes clarity.'],
  ['framework-four-cs: fires (Four Cs)', 'framework-four-cs',
    'The Four Cs explain how it lands.'],
  ['framework-four-cs: four cents does not fire', null,
    'The deal closed for four cents on the dollar.'],

  ['framework-five-ps: fires (5 Ps)', 'framework-five-ps',
    'The 5 Ps describe how you show up at work.'],
  ['framework-five-ps: fires (Five Ps)', 'framework-five-ps',
    'Through the Five Ps lens, perspiration is doing real work for you.'],
  ['framework-five-ps: five pages does not fire', null,
    'The resume runs about five pages right now and could come down to two.'],

  ['framework-keel: fires (capitalized)', 'framework-keel',
    'The KEEL principles inform the read.'],
  ['framework-keel: lowercase keel does not fire', null,
    'Your career has a keel under it; the storms pass.'],

  ['framework-keel-principles: fires', 'framework-keel-principles',
    'The KEEL principles tell us that emotional ups and downs are natural.'],

  ['framework-quota-of-one: fires', 'framework-quota-of-one',
    'Your Quota of One is the one offer that changes the next chapter.'],
  ['framework-quota-of-one: quota-elsewhere does not fire', null,
    'You closed your annual quota in eight months three years running.'],

  ['framework-like-for-like: fires (no fallacy)', 'framework-like-for-like',
    'The Like-for-Like read is wrong here.'],
  ['framework-like-for-like: fires (with fallacy)', 'framework-like-for-like',
    'This is a Like-for-Like Fallacy; the next role does not need to mirror the last.'],
  ['framework-like-for-like: lake-for-life does not fire', null,
    'The lake-for-life decision was about geography, not career.'],

  ['framework-three-lane-pivot: fires', 'framework-three-lane-pivot',
    'On the Three-lane pivot model, you sit comfortably in the middle lane.'],
  ['framework-three-lane-pivot: production lane names do not fire', null,
    'Familiar Ground, Industry Insider, and Work That Matters each offer a different read.'],

  ['framework-bake-a-cake: fires', 'framework-bake-a-cake',
    'Bake a Cake applies here: assemble the ingredients before assembling the recipe.'],
  ['framework-bake-a-cake: cake-elsewhere does not fire', null,
    'Your team baked the celebration cake themselves on launch day.'],

  ['framework-tide: fires', 'framework-tide',
    'The Tide framework explains why timing matters this quarter.'],
  ['framework-tide: tide-elsewhere does not fire', null,
    'The tide of demand in your sector is rising.'],

  // drama-* (stock attention-grabbing transitions)
  ['drama-heres-the-kicker: fires', 'drama-heres-the-kicker',
    "Here's the kicker: the strongest evidence sits in the years you tend to skip past."],
  ['drama-heres-the-kicker: kicker-elsewhere does not fire', null,
    'Your closing argument is the kicker the interview turns on.'],

  ['drama-here-is-where-it-gets: fires', 'drama-here-is-where-it-gets',
    "Here's where it gets interesting: your reputation describes a different person than your resume does."],
  ['drama-here-is-where-it-gets: varied phrasing does not fire', null,
    'In one place your reputation describes a different person than your resume does, which is where the work begins.'],

  ['drama-this-is-where: fires (gets)', 'drama-this-is-where',
    'This is where it gets useful: name the move, then name the cost.'],
  ['drama-this-is-where: fires (starts to)', 'drama-this-is-where',
    'This is where it starts to land for hiring managers.'],
  ['drama-this-is-where: spatial usage does not fire', null,
    'This is where the team meets each week; choose carefully.'],

  // truth-* (announce-the-truth discourse markers)
  ['truth-the-truth-is: fires', 'truth-the-truth-is',
    'The truth is that your strongest evidence is the Acme deal.'],
  ['truth-the-truth-is: truth-as-noun does not fire', null,
    'Your truth about that decision matches what the data shows.'],

  ['truth-here-is-the-thing: fires', 'truth-here-is-the-thing',
    "Here's the thing: the next move is smaller than you think."],
  ['truth-here-is-the-thing: thing-elsewhere does not fire', null,
    "Here is one thing the data suggests, and it lands clearly."],

  ['truth-the-real-answer-is: fires', 'truth-the-real-answer-is',
    "The real answer is that your read is closer to right than you have admitted."],

  ['truth-honestly-frankly-candidly: fires (Honestly,)', 'truth-honestly-frankly-candidly',
    'Honestly, the assessment confirms what your reputation already named.'],
  ['truth-honestly-frankly-candidly: fires (Frankly,)', 'truth-honestly-frankly-candidly',
    'Frankly, the role does not match the brand.'],
  ['truth-honestly-frankly-candidly: adverbial use does not fire', null,
    'She spoke honestly about her doubts and walked away from the offer.'],

  // meta-* (first-person authorial framing instead of content)
  ['meta-let-me-share: fires', 'meta-let-me-share',
    'Let me share my perspective on what the assessment is showing.'],
  ['meta-let-me-share: share-elsewhere does not fire', null,
    'You share the kind of work that travels across industries.'],

  ['meta-i-want-to: fires', 'meta-i-want-to',
    'I want to walk you through what the evidence suggests.'],
  ['meta-i-want-to: I-elsewhere does not fire', null,
    'You said you want to spend the next decade on problems that matter.'],

  ['meta-what-i-find-interesting: fires', 'meta-what-i-find-interesting',
    'What I find interesting is that your reputation answers cluster around one move.'],
  ['meta-what-i-find-interesting: third-person observation does not fire', null,
    'What stands out about the evidence is one specific operational move you have repeated.'],

  // closer-* (closer-template widenings from PR #83 — catch variants of
  // "The [framing|through-line|wager] [here|of X] is Y. If that misses
  // how you experience your work, [feedback box / name what / will
  // adjust]" that survived PR #82's Covey voice register).
  //
  // Rescoped to step:'p3' by Foundation B (PR #84): the p4 umbrella's
  // Covey-register framing-wager invitation is the legitimate use case
  // for these phrasings. Tests pass step:'p3' explicitly so the gate
  // fires; a dedicated step-filter block below also asserts the
  // closer-* patterns DO NOT fire at step:'p4'.

  // Family A: meta-correction invitations
  ['closer-if-that-misses-how-you-experience: fires (misses)', 'closer-if-that-misses-how-you-experience',
    'If that misses how you experience your work, the read will adjust.', 'p3'],
  ['closer-name-what-it-misses: fires', 'closer-name-what-it-misses',
    'If this reading does not match how you experience your own career, name what it is missing.', 'p3'],
  ['closer-the-X-will-adjust: fires (analysis)', 'closer-the-X-will-adjust',
    'Name what it misses and the analysis will adjust.', 'p3'],

  // Family B: feedback-box references
  ['closer-feedback-box-below: fires', 'closer-feedback-box-below',
    'Use the feedback box below to push back.', 'p3'],

  // Family C: closer principle-announcement openers (paragraph-opening)
  ['closer-the-through-line-here: fires', 'closer-the-through-line-here',
    'The through-line here is stewardship of the operating function.', 'p3'],
  ['closer-the-through-line-here: mid-paragraph legit does not fire', null,
    'For the through-line you described in your inputs, the role choice does the same work.', 'p3'],
  ['closer-the-framing-here: fires (with inserted word)', 'closer-the-framing-here',
    'The framing wager here is that operating depth is the asset.', 'p3'],
  ['closer-the-wager-here: fires', 'closer-the-wager-here',
    'The wager here is that the next chapter carries the same conviction.', 'p3'],
  ['closer-the-choice-of-X-as: fires', 'closer-the-choice-of-X-as',
    'The choice of stewardship as the through-line carries forward.', 'p3'],
  ['closer-the-framing-of-X-is: fires (interpretive choice)', 'closer-the-framing-of-X-is',
    'The framing of operating depth as the interpretive choice is the wager you are running.', 'p3'],

  // Family D: stock-transition variants (universal, no step needed)
  ['transition-your-career-shows-the-pattern: fires', 'transition-your-career-shows-the-pattern',
    'Your career shows the pattern from the very first role onward.'],
  ['transition-three-things-in-your-background: fires', 'transition-three-things-in-your-background',
    'Three things in your background point to the same conclusion.'],
]

let voiceGuideFailed = 0
for (const [label, expectedName, input, step] of voiceGuideCases) {
  const violations = detectVoiceViolations(input, { includeSoft: false, scope: 'runtime', step })
  if (expectedName === null) {
    if (violations.some(v => typeof v.name === 'string' && /^(?:process|framework|drama|truth|meta|closer|transition)-/.test(v.name))) {
      console.error(`FAIL: ${label}`)
      console.error(`  input:    ${JSON.stringify(input)}`)
      console.error(`  expected: no process-/framework-/drama-/truth-/meta- match`)
      console.error(`  got:      ${violations.map(v => v.name).join(', ')}`)
      failed++; voiceGuideFailed++
    }
  } else {
    const names = violations.map(v => v.name)
    if (!names.includes(expectedName)) {
      console.error(`FAIL: ${label}`)
      console.error(`  input:    ${JSON.stringify(input)}`)
      console.error(`  expected: ${expectedName}`)
      console.error(`  got:      ${names.length === 0 ? '(no matches)' : names.join(', ')}`)
      failed++; voiceGuideFailed++
    }
  }
}

// Combined detection: an output with violations across multiple families
// (one process-*, one framework-*, one drama-*, plus a formula-* from
// the A.5 family) should report all of them so buildVarianceCorrective
// can aggregate the surfaces into a single retry instruction.
{
  const combinedFormula = 'Let me walk you through the read. Three sources converge on it. The KEEL principles tell us this. Here\'s the kicker.'
  const combinedViolations = detectVoiceViolations(combinedFormula, { includeSoft: false, scope: 'runtime', step: 'p3' })
  const combinedNames = combinedViolations.map(v => v.name)
  const expectedCombined = [
    'process-let-me-walk-you-through',
    'formula-three-sources-converge',
    'framework-keel',
    'framework-keel-principles',
    'drama-heres-the-kicker',
  ]
  const missing = expectedCombined.filter(n => !combinedNames.includes(n))
  if (missing.length > 0) {
    console.error(`FAIL: combined voice-guide + formula detection missing ${missing.join(', ')}`)
    console.error(`  got: ${combinedNames.join(', ')}`)
    failed++; voiceGuideFailed++
  }
}

// Step filter: most voice-guide patterns (process-*, framework-*, drama-*,
// truth-*, meta-*, transition-*) have no step field, so they fire under any
// step. Assert one process-* pattern fires under step:undefined, step:'p3',
// step:'p4', and step:'p7' all the same.
{
  const input = 'Let me explain how this works.'
  for (const step of [undefined, 'p3', 'p4', 'p7']) {
    const v = detectVoiceViolations(input, { includeSoft: false, scope: 'runtime', step })
    if (!v.some(x => x.name === 'process-let-me-explain')) {
      console.error(`FAIL: step filter: universal voice-guide patterns should fire when step=${JSON.stringify(step)}`)
      console.error(`  got: ${v.map(x => x.name).join(', ')}`)
      failed++; voiceGuideFailed++
    }
  }
}

// Step filter: closer-* patterns are scoped to step:'p3' as of Foundation B
// (PR #84). The p4 umbrella's Covey-register framing-wager invitation is the
// legitimate use case for these phrasings. Single composite input exercises
// all 9 surfaces; assert all 9 fire at step:'p3' and none fire at step:'p4'.
{
  const closerInput = [
    'The through-line here is stewardship.',
    'The framing wager here is operating depth.',
    'The wager here is a quiet refusal of comfort.',
    'The choice of stewardship as the through-line.',
    'The framing of operating depth as the interpretive wager.',
    'If that misses how you experience your work, name what it is missing and the analysis will adjust.',
    'Use the feedback box below.',
  ].join('\n\n')
  const expectedAll = [
    'closer-if-that-misses-how-you-experience',
    'closer-name-what-it-misses',
    'closer-the-X-will-adjust',
    'closer-feedback-box-below',
    'closer-the-through-line-here',
    'closer-the-framing-here',
    'closer-the-wager-here',
    'closer-the-choice-of-X-as',
    'closer-the-framing-of-X-is',
  ]
  const p3 = detectVoiceViolations(closerInput, { includeSoft: false, scope: 'runtime', step: 'p3' })
  const p3names = new Set(p3.map(v => v.name))
  const missing = expectedAll.filter(n => !p3names.has(n))
  if (missing.length > 0) {
    console.error(`FAIL: step filter: closer-* should fire at step='p3', missing: ${missing.join(', ')}`)
    console.error(`  got: ${[...p3names].join(', ')}`)
    failed++; voiceGuideFailed++
  }
  const p4 = detectVoiceViolations(closerInput, { includeSoft: false, scope: 'runtime', step: 'p4' })
  if (p4.some(v => typeof v.name === 'string' && v.name.startsWith('closer-'))) {
    console.error(`FAIL: step filter: closer-* should not fire at step='p4'`)
    console.error(`  got: ${p4.map(v => v.name).join(', ')}`)
    failed++; voiceGuideFailed++
  }
}

const formulaTotal = formulaCases.length + 1 + 4 // formulaCases + combined-detection + 4 step-filter checks (formula-* now universal)
const voiceGuideTotal = voiceGuideCases.length + 1 + 4 + 2 // voiceGuideCases + combined-detection + 4 universal step-filter checks + 2 closer step-filter checks
const total = cases.length + 2 + formulaTotal + voiceGuideTotal
if (failed > 0) {
  console.error(`\ntest-voice-patterns: ${failed} of ${total} cases failed.`)
  process.exit(1)
}
console.log(`test-voice-patterns: OK (${total} cases passed)`)
