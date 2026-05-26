// Unit tests for src/personal-brand-tail.mjs.
// Wired into prebuild via package.json so a regression on the structured-
// emit parser, schema validator, or lead-sentence extractor fails the build
// before the bundle ships.
//
// Coverage (Foundation A, 2026-05-25):
//   1. parsePersonalBrandTail finds the LAST ```json fence even when the
//      prose contains earlier brace-shaped content (worked-example snippet,
//      quoted JSON instructions). The first-brace-to-last-brace strategy
//      from parseResumeJSON would mis-slice these inputs.
//   2. parsePersonalBrandTail's bare-brace fallback fires when the model
//      drops the fence but emits the JSON at end-of-output anyway.
//   3. parsePersonalBrandTail returns { found: false } when no candidate
//      sits at end-of-output (bare brace mid-prose does NOT count).
//   4. parsePersonalBrandTail returns { found: true, parseFailed: true }
//      when the candidate region is unparseable.
//   5. validatePersonalBrandTailSchema fires the right granular error per
//      failure mode (missing throughLine, missing dimension, invalid
//      status, invalid anchor type, anchor count out of range, etc.).
//   6. extractLeadSentence handles the common shapes: bare sentence, lead
//      with abbreviations (no false stop on `e.g.` etc.), question /
//      exclamation enders, empty input.
//   7. stripPersonalBrandTail (Foundation A render-strip, 2026-05-26):
//      removes the JSON tail from a p3 output so render sites can display
//      prose only. Fenced and bare-brace tails both strip cleanly; output
//      with no tail returns unchanged; in-prose {braces} are preserved.

import {
  parsePersonalBrandTail,
  validatePersonalBrandTailSchema,
  extractLeadSentence,
  findPersonalBrandTailBoundary,
  stripPersonalBrandTail,
} from '../src/personal-brand-tail.mjs'

let failed = 0
const fail = (label, detail) => { console.error(`FAIL: ${label}`); if (detail) console.error(`  ${detail}`); failed++ }

// --- Test fixtures -------------------------------------------------------

const validJson = {
  throughLine: 'You build research practice where none exists yet.',
  dimensionalFit: {
    function: { status: 'aligned', read: 'Senior research leadership, named clearly by the work.' },
    industry: { status: 'one-off', read: 'The pattern has held across multiple sectors.' },
    position: { status: 'aligned', read: 'Operator roles inside the company.' },
    scale: { status: 'multi-off', read: 'The career has run at one order of magnitude.' },
    pace: { status: 'aligned', read: 'Operationally complex and time-pressured.' },
    mission: { status: 'thin', read: 'The dimension with the least signal in the inputs.' },
  },
  topAnchors: [
    { type: 'accomplishment', text: 'Built measurement protocols for a product that did not yet exist.' },
    { type: 'accomplishment', text: 'Sequenced rollout across thirty-eight markets while protecting margin.' },
    { type: 'reputation', text: 'Methodology under ambiguity, per colleague reputation note.' },
    { type: 'reputation', text: 'The person colleagues call when the question itself is unclear.' },
    { type: 'life-shaping', text: 'A decade in pre-playbook product categories.' },
    { type: 'life-shaping', text: 'Crisis-counseling background shaped the tolerance for ambiguity.' },
  ],
}

const validJsonString = JSON.stringify(validJson, null, 2)
const fencedTail = '```json\n' + validJsonString + '\n```'

// --- Test 1: parsePersonalBrandTail picks the LAST fence even with earlier braces in prose ---
{
  const prose = `You build research practice where none exists yet. A decade of work where the research question itself is ambiguous.

Here is an example object the prompt mentioned: { "this": "is in prose" }. That brace should not confuse the parser.

The dimensional fit is mostly confirming. **Function** is operational leadership.

${fencedTail}`
  const out = parsePersonalBrandTail(prose)
  if (!out.found || out.parseFailed || !out.parsed) {
    fail('Test 1: parsePersonalBrandTail picks LAST fence past in-prose braces', JSON.stringify(out))
  } else if (out.parsed.throughLine !== validJson.throughLine) {
    fail('Test 1: parsed object mismatch', `got throughLine=${out.parsed.throughLine}`)
  }
}

