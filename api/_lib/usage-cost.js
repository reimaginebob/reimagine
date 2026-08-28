// What one Anthropic call cost, in dollars.
//
// Called at write time by api/claude.js and api/coach.js; the result is stored
// on generation_events. Deliberately not derived later from token counts:
// published prices change, and repricing an old row would misstate the month it
// belongs to.
//
// Rates are dollars per MILLION tokens. Cache reads are a tenth of the input
// rate and cache writes a quarter more than it -- that spread is most of the
// variance in what a generation costs here, because both surfaces put a large
// stable system prefix behind a cache_control breakpoint on every call.
// Multiplying total tokens by the headline input rate would overstate the bill
// several times over.
//
// Cross-boundary note (CLAUDE.md section 8): this lives under api/ and is
// imported with a .js extension, the same as ./db.js and ./session.js.
//
// Source: Anthropic pricing page, checked 2026-08-21. When a rate or a model
// changes, add a row -- do not edit a rate that historical rows were priced at,
// because those rows already hold their dollars and only new ones are affected.

const PRICES = {
  // Claude Sonnet 5 -- what both generation surfaces call as of 2026-08-28.
  'claude-sonnet-5': { input: 2.00, output: 10.00, cacheWrite: 2.50, cacheRead: 0.20 },
  // Claude Sonnet 4.5 -- what they called before that. Kept because rows
  // already hold their dollars and historical rows must still price correctly.
  'claude-sonnet-4-5': { input: 3.00, output: 15.00, cacheWrite: 3.75, cacheRead: 0.30 },
  // Claude Haiku 4.5 -- the two daily classifier crons (coach insights, feedback
  // ingest). Added 2026-08-27 with the budget watchdog: those calls used to be
  // unlogged, and the fallback below would have priced them at Sonnet rates,
  // overstating them threefold in a number the spend alarm reads.
  'claude-haiku-4-5': { input: 1.00, output: 5.00, cacheWrite: 1.25, cacheRead: 0.10 },
}

// Used when a call reports a model with no rate above (a model swap that lands
// before this table is updated). The row still records the real model string,
// so anything priced on the fallback is findable later:
//   SELECT DISTINCT model FROM generation_events WHERE model <> 'claude-sonnet-4-5';
const FALLBACK_MODEL = 'claude-sonnet-5'

// Server-side web search, billed per search rather than per token. Only
// api/claude.js requests the tool, and only on the surfaces that pass
// webSearch: true.
const WEB_SEARCH_USD_PER_REQUEST = 0.01

// Coerce anything the API might hand back into a non-negative whole number.
// Missing fields are absent rather than zero on some responses, and the usage
// object is not worth trusting blindly on an error response.
function count(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

// usage is the raw `usage` object from an Anthropic response. Returns the token
// breakdown plus cost in dollars, rounded to the micro-dollar the column holds.
// Never throws: a malformed or missing usage object yields a zero-cost row
// rather than losing the generation from the log entirely.
export function costFromUsage(model, usage) {
  const u = (usage && typeof usage === 'object') ? usage : {}
  const inputTokens = count(u.input_tokens)
  const outputTokens = count(u.output_tokens)
  const cacheWriteTokens = count(u.cache_creation_input_tokens)
  const cacheReadTokens = count(u.cache_read_input_tokens)
  const webSearches = count(u.server_tool_use && u.server_tool_use.web_search_requests)

  const modelId = (typeof model === 'string' && model.trim()) ? model.trim().slice(0, 60) : FALLBACK_MODEL
  const rate = PRICES[modelId] || PRICES[FALLBACK_MODEL]

  const tokenCost = (
    inputTokens * rate.input +
    outputTokens * rate.output +
    cacheWriteTokens * rate.cacheWrite +
    cacheReadTokens * rate.cacheRead
  ) / 1e6
  const costUsd = tokenCost + (webSearches * WEB_SEARCH_USD_PER_REQUEST)

  return {
    model: modelId,
    inputTokens,
    outputTokens,
    cacheWriteTokens,
    cacheReadTokens,
    webSearches,
    costUsd: Math.round(costUsd * 1e6) / 1e6,
  }
}

// Sum usage across several calls into one usage-shaped object. My Coach can run
// a second generation on a voice retry, and both calls are billed; the turn is
// logged once, with the total.
export function addUsage(acc, usage) {
  const u = (usage && typeof usage === 'object') ? usage : {}
  acc.input_tokens = count(acc.input_tokens) + count(u.input_tokens)
  acc.output_tokens = count(acc.output_tokens) + count(u.output_tokens)
  acc.cache_creation_input_tokens = count(acc.cache_creation_input_tokens) + count(u.cache_creation_input_tokens)
  acc.cache_read_input_tokens = count(acc.cache_read_input_tokens) + count(u.cache_read_input_tokens)
  return acc
}
