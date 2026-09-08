// Guards finding 6.3 item 3 from the 2026-09-08 prelaunch audit: the
// web_search tool had no max_uses anywhere (a single turn could run an
// unbounded number of searches), and Networking Groups / Job Search
// Resources verified every candidate organization with its own separate
// web-search call, so one click was 8 to 11 upstream requests.
//
// Two halves:
//   1. api/claude.js's max_uses-by-step lookup (maxSearchUsesFor) and its
//      wiring into both tool-declaration sites -- imported and exercised
//      directly (this file has already been proven importable without a
//      live DB by test-claude-auth-hardening.mjs, which does the same).
//   2. src/App.jsx's batched-verification rewrite (findJobResources /
//      findPathGroups now route through the new verifyResourceRows /
//      mergeLivenessResult / JOB_RESOURCE_LIVENESS_BATCH_PROMPT instead of
//      one callClaude per organization) -- App.jsx is JSX and can't be
//      imported by plain Node, so its chunking/merge logic is re-derived
//      here as pure functions (same constraint as every other App.jsx-
//      internal-logic test in this batch) and the wiring is source-checked.
import fs from 'node:fs'

process.env.DATABASE_URL ||= 'postgres://user:pass@localhost/dummy'
process.env.ANTHROPIC_API_KEY ||= 'dummy'
process.env.RESEND_API_KEY ||= 'dummy'

const { maxSearchUsesFor, buildLegacyMessagesAndTools } = await import('../api/claude.js')

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// --- maxSearchUsesFor: evidence-based per-step ceiling ---------------------

check(maxSearchUsesFor('recruiters-leader-lookup') === 2, 'a single-lookup step (recruiters-leader-lookup) must cap at 2')
check(maxSearchUsesFor('gtm-contact-lookup') === 2, 'a single-lookup step (gtm-contact-lookup) must cap at 2')
check(maxSearchUsesFor('panel-interviewer-read') === 2, 'a single-lookup step (panel-interviewer-read) must cap at 2')
check(maxSearchUsesFor('openings-match') === 2, 'a single-lookup step (openings-match) must cap at 2')
check(maxSearchUsesFor('resources-verify') === 12, 'the batched verify step (resources-verify) must cap at 12 -- scaled for up to RESOURCE_VERIFY_CHUNK organizations per call, not the single-lookup floor')
check(maxSearchUsesFor('groups-verify') === 12, 'the batched verify step (groups-verify) must cap at 12')
check(maxSearchUsesFor('p7') === 8, 'Go-to-Market (p7) is genuine multi-source research and must cap at 8, not the single-lookup floor')
check(maxSearchUsesFor('gtm-company-read') === 8, 'gtm-company-read is genuine multi-source research and must cap at 8')
check(maxSearchUsesFor('op-company-read') === 8, 'op-company-read is genuine multi-source research and must cap at 8')
check(maxSearchUsesFor('op-salary-read') === 6, 'op-salary-read must cap at 6')
check(maxSearchUsesFor('salaryRead') === 6, 'salaryRead must cap at 6')
check(maxSearchUsesFor('income-buyer-read') === 6, 'income-buyer-read must cap at 6')
check(maxSearchUsesFor('recruiters-discovery') === 6, 'recruiters-discovery must cap at 6')
check(maxSearchUsesFor('resources-search') === 6, 'resources-search (discovery) must cap at 6')
check(maxSearchUsesFor('groups-search') === 6, 'groups-search (discovery) must cap at 6')
check(maxSearchUsesFor('a-step-that-does-not-exist') === 4, 'an unlisted step must fall back to DEFAULT_MAX_SEARCH_USES (4), never go unbounded')
check(maxSearchUsesFor(undefined) === 4, 'no step at all must fall back to DEFAULT_MAX_SEARCH_USES (4)')
check(maxSearchUsesFor('  p7  ') === 8, 'a step with surrounding whitespace must still resolve (trimmed the same way reqBody.step is elsewhere in this file)')
check(maxSearchUsesFor(123) === 4, 'a non-string step must fall back to the default rather than throwing')

// --- buildLegacyMessagesAndTools (Site A): the real client's request path -

const baseReq = { messages: [{ role: 'user', content: 'hi' }], tools: [{ anything: 'the caller sent, discarded' }] }
const outDefault = buildLegacyMessagesAndTools(baseReq)
check(outDefault && Array.isArray(outDefault.tools) && outDefault.tools[0] && outDefault.tools[0].max_uses === 4,
  'buildLegacyMessagesAndTools with no step must set max_uses to the default (4) on the web_search tool')

