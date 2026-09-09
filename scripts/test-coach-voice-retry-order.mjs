// Guards finding #2.3 from the 2026-09-07 My Coach diagnostic review
// (independently verified before this fix): the voice-violation retry ran
// BEFORE trailer extraction, over text that still carried every trailer
// line. A rewrite that happened to drop or mangle a capture scored BETTER
// on voice compliance (fewer characters to trip a pattern on) and could
// silently win, deleting the capture with no log line. It also meant a
// captured phrase inside a trailer's own JSON could trigger a rewrite of a
// reply that was otherwise fine. Trailer extraction now runs first, so
// every capture is locked in before the voice retry ever has a chance to
// touch anything -- the retry can only ever change the visible prose.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

// Extraction (parseSelfcheck, the first line of the trailer-parsing block)
// must now appear BEFORE the voice-retry block, not after it.
const extractionIdx = coach.indexOf('const { feature, text: selfcheckStripped } = parseSelfcheck(cleaned)')
const retryIdx = coach.indexOf("// Regenerate-on-violation retry (the brief's deferred-optional item)")
check(extractionIdx !== -1, `${COACH}: could not find the trailer-extraction block (parseSelfcheck)`)
check(retryIdx !== -1, `${COACH}: could not find the voice-retry block`)
check(extractionIdx !== -1 && retryIdx !== -1 && extractionIdx < retryIdx,
  `${COACH}: trailer extraction no longer runs before the voice retry -- this is the exact ordering bug being fixed`)

// The retry block voice-checks strippedText (post-extraction prose), not
// cleaned (which still carries every trailer line).
const retryBlock = retryIdx !== -1 ? coach.slice(retryIdx, retryIdx + 6000) : ''
check(retryBlock.includes('const flags = detectResidualVoice(strippedText)'),
  `${COACH}: the retry's first voice check still runs against \`cleaned\` instead of \`strippedText\` -- it would still see raw trailer JSON`)
check(retryBlock.includes("const hardViolations = detectVoiceViolations(strippedText, { scope: 'runtime' })"),
  `${COACH}: the retry's hard-violation check still runs against \`cleaned\` instead of \`strippedText\``)

// The retry's winning path updates strippedText, not cleaned -- captures
// were already extracted from cleaned before this block ever runs, so
// reassigning cleaned here would do nothing downstream (and did nothing,
// which was silently fine only because it happened to be dead code after
// the reorder -- before the reorder, this WAS the live path).
check(retryBlock.includes('if (useRetry) strippedText = cleaned2'),
  `${COACH}: a winning retry no longer updates strippedText -- check it isn't still assigning the now-dead \`cleaned\` variable`)
check(!retryBlock.includes('if (useRetry) cleaned = cleaned2'),
  `${COACH}: the retry still reassigns \`cleaned\` post-extraction, which is now dead and would silently do nothing`)

// A defensive sweep removes any trailer-shaped line the rewrite reproduces,
// and the shared TRAILER_NAME_SWEEP regex it uses is defined once, ahead of
// both the extraction and retry blocks.
// 2026-09-09 production fix: MOOD added to the name list -- it was missing,
// so a MOOD: low line reproduced by a voice-retry rewrite shipped to the
// client unstripped. The exact literal below is mirrored (and behaviorally
// exercised against the real symptom) in test-coach-mood-retry-sweep.mjs;
// this check is what keeps that mirror from silently drifting.
check(coach.includes('const TRAILER_NAME_SWEEP = /^\\s*(?:SELFCHECK|MOOD|MILESTONEMENTIONED|ACTIVITY|COACHNOTE|VALUESCAPTURE|REPUTATIONCAPTURE|SKILLSCAPTURE|SKILLSREMOVE|PRIORITIESCAPTURE|LIFESTORYCAPTURE|ASSESSMENTCAPTURE|OPPORTUNITYUPDATE|OPPORTUNITYCONTEXT|OPPORTUNITYARCHIVE|CLOSEREASON|OPCARDREWORK|SEARCHINTAKE|BRANDREWORK|SECTIONREWORK):.*$/gim'),
  `${COACH}: TRAILER_NAME_SWEEP is missing or missing MOOD -- a voice-retry rewrite that reproduces a MOOD: low line would leak it to the visible reply`)
check(retryBlock.includes("applyOutputStrippers(raw2).replace(TRAILER_NAME_SWEEP, '').trim()"),
  `${COACH}: the retry's regenerated text is not swept for stray trailer syntax before being adopted as the new strippedText`)
check(coach.indexOf('const TRAILER_NAME_SWEEP') < extractionIdx,
  `${COACH}: TRAILER_NAME_SWEEP is not defined ahead of the extraction block that (implicitly) documents it as shared`)

// Observability: the existing voice-retry log line now records that
// captures cannot be affected by this block's outcome.
check(retryBlock.includes('captures_locked_before_retry: true'),
  `${COACH}: the voice-retry log line no longer records that captures were locked in before this block ran`)

if (failures) {
  console.error(`test-coach-voice-retry-order: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-voice-retry-order: OK (trailer extraction runs before the voice retry, voice detection checks prose only, a winning retry can no longer silently delete a capture, stray trailer syntax in a rewrite is swept defensively)')
}
