## Prompt for Code

This is a design, not an implementation brief. Read it end to end, then do three things: (1) premise-verify the "what exists" claims in Section 2 against current `main` and report drift; (2) draft the implementation brief for Phase 1 only (Section 8), with your own file-level specifics, and send it back for review before writing code; (3) do not start Phases 2 to 4 until Phase 1 has been through Bob's QA on a named SHA. Everything here is gated behind a named per-user flag per CLAUDE.md §8, Bob first.

---

## Date / Type / Source

2026-09-08. Design response to Code's "Coach-as-Concierge design question" briefing (a full day of live QA as Dana Whitfield, plus a transcript-level evidence check). Written against `main` at `af22bb7`. The two prior My Coach documents this builds on: the 2026-09-07 review (transport and capture fixes, shipped as #784 to #797) and the 2026-09-08 prelaunch batch (#798 to #810).

## 1. The diagnosis, in one paragraph

Code's finding is right and the evidence for it is clean: the same model, the same opportunity, the same day, a good answer through the "Get My Coach's read" button and a hollow one through free-text chat. That is not a model problem. It is that Coach has two separate systems for knowing where a person is, and neither is complete. Context assembly happens per trigger: a purpose-built button pins the record and seeds a question; free-text chat sends only a step id, which the server uses for nothing except picking a guide chapter (`api/coach.js:1659`, `:1758`). Proactivity happens per surface: eighteen `seen*` flags, sixty-odd ref and flag sites, and fifteen `openCoachWith` call sites in `src/App.jsx`, each hand-wired with its own dedupe and its own context. Onboarding has the most wiring, so Coach feels present there; Career Paths has none, so Coach is silent there. The Brand richness reaction works because someone wired that one moment well. The fix is to stop wiring moments one at a time and give Coach one shared answer to "what is this person looking at, what just happened, and what is on the table," which both free-text chat and every proactive moment read from.

To answer Code's framing question directly: neither "more narrow triggers everywhere" nor "just give chat the button's context" is sufficient on its own. Narrow triggers do not scale (Career Paths alone is eleven screens) and they leave free chat hollow. Giving chat the context without a trigger model leaves Coach passive. The design below does both through one mechanism: **context assembly becomes shared** (a Situation the client computes and sends on every turn) and **triggering becomes declarative** (a small catalog of Moments evaluated by one engine against that Situation, with one arbitration rule and one budget).

## 2. What exists today, and what each piece is worth

- **Server-side grounding is already good and already shared.** `buildCoachProfileSlice` assembles the brand, resume, raw signals, priorities, logged offers, live pipeline status, the Focus Playbook build map (for the next_step pilot), and the in-focus record's built sections. This is the foundation; the design adds to it rather than replacing it.
- **In-focus record detection is the weak link.** A record is pinned only when `coachSaveTarget` is a door2 record (`src/components/Chat.jsx:563`), otherwise the server guesses from the person's words (`findInFocusRecord`, six-character title match). On Career Paths the direction record is never pinned, so chat about "this role" has no idea which role. This is the mechanical reason the pipeline button worked and free chat did not.
- **The server knows the step id and nothing else about the screen.** No section in view, no lane or role just chosen, no "this section was just built or refined," no idle time. `[The user is currently on step "focus"]` is the entire screen context for every Focus Playbook section.
- **Proactive turns are four different mechanisms:** silent server turns (session-open, nine orientation checks, post-capture); client-pushed scripted messages (`banner:true` narration, employment and intake and thin-field prompts, pipeline check-in opener); milestone prompts that ride inside a normal reply; and seeded questions via `openCoachWith`. Each has its own gate, dedupe key, and cooldown; two can collide on one arrival (already patched twice this week).
- **The three working examples share a shape:** a precisely defined moment, the actual content of what just happened fed to the model, a rubric for how to react, one reply. Brand richness, the pipeline read, and the orientation reflective-depth checks are all this shape. The design generalizes exactly that shape.
- **Silent save failures** (Life Story capture, Personal Brand rework) are a separate bug class and Section 7 names the likely cause.

## 3. Design principles (what "concierge" means, in Bob's words, 2026-09-08)

Bob's statement of intent governs everything below: Coach is **omnipresent and always available** across the whole journey, not just onboarding. The person can minimize it or shrink its footprint, but even minimized, when Coach has something significant to say it opens and says it. The person can answer "I'm good, I don't need help right now," and Coach respects that. The reason: Reimagine's features and the career advice inside them are going massively untapped; a concierge exists to close that gap, and a quiet one does not.

