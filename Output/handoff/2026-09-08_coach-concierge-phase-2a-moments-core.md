## Prompt for Code

Apply the changes in this brief, premise-verify each against current `main` first, run the static gates, follow the gh flow, and report the PR URL + merge SHA.

---

## Date / Type / Source

2026-09-08. Implementation brief for Phase 2a, per the Coach-as-Concierge design (`Output/handoff/2026-09-08_coach-concierge-design.md`) and the Phase 2 umbrella brief (`Output/handoff/2026-09-08_coach-concierge-phase-2-moments.md`), which this brief supersedes for the 2a slice. Bob resolved two open questions on 2026-09-08: build the general catalog + evaluator now (not a pragmatic per-family extension), and split Phase 2 into 2a (this brief: the core mechanism, proven by migrating the existing routing question) and 2b (Career Paths Arrival/Choice/Delivery — separate brief, not started). Written against `main` at the SHA Phase 1b merged to (Phase 1a + 1b both shipped: `computeSituation`, `coachPresence`, the widened embedded panel).

Ships exactly one moment: Arrival on Put It to Work, replacing the existing `orientation-route` effect with new copy Bob confirmed in the design's Section 12. Also ships the mechanism the design's Section 5 asks for (catalog, one evaluator, `coachMoments` dedupe, significance, both dismissal affordances, the `quiet` state) — sized to what this one moment needs, ready for Phase 2b to add entries without changing the evaluator's shape.

## Pre-flight discovery (scope correction)

1. **The routing question is exactly as small as the umbrella brief said.** `src/App.jsx:9091-9112` is one `useEffect`: gated on `hasOnboardingConcierge && step==='twoDoors' && outputs.p3`, fires once via `seenOrientationRoute`/`orientationRouteFiredRef`, pushes a message with two quick replies. Its `checkinKey==='orientation-route'` tap handler (`:7896-7900`) does nothing but call the same two actions the screen's own door buttons already call (`markDone('twoDoors');addNewOpportunity()` / `advance('twoDoors','laneSelect')`).

