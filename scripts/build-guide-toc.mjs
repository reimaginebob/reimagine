// Generates the contents list inside src/data/user-guide/index.md.
//
// Why this is generated. Chapter numbers are DERIVED from position in
// src/data/user-guide/ORDER.json (see scripts/lib/user-guide-order.mjs), so
// inserting a chapter re-flows every number after it. A hand-maintained
// contents page is the one place a stale number can still survive that — and it
// is the first page a reader sees, plus the table the Coach reads to answer
// "what's in the guide". The old page hand-kept its numbers AND carried
// 11b./11c./11d./11e. as literal text, a fossil of the ordering scheme that
// ORDER.json replaced.
//
// Now: the list between the markers below is emitted from ORDER.json plus each
// chapter's own H1. Add a chapter, add its line to ORDER.json, and the contents
// page re-numbers itself on the next build. Nothing outside the markers is
// touched, so the prose around the list stays hand-written.
//
// Runs in prebuild ahead of check-guide-refs.mjs, so the links this emits are
// themselves gate-checked. Idempotent: identical output means no write, so a
// clean tree stays clean.
import fs from 'fs'
import path from 'path'
import { CHAPTERS_DIR, INDEX_FILE, chapterFiles, chapterTitle } from './lib/user-guide-order.mjs'

const START = '<!-- toc:start -->'
const END = '<!-- toc:end -->'

const indexPath = path.join(CHAPTERS_DIR, INDEX_FILE)
const original = fs.readFileSync(indexPath, 'utf8')

const startAt = original.indexOf(START)
const endAt = original.indexOf(END)

if (startAt === -1 || endAt === -1 || endAt < startAt) {
  console.error(`build-guide-toc: FAIL — ${INDEX_FILE} is missing the ${START} / ${END} markers.`)
  console.error('  The contents list is generated between them. Restore both markers, in that order.')
  process.exit(1)
}

// Match the file's own line ending so a CRLF source stays CRLF.
const EOL = original.includes('\r\n') ? '\r\n' : '\n'

const files = chapterFiles()
const list = files.map((name, i) => `${i + 1}. [${chapterTitle(name)}](${name})`).join(EOL)
const body = `${START}${EOL}${EOL}${list}${EOL}${EOL}${END}`

const next = original.slice(0, startAt) + body + original.slice(endAt + END.length)

if (next === original) {
  console.log(`build-guide-toc: OK (${files.length} chapters; contents page already current)`)
} else {
  fs.writeFileSync(indexPath, next)
  console.log(`build-guide-toc: wrote ${files.length} chapters into ${INDEX_FILE}`)
}
