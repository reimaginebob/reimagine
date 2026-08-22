# Benefits intake + multi-offer comparison (Offer & Negotiation, Phase 3)

## Prompt for Code

Apply this brief to add (a) a small optional **benefits intake** on the Offer & Negotiation card so a logged offer's benefits can be priced, and (b) a net-new **multi-offer comparison view** that lines up two or more logged offers side by side, with **benefits value shown as its own line, never blended into a single total**. Phase 3 (final) of the offer-negotiation Orientation workstream. **This brief has two dependencies the author could not resolve — read the Blockers section first; do not build the monetization math until the formulas are confirmed.** Premise-verify every anchor against current `main` (`44e6d95`) before applying. Strong recommendation to build this as **two PRs** (3a intake, 3b comparison) — see Recommended split.

## Date / Type / Source

- **Date:** 2026-08-07
- **Type:** New optional intake on an existing card (3a) + a net-new comparison surface with deterministic monetization (3b).
- **Source:** Cowork-Claude decisions/scope-update consult §6 ("benefits value comparison"), which cites monetization formulas in `2026-08-07_offer-composition-deep-reference.md` Part 2. Confirmed with Bob as a **lazy, non-blocking** feature: clear messaging on why pricing benefits is worth it, optional entry, never gates progress, a plain "not priced in" note when skipped, and the benefits delta shown as its own visible line rather than folded into one blended number.

## Blockers

1. **~~Monetization formulas not on disk~~ — RESOLVED.** Bob supplied the reference doc; it is now saved at `Output/handoff/2026-08-07_offer-composition-deep-reference.md`. Its Part 2 gives the exact formulas — see Monetization below, now locked to it. Its Part 2 also carries a **fuller valuation methodology** (risk-adjusted Total Comp EV, stage-based equity discounting, bonus-attainment haircuts, cost-of-living normalization of cash only, conservative/optimistic dual-case) that goes well beyond the benefits line §6 asked for — that surfaces the scope decision in Open Item 1.
2. **The comparison view is a net-new surface** with real layout/entry decisions (Open Items 2-3). No existing analog to model on.

## Pre-flight discovery (verified against `44e6d95`)

- **Multiple offers already exist** as multiple door2 records in `savedPlaybooks`, each with `rec.offerStage.offer` (structured, from the parser) and now `rec.offerStage.priorityCheck`. `offerStage` is lazy-init (no schemaVersion bump — the op surface guards on `===2`); a new `offerStage.benefits` object follows the same lazy pattern.
- **My Library** (`case 'mylib'`, `src/App.jsx:8586`) renders `<SavedPlaybooks>` (`src/components/SavedPlaybooks.jsx`, 276 lines), which already groups **Opportunity Playbooks (door2)** separately from Focus Playbooks (heading at `SavedPlaybooks.jsx:268`). This is the natural home for a "Compare offers" entry point — it's where the door2 records with offers already live.
- **The parser already captures benefits terms as text** (`deductible`, `premium`, `hsa`, `retirement`, `pto`, `health`, `dental`, `insurance` on `rec.offerStage.offer`). Those are strings ("$1,000 deductible", "4% match", "20 days"). The intake in 3a is the **numeric layer** the math needs — it can pre-fill hints from the parsed strings but stores clean numbers.
- **The offer's base** for PTO/match math comes from `rec.offerStage.offer.base` (a string like "$148,000"); parse a number from it, and let the user correct it in the intake.

## Recommended split (two PRs)

- **PR 3a — Benefits intake.** The optional numeric benefits fields on `offerStage.benefits`, the small "Price your benefits" form on the Offer & Negotiation card, and the non-blocking messaging. No comparison view, no math surfaced. Self-contained, low-risk, ships value on its own (the numbers become part of the logged offer).
- **PR 3b — Comparison view.** The net-new multi-offer comparison surface + the monetization (once the formulas are confirmed) + the benefits-value-as-its-own-line layout. Depends on 3a's fields and on the Blockers being resolved.

Building 3a first also lets real benefit-number entries be observed before the comparison math commits to a methodology.

---

## PR 3a — Benefits intake

