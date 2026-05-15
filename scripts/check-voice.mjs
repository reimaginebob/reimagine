import fs from 'node:fs'
import path from 'node:path'

const FILES_TO_CHECK = [
  'src/App.jsx',
  'src/demoData.js',
  ...fs.readdirSync('src/data/user-guide').map(f => path.join('src/data/user-guide', f)),
]

const HARD_BAN = [
  { pattern: /—/, name: 'em dash (—)', advice: 'Use commas, periods, colons, or parentheses instead.' },
  { pattern: /\bnot just\s+\w+[,.]?\s+you\s+\w+/i, name: 'logic-flip "not just X, you Y"', advice: 'Rewrite from the positive side.' },
  { pattern: /\byou do not just\s+\w+[,.]?\s+you\s+\w+/i, name: 'logic-flip "you do not just X, you Y"', advice: 'Rewrite from the positive side.' },
  { pattern: /(This|It|That) (is|was) not [^.]+\.\s+(This|It|That) (is|was) [^.]+\./i, name: 'logic-flip two-sentence "This is not X. This is Y."', advice: 'Rewrite as a single positive-side claim. Drop the negation pivot.' },
  { pattern: /\b(most (people|others|folks|peers)|than most|unlike most|than the (typical|average) [a-zA-Z]+|what most [a-zA-Z]+ (do|miss|will|cannot))\b/i, name: 'comparison framing ("most people/others", "than most", "unlike most", "than the typical/average X", "what most X do/miss")', advice: 'State the evidence in specific detail and let the listener draw the conclusion. Never elevate the user by contrast to unnamed others.' },
]

const SOFT_WARN = [
  { pattern: /\b(worth sitting with|sit with (this|that)|let that land|lean into|hold space for|get curious about|notice what comes up|take a moment to consider|trust the process|honor your journey)\b/i, name: 'AI-coaching register phrase', advice: 'Name the observation directly and let it stand. Prompt-level rules carry the primary suppression; this is a build-time backstop.' },
  { pattern: /\bMost professionals\b/i, name: '"Most professionals" comparison framing', advice: 'Rewrite from second person.' },
  { pattern: /\bMost leaders\b/i, name: '"Most leaders" comparison framing', advice: 'Rewrite from second person.' },
  { pattern: /\b(it|that|this) lands\b/i, name: '"lands" as AI-speak verb', advice: 'Rewrite with the plain verb the meaning requires (e.g., "Read it slowly" instead of "Take it slowly when it lands").' },
  { pattern: /\bsits at the intersection\b/i, name: '"sits at the intersection" AI-speak', advice: 'Rewrite with a plain verb.' },
  { pattern: /\bcommitting to\b/i, name: '"committing to" (legacy decision-step verb)', advice: 'The decision step is now Your Focus. Use "choosing" or "going with" in user-facing copy.' },
]

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

    for (const rule of HARD_BAN) {
      if (rule.pattern.test(line)) {
        console.error(`[FAIL] ${file}:${idx + 1} — ${rule.name}`)
        console.error(`       ${line.trim().substring(0, 120)}`)
        console.error(`       ${rule.advice}`)
        hardFailures++
      }
    }
    for (const rule of SOFT_WARN) {
      if (rule.pattern.test(line)) {
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
