// Maps a currentStep value (the App.jsx screen id, sent on every My Coach
// turn -- see NAV_LABELS in src/nav-labels.js for the render-true id list)
// to the subset of the user guide it needs, so api/coach.js can send that
// subset instead of the entire ~292K-character guide on every turn
// regardless of topic.
//
// Grounded in a 2026-09-06 research consult (context rot / "lost in the
// middle": a large, mostly-irrelevant prompt measurably degrades a model's
// reliability on the part that actually matters this turn, and topically
// related-but-not-quite-applicable content is a WORSE distractor than
// unrelated noise) plus a read of every guide chapter's actual content --
// this is not a guess from filenames.
//
// Three tiers, each answering a different question:
//
// 1. ALWAYS_ON_UNITS -- content whose relevance is uncorrelated with which
//    screen someone is on (a term they don't recognize, "did this save",
//    "what changed"), so it rides on every turn regardless of step. Kept
//    deliberately small. NOTE: an earlier draft of this map put
//    quick-start.md, what-reimagine-is.md, before-you-begin.md, and
//    quality-of-your-inputs.md here too -- wrong call, caught in review.
//    Those four are specifically ABOUT the orientation phase (see their own
//    opening lines), which is exactly what currentStep already signals when
//    someone is on one of the ORIENTATION_STEPS below; putting them in the
//    tier every user pays forever bought no precision and cost real size
//    (a 60% jump in the one number that matters most). They live in
//    CHAPTER_STEPS instead.
// 2. CHAPTER_STEPS -- whole guide chapters mapped to the step(s) they
//    document. Most of this is close to mechanical: roughly half the guide
//    was written chapter-by-chapter as documentation of one specific
//    screen, so the mapping is a fact about the content, not an editorial
//    judgment call (add-an-opportunity.md documents `op`, full stop).
// 3. FOCUS_PLAYBOOK_SECTION_STEPS -- focus-playbook.md is the one chapter
//    too large and too multi-topic to leave whole (55K, documents eleven
//    different Focus Playbook sections). scripts/lib/split-focus-playbook.mjs
//    splits it into named units at build time; this maps each unit to its
//    step(s), same as CHAPTER_STEPS but one level more granular.
//
// A currentStep with no explicit entry anywhere here, or one in
// FALLBACK_STEPS, gets the FULL, unnarrowed guide -- see resolveGuideBlock
// in api/coach.js. Failing open to everything is deliberate: a step that
// falls through the cracks should read as "not narrowed yet," never as
// "Coach silently knows less than it used to."
//
// Plain `.js` (no JSX, no `.mjs`): api/coach.js imports this across the
// api/* <-> src/* boundary, where `.mjs` is unsafe (CLAUDE.md section 8;
// the 2026-05-27 FUNCTION_INVOCATION_FAILED outage, PR #76, reverted at
// 940557b).

export const ALWAYS_ON_UNITS = [
  'faq-and-troubleshooting.md',
  'glossary.md',
  'whats-changed.md',
  'saving-your-work.md',
  'refining-and-regenerating.md',
  // focus-playbook.md's own closing mechanics (refining a section, what
  // happens when inputs change later, saving as PDF) apply to every
  // section alike, so they ride here instead of being duplicated onto each
  // of the eleven split units below.
  'focus-playbook:tail',
]

// The general chat surface, and anything else that's genuinely
// cross-topic by nature rather than tied to one part of the journey.
export const FALLBACK_STEPS = new Set([
  'myCoach',
  'complete',
  // Your Next Step (pilot) synthesizes a recommendation across the whole
  // journey rather than belonging to one part of it -- narrowing it would
  // be a guess, not a signal, so it gets the full guide like myCoach.
  'step',
])

// Pre-Personal-Brand onboarding. Shares one chapter set because the
// chapters here are about the orientation phase itself, not about any one
// of its screens -- see the note on quality-of-your-inputs.md above.
const ORIENTATION_STEPS = [
  'welcome', 'orientation-intro', 'location', 'resume', 'resume-builder',
  'linkedin', 'assessment', 'values', 'priorities', 'reputation', 'fit',
  'life-events', 'skills', 'orientation-done',
]

// The moment before any Focus Playbook section exists yet -- choosing a
// direction, or landing on the assembled (still-empty) playbook page.
const ROUTING_STEPS = ['twoDoors', 'laneSelect', 'p4', 'focus']

export const CHAPTER_STEPS = {
  'quick-start.md': ORIENTATION_STEPS,
  'what-reimagine-is.md': ORIENTATION_STEPS,
  'before-you-begin.md': ORIENTATION_STEPS,
  'quality-of-your-inputs.md': ORIENTATION_STEPS,
  'orientation.md': ORIENTATION_STEPS,
  // Go Independent track only ("if you signed up through the normal
  // career.club front door, this chapter does not describe what you are
  // seeing" -- its own opening line). `positioning` is that track's own
  // step id (NAV_LABELS: "Go Independent's equivalent of Put It to Work").
  // Unrelated to GO_INDEPENDENT_KNOWLEDGE/goIndependentBlock in
  // api/coach.js, which is the separate, already-gated business-of-
  // consulting content for that same track -- this is just the guide's own
  // explainer chapter about the track existing.
  'go-independent.md': ['positioning'],
  'put-it-to-work.md': ROUTING_STEPS,
  'career-paths.md': ROUTING_STEPS,
  'personal-brand.md': ['p3'],
  'star-stories.md': ['stories', 'p6'],
  'my-pipeline.md': ['pipeline'],
  'my-playbooks.md': ['mylib'],
  'add-an-opportunity.md': ['op', 'pipeline'],
  'job-search-resources.md': ['resources', 'p7'],
  'income-now.md': ['income'],
  'negotiating-an-offer.md': ['salaryRead'],
  'how-an-offer-is-put-together.md': ['salaryRead'],
  // my-coach.md and index.md have no entry here -- my-coach.md only ever
  // surfaces via the myCoach fallback (see FALLBACK_STEPS), and index.md is
  // the guide's own table of contents, meant for a human browsing chapter
  // by chapter, not grounding Coach needs on any step.
}

export const FOCUS_PLAYBOOK_SECTION_STEPS = {
  role: ['p5'],
  bridgeStory: ['p6'],
  industryBackground: ['p9'],
  compensationRead: ['salaryRead'],
  interviewPrep: ['p11'],
  resumeRefresh: ['p_res'],
  linkedinRemix: ['p8'],
  goToMarket: ['p7'],
  networkingGroups: ['groups'],
  recruiters: ['recruiters'],
  incomeNow: ['income'],
}

// focus-playbook.md's own front matter (what's on the page / the sections
// at a glance / the arc has a logic) -- shown once, at the moment someone
// is about to open their first section, not repeated per section.
export const FOCUS_PLAYBOOK_PREAMBLE_STEPS = ROUTING_STEPS
