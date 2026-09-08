// Coach-as-Concierge Phase 2a (Output/handoff/2026-09-08_coach-concierge-
// phase-2a-moments-core.md): the general catalog + evaluator the design
// (Section 5) asks for, sized to what this phase ships -- one entry, no
// model call. Phase 2b adds Choice/Delivery entries on Career Paths; those
// carry a `momentRequest` shape instead of a static `message` (server-side
// judged reaction, via computeTurnKind -- see the Phase 2 umbrella brief's
// "How Choice/Delivery reactions actually get triggered" section) and the
// evaluator gains one new branch to fire that request. Nothing about THIS
// entry or this file changes when that happens.
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
]
