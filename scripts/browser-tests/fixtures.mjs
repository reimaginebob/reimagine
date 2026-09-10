// Fixture data for the browser tests in scripts/test-browser-situation-tracking.mjs.
// Shaped by reading normalizeProfileState, buildDoor1Record/buildDoor2Record,
// and the Focus/Opportunity Playbook render paths directly (src/App.jsx) --
// see that test file's header for the exact citations. Two records: a door1
// (Focus Playbook) direction with Compensation Read and Networking Groups
// left unbuilt and Interview Prep/Recruiters built, and a door2 (Opportunity
// Playbook) record with one short/unbuilt card followed by one long/built
// one -- the same short-then-long shape Bob's production report reproduced
// the bug with, on both surfaces.

import { PRIVACY_VERSION_MATERIAL, TOS_VERSION_MATERIAL } from '../../src/config/legal.js'

export const CHOSEN = 'VP Operations, Supply Chain'
export const SELECTED_LANE = 'familiar'

// 5 paragraphs: long enough to read as genuinely built content (and to
// need real scrolling past it), short enough that scenario 5's wheel
// gesture covers the real distance to the next section in a handful of
// ticks rather than several thousand pixels of runway.
const LONG_P5 = Array.from({ length: 5 }, (_, i) =>
  `Paragraph ${i + 1}. This role asks for someone who has run distribution networks end to end, negotiated with carriers under real cost pressure, and can translate a spreadsheet into a decision a VP will actually make. Your background maps onto that directly: you have owned the number, not just reported on it, and the people who worked for you say you make the complicated parts of the job look ordinary.`
).join('\n\n')

// role_context/questions shape (parseInterviewPrepJSON, no interview team).
// 12 questions, mixed behavioral/non_behavioral, long STAR text throughout so
// the rendered section is genuinely tall -- this is the section Bob's report
// named directly ("Interview Prep built and long").
const P11_QUESTIONS = Array.from({ length: 12 }, (_, i) => {
  const n = i + 1
  const behavioral = i % 3 !== 0
  const base = {
    id: `q${n}`,
    question: `Question ${n}: tell me about a time you had to make a hard call on ${behavioral ? 'a supply chain tradeoff' : 'your own approach to leading a team'} with incomplete information.`,
    type: behavioral ? 'behavioral' : 'non_behavioral',
    framework_thread: null,
  }
  if (behavioral) {
    return {
      ...base,
      star_breakdown: {
        S: { raw_material: `The situation for question ${n}, described in enough detail to be concrete: a real constraint, a real deadline, a real stake for the business.`, relevance_bridge_draft: `Why this situation maps onto the target role directly, in plain language.`, to_strengthen: `A note on what would make this answer land harder in the room.` },
        T: { raw_material: `The specific task that fell to you, not the team in general.`, to_strengthen: `Where to sharpen the ownership language.` },
        A: { raw_material: `The concrete actions taken, in sequence, with the reasoning behind each one spelled out rather than summarized.`, to_strengthen: `Where a shorter version would land better.` },
        R: { raw_material: `The measurable result, with the number attached and what it meant for the business.`, to_strengthen: `Whether a second, smaller result is worth adding.` },
      },
    }
  }
  return { ...base, framing_recommendation: `Answer this one by naming the operating principle first, then the one story that proves you actually live by it, then stop -- do not stack a second story on top of the first.` }
})
export const P11_JSON = JSON.stringify({ role_context: { target_role: CHOSEN }, questions: P11_QUESTIONS })

