#!/usr/bin/env node
// scripts/check-sys-equality.mjs
//
// Asserts the SYS template-literal bodies in src/App.jsx and api/claude.js
// are byte-for-byte equal. Runs in the prebuild chain. Fails the build on
// drift so the inline duplication that the 2026-05-27 outage demonstrated
// we cannot solve via cross-directory .mjs imports stays in sync by
// mechanical check.
//
// Background. PR #76 attempted SYS consolidation via a shared module
// imported by both files. The cross-directory `.mjs` import succeeded
// locally and in Vite's client build but failed at Vercel function
// invocation time, taking production down for ~45 minutes. PR #76 was
// reverted. The inline duplication this script polices is the trade-off
// accepted in exchange for runtime safety; see CLAUDE.md for the rule
// against `.mjs` cross-directory imports.
//
// Extraction strategy. Locate the `const SYS = \`...\`` opener and the
// closing backtick at end-of-line. Extract the body between them.
// Normalize line endings to LF so Windows CRLF working trees do not
// false-fail (the repo commits LF; only local Windows checkouts diverge).
// Both files have SYS as a single contiguous template literal with no
// `${...}` interpolations inside, so this regex is sufficient.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')

function extractSysBody(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const m = text.match(/const SYS_BASE = `([\s\S]*?)`\s*$/m)
  if (!m) throw new Error(`Could not locate SYS template literal in ${filePath}`)
  return m[1].replace(/\r\n/g, '\n')
}

const clientSys = extractSysBody(path.join(REPO_ROOT, 'src', 'App.jsx'))
const serverSys = extractSysBody(path.join(REPO_ROOT, 'api', 'claude.js'))

if (clientSys === serverSys) {
  console.log(`check-sys-equality: OK (${clientSys.length} bytes match)`)
  process.exit(0)
}

// Find the first divergence offset for a useful error message.
let i = 0
while (i < clientSys.length && i < serverSys.length && clientSys[i] === serverSys[i]) i++
const context = (s, idx) => {
  const start = Math.max(0, idx - 40)
  const end = Math.min(s.length, idx + 40)
  return JSON.stringify(s.slice(start, end))
}

console.error(`check-sys-equality: FAIL`)
console.error(`  src/App.jsx SYS body:   ${clientSys.length} bytes`)
console.error(`  api/claude.js SYS body: ${serverSys.length} bytes`)
console.error(`  First divergence at offset ${i}`)
console.error(`  Client context: ${context(clientSys, i)}`)
console.error(`  Server context: ${context(serverSys, i)}`)
console.error(``)
console.error(`The two inline SYS copies must stay byte-equal. If you intended`)
console.error(`to edit SYS, edit BOTH files in this PR. Cross-directory imports`)
console.error(`to share SYS are not available on this Vercel deploy target;`)
console.error(`see CLAUDE.md for the .mjs cross-directory import rule.`)
process.exit(1)
