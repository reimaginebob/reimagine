// Font-size floor ratchet (work-visibility / min-font 2026-08-08).
//
// Reimagine has no CSS framework — everything is inline styles — so nothing
// stopped interactive elements and input labels from drifting to tiny fonts
// (13-14px) in the op/offer cards. The agreed floor is 15px for user-facing
// text and 16px for interactive elements; this gate enforces the 15px HARD
// floor mechanically (a scanner can't tell an input from a caption, so it
// guards the one number it can).
//
// It is a RATCHET, like the voice-allow count: it fails only if the number of
// sub-15 `fontSize:` values INCREASES past the baseline, so new drift is
// blocked immediately without requiring the whole app be swept first. As areas
// are cleaned, lower BASELINE to lock in the win. Goal: BASELINE reaches 0.
//
// Scope: React inline styles only (camelCase `fontSize:NN`). CSS strings in the
// print/PDF HTML use `font-size:` and are intentionally not scanned here.

import fs from 'fs'

const BASELINE = 0

const files = [
  'src/App.jsx',
  ...fs.readdirSync('src/components').filter(f => /\.(jsx|js)$/.test(f)).map(f => 'src/components/' + f),
]

let total = 0
const perFile = {}
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8')
  const nums = (t.match(/fontSize:\s*(\d+)/g) || []).map(x => +x.match(/\d+/)[0])
  const bad = nums.filter(n => n < 15).length
  if (bad) { perFile[f] = bad; total += bad }
}

if (total > BASELINE) {
  console.error(`check-fontsize: FAIL — ${total} sub-15px fontSize values, baseline is ${BASELINE}.`)
  console.error('You added a font size below the 15px floor. Use >=15 for text, >=16 for interactive elements (or the S primitives).')
  console.error(JSON.stringify(perFile, null, 2))
  process.exit(1)
}

if (total < BASELINE) {
  console.log(`check-fontsize: OK — ${total} sub-15px values, below the baseline of ${BASELINE}. Lower BASELINE to ${total} in scripts/check-fontsize.mjs to lock this in.`)
} else {
  console.log(`check-fontsize: OK (${total} sub-15px values at the baseline of ${BASELINE}; chip it down as cards are cleaned).`)
}