export const DOOR1_RECORD = {
  id: 'test-door1-001',
  title: CHOSEN,
  lane: SELECTED_LANE,
  source: 'door1',
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
  outputs: {
    // NOT built here deliberately. done.includes('p3') is also what a
    // separate, one-shot landing effect (App.jsx ~9868) reads to redirect
    // a fresh page load straight to My Pipeline/My Playbooks -- a real
    // returning explorer never lands ON a Focus/Opportunity Playbook
    // directly, they land on their library and click into one. Setting it
    // here would fight that redirect on every scenario in this suite, not
    // just the one that wants the sticky breadcrumb header. Scenario 5
    // (the observer fallback) exercises the reading-line pick with the
    // sticky stack legitimately measuring zero -- a state most first-time
    // and mid-flow users are actually in -- rather than driving the extra
    // pipeline/library navigation a returning-explorer session would need
    // first; the sticky-height branch of that same pick logic is covered
    // by source-presence assertion in test-situation-state-projection.mjs.
    p5: LONG_P5,
    p6: '', // left unbuilt deliberately -- a built p6 as a plain string triggers
            // the p6_legacy migration-banner path in normalizeProfileState
    p7: '', // left unbuilt: a built p7 risks parseCompanies matching a stray
            // bold line and firing network sweeps this test does not mock
    p8: '',
    p9: '', // UNBUILT -- the wheel-scroll fallback target (scenario 5)
    p_res: '',
    salaryRead: '', // UNBUILT -- scenario 1's target (Compensation Read)
    p11: P11_JSON, // BUILT and long -- scenario 1's "next to it" section
    income: '',
  },
  done: ['p5', 'p11'],
  feedback: { p5: '', p6: '', p7: '', p8: '', p9: '', p_res: '', salaryRead: '', p11: '', income: '' },
  upstream: { p3: '' },
  schemaVersion: 1,
  // Top-level field, not part of outputs -- see playbook-sections.js's own
  // comment on why door1/door2 share section keys but not storage shape.
  // BUILT -- scenario 2's target (Recruiters for This Path).
  recruiters: {
    signature: 'test-signature',
    criteria: { function: 'Supply Chain', industry: 'Manufacturing', seniority: 'VP', geo: 'United States' },
    matches: [
      { firm: 'Test Recruiting Partners', kind: 'boutique', specialty: 'Supply chain executive search', url: 'https://example.com/recruiter-1', leaderName: 'Jordan Ellis', leaderTitle: 'Managing Partner' },
      { firm: 'Sample Search Group', kind: 'practice', specialty: 'Operations leadership placements', url: 'https://example.com/recruiter-2', leaderName: 'Morgan Reyes', leaderTitle: 'Principal' },
    ],
    notes: '',
    builtAt: '2026-09-01T12:00:00.000Z',
    outreachTemplate: '',
  },
}
// Networking Groups (scenario 2's "unbuilt" half) needs no fixture at all --
// pathGroupsFor reads a localStorage-backed store, never the record itself,
// so a fresh browser context already renders it unbuilt by default.

export const DOOR2_TITLE = 'Director of Logistics, Meridian Freight'
export const DOOR2_RECORD = {
  id: 'test-door2-001',
  title: DOOR2_TITLE,
  company: 'Meridian Freight',
  role: 'Director of Logistics',
  location: 'Remote',
  lane: 'specific',
  source: 'door2',
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
  outputs: { op: '' },
  done: [],
  feedback: { op: '', p5: '', p6: '', p_res: '', p11: '', companyRead: '' },
  upstream: { p3: '' },
  jd: 'Director of Logistics role at Meridian Freight, overseeing regional distribution.',
  schemaVersion: 2,
  opLane: null,
  sections: {
    // SHORT/unbuilt -- clicked first in the op test case.
    companyRead: { content: '', builtAt: null },
    // LONG/built -- the "next to it" card, matching Bob's short-then-long
    // reproduction shape on the Focus Playbook side too.
    p5: { content: LONG_P5, builtAt: '2026-09-01T12:00:00.000Z' },
    p6: '',
    p_res: { content: '', builtAt: null },
    p_cover: { content: '', builtAt: null },
    p11: { content: '', builtAt: null },
  },
  panel: { interviewers: [], opportunity_context: '' },
  savedNotes: [],
  offerStage: { offer: null, updatedAt: null },
}