2. **The `twoDoors` `CoachingCallout` (`:14723`) is unconditional today — shown to every account, not just flagged ones.** Retiring it outright (as the design's Section 12 decision #4 literally reads) would strip the only on-screen guidance from the ~143 non-internal accounts who don't get the new Arrival moment. The two pitches only ever risk coexisting for an account that has both — so the fix is `{!hasOnboardingConcierge&&<CoachingCallout>...}`, not deletion.

3. **`twoDoors` is a recurring hub, not a one-time onboarding step.** Its own copy says "You can come back to this choice anytime from the sidebar" (`:14722`). `seenOrientationRoute`'s one-shot dedupe was deliberately preventing the question from re-firing on every return visit. Any account that already has `seenOrientationRoute:true` in its saved profile must not see the new moment fire once more just because `coachMoments` starts empty for them — that flag has to keep acting as a permanent guard for this one migrated key, not get dropped. (New signups after this ships never set `seenOrientationRoute`, so `coachMoments['ptw-arrival']` is the only mechanism they ever go through.)

4. **The generic engagement-logging dispatch (`PROMPT_ENGAGEMENT_META_BY_CHECKIN`, `:4811-4818`) is keyed by exact static `checkinKey` strings.** Every moment's `checkinKey` here is dynamic (`` `moment:${key}` ``), so it won't match that table. Rather than force dynamic keys into a static lookup, the generic moment tap-handler logs directly using a `promptCode` carried on the catalog entry itself — same three-outcome vocabulary (`src/coach-prompt-codes.js`), same `hub_arrival` trigger every other one-shot arrival prompt uses, just resolved from the entry instead of a table keyed on checkinKey.

5. **No server change is required for this moment.** Arrival is fixed copy — no model call, so `computeTurnKind`/`buildMomentTurnText` (the integration point the umbrella brief worked out for Choice/Delivery) is 2b's concern, not this one's. This phase is client-only: `src/App.jsx`, a new `src/coach-moments.js`, and one addition to `src/coach-prompt-codes.js`.

## Files affected

| File | Change |
|---|---|
| `src/coach-moments.js` | New. `MOMENT_CATALOG` — one entry, `ptw-arrival`. |
| `src/coach-prompt-codes.js` | Add `'ptw_arrival'` to `PROMPT_CODES`. |
| `src/App.jsx` | Remove the `orientation-route` effect, its ref, and its tap-handler branch. Add `coachMoments`/`quietUntilReload`/`quietScreens` state, the generic Moments evaluator effect, the generic `moment:` tap-handler branch. Thread `coachMoments` into `stateForSave` and both hydration paths. Gate the `twoDoors` `CoachingCallout` on `!hasOnboardingConcierge`. |
| `scripts/test-coach-moments.mjs` | New guarding test. |
| `package.json` | Register the new test in the `test` script chain. |

No `Output/docs/reimagine-system-documentation/` or user-guide change: this ships behind `hasOnboardingConcierge`, already documented as an internal-only pilot: no new user-facing capability crosses the flag boundary this phase.

## Specific changes

### 1. `src/coach-moments.js` (new file)

```js
// Coach-as-Concierge Phase 2a (Output/handoff/2026-09-08_coach-concierge-
// phase-2a-moments-core.md): the general catalog + evaluator the design
// (Section 5) asks for, sized to what this phase ships -- one entry, no
// model call. Phase 2b adds Choice/Delivery entries on Career Paths; those
// carry a `momentRequest` shape instead of a static `message` (server-side
// judged reaction, via computeTurnKind -- see the Phase 2 umbrella brief's
// "How Choice/Delivery reactions actually get triggered" section) and the
// evaluator gains one new branch to fire that request. Nothing about THIS
// entry or this file changes when that happens.
//
// Existing seen* flags (onboarding framing, per-step narration, brand
// delivery) are untouched here -- folding those into this catalog is
// Phase 4's job, not this one's.
export const MOMENT_CATALOG = [
  {
    key: 'ptw-arrival',
    family: 'arrival',
    screen: 'twoDoors',
    // Opens the panel from minimized (Phase 1b's coachPresence) -- this is
    // the first thing Coach says on a hub screen, not routine narration.
    significance: 'open',
    dismissible: true,
    promptCode: 'ptw_arrival',
    eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!(ctx.outputs && ctx.outputs.p3),
    message: 'Is anything already moving — an application in, a referral, an interview on the calendar? If so, let\'s work that first. If not, we\'ll pick a direction and build from your brand.',
    quickReplies: [
      { label: 'Something\'s moving', value: 'in_motion', followUp: 'Good — let\'s build a playbook around it. Taking you to Add an Opportunity.' },
      { label: 'Starting from scratch', value: 'fresh', followUp: 'Good — let\'s find your direction. Taking you to Career Paths.' },
    ],
    // ctx here is the same shape the evaluator builds -- only what App.jsx
    // functions this entry needs to call. Returning true tells the generic
    // handler the tap resolved (same true/false contract every other
    // handleEmploymentQuickReply branch already follows).
    onTap: (value, ctx) => {
      if (value === 'in_motion') { ctx.markDone('twoDoors'); ctx.addNewOpportunity() }
      else if (value === 'fresh') { ctx.advance('twoDoors', 'laneSelect') }
      return true
    },
  },
]
```

### 2. `src/coach-prompt-codes.js`

Replace:
```js
export const PROMPT_CODES = [
  'employment_status',
  'search_intake',
  'opportunity_archive',
  'life_events_thin',
  'brand_richness',
  'values_thin',
]
```
with:
```js
export const PROMPT_CODES = [
  'employment_status',
  'search_intake',
  'opportunity_archive',
  'life_events_thin',
  'brand_richness',
  'values_thin',
  'ptw_arrival',
]
```

### 3. `src/App.jsx` — imports

Add near the top with the other named-module imports (alongside the existing `coach-prompt-codes.js`-adjacent usage — this file has no prior cross-file catalog import to anchor next to, so add it beside the other `src/`-relative imports at the top of the file):
```js
import { MOMENT_CATALOG } from './coach-moments.js'
```
Premise-verify the exact top-of-file import block before landing this line — do not guess an anchor.

### 4. `src/App.jsx` — remove the old mechanism

Delete the state and ref at `:7413-7414`:
```js
  const[seenOrientationRoute,setSeenOrientationRoute]=useState(false)
  const orientationRouteFiredRef=useRef(false)
```
Replace with a plain ref (per pre-flight discovery #3, this is a read-only legacy guard now — hydration sets it once, nothing ever reads it reactively, so it needs no re-render and no setter):
```js
  const seenOrientationRouteRef=useRef(false) // legacy dedupe read on hydration only; see the Moments evaluator's ptw-arrival guard below. Retired, not migrated: nothing writes this after hydration.
```
In the hydration blocks (see change 6), set `seenOrientationRouteRef.current=true` where the old code called `setSeenOrientationRoute(true)`.

Delete the tap-handler branch at `:7892-7900`:
```js
    // Coach-as-Concierge onboarding narration, fourth piece: the direct
    // routing question's answer. The tap is what actually navigates -- the
    // same two actions the twoDoors screen's own two cards already perform
    // (addNewOpportunity's onClick, and advance('twoDoors','laneSelect')).
    if(checkinKey==='orientation-route'){
      if(value==='in_motion'){markDone('twoDoors');addNewOpportunity()}
      else if(value==='fresh'){advance('twoDoors','laneSelect')}
      return true
    }
```
(Removed outright — replaced by the generic `moment:` branch in change 5, which calls `MOMENT_CATALOG`'s `onTap` instead of a hardcoded branch.)

Delete the effect at `:9091-9112`:
```js
  // Coach-as-Concierge onboarding narration, fourth and final piece: the
  // direct routing question. First arrival at twoDoors for a flagged
  // account, Coach asks directly whether something's already in motion
  // (an application, a referral, an interview) or they're starting from
  // scratch, and routes on the answer -- replacing the two-card menu with a
  // real question for these accounts, per the brief's item 1. The two
  // destinations (addNewOpportunity / advance to laneSelect) are exactly
  // what the two twoDoors cards below already do; this only changes how the
  // choice is made, not where it leads.
  useEffect(()=>{
    if(isDemo||isTest)return
    if(!signedInUser||!hasOnboardingConcierge)return
    if(step!=='twoDoors')return
    if(!(outputs&&outputs.p3))return
    if(seenOrientationRoute||orientationRouteFiredRef.current)return
    orientationRouteFiredRef.current=true
    setSeenOrientationRoute(true)
    const inMotionFollow='Good — let\'s build a playbook around it. Taking you to Add an Opportunity.'
    const freshFollow='Good — let\'s find your direction. Taking you to Career Paths.'
    setChatMessages(m=>[...m,{role:'assistant',content:'Do you already have something in motion — an application in, a referral, an interview coming up? Or are we starting from scratch?',checkinKey:'orientation-route',quickReplies:[{label:'Something\'s already moving',value:'in_motion',followUp:inMotionFollow},{label:'Starting from scratch',value:'fresh',followUp:freshFollow}]}])
    setPbCheckinOpenReq(x=>x+1)
  },[step,signedInUser,hasOnboardingConcierge,seenOrientationRoute,outputs,isDemo,isTest])
```
Replaced by the Moments evaluator in change 5.

### 5. `src/App.jsx` — the Moments evaluator + generic tap handler

New state, placed beside the other one-shot/session state (near `seenBrandDeliveryMoment`, `:7406`):
```js
  const[coachMoments,setCoachMoments]=useState({})
  const momentFiredRef=useRef(new Set())
  const[quietUntilReload,setQuietUntilReload]=useState(false)
  const[quietScreens,setQuietScreens]=useState({})
```
`quietUntilReload`/`quietScreens` are deliberately session-only (per the design's "a new session starts open") — neither is threaded into `stateForSave` or hydration.

New effect, placed where the old `orientation-route` effect was (`:9091`), replacing it entirely:
```js
  // Coach-as-Concierge Phase 2a: the Moments evaluator. One effect for the
  // whole catalog (src/coach-moments.js), not one per moment -- see that
  // file's header comment. Each entry owns its own eligibility and copy;
  // this effect only owns dedupe (coachMoments), the two dismissal states,
  // and firing. ptw-arrival is the only entry today.
  useEffect(()=>{
    if(isDemo||isTest)return
    if(!signedInUser)return
    if(quietUntilReload||quietScreens[step])return
    const ctx={hasOnboardingConcierge,outputs,step,signedInUser,markDone,addNewOpportunity,advance}
    for(const entry of MOMENT_CATALOG){
      if(entry.screen!==step)continue
      // Legacy guard, ptw-arrival only: an account that already answered
      // this question under the old one-shot mechanism (seenOrientationRoute)
      // must not see it fire again just because coachMoments starts empty
      // for them. See pre-flight discovery #3.
      if(entry.key==='ptw-arrival'&&seenOrientationRouteRef.current)continue
      if(coachMoments[entry.key]||momentFiredRef.current.has(entry.key))continue
      if(!entry.eligible(ctx))continue
      momentFiredRef.current.add(entry.key)
      setCoachMoments(m=>({...m,[entry.key]:{firedAt:new Date().toISOString()}}))
      const quickReplies=entry.dismissible?[...entry.quickReplies,{label:'I\'m good for now',value:'moment-quiet-session'},{label:'Not on this screen',value:'moment-quiet-screen'}]:entry.quickReplies
      setChatMessages(m=>[...m,{role:'assistant',content:entry.message,checkinKey:`moment:${entry.key}`,quickReplies}])
      if(entry.significance==='open')setCoachPresence('open')
      if(entry.promptCode)logPromptEngagement(entry.promptCode,'hub_arrival','shown')
      setPbCheckinOpenReq(x=>x+1)
      break
    }
  },[step,signedInUser,hasOnboardingConcierge,outputs,coachMoments,quietUntilReload,quietScreens,isDemo,isTest])
```

New tap-handler branch in `handleEmploymentQuickReply`, placed where the deleted `orientation-route` branch was (`:7892`):
```js
    // Coach-as-Concierge Phase 2a: the generic Moments tap handler. Every
    // catalog entry's checkinKey is `moment:${key}` -- one branch handles
    // all of them, present and future, rather than one hardcoded branch per
    // moment (the pattern this phase retires).
    if(typeof checkinKey==='string'&&checkinKey.startsWith('moment:')){
      const key=checkinKey.slice(7)
      const entry=MOMENT_CATALOG.find(e=>e.key===key)
      const quiet=value==='moment-quiet-session'||value==='moment-quiet-screen'
      if(entry&&entry.promptCode)logPromptEngagement(entry.promptCode,'hub_arrival',quiet?'declined':'accepted')
      if(value==='moment-quiet-session'){setQuietUntilReload(true);return true}
      if(value==='moment-quiet-screen'){setQuietScreens(s=>({...s,[step]:true}));return true}
      if(entry&&entry.onTap)return entry.onTap(value,{markDone,addNewOpportunity,advance})
      return true
    }
```

### 6. `src/App.jsx` — hydration (both paths) + autosave

In the local-storage hydration effect (`:8857`), inside the `if(d){...}` block, replace:
```js
if(d.seenOrientationRoute)setSeenOrientationRoute(true);
```
with:
```js
if(d.seenOrientationRoute)seenOrientationRouteRef.current=true;if(d.coachMoments&&typeof d.coachMoments==='object')setCoachMoments(d.coachMoments);
```
In the server-profile hydration block (`:8878`), make the identical replacement (same two substrings, same order — this block is the server-load mirror of the local one).

In `stateForSave` (`:9476`), replace:
```js
seenBrandDeliveryMoment,seenOrientationRoute,qualityCheckedFields}
```
with:
```js
seenBrandDeliveryMoment,coachMoments,qualityCheckedFields}
```
(`seenOrientationRoute` drops out of the autosave blob — it is read-only now, sourced only from whatever a pre-migration account already had saved; nothing ever writes it again, so persisting it further would just echo a frozen value.)

Add `coachMoments` to the autosave effect's dependency array (find it by the same pattern the existing test files use — `saveRef.current=save` — and confirm `coachMoments` sits alongside the other dependencies `stateForSave` already lists, so a moment firing actually triggers a save).

### 7. `src/App.jsx` — the `twoDoors` `CoachingCallout`

Replace (`:14723`):
```js
      <CoachingCallout>If you have a current opportunity you're pursuing, start here. We'll build your playbook around that specific role.<br/><span style={{color:C.gray}}>No specific opportunity in play yet? Start with Career Paths to explore where you could go.</span></CoachingCallout>
```
with:
```js
      {!hasOnboardingConcierge&&<CoachingCallout>If you have a current opportunity you're pursuing, start here. We'll build your playbook around that specific role.<br/><span style={{color:C.gray}}>No specific opportunity in play yet? Start with Career Paths to explore where you could go.</span></CoachingCallout>}
```

## Voice rules on inserted text

The one new user-facing line is Bob's own confirmed copy verbatim (design Section 12) — not newly drafted, so it carries his sign-off rather than needing a fresh voice-rule pass. Run `check-voice` anyway per the static gates below; it is Coach's own dialogue and gated as usual.

## Static gates

- `npm run build` clean.
- `check-voice` 0/0 — watch specifically for `intensifier-truly-genuinely` in any new code comment (hit three times already this project on the word "genuinely"; reword rather than suppress).
- `check-prompt-refs` 0.
- `check-coach-nav-map` — this phase adds no new Coach-nav-facing capability, so the generated map should be unchanged; if it isn't, that's a signal something here touched `FEATURE_MAP`/`NAV_LABELS` unintentionally.
- App.jsx EOF integrity preserved (line count + final closing tag/brace checked before AND after).
- Diff scope limited to the five files in "Files affected" above.
- `npm run test` green, including the new `scripts/test-coach-moments.mjs`.

## Constraints

Single PR. No effort estimates. PR title: `Coach-as-Concierge Phase 2a: Moments engine core (catalog, evaluator, dismissal, quiet)`.

## Out of scope

Everything Phase 2b owns: Arrival/Choice/Delivery on Career Paths, Delivery entries for Focus/Opportunity Playbook sections, and the server-side `computeTurnKind`/`buildMomentTurnText` plumbing the umbrella brief worked out for judged reactions (no entry in this phase needs it). Phase 3 (Next move, Stall, build offers). Phase 4 (folding the *existing* seen* flags — framing, narration, brand-delivery — into this catalog). Everything already out of scope for 1a/1b.

## Implementer's checklist

1. Pull latest `main`.
2. Premise-verify every quoted block above against current source before editing — line numbers are from the pre-flight read and may have drifted.
3. Apply changes 1-7.
4. Write `scripts/test-coach-moments.mjs`: guard `MOMENT_CATALOG`'s `ptw-arrival` entry (exact copy, quick replies, `onTap` routing), the `'ptw_arrival'` prompt code, the evaluator's legacy `seenOrientationRouteRef` guard, the generic `moment:` tap-handler branch (dismiss-vs-accept logging, both quiet-state writes), `coachMoments` in `stateForSave` + both hydration paths (by name, mirroring `test-coach-situation.mjs`'s source-presence style), and the `!hasOnboardingConcierge` gate on the `twoDoors` `CoachingCallout`. Register it in `package.json`'s `test` script chain.
5. Run the static gates. Fix anything that fails before proceeding — do not weaken an existing test's assertion to make it pass; widen a window or fix an adjacency the way Phase 1b's session did, with a comment explaining why.
6. Confirm no other test's "how many `<Chat>` mounts carry X" or fixed-offset-window assumption broke — this phase doesn't touch the `<Chat>` mounts themselves, so none should, but verify rather than assume.
7. Commit with the message below, push to a fresh branch off `main`, open the PR, watch CI, merge squash.
8. Report the PR URL and merge commit SHA.

## Commit message

```
Coach-as-Concierge Phase 2a: Moments engine core

Replaces the one-shot orientation-route effect with the general Moments
catalog + evaluator the design's Section 5 asks for, sized to what this
phase ships: one entry (Arrival on Put It to Work, Bob's confirmed
copy), the coachMoments dedupe store, both dismissal affordances, and
the session-scoped quiet state. No server change -- Arrival is static
copy. Phase 2b adds Choice/Delivery on Career Paths against this same
mechanism.
```
