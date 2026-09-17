// Summary to notes (COACHSUMMARY, 2026-09-17). Coach can write a short
// plain-English summary of a substantive conversation about ONE opportunity
// into that opportunity's notes -- on request at any time, and on its own read
// that a thread reached a natural close, at most once per opportunity per
// rolling 24 hours. That second half is a deliberate, narrow reversal of
// #734's blanket "never offer to save because you judged the reply worth
// keeping"; everything below is the guardrails that reversal is conditional on.
//
// Three things this file exists to hold still, because each has a specific way
// of going wrong:
//
//  1. THE FLAG. GA 2026-09-17, same day it shipped, on Bob's call -- it was a
//     per-account pilot (coach_summary) for one afternoon. The checks below
//     moved with it: what they now hold still is that every signed-in account
//     has it and nobody signed out does. The pilot's own reason for existing is
//     worth keeping in view if this is ever re-gated: coach_note_agency, the
//     obvious flag to reuse and the one the brief named, had gone GA on
//     2026-09-13, so riding it would have meant no gate at all.
//  2. THE TAP. The shipped user guide promises "the only things it writes or
//     builds are the ones you tap to accept." Both COACHSUMMARY kinds end in a
//     tap, including the one the person explicitly asked for -- Bob confirmed
//     this over the brief's own "no tap required" on the asked-for path.
//  3. THE CAP, computed in code and never asked of the model, which has no
//     clock. A rule a model cannot evaluate is a rule it will approximate.
//
// Behavioral where it can be (the note builder, the arbitration tier, the
// trailer regex all run for real); source-level only for the React wiring,
// which needs a browser.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// Same dummy-credential preamble scripts/test-coach-trailers.mjs uses --
// api/coach.js builds its DB and email clients at module load.
process.env.DATABASE_URL ||= 'postgres://user:pass@localhost/dummy'
process.env.RESEND_API_KEY ||= 'dummy'
process.env.ANTHROPIC_API_KEY ||= 'dummy'

const { buildCoachSummaryCaptureNote, COACH_SUMMARY_OFFER_WINDOW_MS, arbitrateOffers, OFFER_ARBITRATION_ORDER } = await import('../api/coach.js')
const { hasCoachSummary, hasCoachNoteAgency, COACH_SUMMARY_FLAG, GRANTABLE_FLAGS } = await import('../api/_lib/feature-flags.js')

// --- 1. The flag ---------------------------------------------------------

check(COACH_SUMMARY_FLAG === 'coach_summary', `feature-flags: COACH_SUMMARY_FLAG is not 'coach_summary'`)
check(hasCoachSummary({ email: 'someone@example.com', feature_flags: [] }) === true,
  'feature-flags: an ordinary signed-in account does not have summary-to-notes -- this went GA 2026-09-17')
check(hasCoachSummary({ email: 'bob@career.club', feature_flags: [] }) === true,
  'feature-flags: an internal account does not have summary-to-notes')
check(hasCoachSummary(null) === false,
  'feature-flags: a signed-out visitor has summary-to-notes -- every gate on this surface is signed-in-only, since a summary has to land in a saved opportunity')
check(hasCoachSummary(undefined) === false, 'feature-flags: an undefined user resolves truthy')
// GA means the flag string is no longer consulted at all. A grant that still
// mattered would mean some accounts silently lack this.
check(hasCoachSummary({ email: 'someone@example.com', feature_flags: ['coach_summary'] }) ===
      hasCoachSummary({ email: 'someone@example.com', feature_flags: [] }),
  'feature-flags: holding the coach_summary flag still changes the answer -- after GA it must not be consulted')
check(!GRANTABLE_FLAGS[COACH_SUMMARY_FLAG],
  'feature-flags: coach_summary is still listed as grantable from the admin dashboard -- after GA there is nothing left to grant, and leaving it there invites a grant that reads as meaningful and is not')
// Kept as a live reference so the two stay comparable if either is re-gated.
check(hasCoachNoteAgency({ email: 'someone@example.com', feature_flags: [] }) === true,
  'feature-flags: coach_note_agency is no longer GA -- summary-to-notes assumes the notes path it writes through is available to everyone it is')

