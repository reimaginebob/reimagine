# Stop the product misdescribing itself — nav nesting, dead clicks, dashboard labels

## Prompt for Code

Apply the changes in this brief. Three related fixes, one PR: the Coach's feature map claims three features are top-level when they render nested under Put It to Work; a locked sidebar row and its phase header both swallow clicks silently; and the Coach insights dashboard labels "no feature surfaced this turn" as "unmet need" while the tag that actually means unmet need is computed and never displayed. Premise-verify every anchor — this brief was written against `origin/main` at `8c434c0`. Regenerate the coach nav map, run the full static gate chain, and follow the gh flow in CLAUDE.md §9. Report the PR URL and merge SHA.

---

**Date:** 2026-08-15
**Type:** Correctness — three fixes on one theme
**Source:** My Coach question insights, 7-day window Aug 9–15 2026, plus the code investigation that followed it. The two navigation complaints (Aug 11, 10:20 PM and 10:26 PM) were largely closed by PR #390 on Aug 13; these are the residue that fix did not cover, plus the dashboard framing problem that surfaced while verifying the numbers behind them.

**The theme:** all three are the product describing itself inaccurately — twice to users, once to Bob. They share one PR because they share one failure mode, not because they are individually small.

---

## Pre-flight discovery (scope correction)

Verified against `origin/main` at `8c434c0`:

**A — the nesting claim is provably wrong, and the sidebar was already corrected once.** `FEATURE_MAP` (`src/coach-routing.js`) tags `role-options`, `income-now`, and `opportunity-playbook` as `reach: 'standalone'`, documented in that file as "its own always-rendering step." `renderCoachNavMap` groups every `standalone` feature under the line *"These features are their own step — point someone straight there:"*. All three actually render as `children` of `twoDoors` in `primaryItems` (`src/App.jsx:4530-4542`). The comment at `src/App.jsx:4537-4540` records that Income Now's *previous* top-level placement "misrepresented the structure" and was nested on 2026-06-04 after user feedback — the sidebar was corrected then and `FEATURE_MAP` was not. `personal-brand` is genuinely top-level and stays.

Note this is narrower than it was before PR #390: pre-Personal-Brand users now get an explicit override telling the Coach none of these are reachable. The residue is the post-Personal-Brand case, where the map still says "their own step, point someone straight there" for three features that live one level in.

**B — the dead click is real and is two elements, not one.** In the phase list (`src/App.jsx:4623`): the phase header (`{ph.label}`) is a plain `div` with no `onClick` at all, and step rows use `onClick={()=>can&&onNav(sid)}` where `can=isDone||active`. A locked row therefore renders, shows `cursor:'default'` and the subtitle "After your Personal Brand", and silently swallows the click. The Aug 11 user clicked the header first ("Apply Your Foundation"), then the locked row underneath it. Both did nothing. `twoDoors` is the only gated entry in the phase list today.

**C — the dashboard is measuring one thing and labelling it another, and the right signal already exists unused.** Two independent signals are being conflated:

- `selfcheck_verdict` — emitted by the live Coach model mid-conversation, answering *"should I surface a feature in this reply?"* The prompt (`api/coach.js:463`) deliberately constrains it: at most one feature per reply, hold back on a genuinely heavy emotional turn, never pitch. There is also at least one by-design `none`: the My Pipeline note instructs the model to help and then emit `SELFCHECK: none` because that feature has no slug.
- `need_type` — emitted by the offline classifier (`api/admin/classify-coach.js`), answering *"does Reimagine have a feature that addresses this topic?"* with no conversational context and no restraint rules.

These legitimately diverge, so the 7-day window's "13 served-by-feature versus 1 matched" is **not** a detector bug and needs no detector change. What is wrong is the presentation: `api/admin/coach-insights.js:221` selects `selfcheck_verdict = 'none'` and `src/CoachInsights.jsx:180` renders it under the heading **"Unmet-need questions"**, with the count also shown as `big danger` "Came up empty (none)" at `:175`.

Meanwhile `need_type` has a third value, `'product-gap'` — *"a real need Reimagine does not serve"* (`api/_lib/coach-taxonomy.js:37,80`). It is the actual unmet-need signal, it is being classified on every tagged row, and `grep` finds **zero** consumers of it in the dashboard. In the Aug 9–15 window it returned `product-gap` on none of the 31 tagged questions, while the page headlined 45 unmet needs.

**Also in scope, same file, same theme:** the answer-quality panel renders a helpful-percentage off 2 rated turns out of 46. A percentage on `n=2` is noise presented as a metric.

**Out of scope confirmed:** no change to the self-check mechanism, the classifier, the taxonomy vocabulary, or `TAXONOMY_VERSION`. No re-tagging run. This brief changes what the dashboard *shows*, not what it *stores*.

---

## Files affected

