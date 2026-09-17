// The conversation hold (2026-09-17, Bob live-test finding: "Coach keeps
// interrupting me"). Unprompted Coach messages -- per-step narration, the
// check-ins, catalog moments, thinness prompts, disclosures, the session-open
// recap -- landed in the middle of a live back-and-forth. The Moments
// evaluator's turn-pacing gate (scripts/test-coach-moments-turn-pacing.mjs)
// only asked whether ONE real turn had happened since the last moment, which
// is satisfied the instant someone answers -- exactly when they are most
// likely to still be typing. And because every unprompted surface has its own
// trigger, satisfying that one gate re-opened all of them at once.
//
// Two mechanisms ship here, and this file covers both:
//
//   1. claimUnpromptedSlot (src/App.jsx) -- one gate in front of every
//      unprompted site: a hold while the person is mid-conversation, plus a
//      per-visit cap so nobody is walked through a queue on arrival. The
//      first half of this file runs the REAL function, lifted out of App.jsx
//      and evaluated, rather than restating its rules in prose.
//
//   2. Turn-addressed writes in src/components/Chat.jsx -- a reply, its error
//      fallbacks, an offer merged onto it, and the empty-bubble cleanup after
//      Stop all used to address "the last message in the array". An unprompted
//      message landing mid-stream made that somebody else's message, and the
//      turn overwrote it. That is now addressed by turnId, which has to hold
//      even for the sites the hold deliberately exempts.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const CHAT = 'src/components/Chat.jsx'
const app = fs.readFileSync(APP, 'utf8')
const chat = fs.readFileSync(CHAT, 'utf8')

// --- 1. The real gate, executed ------------------------------------------
// Lifted verbatim out of App.jsx and evaluated with a stand-in useRef, so
// these are the shipped rules running, not a paraphrase of them that could
// silently drift from the source it claims to describe.

const START = 'const ACTIVE_CONVERSATION_WINDOW_MS='
const END = '  // Chat.jsx holds the session-open recap behind the same gate'
const startIdx = app.indexOf(START)
const endIdx = app.indexOf(END)
check(startIdx !== -1 && endIdx !== -1 && startIdx < endIdx,
  `${APP}: could not locate the conversation-hold block (ACTIVE_CONVERSATION_WINDOW_MS ... the Chat.jsx prop comment) -- it was renamed, moved, or removed`)

let gate = null
if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
  const src = app.slice(startIdx, endIdx)
  try {
    gate = new Function('useRef', `${src}\nreturn { claimUnpromptedSlot, inActiveConversation, coachActivityRef, unpromptedThisVisitRef, canFireUnprompted, claimUnpromptedSlotRef, ACTIVE_CONVERSATION_WINDOW_MS, UNPROMPTED_PER_VISIT_CAP, UNPROMPTED_EXEMPT_KEYS, UNPROMPTED_CAP_EXEMPT_KEYS }`)(v => ({ current: v }))
  } catch (e) {
    check(false, `${APP}: the conversation-hold block no longer evaluates standalone (${e.message}) -- it picked up a dependency on surrounding App state, which also means it can no longer be reasoned about in isolation`)
  }
}

