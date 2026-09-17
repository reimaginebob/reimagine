// Session-scoped Coach distress/mood holds (Output/handoff/2026-09-16_four-
// my-coach-breaks-brief.md, item C). These two holds previously lived only
// in React state (coachDistressHold/coachMoodHold, src/App.jsx), set from
// X-Coach-Distress / X-Coach-Mood response headers and checked by the
// Moments evaluator before it fires anything. A page reload re-mounts that
// state at its initial false -- so a hold set moments earlier by a
// distressed message silently vanished, and the very next silent turn
// after a reload could fire a proactive Moment the person had just
// signaled they weren't in a place for.
//
// sessionStorage matches the holds' own intended scope: cleared at the
// next session open (handleCoachSessionOpen) or when the account's local
// state is cleared (Start Fresh, Sign Out), never carried across tabs or
// devices -- but, unlike plain React state, it survives a reload within
// the same tab.
//
// Plain `.js`, no JSX, so it stays safe to import from either src/* or
// api/* later without tripping the `.mjs` cross-boundary bundler failure
// (CLAUDE.md section 8; PR #76 / 940557b).

const DISTRESS_KEY = 'pe_coach_distress_hold'
const MOOD_KEY = 'pe_coach_mood_hold'

export function readCoachHolds() {
  let distress = false
  let mood = false
  try { distress = sessionStorage.getItem(DISTRESS_KEY) === '1' } catch {}
  try { mood = sessionStorage.getItem(MOOD_KEY) === '1' } catch {}
  return { distress, mood }
}

export function writeCoachHold(kind) {
  const key = kind === 'distress' ? DISTRESS_KEY : MOOD_KEY
  try { sessionStorage.setItem(key, '1') } catch {}
}

export function clearCoachHolds() {
  try { sessionStorage.removeItem(DISTRESS_KEY) } catch {}
  try { sessionStorage.removeItem(MOOD_KEY) } catch {}
}
