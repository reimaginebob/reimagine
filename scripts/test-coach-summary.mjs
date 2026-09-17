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
//  1. THE FLAG. coach_note_agency -- the obvious flag to reuse, and the one the
//     brief named -- went GA on 2026-09-13 (hasCoachNoteAgency is now `!!user`).
//     Gating this on it would have shipped an un-QC'd capability to every
//     signed-in account the moment it merged, which CLAUDE.md section 8 forbids
//     without exception. Hence coach_summary, its own pilot flag.
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
check(hasCoachSummary({ email: 'bob@career.club', feature_flags: [] }) === true,
  'feature-flags: an internal @career.club account is not auto-granted the summary pilot -- Bob has to be able to QC it on production without granting himself')
check(hasCoachSummary({ email: 'someone@example.com', feature_flags: ['coach_summary'] }) === true,
  'feature-flags: a named outside tester holding the flag does not get the pilot')
check(hasCoachSummary({ email: 'someone@example.com', feature_flags: [] }) === false,
  'feature-flags: an ordinary signed-in account gets the summary pilot -- this is the whole reason it does not ride coach_note_agency')
check(hasCoachSummary(null) === false, 'feature-flags: a signed-out visitor gets the pilot')
// The trap this guards: coach_note_agency is GA, so `hasCoachNoteAgency` is
// true for everybody. If the two ever collapse into one gate again, the pilot
// silently becomes GA with no commit that says so.
check(hasCoachNoteAgency({ email: 'someone@example.com', feature_flags: [] }) === true &&
      hasCoachSummary({ email: 'someone@example.com', feature_flags: [] }) === false,
  'feature-flags: the summary pilot now tracks coach_note_agency, which is GA -- every account would get it')
check(!!GRANTABLE_FLAGS[COACH_SUMMARY_FLAG],
  'feature-flags: coach_summary is not in GRANTABLE_FLAGS -- it could not be granted to a named tester from the admin dashboard, which is the case that wants a record')

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
check(coach.includes('if (!generalMode && hasCoachSummary({ feature_flags: featureFlags, email: userEmail })) knowledgeParts.push(COACH_SUMMARY_KNOWLEDGE)'),
  `${APIC}: the pilot knowledge block is not injected, or is not gated on the flag`)

// --- 7. Pilot docs are partitioned, not in the GA guide ------------------
// CLAUDE.md section 8: a chapter in ORDER.json becomes Coach grounding for
// EVERY account on every turn, so a pilot documented there has Coach telling
// the other 144 accounts about something they cannot use.
const KNOW = 'src/data/coach-summary-knowledge.js'
check(fs.existsSync(KNOW), `${KNOW}: the pilot knowledge file is missing`)
const know = fs.existsSync(KNOW) ? fs.readFileSync(KNOW, 'utf8') : ''
check(/tap is the only thing that writes/i.test(know),
  `${KNOW}: the knowledge block does not tell Coach the tap is the only write -- it could answer a question about this capability by overstating it`)
check(/pilot most users do not have/i.test(know),
  `${KNOW}: the knowledge block does not mark itself as a limited pilot`)
const order = JSON.parse(fs.readFileSync('src/data/user-guide/ORDER.json', 'utf8'))
const orderNames = JSON.stringify(order)
check(!/coach-summary/.test(orderNames),
  'src/data/user-guide/ORDER.json: the summary pilot was added to the GA user guide -- that is Coach grounding for all 145 accounts, including the 144 who do not have it')
const guide = fs.readFileSync('src/data/user-guide/my-coach.md', 'utf8')
check(!/COACHSUMMARY|conversation summary/i.test(guide),
  'src/data/user-guide/my-coach.md: the summary pilot is documented in the GA chapter -- move it to the pilot knowledge file until GA')
// The promise this whole design is built around has to still be in the guide.
check(/only things it writes or builds are the ones you tap to accept/i.test(guide),
  'src/data/user-guide/my-coach.md: the "only what you tap" promise is gone -- if that changed, this capability\'s design changed with it')

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
check(app.includes("const hasCoachSummary=!!signedInUser&&((Array.isArray(signedInUser.feature_flags)&&signedInUser.feature_flags.includes('coach_summary'))||/@career\\.club$/i.test(signedInUser.email||''))"),
  `${APP}: the client mirror of hasCoachSummary is missing or has drifted from api/_lib/feature-flags.js`)
check(!/coachSummaryCaptureActive=\{hasCoachNoteAgency/.test(app),
  `${APP}: the summary pilot is gated on hasCoachNoteAgency, which is GA -- all 145 accounts would get it`)

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
  console.log('test-coach-summary: OK (its own pilot flag rather than GA coach_note_agency, internal accounts auto-granted and grantable to a named tester; the proactive half of the instruction exists only while the 24-hour window is open and the model is never asked to compute that window itself; the one-time "you can just ask" sentence rides the first firing only; both kinds end in a tap and the instruction forbids claiming the write; the offer sits in the pipeline-fact arbitration tier; a rendered offer closes the window whether it is accepted, declined or ignored; the write reuses the existing notes path; and the pilot is documented outside the GA user guide)')
}
