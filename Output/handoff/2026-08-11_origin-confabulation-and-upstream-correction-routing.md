# Brief: Origin-passage confabulation + upstream-first correction routing

**Date:** 2026-08-11
**Type:** Bug (data integrity / fabrication) + Feature (correction routing)
**Source:** Nikki Shull weekly-corrections finding, confirmed against her production session.

---

## Prompt for Code

Two related problems surfaced by one user (Nikki Shull) and confirmed in her stored profile. Apply this brief in **two separate PRs**: **PR 1 (Layer 1)** stops the Personal Brand analysis from fabricating a formative-origin story when the user gave no life history — the root fix, contained, ship first. **PR 2 (Layer 2)** adds upstream-first correction routing so a downstream correction of an upstream-rooted fact is fixed at the source instead of whack-a-moled across surfaces. Premise-verify each layer against current code before applying (the line numbers below are from 2026-08-11 and will drift). Run the full gate chain. Follow the gh flow. Layer 1's deterministic strip has an over-strip risk flagged inline — confirm the calibration decision with Bob before shipping if the premise-check shows it catching legitimate prose.

---

## Confirmed diagnosis (against production)

Nikki's stored `profile_state`:

- **`profile.lifeEvents` is empty** (`""`). No life-shaping experiences provided.
- No input field anywhere (values, passions, reputation, a long performance-review paste) mentions immigrant parents or a father's layoff. Both facts are **pure confabulation**.
- The mechanism: the model took a *real* theme present in her reputation data ("translate complex data into stories," "making complex ideas accessible") and **invented a biographical origin to explain it** — "grew up translating between immigrant parents and the systems they were navigating."

Correction log (ordered), which establishes the propagation and the regeneration behavior:

