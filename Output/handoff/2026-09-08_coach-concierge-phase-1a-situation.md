## Prompt for Code

Apply the changes in this brief once Bob approves it. Premise-verify against the current `main` SHA before touching anything (state has already moved once today), run the static gates, follow the gh flow in CLAUDE.md §9, and report the PR URL and merge SHA. This brief is not yet approved — it is being sent back for review per the design doc's own instruction, so do not start until Bob says go.

---

## Date / Type / Source

2026-09-08. Implementation brief for Phase 1a, drafted by Code per Cowork's design (`Output/handoff/2026-09-08_coach-concierge-design.md`) and Bob's same-day split of Phase 1 into 1a (this brief) and 1b (embedded panel on every screen, separate brief, separate flag). Written against `main` at `af22bb7`.

Scope, exactly as confirmed: the Situation object, the server-side `SITUATION` block, in-focus expansion keyed off `situation.record` with the existing title-match as fallback, and the section currently in view. No UI change — no panel, no Moments, no new proactive turns. Also folds in the two Section 7 verification tasks from the design (Life Story re-test, Personal Brand rework trace) and the voice finding, per Bob's instruction that these are verification tasks riding in this brief, not new mechanisms.

## Pre-flight discovery (scope correction)

Every load-bearing claim in the design's Section 2 was checked directly against `main` at `af22bb7`, not assumed:

