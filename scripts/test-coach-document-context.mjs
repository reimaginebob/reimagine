// Keeping a shared document available to Coach across a conversation
// (2026-09-17). Follow-up to #968 (300,000-byte paste cap), #969 (file-upload
// GA) and #972 (history clip).
//
// #972 stopped a large paste being re-sent at full size on every later turn,
// but that also meant the content was GONE from the model's view a turn
// later: someone who pasted an interview transcript and asked a follow-up got
// an answer reasoned from its first few pages, with nothing saying so. The
// full text is read back out of chat_messages once per turn into a labeled
// DOCUMENTS THEY SHARED RECENTLY block instead.
//
// BEHAVIORAL, not string-presence (per finding #5.1): these call the real
// exported functions and the real buildCoachRequest assembly.
process.env.DATABASE_URL ||= 'postgresql://fake:fake@fake.neon.tech/fake?sslmode=require'
process.env.RESEND_API_KEY ||= 're_fake_1234567890'

import fs from 'node:fs'

const {
  buildCoachRequest, selectRecentDocuments, buildDocumentsBlock, describeDocumentAge,
  clipOlderHistoryMessage, HISTORY_MESSAGE_CLIP_CHARS,
  DOCUMENT_MAX_COUNT, DOCUMENT_TOTAL_CHAR_CAP,
} = await import('../api/coach.js')
const { matchesDistressTrigger } = await import('../src/text-strippers.js')

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const DAY = 86400000
const NOW = Date.parse('2026-09-17T12:00:00Z')
const baseProfile = {
  profile: { values: '', passions: '', resume: '', rep: {}, assessType: '', assess: '' },
  outputs: {}, selectedLane: '', chosen: '', done: [],
  savedPlaybooks: [
    { id: 'rec-hope', title: 'Director of Operations', company: 'HOPE' },
    { id: 'rec-deloitte', title: 'Senior Manager', company: 'Deloitte' },
  ],
}
const buildFor = over => buildCoachRequest({
  history: [], message: 'what should I focus on this week', currentStep: 'myCoach', surface: 'help',
  returnSection: null, focusRecordId: null, situation: null, profileState: baseProfile,
  employmentStatus: 'in_transition', featureFlags: [], pursuitRows: [], searchIntake: null,
  userEmail: 'test@example.com', track: null, activityFacts: [], priorSessionAt: null,
  sessionOpenRequested: false, generalMode: false, milestoneMentions: [], closeReasons: [],
  turnKind: undefined, tzOffsetMinutes: 0, nowMs: NOW, ...over,
})
const docRow = (over = {}) => ({
  message: 'TRANSCRIPT ' + 'x'.repeat(250000),
  created_at: new Date(NOW - DAY).toISOString(),
  current_step: 'myCoach',
  focus_record_id: null,
  ...over,
})

// --- selectRecentDocuments: count cap, combined cap, clip order -----------
{
  const rows = [docRow(), docRow(), docRow(), docRow()]
  check(selectRecentDocuments(rows).length <= DOCUMENT_MAX_COUNT,
    `at most ${DOCUMENT_MAX_COUNT} documents may be carried, got ${selectRecentDocuments(rows).length}`)
}
{
  // Three 250,000-character documents against a 300,000 combined cap: the
  // newest survives whole, the next gets the remainder, the oldest is dropped.
  const rows = [
    docRow({ message: 'A'.repeat(250000) }),
    docRow({ message: 'B'.repeat(250000) }),
    docRow({ message: 'C'.repeat(250000) }),
  ]
  const picked = selectRecentDocuments(rows)
  const total = picked.reduce((n, d) => n + d.text.length, 0)
  check(total <= DOCUMENT_TOTAL_CHAR_CAP, `combined text must respect the ${DOCUMENT_TOTAL_CHAR_CAP} cap, got ${total}`)
  check(picked[0] && picked[0].text.length === 250000 && !picked[0].clipped,
    'the NEWEST document must be kept in full -- it is the one they are working with')
  check(picked.length === 2 && picked[1].clipped && picked[1].text.length === 50000,
    'the older document must take the clip, with only the remaining allowance kept')
  check(!picked.some(d => d.text.startsWith('C')),
    'the OLDEST document must give way first once the cap is reached')
}
{
  // Under the cap, all three ride whole and none is marked clipped.
  const rows = [docRow({ message: 'A'.repeat(9000) }), docRow({ message: 'B'.repeat(9000) }), docRow({ message: 'C'.repeat(9000) })]
  const picked = selectRecentDocuments(rows)
  check(picked.length === 3 && picked.every(d => !d.clipped),
    'three ordinary-sized documents (job description + resume + notes) must all be carried whole')
}
check(selectRecentDocuments(null).length === 0 && selectRecentDocuments(undefined).length === 0,
  'a malformed rows value must be a clean no-op, not a throw')
{
  // The same document pasted twice must not be carried twice, or a duplicate
  // crowds out a genuinely different document.
  const same = 'DUPLICATE ' + 'd'.repeat(250000)
  const picked = selectRecentDocuments([
    docRow({ message: same }),
    docRow({ message: same, created_at: new Date(NOW - 2 * DAY).toISOString() }),
    docRow({ message: 'OTHER ' + 'o'.repeat(9000), created_at: new Date(NOW - 3 * DAY).toISOString() }),
  ])
  check(picked.length === 2, `a re-pasted document must be carried once, leaving room for the other, got ${picked.length}`)
  check(picked.some(d => d.text.startsWith('OTHER')), 'the genuinely different document must survive the dedupe')
}

