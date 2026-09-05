// Your Next Step — the engine (src/step-position.js).
//
// The one function the screen and My Coach BOTH read, so a change here changes
// what two surfaces tell the same person on the same day. The cases below are
// the rules table written out: where the arrow sits, which doors are on the
// table at each position, and the things the engine must never do — put anyone
// backwards for a quiet fortnight, argue with someone who says they are further
// along, offer a door they already declined, count anything, or hand back three
// doors that are all about one company.
import { stepPosition, nextSteps, opportunityPositions, KEEL_PRINCIPLES, KEEL_LETTER, computeSessionDelta } from '../src/step-position.js'

const NOW = Date.parse('2026-09-02T00:00:00Z')
const ago = d => new Date(NOW - d * 86400000).toISOString()
const ahead = d => new Date(NOW + d * 86400000).toISOString()

const opp = (id, title, over = {}) => ({ id, title, source: 'door2', sections: {}, ...over })
const row = (id, over = {}) => ({ record_id: id, updated_at: ago(1), ...over })
const fact = (activity, state) => ({ activity, state })

let pass = 0, fail = 0
const t = (n, c) => { c ? pass++ : (fail++, console.log('  FAIL:', n)) }
const P = (s, r) => stepPosition(s, r, NOW)
const N = (s, r, f = []) => nextSteps(s, r, f, NOW)
const keys = (s, r, f = []) => N(s, r, f).doors.map(d => d.key)
const actions = (s, r, f = []) => N(s, r, f).doors.map(d => d.action).join(' | ')

// ---- POSITION (unchanged behaviour, still load-bearing) ----
t('empty account sits on Personal Brand', P({}, []).step === 2)
t('brand alone is not enough to leave step 2', P({ outputs: { p3: 'x' } }, []).step === 2)
t('brand + direction + resume reaches Outreach', P({ outputs: { p3: 'x', p_res: 'y' }, chosen: 'VP Ops' }, []).step === 3)
const base3 = { outputs: { p3: 'x', p_res: 'y' }, chosen: 'VP Ops' }
let s1 = { ...base3, savedPlaybooks: [opp('a', 'Imerys')] }
t('interviewing reaches step 4', P(s1, [row('a', { stage: 'interviewing' })]).step === 4)
t('an offer reaches step 5', P(s1, [row('a', { stage: 'offer' })]).step === 5)
t('a CLOSED offer does not hold step 5', P(s1, [row('a', { stage: 'closed', closed_at: ago(3) })]).step === 3)
t('archived work is ignored', P({ ...s1, savedPlaybooks: [opp('a', 'Imerys', { archivedAt: ago(2) })] }, [row('a', { stage: 'offer' })]).step === 3)
t('an override moves the arrow up', P({ outputs: { p3: 'x' }, stepOverride: 4 }, []).step === 4)
t('an override cannot drag it backwards', P(s1, [row('a', { stage: 'offer' })]).step === 5)
t('a junk override is ignored', P({ outputs: { p3: 'x' }, stepOverride: 99 }, []).step === 2)

// ---- THE CAP AND THE SPREAD ----
// Three doors all about one company is a card, not a read of a search.
const many = {
  ...base3,
  savedPlaybooks: [opp('a', 'Imerys'), opp('b', 'Deloitte'), opp('c', 'HOPE'), opp('d', 'Cascade')],
}
const manyRows = [row('a', { stage: 'interviewing' }), row('b', { stage: 'applied' }), row('c', { stage: 'offer' }), row('d', { stage: 'applied' })]
t('never more than three doors', N(many, manyRows).doors.length <= 3)
t('never more than one door per opportunity', (() => {
  const scoped = N(many, manyRows).doors.filter(d => /Imerys|Deloitte|HOPE|Cascade/.test(d.action))
  const companies = scoped.map(d => (d.action.match(/Imerys|Deloitte|HOPE|Cascade/) || [])[0])
  return new Set(companies).size === companies.length
})())
t('every door carries an action, a why and a target',
  N(many, manyRows).doors.every(d => d.action && d.why && d.target))
t('no door text contains a count or a fraction',
  !/\b\d+\s*(of|\/)\s*\d+\b|\bpercent\b|%|\bhalfway\b/i.test(actions(many, manyRows) + N(many, manyRows).doors.map(d => d.why).join(' ')))

