## Prompt for Code

Apply the changes in this brief across the files listed below, premise-verify the anchors against current `main`, run the static gates, add source-level regression tests, then follow the gh flow in section 9 of CLAUDE.md: push, open the PR, watch CI, squash-merge once green, and report the PR URL and merge SHA.

---

## Date / Type / Source

2026-09-05. Implementation brief, arising directly from Bob's request to build the pipeline funnel visual (iterated as a design mockup earlier this session — equal-width stage columns, single-hue gold-intensity gradient, no traffic-light coloring, clickable cards) into the real app, visible on his internal test account (`bob+lindsey@career.club`).

## Pre-flight discovery (scope correction)

This turned out to be two pieces, not one — the mockup's six columns are Researching / Applied / Phone Screen / Interviewing / Final Round / Offer, and today's actual stage vocabulary (`PURSUIT_STAGES`, `src/App.jsx:4736-4744`) is Researching / Applied / **In Conversation** / Interviewing / Offer / Closed. Building the visual as designed requires the stage-vocabulary change first; they cannot ship separately without the visual either lying about the vocabulary or launching with a mismatch to the already-agreed design.

**The vocabulary itself touches six files, not one**, confirmed by grep for `in_conversation`:
- `src/App.jsx` — `PURSUIT_STAGES` (the source of truth for the dropdown and quick-reply labels)
- `src/step-position.js` — `STAGE_STEP` (maps a pipeline stage onto the 5-step Staircase)
- `api/coach.js` — a `STAGE` label map (line ~291) feeding Coach's own prose
- `api/pursuit-status.js` — `VALID_STAGES`, a server-side write-validation set
- `api/mcp.js` — a second, independently-duplicated `VALID_STAGES` set for the MCP connector-beta write path
- `src/GrowthDashboard.jsx` — `STAGE_LABELS` / `STAGE_LADDER`, Bob's own admin Growth tab

**No DB constraint on `stage`** (`pursuit_status.stage` is plain `text`, confirmed against `migrations/2026-08-16_my-search-foundation.sql`), so the rename needs no schema change — but existing rows holding the literal string `in_conversation` need an active migration, not a silent per-consumer special case, or the admin dashboard and every stage map above would need to carry a permanent legacy branch for a value new code can no longer produce. A one-time, idempotent backfill (`UPDATE ... WHERE stage = 'in_conversation'`) is the clean fix.

**No dependency in the other direction**: `STAGE_MENTION_RE` (`src/components/Chat.jsx:25`, the natural-language stage-move detector) already includes `phone screen|screening call|final round` in its pattern — it was written ahead of this rename and needs no change.

**No FEATURE_MAP / user-guide update needed.** The board is a new visual mode of the already-documented "My Pipeline" feature (`src/coach-routing.js:53`), not a new capability — Coach has nothing new to do or say because of it. The user guide does not name specific stage values anywhere (confirmed by search), so the rename needs no doc-copy change either.

**Gating**: a new named flag, `pipeline_board`, following the exact pattern of `NEXT_STEP_FLAG`/`hasNextStep` in `api/_lib/feature-flags.js` — auto-on for `@career.club` via `isInternalAccount`, so `bob+lindsey@career.club` gets it with no dashboard grant. Client-side mirror follows the same pattern already used for `hasNextStep`/`hasPipelineCapture`/`hasOnboardingConcierge` (`src/App.jsx:7341-7353`): a local const re-checking the same email regex + `feature_flags` array, since `/api/me` already returns `feature_flags` on the user object.

**Placement**: additive, not a replacement. The existing detailed, editable pipeline list (stage dropdown, dates, next move, notes, Mark done — `mySearchPanel`, `src/App.jsx:12397+`) stays exactly as it is; the new board renders above it as an at-a-glance summary, each card a click-through to the same `openPursuitRecord(rec,'op')` the existing "Open →" link and note-count link already use. No toggle/view-switcher in this pass — both render together when the flag is on.

