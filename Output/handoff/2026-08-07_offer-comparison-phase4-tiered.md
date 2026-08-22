# Offer comparison, Phase 4: the three-tier honest read (supersedes "scope B")

## Prompt for Code

Apply this brief to deepen the multi-offer comparison from the firm net-pay floor it has today into a full, honest read of an offer's worth — **without** building a false-precision valuation engine. The organizing idea, settled with Bob: sort every element of an offer by how knowable it is, price the knowable parts plainly, and quarantine the genuinely-unpredictable part (private-company equity) as an honest range that is never summed into a total. This **replaces** the "scope B / full risk-adjusted Total Comp EV engine" framing in `2026-08-07_offer-benefits-intake-and-comparison.md`. Premise-verify against current `main` (the firm tier shipped in #312). Strong recommendation to build in two PRs (4a empirical band, 4b quarantined equity).

## Date / Type / Source

- **Date:** 2026-08-07
- **Type:** Extends the shipped comparison + benefits math. New deterministic calc (bonus band) + a new *presentational* treatment (equity range) + progressive disclosure. Downstream of the compensation read and the parser.
- **Source:** Design conversation with Bob, reconciled with the reference doc (`2026-08-07_offer-composition-deep-reference.md` Parts 1–2). Bob's calls captured below.

## The organizing principle: three tiers of knowability

Not two (firm vs risky) but three — because bonus/commission is more knowable than equity and deserves its own honest treatment:

