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
// 2026-09-08 (cost lever 6.3.1, prelaunch audit): the step-specific guide
// slice used to be spliced INSIDE the same cached block as the stable HEAD
// and the book (MYOW_CONTENT), so every currentStep change forced a full
// rewrite of that whole ~260KB prefix. Split into two blocks -- a fully
// stable one (buildSystemPromptStable(), no currentStep dependency at all)
// and a step-varying one (buildGuideBlock(currentStep)) -- so a step change
// only rewrites the smaller block. Go Independent and pilot knowledge, which
// used to be two separate optional blocks, were merged into one to keep
// room under the 4-breakpoint cap now that the guide slice needs its own
// entry.
//
// THINGS THIS PINS DOWN:
//   1. profileBlock carries cache_control. Losing this silently is exactly the
//      regression that prompted the original fix -- someone edits the system
//      array, rebuilds the last entry, and drops the marker without noticing.
//   2. No more than 4 cache_control markers total in this array. The Claude API
//      hard-caps requests at 4 breakpoints; a 5th here is not a style
//      preference, it is a 400 in production the day a user hits the branch
//      that adds it.
//   3. The stable block (HEAD + book) and the guide slice are two separate
//      entries, in that order, both ahead of the optional knowledge block
//      and profileBlock -- losing this silently reintroduces the full-prefix
//      rewrite-per-step-change regression this PR fixed, just less visibly
//      than losing a marker entirely (the request still works, it just goes
//      back to costing what it did before).
//   4. Go Independent and pilot knowledge are ONE merged block, not two --
//      regressing this either reintroduces the two-separate-blocks shape
//      (which can legitimately hit both at once and blow the 4-breakpoint
//      cap the day a 5th block is ever added) or silently drops one of the
//      three knowledge sources if someone "merges" by deleting rather than
//      joining.
//
// The array itself lives in buildCoachRequest (extracted 2026-09-05 so a live
// eval script could call the real prompt assembly directly), not inline in
// the fetch call -- generate() now just passes the `system` it returns
// through. Anchored on the `const system = [` declaration rather than the
// fetch call for that reason.
import fs from 'node:fs'

const FILE = 'api/coach.js'
const src = fs.readFileSync(FILE, 'utf8')

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// --- buildSystemPromptStable(): fully stable, no currentStep dependency ---

check(/function buildSystemPromptStable\(\)\s*\{\s*return SYSTEM_PROMPT_HEAD \+ SYSTEM_PROMPT_TAIL\s*\}/.test(src),
  `${FILE}: buildSystemPromptStable() no longer returns exactly SYSTEM_PROMPT_HEAD + SYSTEM_PROMPT_TAIL with no currentStep dependency -- this is the block that must stay identical across every step and every turn`)
check(!/function buildSystemPromptStable\(currentStep\)/.test(src),
  `${FILE}: buildSystemPromptStable() takes a currentStep parameter again -- that's the regression this PR fixed (it forced a full-prefix rewrite on every step change)`)

// --- buildGuideBlock(currentStep): the guide slice's own breakpoint -------

check(/const GUIDE_BLOCK_HEAD = `USER GUIDE BELOW\. This is the source of truth for how Reimagine works:/.test(src),
  `${FILE}: GUIDE_BLOCK_HEAD is missing or its framing line changed -- this is the sentence that used to sit at the tail of SYSTEM_PROMPT_HEAD, now leading the guide slice's own block`)
check(/function buildGuideBlock\(currentStep\)\s*\{\s*return GUIDE_BLOCK_HEAD \+ resolveGuideBlock\(currentStep\)\s*\}/.test(src),
  `${FILE}: buildGuideBlock(currentStep) no longer returns exactly GUIDE_BLOCK_HEAD + resolveGuideBlock(currentStep)`)

// --- Go Independent + pilot knowledge: merged into one block --------------

check(src.includes('const knowledgeParts = []'),
  `${FILE}: the merged knowledge-block array (knowledgeParts) is missing`)
check(/knowledgeParts\.push\(`THIS PERSON IS BUILDING A PRACTICE/.test(src),
  `${FILE}: Go Independent's framing text is no longer pushed into knowledgeParts`)
check(src.includes('knowledgeParts.push(PIPELINE_CAPTURE_KNOWLEDGE)') && src.includes('knowledgeParts.push(NEXT_STEP_KNOWLEDGE)'),
  `${FILE}: pipeline-capture and/or next-step pilot knowledge are no longer pushed into knowledgeParts -- a "merge" that drops a source is worse than not merging`)
check(/const knowledgeBlock = knowledgeParts\.length \? knowledgeParts\.join\(/.test(src),
  `${FILE}: knowledgeParts is no longer joined into a single knowledgeBlock`)
check(!/\bgoIndependentBlock\b/.test(src) && !/\bpilotKnowledgeBlock\b/.test(src),
  `${FILE}: the old separate goIndependentBlock/pilotKnowledgeBlock variables are back -- they were merged into knowledgeBlock specifically to free a breakpoint for the guide slice`)

const sysIdx = src.indexOf('const system = [')
check(sysIdx !== -1, `${FILE}: could not find "const system = [" in buildCoachRequest`)

const sysEnd = src.indexOf('\n  ]', sysIdx)
check(sysEnd !== -1, `${FILE}: could not find the end of the system array`)

if (sysIdx !== -1 && sysEnd !== -1) {
  const systemArray = src.slice(sysIdx, sysEnd)

  check(/buildSystemPromptStable\(\),\s*cache_control:\s*\{\s*type:\s*'ephemeral'\s*\}/.test(systemArray),
    `${FILE}: buildSystemPromptStable() has no cache_control marker, or is no longer called with zero arguments, in the system array`)
  check(/buildGuideBlock\(currentStep\),\s*cache_control:\s*\{\s*type:\s*'ephemeral'\s*\}/.test(systemArray),
    `${FILE}: buildGuideBlock(currentStep) has no cache_control marker in the system array -- the guide slice needs its own breakpoint, separate from the stable block`)
  check(/knowledgeBlock,\s*cache_control:\s*\{\s*type:\s*'ephemeral'\s*\}/.test(systemArray),
    `${FILE}: the merged knowledgeBlock has no cache_control marker in the system array`)
  check(/profileBlock,\s*cache_control:\s*\{\s*type:\s*'ephemeral'\s*\}/.test(systemArray),
    `${FILE}: profileBlock has no cache_control marker -- it will be rebuilt and resent uncached on every turn again`)

  // Order matters for cache economics: least-volatile first so a change to a
  // later block never invalidates an earlier one's cache entry.
  const stableIdx = systemArray.indexOf('buildSystemPromptStable()')
  const guideIdx = systemArray.indexOf('buildGuideBlock(currentStep)')
  const knowledgeIdx = systemArray.indexOf('knowledgeBlock')
  const profileIdx = systemArray.indexOf('profileBlock')
  check(stableIdx !== -1 && guideIdx !== -1 && knowledgeIdx !== -1 && profileIdx !== -1 &&
    stableIdx < guideIdx && guideIdx < knowledgeIdx && knowledgeIdx < profileIdx,
    `${FILE}: the system array's block order is no longer stable-block, guide-slice, knowledge-block, profileBlock -- this order is what keeps the least-volatile content cached longest`)

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
console.log('test-coach-cache-blocks: OK (stable block and guide slice are separate breakpoints in the right order, Go Independent/pilot knowledge merged into one block, profileBlock cached last, markers within the 4-breakpoint limit, both feeder queries ordered)')
