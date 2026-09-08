## Prompt for Code

This is a draft brief for Phase 1b (the presence-model UI), following the same process as Phase 1a: premise-verify against current `main`, draft file-level specifics, send back for review before writing any code. It surfaces three open questions that materially affect scope — read those before approving, since one of them (dismissal-affordance sequencing) changes what actually ships in this phase versus Phase 2.

---

## Date / Type / Source

2026-09-08. Implementation brief for Phase 1b, per the design (`Output/handoff/2026-09-08_coach-concierge-design.md`, Section 3a) and Bob's split of Phase 1 into 1a (shipped, `main` at `1315285`) and 1b (this brief). Written against `main` at `1315285`.

Scope per the design: the presence model — three states (open, minimized, quiet) on every screen after Welcome — and the two dismissal affordances. No Moments engine, no build offers (Phase 2+).

## Pre-flight discovery (scope correction)

- **The embedded panel is a sibling flex column, not woven into per-step markup.** `conciergeEmbedded` (`src/App.jsx:8782`) gates a single conditional block (`:17089-17091`) that renders as a sibling of the scrolling content column, sized independently (`width:min(38vw,460px)`). Generalizing which screens get it is a change to one gate, not to every screen's own render code — the mechanism already scales the way Phase 1b needs it to.
- **Desktop-only today, and mobile already has its own answer.** `conciergeEmbedded` requires `!isMobile`. Separately, the *floating* Chat variant already renders as a bottom sheet below the mobile breakpoint (`src/components/Chat.jsx:104-105`, confirmed shipped per the mobile-responsiveness closeout in CLAUDE.md §11). This means Phase 1b does not need to invent a mobile "open" treatment — the bottom sheet already is one, proven in production. See Open Question 1.
- **The embedded variant has no minimize state at all today** — its own code comment says so directly (`src/App.jsx:17074-17076`: "This one has no open/closed state of its own"). Phase 1b's "minimized" state is genuinely new UI for the embedded surface, not a re-skin of something existing.
- **The floating variant's existing state is a different shape than the design's three states.** Today: `open` (boolean) + `maximized` (boolean, desktop-only reversible size toggle, lifted to `App.jsx` per the persistent-panel work). This is two independent booleans, not open/minimized/quiet. See Open Question 3 for how they reconcile.
- **A "Clear conversation" confirm-before-wipe already exists** on the embedded panel (`src/components/Chat.jsx:1377`, `window.confirm(...)`), unrelated to and not in conflict with the two new dismissal affordances this brief adds — flagging so the two aren't confused in review. (The native `window.confirm()` pattern here is a known pre-existing style inconsistency, already catalogued in the build log's aggregate findings — not something this brief touches or should touch.)

## Open questions (recommendations given, need your call before file-level specifics are final)

