// Guards api/_lib/redact-pii.js, the text scrub behind the coach-insights
// content-review page (Output/handoff/2026-09-16_four-my-coach-breaks-brief.md,
// item A). A 2026-09-11 read of the live page found full names, a phone
// number, and an email address in Coach-drafted replies, even though the
// page was labeled "de-identified" and the privacy policy (src/legalDocs.js)
// promises names/emails/account identifiers are removed before review. This
// is a pure function with no DB dependency, so it is directly importable.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const { redactPII } = await import('../api/_lib/redact-pii.js')

// --- The exact 9/11 shape: a drafted email with a signature block ---------
const signed = "Best,\nLindsey Bartlett\n(513) 555-0142\nlindsey.bartlett@gmail.com"
const signedOut = redactPII(signed, { names: ['Lindsey Bartlett'] })
check(!signedOut.includes('Lindsey'), 'redactPII: the signature block still contains the first name')
check(!signedOut.includes('Bartlett'), 'redactPII: the signature block still contains the last name')
check(!signedOut.includes('555-0142'), 'redactPII: the signature block still contains the phone number')
check(!signedOut.includes('lindsey.bartlett@gmail.com'), 'redactPII: the signature block still contains the email address')
check(signedOut.includes('[name]') && signedOut.includes('[phone]') && signedOut.includes('[email]'),
  'redactPII: the signature block does not carry all three placeholders')

// --- A panel-person name, first + last supplied together ------------------
check(redactPII('Thanks, Julie Johnson', { names: ['Julie Johnson'] }) === 'Thanks, [name]',
  'redactPII: a full panel-person name should redact as one [name], not two')

// --- International/plus-prefixed phone shape -------------------------------
check(redactPII('Call me at +1 513.555.0142', {}) === 'Call me at [phone]',
  'redactPII: a +country-code, dot-separated phone number should redact')

// --- Possessive form ---------------------------------------------------
check(redactPII("Lindsey's resume", { names: ['Lindsey Bartlett'] }) === '[name] resume',
  'redactPII: a possessive ("Lindsey\'s") should redact the name and consume the \'s, not leave it dangling')

// --- LinkedIn profile URL ---------------------------------------------------
check(redactPII('See https://www.linkedin.com/in/lindseybartlett/ for background', {}) ===
  'See [linkedin] for background',
  'redactPII: a linkedin.com/in/... URL should redact')

// --- The over-redaction trade-off, made explicit and tested on purpose:
// a common English word that happens to BE someone's first name gets
// swept up too. This is accepted, not a bug -- the alternative (skipping
// exact-match common words) would let a real first name like "Hope" leak
// through untouched whenever the surrounding sentence looks ordinary. ---
check(redactPII('I hope this helps', { names: ['Hope'] }) === 'I [name] this helps',
  'redactPII: a first name that is also an ordinary word should still redact (documented over-redaction trade-off)')

// --- Under the 3-character floor: not redacted ------------------------
check(redactPII('Al said hi', { names: ['Al'] }) === 'Al said hi',
  'redactPII: a two-letter name should NOT redact -- too likely to be an ordinary short word')

// --- No names/emails supplied: only the pattern-based catches fire --------
check(redactPII('No names here, just deb@example.com', {}) === 'No names here, just [email]',
  'redactPII: an email address in the text redacts even with no names/emails supplied')

// --- Null / non-string input passes through unchanged ---------------------
check(redactPII(null, { names: ['x'] }) === null, 'redactPII(null): should return null unchanged')
check(redactPII(undefined, { names: ['x'] }) === undefined, 'redactPII(undefined): should return undefined unchanged')
check(redactPII(42, { names: ['x'] }) === 42, 'redactPII(42): a non-string should return unchanged')
check(redactPII('', { names: ['x'] }) === '', 'redactPII(""): an empty string should return unchanged')

// --- No second-order leak: redacting doesn't accidentally strip content
// that is not actually PII ---
check(redactPII('The role pays well and the team is strong.', { names: ['Julie Johnson'] }) ===
  'The role pays well and the team is strong.',
  'redactPII: ordinary prose with no PII and an unrelated name list should be untouched')

if (failures) {
  console.error(`test-redact-pii: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-redact-pii: OK (names, emails, phone numbers and LinkedIn URLs redact correctly; possessives, over-redaction of common-word names, the 3-character floor, and null/non-string passthrough all behave as documented)')
}