// The auto-resolve effect (App.jsx ~9901) that wires up currentSavedSlotIdRef
// requires an EXACT match: record.title===chosen (and record.lane===
// selectedLane for door1, or record.source==='door2' for door2). Both
// records ride in savedPlaybooks either way -- the app just uses whichever
// one chosen/selectedLane/step point it at, matching the real app's own
// "many saved directions, one open at a time" shape.
export function buildProfileLoadResponse({ step = 'focus', coachMoments } = {}) {
  const forOp = step === 'op'
  return {
    updatedAt: '2026-09-01T12:00:00.000Z',
    profile: {
      step,
      chosen: forOp ? DOOR2_TITLE : CHOSEN,
      selectedLane: forOp ? 'specific' : SELECTED_LANE,
      exploredRoleTitles: [CHOSEN],
      // The Focus Playbook renders from this TOP-LEVEL outputs/done state
      // (App.jsx's renderSection reads outputs[id]/done.includes(id)
      // directly), not from savedPlaybooks[i].outputs -- that copy on the
      // record is what a save/restore round-trip persists, read only when
      // a slot is explicitly restored. Both carry the same content here so
      // neither shape is a lie, but this top-level one is what the fixture
      // actually needs to get right for anything to render as built.
      outputs: forOp ? {} : DOOR1_RECORD.outputs,
      done: forOp ? [] : DOOR1_RECORD.done,
      profile: {},
      savedPlaybooks: [DOOR1_RECORD, DOOR2_RECORD],
      // Optional: pre-seed the Moments evaluator's dedupe store (App.jsx's
      // coachMoments) via the same hydration path a real returning session
      // uses -- lets a test start already past one moment (e.g. delivery-p5
      // already fired) so the NEXT one it can drive is next-move or a
      // second delivery, without needing to simulate a live generation.
      ...(coachMoments ? { coachMoments } : {}),
    },
  }
}

export function buildMeResponse({ flagged = false, employmentStatus = 'employed', onboardingConcierge = false } = {}) {
  return {
    user: {
      // Deliberately NOT an @career.club address: that domain auto-grants
      // every pilot flag (isInternalAccount, api/_lib/feature-flags.js),
      // including hasCoachPresence -- which switches Chat from the floating
      // bubble (open/setOpen) to the embedded concierge panel (presence/
      // setPresence, App.jsx's conciergeEmbedded) on every non-welcome step.
      // The default (unflagged) fixture exercises the ordinary
      // floating-bubble surface that the other 145 accounts see; `flagged`
      // below grants coach_presence the same way a named outside tester
      // would be granted it (feature_flags, not the internal-domain
      // shortcut), so this stays a genuine test of the flag path rather
      // than of the internal-account bypass.
      email: flagged ? 'browser-test-flagged@example.com' : 'browser-test@example.com',
      first_name: 'Browser',
      last_name: 'Test',
      suspended_at: null,
      // employmentStatus overridable (empty string) so a test can flip on
      // Chat's employmentCaptureActive prop (App.jsx: !isIndependent &&
      // !employmentStatus) and exercise the real employment-mention capture
      // offer -- a genuine second assistant message landing right after the
      // main reply in the same turn, the same shape as Bob's "a reply plus
      // a capture offer" scroll-arrival report (2026-09-10).
      employment_status: employmentStatus,
      search_going_well: '',
      search_focus: '',
      // 'coach_presence' (COACH_PRESENCE_FLAG, api/_lib/feature-flags.js)
      // is what App.jsx's hasCoachPresence/conciergeEmbedded read -- see the
      // comment above. 'onboarding_concierge' (ONBOARDING_CONCIERGE_FLAG) is
      // the separate flag the Moments evaluator itself gates on
      // (ctx.hasOnboardingConcierge in every MOMENT_CATALOG entry) -- a test
      // driving a real Delivery/Next move fire needs this one specifically,
      // independent of whether the embedded panel (coach_presence) is on.
      feature_flags: [
        ...(flagged ? ['coach_presence'] : []),
        ...(onboardingConcierge ? ['onboarding_concierge'] : []),
      ],
      // Matches the live values in src/config/legal.js -- anything else
      // trips App.jsx's reaccept effect (~8956) and opens the fixed,
      // full-viewport LegalReacceptanceModal, which sits above both Chat
      // surfaces and blocks every click in these tests.
      privacy_version: PRIVACY_VERSION_MATERIAL,
      terms_version: TOS_VERSION_MATERIAL,
    },
  }
}
