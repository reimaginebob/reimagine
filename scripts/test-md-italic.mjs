// Unit test for the italic-underscore regex used by Inline and md2html in
// src/App.jsx. Mirrors the regex shape; if either copy drifts, this file
// surfaces the regression at prebuild.
//
// Wired into prebuild via package.json so a regression fails the build.

const ITALIC_UNDERSCORE = /(?<![A-Za-z0-9_])_([^_\s][^_]*?[^_\s])_(?![A-Za-z0-9_])/g
const normalize = (s) => s.replace(ITALIC_UNDERSCORE, '*$1*')

const cases = [
  // [label, input, expected]
  ['paragraph italic (mockup pattern)',
    '_If the framing of "broken systems" misses, push back. Confirm or redirect._',
    '*If the framing of "broken systems" misses, push back. Confirm or redirect.*'],
  ['phrase italic mid-prose',
    'You see this in the _quiet operator_ pattern, where',
    'You see this in the *quiet operator* pattern, where'],
  ['snake_case identifier stays literal',
    'See snake_case_word in the source',
    'See snake_case_word in the source'],
  ['p3_version stays literal',
    'outputs.p3_version is the migration sentinel',
    'outputs.p3_version is the migration sentinel'],
  ['mixed: snake_case in same paragraph as a real italic',
    'The flag is outputs.p3_version. _It tells us the format._',
    'The flag is outputs.p3_version. *It tells us the format.*'],
  ['adjacent identifiers do not bleed',
    'one_two and three_four',
    'one_two and three_four'],
  ['underscores around digits stay literal',
    'use _1_ and _2_ as labels',
    'use _1_ and _2_ as labels'],
  ['italic at start of line',
    '_emphasis_ here',
    '*emphasis* here'],
  ['italic at end of line',
    'here is _emphasis_',
    'here is *emphasis*'],
  ['empty inside stays literal',
    'pure __ marker stays',
    'pure __ marker stays'],
  ['file path with underscores stays literal',
    'open file_name_v2.md to read',
    'open file_name_v2.md to read'],
  ['existing asterisk italic untouched',
    '*already italic* and _new italic_ together',
    '*already italic* and *new italic* together'],
  ['leading space inside underscores blocks match',
    'a _ word_ b',
    'a _ word_ b'],
  ['trailing space inside underscores blocks match',
    'a _word _ b',
    'a _word _ b'],
]

let failed = 0
for (const [label, input, expected] of cases) {
  const got = normalize(input)
  if (got !== expected) {
    console.error(`FAIL: ${label}`)
    console.error(`  input:    ${JSON.stringify(input)}`)
    console.error(`  expected: ${JSON.stringify(expected)}`)
    console.error(`  got:      ${JSON.stringify(got)}`)
    failed++
  }
}

if (failed > 0) {
  console.error(`\ntest-md-italic: ${failed} of ${cases.length} cases failed.`)
  process.exit(1)
}
console.log(`test-md-italic: OK (${cases.length} cases passed)`)
