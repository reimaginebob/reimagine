# Coach Card Rework — Phase 1 of the Opportunity Playbook proactive-signals brief

## Prompt for Code

Apply the changes in this brief, premise-verify every quoted line against current `main` before editing (the codebase moves; this brief is a snapshot), run the static gates, follow the gh flow in CLAUDE.md §9, and report the PR URL + merge SHA. This is Phase 1 (Card Rework) of `Output/handoff/2026-09-06_coach-opportunity-playbook-proactive-signals.md` — read that brief first for the full three-category context; this document is the ready-to-implement slice of it. Bob has confirmed: reuse `SECTION_REWORK_FLAG` (no new flag), no screen-anchoring requirement, and the design generally. One new finding since that brief was written, load-bearing for this implementation: `generateOpSection`/`refineOpCard` operate on the *currently open* opportunity (`currentSavedSlotIdRef.current`), not an explicit ID — unlike the pipeline-capture write path. A tap on this offer must switch the open opportunity first if the matched one isn't already current. See "Pre-flight discovery" below.

## Date / Type / Source

2026-09-06. Implementation brief, Phase 1 of a larger design brief. Source: Bob's live Coach testing today, the follow-on design discussion, and Bob's explicit confirmation of the open questions (flag reuse, no anchoring) plus his supply-chain Resume Refresh example, which is this phase's canonical test case.

## What this ships

Coach may now notice, from anywhere in a conversation about a saved opportunity, that something said should change what a specific Opportunity Playbook card says — not just fix an error (that's what section rework already does for the Focus Playbook), but also steer emphasis ("push the supply chain angle harder"). It proposes reworking that card; the user's tap is what actually regenerates it, exactly like every other capture mechanism this session built. Nothing changes automatically, and nothing is claimed as done until the tap lands.

## Pre-flight discovery

Verified against current `main` before drafting the specific changes below:

- **`SECTION_REWORK_FLAG` / `hasSectionRework`** (`api/_lib/feature-flags.js:137-143`) auto-grants internal (`@career.club`) accounts and is otherwise dashboard-grantable (`GRANTABLE_FLAGS`, same file, line ~159). Per Bob's decision, this brief reuses it rather than adding a new flag. The flag's own header comment (lines 130-136) currently describes its scope as "the single-target Focus Playbook sections" only — this comment goes stale the moment this ships and must be corrected in the same PR (see Specific Changes).

- **`sectionReworkTarget`** (`src/App.jsx:8146`) is hard-gated to `coachReturn.step==='focus'` — it structurally cannot fire on an Opportunity Playbook screen and is untouched by this brief. Card Rework is a new, parallel mechanism, not an extension of this one, because (a) per Bob's confirmed decision it must not require screen-anchoring, and (b) `SECTION_REWORK_CAPTURE_NOTE`'s trigger condition ("something specifically WRONG or OFF") doesn't fit a steering note that was never wrong to begin with.

- **The reusable generation mechanism is `refineOpCard(cardKey, correctionText)`** (`src/App.jsx:11939-11949`), already built and shipped (PR-A op-card-refinebox, 2026-05-30) as the manual RefineBox's own dispatcher:
  ```js
  const refineOpCard=(cardKey,correctionText)=>{
    if(cardKey==='p6')return
    recordCorrection(cardKey,correctionText)
    if(cardKey==='companyRead'){
      generateOpCompanyRead(correctionText)
    }else if(cardKey==='p_cover'){
      generateOpCoverLetter(correctionText)
    }else{
      generateOpSection(cardKey,undefined,correctionText)
    }
  }
  ```
  It already covers `companyRead`, `p5`, `p_res`, `p11`, `p_cover`. It explicitly excludes `p6` (Bridge Story has its own RefineBox at `src/App.jsx:15162`, calling `generateOpBridgeStory({refine:v})` directly) and it doesn't cover `salaryRead` (its own RefineBox at `src/App.jsx:15138` calls `generateOpSalaryRead(v)` directly, and `salaryRead` is not part of `OP_COUNTED_KEYS` — it's treated as a reference card, not a core deliverable).

  **v1 scope recommendation:** target exactly `OP_COUNTED_KEYS` (`src/App.jsx:1399`: `['companyRead','p5','p6','p_res','p_cover','p11']`) — an existing, precedented enumeration — dispatching through `refineOpCard` for five of the six and through `generateOpBridgeStory({refine:v})` for `p6`. Exclude `salaryRead` (different generation semantics, not a counted deliverable) and the independent track's `clientRead`/`clientPlay` (mirrors the `!isIndependent` exclusion already established for `opportunityUpdateCaptureActive`).