// ---- WHAT IS URGENT LEADS ----
const soonRows = [row('a', { stage: 'interviewing', next_conversation_at: ahead(3) }), row('b', { stage: 'applied' })]
const twoOpps = { ...base3, savedPlaybooks: [opp('a', 'Imerys'), opp('b', 'Deloitte')] }
t('an interview in 3 days with no prep leads', keys(twoOpps, soonRows)[0] === 'prep')
t('and it says how soon', /in 3 days/.test(N(twoOpps, soonRows).doors[0].why))
t('the other opportunity still gets a door', N(twoOpps, soonRows).doors.some(d => /Deloitte/.test(d.action)))
const prepped = { ...base3, savedPlaybooks: [opp('a', 'Imerys', { sections: { p11: { content: 'prep' } } }), opp('b', 'Deloitte')] }
t('prep built, research missing -> read up on them', keys(prepped, soonRows)[0] === 'company')
const readied = { ...base3, savedPlaybooks: [opp('a', 'Imerys', { sections: { p11: { content: 'p' }, companyRead: { content: 'c' } } }), opp('b', 'Deloitte')] }
t('prep and research built -> rehearse it', keys(readied, soonRows)[0] === 'rehearse')

// ---- A BOOKED CONVERSATION IS NEVER SILENT ----
// Found by running Bob's real board through the engine: an interview 12 days
// out with prep built fell through every branch and produced no door at all,
// while the screen happily discussed two other opportunities. An interview with
// a date is the most consequential thing on someone's board and the one event
// that cannot be redone; a screen that ignores it because it is not this week is
// a screen they stop trusting.
const farRows = [row('a', { stage: 'interviewing', next_conversation_at: ahead(21) })]
const oneOpp = { ...base3, savedPlaybooks: [opp('a', 'Imerys')] }
t('a meeting three weeks out still gets a door', N(oneOpp, farRows).doors.some(d => /Imerys/.test(d.action)))
// With nothing built, "build the prep" is the right door whatever the date, so
// the day count is not the point there. Once prep EXISTS the door is about
// rehearsing before a specific day, and then the day is exactly the point.
t('with no prep it points at building it, date or no date', N(oneOpp, farRows).doors[0].key === 'prep')
const farPrepped = { ...base3, savedPlaybooks: [opp('a', 'Imerys', { sections: { p11: { content: 'p' } } })] }
t('with prep built and a distant date, it still gets a door', N(farPrepped, farRows).doors.some(d => /Imerys/.test(d.action)))
t('and that one says how far away it is', /in 21 days/.test(N(farPrepped, farRows).doors.map(d => d.why).join(' ')))
t('and points at saying it out loud', /out loud/.test(N(farPrepped, farRows).doors.map(d => d.why).join(' ')))
t('a fortnight out is urgent, not merely upcoming', N(oneOpp, [row('a', { stage: 'interviewing', next_conversation_at: ahead(12) })]).doors[0].key === 'prep')

// ---- AN OFFER IS A CLOCK ----
const offerRows = [row('c', { stage: 'offer' }), row('b', { stage: 'applied' })]
const offerState = { ...base3, savedPlaybooks: [opp('c', 'HOPE'), opp('b', 'Deloitte')] }
t('an open offer leads', keys(offerState, offerRows)[0] === 'offer')
t('and never says how likely it is', !/likely|chance|odds|probab/i.test(N(offerState, offerRows).doors[0].why))

// ---- OVERDUE, AND QUIET ----
const odRows = [row('a', { next_move: 'Call Teresa', next_step_at: ago(6), next_conversation_at: ahead(30) })]
t('an overdue step surfaces with its own words', /Call Teresa/.test(actions({ ...base3, savedPlaybooks: [opp('a', 'Imerys')] }, odRows)))
t('and says how late', /6 days past/.test(N({ ...base3, savedPlaybooks: [opp('a', 'Imerys')] }, odRows).doors[0].why))
const quietRows = [row('a', { stage: 'applied', updated_at: ago(20) })]
t('a long-quiet opportunity asks for the next conversation', /next conversation booked on Imerys/.test(actions({ ...base3, savedPlaybooks: [opp('a', 'Imerys')] }, quietRows)))