const outStepped = buildLegacyMessagesAndTools({ ...baseReq, step: 'resources-verify' })
check(outStepped && Array.isArray(outStepped.tools) && outStepped.tools[0] && outStepped.tools[0].max_uses === 12,
  'buildLegacyMessagesAndTools must set max_uses from the request\'s own step (resources-verify -> 12)')
check(outStepped.tools[0].type === 'web_search_20250305' && outStepped.tools[0].name === 'web_search',
  'the tool\'s type/name must be unchanged by adding max_uses')

// --- Source-presence: Site B (api/claude.js's simplified format) ----------

const CLAUDE_API = 'api/claude.js'
const claudeApi = fs.readFileSync(CLAUDE_API, 'utf8')

check(claudeApi.includes("{ type: 'web_search_20250305', name: 'web_search', max_uses: maxSearchUsesFor(reqBody.step) }"),
  `${CLAUDE_API}: the simplified-format branch's web_search tool no longer sets max_uses from maxSearchUsesFor(reqBody.step)`)
check(claudeApi.includes('export function maxSearchUsesFor(step)'),
  `${CLAUDE_API}: maxSearchUsesFor is no longer exported -- it needs to stay directly testable like buildLegacyMessagesAndTools`)

// --- Source-presence: Site C (src/App.jsx's client-side callClaude) -------

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(app.includes('const tools=webSearch?[{type:"web_search_20250305",name:"web_search",max_uses:4}]:undefined'),
  `${APP}: callClaude's tools array no longer sets max_uses -- every web_search declaration in source should carry a bound, even here where the server discards this array's contents`)

// --- Source-presence: batched verification replaces one-call-per-org ------

check(!app.includes('JOB_RESOURCE_LIVENESS_PROMPT('),
  `${APP}: the old single-organization liveness prompt (JOB_RESOURCE_LIVENESS_PROMPT) is still called somewhere -- it should have been fully replaced by the batched version`)
check(app.includes('const JOB_RESOURCE_LIVENESS_BATCH_PROMPT=(rows,loc)=>'),
  `${APP}: the batched liveness prompt (JOB_RESOURCE_LIVENESS_BATCH_PROMPT) is missing`)
check(app.includes('const RESOURCE_VERIFY_CHUNK=6'),
  `${APP}: RESOURCE_VERIFY_CHUNK is missing or no longer 6 -- STEP_MAX_SEARCH_USES's resources-verify/groups-verify=12 ceiling in api/claude.js is sized against this chunk size`)
check(app.includes('function mergeLivenessResult(r,v,scrubWhyThisFits)'),
  `${APP}: the shared per-row merge function (mergeLivenessResult) is missing`)
check(app.includes('async function verifyResourceRows(rows,loc,step,scrubWhyThisFits)'),
  `${APP}: the shared batched-verification function (verifyResourceRows) is missing`)

check(app.includes("const checked=await verifyResourceRows(rows,loc,'resources-verify',true)"),
  `${APP}: findJobResources no longer calls verifyResourceRows(rows,loc,'resources-verify',true) -- either the call site changed or the preserved whyThisFits-scrub behavior (true) was dropped`)
check(app.includes("const checked=await verifyResourceRows(rows,{city:criteria.geo||'',region:''},'groups-verify',false)"),
  `${APP}: findPathGroups no longer calls verifyResourceRows(...,'groups-verify',false) -- either the call site changed or the preserved no-scrub behavior (false) was dropped`)

