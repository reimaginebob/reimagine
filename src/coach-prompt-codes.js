// Canonical vocabulary for coach_prompt_engagement (2026-09-07). Bounded lists,
// same shape and reason as src/pursuit-close-reasons.js: the whole point of
// this table is that prompt_code and trigger_type stay a fixed, small set so
// they can be grouped and compared later, not free text that would fragment
// into one-off values over time. Imported by both api/coach-prompt-
// engagement.js and src/App.jsx (.js extension across the api/src boundary,
// per CLAUDE.md's Vercel bundler rule).

// The QUESTION being asked. Add a new code here when a new proactive prompt
// ships; never repurpose an existing one for a different question, or past
// and future rows silently mean different things under the same label.
export const PROMPT_CODES = [
  'employment_status',
  'search_intake',
  'opportunity_archive',
  'life_events_thin',
  'brand_richness',
]

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
export const PROMPT_OUTCOMES = ['shown', 'accepted', 'declined']