// --- describeDocumentAge --------------------------------------------------
check(describeDocumentAge(new Date(NOW - 1000).toISOString(), NOW) === 'shared today', 'a document from minutes ago reads as shared today')
check(describeDocumentAge(new Date(NOW - DAY).toISOString(), NOW) === 'shared yesterday', 'a one-day-old document reads as yesterday')
check(describeDocumentAge(new Date(NOW - 5 * DAY).toISOString(), NOW) === 'shared 5 days ago', 'a five-day-old document names the days')
check(describeDocumentAge(new Date(NOW - 12 * DAY).toISOString(), NOW).includes('two weeks'), 'a twelve-day-old document reads as about two weeks')
check(typeof describeDocumentAge('not-a-date', NOW) === 'string', 'an unparseable date must degrade to a string, not throw')

// --- The label carries screen and record title ----------------------------
{
  const block = buildDocumentsBlock(selectRecentDocuments([
    docRow({ message: 'Q: tell me about yourself. ' + 'y'.repeat(9000), current_step: 'op', focus_record_id: 'rec-hope' }),
  ]), baseProfile.savedPlaybooks, NOW)
  check(block.includes('DOCUMENTS THEY SHARED RECENTLY'), 'the block must carry its own title')
  check(block.includes('shared yesterday'), 'the label must say how long ago it was shared')
  check(/, from /.test(block), 'the label must name the screen it was shared from')
  check(block.includes('Director of Operations'), 'the label must name the opportunity when focus_record_id resolves')
  check(block.includes('HOPE'), 'the label must name the company so two opportunities are distinguishable')
}
{
  // An unresolvable / absent record id must not invent an opportunity.
  const block = buildDocumentsBlock(selectRecentDocuments([docRow({ message: 'z'.repeat(9000), focus_record_id: 'rec-gone' })]), baseProfile.savedPlaybooks, NOW)
  check(!block.includes('undefined') && !block.includes('null'),
    'an unresolvable focus_record_id must leave the label clean, never render undefined/null')
}
check(buildDocumentsBlock([], baseProfile.savedPlaybooks, NOW) === '', 'no documents means no block at all, not an empty heading')

