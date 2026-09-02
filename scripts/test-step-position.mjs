// Your Next Step — the position engine (src/step-position.js).
//
// This is the one function the screen and My Coach BOTH read, so a change here
// changes what two surfaces tell the same person on the same day. The cases
// below are the rules table written out: where the arrow sits, what the one step
// is at each stair, and the three things the engine must never do — put anyone
// backwards for a quiet fortnight, argue with a person who says they are further
// along, or read a wrong-year date as a real deadline.
import { stepPosition, nextStep } from '../src/step-position.js'
const NOW = Date.parse('2026-09-02T00:00:00Z')
const ago = d => new Date(NOW - d * 86400000).toISOString()
const ahead = d => new Date(NOW + d * 86400000).toISOString()

const opp = (id, title, over = {}) => ({ id, title, source: 'door2', outputs: {}, ...over })
const row = (id, over = {}) => ({ record_id: id, updated_at: ago(1), ...over })

let pass = 0, fail = 0
const t = (n, c) => { c ? pass++ : (fail++, console.log('  FAIL:', n)) }
const P = (s, r) => stepPosition(s, r, NOW)
const N = (s, r) => nextStep(s, r, NOW)

// ---- POSITION ----
t('empty account sits on Personal Brand', P({}, []).step === 2)
t('brand alone is not enough to leave step 2', P({ outputs: { p3: 'x' } }, []).step === 2)
t('brand + direction but no resume still holds step 2', P({ outputs: { p3: 'x' }, chosen: 'VP Ops' }, []).step === 2)
t('brand + direction + resume reaches Outreach', P({ outputs: { p3: 'x', p_res: 'y' }, chosen: 'VP Ops' }, []).step === 3)
t('an interview overrides an unfinished resume', P({ outputs: { p3: 'x' }, chosen: 'VP Ops', savedPlaybooks: [opp('a', 'Imerys')] }, [row('a', { stage: 'interviewing' })]).step === 4)
let s = { outputs: { p3: 'x', p_res: 'y' }, chosen: 'VP Ops', savedPlaybooks: [opp('a', 'Imerys')] }
t('interviewing reaches step 4', P(s, [row('a', { stage: 'interviewing' })]).step === 4)
t('an offer reaches step 5', P(s, [row('a', { stage: 'offer' })]).step === 5)
t('a CLOSED offer does not hold step 5', P(s, [row('a', { stage: 'closed', closed_at: ago(3) })]).step === 3)
t('archived work is ignored', P({ ...s, savedPlaybooks: [opp('a', 'Imerys', { archivedAt: ago(2) })] }, [row('a', { stage: 'offer' })]).step === 3)

// ---- THE PERSON OUTRANKS THE COMPUTATION ----
t('an override moves the arrow up', P({ outputs: { p3: 'x' }, stepOverride: 4 }, []).step === 4)
t('an override cannot drag it backwards', P(s, [row('a', { stage: 'offer' })], NOW).step === 5)
t('a junk override is ignored', P({ outputs: { p3: 'x' }, stepOverride: 99 }, []).step === 2)
t('override retires once reality passes it', P({ ...s, stepOverride: 3 }, [row('a', { stage: 'offer' })]).step === 5)

// ---- THE STALL ----
let quiet = P(s, [row('a', { stage: 'interviewing', updated_at: ago(20) })])
t('20 quiet days is a stall', quiet.stalled === true)
t('the stall does NOT move the arrow down', quiet.step === 4)
t('13 days is not yet a stall', P(s, [row('a', { stage: 'interviewing', updated_at: ago(13) })]).stalled === false)
t('no pipeline means no stall', P({ outputs: { p3: 'x' } }, []).stalled === false)
let sn = N(s, [row('a', { stage: 'interviewing', updated_at: ago(20) })])
t('a stall reaches for the Monday call', /Monday call/.test(sn.action))
t('a stall carries K', sn.keelLetter === 'K')
t('a stall still reports step 4', sn.step === 4)

// ---- STEP 2 ----
t('no brand -> build it', N({}, []).target === 'p3')
t('brand, no direction -> Career Paths', N({ outputs: { p3: 'x' } }, []).target === 'laneSelect')
t('brand + direction, no resume -> resume', /resume/i.test(N({ outputs: { p3: 'x' }, chosen: 'VP Ops' }, []).action))
t('step 2 carries L', N({}, []).keelLetter === 'L')

// ---- STEP 3 ----
const base3 = { outputs: { p3: 'x', p_res: 'y' }, chosen: 'VP Ops' }
t('no opportunities -> direct outreach', /nothing posted/.test(N(base3, []).action))
let s3 = { ...base3, savedPlaybooks: [opp('a', 'Imerys')] }
let r3 = [row('a', { next_move: 'Call Teresa', next_step_at: ago(6) })]
t('an overdue step wins', /Call Teresa/.test(N(s3, r3).action))
t('and says how late it is', /6 days past/.test(N(s3, r3).why))
t('no meeting booked -> get one booked', /next conversation booked on Imerys/.test(N(s3, [row('a')]).action))
t('a future meeting is not chased', !/next conversation booked/.test(N(s3, [row('a', { next_conversation_at: ahead(5) })]).action))
t('step 3 carries E', N(base3, []).keelLetter === 'E')

// ---- STEP 4 ----
let s4 = { ...base3, savedPlaybooks: [opp('a', 'Imerys')] }
t('interviewing without prep -> build prep', /Build Interview Prep for Imerys/.test(N(s4, [row('a', { stage: 'interviewing' })]).action))
let s4b = { ...base3, savedPlaybooks: [opp('a', 'Imerys', { sections: { p11: { content: 'prep' } } })] }
t('prep built, no panel -> add who you are meeting', /Add who you are meeting/.test(N(s4b, [row('a', { stage: 'interviewing' })]).action))
let s4c = { ...base3, savedPlaybooks: [opp('a', 'Imerys', { sections: { p11: { content: 'prep' } }, panel: { interviewers: [{ name: 'Brad Cummings' }] } })] }
t('prep + panel -> work it', /Work through your prep/.test(N(s4c, [row('a', { stage: 'interviewing' })]).action))
t('and counts the panel', /1 person named/.test(N(s4c, [row('a', { stage: 'interviewing' })]).why))

// ---- STEP 5 ----
let s5 = { ...base3, savedPlaybooks: [opp('a', 'Imerys'), opp('b', 'Cascade')] }
t('two offers -> compare them', /Compare your offers/.test(N(s5, [row('a', { stage: 'offer' }), row('b', { stage: 'offer' })]).action))
t('one offer -> work it', /Work your offer on Imerys/.test(N(s5, [row('a', { stage: 'offer' }), row('b', { stage: 'applied' })]).action))
t('step 5 carries K', N(s5, [row('a', { stage: 'offer' })]).keelLetter === 'K')

// ---- SHAPE / SAFETY ----
const r = N(s4c, [row('a', { stage: 'interviewing' })])
t('always returns an action', typeof r.action === 'string' && r.action.length > 0)
t('always returns a why', typeof r.why === 'string' && r.why.length > 0)
t('always returns a target', typeof r.target === 'string' && r.target.length > 0)
t('action stays short enough to be a step', r.action.length < 80)
t('survives junk input', typeof N(null, null).action === 'string')
t('a wrong-year date is not treated as overdue', !/Call Teresa/.test(N(s3, [row('a', { next_move: 'Call Teresa', next_step_at: '2001-09-14' })]).action))

console.log(`test-step-position: ${fail ? 'FAILED' : 'OK'} (${pass} cases passed${fail ? `, ${fail} FAILED` : ''})`)
process.exit(fail ? 1 : 0)
