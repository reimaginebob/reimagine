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
if (!src.slice(0, a).includes("p3analysis:(pr,previousBrand='',changeMode='none')")) {
  throw new Error('amend block is not inside the patched p3analysis')
}

const render = new Function('previousBrand', 'changeMode', 'return `' + block + '`')

const PREV = '<<PRIOR BRAND>>'
const CASES = [
  ['stated', 'feedback box has text', 'stated above',
    ['changed one or more of their own answers', 'rebuild WITHOUT changes']],
  ['inputs', 'they edited their own answers', 'changed one or more of their own answers',
    ['stated above', 'rebuild WITHOUT changes']],
  ['none', 'empty box / stale-build refresh', 'rebuild WITHOUT changes',
    ['changed one or more of their own answers', 'stated above']],
]

let fail = 0
for (const [mode, what, must, mustNot] of CASES) {
  const out = render(PREV, mode)
  const bad = mustNot.filter(m => out.includes(m))
  const ok = out.includes(must) && !bad.length && out.includes(PREV)
    && out.includes('Treat this as an amendment')
  if (!ok) fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${mode.padEnd(7)} (${what})`)
  if (bad.length) console.log('        leaked other branch:', bad.join(' | '))
}

const first = render('', 'inputs')
const clean = first === ''
console.log(`${clean ? 'PASS' : 'FAIL'}  first build carries no amend block at all`)
if (!clean) fail++

console.log(fail ? `\n${fail} FAILURE(S)` : '\nall four cases correct')
process.exit(fail ? 1 : 0)