## Files affected

| File | Change |
|---|---|
| `migrations/2026-09-05_pursuit-stage-vocabulary.sql` | New: backfill `in_conversation` → `applied` in `pursuit_status` |
| `src/App.jsx` | `PURSUIT_STAGES` rewrite (add `phone_screen`, `final_round`; drop `in_conversation`); new `hasPipelineBoard` client mirror; new pipeline board render function, wired into `case'pipeline'` |
| `src/step-position.js` | `STAGE_STEP`: add `phone_screen: 3`, `final_round: 4`; drop `in_conversation` |
| `api/coach.js` | `STAGE` label map: add the two new stages, drop the old one |
| `api/pursuit-status.js` | `VALID_STAGES`: add the two new stages, drop the old one |
| `api/mcp.js` | `VALID_STAGES`: same change, kept in sync with `api/pursuit-status.js` |
| `src/GrowthDashboard.jsx` | `STAGE_LABELS` / `STAGE_LADDER`: add the two new stages, drop the old one |
| `api/_lib/feature-flags.js` | New `PIPELINE_BOARD_FLAG` / `hasPipelineBoard`, added to `GRANTABLE_FLAGS` |
| `scripts/test-pipeline-stage-vocabulary.mjs` | New regression test covering all six vocabulary sites + the migration |
| `scripts/test-pipeline-board.mjs` | New regression test covering the flag and the board render |

## Specific changes

**1. Migration** (`migrations/2026-09-05_pursuit-stage-vocabulary.sql`):
```sql
-- Stage vocabulary: In Conversation is retired (it only ever mapped to the
-- same Staircase step as Researching/Applied, with no other special-cased
-- logic anywhere) in favor of two more specific stages the pipeline board
-- needs: Phone Screen and Final Round. Forward-only, idempotent: re-running
-- is a no-op once no row holds the old value.
UPDATE pursuit_status SET stage = 'applied', updated_at = NOW() WHERE stage = 'in_conversation';
```

**2. `src/App.jsx` — `PURSUIT_STAGES`** (`src/App.jsx:4736-4744`). Replace:
```js
const PURSUIT_STAGES=[
  {value:'researching',label:'Researching'},
  {value:'applied',label:'Applied'},
  {value:'in_conversation',label:'In conversation'},
  {value:'interviewing',label:'Interviewing'},
  {value:'offer',label:'Offer'},
  {value:'closed',label:'Closed'},
]
```
with:
```js
const PURSUIT_STAGES=[
  {value:'researching',label:'Researching'},
  {value:'applied',label:'Applied'},
  {value:'phone_screen',label:'Phone Screen'},
  {value:'interviewing',label:'Interviewing'},
  {value:'final_round',label:'Final Round'},
  {value:'offer',label:'Offer'},
  {value:'closed',label:'Closed'},
]
```
`PURSUIT_STAGE_LABELS` and `PURSUIT_STAGE_QUICK_REPLIES` are both derived from this array and need no direct edit.

**3. `src/step-position.js` — `STAGE_STEP`** (`src/step-position.js:158`). Replace:
```js
const STAGE_STEP = { researching: 3, applied: 3, in_conversation: 3, interviewing: 4, offer: 5 }
```
with:
```js
const STAGE_STEP = { researching: 3, applied: 3, phone_screen: 3, interviewing: 4, final_round: 4, offer: 5 }
```

**4. `api/coach.js` — `STAGE`** (line ~291). Replace:
```js
const STAGE = { researching: 'Researching', applied: 'Applied', in_conversation: 'In conversation', interviewing: 'Interviewing', offer: 'Offer', closed: 'Closed' }
```
with:
```js
const STAGE = { researching: 'Researching', applied: 'Applied', phone_screen: 'Phone Screen', interviewing: 'Interviewing', final_round: 'Final Round', offer: 'Offer', closed: 'Closed' }
```

