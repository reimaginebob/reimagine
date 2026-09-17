// Batch item 17 (Output/handoff/2026-09-09_concierge-batch-and-phase4-brief.md,
// 2026-09-10 revision; production report L6): "two stacked replies to the
// capture sentence (the coaching reply, then the capture offer), and the
// panel scrolls to the second so the first is out of view before it is
// read... One reply, offer first, coaching after the tap." Every one of the
// 17 capture-offer branches in src/components/Chat.jsx's send() used to push
// a SECOND assistant bubble under the model's own just-streamed reply; they
// now all route through one shared helper, mergeOfferOntoReply, which merges
// the offer onto the SAME bubble instead -- one message, the offer text
// first, the model's own short reply (if any) trailing as supporting
// context.
//
// src/components/Chat.jsx cannot be imported live in this harness (it is
// JSX with no bundler here), and mergeOfferOntoReply closes over the
// component's own setMessages. This test extracts the helper's literal
// source (the same new-Function pattern established in
// scripts/test-p3-amend-modes.mjs) and runs it against a mock setMessages
// that just captures the updater function, so the merge logic itself gets
// real behavioral coverage rather than only a source-presence check.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

// 2026-09-17 (the conversation-hold PR): mergeOfferOntoReply now goes through
// writeTurn, which addresses THIS turn's own bubble by turnId instead of
// whatever happens to be last in the array. Both are extracted and run
// together below, and case 3 covers the reason: an unprompted Coach message
// that lands between the reply and the offer used to steal the merge.
const writeTurnMarker = 'const writeTurn = (fn) => setMessages(m => {'
const writeTurnStart = chat.indexOf(writeTurnMarker)
check(writeTurnStart !== -1, `${CHAT}: writeTurn is missing`)
const writeTurnEnd = writeTurnStart === -1 ? -1 : chat.indexOf('\n    })', writeTurnStart)
check(writeTurnEnd !== -1, `${CHAT}: could not find writeTurn's closing brace`)
const writeTurnSrc = writeTurnStart !== -1 && writeTurnEnd !== -1 ? chat.slice(writeTurnStart, writeTurnEnd + '\n    })'.length) : ''

const startMarker = 'const mergeOfferOntoReply = (content, checkinKey, quickReplies) => {'
const startIdx = chat.indexOf(startMarker)
check(startIdx !== -1, `${CHAT}: mergeOfferOntoReply is missing`)
const endIdx = chat.indexOf('\n        }', startIdx)
check(endIdx !== -1, `${CHAT}: could not find mergeOfferOntoReply's closing brace`)
const src = startIdx !== -1 && endIdx !== -1 ? chat.slice(startIdx, endIdx + '\n        }'.length) : ''

if (src && writeTurnSrc) {
  // Build a standalone mergeOfferOntoReply bound to a mock setMessages that
  // just records the updater function it was called with.
  let capturedUpdater = null
  const setMessages = (updater) => { capturedUpdater = updater }
  const TURN = 'turn-under-test'
  const mergeOfferOntoReply = new Function('setMessages', 'turnId', `${writeTurnSrc}\n${src}\nreturn mergeOfferOntoReply`)(setMessages, TURN)

  // Case 1: the just-streamed reply has real text -- the offer leads, the
  // reply's own text trails, and the array length is unchanged (one bubble
  // merged onto, not a second one pushed).
  const before1 = [
    { role: 'user', content: 'I just had an interview with Deloitte, went well.' },
    { role: 'assistant', content: 'Got it -- logged.', id: 'msg-1', turnId: TURN },
  ]
  mergeOfferOntoReply('Anything else, or is that everything?', 'opportunity-update', [{ label: 'Save it', value: 'x' }])
  check(typeof capturedUpdater === 'function', 'mergeOfferOntoReply did not call setMessages with an updater function')
  const after1 = capturedUpdater(before1)
  check(after1.length === before1.length, 'mergeOfferOntoReply changed the message count -- it should merge onto the existing bubble, not push a new one')
  check(after1[0] === before1[0], 'mergeOfferOntoReply touched a message other than its own')
  check(after1[1].content === 'Anything else, or is that everything?\n\nGot it -- logged.',
    'the offer text does not lead with the model\'s own reply trailing after it')
  check(after1[1].checkinKey === 'opportunity-update', 'checkinKey was not attached to the merged bubble')
  check(Array.isArray(after1[1].quickReplies) && after1[1].quickReplies[0].label === 'Save it', 'quickReplies was not attached to the merged bubble')
  check(after1[1].id === 'msg-1', 'the merged bubble lost the id the streaming loop had already attached (rating would break)')
  check(before1[1].checkinKey === undefined, 'mergeOfferOntoReply mutated the input array in place instead of returning a new one')

  // Case 2: the just-streamed reply is empty (the model produced only the
  // trailer, no prose) -- the offer text stands alone, no leading blank line.
  capturedUpdater = null
  const before2 = [
    { role: 'user', content: 'Save this for me.' },
    { role: 'assistant', content: '', id: 'msg-2', turnId: TURN },
  ]
  mergeOfferOntoReply('Want me to save this?', 'values-capture', [])
  const after2 = capturedUpdater(before2)
  check(after2[1].content === 'Want me to save this?', 'an empty streamed reply should leave the offer text standing alone, with no stray separator')

  // Case 3 (2026-09-17): an unprompted Coach message lands after the reply
  // while the offer header is still being parsed. The merge must find its own
  // bubble by turnId, not take whatever is last -- taking the last one both
  // destroyed the unprompted message and hung the offer's quick replies off
  // the wrong text.
  capturedUpdater = null
  const before3 = [
    { role: 'user', content: 'That interview went fine.' },
    { role: 'assistant', content: 'Good to hear.', id: 'msg-3', turnId: TURN },
    { role: 'assistant', content: 'While you are here -- want to talk through Go-to-Market?', banner: true, checkinKey: 'moment:widen-go-to-market' },
  ]
  mergeOfferOntoReply('Want me to save this?', 'opportunity-update', [{ label: 'Save it', value: 'x' }])
  const after3 = capturedUpdater(before3)
  check(after3.length === 3, 'the merge changed the message count when an unprompted message was present')
  check(after3[1].content === 'Want me to save this?\n\nGood to hear.' && after3[1].checkinKey === 'opportunity-update',
    'the offer did not merge onto the turn\'s own bubble')
  check(after3[2] === before3[2],
    'the merge overwrote an unprompted Coach message that arrived after the reply -- this is the bug turnId exists to prevent')

  // And a turn whose bubble is gone entirely (cleared mid-flight) is a no-op,
  // not a write to somebody else's message.
  capturedUpdater = null
  const before4 = [{ role: 'assistant', content: 'Hi, I am your coach.' }]
  mergeOfferOntoReply('Want me to save this?', 'opportunity-update', [])
  check(capturedUpdater(before4) === before4,
    'a merge for a bubble that is no longer in the transcript still writes somewhere')
}

if (failures) {
  console.error(`test-coach-merge-offer-onto-reply: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-merge-offer-onto-reply: OK (mergeOfferOntoReply merges a capture offer onto the just-streamed reply\'s own bubble -- offer text first, the model\'s own reply trailing, id/array-length preserved, input array not mutated -- instead of pushing a second, separate message)')
}
