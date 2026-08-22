# Priorities Check — score a logged offer against Practical Priorities (Offer & Negotiation, Phase 2)

## Prompt for Code

Apply this brief to add a **Priorities Check** to the Opportunity Playbook's Offer & Negotiation card: a read on how a logged offer lines up against what the person said mattered in the Practical Priorities Orientation step (Phase 1, PR #307). This is where the compensation floor and commute/remote needs do their real work — held out of exploration on purpose, they come back here against a concrete offer. Phase 2 of the offer-negotiation Orientation workstream; Phase 3 (benefits intake + multi-offer comparison) is a separate brief and out of scope. **Premise-verify every anchor below against current `main` first** (line numbers from `e5a23ae` will drift). Run the static gates, do the runtime validation, push to `main` per the standing gh flow, report PR URL + merge SHA.

## Date / Type / Source

- **Date:** 2026-08-07
- **Type:** New generated read on an existing surface (Offer & Negotiation card). One prompt, one generate function, one render block, one lazy cache field. No schema bump, no new plumbing.
- **Source:** Cowork-Claude decisions/scope-update consult §3 ("a read of the same fields at `offerStage` time to score a real offer against what the person said mattered before they saw a single job description"), reconciled with Claude Code. Phasing confirmed with Bob.

## Pre-flight discovery (verified against `e5a23ae`)