// --- Test 2: bare-brace fallback fires when the model drops the fence ---
{
  const prose = `You build research practice where none exists yet. A decade of work where the research question itself is ambiguous.

The dimensional fit is mostly confirming. **Function** is operational leadership.

${validJsonString}`
  const out = parsePersonalBrandTail(prose)
  if (!out.found || out.parseFailed || !out.parsed) {
    fail('Test 2: bare-brace fallback for fence-less tail', JSON.stringify(out))
  } else if (out.parsed.throughLine !== validJson.throughLine) {
    fail('Test 2: bare-brace fallback parsed wrong object')
  }
}

// --- Test 3: { found: false } when no candidate at end-of-output ---
{
  const prose = `You build research practice where none exists yet.

A mid-prose brace block { "this": "is", "not": "at end" } and then more prose follows. The output ends here, with no JSON tail anywhere near the end.`
  const out = parsePersonalBrandTail(prose)
  if (out.found) fail('Test 3: should be found:false (no end-of-output candidate)', JSON.stringify(out))
}

// --- Test 4: { found: true, parseFailed: true } when candidate exists but is malformed ---
{
  const broken = `You build research practice where none exists yet. The dimensional fit is mostly confirming.

\`\`\`json
{
  "throughLine": "missing close brace and trailing comma",
  "dimensionalFit": { "function": { "status": "aligned" },
  "topAnchors": [{ "type": "accomplishment", "text": "x" },]
\`\`\``
  const out = parsePersonalBrandTail(broken)
  if (!out.found || !out.parseFailed) {
    fail('Test 4: malformed fenced JSON should be found:true, parseFailed:true', JSON.stringify(out))
  }
}

// --- Test 5a: empty input -> {found:false} ---
{
  if (parsePersonalBrandTail('').found) fail('Test 5a: empty input should be found:false')
  if (parsePersonalBrandTail(null).found) fail('Test 5a: null input should be found:false')
  if (parsePersonalBrandTail(undefined).found) fail('Test 5a: undefined input should be found:false')
}

// --- Test 5b: findPersonalBrandTailBoundary returns -1 / >= 0 as expected ---
{
  if (findPersonalBrandTailBoundary('') !== -1) fail('Test 5b: empty boundary should be -1')
  if (findPersonalBrandTailBoundary('hello world') !== -1) fail('Test 5b: prose-only boundary should be -1')
  const b = findPersonalBrandTailBoundary('prose\n\n' + fencedTail)
  if (b === -1) fail('Test 5b: fenced tail boundary should be >= 0')
}

// --- Test 6: validatePersonalBrandTailSchema accepts the valid fixture ---
{
  const r = validatePersonalBrandTailSchema(validJson)
  if (!r.valid) fail('Test 6: valid fixture rejected', JSON.stringify(r.errors))
}

// --- Test 7: missing throughLine ---
{
  const obj = JSON.parse(JSON.stringify(validJson))
  delete obj.throughLine
  const r = validatePersonalBrandTailSchema(obj)
  if (r.valid) fail('Test 7: missing throughLine should fail')
  if (!r.errors.some(e => e.startsWith('throughLine'))) fail('Test 7: missing throughLine error not named', JSON.stringify(r.errors))
}

// --- Test 8: missing scale dimension ---
{
  const obj = JSON.parse(JSON.stringify(validJson))
  delete obj.dimensionalFit.scale
  const r = validatePersonalBrandTailSchema(obj)
  if (r.valid) fail('Test 8: missing scale dimension should fail')
  if (!r.errors.some(e => e === 'dimensionalFit.scale: missing')) fail('Test 8: missing-scale error not named', JSON.stringify(r.errors))
}

// --- Test 9: invalid status enum value ---
{
  const obj = JSON.parse(JSON.stringify(validJson))
  obj.dimensionalFit.mission.status = 'misaligned'
  const r = validatePersonalBrandTailSchema(obj)
  if (r.valid) fail('Test 9: invalid status should fail')
  if (!r.errors.some(e => e.startsWith('dimensionalFit.mission.status'))) fail('Test 9: invalid-status error not named', JSON.stringify(r.errors))
}