| File | Change |
|---|---|
| `src/coach-routing.js` | `parent: 'twoDoors'` on the three nested features |
| `scripts/lib/render-coach-nav-map.mjs` | Split the standalone group into top-level vs nested-under-parent |
| `src/coach-nav-map.js` | Regenerated (`npm run gen:coach-nav-map`) — do not hand-edit |
| `src/App.jsx` | Locked rows and phase headers route to what unlocks them |
| `api/admin/coach-insights.js` | Return a real `product-gap` count alongside the verdict breakdown |
| `src/CoachInsights.jsx` | Honest labels; suppress the helpful-% below a rating threshold |

---

## Specific changes

### A1. `src/coach-routing.js` — mark the three as nested

Three entries currently read:

```js
  { slug: 'role-options',         reach: 'standalone',  labelId: 'laneSelect',
    does: 'opens up directions worth exploring, including off the obvious path' },
  { slug: 'income-now',           reach: 'standalone',  labelId: 'income',
    does: 'surfaces faster ways to bring in money while the bigger search runs' },
  { slug: 'opportunity-playbook', reach: 'standalone',  labelId: 'op',
    does: 'turns one specific live opening into a tailored plan of attack' },
```

Add `parent: 'twoDoors'` to each, leaving `reach: 'standalone'` intact (they *are* their own rendering steps — `parent` describes where they sit in the sidebar, which is the fact that was missing):

```js
  { slug: 'role-options',         reach: 'standalone',  labelId: 'laneSelect', parent: 'twoDoors',
    does: 'opens up directions worth exploring, including off the obvious path' },
  { slug: 'income-now',           reach: 'standalone',  labelId: 'income',     parent: 'twoDoors',
    does: 'surfaces faster ways to bring in money while the bigger search runs' },
  { slug: 'opportunity-playbook', reach: 'standalone',  labelId: 'op',         parent: 'twoDoors',
    does: 'turns one specific live opening into a tailored plan of attack' },
```

Extend the `reach` documentation comment above `FEATURE_MAP` to describe the new field:

```
//   parent: OPTIONAL NAV_LABELS key. When present, this feature renders as a child
//     of that sidebar item rather than at the top level, and the generated map says
//     so. Set it whenever a feature is nested — a coach that says "point someone
//     straight there" about a nested feature sends them looking for a label that is
//     not on their screen (the Aug 11 2026 navigation reports).
```

### A2. `scripts/lib/render-coach-nav-map.mjs` — render the distinction

Replace the `standalone` filter and its rendered group. Currently:

```js
  const standalone  = FEATURE_MAP.filter(f => f.reach === 'standalone')
```

becomes:

```js
  const standalone  = FEATURE_MAP.filter(f => f.reach === 'standalone' && !f.parent)
  const nested      = FEATURE_MAP.filter(f => f.reach === 'standalone' && f.parent)
```

And in the returned array, this block:

```js
    'These features are their own step — point someone straight there:',
    ...standalone.map(line),
    '',
```

becomes:

```js
    'These features are their own step — point someone straight there:',
    ...standalone.map(line),
    '',
    `These are their own step too, but they sit UNDER ${NAV_LABELS.twoDoors} in the sidebar, not at the top level. Name the feature and say it is under ${NAV_LABELS.twoDoors} — never tell someone to look for it at the top level of their sidebar, because it is not there:`,
    ...nested.map(line),
    '',
```

Code: if `nested` is ever empty this emits a heading with no items. Guard it the way you would guard the other groups if they can empty out — check whether `focus` / `opportunity` / `community` are already guarded and match that behaviour; if they are not guarded, leave this unguarded for consistency and note it.

The `twoDoors` label is joined from `NAV_LABELS` rather than hardcoded, so a rename still cannot desync. This assumes every nested feature shares one parent, which is true today — if a second parent is ever needed, group by `f.parent`.

### A3. Regenerate the map

```
npm run gen:coach-nav-map
```

`src/coach-nav-map.js` is `@generated` — never hand-edit it. `scripts/check-coach-nav-map.mjs` runs in prebuild and will fail the build if the committed file does not match, so the regenerated output must be committed.

### B. `src/App.jsx` — locked rows and phase headers route to what unlocks them

The phase list at `src/App.jsx:4623` is one long line; read it carefully before editing.

**B1.** Add near `PHASES` / `INPUT_EDIT_STEPS` (module scope, around `src/App.jsx:3139-3151`):

```js
// What a locked phase-list row is waiting on. A locked row used to swallow the
// click silently, and the phase header above it was never clickable at all — an
// Aug 11 2026 user clicked both and reported the app was broken. Now either one
// takes you to the step that unlocks it. Keyed by step id; only twoDoors is gated
// in the phase list today, so this is a map of one rather than a general rule.
const PHASE_UNLOCKED_BY={twoDoors:'p3'}
```