All inputs already exist:
- **The logged offer**: `rec.offerStage.offer` (structured, 34 fields, from the offer-letter parser — PR #305/#306), plus the free-text fallback `rec.sections.offerNegotiation.offerAmount`. `offerSummaryFromStruct(offer)` (`src/App.jsx`, near the parser helpers) already flattens the structured offer to a labeled string.
- **The five Practical Priorities fields** on `profile`: `compFloor`, `workReq`, `benefitsWeight`, `riskTolerance`, `dealBreakers` (PR #307). `dealBreakers` + `riskTolerance` are also on `pc`; `compFloor`/`workReq`/`benefitsWeight` are **profile-only by design** (kept out of the prompt path in Phase 1) — Phase 2 reads all five directly from `profile`, which is correct: at offerStage they score a concrete offer, they do not steer exploration.
- **Company context** for the deal-breaker / stability checks: `rec.company`, the inferred industry on `rec.sections.companyRead.industry`, and the built `rec.sections.companyRead.content` (ownership/size/stability signal) when About This Company has been built.
- **The Offer & Negotiation card** render (`section-offerNegotiation`, `src/App.jsx`) and its generate-function pattern (`generateOpOfferNegotiation`, request-race guard, `opSectionBuilding`/`opBuildingSlot`/`opSectionErrors`) are the models to mirror. `offerStage` is lazy-init (no schemaVersion bump — the op surface guards on `===2`); add `offerStage.priorityCheck` the same lazy way.

## What it produces

A plain read, one short line per priority the person actually filled in (skip blanks), of how this specific offer measures against it — surfacing conflicts and any deal-breaker hits first. It is informational and agency-preserving: it never says take it or leave it, only how the offer lines up with what they told us mattered. No numeric score (spurious precision); a clear per-priority read instead.

Worked shape (illustrative):
> **This offer meets most of what you said you needed, with two things to weigh.**
> - **Compensation floor ($150k):** the $148,000 base is just under, but the $15,000 sign-on clears it in year one.
> - **Remote (remote only):** a conflict — this role is hybrid, two days onsite.
> - **Stability (you lean stability):** aligned — an established, profitable company.
> - **Deal-breakers (no PE-owned):** flagged — About This Company indicates the firm is PE-backed. Worth confirming.

## The prompt: `P.priorityCheck`

New builder in the `P` object (inside the `voice-allow` region), modeled on `P.offerNegotiation`'s discipline. Draft (Bob-reviewable copy):

```
priorityCheck:(offerText,priorities,companyContext)=>`You are checking how a specific job offer lines up against what this candidate said mattered to them, before they saw any offer. This is informational: show how the offer measures against each stated priority. NEVER advise whether to take or reject the offer — the decision is theirs.

THE OFFER ON THE TABLE:
${offerText||'(no offer details provided)'}

WHAT THE CANDIDATE SAID MATTERED (their Practical Priorities; only address the ones that are filled in — skip any marked "(not set)"):
${priorities}

${companyContext?'ABOUT THE COMPANY (for the deal-breaker, ownership, size, and stability checks):\n'+companyContext+'\n':''}
RULES:
- Address ONLY the priorities the candidate actually stated. Do not invent priorities they did not name.
- Compare plainly. For the compensation floor, weigh base plus any sign-on/bonus the offer states against the floor, and say whether it clears it. For commute/remote, compare the offer's location and remote terms against the requirement. For stability vs upside, use the company signal if present. For deal-breakers, check the offer and company against each named deal-breaker and flag any that appear to be hit — as something to confirm, not a verdict.
- Lead with any deal-breaker hit or hard conflict (comp under floor, remote requirement not met). Then the rest.
- If a check needs company information that is not provided, say what to confirm rather than guessing.
- Plain and direct. No AI-coaching register, no comparative standing, no logic-flip cadence, no typology labels.

OUTPUT: one bolded headline sentence summarizing how the offer lines up overall, then one short line per stated priority (a "- " list), each naming the priority and how the offer measures against it. Keep it tight, 90-160 words. No verdict on whether to accept.`
```

Not citation-gated (no external market claims — it compares the candidate's own offer to their own stated priorities). Routes through the normal voice gate, `step:'op-priority-check'`.

## Generate function: `generateOpPriorityCheck`

Model on `generateOpOfferNegotiation`. Build the inputs:
- `offerText`: `offerSummaryFromStruct(rec.offerStage?.offer)` if present, else the free-text `offerDrafts[slot]` / `rec.sections.offerNegotiation.offerAmount`. If neither, error: "Add your offer above first (upload the letter or type the numbers), then check it against your priorities."
- `priorities`: a labeled block built from `profile`, one line per field, marking empties as "(not set)":
  `Compensation floor: <compFloor or (not set)>` / `Commute or remote needs: <workReq>` / `How much benefits weigh: <benefitsWeight>` / `Stability vs upside: <riskTolerance>` / `Hard deal-breakers: <dealBreakers>`.
  If **all five** are empty, error with a pointer: "You haven't set any priorities yet. Add them in the Practical Priorities step of Orientation, then come back." (link/nav to the `priorities` step).
- `companyContext`: `rec.sections.companyRead?.content` (trimmed, capped ~1500 chars) when built, plus `rec.company` + `rec.sections.companyRead?.industry`; else empty.
- Cache to `rec.offerStage.priorityCheck = {content, builtAt}` (lazy-init `offerStage`, no schema bump). Same request-race guard + `opSectionBuilding` state as the sibling cards.

## Render

New block inside the Offer & Negotiation card, below the parsed-offer readout / the negotiation guidance. A `_head`-style row: title **"Priorities Check"** (Bob-reviewable), sub "How this offer lines up with what you said mattered — your comp floor, deal-breakers, and the rest." Build/Rebuild button → `generateOpPriorityCheck()`. Render `<MD text={rec.offerStage.priorityCheck.content}/>` in an `S.out` card when built; `ErrBox`/`Loading` as the siblings do. Soft-pointer states: if no priorities set, show the nudge to the Priorities step; if no offer, the "add your offer first" nudge.

## Voice rules on inserted text
All new copy + the prompt pass `check-voice` 0/0. The prompt sits in the `voice-allow` region. Hold the agency line hard: never a take-it/leave-it verdict.

## Static gates
- `npm run build` clean; `check-voice` 0/0; App.jsx EOF integrity; diff scope limited to `src/App.jsx` + the guide (`11b`). No `api/*`, no schema.

## Runtime gate
Real-gen against a logged offer with a few priorities set: confirm it (a) addresses only the filled priorities, (b) correctly reads comp base+sign-on against the floor, (c) flags a remote-requirement conflict, (d) flags a named deal-breaker using the company read when present, and (e) never issues an accept/reject verdict.

## Constraints
- Single PR. No effort estimates. PR title: `Offer & Negotiation: Priorities Check — score a logged offer against Practical Priorities`.

## Out of scope (this PR)
- Phase 3: structured benefits intake + the multi-offer comparison view + the benefits-value delta line.
- Any change to how Practical Priorities are captured (Phase 1), the parser (shipped), or the market-facing comp read / negotiation guidance.
- The `api/coach.js` profile-block mirror — still deferred; but since Phase 2 is the offerStage phase, **this is the moment to honor the Phase-1 reminder**: see Open Items.

## Open items Code should confirm with Bob before merging
1. **Per-priority list vs freer narrative** — brief specs a one-line-per-stated-priority read with conflicts first (recommended, since Bob wants comparisons legible, not blended). Confirm.
2. **Trigger** — manual Build button (recommended, consistent with every other op card) vs auto-run after an offer is parsed. Confirm.
3. **Coach mirror (the Phase-1 reminder comes due)** — Phase 2 is the offerStage phase, so it's the natural point to mirror `dealBreakers` + `riskTolerance` (and, if desired, a summary of the logged offer) into `api/coach.js`'s hand-copied profile block so My Coach can reason about the person's non-negotiables and offer. Touching `api/*` triggers the preview smoke test (`curl /api/health` + `/api/claude`), so if included, run it. Recommend including it here; confirm with Bob.

## Commit message
```
Offer & Negotiation: Priorities Check — score a logged offer against Practical Priorities

Phase 2 of the offer-negotiation Orientation workstream. Adds a Priorities
Check to the Offer & Negotiation card: a read on how a logged offer lines
up against the five Practical Priorities the person set in Orientation.
This is where the compensation floor and commute/remote needs do their
real work — held out of exploration on purpose, scored here against a
concrete offer.

- P.priorityCheck: informational read, one line per stated priority
  (skips blanks), conflicts and deal-breaker hits first, never a
  take-it/leave-it verdict. Not citation-gated (own offer vs own stated
  priorities). Uses the parsed offer (offerSummaryFromStruct) or the
  free-text fallback, and the About This Company read for the ownership/
  size/stability checks when built.
- generateOpPriorityCheck + a render block on the card; cached lazily on
  rec.offerStage.priorityCheck (no schemaVersion bump).
- Guide (11b) updated.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

## Push
Direct to `main` via the standing gh flow. Report PR URL + merge SHA.

## Implementer's checklist
1. Pull `main`; premise-verify anchors (`offerStage.offer`, `offerSummaryFromStruct`, the five `profile` fields, the Offer & Negotiation card render, `generateOpOfferNegotiation` pattern, `companyRead` section shape).
2. Add `P.priorityCheck`; add `generateOpPriorityCheck`; add the render block + soft-pointer states.
3. If including the Coach mirror (open item 3), update `api/coach.js`'s profile block and run the preview smoke test.
4. Update `11b` guide.
5. Static gates + EOF + diff-scope.
6. Runtime gate real-gen.
7. Push to `main`; report PR URL + merge SHA.
