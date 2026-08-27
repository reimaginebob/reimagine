// Record what a background Anthropic call cost.
//
// api/claude.js and api/coach.js already write their own generation_events rows
// (they have a user to attribute the spend to and a step tag to group it by).
// The daily classifier crons did not write anything at all, so their spend was
// invisible to the Economics tab and, more to the point, to the budget watchdog
// that now reads the same table against the month's cap. A spend alarm that
// cannot see part of the spend is the wrong kind of reassuring.
//
// Rows written here carry a NULL user_id — nobody is being served, the app is
// doing its own housekeeping — and a kind tag naming the job, so they can be
// told apart from user-facing generations in every existing query.
//
// Best-effort and silent, exactly like the other logging paths: a failure to
// record cost must never fail the job that spent it.

import { sql } from './db.js'
import { costFromUsage } from './usage-cost.js'

export async function logSpend(kind, model, usage) {
  try {
    const tag = (typeof kind === 'string' && kind.trim()) ? kind.trim().slice(0, 40) : null
    const c = costFromUsage(model, usage)
    await sql`
      INSERT INTO generation_events
        (user_id, kind, model, input_tokens, output_tokens, cache_write_tokens, cache_read_tokens, web_searches, cost_usd)
      VALUES
        (NULL, ${tag}, ${c.model}, ${c.inputTokens}, ${c.outputTokens}, ${c.cacheWriteTokens}, ${c.cacheReadTokens}, ${c.webSearches}, ${c.costUsd})`
  } catch { /* never surfaces to the caller */ }
}