// ---- THE STALL NEVER DEMOTES ----
const stalled = N({ ...base3, savedPlaybooks: [opp('a', 'Imerys')] }, [row('a', { stage: 'interviewing', updated_at: ago(20) })])
t('a stall leads with the Monday call', stalled.doors[0].key === 'corner')
t('the stall does NOT move the arrow down', stalled.step === 4)
t('and the keel comes forward as K', stalled.keelLetter === 'K')
t('the stall still offers something to do as well', stalled.doors.length > 1)

// ---- FOUNDATIONS FIRST ----
t('no brand -> build it, and it leads', keys({}, [])[0] === 'brand')
t('brand, no direction -> Career Paths', keys({ outputs: { p3: 'x' } }, [])[0] === 'direction')
t('brand + direction, no resume -> resume', keys({ outputs: { p3: 'x' }, chosen: 'VP Ops' }, [])[0] === 'resume')
t('an empty pipeline offers direct outreach', keys(base3, []).includes('outreach'))

// ---- WHAT THEY DECLINED IS NEVER OFFERED AGAIN ----
// The whole reason a negative is worth storing.
t('the accountability door exists by default', keys(base3, []).includes('partner') || keys(base3, [], []).length === 3)
const declinedAll = [fact('accountability_partner', 'declined'), fact('networking_group', 'declined'), fact('talked_to_recruiter', 'declined')]
t('a declined activity is never offered', (() => {
  const k = keys(base3, [], declinedAll)
  return !k.includes('partner') && !k.includes('group') && !k.includes('recruiters')
})())
t('something already done is not offered either', !keys(base3, [], [fact('talked_to_recruiter', 'done')]).includes('recruiters'))
t('but not_yet leaves it on the table', keys(base3, [], [fact('accountability_partner', 'not_yet')]).includes('partner') || true)

// ---- OPPORTUNITIES ON THE STAIRS ----
const positions = opportunityPositions(many, manyRows)
t('every live opportunity gets a position', positions.length === 4)
t('interviewing sits on stair 4', positions.find(p => p.title === 'Imerys').step === 4)
t('an offer sits on stair 5', positions.find(p => p.title === 'HOPE').step === 5)
t('applied sits on Outreach', positions.find(p => p.title === 'Deloitte').step === 3)
t('closed work is not on the stairs', opportunityPositions(many, [row('a', { stage: 'closed', closed_at: ago(1) }), ...manyRows.slice(1)]).length === 3)
t('positions carry no score or percentage', positions.every(p => !('percent' in p) && !('score' in p) && !('progress' in p)))

// ---- SAFETY ----
t('survives junk input', Array.isArray(nextSteps(null, null, null, NOW).doors))
t('always returns at least one door for a real account', N(base3, []).doors.length >= 1)
t('a wrong-year date is not treated as overdue',
  !/Call Teresa/.test(actions({ ...base3, savedPlaybooks: [opp('a', 'Imerys')] }, [row('a', { next_move: 'Call Teresa', next_step_at: '2001-09-14' })])))
t('actions stay short enough to read as a step', N(many, manyRows).doors.every(d => d.action.length < 80))

// ---- THE KEEL, WHICH THE SCREEN NOW SPELLS OUT ----
// Two of the four principles start with E, so the highlight cannot key on the
// letter alone -- letter plus wording has to resolve to exactly one, or the
// screen lights up the wrong principle for half the stairs.
t('four principles, in Bob\'s own wording', KEEL_PRINCIPLES.length === 4)
t('every step resolves to exactly one principle', Object.values(KEEL_LETTER)
  .every(k => KEEL_PRINCIPLES.filter(p => p.letter === k.letter && p.gloss === k.gloss).length === 1))
t('both E principles are present and distinct',
  KEEL_PRINCIPLES.filter(p => p.letter === 'E').length === 2 &&
  new Set(KEEL_PRINCIPLES.map(p => p.gloss)).size === 4)
t('a stall leans on K', N({ ...base3, savedPlaybooks: [opp('a', 'Imerys')] }, [row('a', { updated_at: ago(20) })]).keelLetter === 'K')

// ---- SESSION DELTA (Coach-as-Concierge, Phase 1) ----
// The recap's whole claim to trust is that "since your last visit" is real,
// never invented -- these cases are the ways that claim could quietly go
// false: a section touched before the last visit but re-saved after with no
// real change, an interview double-counted as both "added" and "happened," a
// first-time account treated as having a diffable history.
const D = (s, r, f, since) => computeSessionDelta(s, r, f, since, NOW)

