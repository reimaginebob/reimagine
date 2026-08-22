# Practical Priorities — new Orientation step (Offer & Negotiation, Phase 1)

## Prompt for Code

Apply this brief to add a new Orientation step that captures a person's practical non-negotiables — compensation floor, commute/remote needs, how much benefits weigh, risk tolerance, and hard deal-breakers — and wire the two decision-shaping fields (deal-breakers, risk tolerance) into Go-to-Market's company ranking. This is Phase 1 of the offer-negotiation Orientation workstream; Phases 2 (offerStage scoring) and 3 (benefits intake + comparison view) are separate briefs and out of scope here. A new Orientation step is a multi-touch change — it must be registered in every place an existing step is, or it ships half-wired and breaks first-run navigation. **Premise-verify every anchor below against current `main` before applying** (line numbers are from `ef33887` and will drift). Run the static gates, do the navigation smoke test described under Runtime gate, and push to `main` per the standing gh flow. Report the PR URL + merge SHA.

## Date / Type / Source

- **Date:** 2026-08-07
- **Type:** New Orientation step (capture) + a narrowed GTM ranking addition (consume). One phase of a three-phase workstream.
- **Source:** Cowork-Claude consult `2026-08-07_offer-negotiation-module-consult.md` §3 + the decisions/scope-update consult, reconciled with Claude Code. Design calls confirmed with Bob: door2-only workstream; these five fields as a first pass, no further paper iteration; step placed adjacent to `values`; `benefits-importance` pulled from the GTM addition (no company-level benefits data exists at ranking stage); the "let practical preferences shape which companies surface" line endorsed as downstream of a direction choice, same category as values/passions.

## Pre-flight discovery (verified against `ef33887`)

- **Orientation is a real phase**, not a metaphor: `PHASES` (`src/App.jsx:2879-2880`) defines phase id 0 with steps `welcome, location, resume, linkedin, assessment, values, reputation, life-events, skills`.
- **The `values` step** (`case 'values':`, `src/App.jsx:7933-7946`) is the exact template for the new step: `S.tag('#8A9BB8')` phase tag, `S.title`, `S.sub`, `CoachingCallout`, `S.card` + `S.field` + `S.label` + textarea bound via `pr('field', v)` (setter at `src/App.jsx:4894`), `SpeechBtn`, `ErrBox`, and an `S.row` Back/Continue footer using `nav()` and `advance(from,to)` (`advance` at `src/App.jsx:5061`: marks `from` done, navigates to `to`).
- **A step is registered in six places besides its render case:** `PHASES` steps array (`2880`), `ALL` (`2889`), `INPUT_PHASE_STEPS` (`2890`), `INPUT_EDIT_STEPS` (`2894`), the sidebar `inputsItems` list (`src/App.jsx:4172-4180`, inline `{id,label}`), and `NAV_LABELS` (`src/nav-labels.js:~50`, which already carries `values`/`reputation`/`life-events`).
- **The `pc` builder is a curated subset of `profile`** (`src/App.jsx:~5599`, `const pc={loc,resume,linkedin,lifeEvents,assess,assessType,values,passions,rep,skills,frameworks}`). `buildUserProfileBlock` reads `pr.values`/`pr.passions` **from `pc`, not `profile`** — so a new field reaches the prompt ONLY if it is added to the `pc` builder AND to `buildUserProfileBlock`. Missing either = silently absent. This is the easiest hook to miss.
- **`buildUserProfileBlock`** (`src/profile-block.mjs:61-83`) builds the `RAW SIGNALS` block that GTM's `P.p7` (`src/App.jsx:2349`) reads; `P.p7` already ranks by passion-fit ("Rank companies with a clear passion-fit higher than companies with only professional fit, all else equal"). The new ranking language models directly on that sentence.
- **`profile-block.mjs` is `src`-only** (imported at `src/App.jsx:15`; `api/coach.js:76` keeps its *own* hand-mirrored copy of the field labels, it does not import this module). So editing it does not trigger the `api↔src` `.mjs` Vercel hazard. But note the Coach mirror below.
- **Persistence needs no migration:** `normalizeProfileState` (`src/App.jsx:3352`) returns the loaded profile with guards, it does not whitelist-strip unknown keys, so new `IP` fields survive a round-trip. New fields are `undefined` on profiles saved before this ships, so every read uses `profile.x||''` (or a default). Fresh users get them from `IP`.

## The five fields

New keys on the base profile shape `IP` (`src/App.jsx:4407`), all optional (no field gates Continue — matches the non-blocking ethos; a person may have no hard floor or deal-breaker):

