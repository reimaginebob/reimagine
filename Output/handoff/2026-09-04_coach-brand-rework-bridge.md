# My Coach can act on a reaction to the Personal Brand, not just redirect it

## Prompt for Code

Apply the changes in this brief. Premise-verify every anchor quoted below against current `main` before you touch anything — if a quoted line has drifted, STOP and surface it rather than guessing at the new shape. Run the static gates, follow the gh flow in CLAUDE.md §9, and report the PR URL and merge SHA. This ships behind the existing `onboarding_concierge` flag; it must be invisible to every account that does not hold it.

---

## Date / Type / Source

- **Date:** 2026-09-04
- **Type:** Feature (gated, extends an existing gated feature)
- **Source:** Live-testing conversation with Bob, 2026-09-04. Bob asked whether replying in the My Coach chat window after the Personal Brand delivery message would have the same effect as typing in the "Does this feel right?" (DTFR) box. It does not — they are separate, unwired mechanisms. A first draft fix reworded Coach's delivery line to redirect the person to the DTFR box instead of implying a chat reply works. Bob rejected that as the cheap version: *"Your default move in recommendation was the cheap one line fix. The gold standard we're trying to hold ourselves to is delight the user."* He approved the ambitious version instead: Coach reads the reply, judges whether it is a real correction, and — if so — offers to act on it directly, the same way the DTFR box does, rather than just pointing at the box.

---

## Pre-flight discovery (scope correction)

