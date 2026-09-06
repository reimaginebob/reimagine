// Guards scripts/lib/split-focus-playbook.mjs against silent drift when
// src/data/user-guide/focus-playbook.md is edited. Two independent checks,
// because either alone misses a real failure mode:
//
// 1. Reconstruction: joining every unit back together in
//    FOCUS_PLAYBOOK_UNIT_ORDER must reproduce the source file byte for
//    byte. Catches the split losing or duplicating content.
// 2. Non-empty: every unit must carry real text. Catches a renamed or
//    removed heading -- the reconstruction check alone would still pass
//    (the misclassified content lands in the PREVIOUS unit instead of
//    vanishing), so a heading drifting out of sync with BOUNDARIES would
//    otherwise ship silently as an empty section for whatever currentStep
//    was counting on it.
import fs from 'node:fs'
import { splitFocusPlaybook, FOCUS_PLAYBOOK_UNIT_ORDER } from './lib/split-focus-playbook.mjs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const SOURCE = 'src/data/user-guide/focus-playbook.md'
const original = fs.readFileSync(SOURCE, 'utf8')
const units = splitFocusPlaybook(original)

check(Object.keys(units).length === FOCUS_PLAYBOOK_UNIT_ORDER.length,
  `splitFocusPlaybook returned ${Object.keys(units).length} units, expected ${FOCUS_PLAYBOOK_UNIT_ORDER.length}`)

const reconstructed = FOCUS_PLAYBOOK_UNIT_ORDER.map(k => units[k]).join('\n')
check(reconstructed === original,
  `${SOURCE}: reconstructing all units in FOCUS_PLAYBOOK_UNIT_ORDER does not reproduce the source file byte for byte -- the split lost or duplicated content`)

for (const key of FOCUS_PLAYBOOK_UNIT_ORDER) {
  check(typeof units[key] === 'string' && units[key].trim().length > 200,
    `${SOURCE}: unit "${key}" is empty or suspiciously short -- its boundary heading likely no longer matches the source file`)
}

// A few content spot-checks tying each unit to the step it's supposed to
// ground, so a heading rename that still LOOKS non-empty (absorbed the next
// unit's content instead) still gets caught.
const spotChecks = [
  ['preamble', 'What is on the page'],
  ['role', '1. The Role'],
  ['bridgeStory', 'Your Bridge Story'],
  ['industryBackground', '3. Industry Background'],
  ['compensationRead', '4. Compensation Read'],
  ['interviewPrep', '5. Interview Prep'],
  ['resumeRefresh', '6. Resume Refresh'],
  ['linkedinRemix', '7. LinkedIn Remix'],
  ['goToMarket', '8. Go-to-Market'],
  ['networkingGroups', 'Bonus · Networking Groups'],
  ['recruiters', 'Bonus · Recruiters for This Path'],
  ['incomeNow', 'Bonus · Income Now'],
  ['tail', 'Refining a section'],
]
for (const [key, needle] of spotChecks) {
  check(units[key].includes(needle), `unit "${key}" does not contain expected heading text "${needle}"`)
}
// And the inverse -- a unit should NOT carry content from its neighbors,
// which would indicate two units got merged.
check(!units.preamble.includes('1. The Role'), `unit "preamble" bled into "role"`)
check(!units.role.includes('Your Bridge Story'), `unit "role" bled into "bridgeStory"`)
check(!units.tail.includes('Bonus · Income Now'), `unit "tail" bled backward into "incomeNow"`)

if (failures) {
  console.error(`test-split-focus-playbook: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log(`test-split-focus-playbook: OK (${FOCUS_PLAYBOOK_UNIT_ORDER.length} units, byte-for-byte reconstruction, all units non-empty and correctly bounded)`)
}
