// Where this person stands, and the two or three moves worth making from there.
//
// THIS MODULE IS THE WHOLE REASON THE FEATURE HOLDS TOGETHER. The screen and My
// Coach must never offer different doors: someone who does not know what to do,
// handed two different answers, is worse off than before they asked. So both
// read this, and WHAT IS ON THE TABLE is deterministic -- a rules table, no
// model in the loop. The model phrases and prioritises; it never invents a door.
//
// It used to return exactly one action. That was a principle about paralysis
// ("what you should be doing, not what you could be doing") encoded as a rule
// about quantity, and the rule outlived the situation it was drawn for. Five
// tasks is a backlog; two or three doors with a recommendation is agency, which
// is the thing this product exists to give back. A Sherpa does not hand you one
// footstep -- it says we can go up the ridge or round the glacier, here is the
// one I would take, and I will walk it with you.
//
// FOUR RULES THAT ARE NOT NEGOTIABLE:
//
//  - NEVER MORE THAN THREE. Beyond that it is a to-do list and we are back to
//    the paralysis.
//  - AT MOST ONE DOOR PER OPPORTUNITY. Three doors all about Imerys is a card,
//    not a read of a search. The spread is what makes it worth looking at.
//  - NO PERCENTAGE, NO FRACTION, NO ESTIMATE OF HOW CLOSE AN OFFER IS. Nobody
//    knows, a number that sits still for six weeks is a daily reminder of being
//    stuck, and it is a promise the product cannot keep.
//  - NOTHING COUNTS WHAT DID NOT HAPPEN. No tally of missed steps, no streaks.
//
// Plain `.js`, no JSX: api/coach.js imports it across the api/* <-> src/*
// boundary, where `.mjs` is unsafe (CLAUDE.md section 8; the 2026-05-27
// FUNCTION_INVOCATION_FAILED outage, PR #76, reverted at 940557b).
import { sectionState } from './playbook-sections.js'

// The five sections of the book, in the book's own order. The staircase draws
// all five; the arrow only ever sits on 2 through 5. Attitude is step one and
// never holds the arrow, because it is the keel -- "not just the starting
// point... what you carry with you for the entire journey." Nobody is ever ON
// attitude; everybody is always on it.
export const STEPS = [
  { n: 1, key: 'attitude',  label: 'Attitude' },
  { n: 2, key: 'brand',     label: 'Personal Brand' },
  { n: 3, key: 'outreach',  label: 'Outreach' },
  { n: 4, key: 'interview', label: 'Interviewing' },
  { n: 5, key: 'negotiate', label: 'Negotiating' },
]

// The KEEL letter each step leans on hardest. Step 1 carries all four, which is
// why it has no single letter of its own.
export const KEEL_LETTER = {
  2: { letter: 'L', gloss: 'Let the past go' },
  3: { letter: 'E', gloss: 'Expect the best from yourself and others' },
  4: { letter: 'E', gloss: 'Emotional ups and downs are natural' },
  5: { letter: 'K', gloss: 'Know you will find another job' },
}

const DAY = 86400000
const STALL_DAYS = 14
// An interview this close is the one thing that outranks everything else on the
// board. Past it, preparation is still worth doing and is no longer urgent.
const INTERVIEW_SOON_DAYS = 10

const txt = (v) => (typeof v === 'string' ? v.trim() : '')
const built = (outputs, key) => !!txt(outputs && outputs[key])

// Whole-day difference by calendar date; positive = in the past. Normalised
// through Date -> ISO before slicing, because String(dateObj).slice(0,10) yields
// a yearless "Tue Aug 18" and Date.parse defaults that to 2001 -- the bug that
// once read a pipeline date as 9,131 days overdue.
function daysAgo(value, now) {
  if (!value) return null
  let iso = ''
  try { iso = new Date(value).toISOString().slice(0, 10) } catch { return null }
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  const today = Date.parse(new Date(now).toISOString().slice(0, 10))
  const d = Math.round((today - t) / DAY)
  // A date more than ~1yr past or ~5yr out is a wrong-year value, not a
  // deadline. Treat it as absent rather than as a number to act on.
  return (d > 366 || d < -1827) ? null : d
}