| time | surface | correction |
|---|---|---|
| 19:41:07 | Bridge Story (p6) | "…immigrant parents… I am not an immigrant." |
| 19:41:14 | Bridge Story (p6) | (duplicate — dead-button dupe, already fixed #372) |
| 19:44:01 | Bridge Story (p6) | "…watching my dad navigate a layoff after twenty-two years… not true." |
| 20:06:00 | Personal Brand (p3) | "My dad was not laid off. Let's remove that." |
| 20:10:18 | Personal Brand (p3) | "I do not come from immigrant parents." |
| 20:14:00 | Personal Brand (p3) | (duplicate) |

Two load-bearing findings:

1. **"Remove it" re-confabulates.** The 19:44 correction shows the Bridge Story's *first rewrite after* the immigrant-parents removal invented a *different* origin (the layoff). As long as the origin slot exists and the prompt asks for a "where this comes from" story with no material to draw on, a correction just swaps one fabrication for another. Correction-injection alone (correctionsBlock) cannot fix this class.
2. **Corrections don't flow upstream.** She corrected p6 twice; p3 still carried the fabrication independently (generated from the same empty analysis), so she had to correct it again at the source. This is the whack-a-mole Layer 2 removes.

Her stored outputs are **already clean** (post-correction regeneration; `outputs.p3_structured.origin` is null, prose is corrected). **No data cleanup required.**

---

## Root cause — REFINED after code trace (2026-08-11, Bob's two hypotheses, both confirmed)

**A. Latent worked-example bleed, not only confabulation.** The generation prompts carry embedded worked-example personas with full formative stories, and an empty origin slot pulls from them:
- SYS_BASE contains exemplar personas — **Pia Lopez**, a **Sacramento food-bank** story, a **caregiving-years gap**, **grant cycles** — proven by the `contamination-*` HARD_PATTERNS (`src/voice-patterns.mjs` / `scripts/test-voice-patterns.mjs`) + `applyContaminationPlaceholders` recovery in the voice gate (App.jsx ~646–657, Foundation B.1 / PR #85), which exist *specifically* to catch these exemplars leaking into real output.
- Nikki's "dad laid off after **twenty-two years**" is **verbatim the Sarah Chen demo persona** (`src/demoData.js:81`; mirrored in `src/data/user-guide/focus-playbook.md:126`).
- **The existing guard is a name/exact-phrase blocklist**: it scrubs only the specific exemplars it was tuned to, and only their *names* (→ "[the user]"). It does **not** cover story content, and does **not** include Sarah Chen — so it caught nothing here. That is exactly why the *name* never leaked but the *origin story* did.
- "Immigrant parents" appears **nowhere in the codebase** → pure confabulation. So the empty origin slot is filled by **either** a bled example **or** a fresh invention — same failure, two fill sources.
- **Honest limit:** I could not locate the exact code path that puts the Sarah Chen *demo* input into a *real* generation (`demoProfile` loads only in demo mode; her stored `lifeEvents` is empty; her story is not in SYS/p3 prompts). Either the model reaches for a formative-story template that lands on the demo phrasing, or there is a demo→real state path not visible in static code. The *class* (latent example filling an empty slot) is proven; the precise channel for this one token is not. **A code-reachability audit of SYS + demo + guide exemplar content vs. the real generation context is a task in itself (see Hardening below).**

**B. Copy-paste corrections re-feed the fabrication as fact (Bob's H2).** `correctionsBlock` (App.jsx:4017) renders each correction **verbatim** as `- <text>` under *"Treat each as established, ground-truth fact… where it differs from the resume it takes precedence."* Nikki corrected by **quoting the fabricated sentence in full** ("This part is wrong - I grew up translating between my immigrant parents… I am not an immigrant."). So the fabrication is injected back as an apparent ground-truth fact with only a short trailing negation — the model can absorb the quoted lie as input (the "doubling down"), and it **compounds** the empty-origin refill because the corrections block now literally contains "immigrant parents" as apparent input on the next pass. The strengthened forbidden-clause (#373) is fighting the fabrication's own verbatim presence in the correction text.

---

## Data-flow facts (verified 2026-08-11)

- Personal Brand generation (`generate p3`, ~App.jsx:5894–5899): `analysis = callClaude(P.p3analysis(pc)…)` (the hidden "Reading your inputs" synthesis) → `P.p3(analysis)` renders it, capturing structured output via `onStructured`.
- `P.p3analysis` (~App.jsx:2297): asks for "who they are, **where it comes from in their life**, how it shows up in their work, the edges, where they're pointed next." Reads `pr.lifeEvents` (~2328–2329, shows `not provided` when empty). Already carries "Ground everything in the materials. Don't invent specifics" — **instruction-only, and it failed here.**
- `P.p3` structured schema (~App.jsx:2378, 2387): `"origin": { "body": "<second-person formative-origin passage>" }`; instruction "If the analysis has no such passage, set origin to null. **Never invent one.**" — also instruction-only.
- `normalizePresentation` (~App.jsx:520–569): the deterministic post-processor for the p3 structured object (already hosts the numeric-grounding guard). Operates on the structured object; `pc.lifeEvents` is available in the **caller** (the generate closure), not inside `normalizePresentation` — so the empty-input gate is applied at the call site or passed in as a flag.
- `SECTION_UPSTREAMS` (~App.jsx:5722): `{…, p5:['p3'], p6:['p3'], p7:['p3'], p8:['p3','p6'], p11:['p3','p6'], p_res:['p3'], income:['p3','p8'], …}` — Personal Brand feeds seven downstream surfaces.
- `sanitizeUpstreamForSection` (~App.jsx:5740): passes the full upstream output to a downstream prompt unless the upstream is marked stale (then a placeholder). This is the propagation channel **and** the re-propagation mechanism Layer 2 reuses.
- `recordCorrection` / `correctionsBlock` (~App.jsx:3793): corrections are captured per-section and injected into all generation paths.

---

## LAYER 1 — Prevent origin confabulation (PR 1, ship first)

### 1a. Analysis instruction (`P.p3analysis`, ~App.jsx:2297)

Add an explicit, load-bearing rule (place near the existing "Ground everything in the materials" line):

> FORMATIVE ORIGIN — NO PROVIDED HISTORY, NO ORIGIN: the "where it comes from in their life" thread is drawn ONLY from life-shaping or formative personal history the person actually provided. If no such personal history is present in the materials, do NOT construct an origin, backstory, childhood, family, or "where this comes from" narrative of any kind. State the brand from the work history, values, and reputation evidence alone. A real theme does not need an invented personal origin to explain it. Never manufacture a personal-history detail (family, upbringing, a formative hardship) to ground a theme, and if a correction removes such a detail, do not replace it with a different one — leave the origin out.

Voice check: no banned constructions (no logic-flip, no comparative standing, no coaching register). "A real theme does not need an invented personal origin" is declarative instruction, not user-facing output — not subject to the voice gate, but clean regardless.

### 1b. Deterministic backstop (detection — the robust layer)

The instruction above is necessary but, per this very case, **not sufficient**. Add a deterministic gate at the p3 generation call site (where `pc.lifeEvents` is in scope), applied on **every** p3 build/regen:

- Compute `hasFormativeInput = !!(pc.lifeEvents && pc.lifeEvents.trim())`. (Optionally widen later to include an explicit formative-history signal in other fields; start with lifeEvents — it is the origin's declared source.)
- When `!hasFormativeInput`:
  - Force `structuredP3.origin = null`.
  - Strip from the hero/sections prose any sentence making a **first-person biographical-origin claim** — a curated pattern set, e.g. `/\b(grew up|as a child|my (father|mother|dad|mom|parents|family)|immigrant parent|raised by|came from (a )?(immigrant|working-class|…))\b/i` scoped to sentences that assert personal/family history. Re-run the existing dedup/whitespace cleanup after the strip.

**Over-strip risk (Bob's calibration call):** a curated biographical-origin pattern set can catch a legitimate sentence in an edge case. Two dials: (i) only strip when `lifeEvents` is empty (high-precision context — if they gave no history, any first-person family-origin claim is by definition unsupported); (ii) keep the pattern set narrow and biographical (family/upbringing/formative-hardship), not thematic. Recommend shipping with (i)+(ii) and logging what it strips (a voice-event style counter) so we can watch precision. **If premise-check shows the pattern catching legitimate prose in existing users, surface to Bob before shipping the strip** — the instruction (1a) + `origin=null` force may be enough on their own for round one.

### 1c. Regeneration guard (falls out of 1b)

Because 1b runs on every build, a corrected origin cannot be replaced by a fresh confabulation on the next pass — which is the specific failure the 19:44 rewrite showed. No separate change needed; just ensure the gate is in the shared p3 path, not only the first-run path.

### Layer 1 gates

`npm run build` clean (voice 0/0, check-sys-equality, check-prompt-refs, check-coach-nav-map, check-fontsize, check-user-guide-pdf, all suites, lint, Vite). Add a unit assertion: given a profile with empty lifeEvents and a structured p3 whose origin/hero asserts family history, the gate nulls origin and strips the biographical sentence; given non-empty lifeEvents, it leaves both intact.

### Layer 1 out of scope

No change to correctionsBlock, no change to other sections' prompts, no Layer 2 routing.

---

## LAYER 2 — Upstream-first correction routing (PR 2, separate)

### 2a. Attribution check

On submit of a correction to any section that has upstreams (`SECTION_UPSTREAMS[sectionId].length > 0`), run a small focused model call before recording:

- Input: the correction text, the section's own output, and the current upstream output(s).
- Ask (semantic, not string-match — "dad was laid off" appears upstream as "watched his father navigate a layoff"): does the fact being corrected also appear in, or derive from, an upstream section? Return `{ upstreamRooted: bool, upstreamId, evidence }`.
- Keep it cheap and non-blocking; on failure/timeout, fall through to current behavior (fix in place).

### 2b. Route-to-source UX (recommend, don't force — preserves Agency)

If `upstreamRooted`:

- Surface a non-blocking offer, distinct-treatment callout (CoachingCallout per the instruction-visual-treatment rule): *"This detail comes from your {upstream label}. Fixing it there stops it from coming back everywhere it's used. Update your {upstream label} now, or just fix it here?"* → **[Update {upstream}]** / **[Just fix here]**.
- **[Update {upstream}]**: record the correction against the **upstream** section (so `correctionsBlock` binds it on the upstream rebuild), mark downstream sections stale via the existing staleness mechanism, and route the user to the upstream surface to rebuild.
- **[Just fix here]**: current behavior unchanged.

Do NOT silently reroute or force a rebuild — not every downstream correction is upstream-rooted, and forcing a full Personal Brand rebuild for a local edit would be worse than the disease.

### 2c. Re-propagation

No new machinery — the corrected upstream, once rebuilt, flows to downstream through `sanitizeUpstreamForSection`'s normal (non-stale) pass.

### Layer 2 notes

- "Fix at the source" ≠ discard the user's Personal Brand: the correction is a binding forbid-fact on the next pass, and the creative brand is regenerated with it applied, not thrown away.
- Docs/coach: if the routing changes user-visible behavior (a new prompt on correction), update the user guide + FEATURE_MAP in the same PR per the standing docs rule.
- This generalizes beyond fabrication — any upstream-rooted correction benefits — and is the structural answer to the recurring "corrections don't stick across regens" complaint ([[project_reimagine_feedback_batch_aug11]], Magnus case), which we have only patched at the prompt level so far.

---

## LAYER 3 — Correction capture must not re-feed the flagged text as fact (PR 3, from Bob's H2)

When a user flags something as wrong by quoting it, the quoted fabrication must be treated as a **removal target**, not re-injected as ground-truth fact. Options (pick per Bob):
- **Capture-side (preferred):** the correction affordance separates two fields — "what's wrong (the text you're flagging)" vs. "the correction (what's true / remove it)". Store them distinctly on the correction record. `correctionsBlock` then renders the flagged text under a *forbidden/remove* framing and only the correction under *ground-truth fact* — never the flagged fabrication under "treat as fact."
- **Injection-side (lighter, no UX change):** in `correctionsBlock`, detect the "this is wrong / not true / remove that: <quote>" shape and split it — route the quoted span to the forbidden list, not the ground-truth list. Less robust than capture-side (pattern-dependent) but ships without a UI change.
- Either way: a correction whose text contains a phrase the user is rejecting must never land under "treat each as established, ground-truth fact."

This is a distinct fix from Layer 1 and directly explains why Nikki's corrections partially failed (the immigrant-parents phrase rode back in via her own correction text).

## HARDENING — exemplar contamination (folds into PR 1 or its own)

- The SYS/demo/guide worked-example personas (Pia Lopez, the food-bank story, the caregiving gap; Sarah Chen's layoff) are a proven bleed source. The `contamination-*` guard is a per-phrase blocklist — whack-a-mole, and it missed Sarah Chen entirely.
- Action: (a) **audit reachability** — confirm exactly what exemplar content the real p3/p6 generation context can see (SYS exemplars are in-context every call; verify the demo/guide are NOT reaching real generation, which the static trace suggests but did not prove); (b) consider **fencing/abstracting** the in-prompt worked examples so their vivid formative specifics (a 22-year layoff, a caregiving gap) can't be lifted whole; (c) **generalize the detection** beyond a name/phrase blocklist toward the Layer-1 structural approach (an origin the user's inputs cannot support is dropped, whatever its source).
- Layer 1 already neutralizes the *impact* (no origin when no input), so this hardening is defense-in-depth, not the primary fix.

## PR structure

1. **PR 1** — Layer 1 (prevent origin confabulation) + the exemplar reachability audit. Ship first.
2. **PR 2** — Layer 2 (upstream-first correction routing).
3. **PR 3** — Layer 3 (correction capture separates flagged-text from correction).
Order 1 → 3 → 2 is also reasonable (3 is small and stops corrections from re-feeding fabrications); Bob's call.

## Commit messages

**PR 1:** `Personal Brand: never fabricate a formative origin when no life history is given`
**PR 2:** `Corrections: route an upstream-rooted downstream correction to its source`
**PR 3:** `Corrections: treat flagged-as-wrong text as a removal target, not ground-truth fact`

## Push

Direct to `main`; Vercel auto-deploys. Two PRs, not one.