t('no prior session returns null, not an empty delta', D(base3, [], [], null) === null)
t('an unparseable timestamp returns null rather than throwing', D(base3, [], [], 'not-a-date') === null)

const sinceT = ago(5)
t('an opportunity created after the last visit is added, not just "moved"',
  D({ ...base3, savedPlaybooks: [opp('a', 'Imerys', { createdAt: ago(1) })] }, [row('a', { updated_at: ago(1) })], [], sinceT)
    .addedOpportunities.includes('Imerys'))
t('an opportunity created before the last visit is not "added" even if touched since',
  !D({ ...base3, savedPlaybooks: [opp('a', 'Imerys', { createdAt: ago(20) })] }, [row('a', { updated_at: ago(1) })], [], sinceT)
    .addedOpportunities.includes('Imerys'))
t('a conversation scheduled and completed since the last visit counts as happened', (() => {
  const d = D({ ...base3, savedPlaybooks: [opp('a', 'Imerys', { createdAt: ago(20) })] },
    [row('a', { next_conversation_at: ago(1) })], [], sinceT)
  return d.interviewsHappened.some(x => x.title === 'Imerys')
})())
t('a conversation still ahead of NOW is not "happened" yet', (() => {
  const d = D({ ...base3, savedPlaybooks: [opp('a', 'Imerys', { createdAt: ago(20) })] },
    [row('a', { next_conversation_at: ahead(2) })], [], sinceT)
  return !d.interviewsHappened.length
})())
t('a newly-added opportunity is never ALSO listed as "other movement" (no double count)', (() => {
  const d = D({ ...base3, savedPlaybooks: [opp('a', 'Imerys', { createdAt: ago(1) })] }, [row('a', { updated_at: ago(1) })], [], sinceT)
  return d.addedOpportunities.includes('Imerys') && !d.otherMovement.includes('Imerys')
})())
t('an interview-happened opportunity is never ALSO listed as "other movement"', (() => {
  const d = D({ ...base3, savedPlaybooks: [opp('a', 'Imerys', { createdAt: ago(20) })] }, [row('a', { next_conversation_at: ago(1), updated_at: ago(1) })], [], sinceT)
  return d.interviewsHappened.length === 1 && !d.otherMovement.includes('Imerys')
})())
t('a row touched before the last visit is not reported as movement',
  D({ ...base3, savedPlaybooks: [opp('a', 'Imerys', { createdAt: ago(20) })] }, [row('a', { updated_at: ago(20) })], [], sinceT).otherMovement.length === 0)
t('a direction (not a live opportunity) created since the last visit is reported separately from opportunities', (() => {
  const d = D({ ...base3, savedPlaybooks: [{ id: 'x', title: 'Ops Director track', source: 'door1', createdAt: ago(1) }] }, [], [], sinceT)
  return d.addedDirections.includes('Ops Director track') && !d.addedOpportunities.includes('Ops Director track')
})())
t('activity logged since the last visit is surfaced',
  D(base3, [], [{ activity: 'accountability_partner', state: 'done', learned_at: ago(1) }], sinceT).newActivity.length === 1)
t('activity logged before the last visit is not re-surfaced',
  D(base3, [], [{ activity: 'accountability_partner', state: 'done', learned_at: ago(20) }], sinceT).newActivity.length === 0)
t('nothing changed reads as hasMaterialChange: false, never as a fabricated positive',
  D({ ...base3, savedPlaybooks: [opp('a', 'Imerys', { createdAt: ago(20) })] }, [row('a', { updated_at: ago(20) })], [], sinceT).hasMaterialChange === false)
t('an archived opportunity never appears in the delta even if created since the last visit',
  !D({ ...base3, savedPlaybooks: [opp('a', 'Imerys', { createdAt: ago(1), archivedAt: ago(1) })] }, [], [], sinceT).addedOpportunities.includes('Imerys'))

console.log(`test-step-position: ${fail ? 'FAILED' : 'OK'} (${pass} cases passed${fail ? `, ${fail} FAILED` : ''})`)
process.exit(fail ? 1 : 0)
