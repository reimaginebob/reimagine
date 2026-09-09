## Prompt for Code

Apply the changes in this brief, premise-verify against current `main` first, run the static gates, follow the gh flow, and report the PR URL + merge SHA. Two bug fixes to already-shipped Phase 2b code are called out below — read those before the new-section additions.

---

## Date / Type / Source

2026-09-09. Fast-follow brief for Phase 2b's deferred scope (Question B: "start with `p5`/`p6`, fast-follow the rest"), per `Output/handoff/2026-09-08_coach-concierge-phase-2b-career-paths.md`'s Out of scope section. Written against `main` at `6cf160d` (Phase 2b shipped).

Adds Delivery reactions for the remaining 7 generating Focus Playbook sections: `p9`, `salaryRead`, `p11`, `p_res`, `p8`, `p7`, `income`. `groups`/`recruiters` are excluded, as established in 2b's own pre-flight discovery — they are static resource lookups, not generated content.

## Pre-flight discovery — two bugs in already-shipped `delivery-p6`

Extending the pattern to 7 more sections surfaced two real defects in the `delivery-p6` entry Phase 2b shipped. Both are fixed here rather than filed separately, since fixing them is a strict subset of the work this brief already does (touching the same `momentContext`/server-dispatch code for every Delivery entry).

1. **`outputs.p6` is not reliably a string.** Unlike every other section, Bridge Story can be stored as a pre-2026-05-31-shaped object (`bridgeStoryToProse`'s "legacy decoder" branch, `:1378`) or a current-shape object with a coaching note appended (`:14923`'s own `typeof outputs.p6==='string'?outputs.p6:bridgeStoryToProse(outputs.p6)` handling). `delivery-p6`'s `momentContext` sends `ctx.outputs.p6` raw. When it's object-shaped: server-side `momentPayloadOk`'s `typeof m.text === 'string'` check fails, `momentShapeOk` is false, and the moment silently never fires — no crash, just a quiet no-op for any account whose Bridge Story happens to be in this shape. Separately, `dedupeValue: (ctx) => ctx.outputs.p6` compares an *object* by `===`; after a page reload `coachMoments` is rehydrated from JSON, so the stored value and the live value are different object references even with identical content — every visit would look like "new content" and could re-fire (bounded by `momentFiredRef`'s same-session guard, so not infinite, but a real per-session re-fire risk for affected accounts). Fix: `momentContext` and `dedupeValue` both resolve through `bridgeStoryToProse(ctx.outputs.p6)` — the exact same string-normalizing call the render path already uses — so the value flowing through is always a plain string, matching every other section.

2. **The section label sent to the server ignores the independent track.** `buildMomentTurnText` hardcodes `NAV_LABELS.p6` (`api/coach.js`). On the Go Independent track, this same section is labeled "Your Pitch" (`INDEPENDENT_SECTION_LABELS.p6`, `src/App.jsx:6216`), not "Bridge Story" — the existing `focusLabelFor(id, independent)` helper (`:6222`) already resolves this correctly everywhere else FOCUS_ORDER renders a label. An independent-track account's Delivery reaction currently says "you just built Bridge Story," the wrong name for the screen they're looking at. Fix, applied to all 9 Delivery entries (the 2 already shipped and the 7 new ones): `momentContext` computes the label client-side via `focusLabelFor(section, ctx.isIndependent)` and sends it as `sectionLabel`; `buildFocusDeliveryReactionText` takes `sectionLabel` as a parameter instead of the server looking it up per-key. This removes the per-key `NAV_LABELS.p5`/`NAV_LABELS.p6` branches from `buildMomentTurnText` entirely — one path for all 9 keys instead of two hardcoded ones plus seven more to add.

`ctx` gains `isIndependent` (already a component-level const, `:7610`) alongside `selectedLane`/`chosen`.

## Files affected

| File | Change |
|---|---|
| `src/coach-moments.js` | Fix `delivery-p6`'s `momentContext`/`dedupeValue`. Add 7 new Delivery entries. |
| `src/App.jsx` | Add `isIndependent` to the evaluator's `ctx`. |
| `api/coach.js` | `MOMENT_KEYS` gains 7 entries; `momentPayloadOk` extends to them; `buildFocusDeliveryReactionText`'s dispatch reads `ctx.sectionLabel` instead of per-key `NAV_LABELS`; 7 new one-line `buildMomentTurnText` branches (all calling the same existing template). |
| `src/coach-prompt-codes.js` | 7 new `PROMPT_CODES` entries. |
| `scripts/test-coach-moments-career-paths.mjs` | Update for the `sectionLabel`/`bridgeStoryToProse` fix; extend for the 7 new entries (or a new sibling test file — premise-verify which reads cleaner once the diff is in hand). |

## Specific changes

### 1. `src/coach-moments.js` — fix `delivery-p6`

