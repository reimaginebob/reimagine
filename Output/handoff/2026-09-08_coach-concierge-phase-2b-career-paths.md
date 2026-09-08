## Prompt for Code

Draft brief for Phase 2b (Arrival, Choice, and Delivery on Career Paths), following the same process as every prior phase: premise-verify against current `main`, surface real open questions, send back for review before file-level specifics are finalized or any code is written. Three real open questions are named below under "Open questions" — read those before anything else in this brief.

---

## Date / Type / Source

2026-09-08. Implementation brief for Phase 2b, per the design (`Output/handoff/2026-09-08_coach-concierge-design.md`, Sections 5 and 8) and the Phase 2 umbrella brief's split (`Output/handoff/2026-09-08_coach-concierge-phase-2-moments.md`). Written against `main` at `743abaf` (Phase 2a shipped: the `MOMENT_CATALOG`/evaluator core, `coachMoments`, dismissal/quiet, the Put It to Work Arrival moment).

Scope per the split: Arrival, Choice, and Delivery on Career Paths (`laneSelect`/`p4`/`focus`), plus Delivery on the Focus Playbook sections Phase 2a didn't touch. This is where Choice and Delivery need an actual model-generated reaction for the first time — Phase 2a's one moment (Arrival on Put It to Work) was fixed copy.

## Pre-flight discovery (scope correction)

1. **The three `justHappened` triggers map to three existing, unambiguous code paths.** `pickLane(lane)` (`:13866`) sets `selectedLane` and advances `laneSelect`→`p4` — this is `chose_lane`. `switchToRole(title,lane)` (`:13758`) calls `applyRoleSwitchDoor1` and advances `p4`→`focus`, generating `p5` — this is `chose_role`. Both are single, already-centralized call sites; no new event-tracking plumbing is needed to know a choice just happened, only to notice the screen arrived at.

2. **No stable record id exists at the moment Choice fires.** `applyRoleSwitchDoor1` (`:13659`) explicitly sets `currentSavedSlotIdRef.current=null`; a door1 record isn't minted until the first non-`p5` section builds (`afterSectionGenerate`'s `saveCurrentDoor1` call, `:11127`, gated on `key!=='p5'`). The design's literal dedupe key `(family, screen, record.id, section)` doesn't work for Choice, and doesn't work for Delivery on `p5` specifically (the very first section, built automatically by `switchToRole` itself, before any record exists). Fix: key durable dedupe on `${selectedLane}::${chosen}` (the role identity) instead of `record.id` for these two cases — the same natural key `applyRoleSwitchDoor1`'s own existing-record lookup already uses (`activePlaybooks.find(r=>r.source==='door1'&&r.title===chosen&&r.lane===selectedLane)`, `:13664`). Once a record exists, later Delivery entries can key on `record.id` as the design describes.

