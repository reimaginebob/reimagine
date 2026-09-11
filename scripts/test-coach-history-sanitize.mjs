// Guards finding #2.4 from the 2026-09-07 My Coach diagnostic review: the
// conversation history sent back to the model included client-synthesized
// messages -- offer-bubble questions, onboarding narration, the static
// greeting, and optimistic action-confirmation text ("Saved.", "Archived.",
// a resolver's own "Got it.") -- as if the model itself had said them. The
// model then read a transcript in which it had already done the thing
// SYSTEM_PROMPT_STABLE tells it to never claim, and followed the transcript
// over the instruction.
//
// BEHAVIORAL, not string-presence (per finding #5.1): imports api/coach.js
// with dummy env vars and calls sanitizeHistoryForModel directly against
// realistic history shapes.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

process.env.DATABASE_URL ||= 'postgres://user:pass@localhost/dummy'
process.env.RESEND_API_KEY ||= 'dummy'
process.env.ANTHROPIC_API_KEY ||= 'dummy'

const { sanitizeHistoryForModel } = await import('../api/coach.js')

// Real conversational turns (no synthetic markers) pass through untouched.
{
  const history = [
    { role: 'user', content: 'How should I frame my last role?' },
    { role: 'assistant', content: "Here's how I'd think about it..." },
  ]
  const out = sanitizeHistoryForModel(history)
  check(out.length === 2, 'real user/assistant turns should not be filtered out')
  check(out[0].content === history[0].content && out[1].content === history[1].content,
    'real turns should pass through with their content intact')
}

// checkinKey (an offer-bubble question) is stripped.
{
  const history = [
    { role: 'assistant', content: 'Want me to save this to your Values screen?', checkinKey: 'values-capture' },
  ]
  check(sanitizeHistoryForModel(history).length === 0, 'a checkinKey-carrying offer bubble should be stripped')
}

// banner (onboarding/narration lines) is stripped, even when it carries real
// model text (an orientation-check reaction) -- the flag alone is enough,
// per the brief's own recommendation to tag and drop banners categorically.
{
  const history = [
    { role: 'assistant', content: "That's a specific, telling answer.", banner: true },
  ]
  check(sanitizeHistoryForModel(history).length === 0, 'a banner:true narration line should be stripped')
}

// intro (the static greeting) is stripped.
{
  const history = [
    { role: 'assistant', content: "Hi, I'm your coach.", intro: true },
  ]
  check(sanitizeHistoryForModel(history).length === 0, 'the intro greeting should be stripped')
}

// synthetic (button-label taps, followUp confirmations, resolver text,
// network-error fallbacks) is stripped.
{
  const history = [
    { role: 'user', content: 'Save it', synthetic: true },
    { role: 'assistant', content: 'Saved to your Values, Passions & Causes.', synthetic: true },
  ]
  check(sanitizeHistoryForModel(history).length === 0, 'synthetic-tagged turns should be stripped')
}

// A mixed, realistic transcript keeps only the real conversational turns.
{
  const history = [
    { role: 'assistant', content: "Hi, I'm your coach.", intro: true },
    { role: 'user', content: 'What should I focus on this week?' },
    { role: 'assistant', content: "Given what's in your pipeline, I'd focus on..." },
    { role: 'assistant', content: 'Want me to save this to your Values screen?', checkinKey: 'values-capture' },
    { role: 'user', content: 'Save it', synthetic: true },
    { role: 'assistant', content: 'Saved to your Values, Passions & Causes.', synthetic: true },
    { role: 'user', content: 'Thanks, one more question...' },
  ]
  const out = sanitizeHistoryForModel(history)
  check(out.length === 3, 'a mixed transcript should keep exactly the three real conversational turns')
  check(out.every(m => m.content !== 'Saved to your Values, Passions & Causes.'),
    'the optimistic confirmation must not survive into what the model sees')
}

// F1 twenty-minute session, item 1: a generated:true moment reply (Delivery
// read / Next move / arrival / Check -- fireMoment's real model output,
// src/App.jsx) passes through even though it carries checkinKey and banner
// too, since the model needs to see its own words on a later turn. A
// production Delivery read said "a bigger table"; unable to see that
// sentence in its own history, Coach asked where the person had heard the
// phrase instead of just explaining it.
{
  const history = [
    { role: 'assistant', content: "You're already naming what you'd want to build next at a bigger table.", checkinKey: 'moment:delivery-p3', banner: true, generated: true },
  ]
  const out = sanitizeHistoryForModel(history)
  check(out.length === 1, 'a generated:true moment reply should NOT be stripped, even though it carries checkinKey and banner')
  check(out[0] && out[0].content === history[0].content, 'a generated:true moment reply should keep its content intact')
}