Replace:
```js
    dedupeValue: (ctx) => ctx.outputs.p6,
    momentContext: (ctx) => ({ section: 'p6', text: ctx.outputs.p6 }),
```
with:
```js
    dedupeValue: (ctx) => bridgeStoryToProse(ctx.outputs.p6),
    momentContext: (ctx) => ({ section: 'p6', sectionLabel: focusLabelFor('p6', ctx.isIndependent), text: bridgeStoryToProse(ctx.outputs.p6) }),
```
`bridgeStoryToProse`/`focusLabelFor` are module-level functions in `src/App.jsx` (`:1373`, `:6222`), not currently imported by `coach-moments.js` — premise-verify the cleanest way to make them available (import, same as `MOMENT_CATALOG` is imported the other direction; or resolve both through `ctx` the way `laneLabelFor` already is, for consistency with the existing pattern) before implementing.

Also add `sectionLabel` to `delivery-p5`'s `momentContext` for consistency (its value only ever changes from `NAV_LABELS.p5` since `p5` isn't on the independent FOCUS_ORDER at all, but this keeps every Delivery entry's shape uniform):
```js
    momentContext: (ctx) => ({ section: 'p5', sectionLabel: focusLabelFor('p5', ctx.isIndependent), text: ctx.outputs.p5 }),
```

### 2. `src/coach-moments.js` — the 7 new entries

Same shape as `delivery-p5`/`delivery-p6`, `priority: 3`, `dedupeKey: (ctx) => \`${ctx.selectedLane}::${ctx.chosen}\``, `dedupeValue: (ctx) => ctx.outputs[section]` (plain string for all 7 — confirmed during premise-verification that none of them share `p6`'s object-shape quirk):
```js
{
  key: 'delivery-p9', family: 'delivery', screen: 'focus', significance: 'open', dismissible: true,
  priority: 3, promptCode: 'delivery_p9', generated: true,
  eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!(ctx.outputs && ctx.outputs.p9) && !!ctx.chosen,
  dedupeKey: (ctx) => `${ctx.selectedLane}::${ctx.chosen}`,
  dedupeValue: (ctx) => ctx.outputs.p9,
  momentContext: (ctx) => ({ section: 'p9', sectionLabel: focusLabelFor('p9', ctx.isIndependent), text: ctx.outputs.p9 }),
},
```
...repeated identically for `salaryRead`, `p11`, `p_res`, `p8`, `p7`, `income` (swap the key/`section`/`promptCode` string in each — `delivery_salaryread` reads awkwardly as a prompt code; use `delivery_comp_read` instead, matching the screen's user-facing name, Compensation Read, rather than its internal `salaryRead` id — every other promptCode here already mirrors the internal key, so flag this one exception clearly rather than silently deviating).

### 3. `src/App.jsx` — `ctx`

```js
const ctx={hasOnboardingConcierge,outputs,step,signedInUser,selectedLane,chosen,isIndependent,laneLabelFor,markDone,addNewOpportunity,advance}
```

### 4. `api/coach.js`

`MOMENT_KEYS` gains the 7 new keys. `momentPayloadOk` needs a `sectionLabel` requirement added for every Delivery key now (not just `text`):
```js
if (key.startsWith('delivery-')) return typeof m.text === 'string' && !!m.text.trim() && typeof m.sectionLabel === 'string' && !!m.sectionLabel.trim()
```
(replacing the current `if (key === 'delivery-p5' || key === 'delivery-p6') return ...` line — this generalizes to all 9 Delivery keys in one branch instead of enumerating them).

`buildFocusDeliveryReactionText` is unchanged (it already takes `sectionLabel` as a parameter — Phase 2b just supplied it from a hardcoded `NAV_LABELS` lookup instead of the client). `buildMomentTurnText` simplifies:
```js
function buildMomentTurnText(key, ctx) {
  if (key === 'choice-lane') return buildChoiceLaneReactionText(ctx.laneLabel)
  if (key === 'choice-role') return buildChoiceRoleReactionText(ctx.roleTitle, ctx.laneLabel)
  if (key.startsWith('delivery-')) return buildFocusDeliveryReactionText(ctx.sectionLabel, ctx.text)
  return ''
}
```

### 5. `src/coach-prompt-codes.js`

Add `'delivery_p9'`, `'delivery_comp_read'`, `'delivery_p11'`, `'delivery_p_res'`, `'delivery_p8'`, `'delivery_p7'`, `'delivery_income'`.

## Voice rules on inserted text

No new user-facing copy — every new Delivery entry reuses `buildFocusDeliveryReactionText`, already voice-checked in Phase 2b. Run `check-voice` anyway per the static gates.

## Static gates

Same as every prior phase: `npm run build` clean, `check-voice` 0/0, `check-prompt-refs` 0, `check-coach-nav-map` unchanged, App.jsx EOF integrity, diff scope limited to the files above, `npm run test` green.

## Constraints

Single PR. No effort estimates. PR title: `Coach-as-Concierge: Delivery on the remaining Focus Playbook sections`.

## Out of scope

Next move, Stall, build offers (Phase 3). Delivery on the Opportunity Playbook (door2) sections — this brief is Career Paths (door1) only, matching Phase 2b's own scope; door2 sections use a different record shape (`record.sections[key].content`, per `_opSectionText`'s own comment) and would need their own premise-verification pass.

## Next step

Confirm the `delivery_comp_read` promptCode naming choice (the one place this brief deviates from the otherwise-uniform `delivery_<key>` pattern), or say go and I'll proceed with it as written.
