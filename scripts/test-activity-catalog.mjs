// The activity catalog is vocabulary the coach speaks from and a validator for
// what may be written. Two things it must never grow: a way to count what
// someone has done, and a key that can be stored but never read.
import { ACTIVITY_CATALOG, ACTIVITY_KEYS, ACTIVITY_STATES, ASKABLE, activity, isValidFact } from '../src/activity-catalog.js'

let pass = 0, fail = 0
const t = (n, c) => { c ? pass++ : (fail++, console.log('  FAIL:', n)) }

t('the catalog is not empty', ACTIVITY_CATALOG.length > 0)
t('every key is unique', new Set(ACTIVITY_KEYS).size === ACTIVITY_KEYS.length)
t('every entry has a key, evidence and a label', ACTIVITY_CATALOG.every(a => a.key && a.label && (a.evidence === 'asked' || a.evidence === 'observed')))
t('keys are snake_case and storable', ACTIVITY_KEYS.every(k => /^[a-z][a-z0-9_]*$/.test(k)))

// The asked half is the half the product is blind to. Each one has to carry a
// reason worth giving and somewhere to send them, or the coach is just nagging.
t('every askable activity carries a reason', ASKABLE.every(a => typeof a.why === 'string' && a.why.length > 40))
t('every askable activity carries an offer', ASKABLE.every(a => typeof a.offer === 'string' && a.offer.length > 10))
t('observed activities are never asked about', ACTIVITY_CATALOG.filter(a => a.evidence === 'observed').every(a => !ASKABLE.includes(a)))
t('the human half is actually represented', ASKABLE.length >= 5)

// Validation: an unregistered key must never become a row.
t('a real fact validates', isValidFact('accountability_partner', 'done', 'said'))
// ONLY THE ASKABLE HALF IS EVER STORED. An observed activity is derived from
// what they have built, so writing it down means it goes stale the moment they
// build something -- and offering to "remember" a thing the product can already
// see is the failure that made someone feel unread. The capture note tells the
// model to use only askable keys; these make it true whatever it emits.
t('an observed key is NOT storable, even though it is in the catalog', !isValidFact('personal_brand', 'done', 'said'))
t('nor is any other observed key', !isValidFact('interview_prepped', 'done', 'said'))
t('every askable key is storable', ASKABLE.every(a => isValidFact(a.key, 'done', 'said')))
t('no observed key is storable', ACTIVITY_CATALOG.filter(a => a.evidence === 'observed').every(a => !isValidFact(a.key, 'done', 'said')))
t('an unknown activity is rejected', !isValidFact('joined_the_circus', 'done', 'said'))
t('an unknown state is rejected', !isValidFact('accountability_partner', 'pending', 'said'))
t('an unknown source is rejected', !isValidFact('accountability_partner', 'done', 'guessed'))
t('empty input is rejected', !isValidFact('', '', ''))
t('undefined input is rejected', !isValidFact(undefined, undefined, undefined))

// The three states are the three answers we can LEARN. There is deliberately no
// state meaning "outstanding" -- absence of a row means we never discussed it,
// which is a question waiting, never a debt.
t('exactly three states', ACTIVITY_STATES.length === 3)
t('a negative can be recorded (this is what stops the re-asking)', ACTIVITY_STATES.includes('declined') && ACTIVITY_STATES.includes('not_yet'))
t('no state means outstanding, overdue or missing', !ACTIVITY_STATES.some(s => /outstanding|overdue|missing|todo|pending|incomplete/.test(s)))

// No scoring, ever. If a helper for this appears, the progress bar has come back
// through the back door.
const mod = await import('../src/activity-catalog.js')
t('the catalog exports no counter or score', !Object.keys(mod).some(k => /count|total|score|percent|progress|complete/i.test(k)))
t('no entry carries a weight or a rank', ACTIVITY_CATALOG.every(a => !('weight' in a) && !('rank' in a) && !('points' in a) && !('required' in a)))

// Nothing in the prose may frame the person as behind.
const prose = ACTIVITY_CATALOG.map(a => `${a.why || ''} ${a.offer || ''}`).join(' ')
t('no prose calls anyone behind or failing', !/\b(behind|failing|failed to|should have|neglect|you haven'?t|falling short)\b/i.test(prose))
t('no comparative standing in the prose', !/\bmost (people|candidates|job ?seekers)\b|\bthe average\b|\bothers\b/i.test(prose))

t('lookup returns an entry', activity('networking_group')?.evidence === 'asked')
t('lookup of an unknown key returns null', activity('nope') === null)

console.log(`test-activity-catalog: ${fail ? 'FAILED' : 'OK'} (${pass} cases passed${fail ? `, ${fail} FAILED` : ''})`)
process.exit(fail ? 1 : 0)
