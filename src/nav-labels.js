// SINGLE SOURCE OF TRUTH for the app's user-facing navigation labels.
//
// The sidebar ("Your work" primaryItems) and the Focus Playbook section list
// (FOCUS_ORDER) in src/App.jsx both render their labels from this map, and
// scripts/lib/render-coach-nav-map.mjs reads it to build the coach's navigation
// map. Because render and the coach prompt both flow from here, a rename lands
// in the UI and the coach together and cannot desync — that is the whole point.
//
// Plain `.js` (no JSX) on purpose: the Node generator AND the api/* serverless
// bundler can both import it (the `.mjs`-across-api/src boundary is unsafe — the
// 2026-05-27 FUNCTION_INVOCATION_FAILED outage).
//
// AUTHORITY NOTE: these strings are the labels that actually render today. The
// `META` map in src/App.jsx is a STALE parallel ("Pick a Direction",
// "Upload a Live Opportunity") and is NOT authoritative; retiring/deriving META
// from this module is a separate cleanup.
export const NAV_LABELS = {
  // Standalone destinations — sidebar "Your work" (src/App.jsx primaryItems).
  myCoach: 'My Coach',
  mylib: 'My Playbooks',
  p3: 'Personal Brand',
  twoDoors: 'Put It to Work',
  laneSelect: 'Career Paths',      // the "Role Options" exploration door
  op: 'Add an Opportunity',
  income: 'Income Now',
  // Focus Playbook sections (src/App.jsx FOCUS_ORDER).
  p5: 'The Role',
  p6: 'Your Bridge Story',
  p7: 'Go-to-Market',
  p8: 'LinkedIn Remix',
  p_res: 'Resume Refresh',
  p11: 'Interview Prep',
  // p9's user-facing name is the SINGLE place to change it (renames the Focus
  // Playbook section header AND what the coach calls it, together). Bob to
  // confirm "Industry Background" vs "The Lingo".
  p9: 'Industry Background',
}
