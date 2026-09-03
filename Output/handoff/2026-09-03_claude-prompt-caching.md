**Prompt for Code.** Read the Pre-flight discovery section below before touching anything — it corrects the framing this brief started from. Then implement Phase 1 only (the six prompt builders in the RAW SIGNALS family), premise-verify against the current file before editing, run the static gates, and follow the gh flow in CLAUDE.md §9. Phase 2 (`p3analysis`) and Phase 3 (extending past the RAW SIGNALS family) are out of scope for this PR — flag them back rather than pulling them in.

## Date / Type / Source

2026-09-03. Follow-on from `api/coach.js`'s prompt-cache fix (PR #687, merged), itself triggered by an Anthropic console notification: Career Club's direct API traffic has a low prompt cache hit rate, up to 11% of spend recoverable. `api/coach.js` was fixed. This brief scopes the larger, second half — `api/claude.js`, the surface behind Personal Brand, Role Options, Deep Dive, Go-to-Market, LinkedIn Remix, Industry Background, and Interview Prep.

Source: my own investigation this session, not a Cowork-Claude draft. Written up as a brief anyway, deliberately, because §8's corollary applies here in spirit even though nothing is flag-gated: this touches prompt text on every generation surface for all 145 accounts, and a same-session edit across eight giant voice-tuned templates with no review checkpoint is exactly the kind of change the brief format exists to slow down.

## Pre-flight discovery — the original framing was wrong on two counts

Last session I told Bob: *"the client concatenates resume + Personal Brand + RAW SIGNALS into one flat string with no internal breakpoint... restructuring the P object to separate the stable profile substring from the per-step instruction text."* That undersold the actual work in two ways, found by reading the P object in `src/App.jsx` (not guessed):

**1. The profile material is not a clean prefix in any builder today — it's interleaved mid-template.** I read `p4`, `p7`, `p8`, `p9`, and `p11` in full. Every one of them opens with hundreds to thousands of words of prompt-specific instruction (voice rules, epistemic calibration, output schema, format requirements) *before* the RAW SIGNALS block appears, and most also have instructions *after* it that reference it inline (`p9`: *"Cross-reference the RAW SIGNALS (especially PASSIONS AND CAUSES...) against..."*). Turning this into a real cache prefix means **reordering each builder's template** so the profile content is emitted first and the instructions follow — not extracting a shared constant and leaving everything else alone. That's real prompt-editing work per surface, not a mechanical string split.

**2. The profile content is not byte-identical across every prompt builder — only within one family.** Two distinct shapes exist:
   - **The RAW SIGNALS family** (`p4`, `p7`, `p8`, `p8_about_regen`, `p8_skills_regen`, `p9`, `p11`, `p11_question_regen`) — eight builders that already emit the same labeled fields (`VALUES:`, `PASSIONS AND CAUSES:`, `PRAISE THEY RECEIVE:`, `WHO CALLS THEM IN EMERGENCY:`, `HOW PEOPLE DESCRIBE THEIR SUPERPOWER:`, `OTHER REPUTATION DATA:`, `LIFE-SHAPING EXPERIENCES:`, `VALIDATED HARD SKILLS:`) in the same all-caps label format. This is the group CLAUDE.md §5 already calls "canonical field labels."
   - **`p3analysis`** (Personal Brand, stage one) — a different shape entirely. Its `MATERIALS` block adds `RAW ASSESSMENT` and `LINKEDIN` (absent from the RAW SIGNALS family), folds reputation into joined prose (`"Praise they receive: X\nWho calls them in an emergency: Y"`) rather than four separate all-caps lines, and is structured around `pr.assess`/`pr.resume`/`pr.linkedin` rather than the RAW SIGNALS label set. It does not currently belong to the shared-format group, and forcing it in is a separate, larger content decision (which of its extra fields, if any, join the canonical block) that this brief does not make.

**What this means for scope:** the realistic win is not "one shared block, every generation type, always." It's a canonical profile block reused **within the RAW SIGNALS family**, across regenerations and across different prompt types in that family, in one sitting. `p3analysis` (and `p5`, which also doesn't match the RAW SIGNALS grep and wasn't traced in this pass) are out of scope for Phase 1.