- **Load-bearing new finding: none of these functions take a target ID.** `generateOpSection` (`src/App.jsx:10828`) opens with `const slotId=currentSavedSlotIdRef.current` — it and everything `refineOpCard` calls operate on whichever opportunity is currently open in the UI, not a parameter. This is different from `savePursuit(targetId, patch)` and `updateOpPanel(targetId, ...)`, which `OPPORTUNITY_UPDATE_CAPTURE_NOTE`'s write path already uses successfully on a title-matched opportunity that need not be the one currently open (`src/App.jsx:7623-7636`). Consequence: **the tap handler for Card Rework must first make the matched opportunity the current one** (`restoreFromSavedSlot(match)`, the same call `checkinKey==='pursuit-saved-open'` already uses at `src/App.jsx:7600`) before calling `refineOpCard` or `generateOpBridgeStory`. This is a real UX moment worth being deliberate about, not just a technical fixup: tapping "Update it" on a different opportunity than the one on screen will navigate the person there, which is correct (they need to see the card change) but should not be silent — the tap's own follow-up message should say so plainly, mirroring the existing "Saved. On {title}, your ... Open {title} / Stay here" pattern rather than teleporting the screen with no explanation.

- **Title→opportunity resolution precedent** (`src/App.jsx:7622-7625`, the `checkinKey==='opportunity-update'` handler): fuzzy-match `data.opportunity` (lowercased, `.includes()`) against `activePlaybooks` filtered to `source==='door2'`, falling back to `coachSaveTarget()`. Reuse this exact pattern rather than inventing a new resolver.

- **Trailer-parsing precedent** (`api/coach.js:1710-1719`, `SECTIONREWORK:` handling): regex-match a trailing `KEYWORD: {json}` line, strip it from the visible reply, parse and validate, cap free text length (600 chars), base64-encode onto a response header. Card Rework's parser follows the same shape with its own keyword and header name.

- **Profile-block wiring precedent** (`api/coach.js:742` and the final template at line 809): `opportunityUpdateNote` is computed once, gated only on the flag (no independent-track exclusion server-side — that exclusion lives client-side, in whether the resulting header is ever parsed), and spliced into the always-present template string. Card Rework's note follows the same shape.

- **`OP_CARD_LABELS`** (`src/App.jsx:12493`): `{companyRead:'About This Company',p5:'Where you fit',p6:'Bridge Story',p_res:'Resume Refresh',p_cover:'Cover Letter',p11:'Interview Prep'}` — already the exact user-facing label set needed for both the model's own instruction text and the client's tap-offer copy. Reuse verbatim; do not invent parallel labels.

## Files affected

