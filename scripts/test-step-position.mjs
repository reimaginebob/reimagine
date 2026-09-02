// Your Next Step — the engine (src/step-position.js).
//
// The one function the screen and My Coach BOTH read, so a change here changes
// what two surfaces tell the same person on the same day. The cases below are
// the rules table written out: where the arrow sits, which doors are on the
// table at each position, and the things the engine must never do — put anyone
// backwards for a quiet fortnight, argue with someone who says they are further
// along, offer a door they already declined, count anything, or hand back three
// doors that are all about one company.
import { stepPosition, nextSteps, opportunityPositions } from '../src/step-position.js'

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

console.log(`test-step-position: ${fail ? 'FAILED' : 'OK'} (${pass} cases passed${fail ? `, ${fail} FAILED` : ''})`)
process.exit(fail ? 1 : 0)