**One more finding worth naming and not acting on:** even within the RAW SIGNALS family, the *exact set and order of fields* differs slightly between builders in what I read (`p4` includes `RESUME`/`PERSONAL BRAND` ahead of RAW SIGNALS; `p9`'s excerpt above did not show an explicit `RESUME`/`PERSONAL BRAND` block at all — it may use `outs` differently). Confirming the true canonical shape, or deciding to unify it, is Phase 1's first real task, not an assumption to build on.

## What's proven, so this isn't guesswork on top of guesswork

- `api/claude.js` currently accepts either `{ prompt: string }` (new format) or `{ messages: [...] }` (legacy), and wraps the system prompt with a `cache_control` breakpoint already — only the user-content side is unstructured. Confirmed at `api/claude.js:499-538`.
- The `coach.js` fix (PR #687) proved the mechanism works end to end in this codebase: a `cache_control` marker on a block that's actually stable between requests produces real reads, and the failure mode (unordered SQL feeding output text) is real and worth checking for here too if any part of the canonical block draws from a live query rather than the static profile passed in from the client.
- Minimum cacheable prefix for `claude-sonnet-5` is 1024 tokens (`shared/prompt-caching.md` in the `claude-api` skill, API reference table). A canonical profile block needs to clear that on its own to be worth a breakpoint — thin profiles (early in Orientation, few reputation answers) may not, and that's fine: no marker fires, no harm, just no win on that account yet.

## Recommended Phase 1 scope

1. **Design the canonical profile block** for the RAW SIGNALS family only. Confirm the true current shape across all eight builders (not just the five read this session) before designing — this is the premise-verification step for whoever implements.
2. **Move it to the front** of each of the eight builders' template, ahead of that builder's own instructions. Everything currently before it in each template moves after the block; nothing in the instructions themselves should need to change in meaning, only position — flag back if any builder's instructions can't be reordered without changing behavior.
3. **Change the request shape.** `api/claude.js` needs to accept the profile block and the instruction text as two separate pieces (e.g. `{ profileBlock, instruction }` alongside or replacing the current `prompt` string) and place `cache_control` on the profile block as the first `messages` content block, ahead of the instruction text in the same message or as an earlier one. Exact shape is an implementation decision, not fixed here — check `shared/prompt-caching.md`'s "Shared prefix, varying suffix" pattern before choosing.
4. **Keep the existing system-prompt breakpoint.** Render order is `tools → system → messages` — the profile-block breakpoint is a second, later breakpoint, not a replacement for the system one. Confirm total breakpoints stay within the 4-per-request ceiling (system prompt + profile block + whatever else, if anything).
5. **Verify, don't assume.** After shipping, check `usage.cache_read_input_tokens` on real regenerations and on a same-session sequence of different RAW-SIGNALS-family prompt types for the same account, the way #687 can only be confirmed against production traffic.

## Voice rules on inserted text

None of this brief's content ships to users — it only reorders and restructures existing prompt text. No new user-facing copy. The one thing to watch: reordering must not accidentally change *what the model is told first*, since some of these prompts rely on instructions being read before data (e.g., `p11`'s JD-context-first framing) — check each builder's own reasoning about order before moving text, not just moving it wholesale.

## Static gates

- `check-voice.mjs`, `check-prompt-refs.mjs` clean (prompt structure changes; `check-prompt-refs.mjs` walks the `P` object's `pc` cross-references, so a malformed template will be caught).
- `check-sys-equality.mjs` — unaffected if only the `P` object changes and `SYS`/`SYS_BASE` etc. stay untouched; confirm this stays true.
- Full `npm run test` and `npm run build` clean.
- New test: assert, for each of the eight RAW SIGNALS builders, that the profile block's rendered text is byte-identical for the same `pr` object regardless of which builder renders it — this is the actual claim Phase 1 is making, and it should be checked mechanically, the same way `test-coach-cache-blocks.mjs` checks the coach.js fix rather than trusting it.
- Preview smoke test (`npm run smoke:preview`) before merge, per CLAUDE.md §8 — this touches `api/claude.js`.

## Runtime gate (post-merge)

Pull `usage.cache_read_input_tokens` on a same-account, same-sitting sequence across two or more RAW-SIGNALS-family generations (e.g. Role Options then Interview Prep for one test account) and confirm the second call reads the first call's profile block. `api/_lib/budget.js`'s existing spend tracking will also show the effect in aggregate over the following days, the same way #687's effect should show there too.

## Constraints

Single PR for Phase 1 (the eight builders + `api/claude.js`'s request shape). No effort estimates. PR title states what changed, not that it "improves caching" in the abstract — name the mechanism, per this session's own PR titles tonight.

## Out of scope

- `p3analysis` and `p5` — different profile shape, not addressed here.
- Unifying `p3analysis`'s fields into the canonical RAW SIGNALS block — a real content decision (whether `RAW ASSESSMENT` and `LINKEDIN` belong in a shared block used by prompts that don't currently see them) that needs its own sign-off, not folded into a caching PR.
- Any change to what the model is told, only when/how it receives it. If reordering surfaces a case where the current instruction order is load-bearing and can't be preserved after moving the profile block first, stop and flag rather than changing the instruction's meaning to make the reorder work.

## Commit message

Left to the implementer — this brief is scoping, not final copy. Should name the specific mechanism (canonical profile block, front-loaded, cache_control breakpoint) the way tonight's `coach.js` and CI-smoke commits did, not "improve caching."

## Push

Branch, PR, CI, squash-merge per CLAUDE.md §9 / this session's gh flow. Preview smoke required before merge (touches `api/*`). Not gated behind a feature flag — this reaches all 145 accounts on merge, so it needs the same "no ungated change beyond the stated scope" discipline as everything else, and the runtime gate above should be checked before calling it done, not just the static gates.

## Implementer's checklist

1. Pull latest `main`.
2. Re-read all eight RAW SIGNALS family builders in full (this brief only traced five) and confirm the canonical block's true current shape — do not assume `p4`'s shape is universal.
3. Design the canonical profile block format. If any builder's existing field selection genuinely can't be reconciled with the others without changing what the model sees, flag it back rather than silently picking one.
4. Reorder each builder's template so the block is first.
5. Change `api/claude.js`'s request handling to accept the two-part shape and place the breakpoint correctly.
6. Write the byte-identity test.
7. Run static gates, full build, preview smoke.
8. Open PR, watch CI, squash-merge once green.
9. Report PR URL + merge SHA, then schedule (or do) the runtime-gate check against real `usage.cache_read_input_tokens` data.
