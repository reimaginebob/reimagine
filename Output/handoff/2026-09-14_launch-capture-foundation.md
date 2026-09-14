# Launch capture foundation

## Prompt for Code

Apply this brief as four separate PRs, in the order listed under "Specific changes" (PR 1 to PR 4). Premise-verify each PR against current `main` before editing, since the consult readings behind it are from 2026-09-14. Run the static gates on each and follow the gh flow in CLAUDE.md section 9. Merge each PR before starting the next so the `src/App.jsx` edits stack cleanly. PR 5 and PR 6 are HELD on a privacy-policy decision from Bob; do not build them. Everything under "Out of scope" stays out.

**Date:** 2026-09-14
**Type:** Implementation brief (multi-PR)
**Source:** Consult "launch capture foundation, six captures before the flow starts" (2026-09-14), verified against `main` at `87790e9` plus read-only production queries the same day.

---

## Pre-flight discovery (scope correction)

The consult proposed six captures. Checked against code and production data, the scope changed like this:

| Consult item | Finding | Disposition |
|---|---|---|
| 1. Signup source | Already asked on the signup form and answered by 38 of 40 outside signups since 2026-08-25. The blank majority is the 139 accounts from before the question. An `outplacement` code exists (added 2026-09-04, zero picks). | Nothing to build now. System-stamping sponsored arrivals is BLOCKED on how NextPlacement users actually arrive. |
| 2. Original claim on a correction | Confirmed gap: `original_inference` is NULL on every row. `outputs[step]` is the wrong source on opportunity cards, the opportunity Bridge Story and STAR stories. Storing section text in `profile.corrections` would bloat the autosave blob, which has a size cap. | **PR 3.** Captured from each call site, stored server-side, never in the blob. |
| 3. Correction routing | Reading confirmed, and the problem is wider: every correction reaches every prompt with no section scope; the "fact" pile is mostly tone, length and pasted documents; and the triggering rebuild gets the new correction only as an unframed tail. The three proposed actions miss "add something". | **PR 4** captures the chosen action (four options, pilot flag), with routing unchanged. Routing on the action is deferred to after launch because it changes every generation during a metric freeze. |
| 4. Content-viewed event | Confirmed gap, and wider than reading: a signed-in return visit leaves no row anywhere. **But** the privacy policy (`src/legalDocs.js`) describes section-visit analytics as *anonymous*. Per-account view logging contradicts it. | **PR 5 HELD** on Bob: bump the privacy policy (re-acceptance for everyone) or do not log per-account views. |
| 5. Recognition check | Already built 2026-06-25 (Yes / Mostly / Not quite at Put it to Work, 30 outside answers). **Switched off for every account on 2026-09-13** by #928: the brand-delivery moment that replaced it records nothing. | **PR 1.** Regression fix, ungated. |
| 6. Search intake + re-ask | Every new signup already sees both questions on the second orientation screen (19 of the 23 who reached it answered). The "27 shown" figure is the Coach catch-up prompt for old accounts. The real gap: answers overwrite in place, so there is no protected first answer. | **PR 2** adds append-only answer history. The 30-day re-ask is deferred (must ship before the launch cohort's day 30; nothing is lost before then). |
| Donation attribution | Already shipped 2026-08-04 (#272) as plain Stripe payment links, with no backend. | **PR 6 HELD** with PR 5 (the same privacy question: tying a donation to an account). |

Other findings recorded for the post-launch routing work:
- `correctionsBlock` replays `corrections.slice(-20)` globally. The window accounts for 12 of the 30 corrections themed `wont_accept_correction`, and all 12 belong to one account with 43 corrections. It is not the main cause.
- The single-item rebuilds (one interview question, a headline, a skills list, an About, company-list parts) take correction text but never call `recordCorrection`, so those corrections never reach the table. This is out of scope here; it is noted for the routing work.

---

## Files affected

| PR | File | Change |
|---|---|---|
| 1 | `src/App.jsx` | Brand-delivery effect asks the recognition question once; handler records the tap |
| 1 | `api/admin/growth.js` | Recognition split by question key: frozen series plus new delivery series |
| 1 | `src/GrowthDashboard.jsx` | Second tile row for the delivery series |
| 2 | `migrations/2026-09-14_search-intake-history.sql` | New append-only table + backfill |
| 2 | `api/search-intake.js` | Append a history row on every real change |
| 3 | `migrations/2026-09-14_correction-context.sql` | New `correction_context` table |
| 3 | `api/correction-context.js` | New write-once endpoint; also fills `corrections.original_inference` |
| 3 | `api/profile/save.js` | Correction insert fills `original_inference` from `correction_context` when present |
| 3 | `src/App.jsx` | `recordCorrection(step, text, ctx)` + all eight call sites pass the text being corrected |
| 3 | `docs/architecture/v2-corrections-schema.md` | `original_inference` row updated |
| 4 | `migrations/2026-09-14_correction-action.sql` | `corrections.action` column |
| 4 | `api/_lib/feature-flags.js` | `CORRECTION_ACTIONS_FLAG`, `hasCorrectionActions`, grantable |
| 4 | `api/profile/save.js` | Persist `action` |
| 4 | `src/App.jsx` | RefineBox action chips (flagged), threaded into `recordCorrection` |
| 4 | `src/data/correction-actions-knowledge.js` + `api/coach.js` | Pilot Coach knowledge, flagged accounts only |

---

## Specific changes

### PR 1: Put the recognition check back (regression fix)

1. In the brand-delivery effect (anchor: `if(seenBrandDeliveryMoment||brandDeliveryFiredRef.current)return`), read `const askRecognition=!seenPbCheckin` **before** the existing `setSeenPbCheckin(true)`. After `setPbCheckinOpenReq(x=>x+1)`, if `askRecognition`, append one assistant message:
   - `content`: `Now that you've read it, does this sound like you?`
   - `checkinKey`: `'personal-brand-delivery'` (a **new key**, deliberately: the question now fires at a different moment than the frozen `personal-brand` series, so mixing them would silently change that metric's definition)
   - `quickReplies`: Yes / Mostly / Not quite (`yes` / `mostly` / `not_quite`). Yes follow-up: `Good. Everything Reimagine builds for you from here starts from this read.` Mostly / Not quite follow-up: `Use the "Does this feel right?" box right under it to say what's missing or off, and Reimagine will rework it with your notes. Or tell me here what doesn't sound like you.`
   - Add `seenPbCheckin` to the effect's dependency array.
   - Accounts that already answered the old check-in are never asked again.
2. In `handleEmploymentQuickReply`, add a branch for `checkinKey==='personal-brand-delivery'`: on `dismiss` return `true`. Otherwise POST `{checkin:checkinKey, answer:value}` to `/api/pb-checkin` (best-effort) and return `true`, so Chat renders the follow-up. Today an unhandled tap falls through to that endpoint but never shows its follow-up.
3. `api/admin/growth.js`: the recognition query groups by `checkin_key, answer`. `recognition` reads only `personal-brand` (identical to today's numbers, since only that key exists). Add `recognition_delivery` with the same shape from `personal-brand-delivery`, plus a `DEFINITIONS` entry.
4. `src/GrowthDashboard.jsx`: in the "Does this sound like you?" panel, label the existing row "At Put it to Work (retired 2026-09-13)" and add a second row "Right after the brand is built", fed by `recognition_delivery`.

### PR 2: Protect the first search-intake answers

1. Migration `search_intake_history`: `id bigserial PK`, `user_id uuid REFERENCES users(id) ON DELETE CASCADE`, `field text CHECK (field IN ('going_well','focus'))`, `value text NOT NULL`, `source text NOT NULL DEFAULT 'app'`, `created_at timestamptz NOT NULL DEFAULT NOW()`. Index on `(user_id, field, created_at)`. Idempotent backfill of current non-empty column values as `source='backfill'`, stamped with the column's `*_updated_at`, skipping any user and field that already has history.
2. `api/search-intake.js`: before each field's UPDATE, `INSERT ... SELECT ... WHERE <column> IS DISTINCT FROM <new value>`. That records every real change, including a clear, and never an unchanged blur. The history insert is best-effort: log and continue, never fail the save.

The live columns keep serving Coach. The earliest row per field is the protected first answer; nothing ever updates or deletes history rows.

### PR 3: Capture the text each correction was aimed at

1. Migration `correction_context`: `correction_id text PRIMARY KEY`, `user_id uuid REFERENCES users(id) ON DELETE CASCADE`, `step text NOT NULL`, `record_id text`, `original_text text NOT NULL`, `created_at timestamptz NOT NULL DEFAULT NOW()`.
2. `api/correction-context.js` (POST, origin allowlist, signed-in):
   - Body `{id, step, original, recordId?}`. The id must match `^corr_`, and `original` is truncated to 100,000 characters.
   - `INSERT ... ON CONFLICT (correction_id) DO NOTHING` (write-once).
   - Then `UPDATE corrections SET original_inference = … WHERE id = … AND user_id = … AND original_inference IS NULL`, which covers the case where the autosave already inserted the row.
3. `api/profile/save.js`: the corrections INSERT sets `original_inference` to `(SELECT original_text FROM correction_context WHERE correction_id = ${c.id} AND user_id = ${req.user.id})`, which covers the case where context arrived first. `ON CONFLICT DO NOTHING` is unchanged.
4. `src/App.jsx` `recordCorrection(step,text,ctx={})`. When `ctx.original` is a non-empty string and the account is signed in (not demo or test), fire-and-forget POST to `/api/correction-context`. **Nothing new goes into `profile.corrections`.** Call sites:
   - Coach `section-rework`: the Focus section text (`bridgeStoryToProse` for `p6`, `asText` otherwise).
   - `refineStory`: the pre-refine story (title, question, slots) as JSON.
   - `runP3Correction`: `prevBrand`.
   - `refineOpCard`: the open saved record's `sections[cardKey].content`, plus `recordId`.
   - `refineSec`: the Focus section text.
   - `refineIncome`: `outputs.income`.
   - Opportunity Playbook v1 `op` RefineBox: `outputs.op`.
   - Opportunity Bridge Story: `bridgeStoryToProse(_p6)`, plus `recordId`.
5. Docs: update the `original_inference` row in `docs/architecture/v2-corrections-schema.md`.

### PR 4: Ask what should happen (capture only, pilot)

1. Flag `correction_actions` in `api/_lib/feature-flags.js`. `hasCorrectionActions(user)` = holds the flag OR `isInternalAccount`. Add to `GRANTABLE_FLAGS` (label "Correction: what should happen"). Client mirror next to the other flag mirrors.
2. `RefineBox` gains an optional `actions` prop. When true, above the textarea it shows a labelled, optional single-choice row, "What should happen?":
   - `fact`: **Fix a fact**
   - `add`: **Add something**
   - `wording`: **Change how it reads**
   - `omit`: **Leave this out of what I show employers**

   Chips are 16px+ (font floor). The choice is optional: a thin answer beats a coerced one. `submit` calls `onRegenerate(v, action)`; the choice resets when the box closes.
3. Every RefineBox usage passes `actions={hasCorrectionActions}`. Call sites thread the second argument into `recordCorrection(step, v, {..., action})`. `recordCorrection` stores `correction.action` when it is one of the four codes.
4. Migration: `ALTER TABLE corrections ADD COLUMN IF NOT EXISTS action text`. `api/profile/save.js` persists `c.action` when valid.
5. **Routing is unchanged.** `correctionsBlock` does not read `action`. That is the post-launch work.
6. Pilot docs: `src/data/correction-actions-knowledge.js`, injected in `api/coach.js` only when `hasCorrectionActions`. User guide untouched until GA, per the pilot documentation rule.

### PR 5: HELD (content-viewed and app-open events)

Blocked on the privacy policy (see Pre-flight). The design, for when it unblocks:
- Append-only `view_events (user_id, kind 'app_open'|'section_view'|'support_click', target, record_id, created_at)`.
- Client throttled per target.
- A second "working sessions (including views)" line beside the frozen current one, labelled with its start date.

### PR 6: HELD (donation attribution)

Blocked on the same decision. The design:
- Append `client_reference_id=<account id>` to each Stripe payment link.
- Log a `support_click` view event recording the screen the person was on.

---

## Voice rules on inserted text

Every inserted line (the recognition question and its follow-ups, the four chip labels, the "What should happen?" label) was checked against CLAUDE.md section 3: no logic-flip, no comparative standing, no AI-coaching register, no sincerity qualifiers, no typology labels. "Leave this out of what I show employers" states a user choice; it makes no claim about the user.

## Static gates (every PR)

- `npm run build` clean, including prebuild: check-voice 0/0, check-prompt-refs 0, check-coach-nav-map, check-fontsize ratchet not raised, check-btn-prominence at 0
- `npm run test` passes, including test-api-surface for any new `api/` file
- `src/App.jsx` line count and EOF closure checked before and after
- Diff limited to the files named for that PR
- PRs touching `api/`: the `smoke` check green on the reimagine2 preview

## Runtime gate (post-merge)

- PR 1: build a brand on a fresh account. The question appears once, the tap writes a `personal-brand-delivery` row, and the Growth tab shows it in the second row.
- PR 2: edit a search-intake answer twice. There are two history rows and the column holds the latest.
- PR 3: correct an opportunity card. The `correction_context` row holds that card's text (not the Focus section), and `corrections.original_inference` is filled once the autosave lands.
- PR 4: as an internal account, pick "Leave this out…". `corrections.action = 'omit'`. A non-internal, unflagged account sees no chips.

## Constraints

- One PR per numbered section; merge before starting the next.
- No effort estimates.
- PR titles in the house style (plain sentence, no prefix).
- PR 1 is ungated: it restores a GA behavior removed by #928.
- PR 2 and PR 3 are invisible to users.
- PR 4 is gated.

## Out of scope

- Routing on the stored action; section-scoping corrections; the 20-correction window
- Recording corrections from the single-item rebuilds
- The 30-day search-intake re-ask
- Sponsor or partner stamping at signup
- PR 5 and PR 6 until Bob decides the privacy question

## Commit messages

- PR 1: `Ask "does this sound like you?" again, right after the brand is built`
- PR 2: `Keep every search-intake answer so the first one is never overwritten`
- PR 3: `Capture the text each correction was aimed at`
- PR 4: `Pilot: ask what should happen when someone corrects a section`

## Push

For each PR: branch from `origin/main`, push, `gh pr create`, `gh pr checks --watch`, `gh pr merge --squash`, then report the PR URL and merge SHA.

## Implementer's checklist

1. `git fetch origin`; branch from `origin/main`.
2. Premise-verify the anchors named in that PR's section.
3. Apply the changes; check App.jsx line count and EOF before and after.
4. Run `npm run build` and `npm run test`.
5. Check `git status --short`; stage by explicit path; commit.
6. Push, open the PR, watch CI (and `smoke` for `api/` PRs), squash-merge.
7. Record the PR URL and merge SHA, then start the next PR from the new `origin/main`.
