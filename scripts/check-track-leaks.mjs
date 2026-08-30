// check-track-leaks — job-seeker language that can reach the practice track.
//
// WHY THIS EXISTS. PR #544 audited "every string the practice track renders"
// and four leaks survived it, one of them on the Personal Brand screen, which
// is the first thing someone on that track reads after Orientation.
//
// The audit walked the screens the track OWNS. It never reached the ones the
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
// Not a build gate. It reports candidates for a human to judge: some hits are
// correct (Interview Team really is about interviewers, and the job-search
// track really does talk about postings). Run it when touching track copy:
//
//   npm run check:track-leaks

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const lines = readFileSync(join(root, 'src', 'App.jsx'), 'utf8').split('\n')

const TERMS = [
  'tell me about yourself', 'job search', 'job description', 'job posting',
  'hiring manager', 'interviewer', 'interview', 'recruiter', 'employer',
  'candidate', 'the posting', 'applying', 'where you are headed',
  'job conversation', 'cover letter', 'get hired', 'hire you', 'a job',
  'applicant tracking',
]

// Markers of a rendered string rather than a prompt or a comment. Prompt text
// is SUPPOSED to say "hiring manager"; it is instruction to a model, not copy.
const UI = /S\.sub|S\.title|S\.label|S\.note|S\.helperText|CoachingCallout|placeholder=|<h1|<h2|<h3|<Btn|label:|<p style/

// Remove both branch forms, leaving only what BOTH tracks read.
const sharedText = (line) => line
  .replace(/isIndependent\s*\?\s*(['"`])(?:\\.|(?!\1)[\s\S])*?\1\s*:\s*(['"`])(?:\\.|(?!\2)[\s\S])*?\2/g, ' <BRANCHED> ')
  .replace(/!isIndependent\s*&&[\s\S]*$/g, ' <JOB-TRACK-ONLY> ')

const hits = []
lines.forEach((raw, i) => {
  const line = raw.trim()
  if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) return
  if (!UI.test(raw)) return
  const shared = sharedText(raw)
  const found = TERMS.filter(t =>
    new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(shared))
  if (found.length) hits.push({ n: i + 1, partial: /isIndependent/.test(raw), found, line: line.slice(0, 150) })
})

const partial = hits.filter(h => h.partial)
const plain = hits.filter(h => !h.partial)

if (partial.length) {
  console.log(`\nPARTIALLY BRANCHED (${partial.length}) — the line knows about the track, but these words sit outside the branch:`)
  for (const h of partial) console.log(`  src/App.jsx:${h.n}  [${h.found.join(', ')}]\n      ${h.line}`)
}
console.log(`\nSHARED BY BOTH TRACKS (${plain.length}) — judge each: some are correctly job-search-only screens.`)
for (const h of plain) console.log(`  src/App.jsx:${h.n}  [${h.found.join(', ')}]\n      ${h.line}`)

console.log(`\ncheck-track-leaks: ${hits.length} candidates (${partial.length} partially branched). Report only; nothing fails here.`)
