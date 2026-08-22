# Offer & Negotiation v2 — reshape the shipped module + add Coach negotiation knowledge

## Prompt for Code

Apply the changes in this brief to reshape the **already-shipped** Offer & Negotiation surface (PR #300, merge `0c205ae`) using the Career Club Corner negotiation material. This is a v2 reshape, **not greenfield** — premise-verify every anchor below against current `main` first (line numbers are from `0c205ae` and will drift). The move: pull the *stable* content out of per-user generation into static reference cards, enrich the *generated* ask with an evidence/ROI case drawn from the user's own STAR and Bridge Story content, and route the *judgment-call* content into My Coach via a new user-guide chapter plus one line of handoff copy at the friction point. Run the static gates (`npm run build` clean, `check-voice` 0/0, `check-prompt-refs`, `check-coach-nav-map` in sync, App.jsx EOF integrity), do the preview smoke described below, and push to `main` per the standing gh flow. Report the PR URL and merge SHA.

## Date / Type / Source

- **Date:** 2026-08-07
- **Type:** Reshape + additive. One surface (Opportunity Offer & Negotiation), one new guide chapter, one FEATURE_MAP touch.
- **Source:** Cowork-Claude consult "Offer & Negotiation module, sourced from Career Club Corner + MYOW negotiation content" (four Corner "Negotiating" decks + the 11-24-25 session transcript), reconciled by Claude Code against current `main` after PR #300 landed in the same session.

## Pre-flight discovery (scope correction) — read this first

The source consult was grounded against `9168f7b8` and asserted three things that are **false on current `main` (`0c205ae`)** because PR #300 shipped between the consult being written and this brief:

- Consult: "`salaryRead`… confirmed not merged… returns nothing." **Now false** — `P.salaryRead` is live (`src/App.jsx:2759`), comp read shipped on both surfaces, live-validated.
- Consult: "neither door record has any concept of an offer… greenfield." **Now partially false** — `P.offerNegotiation` (`src/App.jsx:2787`), `generateOpOfferNegotiation` (`src/App.jsx:6750`), the Offer & Negotiation card (`section-offerNegotiation`, `src/App.jsx:8819`), and a per-slot offer input (`offerDrafts` + `rec.sections.offerNegotiation.offerAmount`) all exist. Door2 only; **no `offerStage`, no schema bump, no door1 offer concept.**
- Consult: "Update `FEATURE_MAP` when this ships." **Already done** — `compensation-read` + `offer-negotiation` slugs live in `src/coach-routing.js`, new `opportunity-gated` bucket.

**Consequence for scope.** What survives the re-grounding is the consult's *design philosophy*, and in two places it is a sharper design than the v1 that shipped:

1. My shipped `P.offerNegotiation` *generates* the total-comp literacy ("Look beyond base"). The consult is right that this stable, universal content should be a **static reference card**, not model output (`feedback_static_beats_clever`). This brief de-generates it.
2. The shipped ask ("What to ask for, and how") anchors on the range but never builds the ask from the user's **own proof**. This brief threads STAR (`P.p11`, `src/App.jsx:2312`) and Bridge Story (`P.p6`, `src/App.jsx:2265`) content into it as an evidence/ROI case — the "evidence-based self-belief" framing from Bob's own call (`project_four_cs`: Convictions + Clarity → Confidence, backed by data).

The one genuinely greenfield artifact from the consult — the **offer-evaluation scorecard captured upstream** — is deliberately **deferred to a sequenced fast-follow brief** (see below), because it needs the `offerStage`/schema decision that is Bob's call (consult open question #1) and this brief must not guess a schema bump.

## Files affected

| File | Change |
|---|---|
| `src/App.jsx` | Reshape `P.offerNegotiation` (de-generate literacy → pointer; enrich ask with STAR/Bridge evidence). Thread `p11`/`p6` into `generateOpOfferNegotiation`. Add two static reference blocks (Total Compensation Checklist, Negotiation Scripts) + one Coach-handoff line into the Offer & Negotiation card render. |
| `src/data/user-guide/11d-negotiating-an-offer.md` | **New chapter** — the judgment-call knowledge for Coach (severance timing, reading layoff history, algorithmic/no-negotiation offers, who to actually talk to), in Bob's transcript voice. |
| `src/data/user-guide/11b-upload-a-live-opportunity.md` | One-line update to the Offer & Negotiation bullet to name the checklist + scripts + Coach handoff. |
| `src/coach-routing.js` | Update the `offer-negotiation` `does` text to mention the static checklist + scripts. Regenerate coach nav map (`npm run gen:coach-nav-map`). |

No `api/*` touched. No new files besides the guide chapter. No schema bump in this PR.

## Specific changes

### 1. De-generate the total-comp literacy in `P.offerNegotiation`

Anchor (`src/App.jsx:2787`, the third output part). Current verbatim:

> `**Look beyond base.** Two to three sentences on the parts of the package a base-salary number hides: bonus, equity or long-term incentives, sign-on, benefits, and the reality that public sources report base pay and total compensation very differently. Where the compensation read named a base-versus-total-comp gap with a source, reuse it.`

Replace with a **short pointer** that references *this* offer's data and defers the enumeration to the static card, so the generated module stops re-listing stable content:

> `**On total comp, not just base.** One or two sentences tying THIS offer to the full package: if the compensation read named a base-versus-total-comp gap with a source, reuse it; otherwise note in one line that base is only part of the picture and point the reader to the Total Compensation Checklist below. Do not enumerate the checklist items here.`

### 2. Enrich the ask with the user's own evidence (STAR + Bridge)

Anchor (`src/App.jsx:2787`, the second output part). Current verbatim:

> `**What to ask for, and how.** Name a specific target or range to anchor on, drawn from the compensation read with its source URL, and one plain sentence on how to frame the ask (anchor toward the upper end of the sourced range, tie the number to the scope of the role). Keep it to what the sourced data supports.`

Replace with an evidence-anchored version, and add two inputs to the prompt signature so it has the user's own proof to draw on:

- Signature: `offerNegotiation:(jobTitle,location,compReadText,offerAmount,foundation,proofPoints)` where `proofPoints` is a compact string built from the record's STAR (`rec.sections.p11.content`) and Bridge Story (`rec.sections.p6`) when present, empty otherwise.
- New part text (draft — Bob-reviewable copy):

> `**What to ask for, and how — as an evidence case.** Name a specific target or range to anchor on, drawn from the compensation read with its source URL. Then build the ask from THIS person's own proof: draw one concrete accomplishment from the evidence below and show, in one plain sentence, how it justifies the number (the ROI case). Frame is always evidence, never entitlement — never "you deserve more" as an assertion; always "here is what you did, here is what it returns, here is the number." Anchor toward the upper end of the sourced range and tie it to the scope of the role. If no proof is provided, anchor on the range and scope alone.`

- Append an inputs block to the prompt, after the compensation-read block:

> `THE CANDIDATE'S OWN PROOF (accomplishments and story they already wrote — use ONE concrete item to build the ROI case; never invent):`
> `${proofPoints||'(none provided — anchor on the range and role scope)'}`

In `generateOpOfferNegotiation` (`src/App.jsx:6750`), build `proofPoints` from `rec0.sections.p11?.content` (STAR) and `rec0.sections.p6` (Bridge Story prose via `bridgeStoryToProse`), trimmed and length-capped (~1500 chars combined) so the prompt stays lean; pass it as the new arg. This is the user's own content — **not** routed through the citation gate, consistent with the existing `op-offer-negotiation` step (the design decision from PR #300 stands: the user's offer figure and their own proof carry no source URLs).