| File | Change |
|---|---|
| `api/_lib/feature-flags.js` | Update `SECTION_REWORK_FLAG`'s header comment (lines 130-136) to reflect its now-broader scope. No behavior change. |
| `api/coach.js` | New `OP_CARD_REWORK_CAPTURE_NOTE` constant; wire it into `buildCoachProfileSlice`'s note computation and template; new trailer parser (`OPCARDREWORK:`) alongside the existing `SECTIONREWORK:`/`OPPORTUNITYUPDATE:` parsers; new response header `X-Coach-Op-Card-Rework`. |
| `src/components/Chat.jsx` | New prop `opCardReworkCaptureActive`; parse the new header into a tap offer, mirroring the `ouHeader`/opportunity-update block exactly (recap what it heard, one-tap "Update it" / "Not now"). |
| `src/App.jsx` | New prop wiring at both `<Chat>` mounts (`opCardReworkCaptureActive={hasPipeline&&!isIndependent&&hasSectionRework}`); new `checkinKey==='op-card-rework'` branch in the quick-reply handler (resolve opportunity by title with `coachSaveTarget()` fallback per the precedent above, `restoreFromSavedSlot` if it isn't already current, dispatch to `refineOpCard` or `generateOpBridgeStory({refine:v})` per the `OP_COUNTED_KEYS` dispatch table). |
| `src/data/user-guide/` | Per CLAUDE.md §8, and per the pilot-documentation partitioning rule (this is gated, staff-only for now) — add to whichever pilot knowledge file already documents section rework for Coach's own grounding, not to a chapter listed in `ORDER.json`. Verify where `SECTION_REWORK_CAPTURE_NOTE`'s existing capability is documented today and follow the identical pattern; if it currently has no dedicated doc entry, this brief's implementer should find precedent before inventing a new documentation location. |
| `scripts/test-coach-op-card-rework.mjs` (new) | Regression test following the existing `test-coach-*.mjs` pattern (see `test-coach-post-capture-followup.mjs` for the closest analog: a new capture note + header + client prop + quick-reply dispatch, all wired end to end). |
| `package.json` | Append the new test file to the `test` script chain. |

## Specific changes

### 1. `api/_lib/feature-flags.js` — correct the now-stale scope comment

Current (lines 130-136):
```js
// PILOT -- Section rework from chat, 2026-09-05. Generalizes the correction
// bridge already shipped for Personal Brand (BRAND_REWORK_CAPTURE_NOTE,
// onboarding_concierge) to the single-target Focus Playbook sections: Bridge
// Story, Resume Refresh, Industry Background, Income Now. A separate flag
// from onboarding_concierge on purpose -- unlike the p3 bridge, this fires
// any time on these screens, not just during the onboarding delivery moment,
// so it is its own rollout Bob can QC and toggle independently.
```

Append a paragraph (do not rewrite the existing one — it stays accurate for what it describes):
```js
//
// Extended 2026-09-06 to also gate Card Rework: the same "a chat correction
// reworks a specific piece of content" idea, applied to Opportunity Playbook
// cards (companyRead, p5, p6, p_res, p_cover, p11) instead of Focus Playbook
// sections, and without the screen-anchoring the original mechanism requires
// -- Coach can propose a card rework from anywhere in an opportunity
// conversation, not only when the chat was opened from that card's own "Ask
// My Coach about this." Reusing this flag rather than adding a new one is a
// deliberate choice: both are the same capability idea on two surfaces, and
// during the pilot period both are staff-only regardless (isInternalAccount
// auto-grants either way).
```

### 2. `api/coach.js` — new capture note

Insert after `SECTION_REWORK_CAPTURE_NOTE`'s definition (after line 153, before the blank line that precedes the next section):

```js
// OP CARD REWORK CAPTURE, 2026-09-06. Sibling to SECTION_REWORK_CAPTURE_NOTE
// above, not a reuse of it: that mechanism requires the conversation to have
// started from a specific Focus Playbook section's own "Ask My Coach about
// this," and only fires on something the person names as WRONG. This one is
// deliberately broader on both axes -- it fires from anywhere in a
// conversation about a saved opportunity, and it fires on steering input as
// well as corrections (a recruiter's "push the supply chain angle harder" was
// never wrong; it's new information the resume should reflect). Because
// there's no screen to anchor on, the model names both the opportunity and
// the target card itself, the same way OPPORTUNITY_UPDATE_CAPTURE_NOTE
// already resolves an opportunity by title rather than by screen context.
const OP_CARD_REWORK_CAPTURE_NOTE = '\n\nOP CARD REWORK CAPTURE: each opportunity\'s playbook has these cards, and each can be reworked from a note like the one you would write here: About This Company, Where you fit, Bridge Story, Resume Refresh, Cover Letter, Interview Prep. When this person tells you something -- a correction, or new information they only just learned (something a recruiter or interviewer said, a detail about the role or company) -- that should change what a SPECIFIC one of these already-built cards says, end your reply with a final line exactly like OPCARDREWORK: {"opportunity":"<the opportunity title from their saved work>","section":"p_res","note":"<what should change, tightened to the point, in their own words, not your paraphrase>"} using one of these section values only: companyRead, p5, p6, p_res, p_cover, p11. Only propose a card that is already built -- check WHAT IS BUILT ON THIS PLAYBOOK (or the index) before naming one; if the right card doesn\'t exist yet, tell them to build it instead, plainly, and do not emit this line. Do not emit it for a vague reaction, a question, or a compliment -- there must be something concrete enough to actually change the card\'s content. If more than one card could plausibly change, name the single one their comment is most clearly about; never propose two cards in one reply. The app turns the line into a one-tap offer naming the card and the note, and never shows the line itself, so do not mention it and do not ask them to confirm separately -- the offer already asks that. NEVER SAY YOU HAVE UPDATED, REWORKED, OR CHANGED ANYTHING -- their tap is the only thing that writes. At most once per reply; otherwise omit it entirely.'
```

Wire it into `buildCoachProfileSlice`, alongside `opportunityUpdateNote` (current line 742):
```js
  const opportunityUpdateNote = hasPipelineCapture({ feature_flags: featureFlags, email: userEmail }) ? OPPORTUNITY_UPDATE_CAPTURE_NOTE : ''
  const opCardReworkNote = hasSectionRework({ feature_flags: featureFlags, email: userEmail }) ? OP_CARD_REWORK_CAPTURE_NOTE : ''
```

Add `${opCardReworkNote}` to the template return (current line 809), immediately after `${opportunityUpdateNote}`:
```js
  return `THIS USER'S REIMAGINE PROFILE ...${opportunityUpdateNote}${opCardReworkNote}${activityNote}${coachNoteAgencyNote}...`
```

Trailer parser, inserted after the existing `SECTIONREWORK:` block (after line 1719):
```js
  // Op card rework capture: the model may end with an OPCARDREWORK: {json}
  // line naming an opportunity, a specific already-built card, and a note.
  // Unlike SECTIONREWORK above, the section here IS read from the model's own
  // json, because there is no screen context to read it from server-side --
  // validated against a fixed enum so a malformed value can never point the
  // client's write at an arbitrary key.
  let opCardReworkB64 = null
  const ocrMatch = strippedText.match(/^\s*OPCARDREWORK:\s*(\{[\s\S]*?\})\s*$/im)
  if (ocrMatch) {
    strippedText = strippedText.replace(ocrMatch[0], '').trim()
    try {
      const parsed = JSON.parse(ocrMatch[1])
      const section = typeof (parsed && parsed.section) === 'string' ? parsed.section : ''
      const note = typeof (parsed && parsed.note) === 'string' ? parsed.note.trim().slice(0, 600) : ''
      const opportunity = typeof (parsed && parsed.opportunity) === 'string' ? parsed.opportunity.trim().slice(0, 200) : ''
      const validSection = ['companyRead', 'p5', 'p6', 'p_res', 'p_cover', 'p11'].includes(section)
      if (validSection && note) opCardReworkB64 = Buffer.from(JSON.stringify({ section, note, opportunity })).toString('base64')
    } catch { /* malformed — drop the line, no offer */ }
  }
```

Set the header alongside the others (current line 1827-1828):
```js
  if (sectionReworkB64) res.setHeader('X-Coach-Section-Rework', sectionReworkB64)
  if (opCardReworkB64) res.setHeader('X-Coach-Op-Card-Rework', opCardReworkB64)
  if (opportunityUpdateB64) res.setHeader('X-Coach-Opportunity-Update', opportunityUpdateB64)
```

**Verify at implementation time:** confirm `strippedText` is still in scope at the insertion point (it is reassigned by each preceding parser block in sequence — `brandReworkB64`'s block, then `secMatch`'s block — so the new block must run after both, operating on the already-stripped text, exactly as shown above).

### 3. `src/components/Chat.jsx` — parse the header, render the offer

Add to the prop list (current line 39), alongside `sectionReworkTarget`:
```js
opCardReworkCaptureActive = false,
```

Read the header alongside the others (current line 528):
```js
const ocrHeader = res.headers.get('X-Coach-Op-Card-Rework') || null
```

New block, modeled directly on the `opportunityUpdateCaptureActive` block (current lines 588-619) — insert after it:
```js
        // Op card rework: the server named a specific built card and a note
        // that should change it. Recap both in plain language before offering
        // the tap -- the person should know exactly what's about to change
        // and where, the same as every other capture offer.
        if (opCardReworkCaptureActive && ocrHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(ocrHeader), c => c.charCodeAt(0))))
            const section = data && typeof data.section === 'string' ? data.section : ''
            const note = data && typeof data.note === 'string' ? data.note.trim() : ''
            const label = OP_CARD_LABELS_FOR_CHAT[section] || section
            if (section && note) {
              const where = data.opportunity ? ` on ${data.opportunity}` : ''
              setMessages(m => [...m, {
                role: 'assistant',
                content: `Want me to update ${label}${where} with this: "${note}"?`,
                checkinKey: 'op-card-rework',
                quickReplies: [
                  { label: `Update ${label}`, value: JSON.stringify(data) },
                  { label: 'Not now', value: 'dismiss' },
                ],
              }])
            }
          } catch { /* malformed header — no offer */ }
        }
