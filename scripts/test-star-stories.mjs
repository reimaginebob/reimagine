// Unit tests for src/star-stories.mjs — the playlist types, the dedupe that
// keeps one experience from becoming three rows, and slot completeness.
import {
  PLAYLIST_TYPES, PLAYLIST_TARGET, STORY_SLOTS, SLOT_LABELS,
  newStoryId, normalizeTitle, sameStory, addStory, coverage, emptySlots, isComplete,
} from '../src/star-stories.mjs'

let passed = 0
const fail = (msg) => { console.error('FAIL: ' + msg); process.exitCode = 1 }
const ok = (cond, msg) => { if (cond) passed++; else fail(msg) }
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} — got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`)

// ── The book's list ──────────────────────────────────────────────────────────

eq(PLAYLIST_TYPES.length, 6, 'the six playlist types from Lesson 10')
eq(PLAYLIST_TYPES.map(t => t.id), ['achievement', 'setback', 'authority', 'collaboration', 'strategic', 'ambiguity'], 'in the book\'s order')
ok(PLAYLIST_TYPES.every(t => t.prompt && t.prompt.length > 30), 'every type carries guidance, so an uncovered type is never an empty box')
// The inventory reads as questions. Four of the six map to one of Johnny
// Taylor's twelve; the other two are asked inside a bigger question and say so
// rather than having a question invented for them.
ok(PLAYLIST_TYPES.filter(t => t.asks).length === 4, 'four of the six carry a real interview question')
ok(PLAYLIST_TYPES.every(t => t.asks || t.asksNote), 'a type with no question of its own explains where it does get asked')
ok(PLAYLIST_TYPES.filter(t => t.asks).every(t => t.asks.trim().endsWith('"')), 'questions are quoted as the interviewer would say them')
eq(PLAYLIST_TARGET, 12, 'roughly twelve, per the Playlist Principle')
// Reimagine's one change to STAR is load-bearing and must not drift back.
eq(SLOT_LABELS.T, 'Thought Process', 'T is Thought Process, never Task')
eq(STORY_SLOTS, ['S', 'T', 'A', 'R'], 'four slots in order')

// ── Ids ──────────────────────────────────────────────────────────────────────

ok(/^st_[a-z0-9]+_[a-z0-9]+$/.test(newStoryId()), 'ids are prefixed and shaped like the other client ids')
ok(newStoryId() !== newStoryId(), 'ids do not collide back to back')

// ── Titles ───────────────────────────────────────────────────────────────────

eq(normalizeTitle('  Toronto Acquisition, Integration!  '), 'toronto acquisition integration', 'punctuation and case normalize away')
eq(normalizeTitle(''), '', 'empty stays empty')

// The real case: one rebuild produced both of these for one event.
ok(sameStory('Toronto acquisition integration under the Managing Partner\'s direction',
             'Toronto acquisition, building trust with a skeptical acquired team') === false,
   'two genuinely different angles on one event are NOT merged blindly')
ok(sameStory('Toronto acquisition integration', 'The Toronto acquisition integration'),
   'a leading article does not make a new story')
ok(sameStory('Toronto acquisition', 'Toronto acquisition integration under the Managing Partner'),
   'a restatement that adds words is the same story')
ok(!sameStory('Toronto acquisition', 'MetricStream claims restructure'), 'different experiences stay separate')
ok(!sameStory('', 'Toronto acquisition'), 'a blank title matches nothing')
ok(!sameStory('Toronto', 'Toronto acquisition integration'), 'a single shared word is not enough to merge')

// ── Adding ───────────────────────────────────────────────────────────────────

const s1 = { id: 'st_1', title: 'Toronto acquisition integration', kind: 'achievement' }
const s2 = { id: 'st_2', title: 'MetricStream claims restructure', kind: 'strategic' }
eq(addStory([], s1).length, 1, 'first story lands')
eq(addStory([s1], s2).length, 2, 'a different story lands')
eq(addStory([s1], { id: 'st_3', title: 'The Toronto acquisition integration' }).length, 1, 'a restatement does not duplicate')
eq(addStory([s1], { id: 'st_4', title: '   ' }).length, 1, 'a blank title is refused')
eq(addStory(null, s1).length, 1, 'a missing library is treated as empty')

// ── Coverage ─────────────────────────────────────────────────────────────────

const cov = coverage([s1, s2])
eq(cov.length, 6, 'coverage always reports all six')
eq(cov.filter(c => c.covered).map(c => c.id), ['achievement', 'strategic'], 'only the held kinds are covered')
ok(cov.filter(c => !c.covered).every(c => c.prompt), 'an uncovered type still carries its guidance')
eq(coverage([]).filter(c => c.covered).length, 0, 'an empty library covers nothing')
eq(coverage(null).length, 6, 'no library still reports the six')

// ── Slots ────────────────────────────────────────────────────────────────────

const full = { slots: { S: 'situation', T: 'thinking', A: 'action', R: 'result' } }
const partial = { slots: { S: 'situation', T: '', A: 'action', R: '   ' } }
eq(emptySlots(full), [], 'a complete story has no empty slots')
eq(emptySlots(partial), ['T', 'R'], 'blank and whitespace-only slots both count as empty')
eq(emptySlots({}), ['S', 'T', 'A', 'R'], 'a story with no slots is entirely open')
eq(emptySlots(null), ['S', 'T', 'A', 'R'], 'no story is entirely open')
ok(isComplete(full), 'complete is complete')
ok(!isComplete(partial), 'partial is not')
// Slots may be objects carrying their own to_strengthen, as the prep produces.
eq(emptySlots({ slots: { S: { text: 'x' }, T: { text: '' }, A: { text: 'y' }, R: { text: 'z' } } }), ['T'],
   'object-shaped slots are read for their text')

console.log(`test-star-stories: OK (${passed} cases passed)`)