| key | input | label (Bob-reviewable) |
|---|---|---|
| `compFloor` | text | "Compensation floor" — "The minimum total comp that would make a move worth it. A number or range is fine." |
| `workReq` | text | "Commute or remote needs" — "Anything firm about where and how you work: 'remote only,' 'no more than 30 minutes,' 'hybrid, two days max.'" |
| `benefitsWeight` | segmented (stores label string) | "How much do benefits weigh in your decision?" — options e.g. `Not much · Somewhat · A lot` |
| `riskTolerance` | segmented (stores label string) | "Stability vs. upside" — options e.g. `Strongly prefer stability · Lean stability · Balanced · Lean upside · Strongly prefer upside` |
| `dealBreakers` | textarea | "Hard deal-breakers" — "Anything you won't consider: an industry, an ownership structure (PE-owned, public, early-stage), a company size. Leave blank if none." |

Segmented controls store the **label string** (not an index) so the value reads naturally in the prompt. Model the segmented control as a simple row of `Btn`-styled toggle buttons; no new shared component needed.

**Live in Phase 1 vs. dormant:** only `dealBreakers` and `riskTolerance` are consumed this phase (by GTM). `compFloor`, `workReq`, and `benefitsWeight` are captured now and read directly from `profile` at `offerStage` time in Phase 2 — they are deliberately **not** put into the prompt path, so a compensation floor never leaks into GTM ranking (the guardrail: comp is a downstream negotiation input, never upstream steering). The step still has an immediate, visible payoff via the two live fields, so it is not an inert capture screen.

## Specific changes

### 1. `IP` — add the five fields (`src/App.jsx:4407`)
Add `compFloor:'',workReq:'',benefitsWeight:'',riskTolerance:'',dealBreakers:''` to the `IP` object (place them next to `values`/`passions` for readability).

### 2. Register the step in all six places
Choose a step id — recommend **`priorities`** (Bob-reviewable). Insert `'priorities'` immediately **after `'values'`** in: `PHASES` steps array (`2880`), `ALL` (`2889`), `INPUT_PHASE_STEPS` (`2890`), `INPUT_EDIT_STEPS` (`2894`). Add `{id:'priorities',label:'Priorities'}` after the `values` entry in `inputsItems` (`4176`). Add `priorities: 'Practical Priorities'` to `NAV_LABELS` (`src/nav-labels.js`).

### 3. Render case (model on `case 'values':`)
Add `case 'priorities': return (...)` with: the `Phase 0 · Orientation` tag, a title ("Your Priorities & Non-Negotiables" — Bob-reviewable), a one-line sub explaining this is the practical side of fit (Values covered *why* work matters; this covers *what you actually need*), the five fields per the table (text/segmented/textarea), and the footer: **Back → `nav('values')`**, **Continue → `advance('priorities','reputation')`** with no validation gate (all optional). Use `pr('compFloor', v)` etc. for text/textarea; for segmented, `pr('riskTolerance', label)` on button click with the selected label highlighted.

### 4. Re-wire the two neighbors
- `case 'values':` footer Continue currently `advance('values','reputation')` → **`advance('values','priorities')`** (`src/App.jsx:7945`).
- `case 'reputation':` footer Back currently `nav('values')` → **`nav('priorities')`** (`src/App.jsx:7989`).

### 5. `pc` builder — carry the two live fields (`src/App.jsx:~5599`)
Add `dealBreakers:profile.dealBreakers, riskTolerance:profile.riskTolerance` to the `pc` object. (Do NOT add `compFloor`/`workReq`/`benefitsWeight` here — they must not reach the prompt path in Phase 1.)