// A static moment entry (fireStaticEntryMessage's own push -- Row A/B/C,
// Stall, the personal-brand check-in, every hardcoded MOMENT_CATALOG
// message) is still stripped exactly like before: it carries checkinKey and
// often banner, but never generated, because the model never said it.
{
  const history = [
    { role: 'assistant', content: "I'm your coach, and I'm with you for the whole search.", checkinKey: 'moment:coach-intro' },
  ]
  check(sanitizeHistoryForModel(history).length === 0, 'a static moment entry (no generated flag) should still be stripped')
}

// A malformed/non-array history is a clean no-op, not a throw.
{
  check(Array.isArray(sanitizeHistoryForModel(null)) && sanitizeHistoryForModel(null).length === 0,
    'a null history should return an empty array, not throw')
  check(Array.isArray(sanitizeHistoryForModel(undefined)) && sanitizeHistoryForModel(undefined).length === 0,
    'an undefined history should return an empty array, not throw')
}

// The handler routes through sanitizeHistoryForModel before slicing to 50,
// not the raw `history` -- a partial fix would still let synthetic
// messages ride into the model's context.
const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')
check(coach.includes('sanitizeHistoryForModel(history)'),
  `${COACH}: the handler no longer routes history through sanitizeHistoryForModel`)
check(/conversationalHistory\.slice\(-50\)/.test(coach),
  `${COACH}: the 50-message window is no longer taken from the sanitized history`)
// findInFocusRecord must keep scanning the RAW history (button-label taps
// included) -- that pinning is unrelated to what the model itself sees, and
// sanitizing it too would silently break focus-record resolution from a tap.
check(/findInFocusRecord\(activeSaved, message, history\)/.test(coach),
  `${COACH}: findInFocusRecord no longer scans the raw, unfiltered history`)

// Client-side markers: each site that pushes app-written text (never the
// model's own words) into chat state tags it so the server can strip it.
const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')
check(chat.includes("c.push({ role: 'user', content: opt.label, synthetic: true })"),
  `${CHAT}: the button-label user turn is no longer tagged synthetic`)
check(chat.includes("setMessages(m => [...m, { role: 'assistant', ...handled, synthetic: true }])"),
  `${CHAT}: a resolver's own confirmation text is no longer tagged synthetic`)
check(chat.includes("setMessages(m => [...m, { role: 'assistant', content: opt.followUp, synthetic: true }])"),
  `${CHAT}: the followUp confirmation is no longer tagged synthetic`)
check(chat.includes('content: "That didn\'t go through — nothing matched, so nothing changed.", synthetic: true'),
  `${CHAT}: the pb-checkin miss message is no longer tagged synthetic`)
check(chat.includes('content: fallback, synthetic: true'),
  `${CHAT}: the 503/401 error fallback is no longer tagged synthetic`)
check(chat.includes("content: 'Sorry, I could not reach your coach just now. Try again in a moment.', synthetic: true"),
  `${CHAT}: the network-error fallback is no longer tagged synthetic`)

// fireMoment's real-reply push (App.jsx) is the one checkinKey/banner shape
// that IS the model's own words -- confirm it is tagged generated:true and
// that fireStaticEntryMessage's own push (the static-copy sibling) is NOT.
const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')
check(app.includes("setChatMessages(m=>[...m,{role:'assistant',banner:true,content:reply,checkinKey:`moment:${entry.key}`,quickReplies,generated:true}])"),
  `${APP}: fireMoment's generated-reply push no longer tags generated:true`)
check(!app.includes("const newEntryMsg={role:'assistant',content:entryMessage,checkinKey:`moment:${entry.key}`,quickReplies,...(entry.banner?{banner:true}:{}),generated:true}"),
  `${APP}: fireStaticEntryMessage's static push must never tag generated:true -- that would feed hardcoded copy back as the model's own words`)

if (failures) {
  console.error(`test-coach-history-sanitize: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-history-sanitize: OK (real turns pass through, checkinKey/banner/intro/synthetic turns stripped, a generated:true moment reply passes through despite carrying checkinKey/banner while a static moment entry with no generated flag still strips, malformed history is a clean no-op, findInFocusRecord still scans the raw history, all 6 client-side synthetic push sites tagged, fireMoment/fireStaticEntryMessage tag generated correctly)')
}