// --- 2. The prompt instruction the model actually receives ---------------

const onRequestOnly = buildCoachSummaryCaptureNote({ opportunityTitle: 'Deloitte', proactiveAllowed: false, firstFire: false })
const proactive = buildCoachSummaryCaptureNote({ opportunityTitle: 'Deloitte', proactiveAllowed: true, firstFire: false })
const firstTime = buildCoachSummaryCaptureNote({ opportunityTitle: 'Deloitte', proactiveAllowed: true, firstFire: true })

for (const [label, note] of [['on-request-only', onRequestOnly], ['proactive', proactive]]) {
  check(note.includes('COACHSUMMARY: save'), `coach.js: the ${label} instruction never names the COACHSUMMARY: save trailer`)
  check(note.includes('Deloitte'), `coach.js: the ${label} instruction does not name the opportunity in focus`)
  // The tap promise, in the instruction itself -- the model must not claim a
  // write, on either path.
  check(/NEVER say you have saved/i.test(note),
    `coach.js: the ${label} instruction does not forbid claiming the save -- the tap is the only thing that writes`)
}
check(!onRequestOnly.includes('COACHSUMMARY: offer'),
  'coach.js: the proactive half is still in the prompt when the 24-hour window is closed -- the model would offer again')
check(/Do not offer this yourself on this turn/i.test(onRequestOnly),
  'coach.js: with the window closed, the instruction does not positively tell the model to stay quiet')
check(proactive.includes('COACHSUMMARY: offer'),
  'coach.js: the proactive half is missing when the window is open -- Coach could never offer on its own, which is the new capability')
check(/natural close/i.test(proactive) && /decision reached|concern worked through|approach settled/i.test(proactive),
  'coach.js: the proactive half no longer requires real ground covered AND a natural close -- without both this becomes a nag on every reply')

// The model is never asked to do date arithmetic. It has no clock; a rule it
// cannot evaluate is a rule it guesses at, which is why proactiveAllowed is
// computed in code and the half is simply absent when false.
for (const note of [onRequestOnly, proactive, firstTime]) {
  check(!/24 hours|24-hour|last offered|yesterday/i.test(note),
    'coach.js: the instruction asks the model to reason about the 24-hour window itself -- it has no clock; the window is the caller\'s job')
}

check(!proactive.includes('you can ask for this any time') && /ask for this any time/i.test(firstTime) === true,
  'coach.js: the one-time "you can just ask" sentence is not tied to firstFire -- it would either never appear or appear on every summary')
check(firstTime.length > proactive.length && firstTime.startsWith(proactive.slice(0, 200)),
  'coach.js: the first-fire sentence is not appended to the same instruction -- it must ride the reply that is already firing, never arrive as a second message')

check(COACH_SUMMARY_OFFER_WINDOW_MS === 24 * 60 * 60 * 1000,
  `coach.js: the offer window is no longer 24 hours (${COACH_SUMMARY_OFFER_WINDOW_MS}ms)`)

// A missing title must still produce a usable instruction rather than the
// string "undefined" reaching the model.
const noTitle = buildCoachSummaryCaptureNote({ opportunityTitle: null, proactiveAllowed: true, firstFire: false })
check(!/undefined|null/.test(noTitle) && noTitle.includes('this opportunity'),
  'coach.js: a record with no title leaks undefined/null into the prompt instead of falling back to "this opportunity"')

// --- 3. The window, as the caller computes it ---------------------------
// Mirrors api/coach.js's own expression at the in-focus block; if that logic
// changes shape this stays honest only if it is changed with it, which is why
// the source check below pins the call site too.
const windowOpen = (lastOfferAt, nowMs) => {
  const last = Date.parse(lastOfferAt || '')
  return !Number.isFinite(last) || (nowMs - last) >= COACH_SUMMARY_OFFER_WINDOW_MS
}
const NOW = Date.parse('2026-09-17T12:00:00Z')
check(windowOpen(null, NOW) === true, 'window: an opportunity never offered a summary is treated as capped')
check(windowOpen('not a date', NOW) === true, 'window: an unparseable stamp closes the window forever')
check(windowOpen('2026-09-17T11:00:00Z', NOW) === false, 'window: an offer one hour ago does not close the window')
check(windowOpen('2026-09-16T11:59:00Z', NOW) === true, 'window: an offer just over 24 hours ago still closes the window')
check(windowOpen('2026-09-16T12:00:00Z', NOW) === true, 'window: an offer exactly 24 hours ago does not reopen it')

