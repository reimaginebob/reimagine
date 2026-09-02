// Where this person is on the Making Your Own Weather staircase, and the one
// thing worth doing from there.
//
// THIS MODULE IS THE WHOLE REASON THE FEATURE HOLDS TOGETHER. The screen and My
// Coach must never recommend different things: someone who does not know what to
// do, handed two answers, is worse off than before they asked. So both call
// this, and the recommendation is DETERMINISTIC -- a rules table, no model in
// the loop. The model phrases things; it does not decide them.
//
// Plain `.js`, no JSX: api/coach.js imports it across the api/* <-> src/*
// boundary, where `.mjs` is unsafe (CLAUDE.md section 8; the 2026-05-27
// FUNCTION_INVOCATION_FAILED outage, PR #76, reverted at 940557b).
//
// The five steps are the book's own sections, in the book's own order --
// "read it in order, at least the first time" -- and the arrow only ever sits on
// 2 through 5. Attitude is step one on the staircase and never holds the arrow,
// because it is the keel: "not just the starting point... what you carry with
// you for the entire journey." Nobody is ever ON attitude; everybody is always
// on it.
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
  return Math.round((today - t) / DAY)
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
  const brandBuilt = built(outputs, 'p3')
  const directionPicked = !!txt(state && state.chosen)
  const open = activeOpportunities(state, pursuitRows)

  // Step 2 holds until the BRANDING work is done, not merely started. The book
  // puts the resume inside Personal Branding -- "how to express that across your
  // resume and LinkedIn profile" -- so leaving for Outreach with the brand and a
  // direction but no refreshed resume is the skipping-ahead the book warns about.
  // It is not a trap: adding an opportunity or reaching an interview moves the
  // arrow up regardless, because where someone actually IS beats where the
  // sequence says they should be.
  let step = 2
  if (brandBuilt && directionPicked && built(outputs, 'p_res')) step = 3
  if (open.some(o => o.status.stage === 'interviewing')) step = 4
  if (open.some(o => o.status.stage === 'offer')) step = 5

  // The person outranks the computation, always. Someone can be interviewing
  // next week with an empty pipeline, and a map that can only ever be right is a
  // map that argues with the person reading it. Their correction wins until the
  // computed position passes it -- which is the natural expiry, because real
  // progress retires the correction rather than the product having to.
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

/**
 * The one thing worth doing, and why. First match wins within the step.
 * Returns { step, stalled, action, why, target, keelLetter, keelGloss }.
 */
export function nextStep(state, pursuitRows, now = Date.now()) {
  const pos = stepPosition(state, pursuitRows, now)
  const outputs = (state && state.outputs) || {}
  const open = activeOpportunities(state, pursuitRows)
  const title = (o) => txt(o && o.rec && o.rec.title) || 'this opportunity'
  // An opportunity's built sections live on rec.sections, and the shape is not
  // uniform: some are { content, builtAt }, some are a bare string. Read both.
  const sectionBuilt = (o, key) => {
    const sec = o && o.rec && o.rec.sections && o.rec.sections[key]
    if (!sec) return false
    return !!txt(typeof sec === 'string' ? sec : sec.content)
  }

  // THE STALL OVERRIDE. Nobody is demoted to step one for a hard fortnight: the
  // arrow holds its stair and the keel comes forward instead. Going back down
  // the stairs after two quiet weeks is exactly the message a discouraged person
  // does not need, and the book's own remedy here is people, not tactics.
  if (pos.stalled) {
    return {
      ...pos,
      action: 'Take it to the Monday call',
      why: `Nothing has moved on your pipeline in ${pos.quietDays} days. Career Club Corner is free, Mondays at noon Eastern, and one conversation with people in the same search is the fastest way to break a quiet stretch.`,
      target: 'resources',
      keelLetter: 'K',
      keelGloss: 'Know you will find another job',
    }
  }

  const keel = KEEL_LETTER[pos.step] || KEEL_LETTER[2]
  const out = (action, why, target) => ({ ...pos, action, why, target, keelLetter: keel.letter, keelGloss: keel.gloss })

  if (pos.step === 2) {
    if (!built(outputs, 'p3')) return out('Build your Personal Brand', 'Everything else is built from it, and nothing further opens until it exists.', 'p3')
    if (!txt(state && state.chosen)) return out('Pick a direction to work', 'Your brand is built. A direction is what turns it into a playbook you can act on.', 'laneSelect')
    return out('Refresh your resume for this direction', 'Your brand and your direction are settled, and the resume is still the one people read first.', 'focus')
  }

  if (pos.step === 3) {
    const overdue = open
      .map(o => ({ o, d: daysAgo(o.status.next_step_at, now) }))
      .filter(x => x.d != null && x.d > 0 && x.d < 400 && txt(x.o.status.next_move))
      .sort((a, b) => b.d - a.d)[0]
    if (overdue) {
      return out(`Do the step you set: ${txt(overdue.o.status.next_move)}`,
        `On ${title(overdue.o)}, ${overdue.d} day${overdue.d === 1 ? '' : 's'} past the date you gave it.`, 'pipeline')
    }
    const quiet = open.find(o => {
      const m = daysAgo(o.status.next_conversation_at, now)
      return m == null || m > 0
    })
    if (quiet) {
      return out(`Get the next conversation booked on ${title(quiet)}`,
        'It is live and there is nothing on the calendar ahead of it. A specific ask is easier to answer than a check-in.', 'pipeline')
    }
    if (!open.length) {
      return out('Write to one company that has nothing posted',
        'A posting is an RFP and your resume is the response — sent, then waited on. Direct outreach is the channel where the next move stays yours.', 'focus')
    }
    return out('Add the opportunity you are working',
      'Anything not on My Pipeline is being tracked in your head, which is where things go quiet.', 'op')
  }

  if (pos.step === 4) {
    const iv = open.find(o => o.status.stage === 'interviewing') || open[0]
    if (!sectionBuilt(iv, 'p11')) {
      return out(`Build Interview Prep for ${title(iv)}`,
        'You are interviewing there and the prep is not built. It works from your own stories rather than a generic question list.', 'pipeline')
    }
    const panel = iv && iv.rec && iv.rec.panel
    const people = panel && Array.isArray(panel.interviewers) ? panel.interviewers.filter(p => p && txt(p.name)) : []
    if (!people.length) {
      return out(`Add who you are meeting at ${title(iv)}`,
        'Your prep is built and it does not yet know who you are meeting. Naming them lets it prepare you person by person.', 'pipeline')
    }
    return out(`Work through your prep for ${title(iv)}`,
      `It is built and you know your panel — ${people.length} ${people.length === 1 ? 'person' : 'people'} named. Practising out loud is what turns it into an answer.`, 'pipeline')
  }

  const offers = open.filter(o => o.status.stage === 'offer')
  if (offers.length >= 2) {
    return out('Compare your offers side by side',
      `You have ${offers.length} offers open. Seeing them against each other is how the trade-offs stop being abstract.`, 'pipeline')
  }
  return out(`Work your offer on ${title(offers[0] || open[0])}`,
    'You earned it. Now close it on the best terms — the analysis is built from your own priorities, and whether to accept is always your call.', 'pipeline')
}