### 6. `buildUserProfileBlock` — emit the two live fields (`src/profile-block.mjs`)
After the `PASSIONS AND CAUSES` line in the `RAW SIGNALS` block, add:
```
HARD DEAL-BREAKERS: ${pr.dealBreakers||'not provided'}
RISK TOLERANCE (stability vs upside): ${pr.riskTolerance||'not provided'}
```
Use the canonical-label style of the surrounding block (matches CLAUDE.md §5's RAW SIGNALS convention).

### 7. `P.p7` ranking addition (`src/App.jsx:2349`)
In the `part_2_company_list` guidance, right after the passion-fit ranking sentence, add (draft — Bob-reviewable):
> If the candidate stated HARD DEAL-BREAKERS (an industry, ownership structure, or company size they will not consider), treat them as a firm preference: do not surface companies that clearly violate one, and if a strong-fit company is a borderline case, keep it but name the tension plainly in its fit field rather than dropping it silently. If the candidate stated a RISK TOLERANCE, let it tilt the ranking on company stability — a stability-leaning candidate sees more established, lower-volatility companies weighted up; an upside-leaning candidate sees earlier-stage or higher-growth companies weighted up. Apply both as soft weights, the same way as passion-fit, all else equal — never a hard filter that empties the list.

### 8. Docs (§8, same-PR)
Update the Orientation chapter `src/data/user-guide/04-orientation-phase.md` to describe the new Priorities step (what it captures, that it's optional, that deal-breakers/risk shape which companies GTM surfaces). No `FEATURE_MAP` change — Orientation input steps (`values`, `reputation`) are not FEATURE_MAP entries, and this one is the same kind, so the coach-nav-map gate is unaffected.

## Voice rules on inserted text
All new UI copy, the step sub/helper text, the `P.p7` addition, and the guide text pass `check-voice` 0/0. Watch: no logic-flip cadence, no coaching-imperative register, no "rooms", no comparative standing. The `P.p7` addition sits inside the `voice-allow` region that already wraps the `P` object.

## Static gates
- `npm run build` clean (runs `check-voice`, `check-prompt-refs`, `check-coach-nav-map`, `check-orphans`, tests, lint).
- App.jsx EOF integrity: line count + final closing tag/brace before and after.
- Diff scope: `src/App.jsx`, `src/nav-labels.js`, `src/profile-block.mjs`, `src/data/user-guide/04-orientation-phase.md`. No `api/*` (but see Coach note), no schema/migrations.

## Runtime gate (this step is on the first-run path — validate the flow)
Because a wiring miss breaks onboarding: walk `assessment → values → priorities → reputation` forward and backward; confirm the new step renders, all five fields persist (type, navigate away, return), the segmented controls hold their selection, Continue advances with no field filled, the phase-progress/sidebar shows the step and its done-check, and a saved-then-reloaded profile keeps the values. Then a GTM real-gen with a stated deal-breaker (e.g. "no defense industry") + a stability-leaning risk rating, confirming the company list respects both as soft weights without emptying.

## Constraints
- Single PR. No effort estimates.
- PR title: `Orientation: add Practical Priorities step; GTM ranks on deal-breakers + risk tolerance`.

## Out of scope (this PR)
- **Phase 2**: `offerStage` scoring of all five fields against a logged offer (where `compFloor` and `workReq` do their real work).
- **Phase 3**: structured benefits intake + the multi-offer comparison view with the benefits-value delta line.
- **`compFloor` / `workReq` / `benefitsWeight` in any prompt path** — captured only, dormant until Phase 2. Do not add them to `pc` or `buildUserProfileBlock`.
- **`benefits-importance` in `P.p7`** — deliberately excluded (no company-level benefits data at ranking stage).
- **Door 1 / Focus** — the whole workstream is door2-only.

## Open items Code should confirm with Bob before merging
1. **Step id + copy** — `priorities` / "Your Priorities & Non-Negotiables" / sidebar "Priorities" are proposals; draft the exact wording in the PR description and let Bob react.
2. **Segmented-control options** — the `benefitsWeight` (3-point) and `riskTolerance` (5-point) scale labels are drafts; confirm the scale points read the way Bob wants.
3. **Coach awareness (flag, likely defer)** — `api/coach.js` keeps its own profile-block mirror; the new practical-fit fields will not reach My Coach unless mirrored there too. Not required for the Phase-1 GTM payoff. Recommend deferring to Phase 2 (when `offerStage` makes the fields load-bearing for Coach), but surface it so it's a decision, not an omission.

## Commit message
```
Orientation: add Practical Priorities step; GTM ranks on deal-breakers + risk tolerance

Phase 1 of the offer-negotiation Orientation workstream. Adds a new
Orientation step (adjacent to Values) capturing a person's practical
non-negotiables — compensation floor, commute/remote needs, benefits
weight, risk tolerance, and hard deal-breakers — all optional.

- New step registered across PHASES / ALL / INPUT_PHASE_STEPS /
  INPUT_EDIT_STEPS / sidebar inputsItems / NAV_LABELS, with neighbor
  navigation re-linked (values -> priorities -> reputation).
- Five new IP fields; no migration (normalizeProfileState keeps unknown
  keys; reads are defensive).
- deal-breakers + risk-tolerance flow into GTM via the pc builder and
  buildUserProfileBlock; P.p7 ranks on them as soft weights (like
  passion-fit), never a hard filter. comp floor / commute / benefits
  weight are captured but held out of the prompt path — they do their
  work at offerStage in Phase 2, so a comp floor never steers exploration.
- Guide (04-orientation-phase) updated.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

## Push
Direct to `main` via the standing gh flow (branch → PR → watch CI → squash-merge). Report PR URL + merge SHA.

## Implementer's checklist
1. Pull `main`; premise-verify every anchor (PHASES, ALL, INPUT_PHASE_STEPS/EDIT_STEPS, inputsItems, NAV_LABELS, the `values`/`reputation` cases, `IP`, the `pc` builder, `buildUserProfileBlock`, `P.p7`).
2. Add the five `IP` fields; register the step in all six places.
3. Add the render case (model on `values`); re-wire the two neighbors.
4. Add the two live fields to the `pc` builder and `buildUserProfileBlock`; add the `P.p7` ranking language.
5. Update `04-orientation-phase.md`.
6. Static gates + App.jsx EOF check + diff-scope check.
7. Runtime gate: first-run navigation walk + GTM deal-breaker real-gen.
8. Push to `main`; report PR URL + merge SHA.