// --- 4. Arbitration ------------------------------------------------------

check(OFFER_ARBITRATION_ORDER.includes('coachSummaryOffer'),
  'coach.js: coachSummaryOffer is not in OFFER_ARBITRATION_ORDER -- it could stack a second offer bubble behind another capture in the same turn')
check(OFFER_ARBITRATION_ORDER.indexOf('coachSummaryOffer') === OFFER_ARBITRATION_ORDER.indexOf('coachNoteOffer') + 1,
  'coach.js: coachSummaryOffer no longer sits immediately after coachNoteOffer -- both are durable facts about the opportunity in focus and belong in the same tier')
{
  // A pipeline update outranks a summary: the person gets the stage move, and
  // the summary offer comes back on a later turn.
  const out = arbitrateOffers({ opportunityUpdateB64: 'x', coachSummaryOffer: 'offer' }, OFFER_ARBITRATION_ORDER)
  check(out.opportunityUpdateB64 === 'x' && !out.coachSummaryOffer,
    'arbitration: a summary offer is not yielded to a pipeline update in the same turn')
  // And it outranks the lower tiers.
  const out2 = arbitrateOffers({ coachSummaryOffer: 'save', valuesB64: 'y' }, OFFER_ARBITRATION_ORDER)
  check(out2.coachSummaryOffer === 'save' && !out2.valuesB64,
    'arbitration: a summary the person explicitly asked for loses to a values capture')
}

// --- 5. The trailer ------------------------------------------------------

const APIC = 'api/coach.js'
const coach = fs.readFileSync(APIC, 'utf8')

const sweepLine = coach.match(/^const TRAILER_NAME_SWEEP = .*$/m)
check(!!sweepLine && sweepLine[0].includes('|COACHSUMMARY|'),
  `${APIC}: COACHSUMMARY is not in TRAILER_NAME_SWEEP -- a malformed trailer would be shown to the person as machine junk`)
if (sweepLine) {
  // Run the real sweep, not a lookalike: the literal is lifted out of the
  // source and compiled here, so a change to it is a change to what this tests.
  const sweep = new Function(`return ${sweepLine[0].replace('const TRAILER_NAME_SWEEP = ', '')}`)()
  check('Here is the summary.\n\nCOACHSUMMARY: offer'.replace(sweep, '').trim() === 'Here is the summary.',
    `${APIC}: TRAILER_NAME_SWEEP does not strip a COACHSUMMARY line`)
}

const csRe = /^\s*COACHSUMMARY:\s*(save|offer)\s*$/im
check(csRe.test('- decided to wait\n\nCOACHSUMMARY: save'), 'trailer regex does not match COACHSUMMARY: save')
check(csRe.test('Want me to keep this?\nCOACHSUMMARY: offer'), 'trailer regex does not match COACHSUMMARY: offer')
check('- a\n\nCOACHSUMMARY: save'.match(csRe)[1] === 'save', 'trailer regex does not capture the kind')
check(!csRe.test('COACHSUMMARY: maybe'), 'trailer regex accepts a kind that is neither save nor offer')
check(!csRe.test('I could COACHSUMMARY: save that for you'),
  'trailer regex matches mid-sentence text -- it must anchor to its own line')
check(coach.includes("res.setHeader('X-Coach-Summary', coachSummaryOffer)"),
  `${APIC}: the summary kind never reaches the client on a response header`)
// The arbitrated values must be read back out, or arbitration is computed and
// thrown away (the failure mode that would let two offers ship at once).
check(/coachNoteOffer, coachSummaryOffer, activityB64, searchIntakeB64 \} =\n/.test(coach),
  `${APIC}: coachSummaryOffer is missing from the destructure that reads arbitrateOffers' result back`)

