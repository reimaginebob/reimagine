// Guards the cache_control markers on My Coach's system array in api/coach.js.
//
// WHY THIS EXISTS. profileBlock -- pipeline status, activity data, Focus
// Playbooks, capture notes -- used to be rebuilt and resent in full on every
// single turn of every conversation, uncached, even though turn 2 of a
// conversation almost always carries the identical profile turn 1 did. Console
// notification 2026-09-03: Career Club's direct API traffic had a low prompt
// cache hit rate. Traced to this. Fixed by giving profileBlock its own
// breakpoint. This is a source-level test rather than a live-call test because
// hitting the real endpoint costs real money and needs a live key; it can only
// verify the request SHAPE, not that Anthropic actually returns a cache hit --
// that has to be checked against usage.cache_read_input_tokens in production.
//
// TWO THINGS THIS PINS DOWN:
//   1. profileBlock carries cache_control. Losing this silently is exactly the
//      regression that prompted the fix -- someone edits the system array,
//      rebuilds the last entry, and drops the marker without noticing.
//   2. No more than 4 cache_control markers total in this array. The Claude API
//      hard-caps requests at 4 breakpoints; a 5th here is not a style
//      preference, it is a 400 in production the day a user hits the branch
//      that adds it (e.g. a pilot user on the Go Independent track, where
//      goIndependentBlock and pilotKnowledgeBlock can both be present at once).
import fs from 'node:fs'

const FILE = 'api/coach.js'
const src = fs.readFileSync(FILE, 'utf8')

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// Isolate the `system: [ ... ]` array inside the generate() function that
// calls the Anthropic API directly (there is exactly one `fetch('https://api.
// anthropic.com/v1/messages'` call in this file -- the coach's own generation
// call -- so anchoring on that finds the right array even if unrelated code
// above or below also mentions "system:").
const fetchIdx = src.indexOf("fetch('https://api.anthropic.com/v1/messages'")
check(fetchIdx !== -1, `${FILE}: could not find the Anthropic messages fetch call`)

const sysIdx = src.indexOf('system: [', fetchIdx)
check(sysIdx !== -1, `${FILE}: could not find "system: [" after the fetch call`)

const sysEnd = src.indexOf('\n        ],', sysIdx)
check(sysEnd !== -1, `${FILE}: could not find the end of the system array`)

if (fetchIdx !== -1 && sysIdx !== -1 && sysEnd !== -1) {
  const systemArray = src.slice(sysIdx, sysEnd)

  check(/profileBlock,\s*cache_control:\s*\{\s*type:\s*'ephemeral'\s*\}/.test(systemArray),
    `${FILE}: profileBlock has no cache_control marker -- it will be rebuilt and resent uncached on every turn again`)

  const markerCount = (systemArray.match(/cache_control:\s*\{/g) || []).length
  check(markerCount <= 4,
    `${FILE}: ${markerCount} cache_control markers in the system array -- the Claude API allows at most 4 per request`)
  check(markerCount >= 1, `${FILE}: no cache_control markers found at all -- did the array get rewritten?`)
}

// A marker on profileBlock only pays off if profileBlock's own bytes are
// actually stable between two otherwise-identical requests. Two of its inputs
// come from unordered SQL (no ORDER BY means Postgres makes no promise about
// row order) and get consumed by a plain `for` loop that turns row order
// directly into output line order -- pursuitRows in buildActivityBlock's
// sibling buildPursuitStatusBlock reasoning, and activityFacts in
// buildActivityBlock itself. A reorder between two requests with the same
// underlying data would still change profileBlock's bytes and force a cache
// write with no read, same failure as no marker at all, just harder to notice
// because the marker really is there. Both queries need ORDER BY for the
// marker above to mean anything.
check(/FROM pursuit_status WHERE user_id = \$\{user\.id\} ORDER BY record_id/.test(src),
  `${FILE}: the pursuit_status query lost its ORDER BY -- unordered rows can reorder nextStepNote between requests and defeat the cache marker on profileBlock even though it is present`)
check(/FROM user_activity_facts WHERE user_id = \$\{user\.id\} ORDER BY activity/.test(src),
  `${FILE}: the user_activity_facts query lost its ORDER BY -- unordered rows can reorder buildActivityBlock's KNOWN list between requests and defeat the cache marker on profileBlock even though it is present`)

if (failures) {
  console.error(`test-coach-cache-blocks: FAIL (${failures})`)
  process.exit(1)
}
console.log('test-coach-cache-blocks: OK (profileBlock cached, markers within the 4-breakpoint limit, both feeder queries ordered)')
