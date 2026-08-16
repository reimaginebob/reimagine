// Prebuild gate: user-guide cross-references must not depend on chapter numbers,
// and every chapter link must resolve.
//
// Why. Chapter numbers are DERIVED from position in src/data/user-guide/ORDER.json,
// not stored in filenames, so inserting a chapter re-flows every number after it.
// That is only safe while prose cites chapters by NAME. A single "Chapter 12"
// left in the text silently becomes wrong the first time a chapter is inserted
// above it — and a wrong pointer in the guide is also a wrong pointer in My Coach,
// which is fed this corpus verbatim.
//
// Two checks:
//   1. No "Chapter <number>" anywhere in chapter prose or the contents page.
//   2. Every relative .md link points at a file that actually exists.
//
// Fix for (1): name the chapter — "Refining and Regenerating covers this",
// not "Chapter 12 covers this".
import fs from 'fs'
import path from 'path'
import { CHAPTERS_DIR, chapterFiles, INDEX_FILE } from './lib/user-guide-order.mjs'

const NUMBERED_REF = /\bChapters?\s+\d+[a-e]?\b/g
// Relative markdown links to a sibling .md file: [text](some-file.md) or (some-file.md#anchor)
const MD_LINK = /\]\(\s*(?!https?:|mailto:|#)([^)\s#]+\.md)(#[^)\s]*)?\s*\)/g

const files = [...chapterFiles(), INDEX_FILE]
const numbered = []
const broken = []

for (const name of files) {
  const p = path.join(CHAPTERS_DIR, name)
  if (!fs.existsSync(p)) continue
  const text = fs.readFileSync(p, 'utf8')

  text.split(/\r?\n/).forEach((line, i) => {
    for (const m of line.matchAll(NUMBERED_REF)) {
      numbered.push({ name, line: i + 1, hit: m[0], context: line.trim().slice(0, 100) })
    }
    for (const m of line.matchAll(MD_LINK)) {
      const target = m[1]
      if (!fs.existsSync(path.join(CHAPTERS_DIR, target))) {
        broken.push({ name, line: i + 1, target })
      }
    }
  })
}

let failed = false

if (numbered.length) {
  failed = true
  console.error(`check-guide-refs: FAIL — ${numbered.length} numbered chapter reference(s).`)
  console.error('  Chapter numbers are generated from ORDER.json position and shift when a')
  console.error('  chapter is inserted. Cite the chapter by name instead.')
  for (const r of numbered) console.error(`    ${r.name}:${r.line}  "${r.hit}"  — ${r.context}`)
}

if (broken.length) {
  failed = true
  console.error(`check-guide-refs: FAIL — ${broken.length} broken chapter link(s).`)
  for (const r of broken) console.error(`    ${r.name}:${r.line}  ->  ${r.target}  (no such file)`)
}

if (failed) process.exit(1)

console.log(`check-guide-refs: OK (${files.length} files; no numbered references, all chapter links resolve)`)
