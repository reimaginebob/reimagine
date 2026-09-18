// Unit tests for src/referral-partner.js (the ?via= partner-link tag).
// Wired into prebuild via package.json so a regression on the validator
// fails the build before the bundle ships.
//
// Coverage:
//   1. Well-formed tags pass through isVia/normalizeVia unchanged.
//   2. normalizeVia trims and lowercases before validating.
//   3. Malformed or oversized tags are dropped (return null), never thrown.
//   4. isVia is strict about exact stored form (no trim/lowercase of its own).

import { isVia, normalizeVia, VIA_PARAM, VIA_STORAGE_KEY, VIA_MAX_AGE_DAYS } from '../src/referral-partner.js'

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

// ---- 1. Well-formed tags -----------------------------------------------

assertEq('accepts a simple lowercase tag', normalizeVia('pwc-alumni'), 'pwc-alumni')
assertEq('accepts a tag with digits', normalizeVia('hbs-boston-2026'), 'hbs-boston-2026')
assertEq('accepts the minimum length (2 chars)', normalizeVia('ab'), 'ab')
assertEq('isVia is true for an already-clean tag', isVia('pwc-alumni'), true)

// ---- 2. Trim + lowercase before validating ------------------------------

assertEq('trims surrounding whitespace', normalizeVia('  pwc-alumni  '), 'pwc-alumni')
assertEq('lowercases mixed case', normalizeVia('PwC-Alumni'), 'pwc-alumni')

// ---- 3. Malformed / oversized input is dropped, never thrown -----------

assertEq('rejects non-string input', normalizeVia(null), null)
assertEq('rejects undefined', normalizeVia(undefined), null)
assertEq('rejects a number', normalizeVia(42), null)
assertEq('rejects empty string', normalizeVia(''), null)
assertEq('rejects a single character (below the 2-char minimum)', normalizeVia('a'), null)
assertEq('rejects a tag starting with a hyphen', normalizeVia('-pwc'), null)
assertEq('rejects spaces inside the tag', normalizeVia('Bad Tag!'), null)
assertEq('rejects punctuation', normalizeVia('pwc_alumni'), null)
assertEq('rejects a tag over 40 characters',
  normalizeVia('a'.repeat(41)), null)
assertEq('accepts a tag at exactly 40 characters',
  normalizeVia('a'.repeat(40)), 'a'.repeat(40))

// ---- 4. isVia does not trim or lowercase --------------------------------

assertEq('isVia is false for mixed case (not already normalized)', isVia('PwC-Alumni'), false)
assertEq('isVia is false for untrimmed input', isVia(' pwc-alumni '), false)
assertEq('isVia is false for non-string input', isVia(null), false)

// ---- Constants sanity ----------------------------------------------------

assertEq('VIA_PARAM is the URL query key', VIA_PARAM, 'via')
assertEq('VIA_STORAGE_KEY is the localStorage key', VIA_STORAGE_KEY, 'pe_via')
assertEq('VIA_MAX_AGE_DAYS is a positive number', VIA_MAX_AGE_DAYS > 0, true)

// ---- Report -----------------------------------------------------------

if (failed > 0) {
  console.error(`\ntest-referral-partner: ${failed} of ${total} cases failed.`)
  process.exit(1)
}
console.log(`test-referral-partner: OK (${total} cases passed)`)
