// Shared hashing for the user-guide PDF staleness gate.
//
// The downloadable PDF (public/reimagine-user-guide.pdf) is built by the Python
// script from the SAME chapters the in-app guide uses. The in-app guide is
// regenerated every build (prebuild -> build-user-guide.mjs); the PDF is not.
// To stop the PDF from silently drifting, we hash the chapter sources here and
// record that hash when the PDF is generated; the prebuild check re-hashes and
// compares. Both writer and checker use THIS function so they can never disagree.
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const REPO_ROOT = path.resolve(__dirname, '..', '..')
export const CHAPTERS_DIR = path.join(REPO_ROOT, 'src', 'data', 'user-guide')
// Co-located with the source; not a *.md file, so neither the PDF builder's
// glob nor chapterFiles() below ever picks it up as a chapter.
export const HASH_FILE = path.join(CHAPTERS_DIR, 'PDF-SOURCE.hash')

// Enumerate chapters exactly as build-user-guide-pdf.py does: every *.md except
// index.md, sorted by filename.
export function chapterFiles() {
  return fs
    .readdirSync(CHAPTERS_DIR)
    .filter((n) => n.endsWith('.md') && n !== 'index.md')
    .sort()
}

// Deterministic content hash over chapter name + content. CRLF is normalized to
// LF so a line-ending flip alone never trips the gate.
export function computeSourceHash() {
  const h = crypto.createHash('sha256')
  for (const name of chapterFiles()) {
    const text = fs.readFileSync(path.join(CHAPTERS_DIR, name), 'utf8').replace(/\r\n/g, '\n')
    h.update(name + '\0' + text + '\0')
  }
  return h.digest('hex')
}
