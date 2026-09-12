// Architecture audit, F2 (2026-09-12), PR 1: docs/concierge-moment-map.md
// documents every MOMENT_CATALOG entry by hand -- prose, eligibility
// descriptions, cross-referenced line numbers. None of that is machine-
// checkable. What IS checkable, and what this gate checks, is the one
// fact a stale doc would get wrong first: the list of keys. A JSON array
// embedded in the doc (Section 2's "moment-catalog-keys" block) must equal
// MOMENT_CATALOG.map(e => e.key), in the same order, exactly -- the same
// "cannot silently drift" guarantee check-coach-nav-map.mjs already gives
// src/coach-nav-map.js, sized to what a hand-written doc can actually
// promise (the key list, not the prose).
import fs from 'node:fs'
import { MOMENT_CATALOG } from '../src/coach-moments.js'

const DOC = 'docs/concierge-moment-map.md'
const doc = fs.readFileSync(DOC, 'utf8')

const START = '<!-- moment-catalog-keys:START -->'
const END = '<!-- moment-catalog-keys:END -->'
const startIdx = doc.indexOf(START)
const endIdx = doc.indexOf(END)

if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
  console.error(`check-concierge-moment-map: FAIL -- ${DOC} is missing its moment-catalog-keys markers.`)
  process.exit(1)
}

const block = doc.slice(startIdx, endIdx)
const jsonMatch = block.match(/```json\s*([\s\S]*?)\s*```/)
if (!jsonMatch) {
  console.error(`check-concierge-moment-map: FAIL -- no \`\`\`json block found between the moment-catalog-keys markers in ${DOC}.`)
  process.exit(1)
}

let docKeys
try {
  docKeys = JSON.parse(jsonMatch[1])
} catch (e) {
  console.error(`check-concierge-moment-map: FAIL -- the moment-catalog-keys JSON block in ${DOC} does not parse: ${e.message}`)
  process.exit(1)
}

const liveKeys = MOMENT_CATALOG.map(e => e.key)

const a = JSON.stringify(docKeys)
const b = JSON.stringify(liveKeys)
if (a !== b) {
  console.error(`check-concierge-moment-map: FAIL -- ${DOC}'s key list no longer matches MOMENT_CATALOG (src/coach-moments.js).`)
  console.error(`  doc:  ${a}`)
  console.error(`  live: ${b}`)
  console.error('Update the moment-catalog-keys JSON block (and the rest of the doc, by hand) to match.')
  process.exit(1)
}

console.log(`check-concierge-moment-map: OK (${liveKeys.length} keys, doc matches MOMENT_CATALOG)`)