**B2.** The step row's handler currently reads:

```js
onClick={()=>can&&onNav(sid)}
```

becomes:

```js
onClick={()=>{if(can){onNav(sid);return}const u=PHASE_UNLOCKED_BY[sid];if(u&&done.includes(u)===false)onNav(u)}}
```

and its cursor, currently `cursor:can?'pointer':'default'`, becomes:

```js
cursor:(can||PHASE_UNLOCKED_BY[sid])?'pointer':'default'
```

**B3.** The phase header div renders `{ph.label}` with no handler. Give it one that routes to the first reachable step in its own phase, falling back to that step's unlock target:

```js
onClick={()=>{const first=ph.steps.find(sid=>done.includes(sid)||step===sid);if(first){onNav(first);return}const gate=ph.steps.map(sid=>PHASE_UNLOCKED_BY[sid]).find(Boolean);if(gate)onNav(gate)}}
```

and add `cursor:'pointer'` to that div's existing style object.

Code: the header currently carries no `cursor`, so it inherits default. Confirm the added handler does not collide with the existing `display:'flex'` layout, and that clicking a header inside the Orientation phase (where every step is reachable) lands somewhere sensible rather than jumping the user backwards — if it does jump backwards, prefer the *active* step over the first done one and say so in the PR.

### C1. `api/admin/coach-insights.js` — return a real unmet-need count

The totals query at `api/admin/coach-insights.js:99-101` counts verdicts. Add a count of the rows the classifier actually flagged as a gap, from the tag join used elsewhere in this file:

```sql
        count(*) FILTER (WHERE t.attributes->>'need_type' = 'product-gap')::int AS product_gap,
```

Code: `api/admin/coach-insights.js:99` sits in a query that may not already join `coach_message_tags`. If it does not, either add the same `LEFT JOIN coach_message_tags t ON t.message_id = c.id AND t.taxonomy_version = ${V}` used at `:224`, or run this as its own small query alongside the others — whichever matches the file's existing shape. Do not change the verdict counts.

Surface it on the payload next to the verdict breakdown (`:116-122`) as `productGap`.

### C2. `src/CoachInsights.jsx` — say what the numbers mean

**C2a.** The stat row at `:174-176` currently reads:

```jsx
          <Stat label="Coach found a feature" value={vb.matched} accent />
          <Stat label="Came up empty (none)" value={vb.none} sub={`${vb.nonePct}% of answered`} big danger />
          <Stat label="No self-check logged" value={vb.null} sub="pre-migration / legacy" />
```

becomes:

```jsx
          <Stat label="Surfaced a feature" value={vb.matched} accent />
          <Stat label="No feature surfaced" value={vb.none} sub={`${vb.nonePct}% of answered`} />
          <Stat label="Real gaps (product-gap)" value={totals.productGap} big danger />
          <Stat label="No self-check logged" value={vb.null} sub="pre-migration / legacy" />
```

`big danger` moves off the verdict count and onto the gap count — the number that actually warrants attention. "Came up empty" is renamed because the Coach did not come up empty on those turns; it answered and chose not to name a feature.

**C2b.** The panel at `:180`:

```jsx
        <Panel title={`Unmet-need questions (${unmet.length})`} subtitle={contentReview ? "Coach self-check returned “none” — newest first." : "Coach self-check returned “none” — counts/tags shown; question text behind the review gate."}>
```

becomes:

```jsx
        <Panel title={`Turns with no feature surfaced (${unmet.length})`} subtitle={contentReview ? "Coach answered without naming a feature — often the right call, not a gap. Filter Need type to product-gap for real gaps. Newest first." : "Coach answered without naming a feature — often the right call, not a gap. Counts/tags shown; question text behind the review gate."}>
```

Update the comment above it at `:179` — "Unmet-need questions, front and center" is no longer what this panel is.

**C2c.** Suppress the helpful-percentage on a tiny sample. In the answer-quality panel, gate the `% helpful` figure on a minimum rated count:

```jsx
const RATED_MIN=10
```

and render the percentage only when `(thumbsUp + thumbsDown) >= RATED_MIN`; below that show the raw counts and the text `too few ratings` in place of the figure. A percentage computed on two ratings reads as a measurement and is not one.

---

## Voice rules on inserted text

The only user-facing strings here are admin-dashboard labels (Change C). Checked against CLAUDE.md §3: plain language, no jargon, no banned constructions, no comparative standing. "Often the right call, not a gap" is a factual clarification, not reassurance. Changes A and B insert model-facing prompt text and code comments, out of the voice gate's scope.

---

## Static gates