**5. `api/pursuit-status.js` and `api/mcp.js` — `VALID_STAGES`.** In both files, replace:
```js
const VALID_STAGES = new Set(['researching', 'applied', 'in_conversation', 'interviewing', 'offer', 'closed'])
```
with:
```js
const VALID_STAGES = new Set(['researching', 'applied', 'phone_screen', 'interviewing', 'final_round', 'offer', 'closed'])
```

**6. `src/GrowthDashboard.jsx` — `STAGE_LABELS` / `STAGE_LADDER`.** Replace:
```js
const STAGE_LABELS = {
  researching: "Researching", applied: "Applied", in_conversation: "In conversation",
  interviewing: "Interviewing", offer: "Offer", closed: "Closed", "(none)": "No stage set",
}
const STAGE_LADDER = ["researching", "applied", "in_conversation", "interviewing", "offer", "closed"]
```
with:
```js
const STAGE_LABELS = {
  researching: "Researching", applied: "Applied", phone_screen: "Phone Screen",
  interviewing: "Interviewing", final_round: "Final Round", offer: "Offer", closed: "Closed", "(none)": "No stage set",
}
const STAGE_LADDER = ["researching", "applied", "phone_screen", "interviewing", "final_round", "offer", "closed"]
```

**7. `api/_lib/feature-flags.js` — new flag.** Following the exact `NEXT_STEP_FLAG`/`hasNextStep` pattern:
```js
// PILOT -- Pipeline board, 2026-09-05. The equal-width, stage-grouped visual
// summary above the existing editable My Pipeline list. Gated because it is a
// new rendering of live opportunity data on a screen every signed-in account
// already uses, which is not a change to make to 145 accounts before Bob has
// looked at it himself.
export const PIPELINE_BOARD_FLAG = 'pipeline_board'

export function hasPipelineBoard(user) {
  if (isInternalAccount(user)) return true
  const flags = user && Array.isArray(user.feature_flags) ? user.feature_flags : []
  return flags.includes(PIPELINE_BOARD_FLAG)
}
```
Add to `GRANTABLE_FLAGS`: `[PIPELINE_BOARD_FLAG]: { label: 'Pipeline board' },`

**8. `src/App.jsx` — client-side flag mirror**, alongside `hasNextStep`/`hasOnboardingConcierge` (`src/App.jsx:7341-7353`):
```js
// PILOT -- Pipeline board, 2026-09-05. Mirrors hasPipelineBoard in
// api/_lib/feature-flags.js; the server decides who may use the underlying
// writes, this only decides whether the client renders the summary board.
const hasPipelineBoard=(!!signedInUser&&/@career\.club$/i.test(signedInUser.email||''))||(Array.isArray(signedInUser?.feature_flags)&&signedInUser.feature_flags.includes('pipeline_board'))
```

**9. `src/App.jsx` — the board itself.** New function near `mySearchPanel` (`src/App.jsx:12397`), rendered inside `mySearchPanel`'s `wrap(...)` between `{pipelineIntroCard()}` and `{inner}`, gated on `hasPipelineBoard`. Groups `ops` (already computed as `activePlaybooks.filter(r=>r&&r.source==='door2')`) by stage into the same six visible columns as `PURSUIT_STAGES` minus `closed`, defaulting a null/unrecognized stage to `researching` for placement purposes only (never written back). Equal-width CSS grid, single-hue gold gradient deepening left to right exactly as approved in the design mockup (`https://claude.ai/code/artifact/904d37aa-1792-44df-8d35-a56dc10774e5`), each card showing the opportunity's title and calling `openPursuitRecord(rec,'op')` on click, an italic dashed "Nothing here yet" placeholder for an empty column. Uses the app's own palette constants (`C.gold`, `C.goldL`, etc.) rather than hardcoded hex where the existing `C` object already has an equivalent, and the same four/five-step gold intensity ramp used in the mockup where it does not.

