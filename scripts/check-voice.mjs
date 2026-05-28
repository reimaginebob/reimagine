import fs from 'node:fs'
import path from 'node:path'
import { patternsFor } from '../src/voice-patterns.mjs'

// Build-time voice guard. Scans source for banned constructions BEFORE build.
//
// Single source of truth: patterns live in src/voice-patterns.mjs and are
// shared with the runtime validator (generate/generateSection). This file
// enforces only the 'build' scoped subset - tight constructions we author
// deliberately (banned intensifiers, AI-coaching register) whose
// presence in source IS the failure. Logic-flip and comparative-standing
// patterns are 'runtime' scoped: source legitimately quotes/documents them
// (the Making Your Own Weather quote pool, demo fixtures, user-guide
// examples), so they are gated on model OUTPUT at runtime, not on source.

const FILES_TO_CHECK = [
  'src/App.jsx',
  'src/demoData.js',
  ...fs.readdirSync('src/data/user-guide').map(f => path.join('src/data/user-guide', f)),
]

const BUILD_HARD = patternsFor('build', { includeSoft: false })
const BUILD_SOFT = patternsFor('build', { includeSoft: true }).filter(p => p.severity === 'soft')

let hardFailures = 0
let softWarnings = 0

for (const file of FILES_TO_CHECK) {
  if (!fs.existsSync(file)) continue
  const content = fs.readFileSync(file, 'utf-8')
  const lines = content.split('\n')

  // Honor // voice-allow / // voice-allow-end markers to skip AI-facing prompt
  // strings (SYS templates, prompt-builder content) that contain banned
  // patterns as teaching examples for the model.
  let allow = false
  lines.forEach((line, idx) => {
    if (/\/\/\s*voice-allow\b(?!-end)/.test(line)) { allow = true; return }
    if (/\/\/\s*voice-allow-end\b/.test(line)) { allow = false; return }
    if (allow) return

    for (const rule of BUILD_HARD) {
      if (rule.re.test(line)) {
        console.error(`[FAIL] ${file}:${idx + 1} — ${rule.name}`)
        console.error(`       ${line.trim().substring(0, 120)}`)
        console.error(`       ${rule.note}`)
        hardFailures++
      }
    }
    for (const rule of BUILD_SOFT) {
      if (rule.re.test(line)) {
        console.warn(`[WARN] ${file}:${idx + 1} — ${rule.name}`)
        console.warn(`       ${line.trim().substring(0, 120)}`)
        softWarnings++
      }
    }
  })
}

console.log(`\nVoice check complete: ${hardFailures} hard failures, ${softWarnings} soft warnings.`)

if (hardFailures > 0) {
  console.error('\nBuild blocked: fix the hard failures above before committing.')
  process.exit(1)
}
