// Unit tests for api/_lib/strip-nul.js (NUL byte sanitizer).
// Wired into prebuild via package.json so a regression on stripNul fails the
// build before the bundle ships.
//
// Coverage:
//   1. String leaves with U+0000 are stripped clean.
//   2. Nested objects and arrays recurse correctly.
//   3. Non-string scalars (number, boolean, null, undefined) pass through.
//   4. Input is not mutated; a new value is returned.
//   5. The shape of a realistic profile save body round-trips: every NUL
//      stripped, every other byte preserved.

import { stripNul } from '../api/_lib/strip-nul.js'

const NUL = String.fromCharCode(0)

let failed = 0
let total = 0

function assertEq(label, actual, expected) {
  total++
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
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

// ---- 1. Top-level strings ---------------------------------------------

assertEq('strips NUL from a string', stripNul(`hi${NUL}there`), 'hithere')
assertEq('strips multiple NULs', stripNul(`a${NUL}b${NUL}c`), 'abc')
assertEq('leaves clean string untouched', stripNul('hello world'), 'hello world')
assertEq('empty string passes through', stripNul(''), '')

// ---- 2. Nested objects and arrays -------------------------------------

assertEq('strips inside object value',
  stripNul({ name: `foo${NUL}bar` }),
  { name: 'foobar' })

assertEq('strips inside array of strings',
  stripNul([`a${NUL}`, `b${NUL}`, 'c']),
  ['a', 'b', 'c'])

assertEq('recurses through nested object + array',
  stripNul({ outer: { inner: [`x${NUL}`, { deep: `y${NUL}z` }] } }),
  { outer: { inner: ['x', { deep: 'yz' }] } })

// ---- 3. Non-string scalars pass through -------------------------------

assertEq('number passes through', stripNul(42), 42)
assertEq('boolean passes through', stripNul(false), false)
assertEq('null passes through', stripNul(null), null)
assertEq('undefined passes through', stripNul(undefined), undefined)
assertEq('mixed scalars in object',
  stripNul({ n: 1, b: true, s: `x${NUL}`, nil: null }),
  { n: 1, b: true, s: 'x', nil: null })

// ---- 4. Does not mutate input ----------------------------------------

const input = { resume: `a${NUL}b`, nested: { v: `c${NUL}` } }
const before = JSON.stringify(input)
stripNul(input)
assertTruthy('input object not mutated', JSON.stringify(input) === before,
  `before=${before} after=${JSON.stringify(input)}`)

// ---- 5. Realistic profile save body round-trip -----------------------

// Shape mirrors what src/App.jsx posts to /api/profile/save:
//   { step, profile, outputs, done, deepOpts, chosen, selectedLane, ... }
const body = {
  step: 'p1',
  profile: {
    resume: `Senior PM\nResults driven${NUL}leader`,
    skills: [`Python${NUL}`, 'SQL'],
    rep: { memory: `clear${NUL}thinker` },
  },
  outputs: { p1: `## QUICK TAKEAWAY${NUL}\nStrong fit.` },
  done: ['p1'],
  selectedLane: 'familiar',
}

const sanitized = stripNul(body)
const flat = JSON.stringify(sanitized)
assertTruthy('no NUL anywhere in sanitized body', !flat.includes(NUL),
  `flat=${JSON.stringify(flat)}`)
assertEq('non-NUL bytes preserved',
  sanitized.profile.resume,
  'Senior PM\nResults drivenleader')
assertEq('array string entries cleaned',
  sanitized.profile.skills,
  ['Python', 'SQL'])
assertEq('untouched fields stable',
  sanitized.done,
  ['p1'])

// ---- Report -----------------------------------------------------------

if (failed > 0) {
  console.error(`\ntest-strip-nul: ${failed} of ${total} cases failed.`)
  process.exit(1)
}
console.log(`test-strip-nul: OK (${total} cases passed)`)
