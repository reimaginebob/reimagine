// Records the current chapter-source hash next to the PDF it was built from.
// Runs right after the Python PDF build (see the build:user-guide-pdf npm
// script), so the recorded hash and the committed PDF always move together.
import fs from 'fs'
import { computeSourceHash, HASH_FILE, chapterFiles } from './lib/user-guide-hash.mjs'

const hash = computeSourceHash()
fs.writeFileSync(HASH_FILE, hash + '\n')
console.log(
  `write-user-guide-hash: recorded ${hash.slice(0, 12)}… for ${chapterFiles().length} chapters`,
)
