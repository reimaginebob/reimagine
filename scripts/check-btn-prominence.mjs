// Gold-CTA gate (CLAUDE.md §8).
//
// The rule: "For a prominent small button (a CTA, e.g. a Build action), use
// <Btn small prominent> (gold) — reserve it for the ONE primary action per view;
// utility small buttons (Copy, Print) stay outline."
//
// It had no detector, so it drifted: Networking Groups shipped its Find more —
// a generate action, and the only action left on the card once the list is
// built — as a plain outline button, and Bob caught it on screen. A sweep found
// six more of the same shape. An instruction alone is a draft; this is the fix.
//
// What it flags is deliberately narrow, because the rule's own limit is "ONE
// primary action per view" and a gate that demanded gold everywhere would be
// worse than no gate. Two signals, both structural:
//
//   1. CANCEL SIBLING. A bare <Btn small> immediately followed by a
//      <Btn small secondary>Cancel</Btn> is the primary action of a box the
//      user deliberately opened. That is the exact shape of every site the
//      sweep corrected.
//   2. BUILD VERB. A bare <Btn small> whose label starts with a generate verb.
//      Narrower than it sounds: "Add", "View", "Copy", "Print", "Remove" and
//      the navigation chevrons are all absent from the list on purpose.
//
// Ratchet, like check-fontsize: the count may fall, never rise. Lower the
// baseline when you clear one; never raise it to make a build pass.

import fs from 'node:fs'
import path from 'node:path'

const BASELINE = 0

const FILES = ['src/App.jsx', ...(fs.existsSync('src/components')
  ? fs.readdirSync('src/components').filter(f => /\.jsx?$/.test(f)).map(f => path.join('src/components', f))
  : [])]

// A label that names a generation. Kept tight on purpose.
const BUILD_VERB = /^(build|generate|regenerate|rebuild|refresh|find|parse|draft|pull this|update the list|bring this)\b/i

const isBare = (line) => /<Btn\s+small\s/.test(line) && !/<Btn\s+small\s+(secondary|prominent)\b/.test(line)

// The first piece of visible label text inside the button, skipping the icon.
function labelOf(line) {
  const open = line.indexOf('<Btn small')
  if (open < 0) return ''
  const seg = line.slice(open, line.indexOf('</Btn>', open) + 6 || undefined)
  const text = seg
    .replace(/<[A-Z][A-Za-z]*\s[^>]*\/>/g, ' ')   // icon elements
    .replace(/^<Btn[^>]*>/, '')
    .replace(/<\/Btn>$/, '')
  // A ternary label ({busy?'Finding…':'Find more'}) — take the longest literal.
  const literals = [...text.matchAll(/'([^']{2,})'/g)].map(m => m[1])
  const plain = text.replace(/\{[^}]*\}/g, ' ').replace(/<[^>]*>/g, ' ').trim()
  const candidates = [plain, ...literals].map(s => s.trim()).filter(Boolean)
  return candidates.sort((a, b) => b.length - a.length)[0] || ''
}

const findings = []
for (const file of FILES) {
  if (!fs.existsSync(file)) continue
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (!isBare(line)) return
    const next = lines[i + 1] || ''
    const cancelSibling = /<Btn\s+small\s+secondary[^>]*>\s*Cancel\s*<\/Btn>/.test(next)
    const label = labelOf(line)
    const buildVerb = BUILD_VERB.test(label)
    if (cancelSibling || buildVerb) {
      findings.push({
        file, line: i + 1, label: label.slice(0, 48),
        why: cancelSibling ? 'primary action beside a Cancel' : 'build verb',
      })
    }
  })
}

if (findings.length > BASELINE) {
  console.error(`check-btn-prominence: FAIL — ${findings.length} bare <Btn small> look like build actions (baseline ${BASELINE}).`)
  console.error('A build action uses <Btn small prominent> (gold). CLAUDE.md §8.')
  for (const f of findings) console.error(`  ${f.file}:${f.line} — "${f.label}" (${f.why})`)
  console.error('If one of these is genuinely a utility, or its view already has a gold primary,')
  console.error('leave it outline and say so in a comment on the line — then raise BASELINE only')
  console.error('with that reason recorded here.')
  process.exit(1)
}

console.log(`check-btn-prominence: OK (${findings.length} at the baseline of ${BASELINE}; ${FILES.length} files scanned).`)
