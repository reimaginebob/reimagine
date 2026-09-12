// t01-19 follow-up (2026-09-12 live QA on bob+lindsey@career.club): all four
// widen-the-search hint phrases got real, on-topic prose that named the
// right row but never attached its Do it now / Remind me later / Not for
// me buttons -- the taps only ever exist client-side, keyed off a
// MOMENT_CATALOG row, and a live conversational reply had no path to that
// catalog at all. Fix: the model ends such a reply with a bare
// WIDENSEARCH: <row-key> trailer; the server validates it against the real
// five-row enum and carries it on X-Coach-Widen-Search; the client (Chat.jsx)
// resolves that key back to the row's own canonical message/quickReplies
// and attaches them via mergeOfferOntoReply, with checkinKey
// 'moment:<row-key>' so the taps route through the SAME dispatch a
// scripted, unprompted fire of the row already uses. This is the
// node-level coverage of the parse/validate/header chain; the browser-
// level coverage the bug report itself required (typing a hint, seeing
// the real buttons render) lives in
// test-coach-widen-search-hint-offer-browser.mjs.
import fs from 'node:fs'
import { parseWidenSearchHint } from '../src/coach-routing.js'
import { WIDEN_SEARCH_ROW_KEYS } from '../src/coach-moments.js'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// --- parseWidenSearchHint (src/coach-routing.js) ---
check(parseWidenSearchHint('Here is your answer.\nWIDENSEARCH: widen-linkedin-contacts').widenSearchHint === 'widen-linkedin-contacts',
  'parseWidenSearchHint does not capture a lowercase, hyphenated row key')
check(parseWidenSearchHint('Here is your answer.\nWIDENSEARCH: widen-linkedin-contacts').text === 'Here is your answer.',
  'parseWidenSearchHint does not strip the trailer line from the visible text')
check(parseWidenSearchHint('No hint here, just a normal reply.').widenSearchHint === null,
  'parseWidenSearchHint invents a hint on a reply that never wrote the trailer')
check(parseWidenSearchHint('Reply text.\nWIDENSEARCH: widen-recruiters | some trailing junk').widenSearchHint === 'widen-recruiters',
  'parseWidenSearchHint does not tolerate trailing text after a pipe, the same tolerance MOOD/SELFCHECK already have')
check(parseWidenSearchHint('').widenSearchHint === null && parseWidenSearchHint(null).widenSearchHint === null,
  'parseWidenSearchHint does not handle empty/null input safely')

// --- api/coach.js wiring ---
const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

check(coach.includes("import { parseSelfcheck, parseMood, parseWidenSearchHint } from '../src/coach-routing.js'"),
  `${COACH}: parseWidenSearchHint is not imported from src/coach-routing.js`)
check(coach.includes("import { WIDEN_SEARCH_ROW_KEYS } from '../src/coach-moments.js'"),
  `${COACH}: WIDEN_SEARCH_ROW_KEYS is not imported from src/coach-moments.js -- a hallucinated trailer value would ship as a header with no validation`)

check(coach.includes('const { widenSearchHint: widenSearchHintRaw, text: widenSearchStripped } = parseWidenSearchHint(moodStripped)'),
  `${COACH}: the WIDENSEARCH trailer is not parsed right after MOOD, in the same silent-trailer chain`)
check(coach.includes('const widenSearchHint = WIDEN_SEARCH_ROW_KEYS.includes(widenSearchHintRaw) ? widenSearchHintRaw : null'),
  `${COACH}: the captured trailer value is not validated against the real five-row enum before being trusted -- a hallucinated or drifted key would ship as-is`)

// TRAILER_NAME_SWEEP is what keeps a stray WIDENSEARCH line out of the
// visible reply on the voice-gate retry path (same reasoning as the
// 2026-09-09 MOOD leak fix, PR #848) -- every capture is locked in before
// that block runs and is never re-derived from the regenerated text, so
// missing WIDENSEARCH here would leak the raw trailer line to the user on
// a reply that also trips the voice retry.
const sweepIdx = coach.indexOf('const TRAILER_NAME_SWEEP =')
const sweepLine = sweepIdx !== -1 ? coach.slice(sweepIdx, coach.indexOf('\n', sweepIdx)) : ''
check(sweepLine.includes('WIDENSEARCH'),
  `${COACH}: TRAILER_NAME_SWEEP does not list WIDENSEARCH -- a stray trailer line could leak into a voice-gate retry's visible text`)

check(coach.includes("if (widenSearchHint) res.setHeader('X-Coach-Widen-Search', widenSearchHint)"),
  `${COACH}: the validated widenSearchHint is not carried on the X-Coach-Widen-Search response header`)

// Deliberately NOT folded into arbitrateOffers/OFFER_ARBITRATION_ORDER --
// this is a soft reply to a hint, not a durable data write competing with
// a real capture, so it stays outside that priority order the same way
// distress/mood do (both set independently, right next to this one).
const arbitrateCallIdx = coach.indexOf('arbitrateOffers({')
const arbitrateCallLine = arbitrateCallIdx !== -1 ? coach.slice(arbitrateCallIdx, coach.indexOf('\n', arbitrateCallIdx)) : ''
check(!arbitrateCallLine.includes('widenSearch'),
  `${COACH}: widenSearchHint should not be folded into arbitrateOffers -- it is a soft hint reply, not a durable capture competing for the same slot`)

if (failures) {
  console.error(`test-coach-widen-search-hint-offer: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-widen-search-hint-offer: OK (parseWidenSearchHint strips and captures the WIDENSEARCH: <key> trailer the same way MOOD/SELFCHECK do; api/coach.js validates the captured key against the real five-row enum, sweeps a stray line out of a voice-gate retry, and carries a valid key on X-Coach-Widen-Search, independent of the durable-capture arbitration order)')
}