// The opportunities this person is actually working, each joined to its status
// row. Archived and closed drop out: a closed opportunity is history, and
// history never decides where someone stands today.
function activeOpportunities(state, pursuitRows) {
  const saved = Array.isArray(state && state.savedPlaybooks) ? state.savedPlaybooks : []
  const byId = new Map((Array.isArray(pursuitRows) ? pursuitRows : []).map(r => [r.record_id, r]))
  return saved
    .filter(r => r && r.source === 'door2' && !r.archivedAt)
    .map(r => ({ rec: r, status: byId.get(r.id) || {} }))
    .filter(o => !(o.status.stage === 'closed' || o.status.closed_at))
}

/**
 * Which stair the arrow sits on, and whether the search has gone quiet.
 * Highest reached wins — the arrow never walks back down.
 */
export function stepPosition(state, pursuitRows, now = Date.now()) {
  const outputs = (state && state.outputs) || {}
  const open = activeOpportunities(state, pursuitRows)

  // Step 2 holds until the BRANDING work is done, not merely started. The book
  // puts the resume inside Personal Branding, so leaving for Outreach with a
  // brand and a direction but no refreshed resume is the skipping-ahead it warns
  // about. It is not a trap: adding an opportunity or reaching an interview
  // moves the arrow up regardless, because where someone actually IS beats where
  // the sequence says they should be.
  let step = 2
  if (built(outputs, 'p3') && txt(state && state.chosen) && built(outputs, 'p_res')) step = 3
  if (open.some(o => o.status.stage === 'interviewing')) step = 4
  if (open.some(o => o.status.stage === 'offer')) step = 5

  // The person outranks the computation, always. Someone can be interviewing
  // next week with an empty pipeline, and a map that can only ever be right is a
  // map that argues with the person reading it. Their correction wins until the
  // computed position passes it — the natural expiry, because real progress
  // retires the correction rather than the product having to.
  const override = Number(state && state.stepOverride)
  if (Number.isFinite(override) && override >= 2 && override <= 5 && override > step) step = override

  // A stall is measured on the pipeline, so it only means anything once there is
  // a pipeline to go quiet. Someone still building their brand is not stalled;
  // they are early.
  let stalled = false
  let quietDays = null
  if (open.length) {
    const touched = open.map(o => daysAgo(o.status.updated_at, now)).filter(d => d != null)
    quietDays = touched.length ? Math.min(...touched) : null
    stalled = quietDays != null && quietDays >= STALL_DAYS
  }
  return { step, stalled, quietDays }
}

// Which stair each live opportunity is standing on. This is what turns the
// staircase from a diagram of the framework into a picture of THIS search: four
// markers at four different heights is information the person could not have
// told you at a glance, where a single arrow was a restatement of what they
// already knew.
const STAGE_STEP = { researching: 3, applied: 3, in_conversation: 3, interviewing: 4, offer: 5 }
export function opportunityPositions(state, pursuitRows) {
  return activeOpportunities(state, pursuitRows).map(o => ({
    id: o.rec.id,
    title: txt(o.rec.title) || 'Opportunity',
    stage: txt(o.status.stage) || 'researching',
    step: STAGE_STEP[o.status.stage] || 3,
  }))
}

// One door. `weight` orders them; lower is more pressing. `scope` is the
// opportunity it belongs to, or null for an account-level move — used to keep
// three doors from all being about the same company.
const door = (key, weight, action, why, target, scope = null, extra = {}) =>
  ({ key, weight, action, why, target, scope, ...extra })

/**
 * Everything actually available and warranted right now, ranked, with the
 * reason for each. Returns at most three, at most one per opportunity.
 *
 * Availability is the deterministic half and lives here. Which one to lead with
 * is a judgment, and the model may make its own case from this same set — but it
 * can never offer a door that is not in it, which is what stops the screen and
 * the coach disagreeing.
 */
