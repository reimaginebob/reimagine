// Cowork's item 2 (2026-09-08, same urgent lane as the p_res token-ceiling
// fix): the empty-output retry in api/claude.js only fired when a max_tokens
// stop returned zero text. Thinking can also eat most -- not all -- of a
// JSON-only step's ceiling, leaving a truncated fragment that is not empty
// but also does not parse. That case reached the caller unretried. This
// extends the same low-effort retry to also fire when the step is one of
// JSON_ONLY_STEPS (p_res/p11/p8 -- whole-response JSON, safe to scan whole)
// and the returned text does not parse as JSON.
//
// api/claude.js is a Vercel function, not a module built for import, so this
// re-derives extractText/looksLikeJson/hasText/brokenJson from the same
// source text and checks them against inline cases, then confirms the
// retry condition and event names are wired the way the fix specifies.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const FILE = 'api/claude.js'
const src = fs.readFileSync(FILE, 'utf8')

// --- Source-presence: the fix is actually in the file, in the shape described ---
check(src.includes("const JSON_ONLY_STEPS = new Set(['p_res', 'p11', 'p8'])"),
  `${FILE}: JSON_ONLY_STEPS is missing or has drifted from the documented p_res/p11/p8 set`)
check(src.includes('const extractText = (d) => (d && Array.isArray(d.content) ? d.content : []).filter(b => b && b.type === \'text\').map(b => String(b.text || \'\')).join(\'\')'),
  `${FILE}: extractText helper is missing or has drifted`)
check(src.includes('function looksLikeJson(text) {'),
  `${FILE}: looksLikeJson helper is missing`)
check(src.includes("const isJsonStep = JSON_ONLY_STEPS.has(typeof reqBody.step === 'string' ? reqBody.step.trim() : '')"),
  `${FILE}: isJsonStep derivation is missing or has drifted`)
check(src.includes('const brokenJson = isJsonStep && hasText(data) && !looksLikeJson(extractText(data))'),
  `${FILE}: brokenJson derivation is missing or has drifted`)
check(src.includes("if (data.stop_reason === 'max_tokens' && (!hasText(data) || brokenJson) &&"),
  `${FILE}: retry condition does not cover the brokenJson case`)
check(src.includes("evt: brokenJson ? 'claude_json_retry' : 'claude_empty_retry'"),
  `${FILE}: retry-start log does not branch event name on brokenJson`)
check(src.includes("evt: brokenJson ? 'claude_json_retry_result' : 'claude_empty_retry_result'"),
  `${FILE}: retry-result log does not branch event name on brokenJson`)
check(src.includes('recovered: brokenJson ? looksLikeJson(extractText(data)) : hasText(data)'),
  `${FILE}: retry-result "recovered" field does not re-check JSON validity for the brokenJson case`)

// --- Pure re-derivation of the two helpers, checked against inline cases ---
const hasText = (d) => Array.isArray(d && d.content) && d.content.some(b => b && b.type === 'text' && String(b.text || '').trim())
const extractText = (d) => (d && Array.isArray(d.content) ? d.content : []).filter(b => b && b.type === 'text').map(b => String(b.text || '')).join('')
function looksLikeJson(text) {
  const s = (text || '').trim()
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/)
  const body = fence ? fence[1].trim() : s
  const first = body.indexOf('{')
  const last = body.lastIndexOf('}')
  if (first === -1 || last === -1 || last < first) return false
  try { JSON.parse(body.slice(first, last + 1)); return true } catch { return false }
}
function brokenJsonFor(step, data, jsonSteps) {
  const isJsonStep = jsonSteps.has(step)
  return isJsonStep && hasText(data) && !looksLikeJson(extractText(data))
}

const JSON_ONLY_STEPS = new Set(['p_res', 'p11', 'p8'])

// Case: p_res, thinking ate almost everything, tiny truncated fragment left.
check(brokenJsonFor('p_res', { content: [{ type: 'text', text: '{"header":{"name":"Jan' }], stop_reason: 'max_tokens' }, JSON_ONLY_STEPS) === true,
  'a truncated non-JSON fragment on a JSON-only step should be flagged brokenJson')

// Case: p_res, full valid JSON came back -- must NOT be flagged.
check(brokenJsonFor('p_res', { content: [{ type: 'text', text: '{"header":{"name":"Jan"},"experience":[]}' }] }, JSON_ONLY_STEPS) === false,
  'valid JSON on a JSON-only step must not be flagged brokenJson')

// Case: p_res, JSON wrapped in a code fence -- must still parse and NOT flag.
check(brokenJsonFor('p_res', { content: [{ type: 'text', text: '```json\n{"header":{"name":"Jan"}}\n```' }] }, JSON_ONLY_STEPS) === false,
  'fenced valid JSON on a JSON-only step must not be flagged brokenJson')

// Case: p3 (prose + JSON tail step) -- explicitly excluded from JSON_ONLY_STEPS,
// so a stray-brace-only fragment must NOT trigger this retry path, matching
// personal-brand-tail.mjs's own documented warning that a whole-response scan
// is unsafe there.
check(brokenJsonFor('p3', { content: [{ type: 'text', text: 'Some prose with a { stray brace' }] }, JSON_ONLY_STEPS) === false,
  'p3 must stay excluded from the JSON-only brokenJson check (prose-with-JSON-tail, unsafe to whole-scan)')

// Case: empty content -- this is the pre-existing !hasText(data) path, not
// brokenJson (hasText(data) is false, so brokenJson short-circuits to false).
check(brokenJsonFor('p_res', { content: [] }, JSON_ONLY_STEPS) === false,
  'empty content should fall through to the pre-existing empty-retry path, not brokenJson')

if (failures) {
  console.error(`test-claude-json-retry: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-claude-json-retry: OK (JSON-only steps now retry at low effort on a truncated-but-nonempty response, not just a fully empty one)')
}
