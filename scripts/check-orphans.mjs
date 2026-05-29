// Build-time invariant: catch defined-but-uncalled functions in src/App.jsx.
//
// Origin: the 2026-05-28 op-restructure verification found switchToOpRole
// defined but never called (its call site was dropped in an earlier refactor),
// which silently disabled door2 record creation and made the entire op v2
// four-card surface unreachable. A live bug that only surfaced via production
// inspection. This gate makes that exact shape fail at prebuild instead.
//
// Detection: a top-level `const NAME = (...) =>`, `const NAME = async (...) =>`,
// or `function NAME(...)` definition in src/App.jsx whose identifier appears
// exactly once in the file (the definition itself) -- i.e. zero references --
// and is neither exported nor on the explicit allowlist below.
//
// Counting whole-word identifier occurrences means a function called anywhere
// (call `NAME(`, prop `onX={NAME}`, dispatch `{k:NAME}`, JSX `<NAME`) scores
// >= 2 and is not flagged. Only genuinely unreferenced names trip the gate.
//
// ALLOWLIST: names that are intentionally defined-but-not-directly-referenced
// in-file (dynamic dispatch by string key, etc.). Each entry needs a reason.
// Keep this list short; a growing list is a smell.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FILE = path.join(__dirname, '..', 'src', 'App.jsx')
const src = fs.readFileSync(FILE, 'utf8')

const ALLOWLIST = new Set([
  // (empty) -- add "name" /* reason */ here only for true dynamic-dispatch cases
])

const defs = new Set()
let m
const reConst = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?\(/g
while ((m = reConst.exec(src))) defs.add(m[1])
const reFn = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g
while ((m = reFn.exec(src))) defs.add(m[1])

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const orphans = []
for (const name of defs) {
  if (ALLOWLIST.has(name)) continue
  if (new RegExp('export[^;\\n]*\\b' + esc(name) + '\\b').test(src)) continue
  const count = (src.match(new RegExp('\\b' + esc(name) + '\\b', 'g')) || []).length
  if (count <= 1) orphans.push(name)
}

if (orphans.length) {
  console.error('check-orphans: FAIL -- defined-but-uncalled function(s) in src/App.jsx:')
  for (const n of orphans) console.error('  - ' + n + ' (defined, zero references)')
  console.error('Wire the call site, remove the dead function, or add to the ALLOWLIST with a reason.')
  process.exit(1)
}
console.log('check-orphans: OK (' + defs.size + ' definitions scanned, 0 orphans)')