// --- Test 10: empty dimension read ---
{
  const obj = JSON.parse(JSON.stringify(validJson))
  obj.dimensionalFit.industry.read = '   '
  const r = validatePersonalBrandTailSchema(obj)
  if (r.valid) fail('Test 10: empty read should fail')
  if (!r.errors.some(e => e === 'dimensionalFit.industry.read: missing or empty')) fail('Test 10: empty-read error not named', JSON.stringify(r.errors))
}

// --- Test 11: topAnchors too few (< 6) ---
{
  const obj = JSON.parse(JSON.stringify(validJson))
  obj.topAnchors = obj.topAnchors.slice(0, 3)
  const r = validatePersonalBrandTailSchema(obj)
  if (r.valid) fail('Test 11: 3 anchors should fail')
  if (!r.errors.some(e => e === 'topAnchors: 3 entries (expected 6 to 8)')) fail('Test 11: count error not named', JSON.stringify(r.errors))
}

// --- Test 12: topAnchors too many (> 8) ---
{
  const obj = JSON.parse(JSON.stringify(validJson))
  obj.topAnchors = [...obj.topAnchors, ...obj.topAnchors, ...obj.topAnchors] // 18 entries
  const r = validatePersonalBrandTailSchema(obj)
  if (r.valid) fail('Test 12: 18 anchors should fail')
  if (!r.errors.some(e => e === 'topAnchors: 18 entries (expected 6 to 8)')) fail('Test 12: count error not named', JSON.stringify(r.errors))
}

// --- Test 13: topAnchors invalid type (trait / career-arc were dropped) ---
{
  const obj = JSON.parse(JSON.stringify(validJson))
  obj.topAnchors[0].type = 'trait'
  obj.topAnchors[1].type = 'career-arc'
  const r = validatePersonalBrandTailSchema(obj)
  if (r.valid) fail('Test 13: trait / career-arc should be rejected')
  const traitErr = r.errors.some(e => e.includes('topAnchors[0].type: invalid'))
  const arcErr = r.errors.some(e => e.includes('topAnchors[1].type: invalid'))
  if (!traitErr || !arcErr) fail('Test 13: invalid-type errors not named', JSON.stringify(r.errors))
}

// --- Test 14: topAnchors entry not an object / missing text ---
{
  const obj = JSON.parse(JSON.stringify(validJson))
  obj.topAnchors[2] = 'a string instead of an anchor object'
  obj.topAnchors[3].text = ''
  const r = validatePersonalBrandTailSchema(obj)
  if (r.valid) fail('Test 14: bad-entry shapes should fail')
  if (!r.errors.some(e => e.includes('topAnchors[2]: not an object'))) fail('Test 14: not-an-object error not named', JSON.stringify(r.errors))
  if (!r.errors.some(e => e.includes('topAnchors[3].text: missing or empty'))) fail('Test 14: empty-text error not named', JSON.stringify(r.errors))
}

// --- Test 15: root not an object ---
{
  const r1 = validatePersonalBrandTailSchema(null)
  if (r1.valid) fail('Test 15a: null root should fail')
  const r2 = validatePersonalBrandTailSchema('a string')
  if (r2.valid) fail('Test 15b: string root should fail')
}

// --- Test 16: extractLeadSentence — bare lead ---
{
  const r = extractLeadSentence('You build research practice where none exists yet. The dimensional fit is mostly confirming.')
  if (r !== 'You build research practice where none exists yet.') fail('Test 16: bare lead mismatch', r)
}

// --- Test 17: extractLeadSentence — leading whitespace and newlines ---
{
  const r = extractLeadSentence('\n\n  You operate at the seam where capability and conviction meet. More prose follows.')
  if (r !== 'You operate at the seam where capability and conviction meet.') fail('Test 17: leading-whitespace mismatch', r)
}

// --- Test 18: extractLeadSentence — question ender ---
{
  const r = extractLeadSentence('Where does this transfer? Multiple places, as the dimensions below show.')
  if (r !== 'Where does this transfer?') fail('Test 18: question ender mismatch', r)
}

// --- Test 19: extractLeadSentence — exclamation ender (edge case) ---
{
  const r = extractLeadSentence('You are unstoppable! And here is why.')
  if (r !== 'You are unstoppable!') fail('Test 19: exclamation ender mismatch', r)
}

