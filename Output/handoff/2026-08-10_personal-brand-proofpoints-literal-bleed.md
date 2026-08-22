# Personal Brand — stop the p3 proofPoints example literal from bleeding into user output

## Prompt for Code

Apply this brief to fix a fabrication bug in the Personal Brand (p3) generation: the p3 output-schema shows the model one concrete example value — `{ "value": "94%", "label": "retained through the Toronto earn-out" }` — where every other field is an angle-bracket placeholder. When a user's analysis is thin on quantified results, the model reproduces that literal, injecting "Toronto" and "94%" (details that belong to no real user) into an unrelated person's brand. Two moves: (1) replace the literal example with a placeholder in the same form as its siblings, and (2) add a self-contained grounding guard in `normalizePresentation` that drops any proofPoint whose value does not actually appear in the brand's own section prose. **Premise-verify every anchor below against current `main` first** (line numbers will drift). Run the static gates, do the runtime validation, push to `main` per the standing gh flow, report PR URL + merge SHA.

## Date / Type / Source

- **Date:** 2026-08-10
- **Type:** Bug fix. One prompt-schema literal swap + one render-layer grounding guard. No schema bump, no new plumbing, no new prompt.
- **Source:** Investigation of Mary Carol Mazza's 2026-08-04 Personal Brand correction ("I didn't scale a team from 8 to 22. I didn't work in Toronto. all of this seems wrong and taken from someone else"). The investigation traced "Toronto" to the p3 schema example literal, not to any real user's data. See findings summary in "Root cause" below.

## Root cause (verified against current `main`)

1. **The p3 output schema carries one hardcoded example value.** In the `p3:(analysis)=>` builder, the presentation schema (`src/App.jsx`, ~line 2244) defines:
   ```
   "proofPoints": [ { "value": "94%", "label": "retained through the Toronto earn-out" } ],
   ```
   Every sibling field in the same schema is a `<...>` placeholder (`"hero": "<same text as throughLine>"`, `"sections": [ { "kicker": "<short plain label>", "body": "<...verbatim...>" } ]`, etc.). `proofPoints` is the **only** field written as a fully-formed concrete example. A compositor prompt ("slot the analysis into this shape") invites the model to reproduce that concrete exemplar when the real material for the slot is missing.

2. **The example was copied verbatim from an eval fixture.** The string is lifted from `scripts/fixtures/lindsey-eval-fixture.mjs` (the synthetic "Lindsey Bartlett" persona: `Retained 94% of the acquired team through the 18-month earn-out`, `60-person Toronto boutique`). That fixture is **eval-only** — not imported by any `api/*` or `src/*` runtime code (only `scripts/fixtures/eval-extra-profiles.mjs` references it), and the persona is synthetic (reserved `555-0184` phone). **There is no runtime cross-user data path; this is not a privacy leak.** The defect is that fixture-derived content was pasted into a shipped prompt string.

3. **Nothing downstream catches it.** `normalizePresentation` (`src/App.jsx`, ~line 541) passes proofPoints through raw:
   ```
   return {hero,proofPoints:Array.isArray(p.proofPoints)?p.proofPoints:[],sections:sectionsD,origin:originD,edges,forwardClose:forwardCloseD}
   ```
   No check that a proofPoint's number appears anywhere in the analysis. Whatever the model emits renders straight to the user (`PersonalBrandView`, the PDF export, and `presentationToProse`, which feeds p6/p8/coach/completeCard — so the bad number propagates beyond the brand card).

4. **The companion "scaled a team from 8 to 22" is downstream confabulation, not template content.** No such literal exists in any prompt. Once the model emits "Toronto earn-out" it is in the fixture's latent frame and invents neighboring specifics that rhyme with it (a team-scaling number; the fixture's own text contains `9% to 22%` and `three...to nine`). Killing the seed literal removes the frame that pulls the confabulation in, and the grounding guard is the model-robust backstop.

The prose guidance at ~line 2257 is already correct — "Extract only; invent nothing... If the analysis has none, use an empty array." The literal example directly contradicts it. This fix makes the example obey the instruction.

## Files affected

| File | Change |
|---|---|
| `src/App.jsx` | (1) Replace the p3 `proofPoints` example literal with a placeholder. (2) Add a grounding filter for `proofPoints` inside `normalizePresentation`. |

No fixture change: `lindsey-eval-fixture.mjs` is synthetic and eval-only; it stays. The fix is to the shipped prompt, not the fixture.

## Specific changes

### Change 1 — replace the example literal (p3 schema, ~line 2244)

Find (verbatim):
```
    "proofPoints": [ { "value": "94%", "label": "retained through the Toronto earn-out" } ],
```

Replace with (placeholder form matching its siblings; no concrete value, no place name):
```
    "proofPoints": [ { "value": "<a quantified result that appears in the analysis, e.g. a percentage or dollar figure>", "label": "<short plain label for that result, taken from the analysis>" } ],
```

This is the load-bearing fix. It removes the specific string that bleeds and puts `proofPoints` in the same instruction register as every other field.

### Change 2 — grounding guard in `normalizePresentation` (~line 541)

The function already builds `hero`, `sectionsD`, `originD`, `edges`, and `forwardClose` before the return, and the prompt guarantees "The numbers still live in the section prose." So a grounded proofPoint's numeric value is present in the brand's own text; an ungrounded one (the bled "94%") is not. Filter on that, self-contained — no extra inputs, no threading of the source analysis.

