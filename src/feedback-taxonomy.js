// Shared taxonomy for the feedback dashboard. Single source of truth for the
// surface, concern, and sentiment code sets, consumed by both the server
// (api/admin/ingest-feedback.js classifier + api/admin/feedback-dashboard.js
// aggregates) and the client (src/FeedbackDashboard.jsx labels/filters).
//
// Lives in src/ and is imported into api/ with a `.js` cross-directory path,
// which the Vercel bundler traces reliably (per CLAUDE.md §8; .mjs across the
// api/<->src/ boundary is the failure mode, not .js).

// The 14 product surfaces a piece of feedback can be about.
export const SURFACE_CODES = [
  'onboarding',
  'personal-brand',
  'career-paths',
  'opportunity-playbook',
  'bridge-story',
  'resume-refresh',
  'linkedin-remix',
  'interview-prep',
  'go-to-market',
  'income-now',
  'my-playbooks',
  'navigation-ia',
  'account-auth',
  'my-coach',
]

// The concern themes a text-bearing event can be tagged with. When nothing here
// fits, the classifier emits candidate:<label> instead (handled by normalizeThemes).
export const CONCERN_CODES = [
  'prose-quality',
  'accuracy-relevance',
  'usefulness-value',
  'usability-ux',
  'performance-reliability',
  'trust-confidence',
  'pricing-access',
  'feature-request',
  'general-praise',
]

export const SENTIMENT_CODES = ['positive', 'negative', 'neutral', 'mixed']

// The Neon feedback channels, in display order.
export const SOURCE_CODES = ['share-feedback', 'nps-survey', 'coach-reply', 'pb-checkin']

export const SOURCE_LABELS = {
  'share-feedback': 'Share Feedback',
  'nps-survey': 'NPS Survey',
  'coach-reply': 'My Coach Thumbs',
  'pb-checkin': 'Personal Brand check-in',
}

// Human-readable labels for display in the dashboard.
export const SURFACE_LABELS = {
  'onboarding': 'Onboarding',
  'personal-brand': 'Personal Brand',
  'career-paths': 'Career Paths',
  'opportunity-playbook': 'Opportunity Playbook',
  'bridge-story': 'Bridge Story',
  'resume-refresh': 'Resume Refresh',
  'linkedin-remix': 'LinkedIn Remix',
  'interview-prep': 'Interview Prep',
  'go-to-market': 'Go-to-Market',
  'income-now': 'Income Now',
  'my-playbooks': 'My Playbooks',
  'navigation-ia': 'Navigation / IA',
  'account-auth': 'Account & Auth',
  'my-coach': 'My Coach',
}

export const CONCERN_LABELS = {
  'prose-quality': 'Prose Quality',
  'accuracy-relevance': 'Accuracy / Relevance',
  'usefulness-value': 'Usefulness / Value',
  'usability-ux': 'Usability / UX',
  'performance-reliability': 'Performance / Reliability',
  'trust-confidence': 'Trust / Confidence',
  'pricing-access': 'Pricing / Access',
  'feature-request': 'Feature Request',
  'general-praise': 'General Praise',
}

// Maps the NPS survey's "most valuable" choices onto surface codes. Only the
// choices that name a single surface are mapped; "It all came together" and any
// unrecognized value resolve to null (no surface).
export const VALUABLE_TO_SURFACE = {
  'Personal Brand': 'personal-brand',
  'Choosing a direction': 'career-paths',
  'Role Options': 'career-paths',
  'Bridge Story': 'bridge-story',
  'Interview Prep': 'interview-prep',
  'LinkedIn Remix': 'linkedin-remix',
  'Resume Refresh': 'resume-refresh',
  'Go-to-Market': 'go-to-market',
}

