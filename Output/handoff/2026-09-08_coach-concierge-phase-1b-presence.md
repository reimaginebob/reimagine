## Prompt for Code

Apply the changes in this brief once approved. Premise-verify against current `main` before touching anything, run the static gates, follow the gh flow in CLAUDE.md §9, report the PR URL and merge SHA.

---

## Date / Type / Source

2026-09-08. Implementation brief for Phase 1b, per the design (`Output/handoff/2026-09-08_coach-concierge-design.md`, Section 3a) and Bob's split of Phase 1 into 1a (shipped, PR #817) and 1b (this brief). Written against `main` at `1315285`. Finalized after Bob's answers to the three open questions raised in the first draft of this brief (all three resolved via chat, 2026-09-08).

## Decisions (resolved)

1. **Mobile reuses the existing bottom sheet, unchanged.** The floating Chat variant already renders as a bottom sheet below the mobile breakpoint (`src/components/Chat.jsx:104-105`) and already mounts on every step except `myCoach` and the onboarding steps `conciergeEmbedded` claims (`src/App.jsx:17103`: `signedInUser&&step!=='myCoach'&&!conciergeEmbedded`). Since `conciergeEmbedded` is already `!isMobile`-gated, **mobile already gets full "every screen" coverage today, through the floating mount, with no changes needed.** This phase makes no mobile-specific changes.
2. **Both dismissal affordances ("I'm good for now," "not on this screen") are held for Phase 2**, shipped alongside the Moments they gate rather than inert now. Consequence, for internal consistency: **"quiet" is also held for Phase 2** — nothing in Phase 1b can set it (that's what the dismiss affordances do), so shipping the state with no way to reach it is the same kind of premature UI the dismiss-timing decision already ruled out. Phase 1b's presence model is two states, not three: **open, minimized.**
3. **The existing `maximized` toggle needs no structural change.** It is already, in practice, nested inside "open" — it is a floating-panel size preference with no visual effect while the panel is closed, which is exactly the reading confirmed. No code change follows from this decision; it's a confirmation that today's shape already matches the target model, not a build item. (It also does not apply to the embedded/desktop panel at all — that one has always rendered at a single fixed size, `min(38vw,460px)`; "minimized" there is a new state, not a resize of an existing one.)

**Net effect on scope:** this shrinks considerably from the design doc's original Phase 1 description. What's actually left to build is: (a) generalize which desktop screens get the embedded panel, and (b) give the embedded panel a minimize affordance it does not have today. Nothing else in this phase — no mobile work, no quiet state, no dismiss UI, no maximize changes.

## Pre-flight discovery (scope correction, from the original draft — still holds)

- `conciergeEmbedded` (`src/App.jsx:8782`) gates a single sibling-column block (`:17089-17091`), not per-step markup — generalizing its step condition is a one-line change, not a per-screen one.
- The embedded variant has no minimize state at all today — its own comment says so (`:17074-17076`: "This one has no open/closed state of its own").
- A "Clear conversation" confirm dialog already exists on the embedded panel (`src/components/Chat.jsx:1377`) — unrelated to, and not touched by, this brief.

## Files affected

| File | Change |
|---|---|
| `api/_lib/feature-flags.js` | New `COACH_PRESENCE_FLAG` (`coach_presence`) + `hasCoachPresence(user)` + `GRANTABLE_FLAGS` entry, following the exact shape of `COACH_SITUATION_FLAG` — a separate flag, per Bob's "separate flags" instruction from the Phase 1 split. |
| `src/App.jsx` | Rename the gating condition currently expressed as `conciergeEmbedded` to reflect its new scope (kept as a single boolean/step-set the same way, just widened); a new `coachPresence` state (`'open' \| 'minimized'`, default `'open'`) lifted at the App level the same way `coachOpen`/`coachMaximized` already are (`:8706-8707`), so it survives a round trip through the dedicated My Coach step exactly like they do; the embedded panel's render branches on `coachPresence` instead of being all-or-nothing. |
| `src/components/Chat.jsx` | Embedded variant gains a minimize button and a collapsed-strip render (a slim tab at the panel's edge, "My Coach" label + icon — matching the visual weight of the existing message-collapse pattern already shipped elsewhere in the product, not inventing a new visual language) plus a way back to `'open'` from that strip. No changes to the floating variant — mobile and its bottom sheet are untouched per Decision 1. |

## Specific changes

1. **`api/_lib/feature-flags.js`** — add `COACH_PRESENCE_FLAG`/`hasCoachPresence` directly after `COACH_SITUATION_FLAG`'s block, same shape (internal accounts auto-granted, dashboard-grantable via a new `GRANTABLE_FLAGS` entry labeled "Coach presence (embedded panel beyond onboarding)").

2. **`src/App.jsx`**:
   - Widen the step condition currently gating `conciergeEmbedded`: today `CONCIERGE_ORIENTATION_STEPS.includes(step)` (`:4755`, the onboarding list); the new condition is "every step except `welcome` and `myCoach`" (both already have their own established treatment — Welcome has no Coach panel at all today, `myCoach` is the dedicated full-page view). Gate the widened reach on `hasCoachPresence`, so a non-flagged account keeps today's exact behavior (onboarding-only embedded panel).
   - Add `const[coachPresence,setCoachPresence]=useState('open')` near `coachOpen`/`coachMaximized` (`:8706-8707`).
   - The embedded mount's conditional (`:17089`) becomes: render the full panel when `coachPresence==='open'`, the collapsed strip when `'minimized'`, nothing when the step/flag gate excludes the account — same three-way shape the floating mount already has via `open`/`setOpen`.

3. **`src/components/Chat.jsx`** — embedded variant: accept `presence`/`setPresence` props (mirroring `open`/`setOpen` naming already used by the floating variant, for consistency); render the collapsed-strip UI when `presence==='minimized'`, with a tap target that calls `setPresence('open')`; add a minimize control (icon button) to the embedded panel's existing header area when `presence==='open'`.

## Voice rules on inserted text

The only new user-facing text is the minimize affordance's label/tooltip ("Minimize" or equivalent) and the collapsed strip's own label ("My Coach") — both plain UI chrome, not generated or persuasive copy, so no voice-gate exposure expected. Confirm `check-voice` stays clean regardless.

## Static gates

`npm run build` clean: voice gate, prompt-refs, coach-nav-map, fontsize/btn-prominence ratchets (the minimize button is a new interactive element — must meet the 16px+ floor per CLAUDE.md §8), full test suite, lint, `vite build`. New test: `scripts/test-coach-presence.mjs` — source-presence checks on the flag/wiring, the widened step condition, and the `coachPresence` state shape (two values only — `'quiet'` deliberately absent per Decision 2, with a check that guards against it being silently reintroduced). App.jsx EOF integrity, before and after.

## Runtime gate (Bob, post-merge)

On a flagged desktop account: confirm the embedded panel now appears on Put It to Work, a Career Paths direction, an Opportunity Playbook, and My Pipeline — not just onboarding. Minimize it on one screen, navigate to another, confirm it stayed minimized (state persists within the session) and the conversation is still there when reopened. Confirm a non-flagged account sees exactly today's behavior (onboarding-only). Confirm mobile is untouched — the bottom sheet still opens/closes normally everywhere it already did.

## Constraints

Single PR. No effort estimates. Gated behind `COACH_PRESENCE_FLAG`, `@career.club` first, separate from `COACH_SITUATION_FLAG`. PR title: `Coach-as-Concierge Phase 1b: presence model (embedded panel beyond onboarding)`.

## Out of scope

Mobile (already covered, untouched). The "quiet" state and both dismissal affordances — held for Phase 2, shipped alongside the Moments engine they gate. The floating variant's existing `open`/`maximized` behavior — unchanged. Build offers (Phase 3). Folding onboarding's `seen*` flags into a catalog (Phase 4). Everything already out of scope for 1a.

## Commit message

```
Coach-as-Concierge Phase 1b: presence model (embedded panel beyond onboarding)

Extends the desktop embedded panel from onboarding-only to every
screen after Welcome, and gives it a minimize affordance it did not
have before (previously all-or-nothing: rendered at full size or not
at all). Mobile is untouched -- the floating Chat's existing bottom
sheet already covers every non-onboarding screen and needs no changes.

"Quiet" and the two dismissal affordances ("I'm good for now," "not
on this screen") are deliberately not in this phase: nothing in
Phase 1a or 1b gives Coach anything unprompted to say yet, so a
dismiss control here would have nothing to dismiss. Both ship in
Phase 2 alongside the Moments engine they actually gate.

Gated behind COACH_PRESENCE_FLAG, @career.club first, separate from
COACH_SITUATION_FLAG per the Phase 1 split.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Qbsj3ds9Cfozte1ASdRrDx
```

## Push

Branch → PR → CI/smoke → merge, per CLAUDE.md §9.

## Implementer's checklist

1. Pull latest `main`; re-confirm the SHA this brief was written against still holds.
2. Apply the changes above.
3. Write `scripts/test-coach-presence.mjs`; register it in `package.json`.
4. Run `npm run build` clean.
5. Branch, commit, push, PR, watch CI/smoke, merge (squash).
6. Report the PR URL and merge SHA.