### 3. Static Total Compensation Checklist card

Render a **static** reference block in the Offer & Negotiation card region (`section-offerNegotiation`, `src/App.jsx:8819`), always available (no build, no state, no generation). Content is the transcript enumeration — write once, voice-review once:

- Base salary
- Bonus — and the **actual historical payout rate**, not just the stated target percentage
- Sign-on / signing bonus
- Title (and the scope/level it signals)
- Equity or long-term incentives
- Retirement — match rate, vesting
- Health benefits **detail** — deductible, premium split, not just "we have a 401k / we offer health"
- Tuition reimbursement / professional development budget
- PTO — and the **actual utilization** if it is "unlimited"
- Work location / commute / remote terms
- Anything non-standard worth asking for (one attendee negotiated **recurring access to a senior leader** — name it as an example that comp is not only cash)

Present it plainly (a titled card with a scannable list), styled like the existing static reference blocks. It is a checklist the user reads, not something Reimagine fills in.

### 4. Static Negotiation Scripts card

A second **static** reference block, same region. The transcript's reusable language, one voice pass before shipping (generic negotiation-coach phrasing is the failure mode to avoid — `feedback_user_is_not_a_problem`, and the no-coaching-imperative / no-"rooms" discipline in CLAUDE.md §3 applies):

- Reframe **"what were you making before"** → **"can you share the budget for this role?"**
- The **share-a-range-then-go-quiet** pattern (state your range, then stop talking).
- Both close variants: **"would that be fair?"** and Tim Schuh's inversion **"would that be unfair?"**

