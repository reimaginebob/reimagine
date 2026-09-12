// Canonical vocabulary for coach_prompt_engagement (2026-09-07). Bounded lists,
// same shape and reason as src/pursuit-close-reasons.js: the whole point of
// this table is that prompt_code and trigger_type stay a fixed, small set so
// they can be grouped and compared later, not free text that would fragment
// into one-off values over time. Imported by both api/coach-prompt-
// engagement.js and src/App.jsx (.js extension across the api/src boundary,
// per CLAUDE.md's Vercel bundler rule).
import { MOMENT_CATALOG } from './coach-moments.js'

// Codes fired from call sites with no MOMENT_CATALOG row -- the employment/
// search/life-events/brand/values checks predate the catalog and still fire
// directly from App.jsx/Chat.jsx, not through the evaluator, so they can't
// be derived and are listed by hand.
const NON_CATALOG_PROMPT_CODES = [
  'employment_status',
  'search_intake',
  'opportunity_archive',
  'life_events_thin',
  'brand_richness',
  'values_thin',
]

// The QUESTION being asked. Every MOMENT_CATALOG row that carries a
// promptCode is picked up automatically -- this used to be a second,
// hand-maintained list that had to be edited in lockstep with the catalog,
// and #861's op-side rows (op_pipeline_arrival, delivery_op_*, op_next_move,
// op_interview_close, op_resume_jump) never got added here, so every one of
// their logPromptEngagement calls 400'd silently (this endpoint is
// best-effort by design, so nothing surfaced the gap until someone went
// looking). Deriving from the catalog closes the two-lists gap for good
// (the #848 lesson, same shape as src/coach-nav-map.js's generate-and-
// compare gate): a new catalog row with a promptCode is covered with no
// second edit required.
export const PROMPT_CODES = [...new Set([
  ...NON_CATALOG_PROMPT_CODES,
  ...MOMENT_CATALOG.map(entry => entry.promptCode).filter(Boolean),
])]

// The MECHANISM that caused one particular firing of a prompt_code.
//   hub_arrival        a scripted one-time prompt fired on arrival at a hub
//                       surface (Put It to Work / My Playbooks / My Coach) or
//                       coach-open, same trigger as the existing employment
//                       and search-intake prompts.
//   model_detected      Coach's own inline offer, surfaced during a reply
//                       because it detected something said in conversation
//                       (e.g. opportunity_archive).
//   topic_close_tap     fired right after a quick-reply tap-confirm
//                       completed -- the reciprocity moment.
//   topic_close_language fired because the person's last message matched a
//                       closing-language pattern and was shorter than
//                       Coach's preceding reply.
export const TRIGGER_TYPES = [
  'hub_arrival',
  'model_detected',
  'topic_close_tap',
  'topic_close_language',
]

// shown: the prompt was displayed. accepted: a tap that engaged with the ask
// (a real answer, or consent to continue). declined: a tap that explicitly
// said no. There is no separate "no_response" value on purpose -- see the
// migration's comment: it is shown-count minus (accepted+declined)-count for
// the same prompt_code/trigger_type, derived at query time, never written.
//
// The four "offer made"/"do it now"/"remind later"/"not for me" values plus
// "answered" (decision d08, brief §2.6) are the widen-the-search set's own
// vocabulary -- a three-tap shape the shown/accepted/declined triple above
// does not distinguish (accepted alone cannot tell "did it now" apart from
// "asked to be reminded"). They are additive, not a replacement: every row
// that shipped before Phase 4 Part 2's widen-the-search rows still logs
// shown/accepted/declined, and migrating those is tracked separately, not
// bundled into this brief.
export const PROMPT_OUTCOMES = ['shown', 'accepted', 'declined', 'offer made', 'do it now', 'remind later', 'not for me', 'answered']
