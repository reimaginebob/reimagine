// Guards finding #2.2 from the 2026-09-07 My Coach diagnostic review
// (independently verified before this fix): every capture trailer was
// extracted with a per-trailer regex shaped like
// `/^\s*NAME:\s*(\{[\s\S]*?\})\s*$/im`. Run against realistic model output,
// this failed on: a markdown-bold trailer name (`**NAME:**`, no match at
// all -- the whole trailer shown to the person), and trailing prose left
// after the JSON on the same line (no match -- same failure). A fenced JSON
// block parsed but left stray backtick lines visible. Only ACTIVITY had a
// mangled-line sweep; the other 17 protocols left a malformed trailer
// sitting in the reply as machine junk.
//
// This is a BEHAVIORAL test, not a string-presence check (per finding
// #5.1): it imports api/coach.js and calls the real extractTrailer function
// against real strings, the same way the brief's own verification proved
// the old regex's failure modes by executing them.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// api/coach.js constructs its DB and email clients eagerly at module load
// (finding #5.1 -- this is exactly why 33 of 36 existing coach tests never
// import it). Dummy values let the module load without a real connection;
// extractTrailer itself never touches either client.
process.env.DATABASE_URL ||= 'postgres://user:pass@localhost/dummy'
process.env.RESEND_API_KEY ||= 'dummy'
process.env.ANTHROPIC_API_KEY ||= 'dummy'

const { extractTrailer } = await import('../api/coach.js')

// Shape 1: single-line JSON, nested array -- the common case, must keep working.
{
  const input = 'Great, noted.\n\nOPPORTUNITYUPDATE: {"stage":"applied","people":[{"name":"Sam"}]}'
  const { text, raw } = extractTrailer(input, 'OPPORTUNITYUPDATE')
  check(raw === '{"stage":"applied","people":[{"name":"Sam"}]}', 'shape 1 (single-line JSON): raw JSON not extracted correctly')
  check(!text.includes('OPPORTUNITYUPDATE'), 'shape 1: trailer name not removed from visible text')
  check(text.trim() === 'Great, noted.', 'shape 1: visible text not cleanly reduced to the prose')
  if (raw) check(JSON.parse(raw).stage === 'applied', 'shape 1: extracted raw does not parse back to the original data')
}

// Shape 2: pretty-printed JSON across multiple lines, nested object. The
// brief's own example table claimed this failed against the old regex; independent
// verification found it actually worked (the lazy [\s\S]*? plus the `m` flag
// already spanned newlines). Pin it working under the new balanced-brace
// scanner too, since that claim being wrong doesn't mean it's untested.
{
  const input = 'Here you go.\n\nVALUESCAPTURE: {\n  "values": "curiosity",\n  "passions": {\n    "cause": "mentoring"\n  }\n}'
  const { text, raw } = extractTrailer(input, 'VALUESCAPTURE')
  check(raw !== null, 'shape 2 (pretty-printed JSON): no match found')
  if (raw) {
    const parsed = JSON.parse(raw)
    check(parsed.values === 'curiosity' && parsed.passions && parsed.passions.cause === 'mentoring',
      'shape 2: pretty-printed nested JSON did not parse back correctly')
  }
  check(!text.includes('VALUESCAPTURE'), 'shape 2: trailer name not removed from visible text')
}

// Shape 3: wrapped in a code fence. Must parse AND leave no stray backtick
// lines behind -- the old regex parsed the JSON but left the fence markers
// as a visible empty code block.
{
  const input = 'Noted.\n\n```\nSKILLSCAPTURE: {"technical":["Python"]}\n```'
  const { text, raw } = extractTrailer(input, 'SKILLSCAPTURE')
  check(raw === '{"technical":["Python"]}', 'shape 3 (fenced JSON): raw JSON not extracted correctly')
  check(!text.includes('```'), 'shape 3: stray code-fence markers left in the visible text')
  check(!text.includes('SKILLSCAPTURE'), 'shape 3: trailer name not removed from visible text')
}

// Shape 4: markdown-bold trailer name. The old regex required the name at
// the very start of the line with no formatting -- this simply never matched.
{
  const input = 'Sounds good.\n\n**OPPORTUNITYARCHIVE:** {"opportunity":"Acme Corp"}'
  const { text, raw } = extractTrailer(input, 'OPPORTUNITYARCHIVE')
  check(raw === '{"opportunity":"Acme Corp"}', 'shape 4 (markdown-bold name): bold trailer name not tolerated')
  check(!text.includes('OPPORTUNITYARCHIVE') && !text.includes('**'), 'shape 4: bold markers or trailer name left in visible text')
}

// Shape 5: trailing prose after the JSON on the same line. The old regex's
// `\s*$` required nothing but whitespace after the closing brace -- any
// trailing chatter meant no match at all. The balanced-brace scan finds the
// JSON's true end regardless of what follows, and correctly LEAVES the
// trailing prose visible (it's real coaching text, not machine syntax).
{
  const input = 'On it.\n\nCLOSEREASON: {"opportunity":"Acme","reasonCode":"ghosted"} — let me know if anything changes.'
  const { text, raw } = extractTrailer(input, 'CLOSEREASON')
  check(raw === '{"opportunity":"Acme","reasonCode":"ghosted"}', 'shape 5 (trailing prose on same line): raw JSON not extracted correctly')
  check(!text.includes('CLOSEREASON'), 'shape 5: trailer name not removed from visible text')
  check(text.includes('let me know if anything changes'), 'shape 5: trailing prose on the same line was incorrectly discarded, not just the trailer')
}

