// src/playbook-sections.js holds the section vocabulary the COACH speaks from.
// src/App.jsx holds the one the SCREEN renders from. They are separate files
// because App.jsx cannot be imported across the api/* boundary, which means
// they can drift -- and a Coach that says "build the Cover Letter" about a card
// the screen calls something else sends someone hunting for a thing that is not
// there. That is the exact failure NAV_LABELS was created to stop, so it gets a
// gate rather than a comment.
import fs from 'fs'
import { OP_COUNTED_SECTIONS, focusSections, focusExtraSections, describeSections, sectionState, recordIsIndependent } from '../src/playbook-sections.js'

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf-8')
let pass = 0, fail = 0
const t = (n, c) => { c ? pass++ : (fail++, console.log('  FAIL:', n)) }

// --- the counted opportunity keys, in order ---
const keysM = app.match(/const OP_COUNTED_KEYS\s*=\s*\[([^\]]*)\]/)
t('OP_COUNTED_KEYS found in App.jsx', !!keysM)
if (keysM) {
  const appKeys = keysM[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
  const ourKeys = OP_COUNTED_SECTIONS.map(s => s.key)
  t(`counted keys match in order (${appKeys.join(',')})`, JSON.stringify(appKeys) === JSON.stringify(ourKeys))
}

// --- the labels the card shows for them ---
const labM = app.match(/const OP_CARD_LABELS\s*=\s*\{([^}]*)\}/)
t('OP_CARD_LABELS found in App.jsx', !!labM)
if (labM) {
  const appLabels = {}
  for (const m of labM[1].matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*'([^']*)'/g)) appLabels[m[1]] = m[2]
  for (const s of OP_COUNTED_SECTIONS) {
    t(`opportunity label for ${s.key} matches the card ("${s.label}")`, appLabels[s.key] === s.label)
  }
}

// --- the focus set must match what the CARD COUNTS, not what the rail renders ---
// This is the check that was missing. The first version of this file compared
// against FOCUS_ORDER, which renders ten sections, while the card counts eight:
// Networking Groups and Recruiters are searches rather than built prose and are
// excluded, exactly as Interview Team is on an opportunity. Comparing against
// the rail let the coach report two sections unbuilt on a direction the screen
// calls complete. The counting source is SavedPlaybooks.jsx, so that is what
// this compares against.
const saved = fs.readFileSync(new URL('../src/components/SavedPlaybooks.jsx', import.meta.url), 'utf-8')
const keyList = (name) => {
  const m = saved.match(new RegExp(`const ${name}\\s*=\\s*\\[([^\\]]*)\\]`))
  return m ? m[1].split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean) : null
}
const roleKeys = keyList('ROLE_OUTPUT_KEYS')
const practiceKeys = keyList('PRACTICE_OUTPUT_KEYS')
t('ROLE_OUTPUT_KEYS found in SavedPlaybooks.jsx', !!roleKeys)
t('PRACTICE_OUTPUT_KEYS found in SavedPlaybooks.jsx', !!practiceKeys)
if (roleKeys) {
  t(`standard focus set matches what the card counts (${roleKeys.length})`,
    JSON.stringify([...roleKeys].sort()) === JSON.stringify(focusSections(false).map(s => s.key).sort()))
}
if (practiceKeys) {
  t(`practice focus set matches what the card counts (${practiceKeys.length})`,
    JSON.stringify([...practiceKeys].sort()) === JSON.stringify(focusSections(true).map(s => s.key).sort()))
}
t('groups and recruiters are NOT in the counted set', !focusSections(false).some(s => s.key === 'groups' || s.key === 'recruiters'))
t('but they are still named as available extras', focusExtraSections(false).map(s => s.key).join(',') === 'groups,recruiters')

// --- the independent track's renames ---
const indM = app.match(/const INDEPENDENT_SECTION_LABELS\s*=\s*\{([\s\S]*?)\}/)
t('INDEPENDENT_SECTION_LABELS found in App.jsx', !!indM)
if (indM) {
  const appInd = {}
  for (const m of indM[1].matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*'([^']*)'/g)) appInd[m[1]] = m[2]
  for (const s of focusSections(true)) {
    t(`independent label for ${s.key} matches ("${s.label}")`, appInd[s.key] === s.label)
  }
}

// --- every section carries a real name, never a raw key ---
for (const s of [...OP_COUNTED_SECTIONS, ...focusSections(false), ...focusSections(true)]) {
  t(`${s.key} has a user-facing label`, typeof s.label === 'string' && s.label.length > 0 && s.label !== s.key)
}


// --- reading a record: both storage shapes, both kinds ---
const opp = (over = {}) => ({ id: 'a', title: 'Imerys', source: 'door2', sections: {}, ...over })

t('an empty opportunity has nothing built', describeSections(opp()).built.length === 0)
t('and lists all six as not built', describeSections(opp()).todo.length === 6)

const partly = opp({ sections: { companyRead: { content: 'research' }, p11: { content: 'prep' } } })
t('built comes back by NAME, not key', JSON.stringify(describeSections(partly).built) === JSON.stringify(['About This Company', 'Interview Prep']))
t('and the rest are named too', describeSections(partly).todo.includes('Cover Letter'))
t('describeSections returns no count or total', !('count' in describeSections(partly)) && !('total' in describeSections(partly)))

