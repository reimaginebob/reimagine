// Corpus testing harness for the new p3 prompt (Brief 2, KYV consolidation).
//
// Reads anonymized beta profiles from scripts/fixtures/kyv-corpus-2026-05-20.json
// and runs the new p3 prompt against each one. Writes outputs and a rating
// worksheet to scripts/fixtures/corpus-runs/<timestamp>/.
//
// Usage:
//   ANTHROPIC_API_KEY=... node scripts/test-p3-prompt.mjs
//
// Optional flags:
//   --limit=N         Only process the first N viable profiles.
//   --baseline        Run today's (pre-Brief-2) p3 prompt instead of the new one.
//                     Use this to compare formats during preflight step 1.
//                     Requires git stash/restore of the new App.jsx p3 entry,
//                     OR keep a copy of the old prompt at scripts/fixtures/p3-baseline.txt.
//   --skip-empty      (Default) Skip profiles without p1+p2.
//
// Output:
//   scripts/fixtures/corpus-runs/<ISO-timestamp>/
//     - profile-<id>.input.md      (prompt sent to Claude)
//     - profile-<id>.output.md     (new p3 prose)
//     - profile-<id>.old-p3.md     (existing p3, if present, for comparison)
//     - ratings.csv                (one row per profile, columns for the 4 brief criteria)
//     - summary.md                 (rating worksheet to fill in)
//
// The brief's pre-flight verification gate (step 3): rate each output against
// the mockup standard on lead-specificity, triangulation depth, dimensional
// weighting, and forward-looking framing. Iterate until at least 80% of
// outputs hit the mockup standard across the variety of profiles.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO = path.resolve(__dirname, '..')
const FIXTURES_DIR = path.join(REPO, 'scripts', 'fixtures')
const CORPUS_FILE = path.join(FIXTURES_DIR, 'kyv-corpus-2026-05-20.json')
const APP_FILE = path.join(REPO, 'src', 'App.jsx')

const flags = new Set(process.argv.slice(2).filter(a => a.startsWith('--')))
const limitArg = process.argv.slice(2).find(a => a.startsWith('--limit='))
const limit = limitArg ? parseInt(limitArg.slice('--limit='.length), 10) : Infinity
const baseline = flags.has('--baseline')

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY not set. Set it in your environment and re-run.')
  console.error('  $env:ANTHROPIC_API_KEY = "sk-ant-..."   # PowerShell')
  console.error('  export ANTHROPIC_API_KEY=sk-ant-...    # bash')
  process.exit(1)
}

// --- Load corpus ---------------------------------------------------------
if (!fs.existsSync(CORPUS_FILE)) {
  console.error(`Corpus file not found: ${CORPUS_FILE}`)
  console.error('Pull anonymized beta profiles from Neon and write the JSON array here.')
  process.exit(1)
}
const corpus = JSON.parse(fs.readFileSync(CORPUS_FILE, 'utf-8'))
if (!Array.isArray(corpus)) {
  console.error('Corpus is not a JSON array. Expected: [{id, profile, p1, p2, p3}, ...]')
  process.exit(1)
}

// Filter to viable profiles (p1 and p2 present and non-trivial).
const viable = corpus.filter(p => (p.p1 || '').length > 500 && (p.p2 || '').length > 500).slice(0, limit)
console.log(`Corpus: ${corpus.length} entries, ${viable.length} viable (have p1+p2)`)
if (viable.length === 0) {
  console.error('No viable profiles to test.')
  process.exit(1)
}

// --- Extract the p3 prompt builder from App.jsx --------------------------
// We import App.jsx-style P.p3 by evaluating its body in a sandbox. The
// simplest path: extract the p3 entry source and `eval` it into a function.
// We avoid importing App.jsx directly because it pulls in React.
const appSrc = fs.readFileSync(APP_FILE, 'utf-8')

