// My Coach feature-routing — reachability sanitizer + SELFCHECK parsing.
//
// Replaces the earlier keyword router (detectFeatureNavigate). The model now
// runs a "hidden self-check" each turn and emits a SELFCHECK trailer naming the
// matched feature by a stable slug (or "none"). This module's job is NOT to
// guess intent — the model does that well — but to GUARANTEE the navigation
// button can never be dead or wrong-target, by resolving the slug to a step
// that actually renders, given the user's profile state.
//
// Why a slug, not a step id: the playbook features (Go-to-Market, LinkedIn
// Remix, Resume Refresh, Bridge Story, Interview Prep, Industry Background) have
// NO standalone rStep() case — they render only as sections inside `focus`,
// gated on a selected lane. So a literal "NAVIGATE: p8" is a dead screen. Slugs
// decouple the model's intent from the step ids, and the sanitizer maps a slug
// to a reachable step (or null = prose-only) per the locked product rule:
// focus-section features with NO lane selected get NO button (a button that
// lands on a "pick a direction first" gate is the soft version of a dead link).
//
// Cross-boundary import note: imported by api/coach.js, so this file is `.js`
// (never `.mjs`); the Vercel bundler does not reliably trace `.mjs` from api/*
// into src/* (the 2026-05-27 FUNCTION_INVOCATION_FAILED outage, PR #76).

// The stable feature vocabulary the model emits in SELFCHECK. Decoupled from
// step ids on purpose.
export const CANONICAL_FEATURE_SLUGS = [
  'personal-brand', 'role-options', 'bridge-story', 'go-to-market',
  'resume-refresh', 'linkedin-remix', 'interview-prep', 'industry-background',
  'income-now', 'opportunity-playbook',
]

// Features that ARE a standalone, always-rendering step. Button always safe.
const STANDALONE_TARGET = {
  'personal-brand': 'p3',
  'role-options': 'laneSelect',
  'income-now': 'income',
  'opportunity-playbook': 'op',
}

// Features that live only as sections inside the `focus` playbook. Reachable
// (via `focus`) ONLY when a lane is selected; otherwise prose-only (null).
const FOCUS_SECTION_SLUGS = new Set([
  'go-to-market', 'linkedin-remix', 'resume-refresh',
  'bridge-story', 'interview-prep', 'industry-background',
])

// Every step id the sanitizer can ever emit as a NAVIGATE target. The
// reachability invariant in scripts/check-prompt-refs.mjs asserts each of these
// has a real `case '<id>':` in rStep() (src/App.jsx), so a button can never be
// dead. If you add a routable feature, add its target here and keep that true.
export const BUTTON_TARGETS = ['p3', 'laneSelect', 'income', 'op', 'focus']

// Resolve a SELFCHECK slug to a reachable step id, or null for prose-only.
// `profileState` is the user's stored profile_state JSONB (has selectedLane).
export function resolveSelfcheckNavigate(slug, profileState) {
  if (!slug || typeof slug !== 'string') return null
  const s = slug.trim().toLowerCase()
  if (s === 'none') return null
  if (STANDALONE_TARGET[s]) return STANDALONE_TARGET[s]
  if (FOCUS_SECTION_SLUGS.has(s)) {
    const lane = profileState && typeof profileState === 'object' ? profileState.selectedLane : null
    return (typeof lane === 'string' && lane.trim()) ? 'focus' : null
  }
  return null // unknown slug (model drift) → no button, prose only
}

// Pull the SELFCHECK verdict off the end of the reply and strip it (plus any
// stray trailing NAVIGATE the model may still emit) from the visible text.
// Returns { feature: <slug|null>, text: <cleaned> }. `feature` is null when the
// self-check verdict is "none" or absent; a non-canonical slug is returned
// verbatim (so model drift is visible in logs) but resolves to no button.
const SELFCHECK_RE = /\n?[ \t>*_-]*SELFCHECK:\s*([^\n|]+?)\s*(?:\|[^\n]*)?\s*$/i
const TRAILING_NAV_RE = /\n?[ \t>*_-]*NAVIGATE:\s*[\w-]+\s*$/i

export function parseSelfcheck(text) {
  if (typeof text !== 'string' || !text) return { feature: null, text: text || '' }
  let out = text
  let feature = null
  // SELFCHECK and a stray NAVIGATE may appear in either order at the very end;
  // peel up to two trailing control lines.
  for (let i = 0; i < 2; i++) {
    const sc = out.match(SELFCHECK_RE)
    if (sc) {
      const raw = sc[1].trim().toLowerCase()
      feature = (raw && raw !== 'none') ? raw : null
      out = out.slice(0, sc.index).replace(/\s+$/, '')
      continue
    }
    const nv = out.match(TRAILING_NAV_RE)
    if (nv) { out = out.slice(0, nv.index).replace(/\s+$/, ''); continue }
    break
  }
  return { feature, text: out }
}