// --- The real assembly: sent once, in the block, not in history -----------
{
  const transcript = 'INTERVIEW TRANSCRIPT. ' + 'q'.repeat(250000)
  const history = [
    { role: 'user', content: transcript },
    { role: 'assistant', content: 'Got it -- what stood out to you?' },
    { role: 'user', content: 'they asked a lot about scaling' },
    { role: 'assistant', content: 'That tracks with the role.' },
  ]
  const { system, messages } = buildFor({
    history,
    message: 'what should I say when they ask about my weakness',
    recentDocuments: selectRecentDocuments([docRow({ message: transcript, focus_record_id: 'rec-deloitte' })]),
  })
  const systemText = system.map(s => s.text).join('\n')
  const historyText = messages.slice(0, -1).map(m => m.content).join('\n')

  const occurrences = (systemText + '\n' + historyText).split(transcript).length - 1
  check(occurrences === 1, `the transcript must appear exactly once across the whole request, found ${occurrences}`)
  check(systemText.includes(transcript), 'the one full copy must be the one in the system block')
  check(!historyText.includes(transcript), 'the conversation history must NOT still carry the transcript at full size')
  check(historyText.includes('shown in full under DOCUMENTS THEY SHARED RECENTLY'),
    "the clipped history turn must point at the block, so the model does not answer from the fragment")
  check(systemText.includes('Senior Manager'), 'the carried document must be labeled with its opportunity')
}
{
  // A large message that is NOT carried (aged out, or past the cap) gets the
  // honest note instead -- this is the wording that stops Coach answering
  // from a fragment as though it had the whole thing.
  const { messages } = buildFor({
    history: [{ role: 'user', content: 'OLD TRANSCRIPT ' + 'w'.repeat(250000) }, { role: 'assistant', content: 'noted' }],
    recentDocuments: [],
  })
  const historyText = messages.slice(0, -1).map(m => m.content).join('\n')
  check(historyText.includes('only the beginning is shown here'),
    'an uncarried long message must say only its beginning is present')
  check(historyText.includes('ask them to share it again'),
    'an uncarried long message must tell the model to ask rather than guess')
  check(!historyText.includes('shown in full under DOCUMENTS'),
    'an uncarried long message must NOT claim its full text is available below')
}
// NOTE for the two checks below: SYSTEM_PROMPT_HEAD now names the section in
// its own standing instructions, so the TITLE appears on every turn whether or
// not a document rides along. These assert on the document's BODY instead --
// the thing that actually costs tokens and leaks content.
{
  // Silent turns (session-open, moments, post-capture) never carry documents:
  // cost lever 6.3.2 trims them for exactly this reason.
  const body = 'SILENTCANARY' + 'x'.repeat(9000)
  const { system } = buildFor({ turnKind: 'session_open', recentDocuments: selectRecentDocuments([docRow({ message: body })]) })
  check(!system.map(s => s.text).join('\n').includes('SILENTCANARY'),
    'a silent turn must not carry the documents block')
}
{
  // General mode has no profile loaded by design; it must have no documents either.
  const body = 'GENERALCANARY' + 'x'.repeat(9000)
  const { system } = buildFor({ generalMode: true, recentDocuments: selectRecentDocuments([docRow({ message: body })]) })
  check(!system.map(s => s.text).join('\n').includes('GENERALCANARY'),
    'general mode must not carry the documents block')
}

// --- The 4-breakpoint ceiling still holds WITH documents present ----------
{
  const { system } = buildFor({ recentDocuments: selectRecentDocuments([docRow()]) })
  const markers = system.filter(s => s.cache_control).length
  check(markers <= 4, `the Claude API allows at most 4 cache_control markers; a turn carrying a document used ${markers}`)
  const systemText = system.map(s => s.text).join('\n')
  const docIdx = systemText.indexOf('DOCUMENTS THEY SHARED RECENTLY')
  const profileIdx = systemText.indexOf("TODAY'S DATE:")
  check(docIdx !== -1 && profileIdx !== -1 && docIdx < profileIdx,
    'the documents block must sit before the per-user profile block')
}

// --- The exclusion rules the query enforces, asserted on the query text ---
{
  const src = fs.readFileSync('api/coach.js', 'utf8')
  check(/AND \(u\.chat_cleared_at IS NULL OR m\.created_at > u\.chat_cleared_at\)/.test(src),
    'api/coach.js: the documents read must respect chat_cleared_at -- a document cleared by the person must never come back')
  check(/DOCUMENT_MAX_AGE_DAYS \* 86400000/.test(src) && /AND m\.created_at > \$\{documentCutoff\}/.test(src),
    'api/coach.js: the documents read must exclude anything older than DOCUMENT_MAX_AGE_DAYS')
  check(/AND \(m\.turn_kind = 'user' OR m\.turn_kind IS NULL\)/.test(src),
    'api/coach.js: the documents read must cover only real user turns')
  check(/AND length\(m\.message\) > \$\{HISTORY_MESSAGE_CLIP_CHARS\}/.test(src),
    'api/coach.js: the documents read must select only messages large enough to have been clipped')
  check(/focus_record_id\)\s*\n\s*VALUES[^\n]*\$\{inFocusRecordId \|\| null\}/.test(src),
    'api/coach.js: the chat_messages insert must record the in-focus record id, or the labels have nothing to resolve')
}

