// Coach-as-Concierge Phase 2a (Output/handoff/2026-09-08_coach-concierge-
// phase-2a-moments-core.md): the general catalog + evaluator the design
// (Section 5) asks for, sized to what that phase shipped -- one entry, no
// model call.
//
// Phase 2b (Output/handoff/2026-09-08_coach-concierge-phase-2b-career-
// paths.md) adds Choice and Delivery entries on Career Paths. These are
// `generated: true` instead of carrying a static `message`: the evaluator
// fires them through `fireMoment` (src/App.jsx), which POSTs a silent turn
// to /api/coach with `moment: {key, ...momentContext(ctx)}` and pushes
// whatever plain-text reply comes back -- the same shape the existing
// `fireOrientationCheck` mechanism already uses, not a new one. A generated
// entry has no `quickReplies` of its own (the two dismissal taps are the
// only ones it ever gets) and no `onTap` (there is nothing to route to --
// the reaction is the whole point).
//
// `priority` breaks ties when more than one entry is eligible on the same
// screen in the same evaluator pass (e.g. arriving at 'focus' right after a
// role pick can make Choice and a Delivery entry briefly true within
// moments of each other) -- higher fires first. Per the design: Delivery >
// Choice > Arrival.
//
// `dedupeKey(ctx)` and `dedupeValue(ctx)` generalize `coachMoments` beyond
// ptw-arrival's plain "fired once, ever" shape. Both default (when a entry
// doesn't define them) to ptw-arrival's original behavior: one dedupe slot
// per catalog row (`dedupeKey`), compared against the constant 'fired'
// (`dedupeValue`) -- so a boolean once-fired entry needs neither. Choice
// needs a key but not a value (fire once per role/lane identity, never
// again for that identity); Delivery needs both (fire once per identity
// per build, and RE-fire when the content changes -- a rebuild is new
// content worth reacting to, same as Brand richness's own precedent).
//
// Existing seen* flags (onboarding framing, per-step narration, brand
// delivery) are untouched here -- folding those into this catalog is
// Phase 4's job, not this one's.
export const MOMENT_CATALOG = [
  {
    key: 'ptw-arrival',
    family: 'arrival',
    screen: 'twoDoors',
    // Opens the panel from minimized (Phase 1b's coachPresence) -- this is
    // the first thing Coach says on a hub screen, not routine narration.
    significance: 'open',
    dismissible: true,
    priority: 1,
    promptCode: 'ptw_arrival',
    eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!(ctx.outputs && ctx.outputs.p3),
    message: 'Is anything already moving — an application in, a referral, an interview on the calendar? If so, let\'s work that first. If not, we\'ll pick a direction and build from your brand.',
    quickReplies: [
      { label: 'Something\'s moving', value: 'in_motion', followUp: 'Good — let\'s build a playbook around it. Taking you to Add an Opportunity.' },
      { label: 'Starting from scratch', value: 'fresh', followUp: 'Good — let\'s find your direction. Taking you to Career Paths.' },
    ],
    // ctx here is the same shape the evaluator builds -- only what App.jsx
    // functions this entry needs to call. Returning true tells the generic
    // handler the tap resolved (same true/false contract every other
    // handleEmploymentQuickReply branch already follows).
    onTap: (value, ctx) => {
      if (value === 'in_motion') { ctx.markDone('twoDoors'); ctx.addNewOpportunity() }
      else if (value === 'fresh') { ctx.advance('twoDoors', 'laneSelect') }
      return true
    },
  },
  {
    key: 'career-paths-arrival',
    family: 'arrival',
    screen: 'laneSelect',
    significance: 'open',
    dismissible: true,
    priority: 1,
    promptCode: 'career_paths_arrival',
    eligible: (ctx) => !!ctx.hasOnboardingConcierge,
    message: 'This is where we look at directions beyond the one you already have in hand — three lanes, each reading your background a different way. Pick one and I\'ll show you real role options that fit it.',
    quickReplies: [],
  },
  {
    key: 'choice-lane',
    family: 'choice',
    screen: 'p4',
    significance: 'open',
    dismissible: true,
    priority: 2,
    promptCode: 'choice_lane',
    generated: true,
    eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.selectedLane,
    dedupeKey: (ctx) => ctx.selectedLane,
    momentContext: (ctx) => ({ lane: ctx.selectedLane, laneLabel: ctx.laneLabelFor(ctx.selectedLane) }),
  },
  {
    key: 'choice-role',
    family: 'choice',
    screen: 'focus',
    significance: 'open',
    dismissible: true,
    priority: 2,
    promptCode: 'choice_role',
    generated: true,
    eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.chosen && !!ctx.selectedLane,
    dedupeKey: (ctx) => `${ctx.selectedLane}::${ctx.chosen}`,
    momentContext: (ctx) => ({ roleTitle: ctx.chosen, laneLabel: ctx.laneLabelFor(ctx.selectedLane) }),
  },
  {
    key: 'delivery-p5',
    family: 'delivery',
    screen: 'focus',
    significance: 'open',
    dismissible: true,
    priority: 3,
    promptCode: 'delivery_p5',
    generated: true,
    eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!(ctx.outputs && ctx.outputs.p5) && !!ctx.chosen,
    dedupeKey: (ctx) => `${ctx.selectedLane}::${ctx.chosen}`,
    dedupeValue: (ctx) => ctx.outputs.p5,
    momentContext: (ctx) => ({ section: 'p5', sectionLabel: ctx.focusLabelFor('p5', ctx.isIndependent), text: ctx.outputs.p5 }),
  },
  {
    key: 'delivery-p6',
    family: 'delivery',
    screen: 'focus',
    significance: 'open',
    dismissible: true,
    priority: 3,
    promptCode: 'delivery_p6',
    generated: true,
    eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!(ctx.outputs && ctx.outputs.p6) && !!ctx.chosen,
    dedupeKey: (ctx) => `${ctx.selectedLane}::${ctx.chosen}`,
    // outputs.p6 is not reliably a string -- it can be a pre- or post-2026-
    // 05-31 wrapped object (bridgeStoryToProse's own header comment). Both
    // the dedupe comparison and what the model sees must go through the
    // same normalizer the render path already uses, or an object-shaped
    // p6 silently fails momentPayloadOk's string check server-side (no
    // reaction ever fires) and/or compares unequal by reference on every
    // reload (re-firing every session for affected accounts).
    dedupeValue: (ctx) => ctx.bridgeStoryToProse(ctx.outputs.p6),
    momentContext: (ctx) => ({ section: 'p6', sectionLabel: ctx.focusLabelFor('p6', ctx.isIndependent), text: ctx.bridgeStoryToProse(ctx.outputs.p6) }),
  },
  {
    key: 'delivery-p9',
    family: 'delivery',
    screen: 'focus',
    significance: 'open',
    dismissible: true,
    priority: 3,
    promptCode: 'delivery_p9',
    generated: true,
    eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!(ctx.outputs && ctx.outputs.p9) && !!ctx.chosen,
    dedupeKey: (ctx) => `${ctx.selectedLane}::${ctx.chosen}`,
    dedupeValue: (ctx) => ctx.outputs.p9,
    momentContext: (ctx) => ({ section: 'p9', sectionLabel: ctx.focusLabelFor('p9', ctx.isIndependent), text: ctx.outputs.p9 }),
  },
  {
    key: 'delivery-salaryRead',
    family: 'delivery',
    screen: 'focus',
    significance: 'open',
    dismissible: true,
    priority: 3,
    // Reads as delivery_comp_read, not the awkward delivery_salaryread --
    // matches the screen's user-facing name (Compensation Read), the one
    // deliberate exception to this catalog's otherwise-uniform
    // delivery_<internal-key> promptCode naming. Confirmed with Bob.
    promptCode: 'delivery_comp_read',
    generated: true,
    eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!(ctx.outputs && ctx.outputs.salaryRead) && !!ctx.chosen,
    dedupeKey: (ctx) => `${ctx.selectedLane}::${ctx.chosen}`,
    dedupeValue: (ctx) => ctx.outputs.salaryRead,
    momentContext: (ctx) => ({ section: 'salaryRead', sectionLabel: ctx.focusLabelFor('salaryRead', ctx.isIndependent), text: ctx.outputs.salaryRead }),
  },
  {
    key: 'delivery-p11',
    family: 'delivery',
    screen: 'focus',
    significance: 'open',
    dismissible: true,
    priority: 3,
    promptCode: 'delivery_p11',
    generated: true,
    eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!(ctx.outputs && ctx.outputs.p11) && !!ctx.chosen,
    dedupeKey: (ctx) => `${ctx.selectedLane}::${ctx.chosen}`,
    dedupeValue: (ctx) => ctx.outputs.p11,
    momentContext: (ctx) => ({ section: 'p11', sectionLabel: ctx.focusLabelFor('p11', ctx.isIndependent), text: ctx.outputs.p11 }),
  },
  {
    key: 'delivery-p_res',
    family: 'delivery',
    screen: 'focus',
    significance: 'open',
    dismissible: true,
    priority: 3,
    promptCode: 'delivery_p_res',
    generated: true,
    eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!(ctx.outputs && ctx.outputs.p_res) && !!ctx.chosen,
    dedupeKey: (ctx) => `${ctx.selectedLane}::${ctx.chosen}`,
    dedupeValue: (ctx) => ctx.outputs.p_res,
    momentContext: (ctx) => ({ section: 'p_res', sectionLabel: ctx.focusLabelFor('p_res', ctx.isIndependent), text: ctx.outputs.p_res }),
  },
  {
    key: 'delivery-p8',
    family: 'delivery',
    screen: 'focus',
    significance: 'open',
    dismissible: true,
    priority: 3,
    promptCode: 'delivery_p8',
    generated: true,
    eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!(ctx.outputs && ctx.outputs.p8) && !!ctx.chosen,
    dedupeKey: (ctx) => `${ctx.selectedLane}::${ctx.chosen}`,
    dedupeValue: (ctx) => ctx.outputs.p8,
    momentContext: (ctx) => ({ section: 'p8', sectionLabel: ctx.focusLabelFor('p8', ctx.isIndependent), text: ctx.outputs.p8 }),
  },
  {
    key: 'delivery-p7',
    family: 'delivery',
    screen: 'focus',
    significance: 'open',
    dismissible: true,
    priority: 3,
    promptCode: 'delivery_p7',
    generated: true,
    eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!(ctx.outputs && ctx.outputs.p7) && !!ctx.chosen,
    dedupeKey: (ctx) => `${ctx.selectedLane}::${ctx.chosen}`,
    dedupeValue: (ctx) => ctx.outputs.p7,
    momentContext: (ctx) => ({ section: 'p7', sectionLabel: ctx.focusLabelFor('p7', ctx.isIndependent), text: ctx.outputs.p7 }),
  },
  {
    key: 'delivery-income',
    family: 'delivery',
    screen: 'focus',
    significance: 'open',
    dismissible: true,
    priority: 3,
    promptCode: 'delivery_income',
    generated: true,
    eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!(ctx.outputs && ctx.outputs.income) && !!ctx.chosen,
    dedupeKey: (ctx) => `${ctx.selectedLane}::${ctx.chosen}`,
    dedupeValue: (ctx) => ctx.outputs.income,
    momentContext: (ctx) => ({ section: 'income', sectionLabel: ctx.focusLabelFor('income', ctx.isIndependent), text: ctx.outputs.income }),
  },
]
