// Guards finding #2.1 from the 2026-09-08 prelaunch audit: /api/claude was an
// anonymous, uncapped Anthropic proxy with web search. The legacy branch
// spread the caller's whole body (`...reqBody`) into the Anthropic request,
// so a caller controlled `messages`, `tools`, `output_config`, and
// `max_tokens` directly; the origin check only inspects a header, which any
// non-browser caller (curl) controls; and there was no session requirement
// at all.
//
// Pre-flight discovery (see the PR body / commit message) found no current,
// by-design "early orientation, no session needed" generation: the client
// requires sign-up before any orientation screen renders (App.jsx gates the
// whole step-rendering function behind `signedUp`), and the one call site
// that could still reach this endpoint with no session (P.skillsExtract) is
// a client bug, not a designed flow. EARLY_ORIENTATION_STEPS is therefore
// empty; this test asserts it stays that way unless someone changes it
// deliberately.
//
// BEHAVIORAL for buildLegacyMessagesAndTools (the one piece of real request-
// validation logic in this file, exported for exactly this reason): imports
// the real module with dummy env vars and calls it directly. The full HTTP
// handler (session lookup, generation cap, upstream fetch) needs a live DB
// and a live Anthropic key and is guarded by source-presence checks instead.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

process.env.DATABASE_URL ||= 'postgres://user:pass@localhost/dummy'
process.env.ANTHROPIC_API_KEY ||= 'dummy'
process.env.RESEND_API_KEY ||= 'dummy'

const { buildLegacyMessagesAndTools } = await import('../api/claude.js')

// --- buildLegacyMessagesAndTools: the real client's exact shape passes ----

// A plain-string content turn (the common case: no profileBlock).
{
  const out = buildLegacyMessagesAndTools({ messages: [{ role: 'user', content: 'hello world' }] })
  check(out !== null, 'a well-formed single-string user turn was rejected')
  check(out && out.messages.length === 1 && out.messages[0].role === 'user' && out.messages[0].content === 'hello world',
    'a well-formed single-string user turn was not passed through faithfully')
  check(out && !out.tools, 'tools appeared on a request with no tools array')
  check(out && !out.output_config, 'output_config appeared on a request with no effort')
}

// The profileBlock shape: two text blocks, the first cached.
{
  const out = buildLegacyMessagesAndTools({
    messages: [{ role: 'user', content: [
      { type: 'text', text: 'PROFILE BLOCK', cache_control: { type: 'ephemeral' } },
      { type: 'text', text: 'the actual prompt' },
    ] }],
  })
  check(out !== null, 'the two-block profileBlock shape was rejected')
  check(out && Array.isArray(out.messages[0].content) && out.messages[0].content.length === 2,
    'the two-block profileBlock shape did not round-trip both blocks')
  check(out && out.messages[0].content[0].cache_control && out.messages[0].content[0].cache_control.type === 'ephemeral',
    'cache_control on the first block was dropped')
  check(out && out.messages[0].content[1].cache_control === undefined,
    'a block with no cache_control had one invented')
}

// --- Caller-supplied tools are NEVER forwarded verbatim --------------------

{
  const out = buildLegacyMessagesAndTools({
    messages: [{ role: 'user', content: 'x' }],
    tools: [{ type: 'bash_20250124', name: 'bash' }, { type: 'computer_20250124', name: 'computer' }],
  })
  check(out !== null, 'a request with a non-empty tools array was wrongly rejected outright')
  check(out && Array.isArray(out.tools) && out.tools.length === 1 && out.tools[0].type === 'web_search_20250305' && out.tools[0].name === 'web_search',
    'a caller-supplied tools array was forwarded instead of being replaced with the one server-defined web_search tool -- this is the exact hole finding #2.1 named')
}

// An empty tools array is a no-op, not a signal.
{
  const out = buildLegacyMessagesAndTools({ messages: [{ role: 'user', content: 'x' }], tools: [] })
  check(out !== null && !out.tools, 'an empty tools array was treated as "wants web search"')
}

// --- effort: accepted from either shape, validated against the enum -------

