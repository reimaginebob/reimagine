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

if (failed > 0) {
  console.error(`\ntest-voice-patterns: ${failed} of ${cases.length + 2} cases failed.`)
  process.exit(1)
}
console.log(`test-voice-patterns: OK (${cases.length + 2} cases passed)`)