- **Confirmed exactly, including the quoted text:** the bare context line (`api/coach.js:1758`, `const contextNote = currentStep ? ...`), `coachSaveTarget()`'s door2-only filter (`src/App.jsx:10989`), `findInFocusRecord`'s six-character title match (`api/coach.js:1371`), the two-door routing question's exact wording (`src/App.jsx:9085`), the client's 409→`'stale'` handling (`src/App.jsx:9472`), and all 15 `openCoachWith` call sites (confirmed by direct count, not the design's estimate).
- **Confirmed real, all four PR citations:** `#784` (confirm-only-after-write, real, `a903313`), `#793` (offer arbitration, real, `0800613`), `#802` (the *original* staleness-precondition PR, "Load-success gate and staleness precondition on the profile autosave," real, `34996d7`), `#808` (trimmed-prompt/effort-low for silent turns, real, `cf2bded`). `#802` is the mechanism; `#812` (`c25a70b`, today) is the fix to the specific rounding bug inside it — consistent with Bob's resolution earlier today, not new information, just confirmed against git history.
- **Minor, does not affect this brief's scope:** "eighteen `seen*` flags" is accurate as a raw identifier count in `src/App.jsx`, but three of the eighteen (`seenFirms`, `seenUn`, `seenDomains`) are unrelated local dedup variables inside company-matching helpers, not Coach-presence flags. The real count relevant to Phase 4's later migration is ~15. Flagging for whoever drafts Phase 4, not actionable here.
- **Two real drifts that change this brief's shape:**
  1. **"Section in view" has no existing signal to read.** The design's Situation shape assumes it; today the client only knows which section a person was looking at at the *moment* they tapped one of the 15 `openCoachWith` sites (`returnSection`), and several of those pass no section at all. Someone typing ordinary chat in the embedded panel without tapping one of those buttons gives the server nothing — there is no live "what's scrolled into view" signal. The design's own Phase 1 success test ("'what do you think of this bridge story' typed on the Bridge Story screen gets a reply about that bridge story") requires this signal to exist for the common case, not just the button-seeded one. This brief adds a minimal `IntersectionObserver`-based `visibleSection` tracker to close that gap — new client logic, no visible element, no new Coach chatter, consistent with "no UI change" in the sense the design means it (no panel, no proactive turns). Flagging explicitly since it is marginally more scope than "wire existing signals together" — say if you'd rather defer this and ship Phase 1a with `section` populated only on button-seeded turns.
  2. **"Client already has `describeSections`" is close but not quite right.** The function exists and does exactly what's needed (`src/playbook-sections.js:148`), but it is currently imported only server-side (`api/coach.js`), not into `src/App.jsx`. This is an ordinary `src/` → `src/` import — not the api/↔src/ `.mjs` hazard from CLAUDE.md §8, which is specifically about `api/*` importing `src/*` at function-invocation time. `NAV_LABELS` is already imported this same way from `src/nav-labels.js` into both `api/coach.js` and `src/App.jsx`, so this is a one-line addition, not new machinery.
- **Confirmed, and it simplifies the fix:** `currentSavedSlotIdRef` (`src/App.jsx:7156`) already tracks the in-view record for *either* door — `nav()` (`src/App.jsx:10002`) only special-cases clearing it for a door2 record on leaving, and other read sites (`src/App.jsx:10958`) resolve it with no door filter at all. `coachSaveTarget()`'s `source==='door2'` filter is a deliberate narrowing for opportunity-specific chat-capture targeting (removing an Interview Team member, archiving, etc. — all genuinely door2-only concepts), not a limitation of the underlying tracking. `Situation.record` does not need new tracking; it needs its own resolution function that skips that filter.

## Section 7 verification tasks (folded in, not new mechanisms)

**(a) Life Story silent-save — one live task for Bob, one trace completed here.**

Live: re-test Life Story capture via chat on the current build (`main` post-`#812`) and record the result — this needs a browser and a signed-in session, which Code does not have in this environment.

Traced (code-only, no browser needed): tapping Coach's Brand Rework offer calls `submitCorrection('p3', note, proceed)` (`src/App.jsx:10282`, inside the `checkinKey==='brand-rework'` branch at `:8277`) — the *same* path the on-screen "Does this feel right?" Personal Brand correction box uses, not a separate mechanism. If `detectCorrectionConflict(note)` flags the text, the person sees the global conflict modal (`src/App.jsx:16889`, `position:'fixed'`, not gated to any screen) regardless of being on the Opportunity Playbook at the time — so a conflict is not silent, it interrupts. If there's no conflict, `proceed()` clears `p3` (`out('p3','')`) and calls `refreshP3` to regenerate. Two things worth watching for specifically in the live re-test, since they're what would turn this into the same silent-failure shape as Life Story: (i) the conflict modal's copy ("Your correction asks for...") is written for someone editing a section box directly, and may read oddly when it's triggered from a chat conversation about an opportunity — note if it's confusing in that context; (ii) whether Chat's confirmation bubble is tied to the regeneration actually landing, or fires before it resolves — that's the actual test for whether this bug class reaches Personal Brand rework too.

**(b) Voice finding, confirmed.** "Adding that to your Story now" (and any other completion-claim phrasing) violates the existing standing rule already in `SYSTEM_PROMPT_STABLE` — `NEVER SAY YOU HAVE SAVED, ADDED, LOGGED, MOVED, OR UPDATED` (`api/coach.js:468-469`). Checked `src/voice-patterns.js` HARD_PATTERNS directly: **no detector exists for this class at all.** Every other banned construction CLAUDE.md lists has a runtime detector; this one is in-prompt only, which is exactly the gap CLAUDE.md's own enforcement section warns about ("Voice rules need DETECTION, not just instruction"). Proposed detector shape for review, not built here: match present/past-tense completion claims about a write — `adding (that|this|it) to your`, `I've (saved|added|logged|updated)`, `logged that`, `saved to your` — tuned against a false positive like "I'm adding a thought" used non-completively. **Recommend this ship as its own small follow-up PR**, not bundled into 1a: it's an unrelated fix (a voice-gate coverage gap, not Situation/presence work), and it needs no flag — a HARD_PATTERNS block applies the same way to all 145 accounts as every other entry already does. Say if you want it built now instead of queued.

## Files affected

| File | Change |
|---|---|
| `api/_lib/feature-flags.js` | New `COACH_SITUATION_FLAG` (`coach_situation`) + `hasCoachSituation(user)` + `GRANTABLE_FLAGS` entry, matching the existing pattern exactly (`ONBOARDING_CONCIERGE_FLAG` is the closest sibling to copy from). |
| `src/App.jsx` | New `computeSituation()` (near `coachSaveTarget`, `:10989`) resolving `currentSavedSlotIdRef` on either door; new `visibleSection` state + `IntersectionObserver` effect (pending confirmation, see drift 1 above); import `describeSections`/`sectionsFor` from `src/playbook-sections.js`; pass `situation` as a new prop into every `<Chat>` mount. |
| `src/components/Chat.jsx` | Accept a `situation` prop; include it in the `/api/coach` request body (`:537-563`) alongside the existing `focusRecordId` — not replacing it this phase, so an old cached client bundle mid-deploy still degrades to today's behavior rather than sending nothing. |
| `api/coach.js` | Accept `situation` in the request body; when present and gated on (`hasCoachSituation`), use `situation.record.id` as the primary pin ahead of the existing `focusRecordId` param and `findInFocusRecord` (three-tier fallback: `situation.record` → `focusRecordId` → title-match scan); render a new `SITUATION` block, plain language, placed the way `contextNote` already is (`:1758`), built from `screen`/`record`/`section`/`built`/`notBuilt`/`justHappened`/`choice`; import `describeSections` (already the case) to render `built`/`notBuilt` from `situation.record`. |
| `src/playbook-sections.js` | No changes — consumed by `App.jsx` for the first time. |

Not touched: `src/data/user-guide/`, `src/coach-routing.js` / `FEATURE_MAP`. Reasoning, stated rather than assumed: Situation changes grounding *accuracy*, not a capability a user can name or ask Coach about — the same category as Phase 4's guide-narrowing and Phase 17's prompt-trimming, neither of which got a user-guide chapter or a Coach nav-map entry. Flagging this reasoning explicitly per CLAUDE.md §8's "no exceptions" docs rule, rather than silently skipping it.

## Specific changes

1. **`api/_lib/feature-flags.js`** — add `COACH_SITUATION_FLAG`/`hasCoachSituation` following the exact shape of `ONBOARDING_CONCIERGE_FLAG`/`hasOnboardingConcierge` (`:96-102`): internal accounts auto-granted, dashboard-grantable via a new `GRANTABLE_FLAGS` entry labeled "Coach situational grounding."

2. **`src/App.jsx`** — `computeSituation()`:
   - `screen`: current `step`/`stepOverride`, as already sent today.
   - `record`: `savedPlaybooks.find(x=>x&&x.id===currentSavedSlotIdRef.current)`, unfiltered by `source` (the fix over `coachSaveTarget()`), mapped to `{id, source, title, lane, company}`.
   - `section`: `visibleSection` (new tracker) when set, else the `returnSection` a button-seeded `openCoachWith` call carried, else `null`.
   - `built`/`notBuilt`: `describeSections(record, {independent, hasOffer})` when `record` is present, else `[]`/`[]`.
   - `justHappened`/`choice`: `null` in this phase — Phase 1a computes and sends the object every turn but does not yet populate these two fields, since nothing in this phase produces the events they'd describe (that's Phase 2's Moments engine). Sending them as `null` now, rather than omitting the keys, means the server-side shape is stable across Phase 1a → Phase 2 with no second schema change.
   - `visitCount`/`idleSeconds`: same reasoning — included in the shape, computed as real values (cheap, already in scope via existing nav tracking / a simple timer), even though nothing reads them yet, so Phase 2's Moments engine has real data from day one instead of a cold start.

3. **`src/components/Chat.jsx`** — add `situation` to the props destructure and to the `/api/coach` body object (`:537-563`), next to `focusRecordId`.

4. **`api/coach.js`** — accept `situation` from the parsed body; gate its use on `hasCoachSituation(user)` (ungated clients / non-flagged accounts fall through to exactly today's behavior — `focusRecordId` then `findInFocusRecord`); update the `pinned` resolution at `:1727-1729` to check `situation?.record?.id` first; add a `buildSituationBlock(situation)` function rendering the plain-language block from the design's Section 4 example, appended the way `contextNote` is today.

## Voice rules on inserted text

The `SITUATION` block is structural/factual (screen, record title, built/unbuilt names) — not persuasive copy — so the risk of tripping a banned construction is low, but it still becomes part of what the model reads and can echo back. Check it against the same gate as any other inserted prompt text: no logic-flip cadence, no typology labels, no comparative-standing phrasing, before merging.

## Static gates

`npm run build` clean: voice gate, prompt-refs, coach-nav-map (unaffected, per the "not touched" note above — confirm the gate agrees), fontsize/btn-prominence ratchets (no UI, should be a no-op), full test suite, lint, `vite build`. New test: `scripts/test-coach-situation.mjs` — pure re-derivation of `computeSituation`'s record-resolution logic (asserts it does NOT filter on `source`, unlike `coachSaveTarget`), the three-tier server fallback order, and source-presence checks on the new flag/GRANTABLE_FLAGS wiring and the `SITUATION` block's presence. App.jsx EOF integrity, before and after.

## Runtime gate (post-merge, Bob)

The design's own three-part Phase 1 success test, on a `@career.club` account with the new flag granted:
1. The pipeline-button question and the same question typed free-form produce comparably grounded answers on a real opportunity.
2. "What do you think of this bridge story," typed on the Bridge Story screen (no button tap), gets a reply about that specific bridge story — the direct test of the new `visibleSection` tracker.
3. The two Section 7 verification tasks above: Life Story capture re-test, and a Personal Brand rework offered from inside an Opportunity Playbook, watching specifically for the two things flagged in that trace.

## Constraints

Single PR. No effort estimates. Gated behind `COACH_SITUATION_FLAG`, `@career.club` first — per Bob's explicit instruction, overriding the design doc's Section 10 suggestion that Situation could ship ungated. PR title: `Coach-as-Concierge Phase 1a: Situation object and server-side grounding`.

## Out of scope

The presence-model UI (Phase 1b, separate brief, separate flag). The Moments engine and everything in Phase 2 onward. The voice-gate detector for completion-claim language (recommended above as its own small follow-up, not built here). Phase 4's `seen*`-flag consolidation. Everything in Code's own briefing §6 (untested Cart.com sections, clearing a field via chat, precise text edits, the Priorities proactive-raise question).

## Commit message

```
Add Coach's Situation object and server-side grounding (Phase 1a)

Gives Coach one shared answer to "what is this person looking at, what
is built, what isn't" -- computed client-side, sent on every turn, and
used to pin the in-focus record on either door (Career Paths included,
not just the Opportunity Playbook) instead of only when a purpose-built
button assembled that context. No new proactive turns, no UI change.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Qbsj3ds9Cfozte1ASdRrDx
```

## Push

Branch → PR → CI/smoke → merge, per CLAUDE.md §9. Not started until this brief is approved.

## Implementer's checklist

1. Pull latest `main`; re-confirm the SHA this brief was written against still matches, since state has moved twice today already.
2. Re-verify the two flagged drifts (`visibleSection` tracker scope, the `describeSections` import) are still the right call, or apply Bob's correction if the review changes them.
3. Apply the changes above.
4. Write `scripts/test-coach-situation.mjs`; register it in `package.json`.
5. Run `npm run build` clean.
6. Changelog: none required (internal grounding mechanism, not a shipped user-facing chapter — consistent with the "files not touched" reasoning above).
7. Branch, commit, push, PR, watch CI/smoke, merge (squash).
8. Report the PR URL and merge SHA.
