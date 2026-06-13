import { extractCorrectionTerms, countTermInText, detectCorrectionConflict } from '../src/corrections.js'

let pass = 0, fail = 0
const has = (arr, t, msg) => {
  const ok = arr.map(x => x.toLowerCase()).includes(t.toLowerCase())
  if (ok) pass++; else { fail++; console.log('FAIL', msg, '— got', JSON.stringify(arr), 'want includes', t) }
}
const eq = (a, b, msg) => {
  const ok = JSON.stringify(a) === JSON.stringify(b)
  if (ok) pass++; else { fail++; console.log('FAIL', msg, '— got', JSON.stringify(a), 'want', JSON.stringify(b)) }
}

// extractCorrectionTerms
has(extractCorrectionTerms('I am not an architect. Please describe me as a builder instead.'), 'architect', 'hard negation: not X')
has(extractCorrectionTerms("stop using 'architect'"), 'architect', 'stop using + quoted')
has(extractCorrectionTerms('never say rigorous in any output'), 'rigorous', 'never X')
has(extractCorrectionTerms('replace architect with builder'), 'architect', 'replace X with Y')
has(extractCorrectionTerms('describe me as a builder instead of an architect'), 'architect', 'instead of X')
has(extractCorrectionTerms("don't use the word leverage"), 'leverage', "don't use the word X")
eq(extractCorrectionTerms('Lead with my sustainability work instead.'), [], 'no forbidden term (style-only) -> empty')
eq(extractCorrectionTerms(''), [], 'empty input -> empty')
// quoted phrase ignored when not forbidding
eq(extractCorrectionTerms('I really liked "the opening line".'), [], 'quoted but not forbidding -> empty')

// countTermInText: boundary-aware, case-insensitive, excludes substrings
eq(countTermInText("The architect's architectural plan. Architect again.", 'architect'), 2, 'counts architect + Architect, not architectural')
eq(countTermInText('nothing relevant here', 'architect'), 0, 'no match -> 0')
eq(countTermInText('leverage and Leverage and LEVERAGE', 'leverage'), 3, 'case-insensitive count')
eq(countTermInText('rooted in the work, rooted in values', 'rooted in'), 2, 'multiword term count')

// detectCorrectionConflict
const conflict = (t) => detectCorrectionConflict(t)
const isConflict = (t, phrase, msg) => {
  const c = conflict(t)
  const ok = c && c.phrase.toLowerCase() === phrase.toLowerCase() && typeof c.reason === 'string' && typeof c.rephrase === 'string'
  if (ok) pass++; else { fail++; console.log('FAIL', msg, '— got', JSON.stringify(c), 'want phrase', phrase) }
}
const noConflict = (t, msg) => {
  const c = conflict(t)
  if (c === null) pass++; else { fail++; console.log('FAIL', msg, '— got', JSON.stringify(c), 'want null') }
}
// asks to USE a banned phrase -> conflict
isConflict('Please describe me as an architect', 'architect', 'typology: use architect')
isConflict('Make the opening more passionate', 'passionate', 'passion: more passionate')
isConflict('Say that I leverage data to drive results', 'leverage', 'ai-speak: leverage')
isConflict('I want it to say results-driven leader', 'results-driven', 'ai-speak: results-driven')
isConflict('Mention that I stand out from the crowd', 'stand out from the crowd', 'comparative')
// asks to AVOID a banned phrase -> NOT a conflict (the PR1 helping case)
noConflict("stop using 'architect'", 'forbidding: stop using architect')
noConflict('Never call me a builder', 'forbidding: never builder')
noConflict("don't use the word leverage", 'forbidding: dont use leverage')
noConflict('less passionate, more grounded', 'forbidding: less passionate')
// ordinary factual correction -> NOT a conflict
noConflict('I led a team of 12, not 4', 'factual correction')
noConflict('My time at Acme was internal strategy, not consulting', 'factual: not consulting')
noConflict('Lead with my supply chain work instead', 'style steer, no banned term')

console.log(`test-corrections: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