**1. Mobile's "open" state.** Recommend: reuse the existing bottom sheet as-is for "open" on mobile — it's already built and proven, and forcing the desktop `min(38vw,460px)` side-panel layout onto a phone would be new, real UI risk (the exact area CLAUDE.md's known-gaps section flags as least-tested: "wide data tables and long generated prose have not been reviewed on a very narrow screen"). "Minimized" on mobile = the existing closed floating bubble. Under this reading, Phase 1b's actual new mobile work is small: extend the *floating* Chat's reach (it already covers every non-embedded screen) and add "quiet" to it — no new mobile-specific layout.

**2. Dismissal-affordance sequencing — this one changes scope.** "I'm good for now" and "Not on this screen" are described as suppressing *ordinary* proactive Moments (design Section 5). But the Moments engine is Phase 2 — nothing unprompted fires yet in Phase 1a or 1b. Building the dismissal UI now means it has nothing to actually do until Phase 2 ships. Two ways to read this:
   - **(a)** Ship the affordances now, inert until Phase 2 gives them something to gate. Keeps the design doc's own phase boundary as written.
   - **(b)** Hold both dismissal affordances for Phase 2, alongside the Moments they gate. Phase 1b ships only the three-state presence model itself (open/minimized, plus "quiet" as a state that simply exists with no trigger to reach it yet).
   
   Recommend **(b)**: Phase 1a's own discipline was "no new proactive turns, so the panel's new reach is tested without new chatter" — extending that same discipline through 1b means not shipping a dismiss button with nothing behind it yet, which would just be confusing UI to QA now and re-QA once it does something. This does shrink 1b's stated scope from the design doc; flagging explicitly rather than deciding it unilaterally.

**3. Reconciling `open`/`maximized` with `open`/`minimized`/`quiet`.** Recommend: the new **minimized** state = today's `open:false` (closed bubble) — same UI, renamed in the state model to match the design's vocabulary. The new **open** state = today's `open:true`, with the existing `maximized` boolean surviving as an orthogonal, desktop-only size preference *within* open (a toggle, not a fourth state) — exactly how it behaves today, just nested under "open" conceptually rather than being a separate top-level flag. **quiet** is genuinely new, with no existing analog. This reading requires no behavior change to the existing maximize toggle, only a naming/state-shape change plus the new `quiet` value.

## Files affected (pending confirmation of the above)

| File | Change |
|---|---|
| `api/_lib/feature-flags.js` | New `COACH_PRESENCE_FLAG` (`coach_presence`) + `hasCoachPresence(user)` + `GRANTABLE_FLAGS` entry, separate from `COACH_SITUATION_FLAG` per Bob's "separate flags" instruction. |
| `src/App.jsx` | Generalize `conciergeEmbedded`'s step condition from `CONCIERGE_ORIENTATION_STEPS` to "every step after Welcome" (desktop, flagged accounts); add a `coachPresence` state (`'open' \| 'minimized' \| 'quiet'`) replacing the embedded variant's implicit always-open assumption; the floating mount's existing `open`/`maximized` props stay as-is per Open Question 3's reading, with `quiet` added as a new value the floating variant also reads. |
| `src/components/Chat.jsx` | Embedded variant gains a minimize affordance (button + collapsed-strip rendering showing the most recent line) it does not have today; both variants gain the "quiet" rendering (suppressed proactive surface — inert in this phase per Open Question 2's recommendation) and, if Open Question 2 resolves to (a) instead, the two dismissal quick-replies. |

Section deliberately left less granular than 1a's until the three open questions are resolved — the exact prop shape and dedupe/persistence key depend on which reading of Question 3 you confirm.

## Static gates

`npm run build` clean, same gate list as every prior PR this batch. New test: `scripts/test-coach-presence.mjs` — source-presence and pure re-derivation of the state-shape mapping (Question 3's reading), the generalized step gate, and the flag/GRANTABLE_FLAGS wiring. App.jsx EOF integrity, before and after.

## Runtime gate (Bob, post-merge)

Walk a flagged account through several non-onboarding screens (Put It to Work, a Career Paths direction, an Opportunity Playbook, My Pipeline) confirming: the panel is present per the resolved mobile/desktop reading; minimizing and reopening preserves the conversation; quiet (once reachable) does not lose it either. On mobile specifically: confirm the existing bottom sheet still opens/closes correctly with no regression from the generalized gate.

## Constraints

Single PR (or two, if Open Question 1's mobile/desktop split ends up cleaner as separate PRs — your call once the shape is confirmed). No effort estimates. Gated behind `COACH_PRESENCE_FLAG`, `@career.club` first, separate from `COACH_SITUATION_FLAG`.

## Out of scope

The Moments engine and everything in Phase 2 (including, per Open Question 2's recommendation, the two dismissal affordances themselves, held for that phase). Build offers (Phase 3). Folding onboarding's `seen*` flags into a catalog (Phase 4). Everything already out of scope for 1a.

## Commit message

Drafted once the three open questions are resolved and the specific-changes section is filled in to match.

## Implementer's checklist

1. Get Bob's read on the three open questions above.
2. Fill in exact file-level specifics against the confirmed reading.
3. Pull latest `main`, re-verify the SHA this brief was written against still holds.
4. Apply changes, write the test, register it, `npm run build` clean.
5. Branch, commit, push, PR, watch CI/smoke, merge (squash).
6. Report PR URL + merge SHA.
