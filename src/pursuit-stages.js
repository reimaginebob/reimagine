// My Search (brief 2026-08-14). Stage vocabulary shared by the card editor and
// the Coach one-tap capture (App.jsx's <select>, and Chat.jsx's opportunity-
// update recap). value is the stored enum; label is the render-true name.
// The tap is always the user's -- the detector only decides whether to
// offer, never what to write.
export const PURSUIT_STAGES = [
  { value: 'researching', label: 'Researching' },
  { value: 'applied', label: 'Applied' },
  { value: 'phone_screen', label: 'Phone Screen' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'final_round', label: 'Final Round' },
  { value: 'offer', label: 'Offer' },
  { value: 'closed', label: 'Closed' },
]
export const PURSUIT_STAGE_LABELS = Object.fromEntries(PURSUIT_STAGES.map(s => [s.value, s.label]))

// How a closed opportunity ended. Same values api/pursuit-status.js accepts
// (VALID_OUTCOMES); read by Chat.jsx's opportunity-update recap so a Coach
// capture can say "Closed, Accepted" before the tap (2026-09-14).
export const PURSUIT_OUTCOMES = [
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'not_selected', label: 'Not selected' },
  { value: 'withdrew', label: 'Withdrew' },
  { value: 'no_response', label: 'No response' },
]
export const PURSUIT_OUTCOME_LABELS = Object.fromEntries(PURSUIT_OUTCOMES.map(o => [o.value, o.label]))
