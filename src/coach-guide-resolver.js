// Step-aware guide slice (2026-09-06). USER_GUIDE_CONTENT alone is ~292K
// characters sent whole on every My Coach turn regardless of topic --
// roughly half of the ~600K-character prompt this session's own live
// testing (scripts/eval-interview-capture-live.mjs) traced a real
// capture-note compliance gap to. Grounded in a research consult on context
// rot: a large, mostly-irrelevant prompt measurably degrades a model's
// reliability on the part that actually matters this turn, and a
// topically-related-but-not-quite-applicable chunk is a WORSE distractor
// than unrelated noise (Chroma's context-rot study). currentStep is real,
// already-available signal -- narrowing by it is the low-risk, no-new-
// infrastructure version of retrieval, not a guess.
//
// Three tiers, in src/data/guide-step-relevance.js: content that's on every
// turn regardless of step (ALWAYS_ON_UNITS), whole chapters mapped to the
// step(s) they document (CHAPTER_STEPS), and focus-playbook.md's own split
// sections (FOCUS_PLAYBOOK_SECTION_STEPS / FOCUS_PLAYBOOK_PREAMBLE_STEPS --
// see scripts/lib/split-focus-playbook.mjs). A currentStep this doesn't
// recognize -- FALLBACK_STEPS, or simply nothing matched -- fails OPEN to
// the full, unnarrowed guide rather than sending nothing: a step falling
// through the cracks should read as "not narrowed yet," never as "Coach
// silently knows less than it used to."
//
// The book (MYOW_CONTENT) is NOT narrowed by this -- deliberately deferred.
// Its lessons don't correspond to one screen each the way half the guide's
// chapters do, so tagging it is an editorial call, not a fact about the
// content; it goes through the same discipline once this mechanism is
// proven on the guide.
//
// Pulled into its own module, separate from api/coach.js, so it can be
// imported directly in tests: api/coach.js constructs a Postgres client and
// a Resend client eagerly at module load, which needs dummy env vars even
// just to import it (see scripts/eval-interview-capture-live.mjs); this
// module has no such side effect and no such dependency.
//
// Plain `.js` (no JSX, no `.mjs`): api/coach.js imports this across the
// api/* <-> src/* boundary, where `.mjs` is unsafe (CLAUDE.md section 8;
// the 2026-05-27 FUNCTION_INVOCATION_FAILED outage, PR #76, reverted at
// 940557b).
import { USER_GUIDE_CONTENT, USER_GUIDE_UNITS } from './data/user-guide-content.js'
import { ALWAYS_ON_UNITS, FALLBACK_STEPS, CHAPTER_STEPS, FOCUS_PLAYBOOK_SECTION_STEPS, FOCUS_PLAYBOOK_PREAMBLE_STEPS } from './data/guide-step-relevance.js'

export function resolveGuideBlock(currentStep) {
  if (!currentStep || FALLBACK_STEPS.has(currentStep)) return USER_GUIDE_CONTENT
  const specific = []
  for (const [file, steps] of Object.entries(CHAPTER_STEPS)) {
    if (steps.includes(currentStep)) specific.push(USER_GUIDE_UNITS[file])
  }
  if (FOCUS_PLAYBOOK_PREAMBLE_STEPS.includes(currentStep)) specific.push(USER_GUIDE_UNITS['focus-playbook:preamble'])
  for (const [unit, steps] of Object.entries(FOCUS_PLAYBOOK_SECTION_STEPS)) {
    if (steps.includes(currentStep)) specific.push(USER_GUIDE_UNITS[`focus-playbook:${unit}`])
  }
  // The fail-open check has to be about STEP-SPECIFIC content, not the
  // unconditional always-on tier below -- ALWAYS_ON_UNITS is never empty,
  // so checking "did anything match" against the combined list would never
  // actually fire this branch: an unmapped step would silently get only
  // the always-on utility chapters instead of the full guide, which is
  // exactly the silent information loss failing open exists to prevent.
  if (!specific.filter(Boolean).length) return USER_GUIDE_CONTENT
  const always = ALWAYS_ON_UNITS.map(key => USER_GUIDE_UNITS[key])
  return [...always, ...specific].filter(Boolean).join('\n\n---\n\n')
}