{
  const nested = buildLegacyMessagesAndTools({ messages: [{ role: 'user', content: 'x' }], output_config: { effort: 'low' } })
  check(nested && nested.output_config && nested.output_config.effort === 'low', 'nested output_config.effort (the real client\'s shape) was not honored')

  const bare = buildLegacyMessagesAndTools({ messages: [{ role: 'user', content: 'x' }], effort: 'high' })
  check(bare && bare.output_config && bare.output_config.effort === 'high', 'bare effort was not honored')

  const junk = buildLegacyMessagesAndTools({ messages: [{ role: 'user', content: 'x' }], effort: 'maximum-overdrive' })
  check(junk && !junk.output_config, 'an invalid effort value was passed through instead of being dropped -- this is the exact junk-effort-value 400 finding #2.1 named')
}

// --- Malformed shapes are rejected (null), not passed through in any form -

const malformed = [
  {},
  { messages: [] },
  { messages: [{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }] },
  { messages: [{ role: 'assistant', content: 'x' }] },
  { messages: [{ role: 'user', content: '' }] },
  { messages: [{ role: 'user', content: 123 }] },
  { messages: [{ role: 'user', content: [] }] },
  { messages: [{ role: 'user', content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }, { type: 'text', text: 'c' }] }] },
  { messages: [{ role: 'user', content: [{ type: 'image', text: 'a' }] }] },
  { messages: [{ role: 'user', content: [{ type: 'text' }] }] },
  { messages: null },
  { messages: 'not-an-array' },
]
for (const body of malformed) {
  check(buildLegacyMessagesAndTools(body) === null, `malformed body was not rejected: ${JSON.stringify(body)}`)
}

// --- Source-presence: the session gate itself, and that the spread is gone

const CLAUDE_API = 'api/claude.js'
const claude = fs.readFileSync(CLAUDE_API, 'utf8')

check(claude.includes('const EARLY_ORIENTATION_STEPS = new Set([])'),
  `${CLAUDE_API}: EARLY_ORIENTATION_STEPS is no longer empty -- if a step was deliberately added, update this test to match; if not, this is a regression back toward the anonymous-proxy hole`)
check(/if \(!sessionUser && !EARLY_ORIENTATION_STEPS\.has\(reqStep\)\) \{\s*return res\.status\(401\)/.test(claude),
  `${CLAUDE_API}: the session-required gate is missing or no longer returns 401 for a caller with no session and no allowlisted step`)
check(!claude.includes('...reqBody,'),
  `${CLAUDE_API}: a caller's whole request body is still spread into the Anthropic request somewhere -- this is the exact vulnerability finding #2.1 described`)
check(!/anthropicBody\s*=\s*\{\s*\.\.\.reqBody/.test(claude),
  `${CLAUDE_API}: anthropicBody is still built by spreading reqBody`)
check(claude.includes('const built = buildLegacyMessagesAndTools(reqBody)'),
  `${CLAUDE_API}: the legacy branch no longer routes through buildLegacyMessagesAndTools`)

// The auth gate must run BEFORE any Anthropic call, so an anonymous caller
// can never trigger an upstream 400 that pages the operator (finding #2.1's
// "stop paging the operator on anonymous 400s").
const gateIdx = claude.indexOf('if (!sessionUser && !EARLY_ORIENTATION_STEPS.has(reqStep))')
const upstreamIdx = claude.indexOf('const callUpstream = (body) =>')
check(gateIdx !== -1 && upstreamIdx !== -1 && gateIdx < upstreamIdx,
  `${CLAUDE_API}: the session gate does not run before the first Anthropic call -- an anonymous caller could still trigger an upstream failure and page the operator`)

if (failures) {
  console.error(`test-claude-auth-hardening: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-claude-auth-hardening: OK (buildLegacyMessagesAndTools passes the real client\'s exact shapes, replaces any caller-supplied tools with the one server-defined web_search tool, validates effort against the enum, rejects every malformed shape tried, and the session-required gate runs before any Anthropic call with the early-orientation allowlist empty)')
}