// --- Crisis-safety scan is scoped to what the person typed ----------------
{
  // The exact situation this protects: a benign question, and an attached
  // file whose text trips the scan on its own.
  //
  // The fixture is a suicide-prevention job posting, chosen deliberately over
  // the looser phrasings this was first written with ("kill the project", "I
  // wanted to die when the demo crashed"). Neither of those actually matches
  // DISTRESS_TRIGGER_RE -- it is narrow by design, requiring "kill MYSELF",
  // and "wanted to die" is not the "want to die" it looks for -- so a test
  // built on them would have passed while proving nothing. This one is both
  // real and uncomfortably plausible: someone targeting a mental-health
  // nonprofit attaches the posting, and every word of the trigger is in the
  // employer's own copy.
  const attached = 'Attached: crisis-line-jd.txt\nYou will lead our suicide prevention outreach team and train volunteers.'
  const typed = 'can you summarize this'
  check(matchesDistressTrigger(attached + '\n\n' + typed) === true,
    'precondition: the combined text DOES trip the distress scan -- otherwise this test proves nothing')
  check(matchesDistressTrigger(typed) === false,
    'scanning only what the person typed must NOT trip the distress pointer on a benign question')

  const src = fs.readFileSync('api/coach.js', 'utf8')
  check(/const distressSource = typedTextForSafety === null \? message : typedTextForSafety/.test(src),
    'api/coach.js: the distress source must be the typed text when present and the whole message otherwise')
  check(/ensureDistressSupport\(distressSource, strippedText\)/.test(src) && /matchesDistressTrigger\(distressSource\)/.test(src),
    'api/coach.js: BOTH distress call sites must read the same scoped source -- scoping one and not the other is worse than neither')
  check(/const typedTextForSafety = typeof typedText === 'string' \? typedText : null/.test(src),
    'api/coach.js: an absent typedText must fall back to the whole message, so pasted text stays covered as today')

  const chat = fs.readFileSync('src/components/Chat.jsx', 'utf8')
  check(/const block = `Attached: \$\{f\.name\}\\n\$\{t\}`/.test(chat),
    'src/components/Chat.jsx: the attachment must be prefixed with its filename')
  check(/attachedBlocksRef\.current = \[\.\.\.attachedBlocksRef\.current, block\]/.test(chat),
    'src/components/Chat.jsx: the attached block must be recorded so send() can subtract it')
  check(/\.\.\.\(typedText === null \|\| isSilentTurn \? \{\} : \{ typedText \}\)/.test(chat),
    'src/components/Chat.jsx: typedText must be sent only on a turn that carried an attachment')
}

// --- The clip note itself -------------------------------------------------
{
  const long = 'L'.repeat(HISTORY_MESSAGE_CLIP_CHARS + 500)
  check(clipOlderHistoryMessage(long, true).includes('shown in full under DOCUMENTS THEY SHARED RECENTLY'),
    'the carried variant must point at the block')
  check(clipOlderHistoryMessage(long, false).includes('only the beginning is shown here'),
    'the uncarried variant must say only the beginning is present')
  check(clipOlderHistoryMessage('short', true) === 'short', 'a short message is untouched regardless of variant')
  check(clipOlderHistoryMessage(long).includes('only the beginning'),
    'the default (no second argument) must be the conservative, honest variant')
}

// --- The user guide tells the person how long it lasts --------------------
{
  const guide = fs.readFileSync('src/data/user-guide/my-coach.md', 'utf8')
  check(/two weeks/.test(guide), 'src/data/user-guide/my-coach.md: the guide must say how long a shared document stays available')
  check(/Clear/.test(guide), 'src/data/user-guide/my-coach.md: the guide must say Clear removes it')
}

if (failures) {
  console.error(`test-coach-document-context: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-document-context: OK (a large transcript is sent exactly once, in the labeled block rather than in history; the three-document count cap, the combined character cap and the newest-in-full/oldest-clipped-first order all hold; labels carry age, screen and opportunity; chat_cleared_at, the 14-day window and the turn_kind filter are enforced in the query; silent turns and general mode carry nothing; the 4-breakpoint ceiling survives a document; and the crisis-safety scan reads only what the person typed when a file is attached)')
}
