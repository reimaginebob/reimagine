// Guards correction-context capture (launch capture foundation, 2026-09-14).
// Source-level, like its siblings: every recordCorrection call site must pass
// the text the correction was aimed at, from the RIGHT place, and the text must
// never ride inside profile.corrections (the autosave blob has a size cap).
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// Every call (not the definition, not comments) passes a ctx with original.
const calls = [...app.matchAll(/recordCorrection\(([^)]*)\)/g)]
  .map(m => ({ args: m[1], at: m.index }))
  .filter(c => !app.slice(Math.max(0, c.at - 6), c.at).includes('const '))
  .filter(c => c.args.includes(',')) // prose mentions like recordCorrection() carry no args
check(calls.length >= 8, `${APP}: expected at least 8 recordCorrection call sites, found ${calls.length}`)
for (const c of calls) {
  const line = app.slice(app.lastIndexOf('\n', c.at) + 1, app.indexOf('\n', c.at))
  if (line.trim().startsWith('//')) continue
  check(/\{original:/.test(c.args) || /original:/.test(app.slice(c.at, c.at + 400)),
    `${APP}: a recordCorrection call does not pass {original:...}: ${line.trim().slice(0, 120)}`)
}

// Opportunity surfaces must not use outputs[step]: they share step ids with Focus.
const opCardIdx = app.indexOf('const refineOpCard=(cardKey,correctionText)=>{')
check(opCardIdx !== -1 && app.slice(opCardIdx, opCardIdx + 900).includes('currentSavedSlotIdRef.current') && app.slice(opCardIdx, opCardIdx + 900).includes('recordId:'),
  `${APP}: refineOpCard must snapshot the card from the open saved record (with recordId), not outputs[cardKey]`)
check(app.includes("recordCorrection('p6',v,{original:bridgeStoryToProse(_p6)"),
  `${APP}: the opportunity Bridge Story correction must snapshot that record's bridge story (_p6), not the Focus one`)

// The snapshot is posted, never stored on the correction object.
const defIdx = app.indexOf('const recordCorrection=(step,text,ctx={})=>{')
check(defIdx !== -1, `${APP}: recordCorrection no longer takes a ctx argument`)
const defBlock = app.slice(defIdx, defIdx + 3000)
check(defBlock.includes("'/api/correction-context'"), `${APP}: recordCorrection no longer posts to /api/correction-context`)
check(!/correction\.original\s*=/.test(defBlock) && !/correction\.originalInference\s*=/.test(defBlock),
  `${APP}: the section snapshot must never be added to the correction object (it would ride every autosave)`)

// Server: write-once, own rows only, and save.js fills the column on insert.
const api = fs.readFileSync('api/correction-context.js', 'utf8')
check(api.includes('ON CONFLICT (correction_id) DO NOTHING'), 'api/correction-context.js: context must be write-once')
check(/WHERE id = \$\{id\} AND user_id = \$\{user\.id\}::uuid AND original_inference IS NULL/.test(api),
  'api/correction-context.js: the corrections update must be limited to the caller\'s own row and an unfilled column')
const save = fs.readFileSync('api/profile/save.js', 'utf8')
check(save.includes('SELECT original_text FROM correction_context WHERE correction_id = ${c.id} AND user_id = ${req.user.id}'),
  'api/profile/save.js: the corrections insert must fill original_inference from correction_context')

if (failures) { console.error(`test-correction-context: ${failures} check(s) failed`); process.exit(1) }
console.log(`test-correction-context: OK (${calls.length} call sites pass the corrected text; opportunity surfaces read the saved record; snapshot posted, never in the blob; write-once server side)`)
