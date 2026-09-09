# Prompt for Code
HOLD until Bob says go. Save this file verbatim to `Output/handoff/2026-09-09_concierge-batch-and-phase4-brief.md` in this repo now; do not start work on it. It has two parts. Part 1 is the post-test batch: items already known from Bob's production read on `268a812` through `e4e088f`, plus a placeholder section that Bob's Parts B5 through G results will fill. Part 2 is the Phase 4 brief. When Bob says go, Part 1 ships as a small number of PRs (grouped as marked, gated and ungated never mixed), and Part 2 starts after Part 1 has cleared Bob's read.

Date: 2026-09-09
Type: Batch (post-production-test fixes) and Phase 4 brief (fold the hand-wired Coach into the catalog)
Sources: Bob's test log (`2026-09-09_concierge-test-feedback.md`, Parts A and B, plus the SCOPE reference sample); Code's affordance inventory (`2026-09-09_coach-affordance-inventory.md`); the introduction-messaging research consult (2026-09-09); the concierge design (`2026-09-08_coach-concierge-design.md`). Builds these were observed on: `268a812` through `e4e088f`.

## Standing rules that apply to everything below

- Situation fields are a projection of app state, never DOM measurement (CLAUDE.md §8, #842).
- No Coach copy ships without Bob's sign-off on the text. Copy in this brief marked APPROVED is his; copy marked DRAFT is not, and must not ship.
- One `PLAIN_ENGLISH` principle, no banned-word lists. Add this sentence to the block: "Could a good colleague say this across a table without sounding either above the person or like they were keeping a file on them? If not, rewrite it." (Bob, 2026-09-09: no superiority, no surveillance, partner not parent.)
- A gated PR contains no ungated change. Each item below is marked G (behind `onboarding_concierge` / `coach_presence`) or U (reaches every account).
- Production bugs: reproduce to the symptom first, trace the path in the PR, run it in a browser on the preview.

## Part 1: the batch

### 1.1 Engine and presence (G)

1. Dismissal taps and an accept tap. When Coach makes an offer ("If you want, we could add..."), the taps are: [Yes, add that] [Not now] [Skip this screen]. When there is no offer: [Not now] [Skip this screen]. "Yes, add that" sends the acceptance as the person's turn so the existing rework/capture path does the work. Tap words: DRAFT, Bob to confirm or replace. Gold stays on the action tap only. Behavior of the two dismissals is unchanged (session snooze; screen quiet).
2. Delivery on pre-existing builds. Delivery fires once on first visit to a section that was built before the concierge existed (observed A1, Interview Prep). Decision: KEEP, once per section, as the discovery moment for prior work. Bob to confirm; if he'd rather it stay quiet on old builds, add a built-before-flag check to the dedupe key.
3. Return recap tightening. Observed B6: four sentences, "real momentum on the live side" (our shorthand), and it arrived as two stacked messages. Instruction: three sentences hard cap; name the pipeline fact plainly ("HOPE is at the offer stage, and you have interviews at Deloitte and Imerys coming up"); one message, never two. Confirm what the first of the two stacked messages was and why it fired.
4. Snooze tightening, confirm shipped. Guardrails brief change 3 (Next move with build offer becomes ordinary after "I'm good for now"; a second tap quiets everything for the session). Confirm it is in #835; if not, ship it here.
5. Stall copy. Per `2026-09-09_coach-phase3-voice-review.md`: "Nothing is built for this role yet. Want me to build {firstSectionLabel} now, or would you rather look at other roles?" Taps "Build {firstSectionLabel}" / "Show me other roles". Status: awaiting Bob's word. Ship only when marked APPROVED.
6. Introduction explanation once. The self-open explanatory framing (Part 2, item 2.3) appears the first time Coach opens on its own and never again: dedupe key `coach-self-open-explained`, durable.
7. B4 and B5. Pending Bob's fresh-session results. If B4 shows Delivery did not open the panel through the snooze, that is a significance bug in the evaluator; fix to the symptom with a browser test.

### 1.2 Voice samples for the eval (no code; add to the fixture set)

- PASS reference: Bob's SCOPE question on the Deloitte Interview Prep card (grounded, personalized, surfaced "leaning on" and "also consider"). Use as the bar.
- FAIL samples: "Every interviewer on this path is going to clock that" (unsourced absolute plus slang); "the main read mostly confirms what you already believe" (tells the person what they believe); "real momentum on the live side" (shorthand).

### 1.3 Ungated fixes (U, each its own PR or grouped as marked)

8. Start Fresh confirmation. Replace the browser-native `confirm()` with an in-app dialog: Cancel is the default, the destructive button reads "Delete my account", body text unchanged ("This permanently deletes your profile, outputs, saved playbooks, and chat history. You can sign back in with the same email to start over.").
9. Layout width token. Raise layout width, keep prose measure (see the layout prompt of 2026-09-09): one token for page layout (cards, pipeline board, rails), ceiling around 1440, running text keeps its current measure inside it; no centering; same width whether the panel is open or docked. Screenshots at 1440 and 1920.
10. CoachMark on the sidebar's My Coach row. Same mark as the header pill so the two entrances share an identity. No other sidebar change.

### 1.4 Process and tests (U, docs and test files only)

11. CLAUDE.md additions. (a) Production bugs: reproduce to the symptom, trace the path in the PR, run it in a browser on the preview; adversarial second look on engine PRs. (b) Animation: when morphing a box between very different sizes, screenshot the mid-flight frame, not only the endpoints (the #844 radius bug). (c) Branch restart: rebase onto `origin/main`, not the reset branch tip, even when content-identical.
12. Flagged fixture for browser tests. The #842 suite runs as a non-internal account (floating bubble). Add a flagged-account fixture so the embedded concierge panel is the surface under test; run the eleven-click sweep and the composer-visibility check on it.
13. Correction-target verification. The one browser test that decides Column 3 of the inventory: on a Focus Playbook, scroll (do not click) to a section, type a correction ("change the opening"), assert the rework lands on that section. If it passes across the eleven sections, the per-section "Ask My Coach about this" targets can come from the Situation and Column 3 collapses into Column 1 at GA.

### 1.5 From Bob's Parts B5 through G (placeholder)

To be filled from the log. Sort each failure by phase (1a grounding, 1b presence, 2 or 3 moment or copy, guardrails) and attach the verbatim reply.

## Part 2: Phase 4 brief

### 2.1 What Phase 4 is

One mechanism for the whole journey. The eighteen hand-wired `seen*` triggers, the fifteen `openCoachWith` sites, and the twenty-five Coach affordances in Code's inventory become catalog rows in the Moments engine, offered by Coach at the moment they are useful, with taps. Nothing users see changes on day one; the change is that a future tweak is one row in one place. Onboarding is last on purpose, so the part that works is never the part under test.

### 2.2 The inventory, applied

Per `2026-09-09_coach-affordance-inventory.md` (25 affordances):

- Column 1 (16, open Coach only): removal list for GA day. Nothing is removed until the panel is on for every account. Two premises to verify before this list is final: "Your Next Step" is a live pilot (shipped 2026-09-02, flagged), not dead code, so its button is a pilot question, not a removal; and the five Focus sections whose "Ask My Coach about this" carries no rework target (The Role, Compensation Read, Interview Prep, Networking Groups, Recruiters) need one answer: corrections unsupported there, or inconsistent wiring. Report which.
- Column 2 (8, specific reads and drills): become catalog rows, one each: Practice This Answer; the two per-seat Interview Team doors; the weakness question; the five routed interview questions (one row with a parameter, not five); the offer-negotiation trade-off drill; the pipeline read; the opportunity read. Each row: family (mostly Check, keyed on pipeline or playbook state; Practice This Answer is Delivery-adjacent, after Interview Prep builds), significance (ordinary unless it responds to something the person just did), condition, dedupe key, and the tap that runs the existing read. The page button is removed only once its row has fired on Bob's account and passed his read.
- Column 3 (1, correction target): resolved by item 13. Until then, unchanged.

### 2.3 Coach introduces itself (three catalog rows, Arrival family, surface = Coach)

Principles (research consult, 2026-09-09, adopted): teach one capability at the moment it is true, never a list; trust comes from what Coach does, not what it claims; the first open is relationship plus the one true next thing. Bob's constraints: partner not parent; no language that implies superiority or surveillance; texture over vagueness ("worth a word" and "worth talking about" rejected as meaningless to a new user); never apologize for being present.

Row A, first open (once per account, at the first appearance of the panel after Welcome). Copy, DRAFT pending Bob's sign-off (fifth pass, 2026-09-09):

> I'm your coach, and I'm with you for the whole search. We start with the groundwork: your resume, what people count on you for, what matters to you in the next job. I'll be right here while you put that in, and if you'd rather tell me something than type it into a box, say it here and I'll put it where it belongs. Ask me anything along the way, about your search or about how any part of Reimagine works.

Row B, first minimize (once; renders in the pill as it lands). DRAFT:

> I'm right up here. Click me anytime and we pick up where we left off.

Row C, first self-open (once, the first time a significant moment opens the panel; the real reason is filled in from the moment that fired). DRAFT:

> I opened because something just happened that's worth talking about: {the real reason, e.g. "you finished your Bridge Story, and I have a read on it"}. I'll do this when there's something real to say, after you build something, when you pick a role, when an interview is coming up. If you'd rather I hold off for now, tell me "I'm good" and I will.

Rule, not copy: "what can you do?" When asked, Coach names three or four things it can do with what this person has built right now, one line each, each with a tap; never a general list of features. Implement as a prompt rule in `SYSTEM_PROMPT_STABLE` plus the catalog's tap vocabulary.

### 2.4 One Coach

The panel is the Coach. Add an expand control that takes it to full width for a long conversation; the sidebar's My Coach opens that same panel expanded rather than a separate screen. The full-page `myCoach` mount is retired once the expanded panel has passed Bob's read. The pill and the sidebar row share the CoachMark.

### 2.5 Pre-Phase-2 copy pass

All Coach copy that predates Phase 2 (onboarding framing, per-step narration, employment and intake prompts, capture-offer copy; the "how it lands" onboarding line is an example) gets the same extraction-and-sign-off pass the Phase 2 and 3 copy got. Extraction first, verbatim, as a returned document; rewrite only after Bob's sign-off.

### 2.6 Order of work and gates

1. Part 1 ships and clears Bob's read.
2. Item 13 (correction-target test) decides Column 3.
3. 2.3 rows A, B, C ship first in Phase 4, since they are three rows with no removals, and Bob reads them on a fresh account.
4. Column 2 rows ship in small groups (two or three per PR), each row read by Bob before its page button is removed.
5. 2.4 One Coach.
6. 2.5 copy pass.
7. GA: flag opens to named testers, then everyone; Column 1 removals ship the same day the flag opens to everyone, not before.

## Out of scope

Weekly goals (held by Bob until Part G results). The challenge mechanism as a Check moment (backlog). The My Coach avatar (enhancements list, Later). Server-side orchestration and the rest of the structural backlog.