// --- 6. Gating: the instruction only exists with an opportunity in focus --

const inFocusIdx = coach.indexOf('const inFocus = pinned || findInFocusRecord(activeSaved, message, history)')
const summaryCallIdx = coach.indexOf('profileBlock += buildCoachSummaryCaptureNote({')
check(inFocusIdx !== -1 && summaryCallIdx > inFocusIdx,
  `${APIC}: the summary instruction is not built inside the in-focus block -- a summary has to land in some opportunity's notes, so with nothing in focus there is nothing to instruct`)
const gateIdx = coach.lastIndexOf('if (hasCoachSummary({ feature_flags: featureFlags, email: userEmail })) {', summaryCallIdx)
check(gateIdx !== -1 && gateIdx < summaryCallIdx,
  `${APIC}: the summary instruction is not behind hasCoachSummary -- every account would be told it can do this`)

// --- 7. GA docs: in the guide, and the pilot file retired ---------------
// The mirror image of what this section checked during the pilot. While it was
// flagged, documenting it in my-coach.md would have had Coach describing it to
// the accounts that did not have it (a chapter in ORDER.json is grounding for
// everyone, every turn). Now that everyone has it, the reverse is the failure:
// a capability nobody is told about, and a second copy of its description
// drifting in a file only some code paths read.
check(!fs.existsSync('src/data/coach-summary-knowledge.js'),
  'src/data/coach-summary-knowledge.js: the pilot knowledge file survived GA -- its content belongs in my-coach.md now, and two descriptions of one capability will drift')
check(!coach.includes('COACH_SUMMARY_KNOWLEDGE'),
  `${APIC}: the retired pilot-knowledge block is still imported or injected`)
const guide = fs.readFileSync('src/data/user-guide/my-coach.md', 'utf8')
check(/summar/i.test(guide),
  'src/data/user-guide/my-coach.md: summary-to-notes is not documented in the GA chapter -- Coach would tell people it cannot do something it can')
// The three things the guide paragraph has to get right, because Coach answers
// questions about this capability from it.
check(/opportunity's notes|that opportunity's notes/i.test(guide),
  'src/data/user-guide/my-coach.md: the guide does not say where a summary lands')
check(/once a day per opportunity|once per day per opportunity/i.test(guide),
  'src/data/user-guide/my-coach.md: the guide does not mention the daily cap -- someone who declines once should be able to tell it is not going to keep asking')
check(/conclusions, not a transcript/i.test(guide),
  'src/data/user-guide/my-coach.md: the guide does not say a summary keeps conclusions rather than a transcript -- that is what sets expectations for what gets saved')
// The promise this whole design is built around has to still be in the guide.
check(/only things it writes or builds are the ones you tap to accept/i.test(guide),
  'src/data/user-guide/my-coach.md: the "only what you tap" promise is gone -- if that changed, this capability\'s design changed with it')
check(/your tap is what saves it|tap is what saves/i.test(guide),
  'src/data/user-guide/my-coach.md: the summary paragraph does not repeat that the tap is the write -- this is the one capability where Coach proposes the write itself, so it is worth saying in place')

// --- 8. Client wiring ----------------------------------------------------

const CHAT = 'src/components/Chat.jsx'
const APP = 'src/App.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')
const app = fs.readFileSync(APP, 'utf8')

check(chat.includes("res.headers.get('X-Coach-Summary')"), `${CHAT}: the summary header is never read`)
check(/coachSummaryCaptureActive && \(summaryHeader === 'save' \|\| summaryHeader === 'offer'\)/.test(chat),
  `${CHAT}: the summary offer is not gated on both the pilot prop and a known trailer kind`)
// Both kinds go through mergeOfferOntoReply, which is what makes them a tap.
const csBlock = chat.slice(chat.indexOf("coachSummaryCaptureActive && (summaryHeader"), chat.indexOf("coachSummaryCaptureActive && (summaryHeader") + 1200)
check(csBlock.includes("'coach-summary-save'") && csBlock.includes("{ label: 'Save it'") && csBlock.includes("{ label: 'Not now', value: 'dismiss' }"),
  `${CHAT}: the summary offer does not render a real accept/decline pair`)