function extractP3Source(src) {
  // Locate the line that starts the p3 entry. New (Brief 2) shape is a
  // multi-line arrow with `const rep = ...` then `return \`...\``. Old shape
  // is a single-line entry. Both start with `  p3:(pr,o1,o2)=>`.
  const startRe = /^\s*p3:\(pr,o1,o2\)\s*=>\s*\{/m
  const m = startRe.exec(src)
  if (!m) throw new Error('Could not locate p3 entry in App.jsx')
  const startIdx = m.index
  // Walk forward to find the matching closing brace of the arrow body.
  // Reuse a depth-tracking scanner that honors template literals.
  let i = m.index + m[0].length
  let depth = 1 // we are inside the { ... } already
  let mode = 'code'
  const tmplStack = []
  for (; i < src.length; i++) {
    const c = src[i]
    const n = src[i + 1]
    if (mode === 'sq') { if (c === '\\') { i++; continue } if (c === "'") mode = 'code'; continue }
    if (mode === 'dq') { if (c === '\\') { i++; continue } if (c === '"') mode = 'code'; continue }
    if (mode === 'line-comment') { if (c === '\n') mode = 'code'; continue }
    if (mode === 'block-comment') { if (c === '*' && n === '/') { mode = 'code'; i++ } continue }
    if (mode === 'tmpl') {
      if (c === '\\') { i++; continue }
      if (c === '`') { mode = 'code'; continue }
      if (c === '$' && n === '{') { tmplStack.push({ tmplDepth: depth }); mode = 'code'; i++; depth++ }
      continue
    }
    if (c === '/' && n === '/') { mode = 'line-comment'; i++; continue }
    if (c === '/' && n === '*') { mode = 'block-comment'; i++; continue }
    if (c === "'") { mode = 'sq'; continue }
    if (c === '"') { mode = 'dq'; continue }
    if (c === '`') { mode = 'tmpl'; continue }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (tmplStack.length > 0 && tmplStack[tmplStack.length - 1].tmplDepth === depth) {
        tmplStack.pop()
        mode = 'tmpl'
      }
      if (depth === 0) {
        // Found the closing brace of the arrow body.
        return src.slice(startIdx, i + 1)
      }
    }
  }
  throw new Error('Could not find closing brace of p3 entry')
}

// Build a callable from the extracted source. The entry is a property; wrap
// in an object literal and eval.
function buildP3Fn(p3Source) {
  // p3Source looks like: `p3:(pr,o1,o2)=>{ ... }`
  // Wrap as `({ p3:(pr,o1,o2)=>{...} }).p3`.
  // eslint-disable-next-line no-new-func
  const fn = new Function('return ({' + p3Source + '}).p3')()
  if (typeof fn !== 'function') throw new Error('Extracted p3 is not a function')
  return fn
}

const p3Source = extractP3Source(appSrc)
const p3Fn = buildP3Fn(p3Source)
console.log(`Extracted p3 prompt source: ${p3Source.length} chars`)

// --- Anthropic API call --------------------------------------------------
// We hit api.anthropic.com directly. Model and SYS are forced here, matching
// production /api/claude. Model pinned to the same one production uses.
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-5'
const MAX_TOKENS = 4096
// Match the production temperature in api/claude.js (the non-highTemp path).
// Without setting this explicitly, the Anthropic API defaults to 1.0, which
// is what the Brief 2 corpus run actually sampled. The corpus rating is only
// meaningful if test temperature matches production.
const TEMPERATURE = 0.7
const SYS_FILE = path.join(REPO, 'api', 'claude.js')
function extractSysPrompt() {
  const src = fs.readFileSync(SYS_FILE, 'utf-8')
  const m = src.match(/const SYS = `([\s\S]*?)`\s*\n/)
  if (!m) throw new Error('Could not extract SYS from api/claude.js')
  return m[1]
}
const SYS = extractSysPrompt()
console.log(`Extracted SYS: ${SYS.length} chars`)

