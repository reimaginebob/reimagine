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
//
// Phase 3a (Output/handoff/2026-09-09_coach-concierge-phase-3-build-
// nextmove-stall.md) adds `next-move`, the first entry that is both
// `generated` AND actionable. Every entry above it is reflection-only: a
// generated entry gets no `quickReplies` of its own and no `onTap`,
// nothing to route to but the two dismissal taps. Next move breaks that --
// it needs the model's one line of "why this follows" AND a real "Build
// {label}" tap that starts a generation. `actionReply(ctx)` is the new,
// additive field that makes this possible: when present, `fireMoment`
// includes its `{label, value}` ahead of the two dismissal replies, and
// the moment tap handler's normal `entry.onTap(value, ctx)` dispatch
// handles the tap like any other (App.jsx passes `genSec` into that ctx
// for exactly this). `ctx.nextMoveTarget` (computed once in the evaluator,
// not re-derived per entry) is `{anchorLabel, nextId, nextLabel}` or
// `null` -- the most recently Delivery-reacted-to section for the current
// identity, and the next unbuilt one after it in Focus Playbook order
// (`focusOrderFor`). No `BUILD` trailer, no server-side validation against
// `situation.notBuilt`, no `SYSTEM_PROMPT_STABLE` change -- the target
// section is resolved deterministically client-side before the model is
// ever called, so the model never names it (Phase 3's own scope-reduction
// finding).
//
// Phase 3b adds `stall`, back to the static+actionable shape ptw-arrival
// already established (a fixed message, a real onTap) -- nothing new
// architecturally, unlike next-move. Its eligibility (`ctx.stallEligible`)
// comes from two new pieces of client state next to the evaluator itself:
// a per-identity visit counter and a 90-second idle timer, both computed
// once per pass and handed in on ctx rather than derived inside the entry.
export const MOMENT_CATALOG = [
  {
    key: 'ptw-arrival',
    family: 'arrival',
    screen: 'twoDoors',
    // Ordinary, not 'open' (batch item 1.1.7, 2026-09-10 -- corrected from
    // this entry's original Phase 1b framing): an Arrival is Coach speaking
    // on its own initiative, not reacting to something the person just did,
    // so while minimized it lands in chatMessages (feeding the header
    // pill's preview line) without popping the panel open. Reactive
    // families (Delivery, Choice) still do.
    significance: 'ordinary',
    dismissible: true,
    priority: 1,
    promptCode: 'ptw_arrival',
    eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!(ctx.outputs && ctx.outputs.p3),
    message: 'Are you working on any job opportunities right now, like an application you\'ve sent, someone who offered to refer you, or an interview coming up? If so, let\'s start with that one. If not, we\'ll look at the kinds of roles that fit you and build from there.',
    quickReplies: [
      { label: 'Yes, I have one', value: 'in_motion', followUp: 'Good. Add it on the next screen and I\'ll build your plan for that job. Taking you to Add an Opportunity.' },
      { label: 'Not yet', value: 'fresh', followUp: 'No problem. Let\'s look at the kinds of roles that fit you. Taking you to Career Paths.' },
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
    // Ordinary, not 'open' -- see ptw-arrival's comment above (batch item
    // 1.1.7, 2026-09-10).
    significance: 'ordinary',
    dismissible: true,
    priority: 1,
    promptCode: 'career_paths_arrival',
    eligible: (ctx) => !!ctx.hasOnboardingConcierge,
    message: 'Career Paths shows you three kinds of roles you could go after, each one built from a different part of your background. Pick the one you want to look at and I\'ll show you real job titles that fit it. From there we can build a plan for any of them.',
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
  {
    key: 'next-move',
    family: 'next_move',
    screen: 'focus',
    // Ordinary, not 'open' -- see ptw-arrival's comment above (batch item
    // 1.1.7, 2026-09-10). Next move is Coach offering an unprompted next
    // step, not reacting to something just done -- the same self-initiated
    // shape as Arrival and Stall.
    significance: 'ordinary',
    dismissible: true,
    // Below Delivery's 3 -- not that they ever compete in the same pass
    // (nextMoveTarget only exists once a delivery-* dedupe record already
    // does, which is a later evaluator pass than the one that wrote it),
    // but the ordering documents the intended precedence if that ever
    // changes.
    priority: 2,
    promptCode: 'next_move',
    generated: true,
    eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.nextMoveTarget,
    dedupeKey: (ctx) => `${ctx.selectedLane}::${ctx.chosen}`,
    // Re-fires when EITHER the anchor moves (they built another section,
    // so "why this follows" should reference the new one) or the offered
    // next section changes (they built the previously-offered one some
    // other way, e.g. the page's own Generate button, so Next move should
    // point at whatever is unbuilt now instead of repeating a stale offer).
    dedupeValue: (ctx) => `${ctx.nextMoveTarget.anchorLabel}::${ctx.nextMoveTarget.nextId}`,
    momentContext: (ctx) => ({ justBuiltLabel: ctx.nextMoveTarget.anchorLabel, nextLabel: ctx.nextMoveTarget.nextLabel }),
    actionReply: (ctx) => ({ label: `Build ${ctx.nextMoveTarget.nextLabel}`, value: `build_next:${ctx.nextMoveTarget.nextId}` }),
    onTap: (value, ctx) => {
      if (value.startsWith('build_next:')) ctx.genSec(value.slice('build_next:'.length))
      return true
    },
  },
  {
    key: 'stall',
    family: 'stall',
    screen: 'focus',
    // Ordinary, not 'open' -- see ptw-arrival's comment above (batch item
    // 1.1.7, 2026-09-10).
    significance: 'ordinary',
    dismissible: true,
    // Lowest priority on 'focus' -- an absence signal, so anything real
    // (Choice, Delivery, Next move) always wins a same-pass tie. In
    // practice they rarely compete: stallEligible requires nothing built at
    // all, which Delivery and Next move's own eligibility already rule out.
    priority: 1,
    promptCode: 'stall',
    // Static, not generated: the design calls this "one question, not a
    // nudge" -- a single line, not a judged read of specific content the
    // way Delivery and Next move need a model call for. stallEligible
    // itself (computed once in the evaluator from the 90s idle timer or 3
    // visits with nothing built) is the signal; the question does not need
    // to reference what's on the screen.
    eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.stallEligible,
    // Fire once per identity, ever -- matches choice-lane's shape (key, no
    // value). Nothing about a fresh visit some time later should be read as
    // new content worth reacting to again the way a Delivery rebuild is.
    dedupeKey: (ctx) => `${ctx.selectedLane}::${ctx.chosen}`,
    message: 'You\'ve come back to this a few times without building anything yet. What would make it worth doing right now — or would you rather look at something else?',
    quickReplies: [
      { label: 'Take me to Career Paths', value: 'stall-redirect' },
    ],
    onTap: (value, ctx) => {
      if (value === 'stall-redirect') ctx.advance('focus', 'laneSelect')
      return true
    },
  },
]