Pull the exact phrasing from the transcript where it is good; do not paraphrase into generic advice.

### 5. Coach handoff line at the friction point

One line of **prose** on the Offer & Negotiation card (per CLAUDE.md §6: prose-only, **no NAVIGATE button**), placed where the static content naturally hands off to what it cannot answer:

> `Some offer situations don't have a universal script — severance timing, a take-it-or-leave-it or algorithm-set offer, reading a company's layoff history before you push. Those are worth a real conversation with your Coach.`

This is the deliberate shape, not a fallback: static content owns the stable half; this line owns the handoff to the reasoning half.

### 6. New guide chapter: `11d-negotiating-an-offer.md`

The judgment-call knowledge Coach retrieves via `USER_GUIDE_CONTENT` (compiled from `src/data/user-guide/*.md` by `scripts/build-user-guide.mjs` in prebuild). Cover, in Bob's transcript voice (pull his actual language, not a paraphrase):

- **Negotiating severance before accepting** — when it is even askable; that openness tracks company size; that it is rare (the Rob McFarlane texture from the call).
- **Reading layoff history / company stability** as an input to how hard to push.
- **Algorithmic / no-negotiation offers** — a read on the labor market and leverage, not a script (the Benjamin case).
- **Who to actually talk to** — hiring manager vs HR — as advice-only guidance (no data-model support exists for this distinction; see Out of scope).

Reimagine asserts no single right answer anywhere in this chapter — it gives Coach the same real material Bob and the group worked through live.

### 7. FEATURE_MAP + coach nav map

Update the existing `offer-negotiation` entry's `does` in `src/coach-routing.js` to name the static checklist + scripts (so if a user asks Coach about negotiating, it references what actually exists). Do **not** add new slugs for the static cards — they are sub-components of the Offer & Negotiation surface. Regenerate with `npm run gen:coach-nav-map`; `check-coach-nav-map.mjs` gates it.

## Voice rules on inserted text

All inserted UI copy, static cards, prompt text, and guide prose must pass `check-voice` 0/0. Watch specifically: no logic-flip cadence, no comparative standing ("most people negotiate…"), no coaching-imperative register ("lean into", "sit with"), no "rooms". The ROI-ask prompt change must hold the evidence-not-entitlement line (never "you deserve more" as assertion). The scripts are quoted attendee/Bob language — fine as quotes. If any prompt text needs a teaching example that trips a HARD_PATTERN, place it inside the existing `voice-allow` region that wraps the `P` object.

## Static gates

- `npm run build` clean (runs `build-user-guide`, `check-voice`, `check-prompt-refs`, `check-coach-nav-map`, `check-orphans`, tests, lint).
- `check-voice` 0/0; `check-coach-nav-map` in sync (feature count updates cleanly).
- App.jsx EOF integrity: verify line count + final closing tag/brace before and after.
- Diff scope limited to the four files named above (plus the regenerated `src/coach-nav-map.js`). No `api/*`, no schema/migrations, no other-session untracked files bundled.

## Runtime gate (post-merge, optional)

Preview/real-gen smoke on the Opportunity Offer & Negotiation card: build a Compensation Read, enter an offer number, build Offer & Negotiation, confirm (a) the generated ask now cites a concrete accomplishment as the ROI case, (b) the module no longer re-enumerates total-comp items (they live in the static card), (c) the static checklist + scripts + Coach-handoff line render without a build. Reuse the deployed-endpoint validation pattern from PR #300 for the prompt half.

## Constraints

- Single PR. No effort estimates.
- PR title: `Offer & Negotiation v2: static checklist + scripts, evidence-based ask, Coach negotiation chapter`.

## Out of scope (this PR)

