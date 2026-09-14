// Guards the correction actions pilot (launch capture foundation, 2026-09-14,
// PR 4). Source-level. Three things must hold: the choice is flag-gated on both
// sides, it reaches corrections.action through the text-keyed hand-off, and it
// does NOT change routing yet (correctionsBlock must not read it).
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const app = fs.readFileSync('src/App.jsx', 'utf8')
const flags = fs.readFileSync('api/_lib/feature-flags.js', 'utf8')
const save = fs.readFileSync('api/profile/save.js', 'utf8')
const coach = fs.readFileSync('api/coach.js', 'utf8')

// Pure hand-off semantics, lifted from App.jsx and run for real.
const start = app.indexOf('const CORRECTION_ACTIONS=[')
const end = app.indexOf('const CorrectionActionsContext=')
check(start !== -1 && end > start, 'src/App.jsx: correction action hand-off block not found')
const mod = new Function(`${app.slice(start, end)}; return { notePendingCorrectionAction, takePendingCorrectionAction, CORRECTION_ACTION_CODES, CORRECTION_ACTION_TTL_MS, pendingCorrectionActions }`)()
check(JSON.stringify(mod.CORRECTION_ACTION_CODES) === JSON.stringify(['fact', 'add', 'wording', 'omit']), 'action codes drifted from fact/add/wording/omit (save.js and the migration comment name these)')
mod.notePendingCorrectionAction('  My title was Director  ', 'fact')
check(mod.takePendingCorrectionAction('My title was Director') === 'fact', 'a noted action is taken back by the same (trimmed) text')
check(mod.takePendingCorrectionAction('My title was Director') === null, 'a noted action is taken only once')
mod.notePendingCorrectionAction('salary box text', 'omit')
check(mod.takePendingCorrectionAction('a different correction') === null, 'a note never attaches to a correction with different text')
mod.notePendingCorrectionAction('x', 'not-a-code')
check(mod.takePendingCorrectionAction('x') === null, 'unknown action codes are never noted')
mod.pendingCorrectionActions.set('old', { action: 'add', at: Date.now() - mod.CORRECTION_ACTION_TTL_MS - 1000 })
check(mod.takePendingCorrectionAction('old') === null, 'an expired note is not used')

// Gating: RefineBox shows the choice only through the context; App provides the flag mirror.
check(app.includes('const actionsOn=useContext(CorrectionActionsContext)'), 'RefineBox must read the flag from CorrectionActionsContext')
check(app.includes('{actionsOn&&<div') && app.includes('if(!fresh&&actionsOn&&action)notePendingCorrectionAction(value,action)'), 'RefineBox must render and note the choice only when actionsOn')
check(app.includes('<CorrectionActionsContext.Provider value={hasCorrectionActions}>'), 'App must provide hasCorrectionActions to RefineBox')
check(/const hasCorrectionActions=!!signedInUser&&\(\(Array\.isArray\(signedInUser\.feature_flags\)&&signedInUser\.feature_flags\.includes\('correction_actions'\)\)\|\|/.test(app), 'client mirror must be the flag OR internal account, signed-in only')
check(flags.includes("export const CORRECTION_ACTIONS_FLAG = 'correction_actions'") && /return flags\.includes\(CORRECTION_ACTIONS_FLAG\) \|\| isInternalAccount\(user\)/.test(flags), 'server hasCorrectionActions must be the flag OR internal account')
check(/\[CORRECTION_ACTIONS_FLAG\]: \{ label:/.test(flags), 'correction_actions must be grantable from the dashboard')

// Capture path.
const recIdx = app.indexOf('const recordCorrection=(step,text,ctx={})=>{')
check(recIdx !== -1 && app.slice(recIdx, recIdx + 1500).includes('const action=takePendingCorrectionAction(text)'), 'recordCorrection must take the noted action by its text')
check(save.includes("CORRECTION_ACTION_CODES.includes(c.action) ? c.action : null"), 'save.js must persist only a known action code')

// Capture only: routing unchanged.
const cbIdx = app.indexOf('const correctionsBlock = (corrections) => {')
const cbEnd = app.indexOf('\n}\n', cbIdx)
check(cbIdx !== -1 && !app.slice(cbIdx, cbEnd).includes('action'), 'correctionsBlock must not route on the stored action yet (post-launch work)')

// Pilot docs partitioned.
check(coach.includes("hasCorrectionActions({ feature_flags: featureFlags, email: userEmail })) knowledgeParts.push(CORRECTION_ACTIONS_KNOWLEDGE)"), 'api/coach.js must inject the pilot knowledge only for flagged accounts')
const order = fs.readFileSync('src/data/user-guide/ORDER.json', 'utf8')
check(!order.includes('correction-actions'), 'pilot knowledge must stay out of ORDER.json')

if (failures) { console.error(`test-correction-actions: ${failures} check(s) failed`); process.exit(1) }
console.log('test-correction-actions: OK (hand-off keyed on text, once, expiring; gated both sides; capture only; pilot docs partitioned)')
