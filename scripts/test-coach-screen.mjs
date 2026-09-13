// Guards the screen name My Coach is told each turn (2026-09-13). Coach used
// to get only the raw step id ("[The user is currently on step "p4".]") and,
// asked "where am I?", told a user it could see a step "tagged p4" and could
// not say which screen that was. describeScreen (src/coach-screen.js) renders
// the user-facing name instead; this test pins that it always does, that the
// three p4 screens and two op screens are told apart, and that the api-side
// copy of the ecosystem category labels cannot drift from the .mjs source.
import fs from 'node:fs'
import { describeScreen, ECOSYSTEM_CATEGORY_LABELS } from '../src/coach-screen.js'
import { NAV_LABELS, LANE_LABELS } from '../src/nav-labels.js'
import { ECOSYSTEM_CATEGORIES } from '../src/industry-ecosystem.mjs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// --- drift guard: api-importable labels match src/industry-ecosystem.mjs ---
const mjsLabels = Object.fromEntries(ECOSYSTEM_CATEGORIES.map(c => [c.key, c.label]))
check(JSON.stringify(Object.keys(ECOSYSTEM_CATEGORY_LABELS).sort()) === JSON.stringify(Object.keys(mjsLabels).sort()),
  'ECOSYSTEM_CATEGORY_LABELS keys drifted from ECOSYSTEM_CATEGORIES')
for (const [k, label] of Object.entries(mjsLabels)) {
  check(ECOSYSTEM_CATEGORY_LABELS[k] === label, `ECOSYSTEM_CATEGORY_LABELS.${k} is "${ECOSYSTEM_CATEGORY_LABELS[k]}", ECOSYSTEM_CATEGORIES says "${label}"`)
}

// --- p4: the lane's role list ---
for (const lane of ['familiar', 'wtm']) {
  const s = describeScreen({ step: 'p4', lane, ecosystemView: true })
  check(s.includes(LANE_LABELS[lane]), `p4/${lane}: missing lane label "${LANE_LABELS[lane]}" in: ${s}`)
  check(s.includes('Role Options'), `p4/${lane}: missing "Role Options" in: ${s}`)
  check(!/\bp4\b/.test(s), `p4/${lane}: leaked the raw step id: ${s}`)
}

// --- p4: Industry Insider with the ecosystem flag off is the plain role list ---
{
  const s = describeScreen({ step: 'p4', lane: 'insider', ecosystemView: false, ecosystemCategory: 'suppliers' })
  check(s.includes('the role options for that direction') && s.includes('Industry Insider'), `p4/insider flag off: expected the role-options wording, got: ${s}`)
  check(!s.includes('industry map') && !s.includes('Suppliers'), `p4/insider flag off: leaked the pilot's industry map: ${s}`)
}

// --- p4: the industry map hub ---
{
  const s = describeScreen({ step: 'p4', lane: 'insider', ecosystemView: true })
  check(s.includes('industry map') && s.includes('Industry Insider'), `p4 hub: expected industry map wording, got: ${s}`)
  check(!/\bp4\b/.test(s), `p4 hub: leaked the raw step id: ${s}`)
}

// --- p4: a category opened from the map ---
{
  const s = describeScreen({ step: 'p4', lane: 'insider', ecosystemView: true, ecosystemCategory: 'suppliers' })
  check(s.includes('Suppliers'), `p4 category: missing "Suppliers" in: ${s}`)
  check(!s.includes('industry map'), `p4 category: should name the category, not the hub: ${s}`)
}

// --- p4: unknown category key falls back to the hub wording ---
{
  const s = describeScreen({ step: 'p4', lane: 'insider', ecosystemView: true, ecosystemCategory: 'zzz' })
  check(s.includes('industry map') && !s.includes('zzz'), `p4 unknown category: expected hub fallback, got: ${s}`)
}

// --- p4 with no lane still names the screen ---
{
  const s = describeScreen({ step: 'p4' })
  check(s.includes('Role Options') && !/\bp4\b/.test(s), `p4 no lane: got: ${s}`)
}

// --- op: the empty form vs an open Opportunity Playbook, both tracks ---
{
  const empty = describeScreen({ step: 'op', hasRecord: false })
  const open = describeScreen({ step: 'op', hasRecord: true })
  check(empty.includes('Add an Opportunity') && !empty.includes('Your Opportunity Playbook'), `op empty: got: ${empty}`)
  check(open.includes('Your Opportunity Playbook'), `op with record: should name the playbook, got: ${open}`)
  const indEmpty = describeScreen({ step: 'op', hasRecord: false, independent: true })
  const indOpen = describeScreen({ step: 'op', hasRecord: true, independent: true })
  check(indEmpty.includes('Add a Client Opportunity'), `op independent empty: got: ${indEmpty}`)
  check(indOpen.includes('This Client Opportunity'), `op independent open: got: ${indOpen}`)
  for (const s of [empty, open, indEmpty, indOpen]) check(!/\bop\b/.test(s), `op: leaked the raw step id: ${s}`)
}

// --- every NAV_LABELS step gets a name, never its own quoted id ---
for (const key of Object.keys(NAV_LABELS)) {
  const s = describeScreen({ step: key })
  check(typeof s === 'string' && s.length > 0, `NAV_LABELS.${key}: empty screen name`)
  check(!s.includes(`"${key}"`), `NAV_LABELS.${key}: quoted the raw id: ${s}`)
}

// --- unknown or missing step ---
check(describeScreen({ step: 'zzz' }) === '', 'unknown step should return empty string')
check(describeScreen({ step: '' }) === '', 'empty step should return empty string')

// --- api/coach.js wiring ---
const coach = fs.readFileSync('api/coach.js', 'utf8')
check(!coach.includes('currently on step "${currentStep}"'), 'api/coach.js still sends the raw step id in contextNote')
check(coach.includes('SCREEN IN VIEW:'), 'api/coach.js contextNote no longer carries SCREEN IN VIEW')
check(coach.includes("from '../src/coach-screen.js'"), 'api/coach.js no longer imports src/coach-screen.js')
check(!/from '\.\.\/src\/[^']*\.mjs'/.test(coach), 'api/coach.js imports a .mjs across the api/src boundary')

if (failures) {
  console.error(`test-coach-screen: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-screen: OK (Coach is told the screen name, never the raw step id; p4 role list / industry map / category and op form / playbook are told apart; ecosystem labels match the .mjs source)')
}
