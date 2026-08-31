// Unit tests for src/star-stories.mjs — the playlist types, the dedupe that
// keeps one experience from becoming three rows, and slot completeness.
import {
  PLAYLIST_TYPES, PLAYLIST_TARGET, STORY_SLOTS, SLOT_LABELS,
  ROUTED_QUESTIONS, orderStories, WEAKNESS_QUESTION, INVENTORY, storyCards, firstPerKind,
  weaknessRecord, hasWeaknessEvidence, numbersIn, storyNumbers, missingNumbers,
  newStoryId, normalizeTitle, sameStory, addStory, coverage, emptySlots, isComplete,
} from '../src/star-stories.mjs'

let passed = 0
const fail = (msg) => { console.error('FAIL: ' + msg); process.exitCode = 1 }
const ok = (cond, msg) => { if (cond) passed++; else fail(msg) }
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} — got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`)

// ── The book's list ──────────────────────────────────────────────────────────

eq(PLAYLIST_TYPES.length, 5, 'five story types — the weakness question is not one of them')
eq(PLAYLIST_TYPES.map(t => t.id), ['achievement', 'authority', 'collaboration', 'strategic', 'ambiguity'], 'in the book\'s order')
ok(!PLAYLIST_TYPES.some(t => t.id === 'setback'), 'no setback story type: a STAR shape asked for a Situation and the model invented one')
ok(PLAYLIST_TYPES.every(t => t.prompt && t.prompt.length > 30), 'every type carries guidance, so an uncovered type is never an empty box')
// The inventory reads as questions, all six of them. Four are Johnny Taylor's
// and two are not; neither the data nor the screen marks that difference,
// because the source is credited once at the top and a question is a question.
ok(PLAYLIST_TYPES.every(t => t.asks), 'every type carries the question it answers')
ok(PLAYLIST_TYPES.every(t => t.asks.trim().endsWith('"')), 'questions are quoted as the interviewer would say them')
ok(PLAYLIST_TYPES.every(t => !t.asksNote), 'no type carries a footnote about a list it is not on')
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
eq(cov.length, 6, 'coverage reports all six questions, weakness included')
eq(cov.filter(c => c.covered).map(c => c.id), ['achievement', 'strategic'], 'only the held kinds are covered')
ok(cov.filter(c => !c.covered).every(c => c.prompt), 'an uncovered type still carries its guidance')
eq(coverage([]).filter(c => c.covered).length, 0, 'an empty library covers nothing')
eq(coverage(null).length, 6, 'no library still reports the six')
// A weakness row with no evidence in it is the state we are steering out of, so
// it must not read as covered just because the row exists.
eq(coverage([{ id: 'w', kind: 'weakness', weakness: { real: '' } }]).find(c => c.id === 'weakness').covered, false,
   'an empty weakness record does not count as covered')
eq(coverage([{ id: 'w', kind: 'weakness', weakness: { real: 'the same drive that…' } }]).find(c => c.id === 'weakness').covered, true,
   'real evidence covers the weakness question')

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

// ── The eight that route elsewhere ──────────────────────────────────────────

eq(ROUTED_QUESTIONS.length, 8, 'the other eight of the twelve')
ok(ROUTED_QUESTIONS.every(q => q.asks && q.where && q.note), 'each names the question, where it is answered, and what it tests')
ok(ROUTED_QUESTIONS.every(q => q.asks.trim().endsWith('"')), 'quoted as the interviewer would say them')
// Six questions in the inventory plus eight routed is the whole foundation the
// screen shows: Taylor's twelve, plus two the book adds that his list does not
// ask. Counted off INVENTORY, not PLAYLIST_TYPES — the weakness question is one
// of the six a person must answer even though it is not a story.
eq(INVENTORY.length + ROUTED_QUESTIONS.length, 14, 'fourteen questions in total')
// Exactly one routed question hands off to My Coach rather than to a screen.
eq(ROUTED_QUESTIONS.filter(q => q.coach).map(q => q.id), ['not-on-resume'], 'the human question is worked out in conversation')
ok(ROUTED_QUESTIONS.filter(q => q.step).every(q => !q.coach), 'a question routes to a screen or to the coach, never both')

// ── Order ──────────────────────────────────────────────────────────────

// The cards must appear in the order the inventory above them lists the
// questions; the seed returns them in whatever order it found them.
const shuffled = [
  { id: 'a', title: 'ambiguity one', kind: 'ambiguity' },
  { id: 'b', title: 'achievement one', kind: 'achievement' },
  { id: 'c', title: 'strategic one', kind: 'strategic' },
  { id: 'd', title: 'achievement two', kind: 'achievement' },
]
eq(orderStories(shuffled).map(x => x.id), ['b', 'd', 'c', 'a'], 'sorted into the playlist order')
eq(orderStories(shuffled).map(x => x.id).slice(0, 2), ['b', 'd'], 'two of one kind keep the order they were added')
eq(orderStories([{ id: 'x', kind: 'nonsense' }, { id: 'y', kind: 'ambiguity' }]).map(x => x.id), ['y', 'x'],
   'an unrecognised kind sorts last rather than disappearing')
eq(orderStories([]).length, 0, 'an empty library orders to empty')
eq(orderStories(null).length, 0, 'no library orders to empty')
eq(orderStories(shuffled).length, shuffled.length, 'ordering never drops a story')
// Ordering must not mutate what the caller holds: the stored array is the save
// order and the render order is a view of it.
const before = shuffled.map(x => x.id)
orderStories(shuffled)
eq(shuffled.map(x => x.id), before, 'the input array is left alone')

// ── The weakness question ───────────────────────────────────────────────────

// Lesson 10 gives this question its own three-part model, and the one time it
// was forced into a STAR card the seed invented a year, a company event and a
// negotiation to hang a genuine assessment finding on.
eq(WEAKNESS_QUESTION.id, 'weakness', 'the weakness question is its own thing')
eq(WEAKNESS_QUESTION.model.map(m => m.key), ['Real', 'Addressed', 'Ongoing'], 'the book\'s three parts, in the book\'s order')
ok(WEAKNESS_QUESTION.coach && /assessment/i.test(WEAKNESS_QUESTION.coach), 'the coach handoff starts from the assessment, as the book says to')
ok(/do not invent/i.test(WEAKNESS_QUESTION.coach), 'and is told not to invent the event')
ok(!('slots' in WEAKNESS_QUESTION), 'it has no STAR slots to fill')

eq(INVENTORY.length, 6, 'six questions on the screen')
eq(INVENTORY.map(t => t.id), ['achievement', 'weakness', 'authority', 'collaboration', 'strategic', 'ambiguity'],
   'the weakness question sits second, where an interviewer asks it')
ok(INVENTORY.every(t => t.asks && t.asks.trim().endsWith('"')), 'every row reads as a question')

eq(weaknessRecord([s1, { id: 'w', kind: 'weakness' }]).id, 'w', 'the weakness record is found by kind')
eq(weaknessRecord([s1, s2]), null, 'no weakness record is null rather than undefined')
eq(hasWeaknessEvidence([{ kind: 'weakness', weakness: { real: '   ' } }]), false, 'whitespace is not evidence')
eq(hasWeaknessEvidence([{ kind: 'weakness' }]), false, 'a record with no weakness object is not evidence')
eq(hasWeaknessEvidence([]), false, 'nothing stored is not evidence')

// ── What renders as a story card ────────────────────────────────────────────

// Both of these are in the database and neither belongs among the story cards:
// the weakness record is not a story, and a legacy setback row is the fabricated
// card this split exists to stop showing.
const mixed = [
  { id: 'w', kind: 'weakness', weakness: { real: 'x' } },
  { id: 'old', kind: 'setback', title: 'When protecting people cost you capital' },
  { id: 'a', kind: 'achievement', title: 'Toronto' },
]
eq(storyCards(mixed).map(x => x.id), ['a'], 'only real story kinds render as cards')
eq(storyCards([]).length, 0, 'an empty library renders no cards')
eq(storyCards(null).length, 0, 'no library renders no cards')

// ── One story per kind ──────────────────────────────────────────────────────

// The real failure: four setback stories in one seed, two pairs each describing
// one event in words with no distinctive token in common, so no title-based
// dedupe could ever have caught them.
const fourSetbacks = [
  { id: '1', kind: 'setback', title: 'When protecting people cost you capital' },
  { id: '2', kind: 'setback', title: 'Choosing when to leave Continental' },
  { id: '3', kind: 'setback', title: 'The department elimination in the Beacon acquisition' },
  { id: '4', kind: 'setback', title: 'Being protective of people at a cost' },
  { id: '5', kind: 'achievement', title: 'Toronto' },
]
ok(!sameStory(fourSetbacks[0].title, fourSetbacks[3].title), 'the title dedupe genuinely cannot see this pair')
ok(!sameStory(fourSetbacks[1].title, fourSetbacks[2].title), 'nor this one')
eq(firstPerKind(fourSetbacks).map(x => x.id), ['1', '5'], 'one per kind survives, the first of each')
eq(firstPerKind([]).length, 0, 'empty stays empty')
eq(firstPerKind(null).length, 0, 'no input stays empty')
eq(firstPerKind([{ id: 'a' }, { id: 'b', kind: 'achievement' }]).map(x => x.id), ['b'], 'a row with no kind is dropped')

// ── Numbers survive a correction ────────────────────────────────────────────

// "Does this feel right?" hands a note to a model and takes back a rewrite. The
// prompt says the correction wins; this is what checks that it did.
eq([...numbersIn('the Result is wrong, it was 40% not 15%')], ['40', '15'], 'both figures are read out of the note')
eq([...numbersIn('part 1 is wrong')], [], 'a bare single digit is not a figure')
eq([...numbersIn('it was 5% not 3%')], ['5', '3'], 'a single digit with a marker is')
eq([...numbersIn('76 employees, 1,200 hours, $4M saved, 3x throughput')], ['76', '1200', '4', '3'],
   'commas normalise away and markers keep short numbers')
eq([...numbersIn('')], [], 'empty text has no numbers')
eq([...numbersIn(null)], [], 'no text has no numbers')

const wasFifteen = { slots: { R: { text: 'Placements rose 15%.' } } }
const stillFifteen = { slots: { R: { text: 'Placements rose 15%.' } } }
const nowForty = { slots: { R: { text: 'Placements rose 40%.' } } }

eq(missingNumbers('it was 40% not 15%', wasFifteen, stillFifteen), ['40'],
   'a figure the model ignored is reported')
eq(missingNumbers('it was 40% not 15%', wasFifteen, nowForty), [],
   'a figure the model applied is not')
// The figure being replaced is supposed to vanish. Reporting it would be exactly
// backwards, so anything already in the story before the rewrite is excluded.
eq(missingNumbers('drop the 15% figure', wasFifteen, { slots: { R: { text: 'Placements rose.' } } }), [],
   'asking for a number to be removed never warns')
eq(missingNumbers('the 2017 date is wrong, it was 2019',
   { slots: { S: { text: 'In 2017 the team...' } } },
   { slots: { S: { text: 'In 2019 the team...' } } }), [], 'a corrected year is not reported missing')
eq(missingNumbers('make the tone warmer', wasFifteen, nowForty), [], 'a note with no figures never warns')

// Numbers are counted across the whole story, not just the slot they landed in:
// a Result figure often gets restated in the title or the why.
eq([...storyNumbers({ title: '76% placement', why: 'covers scale', slots: { R: { text: 'up 40%' } } })].sort(),
   ['40', '76'], 'title, why and slots are all read')
eq([...storyNumbers({ slots: { R: 'plain string slot, 40%' } })], ['40'], 'a string-shaped slot is read too')
eq([...storyNumbers(null)], [], 'no story has no numbers')

console.log(`test-star-stories: OK (${passed} cases passed)`)