if (gate) {
  const reset = (activity, spent = 0) => {
    gate.coachActivityRef.current = activity
    gate.unpromptedThisVisitRef.current = spent
    gate.claimUnpromptedSlotRef.current = gate.claimUnpromptedSlot
  }
  const ago = ms => new Date(Date.now() - ms).toISOString()
  const IDLE = { composer: '', loading: false, lastUserAt: null }

  check(gate.ACTIVE_CONVERSATION_WINDOW_MS === 5 * 60 * 1000,
    `${APP}: the active-conversation window is no longer 5 minutes (${gate.ACTIVE_CONVERSATION_WINDOW_MS}ms) -- Bob approved 5; changing it changes how long Coach stays quiet after someone speaks`)
  check(gate.UNPROMPTED_PER_VISIT_CAP === 2,
    `${APP}: the per-visit cap is no longer 2 (${gate.UNPROMPTED_PER_VISIT_CAP})`)

  // -- the hold itself --
  reset(IDLE)
  check(gate.inActiveConversation() === false,
    `${APP}: an empty composer, nothing streaming and nobody having spoken reads as an ACTIVE conversation -- Coach would never say anything unprompted again`)

  reset({ composer: '', loading: true, lastUserAt: null })
  check(gate.inActiveConversation() === true,
    `${APP}: a reply still streaming does not count as an active conversation -- an unprompted message would land on top of a half-written answer`)

  reset({ composer: '   ', loading: false, lastUserAt: null })
  check(gate.inActiveConversation() === false,
    `${APP}: whitespace alone in the composer counts as active -- a stray space would hold Coach silent indefinitely`)

  reset({ composer: 'I was thinking about', loading: false, lastUserAt: null })
  check(gate.inActiveConversation() === true,
    `${APP}: text half-typed in the composer does not count as active -- this is the most common interruption of all, someone mid-sentence`)

  reset({ composer: '', loading: false, lastUserAt: ago(30 * 1000) })
  check(gate.inActiveConversation() === true,
    `${APP}: a real message sent 30 seconds ago does not count as an active conversation`)

  reset({ composer: '', loading: false, lastUserAt: ago(4 * 60 * 1000) })
  check(gate.inActiveConversation() === true,
    `${APP}: a real message sent 4 minutes ago falls outside the 5-minute window`)

  reset({ composer: '', loading: false, lastUserAt: ago(6 * 60 * 1000) })
  check(gate.inActiveConversation() === false,
    `${APP}: a message sent 6 minutes ago still holds Coach silent -- the window never releases`)

  // Pre-fix transcripts have no `at` at all. Treating "unknown" as active
  // would silence Coach permanently for every account that already has a
  // conversation, which is all of them.
  reset({ composer: '', loading: false, lastUserAt: undefined })
  check(gate.inActiveConversation() === false,
    `${APP}: a user turn with no 'at' stamp (every message written before this shipped) counts as active -- existing accounts would never hear from Coach unprompted again`)
  reset({ composer: '', loading: false, lastUserAt: 'not a date' })
  check(gate.inActiveConversation() === false,
    `${APP}: an unparseable 'at' counts as active`)

  // -- the cap --
  reset(IDLE)
  check(gate.claimUnpromptedSlot('employment-status') === true &&
        gate.claimUnpromptedSlot('search-intake') === true &&
        gate.claimUnpromptedSlot('values-thin-hub') === false,
    `${APP}: the per-visit cap does not stop the third unprompted message of a visit -- this is the "queue dumped on arrival" symptom the cap exists for`)

  reset(IDLE)
  gate.claimUnpromptedSlot('employment-status')
  check(gate.unpromptedThisVisitRef.current === 1,
    `${APP}: claiming a slot does not spend it`)
  reset({ composer: 'mid sentence', loading: false, lastUserAt: null })
  gate.claimUnpromptedSlot('employment-status')
  check(gate.unpromptedThisVisitRef.current === 0,
    `${APP}: a HELD message still spends one of the visit's slots -- a message that was never said must not use up the budget for one that could be`)

  // -- exemptions --
  reset({ composer: 'mid sentence', loading: true, lastUserAt: ago(1000) })
  for (const k of ['coach-intro', 'coach-minimize-intro', 'coach-self-open-explained']) {
    check(gate.claimUnpromptedSlot(k) === true,
      `${APP}: '${k}' is held during an active conversation -- these three EXPLAIN a gesture the person just made (arriving, minimizing, opening the panel), so holding one leaves the panel behaving unexplainably`)
  }
  reset(IDLE, 99)
  for (const k of ['coach-intro', 'coach-minimize-intro', 'coach-self-open-explained']) {
    check(gate.claimUnpromptedSlot(k) === true, `${APP}: '${k}' is subject to the per-visit cap`)
  }
  check(gate.unpromptedThisVisitRef.current === 99,
    `${APP}: an exempt key spends a visit slot`)

  // Cap-exempt but NOT hold-exempt: the onboarding walkthrough is a run of
  // these by design, so capping them at two would un-ship it -- but they
  // still must not talk over a live conversation.
  reset(IDLE, 99)
  check(gate.claimUnpromptedSlot('orientation-narration') === true &&
        gate.claimUnpromptedSlot('orientation-quality') === true,
    `${APP}: the per-step orientation narration / per-field reaction are capped at two per visit -- onboarding walks through nine screens in a row, so the cap would silently un-ship "Coach talks you through onboarding"`)
  reset({ composer: 'still typing', loading: false, lastUserAt: null }, 0)
  check(gate.claimUnpromptedSlot('orientation-narration') === false &&
        gate.claimUnpromptedSlot('orientation-quality') === false,
    `${APP}: cap-exempt was read as hold-exempt -- narration and reactions may run long, but never on top of someone mid-sentence`)

  // -- the prop Chat.jsx gets --
  reset({ composer: 'typing', loading: false, lastUserAt: null })
  check(gate.canFireUnprompted('session-open-recap') === false,
    `${APP}: canFireUnprompted (the prop Chat.jsx holds the session-open recap behind) does not route through claimUnpromptedSlot`)
}