### Data
New lazy object `rec.offerStage.benefits` (no schemaVersion bump), numeric where possible (store numbers or clean strings; empty when unset):
- `employeePremiumAnnual` — what the employee pays for health coverage per year.
- `employerPremiumAnnual` — what the employer contributes to the premium per year (the value the employee doesn't pay).
- `deductible` — annual health-plan deductible.
- `employerRetirementAnnual` — employer 401(k)/retirement match in dollars per year (or capture the % and compute from base — confirm with methodology).
- `employerHSAAnnual` — employer HSA/FSA contribution per year.
- `ptoDays` — paid time off in days.

(Six fields; adjust to match the reference doc's inputs once available.)

### UI (on the Offer & Negotiation card, near the parsed-offer readout)
A collapsed **"Price your benefits (optional)"** affordance. Expanded: the six numeric inputs, each with a hint pre-filled from the parsed `offerStage.offer` string where one exists (e.g. deductible, PTO). Non-blocking messaging, verbatim-adjacent to Bob's framing:
> Benefits can be worth several thousand dollars a year even at the same salary — a low deductible, a strong 401(k) match, or richer PTO all add up. Add a few numbers to price them into your comparison. Skip it and we'll simply note benefits weren't priced in.

Writes to `rec.offerStage.benefits` via an updater mirroring `updateOfferField`. Never gates anything.

### Gates / scope
`src/App.jsx` + guide (`11b`). No `api/*`, no schema bump. Standard static gates.

---

## PR 3b — Multi-offer comparison view

### Entry point (Open Item 2)
Recommended: a **"Compare offers"** control in My Library, shown only when **2+ door2 records have `offerStage.offer`**. Opens the comparison surface (a new `case` / view, or a modal). Confirm entry-point + surface shape with Bob.

### The view
Side-by-side columns, one per logged offer (cap at a sensible number — Open Item 3). Rows, in this order, with **cash and benefits kept visibly separate**:
- Base salary
- Bonus (target, as $)
- Equity / long-term incentives (note, not always monetizable — show as stated)
- Sign-on (amortized note optional)
- **Cash compensation subtotal**
- **Benefits value** — **its own line**, from Monetization below; "not priced in" in plain text when 3a data is absent for that offer (never a silent 0 that reads as "no benefits")
- **Total value (cash + priced benefits)** — sums the two but the components stay visible above it
- **Against your priorities** — a one-line-per-offer pull from `offerStage.priorityCheck` (or a short fresh read), so the comparison isn't only dollars

Bob's load-bearing rule: the benefits delta is **never merged into a single blended figure where it disappears**. Cash and benefits are always separately visible; the total is a sum of named parts, not a replacement for them.

### Monetization (deterministic JS — LOCKED to reference-doc Part 2)
Formulas per `2026-08-07_offer-composition-deep-reference.md` Part 2 "Benefits monetization":
- **401(k) match** = `matchPct × min(base, matchCap)`, or `employerRetirementAnnual` directly if captured as a dollar figure. (Doc: "match % × min(salary, match cap). Direct cash equivalent.")
- **Health value** = `employerPremiumAnnual − (what the employee would otherwise pay for equivalent coverage, i.e. a COBRA/marketplace benchmark)`. **NOT the gross premium** — this is the load-bearing subtlety in the doc. In practice: value = employer's premium contribution net of the employee's premium share; the deductible informs the out-of-pocket estimate but the core figure is the employer-paid premium.
- **PTO value** = `(base / 260) × ptoDays` (260 US working days/yr).
- **Remote/flexibility** (if in scope): a user-adjustable slider defaulting **5-10% of base** (NBER-backed: 5-8% hybrid, up to 25% full remote). Present as adjustable, never a fixed truth.
- **Benefits value** = sum of the components present; always show which were priced and which were missing (never a silent 0).

Keep the math in a small pure helper `monetizeBenefits(offer, benefits)` returning `{total, components, missing[]}`, unit-tested in `scripts/`.

### Framing
Informational, agency-preserving — the comparison surfaces the full picture; it never ranks the offers or says which to take. A visible caveat that priced benefits are estimates from the numbers entered.

### Gates / scope
`src/App.jsx` + `src/components/SavedPlaybooks.jsx` (entry point) + possibly a new component + a monetization helper + its test + guide. No `api/*`, no schema bump.

---

## Voice rules on inserted text
All copy passes `check-voice` 0/0. No comparative standing, no coaching-imperative register, no logic-flip cadence. The comparison view must not editorialize on which offer is better.

## Static gates (both PRs)
`npm run build` clean; `check-voice` 0/0; App.jsx EOF integrity; diff scope limited to named files; monetization helper unit-tested (3b).

## Out of scope
- Any change to Phases 1–2 (Practical Priorities, Priorities Check), the parser, or the market comp read.
- Ranking or recommending among offers — the view is informational only.

## Open items Code should confirm with Bob before merging
1. **How much of the valuation engine to build (the big scope call).** The reference doc's Part 2 supports two ambitions for 3b:
   - **(A) Minimal — §6 as literally requested:** cash lines + **benefits value as its own line** + the per-offer priorities pull-in. Deterministic, small, ships the specific thing Bob asked for.
   - **(B) Full Total Comp EV engine:** risk-adjusted bonus/commission EV (attainment haircuts), stage-based equity discounting (adjustable slider), cost-of-living normalization of **cash only**, and a **conservative/optimistic dual-case** rather than one number. Much larger; needs several more `offerStage` fields (company stage, equity type/size, bonus target, COL basis) and its own prompt/calc work.
   My recommendation: **build (A) now**, designed so the `monetizeBenefits` helper and the comparison layout can grow into (B) later. (B) is arguably its own Phase 4, not a Phase-3 expansion. Confirm which.
2. **Comparison entry point + surface** — "Compare offers" in My Library opening a new view vs a modal; shown at 2+ logged offers. Confirm.
3. **Max offers compared** — 2, 3, or more columns (mobile is desktop-first, hardcoded-width per CLAUDE.md §11; a wide table needs horizontal-scroll or stack-on-narrow). Confirm the cap.
4. **Benefits intake field set** — the six fields align to the locked formulas (health needs employer + employee premium split; PTO needs days; retirement needs the match $ or %+cap). Confirm.

## Constraints
- Two PRs recommended (3a, then 3b). No effort estimates.
- PR titles: `Offer & Negotiation: optional benefits intake for pricing` (3a); `Offer & Negotiation: multi-offer comparison with benefits value as its own line` (3b).

## Push
Standing gh flow per PR; report PR URL + merge SHA each.

## Implementer's checklist
1. Pull `main`; premise-verify (`offerStage` shape, `SavedPlaybooks.jsx` door2 grouping, the Offer & Negotiation card, `offerStage.offer.base`).
2. **3a:** add `offerStage.benefits` + the optional intake form + non-blocking copy; guide.
3. Confirm Blockers (formulas) with Bob before starting 3b.
4. **3b:** monetization helper + test; the comparison surface + entry point; benefits-value as its own line; priorities pull-in; guide.
5. Static gates + EOF + scope; push each PR; report URL + SHA.