```

**Open implementation detail, not yet resolved:** this block needs the card labels (`OP_CARD_LABELS`, `src/App.jsx:12493`) but Chat.jsx is a separate module. Either import a small shared constant (new file, e.g. `src/op-card-labels.js`, imported by both `App.jsx` and `Chat.jsx` — the clean fix, since `OP_CARD_LABELS` is currently defined inline inside a component function in `App.jsx` and isn't importable as-is) or inline a duplicate map in `Chat.jsx` with a comment cross-referencing `OP_CARD_LABELS` so the two are kept in sync by convention. Recommend the shared-file extraction — cheap, and this is exactly the kind of duplication CLAUDE.md's docs-currency thinking warns against letting drift. Extracting it also lets `App.jsx`'s existing `OP_CARD_LABELS` become an import rather than an inline `const`, which is a one-line change at its current definition site.

### 4. `src/App.jsx` — prop wiring and the write path

Add the prop at both `<Chat>` mounts (current lines 14300 and 16173), alongside `opportunityUpdateCaptureActive`:
```js
opCardReworkCaptureActive={hasPipeline&&!isIndependent&&hasSectionRework}
```

**Verify at implementation time** whether `hasSectionRework` already exists as a client-side boolean in scope at both mount sites (the same way `hasPipelineCapture`, `hasOnboardingConcierge`, `hasCoachNoteAgency` already do, feeding `sectionReworkTarget`'s computation at line 8146) — if it's already destructured from wherever feature flags land client-side, this is a one-line addition; if not, trace how `sectionReworkTarget` gets its `hasSectionRework` today and mirror that exactly.

New quick-reply branch, inserted after the `checkinKey==='opportunity-update'` block (after line 7648, before the `checkinKey==='interview-team'` block):
```js
    // Op card rework (2026-09-06): Coach named a specific already-built op
    // card and a note that should change it. Resolve the opportunity by
    // title exactly like opportunity-update above, then make it the CURRENT
    // slot before calling the rework dispatcher -- refineOpCard and its
    // siblings operate on currentSavedSlotIdRef, not a passed id, unlike
    // savePursuit/updateOpPanel above. If the matched opportunity isn't
    // already open, this switches the screen to it, which is correct (the
    // person needs to see the card change) but must be said plainly, not
    // done silently.
    if(checkinKey==='op-card-rework'){
      if(value==='dismiss')return true
      let data;try{data=JSON.parse(value)}catch{return false}
      const section=data&&typeof data.section==='string'&&['companyRead','p5','p6','p_res','p_cover','p11'].includes(data.section)?data.section:''
      const note=data&&typeof data.note==='string'?data.note.trim():''
      if(!section||!note)return false
      const oppName=String(data.opportunity||'').trim().toLowerCase()
      const match=oppName?activePlaybooks.find(r=>r&&r.source==='door2'&&String(r.title||'').toLowerCase().includes(oppName)):null
      const tgt=coachSaveTarget()
      const targetRec=match||(tgt&&activePlaybooks.find(r=>r&&r.id===tgt.id))||null
      if(!targetRec)return false
      const switchedView=currentSavedSlotIdRef.current!==targetRec.id
      if(switchedView)restoreFromSavedSlot(targetRec)
      if(section==='p6')generateOpBridgeStory({refine:note})
      else refineOpCard(section,note)
      const label=OP_CARD_LABELS[section]||section
      return{content:switchedView?`Updating ${label} on ${targetRec.title||'this opportunity'} now — I've opened it so you can watch it rebuild.`:`Updating ${label} now.`,checkinKey:'op-card-rework-started'}
    }
