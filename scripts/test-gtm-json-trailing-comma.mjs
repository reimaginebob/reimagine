// A Go-to-Market build on 2026-09-17 reached the user as raw JSON on screen.
// The research itself was complete -- ten companies, contacts, an outreach
// email -- but the model closed the object with a comma still hanging after
// the last value ("part_4_linkedin_tweak": "..." then , then }). JSON.parse
// rejects the whole document over that one character, parseGtmJSON returned
// null, and the p7 branch fell through to the legacy prose render, which
// printed the unparsed JSON. Removing that single comma parsed all four parts
// and all ten companies.
//
// The fix is parseJsonTolerant (src/App.jsx): parse as-is FIRST, so nothing
// well-formed is ever rewritten, and only re-try with trailing commas stripped
// after parse has already failed -- a state whose existing behavior is a total
// loss, so a lenient second pass cannot make it worse. It sits in the same
// repair layer as repairMangledJsonKeys and covers the three key-drift parsers
// that layer already serves: p7 (Go-to-Market), p8 (LinkedIn Remix), p11
// (Interview Prep).
//
// App.jsx is JSX and unimportable by plain Node, so this re-derives the helper
// from the same source text and then source-presence-checks the wiring.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// --- Pure re-derivation of the helper -------------------------------------

const stripTrailingCommas = str => str.replace(/,(\s*[}\]])/g, '$1')
function parseJsonTolerant(str) {
  try { return JSON.parse(str) } catch {}
  try { return JSON.parse(stripTrailingCommas(str)) } catch { return null }
}

// The live shape: trailing comma before the final closing brace.
const LIVE = '{\n"quick_takeaway": "Ten companies sit in the flavor ecosystem.",\n"part_1_hiring_executive": "A CEO or President of a specialty ingredient company.",\n"part_2_company_list": [ { "name": "FlavorSum", "what": "Flavor house" } ],\n"part_3_outreach_template": "Hello -- I read about the acquisition.",\n"part_4_linkedin_tweak": "Commercial Strategy | Flavor and Ingredient Growth",\n\n}'
const live = parseJsonTolerant(LIVE)
check(!!live, 'parseJsonTolerant did not recover the live 2026-09-17 record (trailing comma before the closing brace)')
check(live && live.part_2_company_list.length === 1, 'the recovered record lost its company list')
check(live && live.part_4_linkedin_tweak.startsWith('Commercial Strategy'), 'the recovered record lost the value that preceded the stray comma')

// Trailing comma inside an array, the other place the model drops one.
check(!!parseJsonTolerant('{"a":[1,2,],"b":"x"}'), 'parseJsonTolerant did not recover a trailing comma inside an array')

// Well-formed JSON must come back untouched, and must not go through the strip
// at all -- a string value that happens to contain ", }" is only safe because
// the first attempt already succeeded.
const SAFE = JSON.stringify({ part_3_outreach_template: 'We grew revenue, } and margin, ] both years.' })
const safe = parseJsonTolerant(SAFE)
check(safe && safe.part_3_outreach_template === 'We grew revenue, } and margin, ] both years.',
  'parseJsonTolerant altered a well-formed record whose string value contains comma-then-brace text')

// Genuinely broken input still fails closed, so the friendly fallbacks stay reachable.
check(parseJsonTolerant('{"header": {"name": "Dana", "city":') === null, 'parseJsonTolerant did not return null for truncated JSON')
check(parseJsonTolerant('not json at all') === null, 'parseJsonTolerant did not return null for prose')

// --- Source-presence: the helper exists and the three parsers use it ------

check(app.includes('function stripTrailingCommas(str){return str.replace(/,(\\s*[}\\]])/g,\'$1\')}'),
  `${APP}: stripTrailingCommas is missing or has drifted`)
check(app.includes('function parseJsonTolerant(str){'),
  `${APP}: parseJsonTolerant is missing`)
check(/try\{return JSON\.parse\(str\)\}catch\{\}/.test(app),
  `${APP}: parseJsonTolerant no longer tries the text as-is first -- well-formed JSON must never reach the strip`)

for (const [fn, keys] of [['parseGtmJSON', 'GTM_JSON_KEYS'], ['parseLinkedInRemixJSON', 'P8_JSON_KEYS'], ['parseInterviewPrepJSON', 'P11_JSON_KEYS'], ['parseP11QuestionJSON', 'P11_JSON_KEYS']]) {
  const start = app.indexOf(`function ${fn}(`)
  check(start !== -1, `${APP}: ${fn} is missing or has been renamed`)
  if (start === -1) continue
  const body = app.slice(start, start + 1200)
  check(/parseJsonTolerant\(\s*(candidate|repairMangledJsonKeys\()/.test(body) && body.includes(keys),
    `${APP}: ${fn} does not parse through parseJsonTolerant -- a stray trailing comma would still dump raw JSON at the user`)
}

if (failures) { console.error(`test-gtm-json-trailing-comma: ${failures} failure(s)`); process.exit(1) }
console.log('test-gtm-json-trailing-comma: all checks passed')