Drafted against `main` at `d57abc0` (after PR #708 merged). Confirmed by reading the actual code, not assumed:

- **The regeneration primitive already exists and takes free text from anywhere.** `refineSec(id,v)` (`src/App.jsx:13540`) is `recordCorrection(id,v)` then either `generateP6({refine:v})` for `p6` or the generic `generateSection(id,...)` path. It does not care where `v` came from — the "Does this feel right?" box (`RefineBox`, `src/App.jsx:6279`) is just its existing caller. This brief adds a second caller; it does not touch the regeneration path itself.
- **`submitCorrection` is the right entry point, not `refineSec` directly.** `RefineBox.submit()` calls `guard(sectionId,value,()=>{...;onRegenerate(value)})` where `guard=submitCorrection` (`src/App.jsx:9022`). `submitCorrection` runs Track 6 conflict detection (the "Reimagine writes around this phrase" modal) before proceeding. Calling `refineSec` directly would skip that check for a Coach-originated correction, which is inconsistent with every existing entry point. This brief routes through `submitCorrection('p3', text, ()=>refineSec('p3', text))`, exactly mirroring what `RefineBox` itself does for `sectionId={id}` at `src/App.jsx:13794`.
- **The one-tap capture pattern is already used four times and is the right shape for this.** Interview team, Values, pipeline next-step, and search-intake all follow: model ends its reply with a hidden trailer line → server validates and strips it, ships it on a response header → client shows the exact content and offers a one-tap confirm via `quickReplies` → the tap calls a normal write path. `NEXT_STEP_CAPTURE_NOTE` / `NEXTSTEP:` / `X-Coach-Next-Step` (`api/coach.js`, shipped 2026-09-02) is the closest sibling and this brief's template. This invents no new mechanism.
- **The server already knows which step the user is on.** `currentStep` arrives in the request body (`api/coach.js:1096`) and is already used to gate `orientationCheckRequested` (`api/coach.js:1209`) and to compute `hasPersonalBrand` (`api/coach.js:1316`, from `_poutputs.p3`). No new plumbing is needed to scope the new capture instruction to the one screen it applies to — `currentStep==='p3' && hasPersonalBrand`.
- **The delivery message this bridges from is confirmed still on `main` verbatim:** `src/App.jsx:8210` — `setChatMessages(m=>[...m,{role:'assistant',content:'Your story just came together above. Take a look, and tell me how it reads — does it sound like you?'}])`. (A local, unshipped, uncommitted draft on a scratch branch reworded this to redirect to the DTFR box instead; that draft is superseded by this brief and should be discarded, not merged.)
- **This is not p3-specific by architecture — Coach is mounted globally.** `src/App.jsx:15787` mounts `<Chat>` for any signed-in user on every step except `myCoach` (which gets its own embedded instance at `src/App.jsx:13915`). The classify → confirm → refine shape therefore generalizes to every screen that already has a `RefineBox` or `SubsectionRefineBox`. See **Roadmap** below for the full list — **this brief wires the mechanism generically but activates it for exactly one target (p3) in this PR.** Every other target is scoped out deliberately; see Out of scope.

**Net scope:** one prompt instruction (step-gated, no new flag), one trailer parser, one response header, one client offer, one write branch, one reworded delivery line.

---

## Files affected

| File | Change |
|---|---|
| `api/coach.js` | `BRAND_REWORK_CAPTURE_NOTE`, step-gated append; `BRANDREWORK:` trailer parse; `X-Coach-Brand-Rework` header |
| `src/components/Chat.jsx` | New prop `brandReworkCaptureActive`; render the one-tap offer from the header |
| `src/App.jsx` | Pass the prop at both `<Chat>` call sites; handle `checkinKey==='brand-rework'`; reword the p3 delivery message |

---

## Specific changes

### 1. `api/coach.js` — the instruction

Add beside `NEXT_STEP_CAPTURE_NOTE` (`api/coach.js:193`), written to the same one-tap-offer contract:

```js
// BRAND REWORK CAPTURE, 2026-09-04. Step-gated (p3 only), not flag-registry-
// gated separately — this is part of the same onboarding_concierge delivery
// moment, just wired to act instead of only redirect. Mirrors
// NEXT_STEP_CAPTURE_NOTE's contract: the model proposes, the tap writes,
// via the exact path the "Does this feel right?" box already uses
// (submitCorrection -> refineSec('p3', text)), so a Coach-originated
// correction gets the same conflict check a typed one gets.
const BRAND_REWORK_CAPTURE_NOTE = '\n\nBRAND REWORK CAPTURE: the Personal Brand you just showed this person lives on this screen, with a "Does this feel right?" box under it that rewrites the section from a note like the one you would write here. When their reply names something specifically WRONG or OFF about it — a fact you got wrong, a tone that is not them, something missing, something overstated — and is not merely a reaction, a compliment, or a question, end your reply with a final line exactly like BRANDREWORK: {"note":"<what they said is off, tightened to the point, in their own words, not your paraphrase of the feeling behind it>"} . Do not emit it for "yeah that\'s me," "I like it," a question about what happens next, or anything that has not identified something to actually change — a reaction is not a correction. The app turns that line into a one-tap offer to rework the section with exactly that note, and never shows the line itself, so do not mention it and do not tell them to type it into a box. At most once per reply; otherwise omit it entirely.'
```

### 2. `api/coach.js` — gate it into the prompt

After `hasPersonalBrand` is computed (`api/coach.js:1316`) and before `contextNote` (`api/coach.js:1320`), insert:

```js
  const brandReworkNote = (currentStep === 'p3' && hasPersonalBrand && hasOnboardingConcierge({ feature_flags: featureFlags, email: user.email }))
    ? BRAND_REWORK_CAPTURE_NOTE
    : ''
```

Then append `brandReworkNote` to `profileBlock` immediately after it (before `profileBlock` is next used). Confirm against current code exactly where `profileBlock` is last mutated before being consumed by the `messages` construction, and append there — e.g. `profileBlock += brandReworkNote`. A non-`p3` step, a not-yet-built brand, or a non-flagged account all produce an empty string, so the instruction is absent from the prompt entirely in every other case — the same no-op every existing capture note relies on.

### 3. `api/coach.js` — parse the trailer

Immediately after the Values block (`vcMatch` handling, `api/coach.js:1525-1539`), mirroring its shape:

```js
  // Brand rework capture: the model may end with a BRANDREWORK: {json} line
  // carrying a correction to the Personal Brand it judged as real (not just a
  // reaction). Strip it and ship it on a response header; the client offers a
  // one-tap rework through the exact path the "Does this feel right?" box
  // uses, so this gets the same conflict check a typed correction gets.
  let brandReworkB64 = null
  const brMatch = strippedText.match(/^\s*BRANDREWORK:\s*(\{[\s\S]*?\})\s*$/im)
  if (brMatch) {
    strippedText = strippedText.replace(brMatch[0], '').trim()
    try {
      const parsed = JSON.parse(brMatch[1])
      const note = typeof (parsed && parsed.note) === 'string' ? parsed.note.trim().slice(0, 600) : ''
      if (note) brandReworkB64 = Buffer.from(JSON.stringify({ note })).toString('base64')
    } catch { /* malformed — drop the line, no offer */ }
  }
```

### 4. `api/coach.js` — emit the header

Beside the existing set (`api/coach.js:1623-1628`):

```js
  if (brandReworkB64) res.setHeader('X-Coach-Brand-Rework', brandReworkB64)
```

No `Access-Control-Expose-Headers` entry exists for any sibling header (`X-Coach-Message-Id`, `X-Coach-Interviewers`, etc.) — same-origin read, confirmed by grep. Re-confirm at implementation time; add this header alongside if an expose list has since appeared.

### 5. `src/components/Chat.jsx` — the offer

Add `brandReworkCaptureActive = false` to the destructured props (`src/components/Chat.jsx:32`), and read the header beside its siblings (`src/components/Chat.jsx:413-418`):

```js
        const brHeader = res.headers.get('X-Coach-Brand-Rework') || null
```

Then, after the Values capture block, add:

```js
        // Brand rework capture: the server judged the reply as a real
        // correction to the Personal Brand, not just a reaction. Show the
        // note back before acting on it — the DTFR box always shows what it
        // is about to send, and this offer holds to the same bar.
        if (brandReworkCaptureActive && brHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(brHeader), c => c.charCodeAt(0))))
            const note = data && typeof data.note === 'string' ? data.note.trim() : ''
            if (note) {
              setMessages(m => [...m, {
                role: 'assistant',
                content: `Want me to rework it with that?\n\n${note}`,
                checkinKey: 'brand-rework',
                quickReplies: [
                  { label: 'Yes, rework it', value: JSON.stringify(data), followUp: 'Reworking it now — give it a moment.' },
                  { label: 'Not now', value: 'dismiss' },
                ],
              }])
            }
          } catch { /* malformed header — no offer */ }
        }
```

### 6. `src/App.jsx` — pass the prop

Add `brandReworkCaptureActive={hasOnboardingConcierge&&step==='p3'}` to **both** `<Chat ...>` call sites (`src/App.jsx:13915` and `src/App.jsx:15787`). The embedded panel at 13915 only renders on `step==='myCoach'`, so the expression is inert there in practice — added anyway for the same reason the reference next-step-capture brief added its prop to both sites: so the two surfaces never silently diverge on which captures they support.

### 7. `src/App.jsx` — the write

In `handleEmploymentQuickReply` (`src/App.jsx:7417`), insert a branch immediately before the function's final `return false` (`src/App.jsx:7565-7566`, right after the `values-capture` branch closes):

```js
    // Coach judged a chat reply as a real correction to the Personal Brand
    // and the person confirmed. Routes through the exact path the "Does
    // this feel right?" box uses (submitCorrection -> refineSec) so a
    // Coach-originated correction gets the same conflict check a typed one
    // gets, and shows up in the corrections history the same way.
    if(checkinKey==='brand-rework'){
      if(value==='dismiss')return true
      let data;try{data=JSON.parse(value)}catch{return false}
      const note=data&&typeof data.note==='string'?data.note.trim():''
      if(!note)return false
      submitCorrection('p3',note,()=>refineSec('p3',note))
      return true
    }
```

`submitCorrection` (`src/App.jsx:9022`) and `refineSec` (`src/App.jsx:13540`) are both defined later in the same component body; `handleEmploymentQuickReply` only executes as an event-handler callback after the render that defines them has completed, so both are in scope by the time this branch runs — the same closure shape the existing `pursuit-next-step` branch already relies on for `savePursuit`.

### 8. `src/App.jsx` — reword the delivery message

Replace (`src/App.jsx:8210`):

```js
    setChatMessages(m=>[...m,{role:'assistant',content:'Your story just came together above. Take a look, and tell me how it reads — does it sound like you?'}])
```

with:

```js
    setChatMessages(m=>[...m,{role:'assistant',content:'Your story just came together above. Take a look, and tell me how it reads. If anything is off, tell me right here and I will rework it, or use "Does this feel right?" right below if you would rather do it there.'}])
```

Both affordances stay real and true: the DTFR box still works exactly as before, and a chat reply now also works, because change 7 makes it so.

---

## Voice rules on inserted text

- *"Want me to rework it with that?"* followed by the note read back verbatim — a readback of what the person said, not a characterization of them. Translation-not-praise by construction: there is nothing to praise, it is a confirm-before-act step.
- *"Yes, rework it"* / *"Not now"* — same two-button shape as every existing capture offer.
- *"Reworking it now — give it a moment."* — plain, sets expectation, no coaching register.
- The reworded delivery line (change 8) drops no honesty: it still names the DTFR box, and now also names the chat itself as a real option, because it is one after this PR.
- `BRAND_REWORK_CAPTURE_NOTE` is model instruction, not user-facing copy, exempt from the voice gate the same way its siblings are (see `api/coach.js` lines around `INTERVIEW_TEAM_CAPTURE_NOTE`). It instructs no banned construction.

---

## Static gates

- `npm run build` clean.
- `check-voice` 0/0. No new voice-allow region.
- `check-prompt-refs` 0.
- `check-coach-nav-map` passes unchanged — this brief adds no `FEATURE_MAP` entry.
- `check-fontsize` ratchet not raised.
- `src/App.jsx` EOF integrity: record line count and final closing tag/brace before and after every edit.
- Diff limited to the three files in the table above.
- Extend `scripts/test-orientation-quality-check.mjs` or add a sibling test (implementer's call, matching whichever existing file most naturally covers `api/coach.js` capture-note additions) asserting: `BRAND_REWORK_CAPTURE_NOTE` exists and is step-gated on `currentStep==='p3'`; the trailer regex and header name; the `checkinKey==='brand-rework'` branch calls `submitCorrection` with `refineSec('p3',...)` as its proceed callback, not `refineSec` directly (this is the whole point — losing the conflict-detection guard would be a silent regression); the delivery message (change 8) mentions both the chat and the DTFR box.

## Runtime gate (post-merge)

Preview-deploy smoke first — this touches `api/*`. `npm run smoke:preview -- https://reimagine2-git-<branch>-career-club.vercel.app` (get the exact hostname from the Vercel bot's PR comment, not hand-built). Both `/api/health` and `/api/claude` must return non-5xx.

Then, on production, as Bob (already flagged via `onboarding_concierge`):

1. Reach the p3 screen with a built Personal Brand for the first time on a fresh account (or force the delivery moment per however QA already does this for slice 3).
2. Reply in Coach chat with a genuine correction ("it says I ran the whole rollout but I was one of three regional leads") — expect the one-tap offer, showing that exact note back.
3. Tap "Yes, rework it" — expect the p3 section to regenerate with that note applied, same as typing it into the DTFR box would produce.
4. Reply instead with a plain reaction ("wow, that's really me") — expect a normal conversational reply and **no** offer.
5. Trigger a correction whose wording matches an existing "Reimagine writes around this phrase" guard (see Track 6 / `detectCorrectionConflict`) — confirm the same conflict modal appears as it would from the DTFR box directly, proving the bridge did not bypass it.
6. Confirm nothing above fires for a non-flagged account, and nothing fires on any step other than p3.

## Constraints

- Single PR. No effort estimates anywhere in the PR or commits.
- PR title: `My Coach can rework the Personal Brand from a chat reply, not just redirect to the box`.
- The model never writes. The tap writes, through the same guarded path the DTFR box uses.

## Out of scope

- **Every other refine surface.** This mechanism is designed to generalize (see Roadmap) but this PR activates it for `p3` only. Do not extend the step-gate or the client prop to any other screen in this PR.
- Any new feature flag. This rides under the existing `onboarding_concierge` flag as an extension of the same delivery moment.
- Any migration or schema change. Nothing here persists beyond the existing correction/regeneration path.
- Multi-target resolution (deciding *which* box a reply refers to when a screen has more than one). Not needed for `p3` (single target); needed before this generalizes to LinkedIn Remix, Go-to-Market, Interview Prep, or Live Opportunity Playbook cards — see Roadmap.
- Retiring or changing the DTFR box itself. It keeps working exactly as it does today; this adds a second entry point to the same mechanism.

## Roadmap (not this PR — future briefs, each needs its own pre-flight verification)

Coach is mounted globally (`src/App.jsx:15787`), so the same classify → confirm → refine shape applies everywhere a `RefineBox` or `SubsectionRefineBox` already exists. Grouped by shape, for sequencing future briefs:

**Single-target screens** (one refine box, one thing it changes) — same shape as this PR, smallest lift to extend:
- Bridge Story (`p6`) → `refineSec('p6', text)`
- Resume Refresh, The Lingo, and other generic Focus sections → the shared `RefineBox` at `src/App.jsx:13794`, same `refineSec(id, text)` call already generalized by `id`
- Income Now → `refineIncome(text)`

**Multi-target screens** (several independent refine boxes on one screen) — need the classifier to also resolve *which* box before this pattern applies safely:
- LinkedIn Remix — About, Headlines, and Skills each have their own `SubsectionRefineBox`
- Go-to-Market — the hiring-exec read and the outreach email refine independently
- Interview Prep — each question has its own refine box
- Live Opportunity Playbook cards — company read, salary read, deep dive, and cover letter each refine independently, up to four live targets on one screen

Recommended sequencing: single-target screens next (each is a near-copy of this PR's change 6-8 with a different `sectionId`/message), then design the target-resolution step once, then apply it to the multi-target screens in one pass rather than four separate ad hoc solutions.

## Commit message

```
Let My Coach act on a Personal Brand correction, not just redirect to it

Coach's delivery message pointed a chat reply at the "Does this feel right?"
box instead of acting on it directly -- honest, but the cheap fix. This
makes the chat reply itself do the job: when the reply names something
specifically wrong with the brand (not just a reaction), Coach offers a
one-tap rework using the exact note, through the same guarded path
("Does this feel right?" -> submitCorrection -> refineSec) a typed
correction already uses, so a Coach-originated correction gets the same
conflict check.

Fifth instance of the one-tap capture pattern (interview team, Values,
pipeline next-step, search-intake): model ends its reply with a hidden
trailer, the server validates and strips it onto a response header, the
client shows exactly what will happen, the person taps, the tap writes.
The model still never writes on its own.

Step-gated (p3 only) rather than a new flag -- this is the same
onboarding_concierge delivery moment, now able to act instead of only
redirecting. The DTFR box is untouched and still works exactly as before;
this adds a second entry point to it.
```

## Push

Branch, PR, `gh pr checks --watch`, squash-merge once green — the gh flow in CLAUDE.md §9. Vercel auto-deploys from `main`. Report the PR URL and the merge SHA.

## Implementer's checklist

1. Pull `main`. Discard any local uncommitted rework of the p3 delivery message from a prior scratch branch — this brief supersedes it.
2. Premise-verify: `refineSec`, `submitCorrection`, `RefineBox` at `src/App.jsx:13794`, the p3 delivery effect at `src/App.jsx:8200-8212`, `handleEmploymentQuickReply`'s branch list and final `return false`, both `<Chat>` call sites; `NEXT_STEP_CAPTURE_NOTE`/`vcMatch`/header block in `api/coach.js`; `currentStep`/`hasPersonalBrand` computation order. Substance-grep, not just block-existence.
3. Apply changes 1-8 in order. Record `src/App.jsx` line count before and after.
4. Run the static gates, including the new/extended test from the Static gates section.
5. Update Chapter 11 (changelog) in `Output/docs/reimagine-system-documentation/`.
6. Push, open the PR, watch CI, smoke the preview, squash-merge.
7. Report the PR URL and merge SHA, and confirm which gates passed with their actual output.