1. **Coach knows where you are without being told.** Every turn, prompted or not, carries the same picture of the screen.
2. **Coach is always there, and it speaks when it matters.** The panel exists on every screen after Welcome. Silence is not the default; relevance is. When a moment is significant (Section 5 defines which), Coach opens even from a minimized state. When it is not, Coach stays where the person left it.
3. **"I'm good" is honored, and it is a snooze, not a mute.** A dismissal quiets the ordinary moments for the rest of the session; a significant moment (something just built, something just chosen, a milestone reached) still opens, because that is the moment the untapped feature is worth naming. The person can also say "not on this screen," which quiets that screen only.
4. **Every unprompted turn opens a door.** It names what is here, what it produces, and one move, and where the app can do the move, Coach offers it as a tap. Never a status report, never a list, never a task queue.
5. **Discovery is the job.** Arrival and Next-move moments exist to surface the features people have not found. Coach names them by their on-screen names and says what they produce for this person; that is the mechanism for "features going untapped."
6. **The model judges, the app decides.** Whether a moment fires is deterministic (the engine). What Coach says inside it is the model's. Whether anything gets written or built stays a tap.
7. **Cost is a design input.** Unprompted turns run on the trimmed prompt (#808) and pay for the screen context only; the book and guide ride only on typed questions.

### 3a. Presence model

Three states for the panel, on every screen after Welcome: **open** (the embedded right-hand panel from onboarding, extended to Put It to Work, Career Paths, every Focus and Opportunity section, My Pipeline, and My Playbooks), **minimized** (a slim strip or bubble with the most recent line visible, the person's choice), and **quiet** (the person said "I'm good"). Significance decides what happens on a moment: a significant moment opens the panel from minimized or quiet; an ordinary moment posts to the strip in minimized and does nothing in quiet. The person's chosen state persists across screens within a session; a new session starts open. This replaces the current seam where the embedded panel ends at Put It to Work and reverts to the floating bubble.

## 4. The Situation: one object, computed client-side, sent on every turn

Replaces the bare `currentStep` and the sometimes-pinned `focusRecordId`. Built by one function in `src/App.jsx` from state already in scope, sent in the `/api/coach` body on every request (typed, seeded, or moment).

```
situation: {
  screen: 'focus' | 'op' | 'laneSelect' | 'twoDoors' | 'pipeline' | 'p3' | <orientation step> | 'myCoach',
  record: { id, source: 'door1'|'door2', title, lane, company } | null,   // the playbook this screen belongs to, pinned every time
  section: 'p5' | 'p6' | ... | 'companyRead' | null,                     // section in view, if the screen is a section
  built: ['p5','p6'], notBuilt: ['p11', ...],                               // for the pinned record (client already has describeSections)
  justHappened: { kind: 'built'|'refined'|'chose_lane'|'chose_role'|'arrived'|'saved'|'declined_offer', target, at } | null,
  choice: { lane, role } | null,                                           // the most recent selection on Career Paths
  idleSeconds: n,                                                          // since last input or navigation on this screen
  visitCount: n,                                                           // this screen, this session
  buildSha
}
```

Server side, `buildCoachProfileSlice` gains one `SITUATION` block rendered from this object, in plain language, placed right after the anchors: "They are on the Focus Playbook for *Head of Supply Chain* (Industry Insider), looking at Bridge Story, which was built four minutes ago. Built on this direction: Where You Fit, Bridge Story. Not built: Industry Background, Interview Prep, Resume Refresh, LinkedIn Remix, Go-to-Market, Compensation Read, Income Now." The in-focus expansion (`buildPlaybookExpansion`) keys off `situation.record` first and falls back to title matching only when nothing is pinned. The section in view is always included in the expansion at the larger cap, so "what do you think of this" has the thing in front of the model.

This alone closes the button-versus-chat gap: the button worked because it pinned the record and asked a scoped question; with the Situation, free chat is pinned the same way, every turn, on every screen.

## 5. The Moments engine: a catalog, one evaluator, one budget

Replaces the eighteen `seen*` flags and the per-surface effects with one client-side evaluator that runs on Situation changes and decides whether Coach speaks unprompted. A moment is a row in a catalog, not an effect in `App.jsx`.

**Catalog (v1, eight moment families; each family is one prompt template on the server, not one per screen):**

| Family | Fires when | What Coach does (one reply, trimmed prompt) | Offer, if any |
|---|---|---|---|
| **Arrival** | first visit this session to a screen with a purpose (Put It to Work, Career Paths, a Focus or Opportunity section with nothing built) | says in two or three sentences what this screen is for in this person's terms and names the one move that fits their state | "Build [section]" tap when the screen's primary action is a build |
| **Choice** | `justHappened.kind` is `chose_lane` or `chose_role` | reflects the choice against the brand in one line and names what building the first section will tell them | "Build Where You Fit" |
| **Delivery** | `justHappened.kind` is `built` for any section or card | the Brand richness pattern generalized: a judged read of what was just built, one specific strength, at most one thing that would make it richer, framed as an invitation | "Rework with this note" (existing section-rework path) |
| **Next move** | a section was just built or refined and a downstream section is unbuilt and warranted (the existing milestone logic, extended from opportunities to directions) | names the one next card and why it follows from this one | "Build [next]" |
| **Stall** | `idleSeconds` past a threshold on a screen with an unbuilt primary action, or `visitCount` ≥ 3 with nothing built | one question, not a nudge: what would make this worth their time, or would they rather look at something else | none, or "Take me to [alternative]" |
| **Return** | session-open (existing), generalized to name the screen they left off on | existing behavior, plus "you were on X; pick up there or somewhere else?" | "Pick up where I left off" |
| **Capture** | existing capture notes (values, skills, opportunity update, etc.) | unchanged; already one mechanism after #793's arbitration | existing taps |
| **Check** | existing orientation reflective-depth and upload reactions | unchanged; they already fit the pattern | existing |

**Significance.** Each family has a fixed significance: **significant** = Delivery, Choice, Next move (when it carries a build offer), Return, and Arrival on a hub (Put It to Work, Career Paths, an Opportunity Playbook just created); **ordinary** = Arrival on an individual section, Stall, and Capture offers. Significant moments open the panel from minimized or quiet (per 3a); ordinary moments post to the strip when minimized and stay silent when quiet. Significance is a column in the catalog, so Bob can promote or demote a family without code elsewhere.

**One evaluator.** On every Situation change: build the list of moments whose condition is true; drop any whose dedupe key `(family, screen, record.id, section)` has fired this session or is in the persisted `coachMoments` set for durable ones (Arrival per record, Delivery per section-version); apply the presence state (quiet drops ordinary moments; minimized routes ordinary moments to the strip); enforce the per-visit cap of one unprompted turn per screen visit for ordinary moments (significant moments are exempt from the cap but never fire twice for the same key); pick the highest priority (Delivery > Choice > Next move > Arrival > Return > Stall); fire it as a silent turn with `moment: {family, significance, ...}` in the body. Priority, significance, and the cap are the only arbitration; there is no per-surface code.

**One dedupe store.** `coachMoments` in the profile blob replaces the eighteen `seen*` flags over time (the flags stay until each surface migrates). Durable keys for moments that should never repeat (Arrival per record, Delivery per section build); session keys for the rest.

**Two dismissal signals.** Any unprompted Coach message carries "I'm good for now" (session-level quiet: ordinary moments stop, significant ones still open) and, on section screens, "Not on this screen" (screen-level quiet). Both log `declined` through the existing prompt-engagement endpoint, so the accept/decline measurement Bob asked for on 2026-09-07 covers every moment for free, and the dismiss rate per family is what tunes the catalog after launch.

## 6. Actionability: Coach proposes a build, the app builds

Today Coach can only point ("you can build that in Interview Prep"). The missing half of "concierge" is that the pointing never turns into motion. The existing one-tap contract (model proposes, tap writes) extends cleanly to builds: a `BUILD: {section}` capture, validated server-side against `situation.notBuilt`, rendered by `Chat.jsx` as a tap that calls the same `generateSection`/`generateOpSection` the screen's own button calls, with the confirmation coming from the build's completion (the #784 discipline), never from the offer. Coach stays read-only in the sense that matters: it never builds on its own judgment; the tap does. The read-only rule in `SYSTEM_PROMPT_HEAD` is amended to say so ("you can offer to start a build; the person's tap starts it").

This is the single change that turns "presence" into "forward motion" in Code's terms, and it is why the Moments above carry an offer column.

## 7. Two bugs that will sabotage the design if left alone

**Silent save failures are probably the staleness precondition from #802.** Coach writes to profile fields go through `pr()` and the autosave; since #802, the autosave PUT is rejected with a 409 when the server copy is newer, and the client treats a 409 as "stale, reload" (`src/App.jsx:9472`). A Coach write followed by a 409 would land in localStorage, fail on the server, and show nothing to the person except the small save notice, while Chat's confirmation has already said "Adding that to your Story now." Two fixes: Coach-initiated profile writes go through a dedicated endpoint that writes the field with its own precondition (the `api/employment.js` pattern, already the reference implementation for one-fact writes) and return success before Chat confirms; and the confirmation copy for every Coach write comes from the write result, which #784 did for offers but not for the followUp text on the older capture keys. Verify against the transcript before building.

**Two-door Put It to Work was never replaced by the routing question it was built to be replaced by.** Code names this; it is a stranded build. Arrival on Put It to Work is the first moment in the catalog, and the routing question ("is something already in motion?") is exactly what the Arrival moment says there, so the replacement lands as a consequence of Section 5 rather than a separate fix. Wording confirmed by Bob in Section 12.

## 8. Phases, each behind one flag, Bob first

**Phase 1: Presence and Situation.** Extend the embedded panel to every screen after Welcome with the three states in 3a (open, minimized, quiet) and the two dismissal affordances; build the Situation object, send it on every turn, render the `SITUATION` block server-side, key the in-focus expansion off `situation.record`, always include the section in view. No new proactive moments yet, so the panel's new reach is tested without new chatter. Success test: the pipeline-button question and the same question typed free-form produce comparably grounded answers on Cart.com; "what do you think of this bridge story" typed on the Bridge Story screen gets a reply about that bridge story. This is the phase that fixes the hollow-chat evidence and it carries no risk of new noise.

**Phase 2: Moments engine with Arrival, Choice, Delivery on Career Paths and Put It to Work.** One evaluator, one dedupe store, the significance column, three families (the dismissal affordances arrive with the presence model in Phase 1). Delivery reuses the Brand richness prompt shape. The Put It to Work routing question ships here as the Arrival moment. Existing onboarding triggers untouched.

**Phase 3: Build offers, Next move, Stall.** The `BUILD` tap, the milestone logic extended to directions, the idle nudge. Stall thresholds are starting numbers; log fire and dismiss rates.

**Phase 4: Fold onboarding into the catalog.** Migrate the `seen*` flags and the per-step narration into Check and Arrival moments so one mechanism runs the whole journey. This is cleanup, not new behavior; do it last so the working parts of onboarding are never the thing under test.

## 9. Cost and prompt discipline

Moment turns use the trimmed prompt (#808: persona, posture, profile slice, no guide, no book) at `effort: low`, plus the Situation block and the in-view section. Rough cost is the same as today's orientation checks, a few cents each. The budget of one unprompted turn per screen visit bounds the total at roughly the number of screens a person visits per session; at ten screens that is under a dollar a session at the trimmed rate, and most visits fire nothing because the dedupe keys are durable. The Situation block adds a few hundred tokens to typed turns and removes the need for the title-matching heuristic. Nothing here touches the cached stable prefix.

## 10. Voice and gating

Every moment family's template is checked against the three enforcement layers (in-prompt rules, `check-voice`, strippers) and against the specific rules Code listed: mirror not cheerleader, translation not praise, positive framing with a door opened, listening before advising in orientation, partnership not self-interest. Arrival and Stall are the two families most at risk of reading as nagging; the "one per visit, dismiss silences the screen" budget is the mechanism, not the instruction. Each phase ships behind its own named flag in `api/_lib/feature-flags.js`, `@career.club` first; the Situation object itself is not user-visible and can ship ungated once Phase 1 is verified, since it changes what the model knows rather than what the person sees.

## 11. How to know it worked

Not a checklist of screens. Three measurable things: (a) parity: five typed questions on five screens score within one point of their button-seeded equivalents on a grounding rubric (names the record, references what is built, proposes something the screen can do), run as a live eval like `eval-interview-capture-live.mjs`; (b) motion: the share of Arrival and Delivery moments whose offer is tapped, versus dismissed, from the prompt-engagement table; (c) quiet: unprompted turns per session stays at or under the screen count, and the dismiss rate on any one family stays under a threshold Bob sets, or that family's condition tightens. Code's own 52-item checklist stays the reliability layer; this is the quality layer above it.

## 12. Decisions from Bob (2026-09-08)

1. **Coach may offer to start a build.** Confirmed. Section 6 stands.
2. **How chatty on Career Paths.** Superseded by the presence model in 3a: Coach is present everywhere, significant moments open it, ordinary moments respect minimized and quiet. Start with the full catalog for Bob and testers and tune by dismiss rate per family, not by guessing a count.
3. **Embedded panel beyond onboarding.** Confirmed, "100%." The panel is on every screen after Welcome (3a). This moves into Phase 1, since the presence model is the frame everything else sits in.
4. **Put It to Work routing copy.** Confirmed. The Arrival moment there replaces the two-door pitch with this exact wording: "Is anything already moving — an application in, a referral, an interview on the calendar? If so, let's work that first. If not, we'll pick a direction and build from your brand." Taps: "Something's moving" / "Starting from scratch." Replaces the existing `orientation-route` line at `src/App.jsx:9085`; the two-door screen's own callout is retired in the same PR so the two pitches never coexist.

## Out of scope

The items Code listed in its §6 (untested Cart.com sections, clearing a field via chat, surgical edits in long fields, whether to raise thin Priorities) stay out. The structural backlog (server-side generation, streaming, diagnostics) stays parked per Bob's 2026-09-08 direction; nothing here depends on it.