t('a bare string section counts as built (older p6 records)', sectionState(opp({ sections: { p6: 'a bridge story' } }), 'p6').built === true)
t('an empty string does not count as built', sectionState(opp({ sections: { p6: '   ' } }), 'p6').built === false)
t('whitespace-only content does not count as built', sectionState(opp({ sections: { p11: { content: '  \n ' } } }), 'p11').built === false)
t('builtAt is read when present', sectionState(opp({ sections: { p11: { content: 'x', builtAt: '2026-08-30' } } }), 'p11').builtAt === '2026-08-30')
t('builtAt is null when absent', sectionState(opp({ sections: { p11: { content: 'x' } } }), 'p11').builtAt === null)

// The offer pair is not "missing" on an opportunity with no offer -- it was
// never due, and reporting it as unbuilt invents a gap.
t('offer sections stay out until there is an offer', !describeSections(opp()).todo.includes('Compensation Read'))
t('offer sections appear once an offer is on the table', describeSections(opp(), { hasOffer: true }).todo.includes('Compensation Read'))
t('a built offer section appears without the flag', describeSections(opp({ sections: { salaryRead: { content: 'range' } } })).built.includes('Compensation Read'))

// Focus records store on `outputs`, not `sections`.
const focus = (over = {}) => ({ id: 'f', title: 'VP Operations', source: 'door1', outputs: {}, ...over })
t('a focus record reads from outputs', describeSections(focus({ outputs: { p6: 'story' } })).built.includes('Your Bridge Story'))
t('a focus record lists the counted eight', describeSections(focus()).todo.length === 8)
t('the independent track lists its own six', describeSections(focus(), { independent: true }).todo.length === 6)
t('and uses its own names', describeSections(focus(), { independent: true }).todo.includes('Your One-Sheet'))
t('a record with no source is treated as a focus playbook', describeSections({ id: 'x', outputs: {} }).todo.length === 8)

// Safety: junk must never throw, because this runs inside a live coach turn.
t('survives null', describeSections(null).todo.length === 8)
t('survives a record with no bags', describeSections({ source: 'door2' }).built.length === 0)
t('survives a non-object section', sectionState(opp({ sections: { p11: 42 } }), 'p11').built === false)


// --- the Bridge Story's own shape (Vercel review, PR #676) ---
// Pre-2026-05-31 records store p6 as { bridge_story, ... } with NO `content`.
// The screen decodes it and shows it built. Reading only `content` reported a
// finished Bridge Story as missing, which would have the coach offer to build
// what is already there -- the failure this whole file exists to stop.
const legacyBridge = { bridge_story: { slot1_human_anchor: { options: [{ id: 'a', text: 'anchor' }] } }, user_picks: {} }
t('legacy p6 object counts as built on an opportunity', sectionState(opp({ sections: { p6: legacyBridge } }), 'p6').built === true)
t('legacy p6 object counts as built on a direction', sectionState(focus({ outputs: { p6: legacyBridge } }), 'p6').built === true)
t('and it is reported by name, not as missing', describeSections(opp({ sections: { p6: legacyBridge } })).built.includes('Bridge Story'))
t('a freeform-only bridge story counts as built', sectionState(opp({ sections: { p6: { user_freeform: 'what I say out loud' } } }), 'p6').built === true)
t('an empty object does NOT count as built', sectionState(opp({ sections: { p6: {} } }), 'p6').built === false)
t('content still wins when present', sectionState(opp({ sections: { p6: { content: 'prose' } } }), 'p6').built === true)

// --- the track a record was actually built with (Vercel review, PR #676) ---
// users.track is mutable (api/admin/track-access.js), so an account moved onto
// Go Independent still holds directions built with the standard ten. Reporting
// those under the independent labels renames their own work at them.
const standardRec = focus({ outputs: { p9: 'the lingo', p_res: 'resume' } })
t('a record holding a standard-only section is read as standard', recordIsIndependent(standardRec, true) === false)
// The record's own lane is authoritative and beats the session either way --
// which is what SavedPlaybooks.jsx has always done to count its sections.
t('lane independent wins over a standard session', recordIsIndependent(focus({ lane: 'independent' }), false) === true)
t('lane familiar wins over an independent session', recordIsIndependent(focus({ lane: 'familiar' }), true) === false)
t('lane specific is not independent', recordIsIndependent(focus({ lane: 'specific' }), true) === false)
t('a laned record uses its own labels', describeSections(focus({ lane: 'independent', outputs: { p_res: 'x' } }), { independent: false }).built.includes('Your One-Sheet'))
t('and a standard-laned record keeps standard labels in an independent session', describeSections(focus({ lane: 'insider', outputs: { p_res: 'x' } }), { independent: true }).built.includes('Resume Refresh'))
t('a laneless legacy record still falls back to the session', recordIsIndependent(focus({ outputs: { income: 'x' } }), true) === true)
t('so its sections keep the names it was built with', describeSections(standardRec, { independent: true }).built.includes('Resume Refresh'))
t('and it is not renamed to the independent label', !describeSections(standardRec, { independent: true }).built.includes('Your One-Sheet'))
const practiceRec = focus({ outputs: { p_res: 'one sheet', income: 'pricing' } })
t('a record with no standard-only section follows the session track', recordIsIndependent(practiceRec, true) === true)
t('and uses the independent label', describeSections(practiceRec, { independent: true }).built.includes('Your One-Sheet'))
t('a standard session is never reinterpreted as independent', recordIsIndependent(practiceRec, false) === false)
t('a standard session keeps standard labels', describeSections(practiceRec, { independent: false }).built.includes('Resume Refresh'))

console.log(`test-playbook-sections: ${fail ? 'FAILED' : 'OK'} (${pass} cases passed${fail ? `, ${fail} FAILED` : ''})`)
process.exit(fail ? 1 : 0)