1. **Firm — price it exactly. (SHIPPED, #312.)** Base + the money that comes back to you (401(k) match, HSA, PTO) − what you pay for health. This is the "Cash + benefits you can bank on" line. It stands on its own and is complete for most offers.
2. **Empirically anchored — price it with a stated basis and a range. (PR 4a.)** Bonus/commission. Not the headline target: `target × realistic attainment`, shown as "~$X at typical attainment ($0 to target)", with the attainment basis named and adjustable.
3. **Speculative — do not fake a number. (PR 4b.)** Private-company equity only. An honest range with a **zero floor**, the *conditions* for the upside named, framed as **paper value, not expected value**, and **never summed into any total**. Public RSUs are not here — they belong with the firm/near-firm tier (shares × current price, a modest market range).

Each tier renders as a visually distinct layer, so the firm dollars never lend their credibility to the modeled ones. My Coach owns the personal weighting across tiers (how much *you* should trust the lottery ticket given your savings and the cap table).

## Design principles (load-bearing — these are the point)

- **Humble by default.** The firm floor is the headline. The band and the equity range are an opt-in "see the fuller picture" expansion, not the first thing shown. Don't greet anyone with attainment sliders.
- **Surface depth only where it's earned.** The band/equity layer leans forward when the offer actually has meaningful bonus or private equity; it stays quiet for a plain high-base offer.
- **A range, never a hero number** for tiers 2–3. Bars/bands, not point values.
- **Concrete vs modeled must look different.** Firm dollars render solid; modeled dollars render lighter or explicitly tagged "estimated."
- **Assumptions are visible, named, and adjustable** (attainment rate, company stage), each with a default and a one-line rationale.
- **Guard the ceiling against anchoring** (the sharpest risk): people read the top of a range as the number. Lead with the zero, frame the top as *paper value at the last valuation*, name the condition ("assumes an exit above the preference stack"), never a clean "up to $X" that reads as expected value.
- **Graceful degradation.** Useful off minimal input; every tier degrades to a plain "not counted / not modeled" note, never a silent zero.
- **No verdict, ever.** The read shows the shape of the tradeoff; it never ranks the offers.

## PR 4a — the empirical bonus band

- **Parse the bonus** from `offerStage.offer.bonus` (e.g. "15% of base target" → 0.15 × base; "$10,000 target" → 10000). Base from `offerStage.offer.base`.
- **Attainment input** on `offerStage.benefits` (or a sibling): an adjustable rate, default from the reference doc's benchmarks (~43% average; role-aware if the title implies sales), with copy naming it as a *generic* benchmark and inviting the real number ("ask your hiring manager for this team's actual history — that number beats any benchmark").
- **Bonus band** per offer: `low $0 / expected target×attainment / high target`. Rendered as its own band row, visually in the "modeled" treatment, below the firm floor. Never added into "Cash + benefits you can bank on."
- Deterministic; add to `monetizeBenefits`/a sibling helper `bonusBand(offer, attainment)`; unit-test.

## PR 4b — the quarantined equity range

- **Company stage** field on `offerStage.offer` or `.benefits` (public / late-private / early-private), inferable from About This Company where possible, user-correctable.
- **Public equity:** shares × current price (a real, modest-range number); can join the near-firm layer.
- **Private equity — the load-bearing case:** show the grant (e.g. "40,000 options, $2 strike"), the **paper value** at the last 409A if the person has it, and a plain-language range that **leads with zero**: e.g. *"On paper this is $X at the last valuation. For an early-stage company it can be worth nothing — common stock sits behind the preference stack — up to that paper figure if the company exits well. Treat it as a lottery ticket, not salary."* No EV, no discount slider producing a single number, **never summed** into any total. A one-line **"what this turns on"** per offer where equity is the swing factor.
- Hand the "how much should *I* weight this" judgment to Coach explicitly in copy.

## Data model (all lazy on `offerStage`, no schema bump)

`offerStage.benefits.bonusAttainment` (number), `offerStage.offer.companyStage` (enum), optional `offerStage.offer.equityPaperValue`. Everything optional; absence degrades gracefully.

## Voice / framing
All copy passes `check-voice` 0/0. The equity copy especially must not editorialize or imply a recommendation. No comparative standing, no coaching-imperative, no logic-flip.

## Static gates
`npm run build` clean; new helpers unit-tested; App.jsx EOF integrity; scope limited to `src/App.jsx`, `src/offer-valuation.js` (+ test), guide. No `api/*`, no schema.

## Open items to confirm with Bob
1. **Bonus attainment default** — ship the generic ~43% benchmark as the default (clearly labeled generic) vs. require the user to enter a team number before showing a band. Recommend: generic default, labeled, adjustable.
2. **Equity ceiling** — show the paper value at all (with heavy caveat) vs. show only "range from zero, upside depends on an exit" with no top number. This is the anchoring-risk call. Recommend: show paper value but framed as paper-not-expected, because hiding it feels evasive; confirm.
3. **"What this turns on" line** — templated from the numbers vs. an LLM-generated sentence per comparison. Recommend: start templated (deterministic, no gen cost); revisit.
4. **Progressive disclosure shape** — expansion within the comparison vs. always-shown tiered rows. Recommend: firm floor always shown; bonus band + equity range behind a "see the fuller picture" toggle.

## Out of scope
- Any risk-adjusted single Total Comp EV number, equity discount sliders, PWERM/OPM scenario tables, or cost-of-living normalization presented as precision. The reference doc documents these; this brief deliberately declines to build them, because a confident total-comp number would undermine the honesty the rest of the feature is built on. If Bob later wants the COL-normalization of the *firm* cash tier only (which is defensible), that's a small separate addition.

## Constraints
- Two PRs (4a, then 4b). No effort estimates. PR titles: `Offer comparison: bonus band at realistic attainment (Phase 4a)`; `Offer comparison: private-equity range, quarantined from the total (Phase 4b)`.

## Implementer's checklist
1. Pull `main`; premise-verify the firm tier (`monetizeBenefits` net model, the comparison rows, `offerStage` shape).
2. 4a: bonus parse + attainment input + band helper (unit-tested) + band row in the "modeled" layer; guide.
3. 4b: company-stage field + public/private split + the zero-floor equity range + "what turns on" line; guide + Coach handoff copy.
4. Static gates; push each PR; report URL + SHA.