async function callClaude(prompt) {
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: SYS,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Anthropic API ${res.status}: ${txt.slice(0, 500)}`)
  }
  const data = await res.json()
  const out = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
  return { text: out, usage: data.usage }
}

// --- Run corpus ----------------------------------------------------------
const ts = new Date().toISOString().replace(/[:.]/g, '-')
const outDir = path.join(FIXTURES_DIR, 'corpus-runs', ts)
fs.mkdirSync(outDir, { recursive: true })
console.log(`Writing outputs to ${outDir}`)

const ratingsCsv = ['profile_id,lead_specificity,triangulation_depth,dimensional_weighting,forward_framing,overall_hit_standard,notes']
const summaryRows = []

for (let idx = 0; idx < viable.length; idx++) {
  const entry = viable[idx]
  const id = entry.id
  const profile = typeof entry.profile === 'string' ? JSON.parse(entry.profile) : entry.profile
  const o1 = entry.p1
  const o2 = entry.p2
  // Ensure the prompt function's pr argument has the expected shape. The
  // fixtures profile already mirrors the live `pc` object that App.jsx builds
  // before calling P.p3. If keys are missing, the prompt interpolates the
  // 'not provided' fallback.
  const pr = {
    loc: profile.loc || { country: '', city: '', work: [] },
    resume: profile.resume || '',
    linkedin: profile.linkedin || '',
    lifeEvents: profile.lifeEvents || '',
    assess: profile.assess || '',
    assessType: profile.assessType || '',
    values: profile.values || '',
    passions: profile.passions || '',
    rep: profile.rep || {},
    frameworks: profile.frameworks || [],
  }

  const prompt = p3Fn(pr, o1, o2)
  fs.writeFileSync(path.join(outDir, `profile-${id}.input.md`), prompt)

  // Save the existing p3 output for side-by-side comparison.
  if (entry.p3) fs.writeFileSync(path.join(outDir, `profile-${id}.old-p3.md`), entry.p3)

  console.log(`[${idx + 1}/${viable.length}] ${id}  prompt: ${prompt.length} chars`)
  try {
    const { text, usage } = await callClaude(prompt)
    fs.writeFileSync(path.join(outDir, `profile-${id}.output.md`), text)
    console.log(`  ok. ${text.length} chars out, ${usage?.input_tokens}/${usage?.output_tokens} tokens`)
    ratingsCsv.push(`${id},,,,,,`)
    summaryRows.push({ id, ok: true, chars: text.length, inputTokens: usage?.input_tokens, outputTokens: usage?.output_tokens })
  } catch (e) {
    console.error(`  FAIL: ${e.message}`)
    ratingsCsv.push(`${id},ERR,ERR,ERR,ERR,ERR,"${e.message.replace(/"/g, '""')}"`)
    summaryRows.push({ id, ok: false, error: e.message })
  }
}

fs.writeFileSync(path.join(outDir, 'ratings.csv'), ratingsCsv.join('\n') + '\n')

// Write the rating worksheet.
const worksheet = `# Corpus run: ${ts}

Corpus: ${corpus.length} entries, ${viable.length} viable.
Limit applied: ${limit === Infinity ? 'none' : limit}.
Baseline mode: ${baseline ? 'yes (existing prompt)' : 'no (new Brief 2 prompt)'}.

## Rating instructions

For each profile output (\`profile-<id>.output.md\`), rate against the mockup standard on four criteria. The mockup lives at \`Output/mockups/2026-05-20_your-read-synthesis-only-mockup.html\`.

1. **Lead sentence specificity** (1-5): Is the opening sentence precise enough to be wrong? Could another profile plausibly have the same lead, or is this one unique to the person?
2. **Triangulation depth** (1-5): Does the output show CONVERGENCE across sources, or just enumerate them? Are 2-3 input dimensions named explicitly with the same shape pointing the same direction?
3. **Dimensional weighting** (1-5): Do decisional dimensions (typically scale, mission) get fuller paragraphs than confirming dimensions? Or are all six dimensions given roughly equal length?
4. **Forward-looking framing** (1-5): Does the "Where this transfers" paragraph and the dimensional fit set up Two Doors with specificity? Or is the closing generic?

Overall hit-standard (Y/N): does this output ship as-is, or would you reject it?

Goal: at least 80% of outputs (${Math.ceil(viable.length * 0.8)} of ${viable.length}) must hit the standard.

## Profiles

${summaryRows.map(r => r.ok
  ? `- **${r.id}** — ${r.chars} chars, ${r.inputTokens} in / ${r.outputTokens} out. Rate in \`ratings.csv\`.`
  : `- **${r.id}** — FAILED: ${r.error}`
).join('\n')}

## When done

If 80% threshold not met, iterate on the prompt in \`src/App.jsx:687\` and re-run this script. Paste the final ratings summary into the PR description.
`
fs.writeFileSync(path.join(outDir, 'summary.md'), worksheet)
console.log(`\nDone. Open ${path.join(outDir, 'summary.md')} to start rating.`)