// Maps the app's raw step ids (what general_feedback.surface stores — the value
// of `step` / NAV_LABELS keys in src/App.jsx) onto the surface taxonomy codes,
// so a share-feedback event lands in the same surface vocabulary as the NPS
// channel instead of a raw step like 'mylib'. Orientation steps collapse to
// 'onboarding'; structural hubs (Put It to Work, Focus Playbook, Complete) to
// 'navigation-ia'. Steps with no clean code (e.g. p9 Industry Background, which
// the surface taxonomy does not carry) are intentionally absent -> stepToSurface
// returns null, and the event's surface is left null rather than a raw step.
export const STEP_TO_SURFACE = {
  // Orientation / sign-in entry
  welcome: 'onboarding',
  location: 'onboarding',
  resume: 'onboarding',
  'resume-builder': 'onboarding',
  linkedin: 'onboarding',
  assessment: 'onboarding',
  values: 'onboarding',
  reputation: 'onboarding',
  'life-events': 'onboarding',
  skills: 'onboarding',
  'orientation-done': 'onboarding',
  // Personal Brand (p1 Resume Analysis / p2 Wiring & Compass feed p3)
  p1: 'personal-brand',
  p2: 'personal-brand',
  p3: 'personal-brand',
  // Career paths / role options
  laneSelect: 'career-paths',
  p4: 'career-paths',
  p5: 'career-paths',
  // Focus Playbook content sections
  p6: 'bridge-story',
  p7: 'go-to-market',
  p8: 'linkedin-remix',
  p_res: 'resume-refresh',
  p10: 'interview-prep',
  p11: 'interview-prep',
  // Opportunity
  op: 'opportunity-playbook',
  // Income, library, coach
  income: 'income-now',
  mylib: 'my-playbooks',
  myCoach: 'my-coach',
  // Structural / navigation hubs
  twoDoors: 'navigation-ia',
  focus: 'navigation-ia',
  complete: 'navigation-ia',
  // Deliberately unmapped (no fitting surface code): p9 (Industry Background).
}

// Normalize a raw app step id to a surface taxonomy code, or null when no code
// fits (the caller stores null rather than a raw step). Pass-through for values
// that are already taxonomy codes, so it is safe to call on any surface value.
export function stepToSurface(step) {
  if (!step || typeof step !== 'string') return null
  if (SURFACE_CODES.includes(step)) return step
  return STEP_TO_SURFACE[step] || null
}

// A theme is valid if it is a known concern code or a candidate:<label> escape.
export function isValidTheme(t) {
  return typeof t === 'string' && (CONCERN_CODES.includes(t) || /^candidate:.+/.test(t))
}

// Keep only valid theme strings; lowercase + trim candidate labels; dedupe.
export function normalizeThemes(arr) {
  if (!Array.isArray(arr)) return []
  const out = []
  for (let t of arr) {
    if (typeof t !== 'string') continue
    t = t.trim()
    if (CONCERN_CODES.includes(t)) { if (!out.includes(t)) out.push(t); continue }
    const m = /^candidate:\s*(.+)$/i.exec(t)
    if (m) {
      const code = 'candidate:' + m[1].trim().toLowerCase().replace(/\s+/g, '-').slice(0, 40)
      if (code.length > 'candidate:'.length && !out.includes(code)) out.push(code)
    }
  }
  return out
}

// Derive sentiment for a text-less event from its native metric.
//   thumb:   +1 -> positive, -1 -> negative
//   nps:     >=9 positive, <=6 negative, else neutral
//   checkin: +1 (Yes) positive, -1 (Not quite) negative, 0 (Mostly) neutral
export function sentimentFromNative(nativeType, nativeValue) {
  const v = Number(nativeValue)
  if (nativeType === 'thumb') return v > 0 ? 'positive' : v < 0 ? 'negative' : 'neutral'
  if (nativeType === 'nps') return v >= 9 ? 'positive' : v <= 6 ? 'negative' : 'neutral'
  if (nativeType === 'checkin') return v > 0 ? 'positive' : v < 0 ? 'negative' : 'neutral'
  return 'neutral'
}

// Maps a check-in tap answer to its native numeric value (used by the ingest and
// to label the dashboard's check-in metric).
export const CHECKIN_ANSWER_VALUE = { yes: 1, mostly: 0, not_quite: -1 }
