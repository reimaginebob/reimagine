import fs from 'node:fs'

// Build-time invariant. Catches the class of bug where a prompt template
// interpolates `${pr.X}` but the compiled profile `pc` does not include `X`.
// That mismatch silently renders an empty value into the prompt, which is
// how hotfix-3 (linkedin) and Step 3 (lifeEvents) were originally able to
// land in production unnoticed. Wired into the prebuild script alongside
// `check-voice.mjs`.
//
// Static check: top-level field names only. Every current prompt uses static
// dot paths (`pr.rep.memory`, `pr.resume.substring(...)`, etc.) where the
// parent field IS in `pc`. The top-level check correctly resolves nested
// access. If a future prompt introduces dynamic access (`pr[fieldKey]`),
// this check will miss it; add a runtime gate at that point.
//
// Allow-list: `pr.corrections` and `pr.jd` are intentionally not in `pc`.
// `corrections` is prepended at call time via `correctionsBlock`; `jd` is
// passed as a separate argument to `P.op` and is not part of the compiled
// profile.

const SRC = 'src/App.jsx'
const ALLOWED_OUTSIDE_PC = new Set(['corrections', 'jd'])

const raw = fs.readFileSync(SRC, 'utf-8')

// --- Locate the `pc` literal and pull its top-level keys ---
const pcStartMatch = raw.match(/const\s+pc\s*=\s*\{/)
if (!pcStartMatch) {
  console.error('check-prompt-refs: FAIL\nCould not locate `const pc=` in src/App.jsx.')
  process.exit(1)
}
const pcOpenIdx = pcStartMatch.index + pcStartMatch[0].length - 1 // index of '{'
const pcCloseIdx = findMatchingBrace(raw, pcOpenIdx)
if (pcCloseIdx === -1) {
  console.error('check-prompt-refs: FAIL\nCould not find matching `}` for `const pc=` literal.')
  process.exit(1)
}
const pcBody = raw.slice(pcOpenIdx + 1, pcCloseIdx)
const pcKeys = extractTopLevelKeys(pcBody)

// --- Locate the `P` literal and pull every `${pr.X` reference per prompt ---
const pStartMatch = raw.match(/const\s+P\s*=\s*\{/)
if (!pStartMatch) {
  console.error('check-prompt-refs: FAIL\nCould not locate `const P=` in src/App.jsx.')
  process.exit(1)
}
const pOpenIdx = pStartMatch.index + pStartMatch[0].length - 1
const pCloseIdx = findMatchingBrace(raw, pOpenIdx)
if (pCloseIdx === -1) {
  console.error('check-prompt-refs: FAIL\nCould not find matching `}` for `const P=` literal.')
  process.exit(1)
}
const pBody = raw.slice(pOpenIdx + 1, pCloseIdx)

// Walk `pBody` to extract each prompt entry (key plus template-literal body).
const prompts = extractPromptEntries(pBody)

// --- Collect missing references ---
const refRegex = /\$\{pr\.([A-Za-z_$][A-Za-z0-9_$]*)/g
const missing = [] // { prompt, field }
const seen = new Set() // dedupe (prompt, field)
for (const { name, body } of prompts) {
  let m
  while ((m = refRegex.exec(body)) !== null) {
    const field = m[1]
    if (pcKeys.has(field)) continue
    if (ALLOWED_OUTSIDE_PC.has(field)) continue
    const key = `${name}::${field}`
    if (seen.has(key)) continue
    seen.add(key)
    missing.push({ prompt: name, field })
  }
}

if (missing.length > 0) {
  console.error('check-prompt-refs: FAIL')
  console.error('The following prompt template references in src/App.jsx do not have matching keys in `pc`:')
  for (const { prompt, field } of missing) {
    console.error(`  - ${prompt}: \${pr.${field}}`)
  }
  console.error('Add the missing fields to pc, or remove the references from the prompts.')
  process.exit(1)
}

// --- Chat-helper invariant -------------------------------------------------
// Catches the class of drift that landed the 2026-05-20 audit findings:
// `src/components/Chat.jsx` STEP_LABELS and the `api/chat.js` system-prompt
// step-id table both name step IDs the helper can NAVIGATE to. If either
// names an ID that does not exist in the navigable step map (META), the
// chat helper offers a dead navigation target.
//
// Source of truth: the META constant in src/App.jsx. The reverse check (every
// META step is named in STEP_LABELS / table) is intentionally not enforced;
// some META steps are internal-only and not appropriate navigation targets.

const META_REGEX = /const\s+META\s*=\s*\{/
const metaMatch = raw.match(META_REGEX)
if (!metaMatch) {
  console.error('check-prompt-refs: FAIL\nCould not locate `const META=` in src/App.jsx.')
  process.exit(1)
}
const metaOpenIdx = metaMatch.index + metaMatch[0].length - 1
const metaCloseIdx = findMatchingBrace(raw, metaOpenIdx)
if (metaCloseIdx === -1) {
  console.error('check-prompt-refs: FAIL\nCould not find matching `}` for `const META=` literal.')
  process.exit(1)
}
const metaBody = raw.slice(metaOpenIdx + 1, metaCloseIdx)
const metaKeys = extractTopLevelKeys(metaBody)

// Sanity: META must include the two known kebab-case keys. If parser drift
// hides them, the chat-helper invariant becomes silently wrong.
const REQUIRED_META_KEYS = ['life-events', 'orientation-done']
const missingRequired = REQUIRED_META_KEYS.filter(k => !metaKeys.has(k))
if (missingRequired.length > 0) {
  console.error('check-prompt-refs: FAIL')
  console.error(`META parser did not capture expected kebab-case keys: ${missingRequired.join(', ')}.`)
  console.error('This usually means the extractTopLevelKeys identifier regex or quoted-string handling regressed.')
  process.exit(1)
}

// Parse STEP_LABELS from src/components/Chat.jsx.
const CHAT_PATH = 'src/components/Chat.jsx'
const chatSrc = fs.readFileSync(CHAT_PATH, 'utf-8')
const stepLabelsMatch = chatSrc.match(/const\s+STEP_LABELS\s*=\s*\{/)
if (!stepLabelsMatch) {
  console.error(`check-prompt-refs: FAIL\nCould not locate \`const STEP_LABELS=\` in ${CHAT_PATH}.`)
  process.exit(1)
}
const stepLabelsOpenIdx = stepLabelsMatch.index + stepLabelsMatch[0].length - 1
const stepLabelsCloseIdx = findMatchingBrace(chatSrc, stepLabelsOpenIdx)
if (stepLabelsCloseIdx === -1) {
  console.error(`check-prompt-refs: FAIL\nCould not find matching \`}\` for STEP_LABELS in ${CHAT_PATH}.`)
  process.exit(1)
}
const stepLabelsKeys = extractTopLevelKeys(chatSrc.slice(stepLabelsOpenIdx + 1, stepLabelsCloseIdx))

// Parse the api/chat.js SYSTEM_PROMPT step-id table. The table sits inside a
// JS template literal, so the data-row regex must be region-anchored to
// avoid matching the header row, the separator row, or any pipe-delimited
// content that may appear elsewhere in the prompt body. Start after the
// header sentinel; stop at the closing sentence; skip the `|---|---|`
// separator row explicitly.
const API_CHAT_PATH = 'api/chat.js'
const apiChatSrc = fs.readFileSync(API_CHAT_PATH, 'utf-8')
const TABLE_START_SENTINEL = '| Step id | User-facing name (use these to match user intent) |'
const TABLE_END_SENTINEL = "If the user's request does not clearly map to one of the rows above, do not include NAVIGATE: in your reply."
const tableStartIdx = apiChatSrc.indexOf(TABLE_START_SENTINEL)
const tableEndIdx = apiChatSrc.indexOf(TABLE_END_SENTINEL)
if (tableStartIdx === -1 || tableEndIdx === -1 || tableEndIdx <= tableStartIdx) {
  console.error(`check-prompt-refs: FAIL\nCould not locate the step-id table region in ${API_CHAT_PATH}.`)
  console.error(`  Looked for start sentinel: "${TABLE_START_SENTINEL}"`)
  console.error(`  Looked for end sentinel:   "${TABLE_END_SENTINEL}"`)
  process.exit(1)
}
const tableRegion = apiChatSrc.slice(tableStartIdx + TABLE_START_SENTINEL.length, tableEndIdx)
const apiTableSteps = new Set()
const DATA_ROW = /^\|\s*([A-Za-z_0-9-]+)\s*\|/
for (const line of tableRegion.split('\n')) {
  if (/^\|\s*-+\s*\|/.test(line)) continue // separator row
  const m = line.match(DATA_ROW)
  if (m) apiTableSteps.add(m[1])
}

// Cross-check. Every STEP_LABELS key and every table step-id must exist in META.
const chatHelperMissing = [] // { source, id }
for (const id of stepLabelsKeys) {
  if (!metaKeys.has(id)) chatHelperMissing.push({ source: `${CHAT_PATH} STEP_LABELS`, id })
}
for (const id of apiTableSteps) {
  if (!metaKeys.has(id)) chatHelperMissing.push({ source: `${API_CHAT_PATH} system-prompt table`, id })
}
if (chatHelperMissing.length > 0) {
  console.error('check-prompt-refs: FAIL')
  console.error('The following chat-helper step IDs do not exist in `META` (src/App.jsx):')
  for (const { source, id } of chatHelperMissing) {
    console.error(`  - ${source}: ${id}`)
  }
  console.error('Remove the orphan IDs, or add the missing steps to META.')
  process.exit(1)
}

console.log(`check-prompt-refs: OK (${pcKeys.size} pc keys, ${prompts.length} prompt templates, ${metaKeys.size} META keys, ${stepLabelsKeys.size} STEP_LABELS, ${apiTableSteps.size} api/chat.js table rows checked)`)

// --- Helpers ---

// Forward-walk to find the brace that closes the one at `openIdx`.
// Skips string and template-literal contents and line/block comments so
// `{`/`}` inside them do not throw off the count.
function findMatchingBrace(src, openIdx) {
  let depth = 0
  let i = openIdx
  const len = src.length
  const tmplStack = [] // each entry: { depth } for tracking ${} inside templates
  let mode = 'code' // 'code' | 'sq' | 'dq' | 'tmpl' | 'line-comment' | 'block-comment'
  for (; i < len; i++) {
    const c = src[i]
    const n = src[i + 1]
    if (mode === 'line-comment') {
      if (c === '\n') mode = 'code'
      continue
    }
    if (mode === 'block-comment') {
      if (c === '*' && n === '/') { mode = 'code'; i++ }
      continue
    }
    if (mode === 'sq') {
      if (c === '\\') { i++; continue }
      if (c === "'") mode = 'code'
      continue
    }
    if (mode === 'dq') {
      if (c === '\\') { i++; continue }
      if (c === '"') mode = 'code'
      continue
    }
    if (mode === 'tmpl') {
      if (c === '\\') { i++; continue }
      if (c === '`') mode = 'code'
      else if (c === '$' && n === '{') {
        tmplStack.push({ tmplDepth: depth })
        mode = 'code'
        i++ // skip '{' but we still need to count it...
        depth++
      }
      continue
    }
    // mode === 'code'
    if (c === '/' && n === '/') { mode = 'line-comment'; i++; continue }
    if (c === '/' && n === '*') { mode = 'block-comment'; i++; continue }
    if (c === "'") { mode = 'sq'; continue }
    if (c === '"') { mode = 'dq'; continue }
    if (c === '`') { mode = 'tmpl'; continue }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      // If we just closed a `${...}` inside a template literal, pop back to tmpl mode.
      if (tmplStack.length > 0 && tmplStack[tmplStack.length - 1].tmplDepth === depth) {
        tmplStack.pop()
        mode = 'tmpl'
      }
      if (depth === 0) return i
    }
  }
  return -1
}

// Extract the top-level keys from the body of an object literal (between
// the outer braces, not including them). Handles nested braces, string and
// template literals, and shorthand `key,` forms.
function extractTopLevelKeys(body) {
  const keys = new Set()
  let depth = 0
  let mode = 'code'
  let tokenStart = 0
  let pendingKey = ''
  let expectingKey = true
  const flushKey = () => {
    const k = pendingKey.trim()
    if (k) {
      // Strip a single pair of surrounding quotes if quoted-key. Quoted keys
      // appear as `'foo':` or `"foo":`; both forms must round-trip through
      // here so META keys like `'life-events':` and `'orientation-done':` are
      // captured. Without this, the chat-helper invariant would silently
      // pass for an actually-broken step map.
      let unquoted = k
      if ((unquoted.startsWith("'") && unquoted.endsWith("'")) ||
          (unquoted.startsWith('"') && unquoted.endsWith('"'))) {
        unquoted = unquoted.slice(1, -1)
      }
      // Identifier-shape accepts hyphens to admit kebab-case keys (the META
      // set uses two: `life-events` and `orientation-done`).
      if (/^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(unquoted)) keys.add(unquoted)
    }
    pendingKey = ''
  }
  const tmplStack = []
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    const n = body[i + 1]
    if (mode === 'sq') {
      if (c === '\\') { if (expectingKey && depth === 0) pendingKey += c; i++; if (expectingKey && depth === 0) pendingKey += body[i]; continue }
      if (c === "'") { mode = 'code'; if (expectingKey && depth === 0) pendingKey += c; continue }
      if (expectingKey && depth === 0) pendingKey += c
      continue
    }
    if (mode === 'dq') {
      // Mirror the single-quote accumulation so double-quoted keys like
      // `"foo":` round-trip into the key set (flushKey strips the quotes).
      if (c === '\\') { if (expectingKey && depth === 0) pendingKey += c; i++; if (expectingKey && depth === 0) pendingKey += body[i]; continue }
      if (c === '"') { mode = 'code'; if (expectingKey && depth === 0) pendingKey += c; continue }
      if (expectingKey && depth === 0) pendingKey += c
      continue
    }
    if (mode === 'tmpl') {
      if (c === '\\') { i++; continue }
      if (c === '`') { mode = 'code'; continue }
      if (c === '$' && n === '{') { tmplStack.push({ tmplDepth: depth }); mode = 'code'; i++; depth++ }
      continue
    }
    if (mode === 'line-comment') { if (c === '\n') mode = 'code'; continue }
    if (mode === 'block-comment') { if (c === '*' && n === '/') { mode = 'code'; i++ } continue }
    // code mode
    if (c === '/' && n === '/') { mode = 'line-comment'; i++; continue }
    if (c === '/' && n === '*') { mode = 'block-comment'; i++; continue }
    if (c === "'") { mode = 'sq'; if (expectingKey && depth === 0) pendingKey += c; continue }
    if (c === '"') { mode = 'dq'; if (expectingKey && depth === 0) pendingKey += c; continue }
    if (c === '`') { mode = 'tmpl'; continue }
    if (c === '{' || c === '[' || c === '(') { depth++; continue }
    if (c === '}' || c === ']' || c === ')') {
      depth--
      if (tmplStack.length > 0 && tmplStack[tmplStack.length - 1].tmplDepth === depth) {
        tmplStack.pop()
        mode = 'tmpl'
      }
      continue
    }
    if (depth === 0) {
      if (c === ':') {
        // Key portion of `key: value`.
        flushKey()
        expectingKey = false
        continue
      }
      if (c === ',') {
        // Shorthand `key,` or end of pair: if we were still collecting a key
        // (no `:` seen), treat the buffer as a shorthand key.
        if (expectingKey) flushKey()
        expectingKey = true
        pendingKey = ''
        continue
      }
      if (expectingKey) {
        // Accept identifier chars, single quotes for quoted keys (handled in 'sq')
        pendingKey += c
      }
    }
  }
  // Catch trailing shorthand key (no trailing comma)
  if (expectingKey) flushKey()
  return keys
}

// Extract `{ name, body }` entries from the body of the `P = { ... }` literal.
// `name` is the prompt key (identifier or 'p_res'); `body` is the source of
// the template literal that the arrow function returns. Captures both
// expression-body (`pX: (pr) => \`...\``) and block-body (`pX: (pr) => { ... return \`...\` ... }`)
// forms, plus the plain `pX:\`...\`` shape if it ever appears.
function extractPromptEntries(body) {
  const entries = []
  // Regex finds each prompt key + arrow. We then scan forward from the arrow
  // to collect every template literal that belongs to that entry, stopping
  // at the next top-level key.
  const keyRe = /(\b[A-Za-z_$][A-Za-z0-9_$]*\b)\s*:\s*(?:\([^)]*\)|[A-Za-z_$][A-Za-z0-9_$]*)?\s*(=>)?\s*/g
  let lastEnd = 0
  const keyHits = []
  let m
  while ((m = keyRe.exec(body)) !== null) {
    // Heuristic: a real top-level prompt entry starts at depth 0 and is
    // followed by either a template literal, an arrow, or a `{`. The brace
    // scanner below verifies depth at the time of the match.
    keyHits.push({ name: m[1], idx: m.index, after: keyRe.lastIndex })
  }
  // Determine top-level positions by depth-tracking.
  const topLevelKeys = []
  for (const hit of keyHits) {
    if (isAtTopLevel(body, hit.idx)) topLevelKeys.push(hit)
  }
  for (let i = 0; i < topLevelKeys.length; i++) {
    const cur = topLevelKeys[i]
    const next = topLevelKeys[i + 1]
    const sliceEnd = next ? next.idx : body.length
    const segment = body.slice(cur.after, sliceEnd)
    // Collect every backtick literal in the segment.
    const tmplBodies = []
    let mode = 'code'
    let depth = 0
    let cur2 = ''
    for (let j = 0; j < segment.length; j++) {
      const c = segment[j]
      const n = segment[j + 1]
      if (mode === 'sq') { if (c === '\\') { j++; continue } if (c === "'") mode = 'code'; continue }
      if (mode === 'dq') { if (c === '\\') { j++; continue } if (c === '"') mode = 'code'; continue }
      if (mode === 'line-comment') { if (c === '\n') mode = 'code'; continue }
      if (mode === 'block-comment') { if (c === '*' && n === '/') { mode = 'code'; j++ } continue }
      if (mode === 'tmpl') {
        if (c === '\\') { cur2 += c; j++; if (j < segment.length) cur2 += segment[j]; continue }
        if (c === '`') { tmplBodies.push(cur2); cur2 = ''; mode = 'code'; continue }
        cur2 += c
        continue
      }
      // code mode
      if (c === '/' && n === '/') { mode = 'line-comment'; j++; continue }
      if (c === '/' && n === '*') { mode = 'block-comment'; j++; continue }
      if (c === "'") { mode = 'sq'; continue }
      if (c === '"') { mode = 'dq'; continue }
      if (c === '`') { mode = 'tmpl'; cur2 = ''; continue }
      if (c === '{' || c === '[' || c === '(') depth++
      else if (c === '}' || c === ']' || c === ')') depth--
    }
    if (tmplBodies.length > 0) {
      entries.push({ name: cur.name, body: tmplBodies.join('\n') })
    }
  }
  return entries
  // Note: lastEnd is unused; kept above as a placeholder for clarity.
}

// Returns true if `idx` in `body` is at depth 0 (outside any nested braces,
// brackets, parens, strings, templates, or comments).
function isAtTopLevel(body, idx) {
  let depth = 0
  let mode = 'code'
  const tmplStack = []
  for (let i = 0; i < idx; i++) {
    const c = body[i]
    const n = body[i + 1]
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
    if (c === '{' || c === '[' || c === '(') depth++
    else if (c === '}' || c === ']' || c === ')') {
      depth--
      if (tmplStack.length > 0 && tmplStack[tmplStack.length - 1].tmplDepth === depth) {
        tmplStack.pop()
        mode = 'tmpl'
      }
    }
  }
  return depth === 0 && mode === 'code'
}