3. **The server-side reaction-text dispatch is already general — Choice/Delivery extend it, they don't replace it.** `buildOrientationCheckTurnText(step, text)` (`api/coach.js:629`) is a step-keyed switch to a `buildXReactionText(text)` function; `buildBrandRichnessCheckText` (`:626`) is this exact mechanism already doing Delivery's job for Personal Brand ("a judged read of what was just built... framed as an invitation," verbatim the design's Delivery description). Phase 1a's Situation already pins the in-view record (`situationRecordId`) and section (`situationSection`) on every turn, which feeds `buildPlaybookExpansion`'s built/not-built rendering and the `contextNote` line — so the model already knows what's on the table without any new context plumbing. What Phase 2b actually adds server-side is: more `buildXReactionText`-style functions (one per Focus section, following `buildBrandRichnessCheckText`'s template) and a new turn-kind branch analogous to `orientationCheckRequested`, not a new architecture.

4. **Client-side, this now genuinely needs the general catalog Bob approved building in 2a.** Unlike 2a's one static moment, 2b has three families that can all be eligible on the same screen at once (e.g., arriving at `focus` right after a role pick, with `p5` about to auto-build, could make Choice, Delivery-on-p5, and even a hub Arrival all true within moments of each other). This is exactly what `MOMENT_CATALOG`'s priority arbitration is for — Phase 2a's evaluator fires the first eligible entry and stops, which was correct with one entry and needs to become explicit priority ordering now (design: Delivery > Choice > Arrival, for the three families in scope here).

5. **Which Focus sections generate content, for Delivery's scope.** `FOCUS_ORDER`'s non-independent list (`:14827-14837`) is 11 entries; `groups` and `recruiters` are static resource lookups with no generation step (no `gp`/`go` entry) and nothing is ever "built" there — Delivery doesn't apply. The 9 that do generate: `p5, p6, p9, salaryRead, p11, p_res, p8, p7, income`.

## Open questions

**A. Arrival on Career Paths — fixed copy or model-generated?** The design's Section 5 table describes Arrival generally as personalized, model-authored copy ("says... what this screen is for in this person's terms, names the one move that fits their state") — unlike Put It to Work's Arrival, which you wrote yourself as fixed copy (Section 12). Doing that for every Arrival instance means a genuinely new server dispatch (a third reaction-text family beyond Choice/Delivery) for what might be a one-sentence orientation. Recommend: fixed copy for the single Career Paths hub-level instance (first arrival at `laneSelect`, mirroring `ptw-arrival`'s proven pattern — one sentence on what a lane's wide view is for), and defer any Focus-section-level Arrival (the "ordinary" significance, per-section empty-state instances) to Phase 3, where Next move and Stall already cover similar "what's missing here" territory and could subsume it rather than duplicating it.

**B. How many Focus sections get Delivery in 2b?** All 9 generating sections at once (uniform mechanism once one is proven, per pre-flight #3's template pattern), or a smaller first slice — `p5` and `p6`, the two sections a newly-chosen role hits first — with the remaining 7 following in a fast-follow brief once the mechanism is validated live? Recommend the smaller slice: it's genuinely new territory (the first Delivery instance outside Personal Brand), and validating tone/pacing on two sections before writing seven more reaction-text templates avoids redoing work if the first ones need adjustment.

**C. Does Choice carry an actual build tap, or is it reflection-only?** The design's "offer, if any" column names a concrete action ("Build Where You Fit" tap) — meaning Choice's message would need to compute which section is "first" for the current lane and wire a real build trigger, not just the two dismissal quick-replies every moment already gets. Recommend shipping Choice as reflection-only text (model-generated, no build tap) for 2b — the person lands directly on `focus` where the real build buttons already are, so the tap is a convenience, not a capability gap. Wiring the dynamic "which section is first" build-offer is more scope for a value that's already one click away.

## What's shared regardless of these answers

- **Dedupe key correction** (pre-flight #2) applies no matter how A/B/C resolve.
- **Server dispatch extension** (pre-flight #3) is the mechanism for whichever Delivery sections ship, at whatever count B settles on.
- **Priority ordering** in the evaluator (pre-flight #4): Delivery > Choice > Arrival, added as an explicit sort/priority field on each catalog entry rather than relying on array order (which Phase 2a's single-entry catalog didn't need to make explicit).
- **Significance**: per the design, Delivery and Choice are both significant (open the panel); the Career Paths hub Arrival (question A) is also significant, matching Put It to Work's.

## Out of scope

Next move and Stall (Phase 3, and per question A, possibly absorbing what would otherwise be per-section Arrival). Build offers / the `BUILD` tap generally (Phase 3, per the design's Section 6) beyond whatever question C resolves. Folding the *existing* `seen*` flags (framing, narration, brand-delivery) into `coachMoments` (Phase 4). Anything not on Career Paths or the Focus sections named in question B.

## Resolved 2026-09-08

Bob: "Go with your recs." A = fixed copy, one hub-level instance on `laneSelect`. B = start with `p5` (Deep Dive) and `p6` (Bridge Story) only. C = reflection-only, no build tap.

## Finalized scope and file-level specifics

Five new `MOMENT_CATALOG` entries: one static (Arrival on `laneSelect`), four model-generated (Choice on `p4`/chose-lane, Choice on `focus`/chose-role, Delivery on `p5`, Delivery on `p6`). The four generated entries are new territory for the catalog — Phase 2a's one entry was static copy pushed directly into chat. Getting their reaction text is **not** a new server mechanism: `fireOrientationCheck` (`src/App.jsx:9158`) already POSTs a silent turn from an App.jsx effect and pushes the plain-text reply into chat; the four new entries reuse that exact shape via a new sibling function, `fireMoment`.

### 1. Evaluator generalization (`src/App.jsx`)

Two things Phase 2a's one-entry, one-shot-boolean catalog didn't need:

**Priority.** Add `priority` (number) to every catalog entry. When more than one entry is eligible in the same pass (arriving at `focus` right after a role pick can make Choice-on-role, Delivery-on-p5, and even Delivery-on-p6 briefly true within moments of each other), sort eligible entries by priority descending before firing the first one — replacing 2a's implicit array-order. Values for this phase: Delivery `3`, Choice `2`, Arrival `1` (ptw-arrival gets `1` too, retroactively — it has never had a competitor so this is a no-op for it).

**Generalized dedupe.** 2a's dedupe was `coachMoments[entry.key]` — a single boolean-shaped slot per catalog row, correct only because `ptw-arrival` never repeats and is never parameterized by anything. The four new entries need two different shapes: Choice must dedupe **per role/lane identity** (a person exploring three lanes should hear the reflection once per lane, not once ever for the whole catalog row), and Delivery must dedupe **per identity AND re-fire on rebuild** (rebuilding a section is new content, and brand-richness's own precedent — `qualityCheckedFields` — already re-fires on exactly this basis). Add two optional functions per entry, both defaulting to 2a's exact current behavior when omitted (so `ptw-arrival` needs no change):

```js
// entry.dedupeKey(ctx) -> string sub-key under coachMoments[entry.key]. Default: a constant, i.e. one slot per catalog row (2a's behavior).
// entry.dedupeValue(ctx) -> string to compare against the stored value at that sub-key. Default: 'fired', i.e. once-ever (2a's behavior).
```

`coachMoments` shape becomes `{[entryKey]: {[subKey]: {value, firedAt}}}`. The evaluator's dedupe check becomes:
```js
const subKey=(entry.dedupeKey?entry.dedupeKey(ctx):'_')
const dedupeValue=(entry.dedupeValue?entry.dedupeValue(ctx):'fired')
const stored=coachMoments[entry.key]&&coachMoments[entry.key][subKey]
if(stored&&stored.value===dedupeValue)continue
```
and firing writes `setCoachMoments(m=>({...m,[entry.key]:{...m[entry.key],[subKey]:{value:dedupeValue,firedAt:new Date().toISOString()}}}))`. `ptw-arrival`'s existing `coachMoments['ptw-arrival']` reads/writes migrate to `coachMoments['ptw-arrival']['_']` — a one-line shape change, not a behavior change; the legacy `seenOrientationRouteRef` guard is unaffected (it short-circuits before dedupe is even checked).

**`ctx` gains `selectedLane` and `chosen`** (both already in scope where the evaluator effect lives) — needed by the new entries' `eligible`/`dedupeKey`/`dedupeValue`/`momentContext` functions.

### 2. The four new catalog entries (`src/coach-moments.js`)

```js
{
  key: 'career-paths-arrival',
  family: 'arrival', screen: 'laneSelect', significance: 'open', dismissible: true,
  priority: 1, promptCode: 'career_paths_arrival',
  eligible: (ctx) => !!ctx.hasOnboardingConcierge,
  message: 'This is where we look at directions beyond the one you already have in hand — three lanes, each reading your background a different way. Pick one and I\'ll show you real role options that fit it.',
  quickReplies: [],
},
{
  key: 'choice-lane', family: 'choice', screen: 'p4', significance: 'open', dismissible: true,
  priority: 2, promptCode: 'choice_lane', generated: true,
  eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.selectedLane,
  dedupeKey: (ctx) => ctx.selectedLane,
  momentContext: (ctx) => ({ lane: ctx.selectedLane, laneLabel: laneLabelFor(ctx.selectedLane) }),
},
{
  key: 'choice-role', family: 'choice', screen: 'focus', significance: 'open', dismissible: true,
  priority: 2, promptCode: 'choice_role', generated: true,
  eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.chosen && !!ctx.selectedLane,
  dedupeKey: (ctx) => `${ctx.selectedLane}::${ctx.chosen}`,
  momentContext: (ctx) => ({ roleTitle: ctx.chosen, laneLabel: laneLabelFor(ctx.selectedLane) }),
},
{
  key: 'delivery-p5', family: 'delivery', screen: 'focus', significance: 'open', dismissible: true,
  priority: 3, promptCode: 'delivery_p5', generated: true,
  eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!(ctx.outputs && ctx.outputs.p5) && !!ctx.chosen,
  dedupeKey: (ctx) => `${ctx.selectedLane}::${ctx.chosen}`,
  dedupeValue: (ctx) => ctx.outputs.p5,
  momentContext: (ctx) => ({ section: 'p5', text: ctx.outputs.p5 }),
},
{
  key: 'delivery-p6', family: 'delivery', screen: 'focus', significance: 'open', dismissible: true,
  priority: 3, promptCode: 'delivery_p6', generated: true,
  eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!(ctx.outputs && ctx.outputs.p6) && !!ctx.chosen,
  dedupeKey: (ctx) => `${ctx.selectedLane}::${ctx.chosen}`,
  dedupeValue: (ctx) => ctx.outputs.p6,
  momentContext: (ctx) => ({ section: 'p6', text: ctx.outputs.p6 }),
},
```
`laneLabelFor` (`src/App.jsx:5574`) needs exporting for `coach-moments.js` to import, or the label can be resolved App.jsx-side and passed through `ctx` instead — premise-verify which is cleaner against the file's actual export surface before implementing (leaning toward resolving in `ctx` since `coach-moments.js` otherwise has no App.jsx imports at all today).

**laneSelect Arrival's copy is new, not previously confirmed by Bob** (unlike `ptw-arrival`'s verbatim design-doc wording) — run it past the standard voice-rule stack same as any new Clarity-producing copy, and treat it as provisional until this brief is approved.

### 3. `fireMoment` (`src/App.jsx`), modeled directly on `fireOrientationCheck` (`:9158`)

```js
const momentFetchingRef=useRef({})
const fireMoment=(entry,ctx)=>{
  const subKey=entry.dedupeKey?entry.dedupeKey(ctx):'_'
  const trackKey=`${entry.key}:${subKey}`
  if(momentFetchingRef.current[trackKey])return
  momentFetchingRef.current={...momentFetchingRef.current,[trackKey]:true}
  ;(async()=>{
    setCoachThinkingCount(c=>c+1)
    try{
      if(saveRef.current)await saveRef.current()
      const res=await fetch('/api/coach',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({moment:{key:entry.key,...entry.momentContext(ctx)},history:chatMessages.slice(-10),currentStep:step,situation:computeSituation(),surface:'sidebar'})})
      if(!res.ok)return
      const raw=await res.text()
      const reply=raw&&raw.trim()
      if(entry.promptCode)logPromptEngagement(entry.promptCode,'hub_arrival','shown')
      if(reply){
        const quickReplies=entry.dismissible?[{label:'I\'m good for now',value:'moment-quiet-session'},{label:'Not on this screen',value:'moment-quiet-screen'}]:[]
        setChatMessages(m=>[...m,{role:'assistant',banner:true,content:reply,checkinKey:`moment:${entry.key}`,quickReplies}])
        if(entry.significance==='open')setCoachPresence('open')
      }
    }catch{
      // Release both guards on failure so a transient error doesn't
      // permanently block this moment for the rest of the session --
      // same reasoning as fireOrientationCheck's own catch block.
      const{[trackKey]:_dropped,...rest}=momentFetchingRef.current
      momentFetchingRef.current=rest
    }finally{
      setCoachThinkingCount(c=>c-1)
    }
  })()
}
```
Note this does NOT write `coachMoments` on success/failure the way the evaluator does for static entries — the evaluator marks dedupe optimistically at fire time (before knowing whether the call succeeds), matching `fireOrientationCheck`'s own precedent of accepting a fire-and-forget dedupe rather than a round-trip-confirmed one. A failed generated moment is retried by the transient-failure release path in the `catch` above (mirrors `fireOrientationCheck`'s `orientationCheckFiredRef` release), the same trade-off already accepted for orientation checks.

### 4. The evaluator's fire branch splits on `entry.generated`

Where 2a's evaluator unconditionally builds `quickReplies` and calls `setChatMessages` directly, that branch becomes:
```js
if(entry.generated){fireMoment(entry,ctx)}
else{/* 2a's existing static-push branch, unchanged */}
```
placed after the (now-generalized) dedupe write, before `setPbCheckinOpenReq(x=>x+1)`.

### 5. Server: `api/coach.js`

**Request shape + authoritative gate**, following `orientationCheckRequested`'s exact three-step pattern (`:2029-2034`):
```js
const MOMENT_KEYS=['choice-lane','choice-role','delivery-p5','delivery-p6']
const momentShapeOk=req.body&&req.body.moment&&typeof req.body.moment==='object'&&typeof req.body.moment.key==='string'&&MOMENT_KEYS.includes(req.body.moment.key)
const momentRequested=momentShapeOk&&!generalMode&&hasOnboardingConcierge({feature_flags:featureFlags,email:user.email})
if(momentShapeOk&&!momentRequested&&(!rawMessage||typeof rawMessage!=='string'))return res.status(400).json({error:'message required'})
```
Reusing `hasOnboardingConcierge` rather than minting a new flag: this is still the same internal-only pilot as every other Coach-as-Concierge piece shipped so far, and splitting the gate now buys nothing while it's Bob-only. **Worth a note, not a blocker:** the flag's name increasingly undersells its scope now that it also gates Put It to Work and Career Paths, not just onboarding — a rename is a docs/reference-only cleanup to consider once the whole project stabilizes, not part of this phase.

**Reaction-text dispatch**, new functions alongside `buildBrandRichnessCheckText` (`:626`), dispatched by `moment.key` the same way `buildOrientationCheckTurnText` dispatches by `step`:
```js
function buildChoiceLaneReactionText(laneLabel) {
  return `[They just chose ${laneLabel} as a direction to explore on Career Paths. Reflect the choice against their Personal Brand in one line -- what picking this lane says about where they're pointed, using something real from their brand rather than restating the lane's own description. Then name in one sentence what building the first role option's Where You Fit will tell them. Two sentences total, no more. Open with this directly, in your own voice. Do not mention that this is an automated check.]`
}
function buildChoiceRoleReactionText(roleTitle, laneLabel) {
  return `[They just picked "${roleTitle}" (${laneLabel}) as the specific role to build a playbook around. Reflect the choice against their Personal Brand in one line -- something real that connects this specific role to who they are, not a restatement of the title. Then name in one sentence what building Where You Fit will tell them about this specific role. Two sentences total, no more. Open with this directly, in your own voice. Do not mention that this is an automated check.]`
}
function buildFocusDeliveryReactionText(sectionLabel, text) {
  return `[They just built ${sectionLabel} for this role. Here is what was built:\n\n${clip(text)}\n\nGive a short, genuine read: one specific strength actually in what they built, and at most one thing that would make it richer, framed as an invitation ("if you'd like...") never a correction. If it is already strong on both counts, say so plainly and specifically and stop there -- do not manufacture a suggestion where none is warranted. Keep it to a few sentences, never a list. Open with this directly, in your own voice -- this is the first thing they see after it was built. Do not mention that this is an automated check.]`
}
function buildMomentTurnText(key, ctx) {
  if (key === 'choice-lane') return buildChoiceLaneReactionText(ctx.laneLabel)
  if (key === 'choice-role') return buildChoiceRoleReactionText(ctx.roleTitle, ctx.laneLabel)
  if (key === 'delivery-p5') return buildFocusDeliveryReactionText(NAV_LABELS.p5, ctx.text)
  if (key === 'delivery-p6') return buildFocusDeliveryReactionText(NAV_LABELS.p6, ctx.text)
  return ''
}
```
`clip` and `NAV_LABELS` are already imported/available in `api/coach.js` (used by the existing brand-richness/orientation-check functions and elsewhere respectively) — premise-verify both before implementing.

**Wiring into the message/turnKind resolution** (`:2043-2054`), same precedence pattern as the three existing silent-turn shapes:
```js
const message=(typeof rawMessage==='string'&&rawMessage.trim())?rawMessage
  :orientationCheckRequested?buildOrientationCheckTurnText(orientationCheck.step,orientationCheck.text)
  :postCaptureUpdateRequested?buildPostCaptureTurnText(postCaptureUpdate)
  :momentRequested?buildMomentTurnText(moment.key,moment)
  :(sessionOpenRequested?SESSION_OPEN_TURN_TEXT:'')
const turnKind=computeTurnKind(rawMessage,{orientationCheckRequested,postCaptureUpdateRequested,momentRequested,sessionOpenRequested})
```
`computeTurnKind` (`:505`) gains one branch, in the same precedence chain, returning `'moment'`:
```js
export function computeTurnKind(rawMessage,{orientationCheckRequested,postCaptureUpdateRequested,momentRequested,sessionOpenRequested}){
  if(typeof rawMessage==='string'&&rawMessage.trim())return'user'
  if(orientationCheckRequested)return'orientation_check'
  if(postCaptureUpdateRequested)return'post_capture'
  if(momentRequested)return'moment'
  if(sessionOpenRequested)return'session_open'
  return'user'
}
```
No change needed to `isSilentTurn`/`effort` (`:1824`, `:2100`) — both already treat any non-`'user'` `turnKind` identically, which is exactly what a new value should get for free (this was confirmed during premise-verification for the umbrella brief).

`moment` itself is destructured from `req.body` alongside the existing `orientationCheck`/`postCaptureUpdate` reads and passed into `buildCoachRequest` the same way `situation` was added in Phase 1a.

### 6. `src/coach-prompt-codes.js`

Add `'career_paths_arrival'`, `'choice_lane'`, `'choice_role'`, `'delivery_p5'`, `'delivery_p6'` to `PROMPT_CODES`.

## Voice rules on inserted text

`career-paths-arrival`'s message is new copy, not pre-confirmed — checked here against the standing rules: no logic-flip cadence, no comparative standing ("most people"), no AI-coaching register, no rooms-as-conversations, no typology labels, no slogan-cadence closers, plain language throughout. All four `buildXReactionText` functions carry the same TRANSLATION-NOT-PRAISE / EVIDENCE-ANCHORED / EPISTEMIC-CALIBRATION instruction stack the existing `buildBrandRichnessCheckText` template already uses, applied at the same strength. Run `check-voice` regardless.

## Static gates

Same as every prior phase: `npm run build` clean, `check-voice` 0/0 (watch for `intensifier-truly-genuinely` in new comments, per the recurring false-positive), `check-prompt-refs` 0, `check-coach-nav-map` unchanged (no new Coach-nav-facing capability), App.jsx EOF integrity, diff scope limited to the files above, `npm run test` green including a new `scripts/test-coach-moments-career-paths.mjs`.

## Constraints

Single PR. No effort estimates. PR title: `Coach-as-Concierge Phase 2b: Choice and Delivery on Career Paths`.

## Out of scope

Delivery on the other 7 generating Focus sections (fast-follow brief once this ships and reads well live, per resolved B). Per-section Arrival on individual Focus sections and any Career-Paths-flavored Next move/Stall (Phase 3). The `hasOnboardingConcierge` rename noted above (separate docs-only cleanup, not blocking). Folding the pre-2a `seen*` flags into `coachMoments` (Phase 4).

## Next step

One more look before code, same as every phase: confirm the `career-paths-arrival` copy (the one piece of new user-facing text without your prior sign-off), and say go.