- **Offer-evaluation scorecard + `offerStage` lifecycle** — the one greenfield artifact; deferred to the fast-follow below because it needs Bob's schema decision.
- **Hiring-manager-vs-HR contact routing in the data model** — confirmed no such distinction exists (`P.p7`, `src/App.jsx:~2301`, returns one generic `contact` per company). It is advice-only content with nothing to look up; it belongs in the guide chapter (change 6) and Coach, not a new structured field. Do not add it to the model.
- Any change to the shipped comp-read behavior or the citation gate.

## Sequenced fast-follow (separate brief, not this PR)

**Offer-evaluation scorecard, captured upstream.** A framework the user ranks *before* an offer exists (culture, ownership structure, strategic influence, their own priorities), referenced back when an offer lands — the artifact that prevents the failure Bob named on the call (someone taking a job that failed criteria they had already ranked, then calling back stuck). This needs a persistent per-record home, which is consult open question #1:

- **Decision required from Bob:** promote the current lightweight door2 `offerAmount` into a proper `offerStage` object on **both** `buildDoor1Record` and `buildDoor2Record` (schemaVersion bump on both, migrate the existing `offerAmount` in), **or** keep it door2-only for v1 and treat door1 as a fast-follow. Offers land on Focus directions too, so the cross-door shape is the honest one — but door1 offers are likely rarer in the current base. Name the tradeoff; do not default.

## Open items Code should confirm with Bob before merging

1. **Static-card copy** — the Total Compensation Checklist and the three scripts are drawn from the transcript; draft the exact wording in the PR description and let Bob react rather than finalizing in isolation. The scripts especially should sound like the call, not generic advice.
2. **ROI-ask prompt wording** — the evidence-not-entitlement framing in change 2 is Bob-reviewable copy; include the built prompt text in the PR description.
3. **Guide chapter voice** — `11d` should quote Bob's transcript phrasing where it is strong. If the transcript text is not accessible to Code, flag it and let Bob supply the passages rather than paraphrasing into generic negotiation copy.
4. **Card placement** — confirm the two static cards read best inside the Offer & Negotiation card region (recommended) vs as their own always-visible cards in the op stack.

## Commit message

```
Offer & Negotiation v2: static checklist + scripts, evidence-based ask, Coach negotiation chapter

Reshapes the shipped Offer & Negotiation module (PR #300) using the
Career Club Corner negotiation material. Moves stable content out of
per-user generation into static reference cards, builds the generated
ask from the user's own STAR/Bridge proof as an evidence/ROI case, and
routes the judgment-call content into My Coach via a new guide chapter
plus one line of handoff copy.

- P.offerNegotiation: de-generate the total-comp literacy (now a static
  card); enrich "what to ask for" into an evidence case anchored on the
  user's own accomplishments (STAR p11 + Bridge p6), framed as ROI, never
  entitlement.
- Static Total Compensation Checklist + Negotiation Scripts reference
  cards (write-once, no generation), from the 11-24-25 session transcript.
- Coach handoff: one prose line at the friction point (no NAVIGATE
  button, per CLAUDE.md §6) + new guide chapter 11d-negotiating-an-offer
  covering severance timing, layoff-history reads, algorithmic offers, and
  who-to-talk-to — the judgment calls that belong in a conversation, not a
  script.
- Docs: guide (11d new, 11b updated) + FEATURE_MAP offer-negotiation does
  text + regenerated coach nav map.

Offer-evaluation scorecard + offerStage lifecycle deferred to a
fast-follow (needs the schema-scope decision).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

## Push

Direct to `main` via the standing gh flow (branch → PR → watch CI → squash-merge). Vercel auto-deploys. Report PR URL + merge SHA.

## Implementer's checklist

1. Pull `main`; premise-verify every anchor (`P.offerNegotiation`, `P.p11`, `P.p6`, `generateOpOfferNegotiation`, the `section-offerNegotiation` card, `FEATURE_MAP` offer-negotiation entry, the `11*` guide chapters). Grep the substance, not just line numbers.
2. Reshape `P.offerNegotiation` (changes 1–2) and thread `p11`/`p6` into `generateOpOfferNegotiation`.
3. Add the two static cards + the Coach-handoff line (changes 3–5).
4. Write `11d-negotiating-an-offer.md`; update the `11b` bullet (change 6). Update `offer-negotiation` `does` + `npm run gen:coach-nav-map` (change 7).
5. Run static gates; verify App.jsx EOF integrity + diff scope.
6. Preview/real-gen smoke (runtime gate above).
7. Push to `main`; report PR URL + merge SHA.
