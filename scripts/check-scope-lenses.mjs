// scripts/check-scope-lenses.mjs
//
// Fails the build if the SCOPE dimensions taught in the staircase explainer
// stop matching the ones the product actually uses.
//
// WHY THIS EXISTS. `SCOPE_LENSES` in src/App.jsx is the authority: Interview
// Prep tags each named interviewer with exactly one of those five words, and
// the story-remix control drafts against them. The staircase explainer teaches
// the same five to someone who has never met the framework. Those two lists
// disagreeing is not a cosmetic problem -- it teaches a vocabulary the screen
// does not use, so the person arrives at Interview Prep and the words they were
// taught are not there.
//
// It is written because the drift already happened. The first version of
// src/data/staircase-explainers.js shipped Strategy / Culture / OWNERSHIP /
// PROBLEM-SOLVING / EXECUTION -- three of the five wrong, invented rather than
// taken from Lesson 10 -- and nothing in the build had an opinion about it. It
// was caught by reading the book, which is not a mechanism.
//
// The explainer cannot import SCOPE_LENSES: the authority lives inside
// App.jsx, and a data module pulling in the whole app to read one array is a
// worse problem than a copy with a gate on it. So this is the gate.
import fs from 'node:fs'

const APP = 'src/App.jsx'
const EXPLAINERS = 'src/data/staircase-explainers.js'

function fail(msg) {
  console.error(`check-scope-lenses: FAIL\n${msg}`)
  process.exit(1)
}

const app = fs.readFileSync(APP, 'utf-8')
const appMatch = app.match(/const\s+SCOPE_LENSES\s*=\s*\[([^\]]*)\]/)
if (!appMatch) fail(`Could not find SCOPE_LENSES in ${APP}. If it was renamed, update this gate rather than deleting it.`)
const authority = [...appMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1])

const src = fs.readFileSync(EXPLAINERS, 'utf-8')
const exMatch = src.match(/const\s+SCOPE_DIMENSIONS\s*=\s*\[([\s\S]*?)\n\]/)
if (!exMatch) fail(`Could not find SCOPE_DIMENSIONS in ${EXPLAINERS}. If it was renamed, update this gate rather than deleting it.`)
const taught = [...exMatch[1].matchAll(/lead:\s*'([^']+)'/g)].map(m => m[1])

if (authority.length !== taught.length || authority.some((w, i) => w !== taught[i])) {
  fail(
    `The SCOPE dimensions taught on the staircase do not match the ones the product uses.\n` +
    `  ${APP} SCOPE_LENSES : ${authority.join(', ')}\n` +
    `  ${EXPLAINERS}       : ${taught.join(', ')}\n` +
    `Both lists must carry the same five words in the same order. App.jsx is the authority.`
  )
}

// The acrostic is the reason the framework is memorable, so a set of five
// correct words that no longer spells SCOPE is still a failure.
const acronym = authority.map(w => w[0]).join('')
if (acronym !== 'SCOPE') {
  fail(`SCOPE_LENSES initials spell "${acronym}", not SCOPE: ${authority.join(', ')}`)
}

console.log(`check-scope-lenses: OK (${authority.join(', ')})`)