## Voice rules on inserted text

The only new user-facing copy is stage labels ("Phone Screen", "Final Round") and the board's own static heading/subtitle text, if any — plain, factual, no voice-gated prose. `check-voice`'s `FILES_TO_CHECK` already covers `src/App.jsx`, so any new copy runs through the gate automatically.

## Static gates

- `npm run build` clean (full prebuild chain, tests, lint, vite build)
- `check-voice`: 0/0
- `check-fontsize`, `check-btn-prominence`: unaffected or improved, never worse than baseline
- `check-sys-equality`, `check-prompt-refs`, `check-coach-nav-map`: unaffected (no shared-constant, prompt-reference, or Coach-catalog surface touched)
- `src/App.jsx` EOF integrity preserved before and after
- Diff scope limited to the files named above plus the new migration and tests

## Runtime gate (post-merge)

Bob can verify directly: sign in as `bob+lindsey@career.club` (auto-granted via `isInternalAccount`, no dashboard step needed), visit My Pipeline, confirm the board renders above the existing list with the six stage columns in the gold gradient, confirm a card click opens that opportunity, confirm the stage dropdown on each detailed card below now offers Phone Screen and Final Round in place of In Conversation, and confirm a pre-existing opportunity that was In Conversation now reads Applied (from the backfill) rather than showing blank or broken.

## Constraints

Single PR. No effort estimates. PR title: "Add the pipeline board and retire In Conversation for Phone Screen / Final Round."

## Out of scope

No view toggle between board and list — both render together in this pass. No change to the funnel's visual design itself beyond matching the already-approved mockup exactly. No change to `pursuit_status_events` (the append-only stage-history log) beyond what the backfill's own `UPDATE` naturally produces via any existing trigger — none exists today, confirmed by grep, so the backfill does not need to also insert history rows. No new Coach knowledge or FEATURE_MAP entry, per the pre-flight discovery above.

## Commit message

```
Add the pipeline board and retire In Conversation for Phone Screen / Final Round

The pipeline funnel mockup iterated on this session needed a real stage
vocabulary to render against -- today's six stages (Researching / Applied /
In Conversation / Interviewing / Offer / Closed) don't match the six the
design settled on. In Conversation only ever mapped to the same Staircase
step as Researching/Applied with no other special-cased logic, so it is
retired in favor of two more specific, more useful stages: Phone Screen and
Final Round. The rename touches all six places the vocabulary is
independently duplicated (App.jsx, step-position.js, coach.js, the two
write-validation sets in pursuit-status.js and mcp.js, and Bob's own Growth
dashboard) plus a one-time backfill for existing In Conversation rows.

The board itself is a new, equal-width, gold-intensity-gradient summary
rendered above the existing editable pipeline list -- additive, not a
replacement -- gated behind a new pipeline_board flag, auto-on for
@career.club so Bob sees it on bob+lindsey@career.club with no dashboard
grant needed.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Qbsj3ds9Cfozte1ASdRrDx
```

## Push

Branch off current `main`, PR, CI, squash-merge per section 9. Vercel auto-deploys from `main` on merge; the migration auto-applies before the build (`scripts/deploy-migrate.mjs`).

## Implementer's checklist

1. Pull `main`, confirm HEAD, re-grep all six vocabulary sites for drift.
2. Add the migration.
3. Apply the vocabulary rename to all six files.
4. Add `PIPELINE_BOARD_FLAG` / `hasPipelineBoard` to `api/_lib/feature-flags.js` and `GRANTABLE_FLAGS`.
5. Add the client-side flag mirror and the board render function to `src/App.jsx`, wired into `mySearchPanel`.
6. Add both new test files.
7. Run `npm run build` (full gate chain); confirm clean.
8. Verify `App.jsx` EOF (line count + closing tag) before and after.
9. Commit, push, open PR, subscribe to activity, watch CI, squash-merge.
10. Report PR URL and merge SHA.
