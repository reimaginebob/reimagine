// Determinism + shape tests for src/profile-block.mjs buildUserProfileBlock
// (prompt-caching, 2026-06-06). Wired into prebuild via package.json. The cache
// is a byte-exact prefix cache: if buildUserProfileBlock(sameInput) ever varies
// (object-key ordering, whitespace drift, fallback wording), every call after
// the first silently misses and the whole exercise is wasted. This test fails
// the build if that invariant breaks.

import { buildUserProfileBlock } from '../src/profile-block.mjs'

let failed = 0, total = 0
function assert(label, cond) {
  total++
  if (!cond) { console.error(`FAIL: ${label}`); failed++ }
}

const pr = {
  values: 'integrity, curiosity, building things that last',
  passions: 'mentoring first-gen students',
  rep: { memory: 'calm in chaos', emergency: 'the one people call', twoWords: 'systems thinker', other: 'translates between teams' },
  lifeEvents: 'first-gen college graduate',
  skills: { technical: ['Python', 'SQL'], systems: ['AWS'], certifications: [], languages: ['Spanish'], methodologies: ['Agile'] },
  assessType: 'CliftonStrengths',
  assess: 'Strategic, Learner, Achiever',
}
const outs = {
  p1: 'Resume analysis prose.',
  p2: 'Wiring and compass prose.',
  p3: 'Personal brand prose.',
  p3_structured: {
    throughLine: 'builds clarity from ambiguity',
    dimensionalFit: {
      function: { status: 'strong', read: 'a' }, industry: { status: 'partial', read: 'b' },
      position: { status: 'strong', read: 'c' }, scale: { status: 'partial', read: 'd' },
      pace: { status: 'strong', read: 'e' }, mission: { status: 'partial', read: 'f' },
    },
    topAnchors: [
      { type: 'career', text: 'shipped X' }, { type: 'reputation', text: 'calm in chaos' },
      { type: 'life', text: 'first-gen' }, { type: 'career', text: 'led Y' },
    ],
  },
}

// 1. Determinism: 10 successive calls must be byte-identical.
const ref = buildUserProfileBlock(pr, outs)
let allEqual = true
for (let i = 0; i < 10; i++) if (buildUserProfileBlock(pr, outs) !== ref) allEqual = false
assert('byte-identical across 10 calls', allEqual)

// 2. Independent reconstruction from equal-but-distinct objects matches.
const pr2 = JSON.parse(JSON.stringify(pr))
const outs2 = JSON.parse(JSON.stringify(outs))
assert('identical output for deep-equal distinct inputs', buildUserProfileBlock(pr2, outs2) === ref)

// 3. Canonical markers present, in order.
const markers = [
  'PROFILE: Resume analysis prose.',
  'RAW SIGNALS (this person\'s own words from orientation, do not paraphrase back to them):',
  'VALUES: integrity, curiosity, building things that last',
  'PASSIONS AND CAUSES: mentoring first-gen students',
  'PRAISE THEY RECEIVE: calm in chaos',
  'WHO CALLS THEM IN EMERGENCY: the one people call',
  'HOW PEOPLE DESCRIBE THEIR SUPERPOWER: systems thinker',
  'OTHER REPUTATION DATA: translates between teams',
  'LIFE-SHAPING EXPERIENCES: first-gen college graduate',
  'VALIDATED HARD SKILLS:',
  'ASSESSMENT TYPE: CliftonStrengths',
  'ASSESSMENT NOTES: Strategic, Learner, Achiever',
]
let lastIdx = -1, ordered = true
for (const m of markers) {
  const at = ref.indexOf(m)
  if (at < 0) { assert(`marker present: ${m.slice(0, 30)}`, false); ordered = false }
  else if (at < lastIdx) ordered = false
  if (at >= 0) lastIdx = at
}
assert('markers in canonical order', ordered)

// 4. Embedded helper output present (synthesis + skills).
assert('synthesis through-line embedded', ref.includes('THROUGH-LINE: builds clarity from ambiguity'))
assert('formatSkills technical embedded', ref.includes('Technical: Python, SQL'))

// 5. 'not provided' fallback for missing raw signals (still deterministic).
const bare = { rep: {} }
const refBare = buildUserProfileBlock(bare, {})
assert('bare fallback deterministic', buildUserProfileBlock({ rep: {} }, {}) === refBare)
assert('bare fallback uses not provided', refBare.includes('VALUES: not provided') && refBare.includes('ASSESSMENT NOTES: not provided'))

if (failed) { console.error(`\ntest-profile-block: ${failed}/${total} FAILED`); process.exit(1) }
console.log(`test-profile-block: OK (${total} cases passed)`)
