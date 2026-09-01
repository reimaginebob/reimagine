// Unit tests for src/connections-match.mjs — the LinkedIn connections parse and
// the company matching behind "Who You Know Here".
import {
  parseCsv, parseConnectionsCsv, normalizeCompany, companyMatch, matchConnections,
  looseMatch, looseMatchConnections,
  linkedInSecondDegreeUrl, linkedInFirstDegreeUrl, packNetwork, unpackNetwork, daysSince, outreachKey,
  mailtoUrl, firstNameOf, cleanDomain, emailGuesses, searchQuery, resolveSearch,
  manualPerson, withManual, withoutManual,
  schoolSlug, linkedInAlumniUrl,
} from '../src/connections-match.mjs'

let passed = 0
const fail = (msg) => { console.error('FAIL: ' + msg); process.exitCode = 1 }
const ok = (cond, msg) => { if (cond) passed++; else fail(msg) }
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} — got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`)

// ── CSV parsing ──────────────────────────────────────────────────────────────

eq(parseCsv('a,b\n1,2'), [['a', 'b'], ['1', '2']], 'plain rows')
eq(parseCsv('a,"b,c"\n1,2'), [['a', 'b,c'], ['1', '2']], 'a quoted field keeps its comma')
eq(parseCsv('a,"say ""hi"""'), [['a', 'say "hi"']], 'doubled quotes unescape')
eq(parseCsv('a,b\r\n1,2'), [['a', 'b'], ['1', '2']], 'CRLF line endings')
eq(parseCsv('a,"line\nbreak"'), [['a', 'line\nbreak']], 'a newline inside quotes stays in the field')
eq(parseCsv(''), [], 'empty input yields no rows')

// The real export, preamble and all. LinkedIn has changed the number of notes
// lines over time, so the header is found by content rather than by offset.
const REAL = `Notes:
"When exporting your connection data, you may notice that some of the email addresses are missing."
"Members can choose whether to share their email address."

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Dana,Whitfield,https://www.linkedin.com/in/danawhitfield,,"Ameriprise Financial Services, Inc.",VP Operations,"14 Mar 2019"
Marcus,Bell,https://www.linkedin.com/in/marcusbell,marcus@example.com,Ameriprise Financial,Director of Client Service,"02 Feb 2021"
Priya,Raman,https://www.linkedin.com/in/priyaraman,,Thrivent,Portfolio Manager,"09 Sep 2020"
NoCompany,Person,https://www.linkedin.com/in/nocompany,,,,"01 Jan 2022"
`

const parsed = parseConnectionsCsv(REAL)
ok(parsed.error === null, 'the real export parses without error')
eq(parsed.people.length, 3, 'three usable rows')
eq(parsed.skipped, 1, 'the row with no company is skipped, not carried')
eq(parsed.people[0], {
  n: 'Dana Whitfield', c: 'Ameriprise Financial Services, Inc.', t: 'VP Operations',
  u: 'https://www.linkedin.com/in/danawhitfield', d: '14 Mar 2019', e: '',
}, 'the first row maps to compact keys with its comma intact')

// A header with no preamble at all, in case LinkedIn drops it.
ok(parseConnectionsCsv('First Name,Last Name,Company\nA,B,Acme\n').people.length === 1, 'a bare header still parses')
// A BOM on the first line must not hide the header.
ok(parseConnectionsCsv('﻿First Name,Last Name,Company\nA,B,Acme\n').people.length === 1, 'a BOM does not hide the header')
// Wrong file entirely.
eq(parseConnectionsCsv('Date,Subject,Body\n2026-01-01,hi,there\n').error, 'no-header', 'a different export is rejected')
eq(parseConnectionsCsv('').error, 'no-header', 'empty input is rejected')

// ── Company normalization ────────────────────────────────────────────────────

eq(normalizeCompany('Ameriprise Financial Services, Inc.').key, 'ameriprise financial services', 'legal suffix dropped')
eq(normalizeCompany('  ACME   Corp.  ').key, 'acme', 'case, padding and suffix dropped')
eq(normalizeCompany('Johnson & Johnson').key, 'johnson and johnson', 'ampersand spelled out')
eq(normalizeCompany('').key, '', 'empty stays empty')
eq(normalizeCompany('LLC').key, '', 'a name that is only a suffix normalizes away')

// ── Company matching ─────────────────────────────────────────────────────────

eq(companyMatch('Ameriprise Financial Services, Inc.', 'Ameriprise Financial Services'), 'exact', 'suffix-only difference is exact')
eq(companyMatch('ameriprise financial', 'Ameriprise Financial'), 'exact', 'case-only difference is exact')
eq(companyMatch('Ameriprise', 'Ameriprise Financial Services'), 'likely', 'a distinctive leading token is a likely match')
eq(companyMatch('Ameriprise Financial Services', 'Ameriprise'), 'likely', 'likely works in either direction')
eq(companyMatch('Thrivent', 'Ameriprise'), null, 'unrelated companies do not match')
eq(companyMatch('', 'Ameriprise'), null, 'a blank employer never matches')
eq(companyMatch('Ameriprise', ''), null, 'a blank target never matches')

// The false-positive guard: a single generic leading word is not identity.
eq(companyMatch('First National Bank', 'First Republic'), null, 'a shared generic first word is not a match')
eq(companyMatch('United', 'United Airlines'), null, 'one weak token alone does not match')
// "Holdings" is left out of the legal-suffix list on purpose: it is part of a
// real name (United Airlines Holdings is the actual parent), so this lands as
// likely rather than exact. The person still surfaces, labelled honestly.
eq(companyMatch('United Airlines', 'United Airlines Holdings'), 'likely', 'a parent-entity name is likely, not exact')
eq(companyMatch('American Express', 'American Express Global'), 'likely', 'two leading tokens carry the match even when the first is generic')
// A prefix run, not a bag of words: order has to hold.
eq(companyMatch('Bank of Apple', 'Apple'), null, 'a token appearing later does not make a prefix match')

// ── Loose matches: the name buried mid-string ────────────────────────────────

// The real case, from LinkedIn's own entity list for Imerys.
ok(looseMatch('Gimpex Imerys India Private Limited', 'Imerys'), 'a name in the middle is a loose match')
ok(looseMatch('Imerys', 'Gimpex Imerys India'), 'loose matching works in either direction')
ok(!looseMatch('Imerys Performance Minerals', 'Imerys'), 'a leading-token match is NOT loose — companyMatch already has it')
ok(!looseMatch('Imerys', 'Imerys'), 'an exact match is not also a loose one')
ok(!looseMatch('Thrivent', 'Imerys'), 'unrelated companies are not loosely matched')
ok(!looseMatch('', 'Imerys'), 'a blank employer is not loosely matched')
// The same weak-token guard, so "Bank of the First" does not loosely match "First".
ok(!looseMatch('Bank of the First', 'First'), 'a single generic token mid-string is refused')
ok(looseMatch('Bank of the Old Republic', 'Old Republic'), 'two tokens mid-string carry it')

const loosePeople = [
  { n: 'Ravi Kumar', c: 'Gimpex Imerys India Private Limited' },
  { n: 'Ada Fox', c: 'Imerys Performance Minerals' },
  { n: 'Zed Ali', c: 'Consolidated Imerys Holdings' },
  { n: 'Mia Chen', c: 'Thrivent' },
]
eq(looseMatchConnections(loosePeople, 'Imerys').map(p => p.n), ['Ravi Kumar', 'Zed Ali'].sort(), 'only mid-string mentions come back, alphabetically')
eq(looseMatchConnections(loosePeople, ''), [], 'no target yields no loose matches')
eq(looseMatchConnections(null, 'Imerys'), [], 'no network yields no loose matches')
// A person can never be in both lists.
const strict = matchConnections(loosePeople, 'Imerys').map(p => p.n)
ok(!looseMatchConnections(loosePeople, 'Imerys').some(p => strict.includes(p.n)), 'the two lists never overlap')

// ── Match listing ────────────────────────────────────────────────────────────

const people = parsed.people
const hits = matchConnections(people, 'Ameriprise Financial Services')
eq(hits.map(h => h.n), ['Dana Whitfield', 'Marcus Bell'], 'both Ameriprise people are found')
eq(hits[0].match, 'exact', 'the exact match sorts first')
eq(hits[1].match, 'likely', 'the likely match sorts after it')
eq(matchConnections(people, 'Thrivent').map(h => h.n), ['Priya Raman'], 'a different company finds its own person')
eq(matchConnections(people, 'Nowhere Corp'), [], 'no match yields an empty list')
eq(matchConnections(people, ''), [], 'no target yields an empty list')
eq(matchConnections(null, 'Ameriprise'), [], 'no network yields an empty list')

// Two exact matches sort alphabetically, so the list does not shuffle.
const twoExact = [{ n: 'Zoe Adams', c: 'Acme' }, { n: 'Al Brown', c: 'Acme' }]
eq(matchConnections(twoExact, 'Acme').map(h => h.n), ['Al Brown', 'Zoe Adams'], 'equal matches sort by name')

// ── LinkedIn hand-off ────────────────────────────────────────────────────────

ok(linkedInSecondDegreeUrl('Ameriprise Financial').includes('keywords=Ameriprise%20Financial'), 'the company is encoded into the search')
ok(linkedInSecondDegreeUrl('Ameriprise').includes('network='), 'the network filter is present')
ok(!linkedInSecondDegreeUrl('').includes('keywords='), 'no company yields a plain people search rather than a broken query')
ok(linkedInSecondDegreeUrl('Imerys').includes(encodeURIComponent('["S"]')), 'second degree asks for S')
ok(linkedInFirstDegreeUrl('Imerys').includes(encodeURIComponent('["F"]')), 'first degree asks for F')
ok(linkedInFirstDegreeUrl('Imerys').includes('keywords=Imerys'), 'the first-degree check searches the same company')
ok(!linkedInFirstDegreeUrl('').includes('keywords='), 'no company yields a plain people search here too')

// ── What the search asks for ─────────────────────────────────────────────────

eq(searchQuery('Imerys', ''), 'Imerys', 'no narrowing terms leaves the company alone')
eq(searchQuery('Imerys', 'operations'), 'Imerys operations', 'narrowing terms are appended')
eq(searchQuery('Imerys', '  '), 'Imerys', 'blank narrowing terms are ignored')
eq(searchQuery('', 'operations'), 'operations', 'terms alone still make a query')
eq(searchQuery('', ''), '', 'nothing yields nothing')

eq(resolveSearch(null, 'Imerys'), { company: 'Imerys', extra: '', edited: false }, 'with no override the posting company is used')
eq(resolveSearch({}, 'Imerys'), { company: 'Imerys', extra: '', edited: false }, 'an empty override is the same as none')
eq(resolveSearch({ company: '  ' }, 'Imerys'), { company: 'Imerys', extra: '', edited: false }, 'a blank company falls back rather than searching for nothing')
eq(resolveSearch({ company: 'Imerys USA' }, 'Imerys'), { company: 'Imerys USA', extra: '', edited: true }, 'a changed company is marked as edited')
eq(resolveSearch({ extra: 'plant manager' }, 'Imerys'), { company: 'Imerys', extra: 'plant manager', edited: true }, 'narrowing terms alone count as an edit')
eq(resolveSearch({ company: 'Imerys' }, 'Imerys'), { company: 'Imerys', extra: '', edited: false }, 'retyping the same company is not an edit')
eq(resolveSearch({ company: 'Imerys' }, '  Imerys  '), { company: 'Imerys', extra: '', edited: false }, 'padding on the record does not read as an edit')

// ── Storage ──────────────────────────────────────────────────────────────────

const packed = packNetwork([{ n: 'A', c: 'B' }], '2026-08-30T12:00:00Z')
eq(unpackNetwork(packed).people.length, 1, 'a packed network unpacks')
eq(unpackNetwork(packed).loadedAt, '2026-08-30T12:00:00Z', 'the load date survives the round trip')
eq(unpackNetwork({ v: 2, people: [] }), null, 'a future version is refused rather than misread')
eq(unpackNetwork({ v: 1 }), null, 'a malformed blob is refused')
eq(unpackNetwork(null), null, 'nothing stored yields nothing')

const NOW = Date.parse('2026-08-30T00:00:00Z')
eq(daysSince('2026-08-30T00:00:00Z', NOW), 0, 'today is zero days')
eq(daysSince('2026-05-30T00:00:00Z', NOW), 92, 'three months back counts the days')
eq(daysSince(null, NOW), null, 'no date yields no answer')
eq(daysSince('not a date', NOW), null, 'an unparseable date yields no answer')

// ── Outreach drafts ──────────────────────────────────────────────────────────

eq(parsed.people[1].e, 'marcus@example.com', 'an exported email is captured when the connection allowed it')
eq(parsed.people[0].e, '', 'a connection who withheld their email has none')

eq(firstNameOf('Dana Whitfield'), 'Dana', 'the greeting uses the first name')
eq(firstNameOf('  Priya   Raman '), 'Priya', 'padding does not leak into the greeting')
eq(firstNameOf(''), '', 'no name yields no first name')

eq(outreachKey('sp_1', { u: 'https://linkedin.com/in/dana', n: 'Dana' }), 'sp_1::https://linkedin.com/in/dana', 'the profile URL keys the draft when present')
eq(outreachKey('sp_1', { n: 'Dana Whitfield' }), 'sp_1::Dana Whitfield', 'the name keys it when there is no URL')
ok(outreachKey('sp_1', { n: 'A' }) !== outreachKey('sp_2', { n: 'A' }), 'the same person on two opportunities keys separately')

// ── People added by hand ─────────────────────────────────────────────────────

eq(manualPerson({name:'Dana Whitfield',company:'Imerys',title:'VP Operations'}),
  {n:'Dana Whitfield',c:'Imerys',t:'VP Operations',u:'',d:'',e:'',m:1}, 'a hand-added person takes the same shape as a parsed one')
eq(manualPerson({name:'  Dana  ',company:'  Imerys  '}).n, 'Dana', 'padding is trimmed')
eq(manualPerson({name:'',company:'Imerys'}), null, 'a person with no name is refused')
eq(manualPerson({name:'Dana',company:''}), null, 'a person with no company is refused')
ok(manualPerson({name:'Dana',company:'Imerys'}).m === 1, 'hand-added people are flagged as such')

const fileRows=[{n:'Marcus Bell',c:'Imerys',t:'Director',u:'https://linkedin.com/in/marcus',d:'2021',e:''}]
const byHand=[manualPerson({name:'Dana Whitfield',company:'Imerys',title:'VP Operations'})]
eq(withManual(fileRows,byHand).map(p=>p.n), ['Marcus Bell','Dana Whitfield'], 'hand-added people join the file rows')
eq(withManual(fileRows,[]).length, 1, 'nothing added leaves the list alone')
eq(withManual([],byHand).map(p=>p.n), ['Dana Whitfield'], 'they work with no file rows at all')
eq(withManual(null,null), [], 'missing inputs yield an empty list')

// A newer export that now contains the person should win, not duplicate them.
const later=[{n:'Dana Whitfield',c:'Imerys Financial',t:'SVP',u:'',d:'2019',e:''}]
eq(withManual(later,byHand).length, 1, 'the file version wins when the same name is at the same employer')
eq(withManual(later,byHand)[0].t, 'SVP', 'and it is the file version that is kept')
// Same name, genuinely different company: two different people.
eq(withManual([{n:'Dana Whitfield',c:'Thrivent',t:'',u:'',d:'',e:''}],byHand).length, 2, 'the same name elsewhere is not the same person')
// URL wins over name when both have one.
const urlFile=[{n:'D. Whitfield',c:'Imerys',t:'',u:'https://linkedin.com/in/dana',d:'',e:''}]
const urlHand=[manualPerson({name:'Dana Whitfield',company:'Imerys',url:'https://LinkedIn.com/in/Dana'})]
eq(withManual(urlFile,urlHand).length, 1, 'a matching profile URL identifies the person whatever the name says')

eq(withoutManual(byHand,{n:'Dana Whitfield',c:'Imerys',u:''}).length, 0, 'a hand-added person can be removed')
eq(withoutManual(byHand,{n:'Someone Else',c:'Imerys',u:''}).length, 1, 'removing someone else leaves them alone')
eq(withoutManual([],{n:'Dana',c:'Imerys',u:''}), [], 'removing from nothing is safe')

// ── Working out an address ───────────────────────────────────────────────────

eq(cleanDomain('ameriprise.com'), 'ameriprise.com', 'a bare domain passes through')
eq(cleanDomain('  Ameriprise.COM '), 'ameriprise.com', 'case and padding are normalized')
eq(cleanDomain('@ameriprise.com'), 'ameriprise.com', 'a leading @ is dropped')
eq(cleanDomain('someone@ameriprise.com'), 'ameriprise.com', 'a full address yields its domain')
eq(cleanDomain('https://www.ameriprise.com/careers'), 'ameriprise.com', 'a pasted URL yields its domain')
eq(cleanDomain('mail.ameriprise.co.uk'), 'mail.ameriprise.co.uk', 'a multi-level domain survives')
eq(cleanDomain('ameriprise'), '', 'a bare word is not a domain')
eq(cleanDomain(''), '', 'empty input is not a domain')
eq(cleanDomain('not a domain at all'), '', 'a sentence is not a domain')

eq(emailGuesses('Dana Whitfield', 'ameriprise.com'),
  ['dana.whitfield@ameriprise.com', 'danawhitfield@ameriprise.com', 'dwhitfield@ameriprise.com', 'dana_whitfield@ameriprise.com', 'dana@ameriprise.com'],
  'the common conventions are laid out, most likely first')
eq(emailGuesses('Dana Whitfield', '@Ameriprise.com')[0], 'dana.whitfield@ameriprise.com', 'the domain is cleaned before use')
eq(emailGuesses('Priya', 'acme.com'), ['priya@acme.com'], 'a single name yields the one form')
eq(emailGuesses('José Álvarez', 'acme.com')[0], 'jose.alvarez@acme.com', 'accents are folded to ASCII')
eq(emailGuesses("Mary-Jane O'Connor", 'acme.com')[0], 'maryjane.oconnor@acme.com', 'punctuation in a name is dropped')
eq(emailGuesses('Ann Marie Chen', 'acme.com')[0], 'ann.chen@acme.com', 'a middle name is skipped, first and last are used')
eq(emailGuesses('Dana Whitfield', ''), [], 'no domain yields no guesses')
eq(emailGuesses('', 'acme.com'), [], 'no name yields no guesses')
eq(emailGuesses('   ', 'acme.com'), [], 'a blank name yields no guesses')

ok(mailtoUrl('marcus@example.com', 'Quick one', 'Hi').startsWith('mailto:marcus@example.com?'), 'the address survives encoding intact')
ok(mailtoUrl('a@b.com', 'S & T', '').includes('subject=S%20%26%20T'), 'the subject is encoded')
eq(mailtoUrl('', 'S', 'B'), null, 'no address yields no mail link')

// ── The third door: alumni of your school who work there ────────────────────

// Checked live on 2026-09-01: this exact URL returned 26 UT Knoxville alumni
// matching Imerys, of whom the page's own "Where they work" panel counted 7
// actually there.
eq(linkedInAlumniUrl('University of Tennessee, Knoxville', 'Imerys'),
   'https://www.linkedin.com/school/university-of-tennessee-knoxville/people/?keywords=Imerys',
   'the verified URL shape')
// Plain text, never an id. Selecting a company from the page's own filter
// produces ?facetCurrentCompany=1038, an internal id we cannot know from a job
// description -- the same wall that made the company facet unusable for the
// second-degree search.
ok(!/facetCurrentCompany/.test(linkedInAlumniUrl('Yale University', 'Deloitte')), 'no company id is involved')

eq(schoolSlug('University of Tennessee, Knoxville'), 'university-of-tennessee-knoxville', 'commas drop')
eq(schoolSlug('Texas A&M University'), 'texas-a-m-university', 'an ampersand drops rather than becoming "and"')
eq(schoolSlug("St. John's University"), 'st-john-s-university', 'periods and apostrophes drop')
eq(schoolSlug('  Boston   College  '), 'boston-college', 'stray whitespace collapses')
eq(schoolSlug(''), '', 'no name is no slug')
eq(schoolSlug(null), '', 'no input is no slug')

// Both halves are required: half a URL would land somewhere wrong rather than
// nowhere, and nowhere is the honest answer.
eq(linkedInAlumniUrl('', 'Imerys'), '', 'no school gives no link')
eq(linkedInAlumniUrl('Yale University', ''), '', 'no company gives no link')
eq(linkedInAlumniUrl('Yale University', 'Smith & Sons'),
   'https://www.linkedin.com/school/yale-university/people/?keywords=Smith%20%26%20Sons',
   'the company is encoded, not slugged')

console.log(`test-connections-match: OK (${passed} cases passed)`)
