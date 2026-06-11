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
// AUTHORITY NOTE: these strings are the labels that actually render today, and
// they are now the ONLY label source. The old parallel `META` map in src/App.jsx
// was retired 2026-06-11 — its labels (including the stale "Pick a Direction" /
// "Upload a Live Opportunity") were absorbed here, corrected to the live values.
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
  // Orientation + structural step labels. Moved here from the old META map in
  // src/App.jsx (2026-06-11) so there is one render-true label source — the
  // orientation sidebar and the section-name lookup now read these. These
  // values are byte-identical to what META rendered; the only correction is
  // that laneSelect/op above are the live "Career Paths"/"Add an Opportunity"
  // (META still carried the stale "Pick a Direction"/"Upload a Live Opportunity").
  welcome: 'Welcome',
  location: 'Location & Work',
  resume: 'Your Resume',
  linkedin: 'Your LinkedIn',
  assessment: 'Assessments',
  values: 'Values, Passions & Causes',
  reputation: 'Reputation',
  'life-events': 'Your Story',
  skills: 'Your Skills',
  'orientation-done': 'Orientation Complete',
  p1: 'Resume Analysis',
  p2: 'Wiring & Compass',
  p4: 'Role Options',
  focus: 'Focus Playbook',
  complete: 'Complete',
}

// SINGLE SOURCE OF TRUTH for the career-lane labels, keyed on the value the app
// actually stores in `selectedLane` (the LANE_CARDS ids in src/App.jsx, plus
// 'specific' for the Door-2 / opportunity path). The sidebar/Focus surfaces in
// App.jsx and the My Coach profile slice (api/coach.js) both read this, so the
// name the Coach speaks ("Familiar Ground") is exactly what the UI renders.
//
// Keyed on selectedLane on purpose: the older Coach map was mis-keyed FG/II/WTM
// and never matched the stored familiar/insider/wtm values, so the Coach echoed
// the raw lane ("familiar"). The Opportunity surface stores a different variable
// (opLaneValue, FG/II/WTM) and normalizes onto these keys before reading here.
export const LANE_LABELS = {
  familiar: 'Familiar Ground',
  insider: 'Industry Insider',
  wtm: 'Work That Matters',
  specific: 'Specific Role',
}