export function nextSteps(state, pursuitRows, activityFacts = [], now = Date.now()) {
  const pos = stepPosition(state, pursuitRows, now)
  const outputs = (state && state.outputs) || {}
  const open = activeOpportunities(state, pursuitRows)
  const keel = KEEL_LETTER[pos.step] || KEEL_LETTER[2]
  const facts = new Map((Array.isArray(activityFacts) ? activityFacts : []).map(f => [f && f.activity, f && f.state]))
  // Something they told us they do not want is never offered again. That is the
  // whole reason a negative is worth storing.
  const declined = (k) => facts.get(k) === 'declined'
  const sec = (o, k) => sectionState(o.rec, k).built
  const title = (o) => txt(o.rec.title) || 'this opportunity'

  const doors = []

  // ---- foundations: nothing else is worth offering until these exist --------
  if (!built(outputs, 'p3')) {
    doors.push(door('brand', 0, 'Build your Personal Brand',
      'Everything else is built from it, and nothing further opens until it exists.', 'p3'))
  } else if (!txt(state && state.chosen)) {
    doors.push(door('direction', 1, 'Pick a direction to work',
      'Your brand is built. A direction turns it into a playbook you can act on.', 'laneSelect'))
  } else if (!built(outputs, 'p_res')) {
    doors.push(door('resume', 2, 'Refresh your resume for this direction',
      'Your brand and direction are settled, and the resume is still the first thing anyone reads.', 'focus'))
  }

  // ---- per opportunity: the most pressing thing on each, one each ----------
  for (const o of open) {
    const t = title(o)
    const meetingIn = daysAgo(o.status.next_conversation_at, now)
    const soon = meetingIn != null && meetingIn <= 0 && Math.abs(meetingIn) <= INTERVIEW_SOON_DAYS
    const overdue = daysAgo(o.status.next_step_at, now)
    const cand = []

    // A conversation days away with nothing prepared outranks everything.
    if (soon && !sec(o, 'p11')) {
      cand.push(door('prep', 5, `Build Interview Prep for ${t}`,
        `You are talking to them ${meetingIn === 0 ? 'today' : `in ${Math.abs(meetingIn)} day${Math.abs(meetingIn) === 1 ? '' : 's'}`} and the prep is not built. It works from your own stories rather than a generic question list.`,
        'pipeline', o.rec.id))
    } else if (soon && !sec(o, 'companyRead')) {
      cand.push(door('company', 6, `Read up on ${t} before you meet them`,
        'Your prep is built and the company research is not. It is what turns good answers into answers about them.', 'pipeline', o.rec.id))
    } else if (soon) {
      cand.push(door('rehearse', 7, `Work through your prep for ${t}`,
        'It is built and the conversation is close. Saying it out loud is what turns it into an answer.', 'pipeline', o.rec.id))
    }

    if (!cand.length && overdue != null && overdue > 0 && txt(o.status.next_move)) {
      cand.push(door('overdue', 8, `Do the step you set: ${txt(o.status.next_move)}`,
        `On ${t}, ${overdue} day${overdue === 1 ? '' : 's'} past the date you gave it.`, 'pipeline', o.rec.id))
    }

    if (!cand.length && o.status.stage === 'offer') {
      cand.push(door('offer', 4, `Work your offer on ${t}`,
        'You earned it. Now close it on the best terms — the analysis is built from your own priorities, and whether to accept is always your call.', 'pipeline', o.rec.id))
    }

    if (!cand.length && o.status.stage === 'interviewing' && !sec(o, 'p11')) {
      cand.push(door('prep', 9, `Build Interview Prep for ${t}`,
        'You are interviewing there and the prep is not built. It works from your own stories rather than a generic question list.', 'pipeline', o.rec.id))
    }

    if (!cand.length && (meetingIn == null || meetingIn > 0)) {
      const quietFor = daysAgo(o.status.updated_at, now)
      cand.push(door('book', quietFor != null && quietFor >= 14 ? 10 : 12,
        `Get the next conversation booked on ${t}`,
        quietFor != null && quietFor >= 14
          ? `Nothing has moved there in ${quietFor} days and there is nothing on the calendar. A specific ask is easier to answer than a check-in.`
          : 'It is live and there is nothing scheduled ahead of it. A specific ask is easier to answer than a check-in.',
        'pipeline', o.rec.id))
    }

    if (cand.length) doors.push(cand.sort((a, b) => a.weight - b.weight)[0])
  }

  // ---- breadth: the moves that are not about any one opportunity -----------
  if (!open.length && built(outputs, 'p3') && txt(state && state.chosen)) {
    doors.push(door('outreach', 3, 'Write to one company that has nothing posted',
      'A posting is an RFP: your resume goes in the pile and the waiting starts. Direct outreach is the channel where the next move stays yours.', 'focus'))
  }
  if (txt(state && state.chosen) && !declined('talked_to_recruiter') && facts.get('talked_to_recruiter') !== 'done') {
    doors.push(door('recruiters', 14, 'Find recruiters who work your path',
      'A recruiter who covers your function and level knows what is open before it is posted, and keeps knowing it after this search ends.', 'focus'))
  }
  if (open.length && !declined('asked_for_intro')) {
    doors.push(door('intro', 13, 'See who you already know at these companies',
      'A name inside beats a cold application, and your own network usually holds more of them than it feels like.', 'pipeline'))
  }
  if (!declined('accountability_partner') && facts.get('accountability_partner') !== 'done') {
    doors.push(door('partner', 16, 'Get someone holding you accountable',
      'One person who knows what you said you would do this week. It costs nothing to set up and it changes what gets done between Mondays.', 'resources'))
  }
  if (!declined('networking_group') && facts.get('networking_group') !== 'done') {
    doors.push(door('group', 15, 'Find a group doing this alongside you',
      'A search run alone gets shorter and lonelier every week. A group is where you hear what other people tried and what came back.', 'resources'))
  }

  // ---- the stall: people, not tactics -------------------------------------
  // Nobody is demoted to step one for a hard fortnight. The arrow holds its
  // stair and the keel comes forward instead, because going back down the stairs
  // after two quiet weeks is exactly the message a discouraged person does not
  // need — and the book's own remedy here is people.
  if (pos.stalled) {
    doors.unshift(door('corner', -1, 'Take it to the Monday call',
      `Nothing has moved on your pipeline in ${pos.quietDays} days. Career Club Corner is free, Mondays at noon Eastern, and one conversation with people in the same search is the fastest way to break a quiet stretch.`,
      'resources'))
  }

  // Rank, then thin. One per opportunity is already guaranteed above; this keeps
  // the account-level doors from crowding out the live ones and caps the whole
  // thing at three.
  const ranked = doors.sort((a, b) => a.weight - b.weight)
  const picked = []
  const usedScopes = new Set()
  for (const d of ranked) {
    if (picked.length >= 3) break
    if (d.scope && usedScopes.has(d.scope)) continue
    if (d.scope) usedScopes.add(d.scope)
    picked.push(d)
  }

  return {
    ...pos,
    keelLetter: pos.stalled ? 'K' : keel.letter,
    keelGloss: pos.stalled ? 'Know you will find another job' : keel.gloss,
    doors: picked.map(({ weight, scope, ...rest }) => rest),
    positions: opportunityPositions(state, pursuitRows),
  }
}

// Back-compat for callers that want the single leading move. The doors are the
// interface now; this is the first of them.
export function nextStep(state, pursuitRows, activityFacts = [], now = Date.now()) {
  const r = nextSteps(state, pursuitRows, activityFacts, now)
  const first = r.doors[0] || null
  return { ...r, action: first ? first.action : '', why: first ? first.why : '', target: first ? first.target : 'pipeline' }
}