// --- 2. Every unprompted site goes through the gate ----------------------
// Source-level: these live inside App.jsx effects that need a real signed-in
// browser session to exercise. What matters at each one is that the gate is
// checked BEFORE the site's own fired/seen write -- a held message is dropped,
// not queued, so burning the one-shot would mean it never arrives at all.

const SITES = [
  ['life-events-thin-tap', 'setLifeEventsThinTopicCloseCount(c=>c+1)'],
  ['orientation-narration', 'narratedOrientationStepsFiredRef.current.add(step)'],
  ['personal-brand-delivery', 'brandDeliveryFiredRef.current=true'],
  ['personal-brand', 'pbCheckinFiredRef.current=true\n    setSeenPbCheckin(true)\n    const yesFollow'],
  ['orientation-quality', 'orientationCheckFiredRef.current={...orientationCheckFiredRef.current'],
  ['employment-status', 'employmentPromptFiredRef.current=true'],
  ['search-intake', 'searchIntakePromptFiredRef.current=true'],
  ['life-events-thin-hub', 'lifeEventsThinHubFiredRef.current=true'],
  ['values-thin-hub', 'valuesThinHubFiredRef.current=true'],
  ['resume-builder-draft-invite', 'resumeBuilderDraftInviteFiredRef.current=true'],
  ['notes-capability', 'notesCapabilityFiredRef.current=true'],
  ['close-reason-capability', 'closeReasonMentionFiredRef.current=true'],
  ['pipeline-checkin', "sessionStorage.setItem('reimagine_pipeline_checkin_fired','1')"],
]
// Several of these anchors also appear elsewhere in the file (the employment
// quick-reply handler chains straight into the search-intake opener, which is
// a continuation of a question the person just answered and deliberately NOT
// gated), so each is matched relative to its own claim rather than globally.
const NEARBY = 600
for (const [key, firedWrite] of SITES) {
  const claim = `claimUnpromptedSlot('${key}')`
  const claimIdx = app.indexOf(claim)
  check(claimIdx !== -1,
    `${APP}: the '${key}' unprompted message is not behind claimUnpromptedSlot -- it can still interrupt a live conversation`)
  if (claimIdx === -1) continue
  const firedIdx = app.indexOf(firedWrite, claimIdx)
  check(firedIdx !== -1 && firedIdx - claimIdx < NEARBY,
    `${APP}: '${key}' does not write its fired/seen flag (${firedWrite.slice(0, 48)}...) just after the hold -- either the anchor drifted, or the flag is now written BEFORE the hold, which would burn the one-shot on a message that was never said`)
}

// The Moments evaluator gates on the catalog entry's own key, so an exempt
// row stays exempt; and it must be checked before the dedupe write, same rule.
const evalClaimIdx = app.indexOf('if(!claimUnpromptedSlot(entry.key))return')
// Anchored after the claim: fireStaticEntry (used only by the two exempt
// panel-lifecycle entries) carries the same dedupe write earlier in the file.
const dedupeIdx = evalClaimIdx === -1 ? -1 : app.indexOf('momentFiredRef.current.add(`${entry.key}:${subKey}`)', evalClaimIdx)
check(evalClaimIdx !== -1,
  `${APP}: the Moments evaluator does not gate on claimUnpromptedSlot(entry.key) -- catalog moments are the surface Bob reported interrupting him`)
check(evalClaimIdx !== -1 && dedupeIdx !== -1 && dedupeIdx - evalClaimIdx < NEARBY,
  `${APP}: the evaluator's hold is checked after momentFiredRef.current.add -- a held moment would burn its dedupe key and never fire`)

// Chat.jsx's session-open recap, above its own sessionStorage cap write.
const recapClaimIdx = chat.indexOf("canFireUnprompted('session-open-recap')")
const recapFiredIdx = chat.indexOf("sessionStorage.setItem('reimagine_session_recap_fired', '1')")
check(recapClaimIdx !== -1,
  `${CHAT}: the session-open recap is not behind canFireUnprompted`)
