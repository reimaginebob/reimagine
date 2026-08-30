// check-track-leaks — job-seeker language that can reach the practice track.
//
// WHY THIS EXISTS. PR #544 audited "every string the practice track renders"
// and four leaks survived it, one on the Personal Brand screen, which is the
// first thing someone on that track reads after Orientation.
//
// That audit walked the screens the track OWNS. It never reached the ones the
// track SHARES. Personal Brand renders on both tracks. Resume Refresh and
// Interview Prep render on both, under different names — Your One-Sheet and
// Discovery Call & Pitch Prep. Walking the track's own sections does not take
// you inside a section it inherited.
//
// The subtlest case, and the reason a scan beats a reading: a string that
// ALREADY has an isIndependent branch on part of it. The Personal Brand
// sentence branched its opening clause and left "tell me about yourself" and
// "the resume and LinkedIn that match where you are headed" outside the
// ternary. Skimming for unbranched strings marks that line as handled.
//
// So this strips the branch and reads what is LEFT — the text both tracks get.
//
// WHAT IT SCANS, AND WHY NOT EVERYTHING. The first version read src/App.jsx
// alone, which was wrong: PR #601 had already fixed "Focus Playbooks",
// "Explore More Roles" and "your collection of role-strategy work" by hand in
// src/components/SavedPlaybooks.jsx, and an App.jsx-only scan finds none of
// them. A detector that misses leaks already found by hand manufactures
// confidence, which is worse than having no detector.
//
// It still does not read everything under src/. Three kinds of file are
// excluded on purpose, because their job-search vocabulary is CORRECT:
//
//   src/data/user-guide/**   documentation. The Interview Prep chapter is
//                            supposed to say "interview".
//   src/data/*knowledge*     My Coach's teaching material, which discusses
//                            hiring and recruiters as subject matter.
//   src/voice-patterns.mjs   the banned-phrase list itself.
//   src/coach-routing.js     instructions to a model, not copy a person reads.
//
// Including them would bury four real hits under hundreds of correct ones, and
// a report nobody reads is the same as no report.
//
// Not a build gate. It reports candidates for a human to judge: the job-search
// track really does talk about postings, and the Interview Team really is about
// interviewers. Run it when touching track copy:
//
//   npm run check:track-leaks

import { readFileSync, readdirSync, statSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, relative } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'src')

const EXCLUDE = [
  /[\\/]data[\\/]/,
  /voice-patterns\.mjs$/,
  /coach-routing\.js$/,
  /coach-nav-map\.js$/,
]

function uiFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) { uiFiles(full, out); continue }
    if (!/\.(jsx?|mjs)$/.test(name)) continue
    if (EXCLUDE.some(rx => rx.test(full))) continue
    out.push(full)
  }
  return out
}

const TERMS = [
  'tell me about yourself', 'job search', 'job description', 'job posting',
  'hiring manager', 'interviewer', 'interview', 'recruiter', 'employer',
  'candidate', 'the posting', 'applying', 'where you are headed',
  'job conversation', 'cover letter', 'get hired', 'hire you', 'a job',
  'applicant tracking', 'role-strategy', 'explore more roles', 'focus playbook',
]

// Markers of a rendered string rather than a prompt or a comment. Prompt text
// is SUPPOSED to say "hiring manager"; it is instruction to a model, not copy.
const UI = /S\.sub|S\.title|S\.label|S\.note|S\.helperText|CoachingCallout|placeholder=|<h1|<h2|<h3|<Btn|label:|<p style|heading=|addLabel=|emptyCopy=|>[A-Z][a-z]/

// Remove both branch forms, leaving only what BOTH tracks read. `independent`
// is the prop name the same flag travels under inside src/components.
const sharedText = (line) => line
  .replace(/(?:is)?[Ii]ndependent\s*\?\s*(['"`])(?:\\.|(?!\1)[\s\S])*?\1\s*:\s*(['"`])(?:\\.|(?!\2)[\s\S])*?\2/g, ' <BRANCHED> ')
  .replace(/!(?:is)?[Ii]ndependent\s*&&[\s\S]*$/g, ' <JOB-TRACK-ONLY> ')

const hits = []
for (const file of uiFiles(srcDir)) {
  const rel = relative(root, file).replace(/\\/g, '/')
  readFileSync(file, 'utf8').split('\n').forEach((raw, i) => {
    const line = raw.trim()
    if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) return
    if (!UI.test(raw)) return
    const shared = sharedText(raw)
    const found = TERMS.filter(t =>
      new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(shared))
    if (found.length) {
      hits.push({ file: rel, n: i + 1, partial: /[Ii]ndependent/.test(raw), found, line: line.slice(0, 140) })
    }
  })
}

const partial = hits.filter(h => h.partial)
const plain = hits.filter(h => !h.partial)

if (partial.length) {
  console.log(`\nPARTIALLY BRANCHED (${partial.length}) — the line knows about the track, but these words sit outside the branch:`)
  for (const h of partial) console.log(`  ${h.file}:${h.n}  [${h.found.join(', ')}]\n      ${h.line}`)
}
console.log(`\nSHARED BY BOTH TRACKS (${plain.length}) — judge each: some are correctly job-search-only screens.`)
for (const h of plain) console.log(`  ${h.file}:${h.n}  [${h.found.join(', ')}]\n      ${h.line}`)

const files = new Set(hits.map(h => h.file))
console.log(`\ncheck-track-leaks: ${hits.length} candidates across ${files.size} file(s) (${partial.length} partially branched).`)
console.log('Report only; nothing fails here.')
