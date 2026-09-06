// Guards the Values/Passions merge-not-overwrite fix (2026-09-06). This
// mechanism has shipped since 2026-08-15 with no dedicated test -- worth
// closing given what the bug it just got caught for actually was.
//
// VALUESCAPTURE's tap replaces the WHOLE field with exactly the JSON the
// model wrote. The original instruction told the model only to write what
// the person just said, which meant someone who started thin (two values,
// given while skeptical or tired) and later warmed up enough to add three
// more would have their original two silently vanish the moment the tap
// landed -- the model's honest, literal read of the old instruction produced
// only the three new ones, and the tap-offer copy's "it replaces what is
// there" is true but is a warning label on a data-loss trap, not a fix for
// it. The fix keeps this a replace (no new mechanism) but requires the
// trailer's CONTENT to be the complete current answer -- ANCHOR 1's existing
// content plus whatever is new -- unless the person is clearly replacing
// rather than adding to an earlier answer.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

check(coach.includes('const VALUES_CAPTURE_NOTE ='),
  `${COACH}: VALUES_CAPTURE_NOTE is missing`)
check(coach.includes('VALUESCAPTURE: {"values":"Independence; Creative problem solving; Belonging"'),
  `${COACH}: VALUES_CAPTURE_NOTE's trailer contract is missing or has drifted`)
check(coach.includes('what you write must be the COMPLETE current list — everything already there plus whatever is new — never just today'),
  `${COACH}: VALUES_CAPTURE_NOTE no longer requires merging existing content with new content -- this is the exact data-loss bug the merge-not-overwrite fix closed`)
check(coach.includes('someone adding a third value after two months should end up with three, not one'),
  `${COACH}: VALUES_CAPTURE_NOTE lost the concrete example that makes the merge requirement unambiguous to the model`)
check(coach.includes('ONLY when they are clearly replacing an earlier answer rather than adding to it'),
  `${COACH}: VALUES_CAPTURE_NOTE does not distinguish "replacing" (drop the old answer) from "adding" (keep it) -- without this, a real correction could never drop a value that no longer fits`)
check(coach.includes('if it is unclear which they mean, merge rather than drop'),
  `${COACH}: VALUES_CAPTURE_NOTE does not default to the safe side (merge) when replace-vs-add is ambiguous`)

// The gating condition (only emit when the field is genuinely settling
// something) must still be intact -- the merge fix changes CONTENT, not
// whether the trailer fires at all.
check(coach.includes('not a list you proposed and they have not responded to'),
  `${COACH}: VALUES_CAPTURE_NOTE lost its guard against emitting for an unconfirmed suggestion`)
check(coach.includes('only on a turn that genuinely settled something'),
  `${COACH}: VALUES_CAPTURE_NOTE lost its guard against emitting on a turn that settled nothing`)

// Still unflagged, still spliced beside ASSESSMENT_CAPTURE_NOTE in both
// profile-slice templates -- the merge fix is a content correction, not a
// gating change, so this must be untouched.
check(coach.includes('${VALUES_CAPTURE_NOTE}${ASSESSMENT_CAPTURE_NOTE}'),
  `${COACH}: VALUES_CAPTURE_NOTE is not appended in the main profile-slice template beside ASSESSMENT_CAPTURE_NOTE`)
check(coach.includes('clicking to it.${VALUES_CAPTURE_NOTE}${ASSESSMENT_CAPTURE_NOTE}'),
  `${COACH}: VALUES_CAPTURE_NOTE is not appended in the no-profile-yet template as well`)

if (failures) {
  console.error(`test-coach-values-capture: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-values-capture: OK (merge-not-overwrite fix present with a concrete example, replace-vs-add distinction intact, defaults to merge when ambiguous, gating and template placement unchanged)')
}
