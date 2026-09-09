// Production fix, 2026-09-09: on e4e088f, typing a discouraged message on
// the My Coach page produced the DISCOURAGEMENT reply with a visible
// "MOOD: low" line as the last line of the message.
//
// Root cause: parseMood (src/coach-routing.js) correctly parses and strips
// MOOD: low from the ORIGINAL reply, well before the voice-retry block runs
// -- the mood value itself, and the X-Coach-Mood header/hold it sets, were
// never wrong. But when that same discouragement reply also trips the
// voice-gate retry (api/coach.js, the block after "Regenerate-on-violation
// retry"), the retry's freshly regenerated text is swept for stray trailer
// syntax by TRAILER_NAME_SWEEP and adopted outright as the new visible
// text -- it is never re-run through parseMood. TRAILER_NAME_SWEEP is a
// hand-maintained name list that was never updated when MOOD was added
// (engine guardrails, rule 2), so a MOOD: low line reproduced by the retry
// (the model is still under the same system-prompt instruction) survived
// the sweep and shipped to the client.
//
// api/coach.js cannot be imported directly in this suite -- module load
// eagerly opens a DB connection (api/_lib/db.js's neon() call), which this
// test environment has no DATABASE_URL for; every other coach.js test in
// this suite works around that the same way, by reading the file as text.
// TRAILER_NAME_SWEEP is mirrored here (not re-derived) so its actual
// REPLACE behavior can be exercised against the real symptom string rather
// than only grepped for; test-coach-voice-retry-order.mjs asserts this
// exact literal still appears verbatim in api/coach.js, which is what
// catches the mirror silently drifting from the source of truth.
import { parseMood } from '../src/coach-routing.js'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// Mirrors api/coach.js's TRAILER_NAME_SWEEP verbatim.
const TRAILER_NAME_SWEEP = /^\s*(?:SELFCHECK|MOOD|MILESTONEMENTIONED|ACTIVITY|COACHNOTE|VALUESCAPTURE|REPUTATIONCAPTURE|SKILLSCAPTURE|SKILLSREMOVE|PRIORITIESCAPTURE|LIFESTORYCAPTURE|ASSESSMENTCAPTURE|OPPORTUNITYUPDATE|OPPORTUNITYCONTEXT|OPPORTUNITYARCHIVE|CLOSEREASON|OPCARDREWORK|SEARCHINTAKE|BRANDREWORK|SECTIONREWORK):.*$/gim

const sweep = (text) => text.replace(TRAILER_NAME_SWEEP, '').trim()

// The exact retry-path symptom: a regenerated reply ending in MOOD: low,
// run through the sweep the retry block actually uses before adopting it.
const retryReply = "I hear how tired you are right now. That's real, and it doesn't mean you're off track.\nMOOD: low"
const sweptRetryReply = sweep(retryReply)
check(!/MOOD:/i.test(sweptRetryReply),
  'TRAILER_NAME_SWEEP leaves a MOOD: line visible in a voice-retry\'s regenerated reply -- the exact production symptom on e4e088f')
check(sweptRetryReply === "I hear how tired you are right now. That's real, and it doesn't mean you're off track.",
  'TRAILER_NAME_SWEEP does not cleanly restore the reply text once MOOD: low is removed')

// A SELFCHECK line ahead of MOOD (the model's actual emission order) is
// still swept too -- the fix must not have narrowed the existing coverage.
const bothTrailers = 'Real reply text here.\nSELFCHECK: none\nMOOD: low'
check(sweep(bothTrailers) === 'Real reply text here.',
  'TRAILER_NAME_SWEEP no longer sweeps both SELFCHECK and MOOD together')

// A reply with no trailer at all is untouched.
check(sweep('Just an ordinary reply, nothing to strip.') === 'Just an ordinary reply, nothing to strip.',
  'TRAILER_NAME_SWEEP altered a reply that carried no trailer at all')

// The other half of the symptom Bob named: "renders with no trailer visible
// and STILL sets the hold." mood detection (and the X-Coach-Mood header/
// hold it drives) comes from parseMood on the ORIGINAL reply, upstream of
// and independent from the retry sweep this fix touches -- re-asserted
// here so a future change to either file breaks this test too, not just
// test-coach-engine-guardrails.mjs.
check(parseMood('Some coaching reply.\nMOOD: low').mood === 'low',
  'parseMood no longer detects MOOD: low -- the hold-setting half of the symptom must keep working independently of the retry-sweep fix')

if (failures) {
  console.error(`test-coach-mood-retry-sweep: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-mood-retry-sweep: OK (a MOOD: low line reproduced by the voice-gate retry\'s regenerated reply renders with no trailer visible, SELFCHECK+MOOD together still sweep cleanly, a trailer-free reply is untouched, and mood detection/the hold it sets stay correct upstream of this fix)')
}
