// Guards finding #3.1 from the 2026-09-07 My Coach diagnostic review:
// session-open, orientation-check, and post-capture turns stored an internal
// instruction as chat_messages.message with no marker distinguishing them
// from a real typed question. api/admin/classify-coach.js fed that text to
// the taxonomy tagger as a "USER QUESTION", and api/admin/coach-insights.js
// counted every row toward the coaching-vs-navigation read -- both computed
// over rows that are not questions.
//
// BEHAVIORAL for computeTurnKind (per finding #5.1): imports api/coach.js
// with dummy env vars and calls the real function. The three call sites this
// feeds (the INSERT, classify-coach.js's SELECT, coach-insights.js's six
// WHERE clauses) are source-checked, since exercising them needs a live DB.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

process.env.DATABASE_URL ||= 'postgres://user:pass@localhost/dummy'
process.env.RESEND_API_KEY ||= 'dummy'
process.env.ANTHROPIC_API_KEY ||= 'dummy'

const { computeTurnKind } = await import('../api/coach.js')

// A real typed message is always 'user', even when one of the other three
// shapes is also (implausibly) flagged requested on the same turn -- the
// precedence has to match `message`'s own, or the two columns tell
// different stories about the same row.
check(computeTurnKind('How should I frame my last role?', {}) === 'user',
  'a real typed message should be user')
check(computeTurnKind('Tell me more', { orientationCheckRequested: true, postCaptureUpdateRequested: true, sessionOpenRequested: true }) === 'user',
  'a real typed message must win over every other requested flag')

// No typed message: each flag maps to its own kind, checked in the same
// precedence order the message ternary uses.
check(computeTurnKind('', { orientationCheckRequested: true }) === 'orientation_check',
  'orientationCheckRequested with no typed message should be orientation_check')
check(computeTurnKind(null, { orientationCheckRequested: true, postCaptureUpdateRequested: true }) === 'orientation_check',
  'orientationCheckRequested should win over postCaptureUpdateRequested')
check(computeTurnKind(undefined, { postCaptureUpdateRequested: true }) === 'post_capture',
  'postCaptureUpdateRequested with no typed message should be post_capture')
check(computeTurnKind('', { postCaptureUpdateRequested: true, momentRequested: true, sessionOpenRequested: true }) === 'post_capture',
  'postCaptureUpdateRequested should win over momentRequested and sessionOpenRequested')
// momentRequested (Phase 2b): a Choice/Delivery reaction on Career Paths,
// same precedence slot as the other silent-turn shapes -- after
// orientation-check/post-capture, before session-open.
check(computeTurnKind('', { momentRequested: true }) === 'moment',
  'momentRequested with no typed message should be moment')
check(computeTurnKind(null, { orientationCheckRequested: true, momentRequested: true }) === 'orientation_check',
  'orientationCheckRequested should win over momentRequested')
check(computeTurnKind('', { momentRequested: true, sessionOpenRequested: true }) === 'moment',
  'momentRequested should win over sessionOpenRequested')
check(computeTurnKind('', { sessionOpenRequested: true }) === 'session_open',
  'sessionOpenRequested alone with no typed message should be session_open')

// Whitespace-only typed text does not count as a real message (matches the
// `message` ternary's own .trim() check).
check(computeTurnKind('   ', { sessionOpenRequested: true }) === 'session_open',
  'whitespace-only rawMessage should not be treated as a real typed message')

// Nothing requested and no message: the edge the early-return guards in the
// handler are meant to prevent from ever reaching this function. Defaults
// to 'user' rather than throwing or returning an unrecognized kind.
check(computeTurnKind('', {}) === 'user',
  'the no-flags-no-message edge should default to user, not throw or return an unrecognized kind')

// The handler wires turnKind (and the account's feature_flags snapshot) into
// the same INSERT that writes message/reply, and computeTurnKind is called
// with the same flags the message ternary itself reads (momentRequested
// added Phase 2b, alongside the original three).
const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')
check(coach.includes('const turnKind = computeTurnKind(rawMessage, { orientationCheckRequested, postCaptureUpdateRequested, momentRequested, sessionOpenRequested })'),
  `${COACH}: turnKind is no longer computed via computeTurnKind with the same flags the message ternary reads`)
check(coach.includes('turn_kind, feature_flags_snapshot') && coach.includes('${turnKind}, ${JSON.stringify(featureFlags)}::jsonb'),
  `${COACH}: the chat_messages INSERT no longer carries turn_kind and a feature_flags snapshot`)

// The migration adds both columns, forward-only (no backfill -- matches the
// coach_message_tags precedent).
const MIGRATION = 'migrations/2026-09-08_coach-turn-kind.sql'
check(fs.existsSync(MIGRATION), `${MIGRATION}: migration file is missing`)
if (fs.existsSync(MIGRATION)) {
  const mig = fs.readFileSync(MIGRATION, 'utf8')
  check(mig.includes('ADD COLUMN IF NOT EXISTS turn_kind text'),
    `${MIGRATION}: turn_kind column is not added`)
  check(mig.includes('ADD COLUMN IF NOT EXISTS feature_flags_snapshot jsonb'),
    `${MIGRATION}: feature_flags_snapshot column is not added`)
}

// classify-coach.js excludes non-user turn_kind rows from the rows it feeds
// to the model as a "USER QUESTION".
const CLASSIFY = 'api/admin/classify-coach.js'
const classify = fs.readFileSync(CLASSIFY, 'utf8')
check(classify.includes("AND (c.turn_kind IS NULL OR c.turn_kind = 'user')"),
  `${CLASSIFY}: the classifier's SELECT no longer excludes non-user turn_kind rows`)

// coach-insights.js excludes non-user turn_kind rows from every one of its
// six chat_messages queries (totals, distribution, feature breakdown,
// answer-quality, rated-exchanges, unmet-questions).
const INSIGHTS = 'api/admin/coach-insights.js'
const insights = fs.readFileSync(INSIGHTS, 'utf8')
const insightsOccurrences = (insights.match(/AND \(c\.turn_kind IS NULL OR c\.turn_kind = 'user'\)/g) || []).length
check(insightsOccurrences === 6,
  `${INSIGHTS}: expected the turn_kind exclusion on all 6 chat_messages queries -- found ${insightsOccurrences}`)

if (failures) {
  console.error(`test-coach-turn-kind: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-turn-kind: OK (computeTurnKind matches the message ternary\'s own precedence, the INSERT carries turn_kind + a feature_flags snapshot, the migration adds both columns with no backfill, and both admin surfaces exclude non-user turns)')
}