- `npm run build` clean.
- `check-coach-nav-map` — **must pass with the regenerated file committed.** If it fails, `npm run gen:coach-nav-map` was not run or its output was not staged. This is the gate that makes Change A permanent.
- `check-voice` 0/0, `check-prompt-refs` 0, `check-sys-equality` OK, `check-orphans` OK, `check-fontsize` baseline 0 held.
- `check-user-guide-pdf` — should pass untouched; this brief edits no guide chapter. If it reports stale, something out of scope was changed.
- `src/App.jsx` EOF integrity: line count before and after, final closing tag intact.
- Diff scope limited to the six files in the table.
- **Preview smoke test required** — `api/admin/coach-insights.js` is under `api/`. Run `npm run smoke:preview -- <preview-url>`; both routes must return non-5xx.

---

## Runtime gate (post-merge)

1. **A:** ask My Coach something that should surface Career Paths or Income Now, as a user who has finished Personal Brand. The reply should place it under Put It to Work, not at the top level of the sidebar.
2. **B:** as a user who has *not* finished Personal Brand, click the "Apply Your Foundation" phase header and then the locked "Put It to Work" row. Both should land on Personal Brand rather than doing nothing.
3. **B, regression:** confirm clicking a reachable row still navigates to that row, and that clicking an Orientation phase header does not throw the user backwards.
4. **C:** open `/admin/coach-insights`. The gap count should read 0 for the current window, the panel should no longer be titled "Unmet-need questions", and the helpful-% should be replaced by raw counts while the rated sample is under 10.

---

## Constraints

- Single PR.
- No effort estimates in the PR description.
- PR title: `Nav map nesting, dead phase-list clicks, and honest insights labels`

---

## Out of scope

- Any change to the self-check mechanism, the classifier prompt, the taxonomy vocabulary, or `TAXONOMY_VERSION`. No re-tagging run — this changes presentation only.
- The user guide's "Phase 1 / Phase 2" vocabulary versus the on-screen phase headers. Real, ungated drift, and a separate brief.
- Extending Coach write-back to any further field.

---

## Commit message

```
Nav map nesting, dead phase-list clicks, and honest insights labels

Three fixes on one theme: the product describing itself inaccurately, twice
to users and once to us.

- coach-routing.js + render-coach-nav-map.mjs: Career Paths, Add an Opportunity
  and Income Now render as children of Put It to Work, but FEATURE_MAP called
  them standalone, so the generated map told the coach to "point someone
  straight there" — at a label that is not at the top level of their sidebar.
  New optional `parent` field; the map now names where they actually sit. The
  sidebar itself was corrected for this in June (App.jsx:4537); FEATURE_MAP was
  not. Regenerated; the prebuild gate keeps it honest from here.
- App.jsx: a locked phase-list row swallowed clicks silently and its phase
  header was never clickable at all. An Aug 11 user clicked both and reported
  the app was broken. Either one now routes to the step that unlocks it.
- coach-insights: the dashboard labelled selfcheck_verdict='none' as
  "unmet need". That field answers "should I surface a feature in this reply?"
  — a conversational judgment the prompt deliberately keeps conservative, and
  one that logs 'none' by design for features with no slug. The real signal,
  need_type='product-gap', was being classified on every tagged row and shown
  nowhere. Now counted and surfaced; the panel is renamed to what it measures;
  the helpful-% is suppressed under 10 ratings instead of reporting a
  percentage of two.

No change to the self-check, the classifier, or the taxonomy — presentation
only, no re-tagging. Build clean, voice 0/0, coach-nav-map regenerated and in
sync, fontsize baseline 0 held.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## Push

Direct to `main` via the gh flow (CLAUDE.md §9). Vercel auto-deploys.

---

## Implementer's checklist

1. `git fetch origin`, confirm current `origin/main`. Written against `8c434c0`; re-verify anchors if main has moved.
2. Premise-verify:
   - The three `FEATURE_MAP` entries still carry `reach: 'standalone'` with no `parent` field.
   - `renderCoachNavMap` still filters on `f.reach === 'standalone'` in one place.
   - `onClick={()=>can&&onNav(sid)}` still appears in the phase-list line, and the phase header still has no handler.
   - `product-gap` still has zero consumers outside `coach-taxonomy.js`. **If the dashboard has since started using it, Change C1 is already done and only the labels remain.**
   - `CoachInsights.jsx` stat labels still read as quoted.
   - If any premise fails, STOP and surface back.
3. Check for uncommitted work from a concurrent session; stash-isolate, do not bundle.
4. Apply A1, A2, then run `npm run gen:coach-nav-map` and stage the regenerated `src/coach-nav-map.js`. Then B, then C.
5. Full static gate chain. Record `src/App.jsx` line count before and after.
6. Preview smoke test.
7. Open the PR with `gh pr create --body-file`, watch checks to green, merge `--squash`.
8. Report the PR URL, the merge SHA, and anything premise verification corrected — in particular whether the phase-header click needed the *active*-step preference noted in B3.