check(!/saveCoachNote|onSaveNote\(/.test(csBlock),
  `${CHAT}: the summary path writes directly instead of going through the tap -- the user guide promises the tap is the only write`)
check(csBlock.includes('if (onSummaryOffered) onSummaryOffered()'),
  `${CHAT}: the render does not report the offer back up -- the 24-hour window counts offers MADE, so an ignored offer has to close it too`)

check(app.includes("if(checkinKey==='coach-summary-save'){"), `${APP}: the summary tap handler is missing`)
const tapIdx = app.indexOf("if(checkinKey==='coach-summary-save'){")
const tapBlock = tapIdx === -1 ? '' : app.slice(tapIdx, tapIdx + 400)
check(tapBlock.includes("if(value==='dismiss')return true"), `${APP}: the summary tap has no decline branch`)
check(tapBlock.includes('saveCoachNoteToOpportunity('),
  `${APP}: the summary tap does not write through the existing notes path -- a summary is a note, and a second write path would need its own removal, render and sync`)

check(app.includes('const noteCoachSummaryOffered=()=>{'), `${APP}: noteCoachSummaryOffered is missing`)
const stampIdx = app.indexOf('const noteCoachSummaryOffered=()=>{')
const stampBlock = app.slice(stampIdx, stampIdx + 500)
check(stampBlock.includes('currentSavedSlotIdRef.current'),
  `${APP}: the stamp does not read the in-focus record at call time -- it fires from inside an async streaming handler, where a render-time snapshot can be stale (CLAUDE.md section 8)`)
check(stampBlock.includes('lastCoachSummaryOfferAt:new Date().toISOString()') && stampBlock.includes('setSeenCoachSummaryMention(true)'),
  `${APP}: the stamp does not record both the per-opportunity offer time and the one-time-ever mention flag`)

const propCount = (app.match(/coachSummaryCaptureActive=\{hasCoachSummary&&!!coachSaveTarget\(\)\}/g) || []).length
check(propCount === 2,
  `${APP}: expected both <Chat> mounts gated on hasCoachSummary AND an opportunity in focus, found ${propCount}`)
check((app.match(/onSummaryOffered=\{noteCoachSummaryOffered\}/g) || []).length === 2,
  `${APP}: both <Chat> mounts must report a rendered offer back, or the window never closes on one surface`)
check(app.includes('const hasCoachSummary=!!signedInUser'),
  `${APP}: the client mirror of hasCoachSummary is missing or has drifted from api/_lib/feature-flags.js (GA: !!signedInUser)`)
check(!/coach_summary/.test(app),
  `${APP}: the client still reads the coach_summary flag string -- after GA the server does not consult it, so a client that does would disagree with the server for anyone holding a stale flag`)

// State persistence: a one-time-ever flag that is not saved fires forever.
check(app.includes('const[seenCoachSummaryMention,setSeenCoachSummaryMention]=useState(false)'),
  `${APP}: seenCoachSummaryMention state is missing`)
check((app.match(/if\(d\.seenCoachSummaryMention\)setSeenCoachSummaryMention\(true\)/g) || []).length === 2,
  `${APP}: seenCoachSummaryMention must hydrate on BOTH paths (local and server) -- one of them missing means the sentence repeats on that path`)
const blobIdx = app.indexOf('const stateForSave={')
check(app.slice(blobIdx, blobIdx + 900).includes('seenCoachSummaryMention'),
  `${APP}: seenCoachSummaryMention is not in the autosave blob -- it would never reach the server and the sentence would return every session`)

if (failures) {
  console.error(`test-coach-summary: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-summary: OK (GA to every signed-in account and nobody signed out, with the flag string no longer consulted on either side; the proactive half of the instruction exists only while the 24-hour window is open and the model is never asked to compute that window itself; the one-time "you can just ask" sentence rides the first firing only; both kinds end in a tap and the instruction forbids claiming the write; the offer sits in the pipeline-fact arbitration tier; a rendered offer closes the window whether it is accepted, declined or ignored; the write reuses the existing notes path; and the capability is documented in the GA user-guide chapter with the pilot knowledge file retired)')
}