check(recapClaimIdx !== -1 && recapFiredIdx !== -1 && recapClaimIdx < recapFiredIdx,
  `${CHAT}: the recap's hold is checked after it marks itself fired for the session -- a hold would cost the session its recap entirely`)
check(/onActivity={reportCoachActivity}/.test(app) && (app.match(/canFireUnprompted={canFireUnprompted}/g) || []).length === 2,
  `${APP}: both <Chat> mounts (embedded and floating) must receive onActivity and canFireUnprompted -- a mount missing them is a surface with no hold`)

// --- 3. Turn-addressed writes in Chat.jsx --------------------------------

// Checked as fields OF the user turn rather than as the whole literal
// (2026-09-18): the cross-opportunity scope fix added `rid` to this same
// construction, and pinning the exact string meant a test about the
// conversation hold broke on a change that had nothing to do with it.
check(/const userMsg = \{ role: 'user', content: text, at: new Date\(\)\.toISOString\(\)/.test(chat),
  `${CHAT}: a real user turn no longer carries an 'at' stamp -- App's hold has no way to tell mid-conversation from walked-away`)
// Same turn, the other stamp that rides it: which opportunity was in focus when
// it was said. The hold and the summary scope both read this construction, so
// losing either stamp here breaks a different feature silently.
check(/rid: coachSaveTarget\.id/.test(chat),
  `${CHAT}: a real user turn no longer carries 'rid' -- api/coach.js's scopeHistoryToRecord has nothing to find an opportunity boundary with, and a summary of one opportunity can be written from another's turns`)
check(/const turnId = `t\$\{Date\.now\(\)\.toString\(36\)\}\$\{Math\.random\(\)\.toString\(36\)\.slice\(2, 6?8\)\}`/.test(chat),
  `${CHAT}: send() no longer mints a turnId`)
check((chat.match(/turnId \}\)/g) || []).length >= 1 &&
      chat.includes("[...m, userMsg, { role: 'assistant', content: '', turnId }]"),
  `${CHAT}: the normal-send placeholder bubble does not carry turnId -- every write below it would find nothing to address`)
check((chat.match(/\{ role: 'assistant', content: prefix, turnId \}/g) || []).length === 2,
  `${CHAT}: both silent-turn placeholder pushes (replace-the-seed and append) must carry turnId`)
check(chat.includes('const writeTurn = (fn) => setMessages(m => {') && chat.includes('m.findIndex(x => x && x.turnId === turnId)'),
  `${CHAT}: writeTurn (address this turn's own bubble by id) is missing`)

// The actual regression guard: no write in send() may address the transcript
// by its last index again. That is what let an unprompted message that landed
// mid-stream get overwritten by the reply.
const sendStart = chat.indexOf('const send = async (explicit,')
const sendEnd = chat.indexOf('sendRef.current = send')
check(sendStart !== -1 && sendEnd !== -1 && sendStart < sendEnd, `${CHAT}: could not locate send()`)
if (sendStart !== -1 && sendEnd > sendStart) {
  // Comments stripped: this file EXPLAINS the retired pattern in prose right
  // where it replaced it, and a scan that cannot tell the two apart would
  // fail on its own documentation.
  const body = chat.slice(sendStart, sendEnd).split('\n').map(l => l.replace(/^\s*\/\/.*$/, '')).join('\n')
  check(!/copy\[copy\.length - 1\]/.test(body),
    `${CHAT}: send() still writes to copy[copy.length - 1] -- if an unprompted message appended while this turn was in flight, the turn overwrites that message instead of its own bubble`)
  check(!/m\.slice\(0, -1\)/.test(body),
    `${CHAT}: send()'s Stop cleanup still drops the LAST message rather than its own empty bubble -- it would delete an unprompted message that arrived after Stop`)
  check(!/m\[m\.length - 1\]/.test(body),
    `${CHAT}: send() still reads m[m.length - 1] as if it were this turn's message`)
}

if (failures) {
  console.error(`test-coach-conversation-hold: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-conversation-hold: OK (the shipped hold holds while a reply is streaming, while text sits in the composer, and for 5 minutes after a real turn; missing timestamps read as idle so existing transcripts are not silenced; the per-visit cap stops a third message without charging held ones; the three panel-lifecycle explanations are exempt from both gates and the two orientation surfaces from the cap only; all 15 unprompted sites check the gate before burning their own one-shot; and every write in send() addresses its own bubble by turnId)')
}