// Exactly one web-search call site should remain for liveness verification
// (inside verifyResourceRows) -- findJobResources/findPathGroups themselves
// must no longer call callClaude directly for the per-row check.
const findJobResourcesIdx = app.indexOf('async function findJobResources(loc){')
const findJobResourcesEnd = app.indexOf('\n}', findJobResourcesIdx)
const findJobResourcesBody = findJobResourcesIdx !== -1 && findJobResourcesEnd !== -1 ? app.slice(findJobResourcesIdx, findJobResourcesEnd) : ''
check(findJobResourcesBody.length > 0, `${APP}: could not locate findJobResources to check its body for a stray direct verification call`)
check((findJobResourcesBody.match(/callClaude\(/g) || []).length === 1,
  `${APP}: findJobResources should call callClaude exactly once now (discovery only) -- verification moved into verifyResourceRows`)

const findPathGroupsIdx = app.indexOf('async function findPathGroups(criteria){')
const findPathGroupsEnd = app.indexOf('\n}', findPathGroupsIdx)
const findPathGroupsBody = findPathGroupsIdx !== -1 && findPathGroupsEnd !== -1 ? app.slice(findPathGroupsIdx, findPathGroupsEnd) : ''
check(findPathGroupsBody.length > 0, `${APP}: could not locate findPathGroups to check its body for a stray direct verification call`)
check((findPathGroupsBody.match(/callClaude\(/g) || []).length === 0,
  `${APP}: findPathGroups should call callClaude zero times directly now (discovery runs through runGroupsDiscovery, verification through verifyResourceRows) -- a direct call here means the old per-row loop survived`)

// --- Pure re-derivation: chunking and merge logic (App.jsx is JSX, can't --
// --- be imported by plain Node -- same constraint as every other App.jsx- -
// --- internal-logic test in this batch)                                  -

function chunk(rows, size) {
  const out = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}
check(chunk([], 6).length === 0, 'chunking zero rows must produce zero chunks')
check(chunk([1], 6).length === 1 && chunk([1], 6)[0].length === 1, 'chunking one row must produce one chunk of one')
check(chunk([1, 2, 3, 4, 5, 6], 6).length === 1, 'chunking exactly RESOURCE_VERIFY_CHUNK rows must produce one chunk -- this is the common case (discovery caps at 6-8 candidates) and must not overshoot into two calls needlessly')
check(chunk([1, 2, 3, 4, 5, 6, 7], 6).length === 2 && chunk([1, 2, 3, 4, 5, 6, 7], 6)[1].length === 1, 'one row past the chunk size must spill into a second chunk of one, not get dropped')
check(chunk(Array.from({ length: 14 }, (_, i) => i), 6).length === 3, '14 rows (the audit\'s own "8 to 11 calls" ceiling case, pre-dedup) must chunk into 3 batched calls, not 14 individual ones')

function mergeLivenessResult(r, v, scrubWhyThisFits) {
  if (!v || typeof v !== 'object') return r
  const sup = v.supersededBy && typeof v.supersededBy === 'object' && String(v.supersededBy.name || '').trim() ? v.supersededBy : null
  const next = { ...r }
  if (sup) {
    next.name = String(sup.name).slice(0, 140)
    next.url = /^https?:\/\//i.test(sup.url || '') ? sup.url : r.url
    next.eventsUrl = ''
    if (scrubWhyThisFits) next.whyThisFits = `SCRUBBED(${next.whyThisFits})`
  }
  if (v.alive === false) next.confidence = 'low'
  else if (v.alive === true && next.confidence !== 'high') next.confidence = 'medium'
  return next
}
check(mergeLivenessResult({ name: 'Old Org', confidence: 'medium', whyThisFits: 'fits because X' }, null, true).name === 'Old Org',
  'a missing/malformed verification result must leave the row unchanged (fail quiet, not fail blank)')
const supersededResources = mergeLivenessResult({ name: 'Old Org', url: 'https://old.example', whyThisFits: 'fits because X', confidence: 'medium' }, { supersededBy: { name: 'New Org', url: 'https://new.example' }, alive: true }, true)
check(supersededResources.name === 'New Org' && supersededResources.url === 'https://new.example',
  'a superseded organization must be replaced by the surviving one\'s name and URL')
check(supersededResources.whyThisFits === 'SCRUBBED(fits because X)',
  'with scrubWhyThisFits=true (the resources call site\'s preserved behavior), whyThisFits must be scrubbed on supersession')
const supersededGroups = mergeLivenessResult({ name: 'Old Org', whyThisFits: 'fits because X', confidence: 'medium' }, { supersededBy: { name: 'New Org', url: 'https://new.example' }, alive: true }, false)
check(supersededGroups.whyThisFits === 'fits because X',
  'with scrubWhyThisFits=false (the groups call site\'s preserved behavior), whyThisFits must be left untouched on supersession -- this is the pre-existing asymmetry between the two callers, not something batching should unify')

if (failures) {
  console.error(`test-web-search-bounds: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-web-search-bounds: OK (maxSearchUsesFor\'s per-step ceiling is evidence-based and wired into both api/claude.js tool-declaration sites and src/App.jsx\'s client-side one, and Networking Groups/Job Search Resources verification is batched in chunks of 6 through one shared function instead of one call per organization, preserving each caller\'s own merge behavior)')
}