```

**Verify at implementation time, all load-bearing:**
- The exact shape `restoreFromSavedSlot` expects (a full record vs. an id) — the `pursuit-saved-open` precedent at line 7600 calls it with a full record found via `activePlaybooks.find`, matching what's shown above.
- Whether `refineOpCard`/`generateOpBridgeStory` show their own loading state on the card the person is about to be switched to, so "I've opened it so you can watch it rebuild" is actually true rather than aspirational copy — confirm the existing Rebuild-button UX already does this (it should, since this reuses the identical functions) before shipping this exact wording.
- Whether a bare `{content, checkinKey}` return (no `quickReplies`) reads correctly in the chat UI, matching how other terminal confirmations in this same handler are shaped.

## Voice rules on inserted text

`OP_CARD_REWORK_CAPTURE_NOTE`'s instruction text and the two new user-visible strings in Chat.jsx (`Want me to update ${label}...` and the two post-tap confirmations) were checked against the banned-construction list: no logic-flip cadence, no comparative standing, no AI-coaching register, no typology labels, no sincerity qualifiers. They will also run through `check-voice.mjs` as part of the normal build gate — this is a note only, not a substitute for that gate.

## Static gates

- `npm run build` clean — full prebuild chain (`check-voice`, `check-sys-equality`, `check-prompt-refs`, `check-coach-nav-map`, `check-fontsize`, `check-btn-prominence`, `check-guide-refs`, the full `npm run test` chain, `npm run lint`).
- `App.jsx` EOF integrity confirmed before and after (per CLAUDE.md §5/§8 — always verify line count and final closing tag/brace).
- New `scripts/test-coach-op-card-rework.mjs` added to the `package.json` `test` chain, following the existing `test-coach-*.mjs` shape: assert the capture note text, the flag gating, the trailer regex and section-enum validation, the header name, the `Chat.jsx` prop plumbing and parsing block, and the `checkinKey==='op-card-rework'` dispatch (title resolution, `restoreFromSavedSlot` call, the `p6` vs. `refineOpCard` branch).
- Diff scope limited to the files in the table above.

## Runtime gate (post-merge)

Manual smoke on a `@career.club` account (auto-granted `hasSectionRework`) with a saved opportunity that has at least one built card: tell Coach something that should change a specific already-built card (the canonical test case — mention a recruiter's steering note about the resume) while NOT on that card's own screen, confirm the tap offer names the right card and the right opportunity, confirm the tap rebuilds only that card, and confirm the "not built yet" branch (mention something relevant to a card that hasn't been built) correctly redirects to building it instead of proposing a rework.

## Constraints

Single PR. No effort estimates. PR title: `Coach: propose reworking an Opportunity Playbook card from chat`.

## Out of scope

- Opportunity Context capture and Milestone Prompt (Phases 2 and 3 of the parent brief) — separate PRs.
- `salaryRead`, and the independent track's `clientRead`/`clientPlay` — excluded from v1 per the scope recommendation above.
- Any change to `sectionReworkTarget` or the Focus Playbook's existing section rework — untouched.
- Cross-category arbitration (what happens when this and `OPPORTUNITY_UPDATE_CAPTURE_NOTE` could both fire in the same turn) — flagged in the parent brief as needing a live eval once at least two of the three new categories are shipped; not this PR's problem alone, since today only one new category exists.

## Commit message

```
Add Coach-driven rework offers for Opportunity Playbook cards

