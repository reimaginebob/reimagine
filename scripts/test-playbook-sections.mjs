// src/playbook-sections.js holds the section vocabulary the COACH speaks from.
// src/App.jsx holds the one the SCREEN renders from. They are separate files
// because App.jsx cannot be imported across the api/* boundary, which means
// they can drift -- and a Coach that says "build the Cover Letter" about a card
// the screen calls something else sends someone hunting for a thing that is not
// there. That is the exact failure NAV_LABELS was created to stop, so it gets a
// gate rather than a comment.
import fs from 'fs'
import { OP_COUNTED_SECTIONS, focusSections, describeSections, sectionState, recordIsIndependent } from '../src/playbook-sections.js'

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

// --- the focus order, both tracks ---
const focusM = app.match(/const FOCUS_ORDER=\(isIndependent\?\[([\s\S]*?)\]:\[([\s\S]*?)\]\)/)
t('FOCUS_ORDER found in App.jsx', !!focusM)
if (focusM) {
  const ids = (chunk) => [...chunk.matchAll(/\{id:'([^']+)'/g)].map(m => m[1])
  t('focus order matches (standard)', JSON.stringify(ids(focusM[2])) === JSON.stringify(focusSections(false).map(s => s.key)))
  t('focus order matches (independent)', JSON.stringify(ids(focusM[1])) === JSON.stringify(focusSections(true).map(s => s.key)))
}

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
t('a focus record lists ten sections', describeSections(focus()).todo.length === 10)
t('the independent track lists its own six', describeSections(focus(), { independent: true }).todo.length === 6)
t('and uses its own names', describeSections(focus(), { independent: true }).todo.includes('Your One-Sheet'))
t('a record with no source is treated as a focus playbook', describeSections({ id: 'x', outputs: {} }).todo.length === 10)

// Safety: junk must never throw, because this runs inside a live coach turn.
t('survives null', describeSections(null).todo.length === 10)
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
t('so its sections keep the names it was built with', describeSections(standardRec, { independent: true }).built.includes('Resume Refresh'))
t('and it is not renamed to the independent label', !describeSections(standardRec, { independent: true }).built.includes('Your One-Sheet'))
const practiceRec = focus({ outputs: { p_res: 'one sheet', income: 'pricing' } })
t('a record with no standard-only section follows the session track', recordIsIndependent(practiceRec, true) === true)
t('and uses the independent label', describeSections(practiceRec, { independent: true }).built.includes('Your One-Sheet'))
t('a standard session is never reinterpreted as independent', recordIsIndependent(practiceRec, false) === false)
t('a standard session keeps standard labels', describeSections(practiceRec, { independent: false }).built.includes('Resume Refresh'))

console.log(`test-playbook-sections: ${fail ? 'FAILED' : 'OK'} (${pass} cases passed${fail ? `, ${fail} FAILED` : ''})`)
process.exit(fail ? 1 : 0)
