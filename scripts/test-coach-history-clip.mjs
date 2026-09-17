// Follow-up to PR #968 (300,000-byte Coach message cap) and PR #969 (file
// upload GA): raising what a single turn can send did nothing to limit how
// long that content keeps riding along afterward. A large paste or an
// attached document's extracted text landed in one user turn and then sat
// at full size in `history` on every subsequent turn, and in the browser's
// own localStorage['reimagine_chat_history'] copy, until it aged out of the
// 50-message window. This guards the two fixes: api/coach.js's
// clipOlderHistoryMessage (server-side, what the model is re-sent) and
// src/chat-history-clip.js's clipChatHistoryForStorage (client-side, what
// gets written to localStorage).
//
// BEHAVIORAL, not string-presence (per finding #5.1): imports the real
// functions and exercises them against realistic-sized fixtures, and
// server-side, calls the real buildCoachRequest assembly (same pattern as
// scripts/test-coach-listening-prompt.mjs) rather than re-deriving a
// stand-in.
process.env.DATABASE_URL ||= 'postgresql://fake:fake@fake.neon.tech/fake?sslmode=require'
process.env.RESEND_API_KEY ||= 're_fake_1234567890'

const { buildCoachRequest, clipOlderHistoryMessage, HISTORY_MESSAGE_CLIP_CHARS } = await import('../api/coach.js')
const { clipChatHistoryForStorage, CHAT_HISTORY_STORAGE_CLIP_CHARS } = await import('../src/chat-history-clip.js')

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// --- clipOlderHistoryMessage (server), pure unit checks ---

check(clipOlderHistoryMessage('short') === 'short', 'a short message must pass through unchanged')
check(clipOlderHistoryMessage('a'.repeat(HISTORY_MESSAGE_CLIP_CHARS)) === 'a'.repeat(HISTORY_MESSAGE_CLIP_CHARS),
  'a message exactly at the clip threshold must not be clipped')
{
  const clipped = clipOlderHistoryMessage('a'.repeat(HISTORY_MESSAGE_CLIP_CHARS + 1))
  check(clipped.startsWith('a'.repeat(HISTORY_MESSAGE_CLIP_CHARS)), 'a clipped message must keep its first 8,000 characters intact')
  // The note's wording became two variants on 2026-09-17 (see
  // test-coach-document-context.mjs, which covers which variant is chosen):
  // one pointing at the DOCUMENTS THEY SHARED RECENTLY block, one saying
  // plainly that only the beginning survives. Both still identify the content
  // as a long document, which is what this check is really for.
  check(/[Ll]ong document/.test(clipped), 'a clipped message must say that what was cut was a long document')
  check(clipped.length < HISTORY_MESSAGE_CLIP_CHARS + 200, 'the clip notice must be short, not another large block')
}
check(clipOlderHistoryMessage(null) === null && clipOlderHistoryMessage(undefined) === undefined,
  'a non-string content (null/undefined) must pass through unchanged rather than throw')

// --- The real assembly: two 250,000-byte pastes, only the current turn survives in full ---
{
  const baseProfile = {
    profile: { values: '', passions: '', resume: '', rep: {}, assessType: '', assess: '' },
    outputs: {}, selectedLane: '', chosen: '', done: [], savedPlaybooks: [],
  }
  const olderPaste = 'A'.repeat(250000)
  const currentPaste = 'B'.repeat(250000)
  const history = [
    { role: 'user', content: olderPaste },
    { role: 'assistant', content: 'Got it, thanks for sharing that -- want to talk through what stands out?' },
  ]
  const { messages } = buildCoachRequest({
    history,
    message: currentPaste,
    currentStep: 'myCoach',
    surface: 'help',
    returnSection: null,
    focusRecordId: null,
    situation: null,
    profileState: baseProfile,
    employmentStatus: 'in_transition',
    featureFlags: [],
    pursuitRows: [],
    searchIntake: null,
    userEmail: 'test@example.com',
    track: null,
    activityFacts: [],
    priorSessionAt: null,
    sessionOpenRequested: false,
    generalMode: false,
    milestoneMentions: [],
    closeReasons: [],
    turnKind: undefined,
    tzOffsetMinutes: 0,
  })

  check(messages.length === 3, `expected 3 messages (two history turns plus the current one), got ${messages.length}`)
  const [olderUserMsg, assistantMsg, currentUserMsg] = messages
  check(!olderUserMsg.content.includes(olderPaste), 'the older 250,000-byte paste must not survive in full into the messages sent to the model')
  check(olderUserMsg.content.length < 8200, 'the older paste must be clipped down to roughly 8,000 characters')
  check(/[Ll]ong document/.test(olderUserMsg.content), 'the clipped older paste must carry the explanatory notice')
  check(assistantMsg.content === history[1].content, 'a short assistant turn between the two pastes must be untouched')
  check(currentUserMsg.content.includes(currentPaste), 'the current turn\'s 250,000-byte paste must be sent to the model in full, not clipped')
}

// --- clipChatHistoryForStorage (client) ---

check(clipChatHistoryForStorage(null).length === 0 && Array.isArray(clipChatHistoryForStorage(undefined)),
  'a non-array input must return an empty array rather than throw')
{
  const short = { role: 'user', content: 'hello' }
  check(clipChatHistoryForStorage([short])[0] === short, 'a short message object must pass through unchanged (same reference), not be needlessly copied')
}
{
  const long = { role: 'user', content: 'x'.repeat(CHAT_HISTORY_STORAGE_CLIP_CHARS + 1), quickReplies: ['a'] }
  const [clipped] = clipChatHistoryForStorage([long])
  check(clipped.content.length < CHAT_HISTORY_STORAGE_CLIP_CHARS + 100, 'an over-threshold message must be clipped down to roughly 8,000 characters')
  check(clipped.content.includes('document shared earlier in the conversation'), 'a clipped stored message must carry the explanatory notice')
  check(clipped.role === 'user' && Array.isArray(clipped.quickReplies) && clipped.quickReplies[0] === 'a',
    'clipping content must preserve the message\'s other fields (role, quickReplies, etc.)')
}

// A conversation with two 250,000-byte pastes must stay well under a
// browser's typical per-origin localStorage budget once clipped and
// stringified, where the unclipped version alone would already be ~500 KB
// before accounting for the other 48 messages a full window can hold.
{
  const conversation = [
    { role: 'user', content: 'A'.repeat(250000) },
    { role: 'assistant', content: "That's a lot to work with -- where should we start?" },
    { role: 'user', content: 'B'.repeat(250000) },
    { role: 'assistant', content: 'Good, this fills in the gaps from before.' },
  ]
  const payload = JSON.stringify(clipChatHistoryForStorage(conversation))
  check(payload.length < 1024 * 1024, `clipped localStorage payload must stay under 1 MB, was ${payload.length} bytes`)
  check(payload.length < 20000, `two pastes clipped to ~8,000 characters each should land well under 1 MB, was ${payload.length} bytes -- got ${payload.length}`)
}

if (failures) {
  console.error(`test-coach-history-clip: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-history-clip: OK (server-side clipOlderHistoryMessage keeps only the current turn\'s large paste in full and clips older ones with a notice; client-side clipChatHistoryForStorage keeps the localStorage payload small; a two-large-paste conversation stays well under 1 MB once clipped)')
}