Extends the "a chat correction reworks specific content" pattern already
shipped for the Focus Playbook (section rework) to Opportunity Playbook
cards, without requiring the conversation to be anchored to that card's
own screen -- Coach can propose reworking a built card (About This
Company, Where you fit, Bridge Story, Resume Refresh, Cover Letter,
Interview Prep) from anywhere in a conversation about that opportunity,
on a correction or new steering information alike. The tap is still the
only thing that writes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Qbsj3ds9Cfozte1ASdRrDx
```

## Push

Branch, PR, CI watch, squash-merge per CLAUDE.md §9 (this session: GitHub MCP tools, not `gh` CLI). Preview smoke test required since this touches `api/coach.js`.

## Implementer's checklist

1. Pull `main` fresh; create a new branch.
2. Re-verify every quoted line/line-number above against current `main` (SECTION_REWORK_FLAG comment, refineOpCard, generateOpSection, the opportunity-update trailer parser and header block, OP_CARD_LABELS, both `<Chat>` mount sites, the `checkinKey==='opportunity-update'` handler) — STOP and surface back if any has drifted materially rather than proceeding on this snapshot.
3. Resolve the `OP_CARD_LABELS` sharing question (extract to a shared module vs. duplicate-with-comment) before writing `Chat.jsx`'s block.
4. Apply the changes.
5. Confirm `hasSectionRework`'s client-side availability at both Chat mount sites; wire the new prop.
6. Write `scripts/test-coach-op-card-rework.mjs`; add it to `package.json`.
7. Run `npm run build` clean; verify `App.jsx` line count/EOF before and after.
8. Update `src/data/user-guide/` per the pilot-documentation pattern (find where section rework is already documented for Coach's own grounding and mirror it — do not add to `ORDER.json`).
9. Push, open PR, smoke-test the preview (`/api/health`, `/api/claude` per CLAUDE.md's Vercel runtime-constraints section, since this touches `api/coach.js`), watch CI, squash-merge.
10. Manual runtime check per "Runtime gate" above.
11. Report PR URL + merge SHA.
