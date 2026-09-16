// OARS listening + follow-the-person's-lead brief (2026-09-16, Bob's chat
// decision with Cowork). Builds the REAL prompt through buildCoachRequest
// (api/coach.js) -- the same function the live handler calls -- rather than
// re-deriving a stand-in, so this catches a placement mistake the way a
// source-text regex over the raw file cannot (whether the new sections
// actually land in the assembled `system` array, in the right block, ahead
// of DISCOURAGEMENT, for both a pre-brand and a post-brand account).
//
// Importing api/coach.js pulls in two module-scope service clients that
// construct eagerly (neon() for Postgres, new Resend() for email) and throw
// at import time if their env vars are missing entirely -- neither is ever
// actually called by buildCoachRequest itself (no DB read, no email sent),
// so DATABASE_URL and RESEND_API_KEY only need to be present and
// well-formed, not real or reachable (same finding eval-interview-capture-
// live.mjs's own header comment documents). Set here, before the dynamic
// import, so this test is self-contained regardless of the ambient
// environment's env vars -- this file has to survive in `npm test`, which
// runs in CI/build contexts that don't carry real credentials.
process.env.DATABASE_URL ||= 'postgresql://fake:fake@fake.neon.tech/fake?sslmode=require'
process.env.RESEND_API_KEY ||= 're_fake_1234567890'

const { buildCoachRequest } = await import('../api/coach.js')
const { WIDEN_SEARCH_ROW_KEYS } = await import('../src/coach-moments.js')
const { detectVoiceViolations } = await import('../src/voice-patterns.js')

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const baseProfile = {
  profile: {
    values: 'Directness; building things that last',
    passions: 'Mentoring early-career professionals',
    resume: '15 years in operations leadership.',
    rep: { memory: '', emergency: '', twoWords: '' },
    assessType: '', assess: '',
  },
  outputs: {},
  selectedLane: '',
  chosen: '',
  done: [],
  savedPlaybooks: [],
}

const preBrandProfile = { ...baseProfile, done: [] }
const postBrandProfile = {
  ...baseProfile,
  done: ['p1', 'p2', 'p3'],
  outputs: { p3: 'Golden Thread: translates operational chaos into durable systems.' },
  chosen: 'Director of Operations',
}

function buildFor(profileState) {
  return buildCoachRequest({
    history: [],
    message: 'what should I focus on this week',
    currentStep: 'myCoach',
    surface: 'help',
    returnSection: null,
    focusRecordId: null,
    situation: null,
    profileState,
    employmentStatus: 'in_transition',
    featureFlags: [],
    pursuitRows: [],
    searchIntake: null,
    userEmail: 'test@example.com',
    track: null,
    activityFacts: [],
    priorSessionAt: null,
    sessionOpenRequested: false,
    generalMode: false,
    milestoneMentions: [],
    closeReasons: [],
    turnKind: 'user',
    tzOffsetMinutes: 0,
  })
}

function fullText({ system }) {
  return system.map(b => b.text).join('\n\n')
}

const preBrandText = fullText(buildFor(preBrandProfile))
const postBrandText = fullText(buildFor(postBrandProfile))

// --- Both new sections land in the real prompt, for both profile states ---

for (const [label, text] of [['pre-brand', preBrandText], ['post-brand', postBrandText]]) {
  check(text.includes('HOW YOU LISTEN (OARS)'), `${label}: HOW YOU LISTEN (OARS) is missing from the built prompt`)
  check(text.includes(`FOLLOW THE PERSON'S LEAD`), `${label}: FOLLOW THE PERSON'S LEAD is missing from the built prompt`)
  const oarsIdx = text.indexOf('HOW YOU LISTEN (OARS)')
  const leadIdx = text.indexOf(`FOLLOW THE PERSON'S LEAD`)
  const discouragementIdx = text.indexOf('DISCOURAGEMENT. When someone is worn down')
  check(discouragementIdx !== -1, `${label}: DISCOURAGEMENT block is missing from the built prompt`)
  check(oarsIdx !== -1 && oarsIdx < discouragementIdx, `${label}: HOW YOU LISTEN (OARS) does not land before DISCOURAGEMENT`)
  check(leadIdx !== -1 && leadIdx < discouragementIdx, `${label}: FOLLOW THE PERSON'S LEAD does not land before DISCOURAGEMENT`)
  check(oarsIdx !== -1 && leadIdx !== -1 && oarsIdx < leadIdx, `${label}: HOW YOU LISTEN (OARS) does not land before FOLLOW THE PERSON'S LEAD`)

  // --- The retired orientation-only rule never appears, in either profile state ---
  check(!text.includes('ORIENTATION LISTENING MODE'), `${label}: the retired ORIENTATION LISTENING MODE note still appears in the built prompt`)
}

// --- The widen note carries every current row key ---

check(Array.isArray(WIDEN_SEARCH_ROW_KEYS) && WIDEN_SEARCH_ROW_KEYS.length > 0,
  'WIDEN_SEARCH_ROW_KEYS is empty or not an array -- nothing to check the note against')
for (const key of WIDEN_SEARCH_ROW_KEYS) {
  check(postBrandText.includes(key), `the widen-the-search hint note is missing row key '${key}' -- WIDEN_SEARCH_ROW_KEYS and the note have drifted apart`)
}
check(postBrandText.includes('WIDEN THE SEARCH:'), 'the widen-the-search hint note itself is missing from the built prompt')

// --- Voice: the two new instructional sections read clean ---

const oarsStart = postBrandText.indexOf('HOW YOU LISTEN (OARS)')
const oarsEnd = postBrandText.indexOf('DISCOURAGEMENT. When someone is worn down')
const insertedText = postBrandText.slice(oarsStart, oarsEnd)

check(insertedText.length > 0, 'could not isolate the inserted HOW YOU LISTEN / FOLLOW THE PERSON\'S LEAD text for the voice check')
const violations = detectVoiceViolations(insertedText)
check(violations.length === 0, `detectVoiceViolations found ${violations.length} violation(s) in the inserted text: ${violations.map(v => v.name).join(', ')}`)
check(!insertedText.includes('—'), 'the inserted text contains an em dash')
check(!/not\s+[a-z][^.?!]*?,?\s+it'?s\s+/i.test(insertedText), 'the inserted text contains a "not X, it\'s Y" logic-flip shape')

if (failures) {
  console.error(`test-coach-listening-prompt: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-listening-prompt: OK (HOW YOU LISTEN (OARS) and FOLLOW THE PERSON\'S LEAD land ahead of DISCOURAGEMENT in the real built prompt for both pre-brand and post-brand accounts, the retired ORIENTATION LISTENING MODE note is gone, the widen-the-search hint note carries every current WIDEN_SEARCH_ROW_KEYS key, and the inserted text is voice-clean)')
}
