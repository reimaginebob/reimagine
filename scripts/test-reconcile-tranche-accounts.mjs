// Guards scripts/reconcile-tranche-accounts.mjs, the read-only before-send check
// for the Corner campaign. Pure matching, input parsing, and the Resend paging
// with fetch stubbed -- no database and no network.
//
// Not wired into `npm test` on purpose: run it by hand when the script changes.
import { similarKey, nameKey, addressWarning, reconcile, parseContacts, formatReport, fetchSegment } from './reconcile-tranche-accounts.mjs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const accounts = [
  { email: 'm_lenart@yahoo.com', first_name: 'Michael', last_name: 'Lenart', created_at: '2026-07-20' },
  { email: 'mlenart01@gmail.com', first_name: 'Michael', last_name: 'Lenart', created_at: '2026-06-15' },
  { email: 'thetjackson@gmail.com', first_name: 'Anthony', last_name: 'Jackson', created_at: '2026-09-17' },
  { email: 'sam.smith@gmail.com', first_name: 'Sam', last_name: 'Smith', created_at: '2026-08-01' },
  { email: 'one@x.com', first_name: 'Solo', last_name: '', created_at: '2026-08-02' },
]
const c = (email, first_name = '', last_name = '', source = 'a') => ({ email, first_name, last_name, source })

// --- keys ---
check(similarKey('m-lenart@yahoo.com') === similarKey('M_Lenart@Yahoo.com'), 'hyphen/underscore/case should share a similar key')
check(similarKey('m-lenart@yahoo.com') !== similarKey('m-lenart@gmail.com'), 'different domains must not share a similar key')
check(similarKey('bob+corner@x.com') === similarKey('bob@x.com'), '+tag should be ignored')
check(nameKey('Ann', '') === '' && nameKey('', 'Lee') === '', 'a half name must not produce a name key')
check(nameKey(' Ann  Marie ', 'LEE') === 'ann marie|lee', 'name key folds case and whitespace')

// --- address warnings ---
check(addressWarning('a@gmail.con') !== null, '.con is flagged')
check(addressWarning('a@gmial.com') !== null, 'misspelled domain is flagged')
check(addressWarning('a@gmail.com') === null, 'a good address is not flagged')
check(addressWarning('nobody') !== null, 'no @ is flagged')

// --- reconcile ---
const r = reconcile([
  c('thetjackson@gmail.com'),                 // exact
  c('THETJACKSON+corner@gmail.com'),          // exact via tag/case
  c('m-lenart@yahoo.com', 'Michael', 'Lenart'), // similar
  c('sam.smith@gmail.com'),                    // exact via gmail dots
  c('samsmith@gmail.com'),                     // exact (dots ignored)
  c('s.smith@work.com', 'Sam', 'Smith'),       // name only
  c('someone@gmail.con', 'No', 'Account'),     // warn only
  c('fine@x.com', 'Solo', ''),                 // half name -> no name match
], accounts)
const kinds = r.findings.map(f => `${f.level}:${f.kind}:${f.contact.email}`)
check(kinds.includes('REMOVE:exact:thetjackson@gmail.com'), 'exact match')
check(kinds.includes('REMOVE:exact:THETJACKSON+corner@gmail.com'), 'exact match through +tag and case')
check(kinds.includes('REMOVE:similar:m-lenart@yahoo.com'), 'Lenart hyphen/underscore is caught')
check(kinds.includes('REMOVE:exact:samsmith@gmail.com'), 'Gmail dots are ignored')
check(kinds.includes('REVIEW:name:s.smith@work.com'), 'name-only match is REVIEW, not REMOVE')
check(kinds.includes('WARN:address:someone@gmail.con'), 'typo address is WARN')
check(!kinds.some(k => k.includes('fine@x.com')), 'a half name must not match')
check(r.findings.filter(f => f.level === 'REMOVE').length === 5, 'five REMOVE findings (two thetjackson, Lenart, two Sam Smith)')

// --- duplicates among the contacts to be sent ---
const d = reconcile([
  c('kquinto@ex-cell.com', 'Karla', 'Quinto', 'a'),
  c('karla@quintohr.com', 'Karla', 'Quinto', 'b'),
  c('same@x.com', '', '', 'a'),
  c('SAME@x.com', '', '', 'b'),
], []).duplicates
check(d.some(x => x.kind === 'same name' && x.contacts.length === 2), 'same person at two addresses is a DUPLICATE')
check(d.some(x => x.kind === 'same mailbox'), 'same mailbox in two sources is a DUPLICATE')
check(reconcile([c('a@x.com'), c('b@x.com')], []).duplicates.length === 0, 'no false duplicates')

// --- parsing ---
const csv = parseContacts('email,first_name,last_name\n# note\nA@x.com,Ann,Lee\n"b@x.com","Bo",\n\nc@x.com\n', 'f.csv')
check(csv.length === 3 && csv[0].first_name === 'Ann' && csv[1].email === 'b@x.com' && csv[2].email === 'c@x.com', 'csv: header, comments and blanks skipped')
check(parseContacts('[{"email":"a@x.com","first_name":"A"},{"nope":1}]', 'j').length === 1, 'json array')
check(parseContacts('{"data":[{"email":"a@x.com"}]}', 'j').length === 1, 'json {data:[]} as Resend returns it')
check(parseContacts('﻿a@x.com\tAnn\tLee', 't')[0].last_name === 'Lee', 'BOM + tab separated')
check(parseContacts('   ', 'e').length === 0, 'empty input')

// --- Resend paging, fetch stubbed; only GETs are allowed ---
const calls = []
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), method: init.method || 'GET' })
  const after = new URL(url).searchParams.get('after')
  if (calls.length === 1) return new Response('', { status: 429 })
  const body = !after
    ? { data: [{ id: 'i1', email: 'a@x.com', first_name: 'A' }], has_more: true }
    : { data: [{ id: 'i2', email: 'b@x.com' }], has_more: false }
  return new Response(JSON.stringify(body), { status: 200 })
}
const seg = await fetchSegment('key', '29138278-5ee9-4c27-821b-64a3581a297a')
check(seg.length === 2 && seg[0].email === 'a@x.com' && seg[1].email === 'b@x.com', 'pages through has_more and retries a 429')
check(calls.every(x => x.method === 'GET'), 'segment mode only ever sends GET')
check(calls.some(x => x.url.includes('after=i1')), 'second page uses the last id as cursor')

// --- report ---
const rep = formatReport([c('m-lenart@yahoo.com', 'Michael', 'Lenart')], accounts, reconcile([c('m-lenart@yahoo.com', 'Michael', 'Lenart')], accounts))
check(rep.includes('REMOVE 1') && rep.includes('near-identical address') && rep.includes('Read-only'), 'report names the match and says it is read-only')
check(formatReport([c('z@z.com')], accounts, reconcile([c('z@z.com')], accounts)).includes('Nothing to remove.'), 'clean report says so')

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1) }
console.log('reconcile-tranche-accounts: all checks passed')