Immediately before the existing `return {hero,proofPoints:...}` line, build a haystack from the brand's own prose and filter proofPoints to those whose digits appear in it. Suggested shape (Code to fit to surrounding style):
```
  // Grounding guard: a proofPoint is real only if its number actually appears
  // in the brand's own prose (the prompt guarantees "the numbers still live in
  // the section prose"). Drops example-literal / hallucinated points whose value
  // is nowhere in the analysis. Points with no digits fall back to a label match.
  const _hay = [hero, ...sectionsD.map(s=>s&&s.body), originD&&originD.body,
    ...edges.map(e=>e&&(String(e.claim||'')+' '+String(e.detail||''))), forwardCloseD]
    .filter(Boolean).join(' ')
  const _digits = s => String(s||'').replace(/[^0-9]/g,'')
  const _grounded = pp => {
    if(!pp||typeof pp!=='object') return false
    const d = _digits(pp.value)
    if(d) return _hay.replace(/[^0-9]/g,'').includes(d)
    return norm(_hay).includes(norm(pp.label))   // no number: require the label text to be present
  }
  const proofPointsG = (Array.isArray(p.proofPoints)?p.proofPoints:[]).filter(_grounded)
```
Then change the return to use `proofPointsG`:
```
  return {hero,proofPoints:proofPointsG,sections:sectionsD,origin:originD,edges,forwardClose:forwardCloseD}
```
`norm` is the local helper already defined at the top of `normalizePresentation` (~line 496). If `sectionsD`/`edges`/`originD` shapes differ from the assumption above, adjust the haystack accessors to match — the invariant is "concatenate all user-facing brand prose, keep only proofPoints whose number (or, absent a number, whose label) appears in it."

This is the detection layer that pairs with the instruction change, per the project rule that a voice/fabrication fix pairs the prompt instruction with a model-robust mechanism.

## Voice rules on inserted text

The replacement schema text is instruction copy (angle-bracket placeholders), not user-facing output; it introduces no banned constructions. The guard is code. `check-voice` unaffected. No change to any RAW SIGNALS block, the voice rule stack, or `voice-allow` regions/count.

## Static gates

- `npm run build` clean.
- `check-voice` 0/0 (no HARD_PATTERN surface changes).
- `check-prompt-refs` 0.
- App.jsx EOF integrity + line count preserved (verify before AND after; the edits are localized to ~2244 and ~541).
- Diff scope limited to `src/App.jsx`.

## Runtime gate (post-merge)

Regenerate a Personal Brand for a profile whose analysis has **no** quantified result (thin proofPoints is the trigger) and confirm the output no longer contains "Toronto," "94%," or an invented proofPoint — the proofPoints strip is empty or contains only numbers present in the brand prose. Validate on the Vercel deploy per the standing Reimagine method (POST the built p3 prompt to `/api/claude` with the Origin spoof + bypass token; demoData persona is Sarah Chen, whose analysis can be run with and without a quantified anchor). A second regeneration on a profile that *does* have a real quantified result confirms the guard keeps grounded proofPoints.

## Constraints

- Single PR.
- No effort estimates.
- PR title: `Personal Brand: stop the p3 proofPoints example literal from bleeding into output`

## Out of scope

- The "About This Company" opportunity-context carryover (Mitchell Allen / Terry Challenger, 2026-08-05) — a separate within-session state-clearing bug, its own investigation.
- A broader sweep of every prompt schema for concrete example literals sitting where placeholders belong (the p6 Bridge Story example is correctly fenced as "structure only; your content comes entirely from this person's profile," so it does not bleed the same way). Worth a follow-up audit, not this PR.
- The eval fixtures themselves (synthetic, eval-only — no change needed).

## Commit message

```
Personal Brand: stop the p3 proofPoints example literal from bleeding into output

The p3 output schema showed the model one concrete example value —
{ "value": "94%", "label": "retained through the Toronto earn-out" } —
where every other field is an angle-bracket placeholder. On analyses thin
on quantified results the model reproduced the literal, injecting "Toronto"
and "94%" (details belonging to no real user) into unrelated brands. The
string was copied from an eval-only synthetic fixture; there is no runtime
cross-user data path.

- Replace the proofPoints example with a placeholder matching its siblings.
- Add a self-contained grounding guard in normalizePresentation: keep only
  proofPoints whose number (or, absent a number, whose label) appears in the
  brand's own section prose, which the prompt guarantees carries the numbers.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

## Push

Direct to `main`; Vercel auto-deploys.

## Implementer's checklist

1. `git fetch origin && git checkout main && git pull --ff-only` (stash the local CLAUDE.md edit first if present).
2. Premise-verify: grep the p3 `proofPoints` literal at ~2244 and the `normalizePresentation` return at ~541 match the "Find" text above; if either has drifted, STOP and surface back.
3. Apply Change 1 (schema literal → placeholder) and Change 2 (grounding guard + return swap).
4. Run static gates (build, check-voice, check-prompt-refs, fontsize ratchet); verify App.jsx EOF + line count.
5. Runtime-validate on the Vercel deploy per the runtime gate above.
6. Changelog: note the fix in the system-documentation Ch. 11 changelog.
7. Push to `main`, open the PR via the gh flow, watch CI, squash-merge.
8. Report PR URL + merge SHA.