// Mangled trailer: unclosed brace. Previously left sitting in the reply as
// visible machine junk for every protocol except ACTIVITY's own bespoke
// sweep. Must now sweep through the end of that line for ANY trailer name.
{
  const input = 'Got it.\n\nPRIORITIESCAPTURE: {"compFloor":"$150k"\n\nAnything else?'
  const { text, raw } = extractTrailer(input, 'PRIORITIESCAPTURE')
  check(raw === null, 'mangled trailer: an unclosed brace should not parse as valid JSON')
  check(!text.includes('PRIORITIESCAPTURE'), 'mangled trailer: the malformed line was not swept from the visible text')
  check(text.includes('Anything else?'), 'mangled trailer: content after the malformed line was incorrectly discarded too')
}

// No match: the name is not present at all. Must be a clean no-op.
{
  const input = 'Just a normal reply with no trailer at all.'
  const { text, raw } = extractTrailer(input, 'LIFESTORYCAPTURE')
  check(raw === null, 'no-match case: raw should be null when the trailer name is absent')
  check(text === input, 'no-match case: text should be returned unchanged when nothing matches')
}

// Two trailers, one reply: each extraction must only touch its own name,
// leaving the other trailer (and the prose) untouched, in either order.
{
  const input = 'Two things landed.\n\nVALUESCAPTURE: {"values":"integrity"}\n\nASSESSMENTCAPTURE: {"text":"INTJ"}'
  const step1 = extractTrailer(input, 'VALUESCAPTURE')
  check(step1.raw === '{"values":"integrity"}', 'two-trailers-one-reply: first extraction (VALUESCAPTURE) failed')
  check(step1.text.includes('ASSESSMENTCAPTURE'), 'two-trailers-one-reply: first extraction disturbed the second trailer')
  const step2 = extractTrailer(step1.text, 'ASSESSMENTCAPTURE')
  check(step2.raw === '{"text":"INTJ"}', 'two-trailers-one-reply: second extraction (ASSESSMENTCAPTURE) failed after the first ran')
  check(!step2.text.includes('VALUESCAPTURE') && !step2.text.includes('ASSESSMENTCAPTURE'),
    'two-trailers-one-reply: final text still carries a trailer name after both extractions')
  check(step2.text.trim() === 'Two things landed.', 'two-trailers-one-reply: final visible text is not cleanly reduced to the shared prose')
}

// All 16 converted call sites in api/coach.js actually route through
// extractTrailer now, not the old per-trailer regex -- a partial migration
// would leave some protocols with the original failure modes.
const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')
const CONVERTED = [
  'ACTIVITY', 'VALUESCAPTURE', 'REPUTATIONCAPTURE', 'SKILLSCAPTURE', 'SKILLSREMOVE',
  'PRIORITIESCAPTURE', 'LIFESTORYCAPTURE', 'ASSESSMENTCAPTURE', 'BRANDREWORK',
  'SECTIONREWORK', 'OPCARDREWORK', 'OPPORTUNITYCONTEXT', 'OPPORTUNITYARCHIVE',
  'CLOSEREASON', 'OPPORTUNITYUPDATE', 'SEARCHINTAKE',
]
check((coach.match(/extractTrailer\(strippedText/g) || []).length === CONVERTED.length,
  `${COACH}: expected exactly ${CONVERTED.length} call sites using extractTrailer -- found a different count`)
for (const name of CONVERTED) {
  check(coach.includes(`extractTrailer(strippedText, '${name}')`),
    `${COACH}: ${name} does not appear to route through extractTrailer`)
}
check(!/strippedText\.match\(\/\^\\s\*(?:ACTIVITY|VALUESCAPTURE|REPUTATIONCAPTURE|SKILLSCAPTURE|SKILLSREMOVE|PRIORITIESCAPTURE|LIFESTORYCAPTURE|ASSESSMENTCAPTURE|BRANDREWORK|SECTIONREWORK|OPCARDREWORK|OPPORTUNITYCONTEXT|OPPORTUNITYARCHIVE|CLOSEREASON|OPPORTUNITYUPDATE|SEARCHINTAKE):/.test(coach),
  `${COACH}: an old per-trailer regex survives for one of the 16 converted protocols`)
check(coach.includes("strippedText.match(/^\\s*MILESTONEMENTIONED:\\s*(\\w+)\\s*$/im)") && coach.includes("strippedText.match(/^\\s*COACHNOTE:\\s*save\\s*$/im)"),
  `${COACH}: MILESTONEMENTIONED and COACHNOTE (the two non-JSON, out-of-scope trailers) should still use their own simple regex`)

if (failures) {
  console.error(`test-coach-trailers: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-trailers: OK (extractTrailer parses single-line, pretty-printed, fenced, and bold-named trailers, tolerates trailing prose on the same line, sweeps mangled trailers instead of leaving junk, is a clean no-op when nothing matches, handles two trailers in one reply, and all 16 JSON-shaped protocols route through it)')
}
