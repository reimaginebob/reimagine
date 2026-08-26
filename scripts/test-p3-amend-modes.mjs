// Evaluate the REAL amend block pulled verbatim out of src/App.jsx -- not a
// hand-retyped copy. #508 shipped a dead regex because it was tested as
// intended rather than as written.
import fs from 'fs'

const src = fs.readFileSync('src/App.jsx', 'utf8')
const START = '${previousBrand?`'
const END = "${previousBrand}`:''}"
const a = src.indexOf(START)
const b = src.indexOf(END, a) + END.length
if (a < 0 || b < END.length) throw new Error('amend block not found')
const block = src.slice(a, b)
if (!src.slice(0, a).includes("p3analysis:(pr,previousBrand='',changeMode='none',changedInputs='')")) {
  throw new Error('amend block is not inside the patched p3analysis')
}

const render = new Function('previousBrand', 'changeMode', 'changedInputs',
  'return `' + block + '`')

const PREV = '<<PRIOR BRAND>>'
const DELTA = 'Reputation — Additional Feedback\nPREVIOUSLY: old\nNOW: new'

const CASES = [
  ['feedback box has text', ['stated', ''], 'stated above',
    ['changed their own answers', 'rebuild WITHOUT changes']],
  ['inputs edited, delta known', ['inputs', DELTA], 'Here is exactly what moved',
    ['stated above', 'rebuild WITHOUT changes', 'is not recorded for this profile']],
  ['inputs edited, no snapshot', ['inputs', ''], 'is not recorded for this profile',
    ['stated above', 'rebuild WITHOUT changes', 'Here is exactly what moved']],
  ['empty box, nothing moved', ['none', ''], 'rebuild WITHOUT changes',
    ['changed their own answers', 'stated above']],
]

let fail = 0
for (const [what, [mode, delta], must, mustNot] of CASES) {
  const out = render(PREV, mode, delta)
  const bad = mustNot.filter(m => out.includes(m))
  const ok = out.includes(must) && !bad.length && out.includes(PREV)
    && out.includes('Treat this as an amendment')
  if (!ok) fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`)
  if (bad.length) console.log('        leaked another branch:', bad.join(' | '))
}

// The delta must reach the model verbatim, not be paraphrased away.
const withDelta = render(PREV, 'inputs', DELTA)
const carries = withDelta.includes(DELTA)
console.log(`${carries ? 'PASS' : 'FAIL'}  the delta itself is in the prompt`)
if (!carries) fail++

// A first build has no previous brand, so it carries no amend block at all.
const clean = render('', 'inputs', DELTA) === ''
console.log(`${clean ? 'PASS' : 'FAIL'}  first build carries no amend block at all`)
if (!clean) fail++

// --- the diff that decides what the model is told ------------------------
const hs = src.indexOf('const P3_INPUT_FIELDS=[')
const he = src.indexOf('const INPUT_EDIT_STEPS=new Set(', hs)
if (hs < 0 || he < 0) throw new Error('input-diff helpers not found')
const H = new Function(src.slice(hs, he) +
  ';return{snapshotP3Inputs,describeP3InputChanges,P3_INPUT_FIELDS,P3_INPUT_BULK}')()

const base = {
  values: 'v', passions: 'p', lifeEvents: 'l', skills: 's', assess: 'a',
  assessType: 't', resumeDelta: '', resume: 'RESUME TEXT', linkedin: 'LI',
  priorities: { comp: '80k', dealBreakers: 'none' },
  rep: { memory: 'm', emergency: 'e', twoWords: 'tw', other: 'praise' },
}
const snap = H.snapshotP3Inputs(base)
const check = (name, cond) => { if (!cond) fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`) }

check('unchanged answers produce no delta', H.describeP3InputChanges(base, snap) === '')

const edited = { ...base, rep: { ...base.rep, other: 'praise + NEW LINE' } }
const d = H.describeP3InputChanges(edited, snap)
check('an edited answer is named with before and after',
  d.includes('Additional Feedback') && d.includes('PREVIOUSLY: praise') && d.includes('NOW: praise + NEW LINE'))
check('only the edited answer is named', d.split('PREVIOUSLY:').length === 2)

// Priorities feeds compensation work downstream, not the brand. Naming it
// would tell the model something changed that cannot affect the read -- the
// August 2026 PTO confusion in reverse.
const pri = { ...base, priorities: { comp: '120k', dealBreakers: 'six weeks PTO' } }
check('priorities is not reported as a change to the brand',
  H.describeP3InputChanges(pri, snap) === '')

// A replaced resume is named, never printed twice into the prompt.
const res = { ...base, resume: 'A COMPLETELY DIFFERENT RESUME' }
const rd = H.describeP3InputChanges(res, snap)
check('a replaced resume is named, not dumped',
  rd.includes('Your Resume') && rd.includes('replaced this document') && !rd.includes('RESUME TEXT'))

check('no snapshot yields no delta, so the caller can fall back',
  H.describeP3InputChanges(edited, undefined) === '' && H.describeP3InputChanges(edited, null) === '')

// An older profile snapshotted before a field was tracked must not read as an
// edit the person never made.
const partial = { ...snap }
delete partial['rep.other']
check('a field missing from an older snapshot is not reported as changed',
  H.describeP3InputChanges(base, partial) === '')

const long = { ...base, values: 'x'.repeat(5000) }
const ld = H.describeP3InputChanges(long, snap)
check('a very long answer is truncated', ld.includes('[truncated]') && ld.length < 4000)

const blanked = { ...base, lifeEvents: '' }
check('clearing an answer is reported as a change',
  H.describeP3InputChanges(blanked, snap).includes('NOW: (blank)'))

console.log(fail ? `\n${fail} FAILURE(S)` : '\nall cases correct')
process.exit(fail ? 1 : 0)
