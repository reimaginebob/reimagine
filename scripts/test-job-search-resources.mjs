// Node test for src/job-search-resources.mjs. Run: node scripts/test-job-search-resources.mjs
//
// The two tests that matter most are the date rule and the TALK ranking case.
// Both encode findings from the live-search feasibility work in
// docs/networking-groups-brief.md; if either starts failing, the feature has
// regressed to the behaviour that made it not worth shipping.

import {
  CAREER_CLUB_CORNER, meetupCitySlug, meetupUrl, jobSearchGroupSearchUrl,
  hasAssertedDate, stripAssertedDate, normalizeResource, splitResources,
  resourceScore, rankResources, resourcesCacheKey, packResources, unpackResources, displayCity,
  groupsSignatureFor, putGroups, getGroups, GROUPS_MAX_SIGNATURES, institutionOf,
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

// ── Word-safe truncation ────────────────────────────────────────────────────
// A hard slice put "sector-specific hi" and "funded through federal/p" on screen.
const longTake = normalizeResource({ name: 'L', url: 'https://l.org',
  howYouTakePart: 'Visit a local American Job Center in person or attend the listed job fairs and career events, such as the citywide career fair and the sector-specific hiring events held throughout the year' })
t('a long value no longer ends mid-word', !/\bhi$|\bfederal\/p$/.test(longTake.howYouTakePart))
t('a truncated value is marked as cut', longTake.howYouTakePart.endsWith('…'))
t('a short value is untouched', normalizeResource({ name: 'S', url: 'https://s.org', howYouTakePart: 'Meets weekly' }).howYouTakePart === 'Meets weekly')

// ── One row per institution ─────────────────────────────────────────────────
// Live Chicago output returned the same public library three times, which is
// three of the few slots this card has spent on one building.
eq('institution of a library programme', institutionOf('Skokie Public Library Career Support Group'), 'skokie public library')
eq('a different programme at the same library reduces the same', institutionOf('Skokie Public Library Job Seekers drop-in resume/feedback sessions'), 'skokie public library')
eq('a college programme reduces to the college', institutionOf('Oakton College Career Development Center — Community Members'), 'oakton college')
eq('a slash-separated network reduces to the body', institutionOf('Chicago Cook Workforce Partnership / American Job Center Network'), 'chicago cook workforce partnership')
const chicago = splitResources([
  { name: 'Skokie Public Library Career Support Group', url: 'https://a.org' },
  { name: 'Oakton College Career Development Center — Community Members', url: 'https://b.org' },
  { name: 'Skokie Public Library Job Seekers drop-in resume/feedback sessions', url: 'https://c.org' },
  { name: 'Harper College Job Placement Resource Center — Community Job Search Assistance', url: 'https://d.org' },
])
eq('one row survives per institution', chicago.rows.length, 3)
t('the first row for an institution is the one kept', chicago.rows[0].name.includes('Career Support Group'))
t('two different colleges both survive', chicago.rows.filter(r => /College/.test(r.name)).length === 2)
// A single-word leader must not collapse unrelated organizations.
t('a one-word leader does not collapse anything', splitResources([
  { name: 'Chicago Career Collective', url: 'https://e.org' },
  { name: 'Chicago Innovation Awards', url: 'https://f.org' },
]).rows.length === 2)

// ── The TALK case ───────────────────────────────────────────────────────────
// A generic query ranked TALK ninth of nine and the prose summary dropped it.
// It must rank above the paid enterprise board and above a ticketed conference.
const TALK = normalizeResource({
  name: 'TALK Talent', kind: 'career network', cost: 'invite-only',
  howYouTakePart: '80 local chapters across North America, plus an online platform',
  forPeopleInTransition: true, fitsProfession: true, url: 'https://www.talktalent.com/', confidence: 'high',
})
const PAID_BOARD = normalizeResource({
  name: 'i4cp Talent Acquisition Board', kind: 'gated peer group', cost: 'dues',
  howYouTakePart: 'Six meetings a year, two in person',
  forPeopleInTransition: false, fitsProfession: true, url: 'https://www.i4cp.com/groups/talent-acquisition-board', confidence: 'high',
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

// A free local job-search group beats a paid body that does NOT serve this
// person's profession — the Kenton County case. Where the paid body IS their
// field's association, the SHRM case below reverses this, and that is the point:
// fit decides, cost breaks ties.
const NKYAG = normalizeResource({
  name: 'NKY Accountability Group', kind: 'library program', cost: 'free',
  howYouTakePart: 'Meets weekly, in person and virtually', forPeopleInTransition: true,
  url: 'https://www.kentonlibrary.org/nkyag/', confidence: 'high',
})
t('a free library program outranks a dues-paying body that does not fit their field', resourceScore(NKYAG) > resourceScore({ ...PAID_BOARD, fitsProfession: false }))

// ── Fit outranks cost: the SHRM case ────────────────────────────────────────
// Bob, 2026-09-01, on a Chicago list for a CHRO candidate: an HR person should
// always get SHRM and their local chapters, those cost money, and the cost must
// not override the appropriateness. Cost used to be worth nearly as much as fit
// in the score, which put every free general service above every professional
// body and produced exactly the list he was looking at.
const SHRM_CHAPTER = normalizeResource({
  name: 'Chicago SHRM', kind: 'professional body', cost: 'dues',
  howYouTakePart: 'Local chapter, meets monthly in person', forPeopleInTransition: false,
  fitsProfession: true, url: 'https://www.chicagoshrm.org/', confidence: 'high',
})
const LIBRARY_CLINIC = normalizeResource({
  name: 'Skokie Public Library Career Support Group', kind: 'library program', cost: 'free',
  howYouTakePart: 'Drop-in, monthly', forPeopleInTransition: true,
  fitsProfession: false, url: 'https://skokielibrary.info/', confidence: 'high',
})
t('a dues-paying professional body outranks a free general service', resourceScore(SHRM_CHAPTER) > resourceScore(LIBRARY_CLINIC))
eq('and sorts above it', rankResources([LIBRARY_CLINIC, SHRM_CHAPTER])[0].name, 'Chicago SHRM')
// The free general service still belongs on the list — it is demoted, not dropped.
eq('the free service is kept, not discarded', rankResources([LIBRARY_CLINIC, SHRM_CHAPTER]).length, 2)
// Between two equally fitting bodies, free still wins.
const SHRM_FREE = normalizeResource({ ...SHRM_CHAPTER, cost: 'free' })
t('cost still breaks a tie between comparable rows', resourceScore(SHRM_FREE) > resourceScore(SHRM_CHAPTER))
// Several chapters in one metro is normal and must survive the repeat guard.
const chapters = splitResources([
  { name: 'Chicago SHRM', url: 'https://a.org' },
  { name: 'Fox Valley SHRM', url: 'https://b.org' },
  { name: 'West Suburban SHRM', url: 'https://c.org' },
])
eq('multiple local chapters all survive', chapters.rows.length, 3)

// ── City display ────────────────────────────────────────────────────────────
// The city is free text and lands in a heading, so a lowercase entry must not
// render as "Near los angeles" — but the person's own capitalisation wins.
eq('a lowercase city is capitalised', displayCity('los angeles'), 'Los Angeles')
eq('one lowercase word', displayCity('cincinnati'), 'Cincinnati')
eq('an existing capital is left alone', displayCity('Washington DC'), 'Washington DC')
eq('a mixed-case abbreviation survives', displayCity('St. Louis'), 'St. Louis')
eq('hyphens are preserved', displayCity('winston-salem'), 'Winston-Salem')
eq('empty stays empty', displayCity(''), '')

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

// ── Groups for This Path: signature keying ──────────────────────────────────
// The whole reason "a card in every playbook" is affordable.
eq('signature drops geography', groupsSignatureFor({ function: 'CFO', industry: 'Manufacturing', seniority: 'C-suite', geo: 'Charlotte, NC' }), 'cfo|manufacturing|csuite')
t('two playbooks in different cities share one signature',
  groupsSignatureFor({ function: 'CFO', industry: 'Manufacturing', seniority: 'C-suite', geo: 'Boise' }) ===
  groupsSignatureFor({ function: 'CFO', industry: 'Manufacturing', seniority: 'C-suite', geo: 'Miami' }))
t('a different industry is a different signature',
  groupsSignatureFor({ function: 'CFO', industry: 'Healthcare', seniority: 'C-suite' }) !==
  groupsSignatureFor({ function: 'CFO', industry: 'Manufacturing', seniority: 'C-suite' }))
eq('an empty criteria set is an empty signature', groupsSignatureFor(null), '')

const sig = 'cfo|manufacturing|csuite'
let store = putGroups(null, sig, [NKYAG])
eq('a stored signature reads back', getGroups(store, sig).rows[0].name, 'NKY Accountability Group')
t('an unknown signature misses', getGroups(store, 'other|x|y') === null)
// The store is capped, oldest-out, so a long search cannot grow it without bound.
for (let i = 0; i < GROUPS_MAX_SIGNATURES + 4; i++) {
  store = putGroups(store, `sig-${i}`, [NKYAG])
}
t('the store is capped', Object.keys(store).length <= GROUPS_MAX_SIGNATURES)
t('the newest signature survives the cap', !!getGroups(store, `sig-${GROUPS_MAX_SIGNATURES + 3}`))

console.log(`  ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