// --- Test 20: extractLeadSentence — single sentence, no trailing space ---
{
  const r = extractLeadSentence('You build things that last.')
  if (r !== 'You build things that last.') fail('Test 20: single-sentence end-of-string', r)
}

// --- Test 21: extractLeadSentence — empty input ---
{
  if (extractLeadSentence('') !== '') fail('Test 21: empty input should yield empty string')
  if (extractLeadSentence(null) !== '') fail('Test 21: null input should yield empty string')
}

// --- Test 22: end-to-end — pre-tail prose slice + lead extraction matches the throughLine ---
{
  const prose = `You build research practice where none exists yet. The dimensional fit is mostly confirming. **Function** is operational leadership.

The dimension worth examining is **scale**. You have run $180M well.

`
  const fullOutput = prose + fencedTail
  const boundary = findPersonalBrandTailBoundary(fullOutput)
  if (boundary === -1) {
    fail('Test 22: tail boundary not found in end-to-end fixture')
  } else {
    const slice = fullOutput.slice(0, boundary)
    const lead = extractLeadSentence(slice)
    if (lead !== validJson.throughLine) {
      fail('Test 22: end-to-end lead-drift comparator (matching case)', `prose lead=${lead} | throughLine=${validJson.throughLine}`)
    }
  }
}

// --- Test 23: stripPersonalBrandTail — fenced tail strips cleanly ---
{
  const prose = `You build research practice where none exists yet. The dimensional fit is mostly confirming. **Function** is operational leadership.

The dimension worth examining is **scale**. You have run $180M well.`
  const input = prose + '\n\n' + fencedTail
  const stripped = stripPersonalBrandTail(input)
  if (stripped !== prose) {
    fail('Test 23: fenced tail strip', `expected prose only; got tail-end="${stripped.slice(-60)}"`)
  }
}

// --- Test 24: stripPersonalBrandTail — bare-brace tail strips cleanly ---
{
  const prose = `You build research practice where none exists yet. The dimensional fit is mostly confirming. **Function** is operational leadership.

The dimension worth examining is **scale**. You have run $180M well.`
  const input = prose + '\n\n' + validJsonString
  const stripped = stripPersonalBrandTail(input)
  if (stripped !== prose) {
    fail('Test 24: bare-brace tail strip', `expected prose only; got tail-end="${stripped.slice(-60)}"`)
  }
}

// --- Test 25: stripPersonalBrandTail — output with no tail returns unchanged ---
{
  const proseOnly = `You build research practice where none exists yet. A decade of work where the research question itself is ambiguous.

Where this transfers: any product category still forming where the research function has to be built alongside the team.`
  const stripped = stripPersonalBrandTail(proseOnly)
  if (stripped !== proseOnly) {
    fail('Test 25: no-tail input should return unchanged', `length delta=${proseOnly.length - stripped.length}`)
  }
}

// --- Test 26: stripPersonalBrandTail — prose containing inline {braces} not at end-of-output is untouched ---
{
  const prose = `You build research practice where none exists yet.

Here is an example object the prompt mentioned: { "this": "is in prose" }. That brace should not trigger a strip.

The dimensional fit is mostly confirming. **Function** is operational leadership.

The dimension worth examining is **scale**.`
  const stripped = stripPersonalBrandTail(prose)
  if (stripped !== prose) {
    fail('Test 26: in-prose braces should be preserved', `length delta=${prose.length - stripped.length}, tail-end="${stripped.slice(-60)}"`)
  }
}

// --- Test 27: stripPersonalBrandTail — empty / null / non-string ---
{
  if (stripPersonalBrandTail('') !== '') fail('Test 27a: empty input should return empty string unchanged')
  if (stripPersonalBrandTail(null) !== null) fail('Test 27b: null input should return null unchanged')
  if (stripPersonalBrandTail(undefined) !== undefined) fail('Test 27c: undefined input should return undefined unchanged')
}

if (failed > 0) {
  console.error(`\ntest-personal-brand-tail: ${failed} cases failed.`)
  process.exit(1)
}
console.log('test-personal-brand-tail: OK (27 test groups passed)')
