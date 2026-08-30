# Opportunity notes: let the user write one, and stop throwing away finished steps

## Prompt for Code

Apply the changes in this brief. Verify the premise first — this brief claims a per-opportunity notes list already ships (`savedNotes[]`) with storage, render, and delete, and that its only writer is the My Coach save path; confirm that before treating any change here as additive. Run the static gates, follow the gh flow in CLAUDE.md §9, and report the PR URL and merge SHA. One PR.

---

## Date / Type / Source

**Date:** 2026-08-29
**Type:** Implementation brief — user-facing capability
**Source:** Magnus Wahlström, 2026-08-29. He asked how to clear an Overdue flag after finishing a step (answered by PR #588, Mark done, shipped `5d1c871`). The wider issue surfaced in his own data during that diagnosis: on a *different* card, his next step read `"Send updated resume to Stephen Griffiths - did thi…"`. He was recording completion inside the text of the thing he was supposed to do, because the product gave him nowhere else to put it. The polite question named one card; the workaround was on another.

---

## Pre-flight discovery (scope correction)

This brief was going to be "add notes to an opportunity." It is not that. Verified against `main` at `5d1c871`:

**A notes list already ships.** `savedNotes[]` on each saved playbook record — shape `{ id, text, source:'coach', personName, createdAt }`. Storage: `App.jsx:8053` (record seed), helpers `getOpSavedNotes` / `removeOpSavedNote` at `App.jsx:8091–8104`. Render: a **"Saved notes"** card on the Opportunity Playbook screen at `App.jsx:12573`, one row per note with a Remove button. All of that works today.

**Its only writer is My Coach.** `saveCoachNoteToOpportunity` (`App.jsx:8093`) is the sole append path, wired to the Chat component's `onSaveNote` prop at `App.jsx:11707` and `App.jsx:13022`. There is no way for a user to author a note of their own. Every row is stamped "From My Coach" and the card's sub-copy reads *"Replies you saved from My Coach for this opportunity."*

**The card is hidden when empty.** `if(!_notes.length)return null` at `App.jsx:12573`. So a user who has never saved a Coach reply has never seen this feature exist. That is most of why Magnus improvised.

**This is NOT pilot-gated.** `onSaveNote` is passed unconditionally at both Chat call sites — only `pursuitCaptureActive` and `interviewTeamCaptureActive` carry `hasMySearch`. Saved notes ships to every Opportunity Playbook user. **Consequence for scope: the user-authored-note half of this brief is a general-availability change and takes the full CLAUDE.md §8 docs obligation** (user guide + `FEATURE_MAP` + `npm run gen:coach-nav-map`) in the same PR. The Mark-done half is pilot-gated and rides the per-user `myStatusNote` in `api/coach.js` instead, per the standing My Pipeline exception.

**Do NOT put this in `opportunity_context`.** The other free-text box on the record (`panel.opportunity_context`, rendered `App.jsx:12139`) is an **input to generation**: it is read into prompts at `App.jsx:1456` and `App.jsx:3555` and into the Coach at `api/coach.js:452`. Activity chatter like "did this on 8/28" would degrade Interview Prep. `savedNotes` is read by nothing — no prompt, no Coach, no analytics path — which is exactly why it is the right home for a history.

**Stale comment to fix.** `App.jsx:8088` states *"savedNotes rides in profile_state, so account deletion already purges it."* Since Phase 3 (PR #579, `64bf62a`) savedPlaybooks no longer rides in the autosave blob — it lives in the `saved_playbooks` table. The privacy claim still holds (`user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `migrations/2026-09-02_saved-playbooks-table.sql:16`), but the stated mechanism is wrong and will mislead the next reader.

**Existing doc gap this brief inherits.** "Saved notes" has zero coverage: 0 hits in `src/coach-routing.js` (`FEATURE_MAP`), 0 across all 23 files in `src/data/user-guide/`. A shipped GA feature nobody has documented. This PR closes it rather than adding a second undocumented capability beside it.

**Net scope change:** no new table, no new store, no migration. Three changes to an existing feature plus its first documentation.

---

## The design call

Magnus did not want a comment box. He wanted the record of a finished step to survive. **Mark done currently discards `next_move`** — the exact text he was trying to keep. So the completion *is* the note, and the cheapest correct fix is to stop throwing it away.

That gives three changes, in priority order:

1. **Mark done writes history.** Append the finished step to `savedNotes` before clearing it.
2. **The user can write their own note.** The literal ask, and the reason the card must stop hiding itself.
3. **The card stops being Coach-only** in its copy and its per-row stamp, since it will now hold three kinds of thing.

**One decision is yours, not Code's:** whether a completed step logs *automatically* (recommended) or only when the user opts in with a checkbox. Auto-log matches Magnus's observed behaviour, costs one row per completed step, and is reversible per-row via the existing Remove button. If you want the checkbox instead, say so before this is built — it changes change 1 only.

---

## Files affected

| File | Change |
|---|---|
| `src/App.jsx` | `markPursuitStepDone` appends the finished step to `savedNotes`; new `addOpUserNote` writer; Saved notes card renders always for door2 records, gains an add-a-note composer, per-row source stamp, `CoachingCallout` explainer; pipeline card gains a notes count line; fix stale comment at `:8088` |
| `src/coach-routing.js` | `FEATURE_MAP` entry for the notes capability (GA half) |
| `src/coach-nav-map.js` | Regenerated — `npm run gen:coach-nav-map` (do not hand-edit) |
| `src/data/user-guide/add-an-opportunity.md` | Document the notes card: what it holds, the three sources, that it is private |
| `api/coach.js` | Extend the flag-gated `myStatusNote` so the Coach knows Mark done files the step into notes |

No migration. No new endpoint. `savedNotes` rides the saved playbook record, which already has its own table, dual-write, and cascade.

---

## Specific changes

### 1. Mark done files the finished step

`src/App.jsx`, the helper added by PR #588. Replace:

```js
  const markPursuitStepDone=(recordId)=>{
    if(!recordId)return
    pursuitStepFocusRef.current=recordId
    savePursuit(recordId,{next_move:null,next_step_at:null})
  }
```

with:

```js
  const markPursuitStepDone=(recordId)=>{
    if(!recordId)return
    // The finished step IS the history. Clearing it without filing it is what
    // pushed a pilot user to type "- did this" into the step text: the product
    // gave the record nowhere to go. File first, then clear.
    const s=pursuitStatusFor(recordId)
    const done=(s&&typeof s.next_move==='string')?s.next_move.trim():''
    if(done)addOpNote(recordId,{text:done,source:'step'})
    pursuitStepFocusRef.current=recordId
    savePursuit(recordId,{next_move:null,next_step_at:null})
  }
```

An empty step files nothing — clearing a bare date leaves no row.

### 2. A single append path for both new sources

`src/App.jsx`, beside `getOpSavedNotes`. Add:

```js
  // One append path for every non-Coach note. `source` is 'step' (filed by Mark
  // done) or 'user' (typed on the card). Same row shape the Coach path writes,
  // so the render stays one list. personName is Coach-only and stays null here.
  const addOpNote=(slotId,{text,source})=>{
    const t=(typeof text==='string'?text:'').trim();if(!slotId||!t)return
    const note={id:newNoteId(),text:t,source:source==='step'?'step':'user',personName:null,createdAt:new Date().toISOString()}
    setSavedPlaybooks(prev=>prev.map(r=>r.id===slotId?{...r,savedNotes:[...getOpSavedNotes(r),note],updatedAt:new Date().toISOString()}:r))
  }
```

Keep `saveCoachNoteToOpportunity` as it is. It has its own return contract (the record title, used for the Coach's confirmation line) and its own `personName`; folding it into `addOpNote` would break that for no gain.

### 3. Fix the stale storage comment

`src/App.jsx:8088`. Replace:

```
  // write path of its own and stays read-only. savedNotes rides in profile_state,
  // so account deletion already purges it; nothing reaches any analytics path.
```

with:

```
  // write path of its own and stays read-only. savedNotes rides on the saved
  // playbook record, which since PR #579 lives in the saved_playbooks table
  // (user_id FK ON DELETE CASCADE), so account deletion still purges it. Nothing
  // reaches any analytics path, and no prompt or Coach block reads it — which is
  // why this, and not panel.opportunity_context, is the safe home for a history.
```

### 4. The card renders always, and invites a note

`src/App.jsx:12573`. The card currently early-returns when the list is empty:

```js
              {(()=>{const _notes=getOpSavedNotes(_rec);if(!_notes.length)return null;return _cardWrap(<>
                <div style={{fontSize:20,fontWeight:700,color:'#1A2540'}}>Saved notes</div>
                <div style={{fontSize:15,color:C.gray,lineHeight:1.5,marginTop:4,marginBottom:14}}>Replies you saved from My Coach for this opportunity.</div>
```

Changes required:

- **Drop the `if(!_notes.length)return null` early return** for door2 records. A card that hides itself cannot invite the thing it exists to collect. Keep the card out of Focus (door1) playbooks.
- **Retitle** to `Notes` (the list now holds three kinds of thing, only one of which came from the Coach).
- **The explainer becomes a `CoachingCallout`**, not the current gray paragraph. CLAUDE.md §8: guidance gets a distinct visual treatment, and existing surfaces are brought into line as they are touched. Text: `Anything worth remembering about this opportunity — what you did, what you heard, a reply you saved from My Coach. It's yours alone; nothing here feeds what Reimagine writes for you.`
- **Add a composer**: a `S.ta` textarea (placeholder `What happened, or anything you want to remember`) plus a `<Btn small prominent>Add note</Btn>` calling `addOpNote(_rec.id,{text,source:'user'})` and clearing the field. Disable the button on empty input. Add a `SpeechBtn` alongside it, matching the `opportunity_context` composer at `App.jsx:12139` — the thin-input work established that dictation belongs on every free-text field.
- **Stamp each row by source**, replacing the unconditional `From My Coach` span:
  - `source==='coach'` → `From My Coach` + `· {personName}` when present (unchanged)
  - `source==='step'` → `Completed · {createdAt as a short date}`
  - anything else → `Your note · {createdAt as a short date}`
- **Empty state**: when there are no notes, render the callout and composer with no rows and no divider.

Every row keeps its existing Remove button, which is what makes the auto-filed step reversible.

### 5. The pipeline card points at the notes

`src/App.jsx`, the My Pipeline card, in the `built` chip row. When `getOpSavedNotes(rec).length`, add one line reading `{n} note{s}` that calls `openPursuitRecord(rec,'op')`, styled as the existing gold text button.

**Do not render the log inline on the pipeline card.** That card is already carrying a title, stage, two dates, a situation note, six build chips, and now Mark done. Pipeline is the action surface; the playbook screen is where you read.

### 6. Coach knowledge — the two halves go to two places

**GA half** — `src/coach-routing.js`, a `FEATURE_MAP` entry for the notes capability on an opportunity, joined by `labelId` to the existing Add an Opportunity label. Then `npm run gen:coach-nav-map`; `scripts/check-coach-nav-map.mjs` fails the build if you skip it.

**Pilot half** — `api/coach.js`, the flag-gated `myStatusNote`. Extend the Mark done sentence added by PR #588 so it reads that pressing Mark done files the finished step into that opportunity's notes, so nothing is lost when the card clears.

### 7. User guide

`src/data/user-guide/add-an-opportunity.md`. A short section on the notes card: the three things it holds, that the user can write their own, that it is private and feeds nothing Reimagine generates. Do **not** mention My Pipeline or Mark done — the guide is injected wholesale into every user's Coach (`api/coach.js:497`) and naming a gated feature there leaks it.

---

## Voice rules on inserted text

All inserted copy is plain, gain-framed, and free of the banned constructions: no logic-flip cadence, no comparative standing, no coaching register, no typology labels, no sincerity qualifiers, no "rooms," no slogan-cadence closers. `Completed`, `Your note`, and `Add note` are labels, not characterizations. The callout leads with what the user gets and states the privacy fact in one flat line rather than as a disclaimer stack.

---

## Static gates

- `npm run build` clean, including the full prebuild chain
- `check-voice` 0 hard / 0 soft
- `check-prompt-refs` OK
- `check-coach-nav-map` OK — regenerate, do not hand-edit `src/coach-nav-map.js`
- `check-fontsize` at baseline 0 and not raised: no `fontSize` below 15, interactive elements 16+ (use `S.ta`, `S.sm`, `Btn`)
- `check-guide-refs` and `check-user-guide-pdf` OK after the guide edit
- `npm run test` and `npm run lint` clean
- App.jsx EOF intact — line count and final closing brace checked before **and** after every edit
- Diff scope limited to the five files in the table

`api/coach.js` is touched, so run `npm run smoke:preview -- <preview-url>` against the **`reimagine2`** preview before merging (`reimagine2-git-<branch>-career-club.vercel.app` — the `reimagine-git-*` host is the wrong project and the bypass token does not open it).

---

## Runtime gate (post-merge)

1. On an opportunity with no notes, the card renders with its callout and composer. Type a note, add it, confirm it appears stamped `Your note`.
2. On a My Pipeline card, set a next step and a past date, confirm Overdue, press **Mark done**. The flag clears, the field empties and takes focus, and the finished step appears on the playbook screen stamped `Completed` with today's date.
3. Press Mark done on a card with a date but no step text — nothing is filed.
4. Remove a filed step from the notes card; confirm it stays gone after a reload.
5. Ask My Coach where an opportunity stands and confirm it can say the step was filed rather than lost.
6. Two tabs, same account: add a note in A, reload B, confirm it is there (the `saved_playbooks` dual-write path).

---

## Constraints

Single PR. No effort estimates. PR title uses the user-facing name: `Opportunity notes: …`.

---

## Out of scope

- **No connector write path for notes.** `update_pursuit` already writes `situation_note`; letting an assistant author user notes is a separate decision about whose voice the list holds.
- **The Coach does not read `savedNotes`.** It is currently read by nothing, and that is what makes it safe for unfiltered personal chatter. Feeding it to the Coach is a real product question — better answered once there is something in these lists to look at.
- **No `completed_at` column on `pursuit_status`.** The card holds what happens next; the history lives on the playbook record. PR #588's design stands.
- **No notes on Focus (door1) playbooks.** Opportunity records only.
- **No edit-in-place on an existing note.** Add and Remove are enough for a first pass.

---

## Commit message

```
Opportunity notes: the user can write one, and Mark done files the finished step

Mark done cleared a completed next step and threw the text away. A pilot
user had been typing "- did this" into the step text itself, because the
product gave the record nowhere to go.

The notes list this needs already shipped: savedNotes[] on the saved
playbook record, with storage, render, and delete. Its only writer was the
My Coach save path, and the card hid itself when empty, so most users never
learned it existed.

Mark done now files the finished step into that list before clearing it. The
card renders for every opportunity, invites a note of the user's own, and
stamps each row by where it came from — My Coach, Completed, or Your note.
Every row keeps its Remove button, so the auto-filed step is reversible.

Notes stay out of panel.opportunity_context on purpose: that box feeds p11
and the Coach, and activity chatter there would degrade Interview Prep.
savedNotes is read by nothing, which is why the history belongs in it.

Also closes the doc gap the notes card shipped with (0 mentions in the guide,
0 in FEATURE_MAP) and corrects a storage comment left stale by PR #579.
```

---

## Push

Branch, PR, `gh pr checks --watch` to green, `gh pr merge --squash` per CLAUDE.md §9. Vercel auto-deploys `main` to production.

---

## Implementer's checklist

1. `git fetch origin`, branch from `origin/main`.
2. **Premise-verify before touching anything.** Confirm `savedNotes[]` seeds at `App.jsx:8053`, that `getOpSavedNotes` / `removeOpSavedNote` exist, that `saveCoachNoteToOpportunity` is the only append path, that the card at `App.jsx:12573` early-returns when empty, and that `onSaveNote` is passed ungated at `App.jsx:11707` and `:13022`. Substance-grep, not block-existence: if a user-authored note path already exists under different scaffolding, this brief is reshaping and its scope, title, and PR body change accordingly. If any premise is false, STOP and surface it.
3. Apply changes 1–7. Check App.jsx line count and EOF before and after each edit.
4. `npm run gen:coach-nav-map` after the `FEATURE_MAP` edit.
5. Run every static gate above.
6. Push, open the PR, run the preview smoke against the `reimagine2` host.
7. Watch CI to green, squash-merge.
8. Report the PR URL and the merge SHA.
