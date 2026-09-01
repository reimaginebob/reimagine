// Node test for src/job-search-resources.mjs. Run: node scripts/test-job-search-resources.mjs
//
// The two tests that matter most are the date rule and the TALK ranking case.
// Both encode findings from the live-search feasibility work in
// docs/networking-groups-brief.md; if either starts failing, the feature has
// regressed to the behaviour that made it not worth shipping.

import {
  CAREER_CLUB_CORNER, meetupCitySlug, meetupUrl, jobSearchGroupSearchUrl,
  hasAssertedDate, stripAssertedDate, normalizeResource, splitResources,
  resourceScore, rankResources, resourcesCacheKey, packResources, unpackResources,
} from '../src/job-search-resources.mjs'

let pass = 0, fail = 0
const t = (name, cond) => { if (cond) { pass++ } else { fail++; console.error(`  FAIL: ${name}`) } }
const eq = (name, a, b) => t(`${name} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`, a === b)

console.log('job-search-resources')

// ── Career Club Corner is a mirror of corner.career.club ────────────────────
t('Corner keeps the headline verbatim', CAREER_CLUB_CORNER.headline === 'Job search is a team sport. This is your team.')
t('Corner is free', CAREER_CLUB_CORNER.cost === 'free')
t('Corner links to the live page', CAREER_CLUB_CORNER.url === 'https://corner.career.club')
t('Corner is marked for people in transition', CAREER_CLUB_CORNER.forPeopleInTransition === true)
// Its cadence is allowed to survive the date rule: it is a recurring cadence
// from a page we own, not a dated event from a search result.
t('Corner cadence is not treated as an asserted date', !hasAssertedDate(CAREER_CLUB_CORNER.howYouTakePart))

// ── The no-dates rule ───────────────────────────────────────────────────────
t('a specific date is caught', hasAssertedDate('Next meeting March 14, 2026'))
t('a slash date is caught', hasAssertedDate('Meets 3/14/26'))
t('a bare year is caught', hasAssertedDate('Running since 1992'))
t('a recurring cadence is NOT a date', !hasAssertedDate('Meets every Monday at noon'))
t('third-Tuesday cadence is NOT a date', !hasAssertedDate('Third Tuesday of each month'))
eq('a date is stripped', stripAssertedDate('Next meeting is March 14, 2026'), 'Next meeting is')
eq('a year is stripped', stripAssertedDate('All-volunteer, running since 1992'), 'All-volunteer, running')
eq('cadence survives stripping', stripAssertedDate('Meets every Monday at 9am'), 'Meets every Monday at 9am')
t('stripping leaves no dangling punctuation', !/[,;]\s*$/.test(stripAssertedDate('Weekly, on March 3,')))

// ── Row normalisation ───────────────────────────────────────────────────────
t('a nameless row is dropped', normalizeResource({ url: 'https://x.com' }) === null)
const dup = normalizeResource({ name: 'X', url: 'https://x.org', sourceUrl: 'https://x.org' })
eq('sourceUrl duplicating url is blanked', dup.sourceUrl, '')
const bad = normalizeResource({ name: 'Y', url: 'javascript:alert(1)' })
eq('a non-http url is rejected', bad.url, '')
const dated = normalizeResource({ name: 'Z', url: 'https://z.org', whyThisFits: 'Their summit is May 3, 2026 in Austin' })
t('a date inside model prose is stripped at normalise time', !hasAssertedDate(dated.whyThisFits))

const split = splitResources([
  { name: 'Has link', url: 'https://a.org' },
  { name: 'No link at all' },
  { name: 'Has link' },
  { name: 'Events only', eventsUrl: 'https://b.org/events' },
])
eq('sourced rows are kept', split.rows.length, 2)
eq('an unlinked row is separated, not discarded', split.uncited.length, 1)

// ── The TALK case ───────────────────────────────────────────────────────────
// A generic query ranked TALK ninth of nine and the prose summary dropped it.
// It must rank above the paid enterprise board and above a ticketed conference.
const TALK = normalizeResource({
  name: 'TALK Talent', kind: 'career network', cost: 'invite-only',
  howYouTakePart: '80 local chapters across North America, plus an online platform',
  forPeopleInTransition: true, url: 'https://www.talktalent.com/', confidence: 'high',
})
const PAID_BOARD = normalizeResource({
  name: 'i4cp Talent Acquisition Board', kind: 'gated peer group', cost: 'dues',
  howYouTakePart: 'Six meetings a year, two in person',
  forPeopleInTransition: false, url: 'https://www.i4cp.com/groups/talent-acquisition-board', confidence: 'high',
})
const CONFERENCE = normalizeResource({
  name: 'A large annual summit', kind: 'professional body', cost: 'ticketed',
  howYouTakePart: 'Annual gathering only', forPeopleInTransition: false,
  url: 'https://example.org/summit', confidence: 'medium',
})
t('TALK outranks the paid enterprise board', resourceScore(TALK) > resourceScore(PAID_BOARD))
t('TALK outranks a ticketed conference', resourceScore(TALK) > resourceScore(CONFERENCE))
const ranked = rankResources([CONFERENCE, PAID_BOARD, TALK])
eq('TALK sorts to the top however it arrives', ranked[0].name, 'TALK Talent')
t('invite-only is not a demotion when it is free of charge', resourceScore(TALK) > 0)

// A free local job-search group should beat a paid professional body — the
// Kenton County case.
const NKYAG = normalizeResource({
  name: 'NKY Accountability Group', kind: 'library program', cost: 'free',
  howYouTakePart: 'Meets weekly, in person and virtually', forPeopleInTransition: true,
  url: 'https://www.kentonlibrary.org/nkyag/', confidence: 'high',
})
t('a free library program outranks a dues-paying body', resourceScore(NKYAG) > resourceScore(PAID_BOARD))

// ── Deep links ──────────────────────────────────────────────────────────────
eq('Meetup city slug', meetupCitySlug('Boise', 'ID'), 'us--id--boise')
eq('Meetup slug handles two words', meetupCitySlug('San Francisco', 'CA'), 'us--ca--san-francisco')
eq('Meetup slug empty without a state', meetupCitySlug('Boise', 'Idaho'), '')
t('Meetup url uses the slug path', meetupUrl('Boise', 'ID', 'career business').includes('/find/us--id--boise/career-business/'))
t('Meetup url falls back to keyword search', meetupUrl('Paris', '', 'product').includes('keywords='))
t('the Lesson 2 search string is quoted', jobSearchGroupSearchUrl('Cincinnati').includes('%22job%20search%20group%22'))

// ── Cache ───────────────────────────────────────────────────────────────────
eq('cache key normalises', resourcesCacheKey(' Cincinnati ', 'OH'), 'cincinnati|oh')
eq('cache key without a city', resourcesCacheKey('', ''), 'anywhere')
const packed = packResources('cincinnati|oh', [NKYAG], [])
t('a cache hit round-trips', unpackResources(packed, 'cincinnati|oh').rows[0].name === 'NKY Accountability Group')
t('a different city misses the cache', unpackResources(packed, 'boise|id') === null)

console.log(`  ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
