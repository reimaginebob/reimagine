// t01-19 follow-up (2026-09-12): narrower sibling to reset-moments.js for
// the snooze-return test -- moves exactly one widen-search row's
// snoozedUntil/retiredUntil (src/widen-search.js) instead of wiping the
// whole coachMoments blob, so a tester does not lose the dedupe/pacing
// state a session just spent establishing just to fast-forward one date.
//
// checkAdminAuth itself needs a live DB lookup and cannot be exercised here
// (same constraint test-admin-reset-moments.mjs documents) -- source-
// presence covers the auth gate and the SQL shape; isInternalAccount and
// the rowKey/field/daysFromNow validation are pure and get full behavioral
// coverage.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const { isInternalAccount } = await import('../api/_lib/feature-flags.js')
const { WIDEN_SEARCH_ROW_KEYS } = await import('../src/coach-moments.js')

check(isInternalAccount({ email: 'lindsey@career.club' }) === true,
  'an @career.club account should be treated as internal')
check(isInternalAccount({ email: 'lindsey@example.com' }) === false,
  'a non-career.club account should NOT be treated as internal')

const ENDPOINT = 'api/admin/set-widen-search-date.js'
const src = fs.readFileSync(ENDPOINT, 'utf8')

check(src.includes('checkAdminAuth(req, res)'), `${ENDPOINT}: missing the standard admin-session auth gate`)
check(src.includes('adminLoginEmailsMissing()'), `${ENDPOINT}: missing the server-misconfiguration guard`)
check(src.includes('isInternalAccount({ email })'), `${ENDPOINT}: the target account is not checked against isInternalAccount -- this must only ever be able to write to an internal account, never a real user's`)
check(/if\s*\(!isInternalAccount\(\{ email \}\)\)\s*\{\s*return res\.status\(400\)/.test(src),
  `${ENDPOINT}: a non-internal target email should be rejected with a 400, not silently proceed`)

// rowKey validated against the real five-row enum -- an arbitrary string
// here would let this endpoint write an unrelated key into widenSearchState.
check(src.includes('WIDEN_SEARCH_ROW_KEYS.includes(rowKey)'),
  `${ENDPOINT}: rowKey is not validated against the real five-row enum`)
check(src.includes("import { WIDEN_SEARCH_ROW_KEYS } from '../../src/coach-moments.js'"),
  `${ENDPOINT}: WIDEN_SEARCH_ROW_KEYS is not imported from the real catalog`)

// field restricted to the two real widen-search.js date fields -- never an
// arbitrary key that could write outside what the engine actually reads.
check(src.includes("const VALID_FIELDS = ['snoozedUntil', 'retiredUntil']"),
  `${ENDPOINT}: field is not restricted to the two real widen-search.js date fields`)
check(src.includes('VALID_FIELDS.includes(field)'),
  `${ENDPOINT}: field is not validated before use`)

// daysFromNow must be a finite number -- and explicitly allowed to be
// negative, since moving a date into the past (simulating days having
// already passed) is the actual use case this endpoint exists for.
check(src.includes('Number.isFinite(daysFromNow)'),
  `${ENDPOINT}: daysFromNow is not validated as a finite number`)
check(!/daysFromNow\s*[<>]=?\s*0/.test(src),
  `${ENDPOINT}: daysFromNow should not be restricted to non-negative values -- a negative value moving the date into the past is the point`)

// The write scopes to widenSearchState[rowKey][field] via jsonb_set with
// create_missing:true, leaving the rest of profile_state (including
// coachMoments) untouched -- never a blind overwrite of the whole blob.
check(src.includes("ARRAY['widenSearchState', ${rowKey}, ${field}]"),
  `${ENDPOINT}: the UPDATE does not scope its jsonb_set path to widenSearchState[rowKey][field]`)
check(src.includes('true\n      )') || /to_jsonb\(\$\{iso\}::text\),\s*\n?\s*true/.test(src),
  `${ENDPOINT}: jsonb_set should pass create_missing:true so a never-before-touched row/key still gets written`)
check(/UPDATE users/.test(src) && /WHERE lower\(email\) = lower\(\$\{email\}\)/.test(src),
  `${ENDPOINT}: the UPDATE is not scoped to the target email`)

// Logging who ran it and what was set, same discipline as reset-moments.js.
check(src.includes('setBy: admin && admin.email'),
  `${ENDPOINT}: the write is not logged with which admin ran it`)
check(src.includes('getSessionUser(req, res)'),
  `${ENDPOINT}: the acting admin's own identity is never looked up -- setBy would be undefined`)

if (failures) {
  console.error(`test-admin-set-widen-search-date: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-admin-set-widen-search-date: OK (isInternalAccount restricts the target to an @career.club account; rowKey/field are validated against the real enums; the write scopes to widenSearchState[rowKey][field] alone via jsonb_set, never touching coachMoments; daysFromNow may be negative to simulate days having already passed; the write is logged with which admin ran it)')
}
