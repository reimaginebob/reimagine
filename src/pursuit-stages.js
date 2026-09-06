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
