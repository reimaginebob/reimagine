# Coach-as-Concierge voice extraction — everything a person can read

For Bob and Cowork's voice review pass. Nothing in this document has been edited — it is pulled verbatim from source. **Do not treat this as a rewrite draft; it is the raw material for one.**

Per the standing gate: no moment template or user-visible Coach string ships without Bob's sign-off on the text first, from here on. This extraction is step one of that gate for Phase 2's shipped families and step zero for Phase 3 (paused before any code — see below).

---

## READ THIS FIRST — a real gap, not an oversight

The request asked for three real sample outputs per family from a live run on Dana Whitfield's account. **I cannot produce that from this session.** This remote environment has no production database credentials (no `DATABASE_URL`/`POSTGRES_*`/Neon access), no direct Anthropic API key for standalone live-model calls outside this session's own harness, and no admin-dashboard or conversation-history access. The one connected Reimagine integration available to me (`Career_Club_Reimagine` MCP) only reads/writes pipeline pursuit status — it has no access to Coach conversation transcripts or profile data.

So this document contains the full, accurate **template and fixed-string extraction** — everything below is complete and verified against current `main`. It does **not** contain real sample outputs, and I have not fabricated placeholder ones to fill the gap, since a synthetic sample presented as if real would defeat the point of a voice review and risk misleading the read.

Three ways to close this gap, your call:
1. You or Cowork pull three real transcripts per family from the admin dashboard / Insights view for accounts where these moments have already fired (Dana Whitfield's or another tester's).
2. Grant me a way to reach the data (a read-only DB credential scoped for this, or admin-dashboard access) and I'll pull them myself.
3. I run each template against a realistic-but-synthetic profile via the existing live-eval pattern (`scripts/eval-interview-capture-live.mjs` is the reference) if you'd rather see the templates exercised now, clearly labeled SYNTHETIC, while real samples are pulled separately.

---

## Family: Arrival

### `ptw-arrival` — Put It to Work
**File:** `src/coach-moments.js:38-52` · **Fires:** first arrival at the `twoDoors` screen, flagged account with a built Personal Brand · **Static copy — no model call.**

Message:
> Is anything already moving — an application in, a referral, an interview on the calendar? If so, let's work that first. If not, we'll pick a direction and build from your brand.

Quick replies:
- "Something's moving" → follow-up: "Good — let's build a playbook around it. Taking you to Add an Opportunity."
- "Starting from scratch" → follow-up: "Good — let's find your direction. Taking you to Career Paths."

### `career-paths-arrival` — Career Paths
**File:** `src/coach-moments.js:64-73` · **Fires:** first arrival at the `laneSelect` screen, flagged account · **Static copy — no model call.**

Message:
> This is where we look at directions beyond the one you already have in hand — three lanes, each reading your background a different way. Pick one and I'll show you real role options that fit it.

---

## Family: Choice

Both fire as a real model call (`fireMoment` → `/api/coach` → `buildMomentTurnText`). The bracketed text below is the *instruction* the model receives, never shown to the person; the person sees only what the model writes in reply to it.

### `choice-lane` — after picking a lane
**File:** `api/coach.js:664-666`, function `buildChoiceLaneReactionText(laneLabel)`

> [They just chose {laneLabel} as a direction to explore on Career Paths. Reflect the choice against their Personal Brand in one line — what picking this lane says about where they're pointed, using something real from their brand rather than restating the lane's own description. Then name in one sentence what building the first role option's Where You Fit will tell them. Two sentences total, no more. Open with this directly, in your own voice. Do not mention that this is an automated check.]

### `choice-role` — after picking a specific role
**File:** `api/coach.js:667-669`, function `buildChoiceRoleReactionText(roleTitle, laneLabel)`

> [They just picked "{roleTitle}" ({laneLabel}) as the specific role to build a playbook around. Reflect the choice against their Personal Brand in one line — something real that connects this specific role to who they are, not a restatement of the title. Then name in one sentence what building Where You Fit will tell them about this specific role. Two sentences total, no more. Open with this directly, in your own voice. Do not mention that this is an automated check.]

---

## Family: Delivery

One shared template for all 9 Career Paths sections, plus its pre-existing prototype (Personal Brand richness, which predates the Moments catalog but is the template Delivery was explicitly built to reuse — see the design doc's Section 5: "Delivery reuses the Brand richness prompt shape"). If the voice is wrong in the shared template, it is wrong in all 10 places it fires.

### `buildFocusDeliveryReactionText(sectionLabel, text)` — the shared Delivery template
**File:** `api/coach.js:670-672` · Used by `delivery-p5`, `delivery-p6`, `delivery-p9`, `delivery-salaryRead`, `delivery-p11`, `delivery-p_res`, `delivery-p8`, `delivery-p7`, `delivery-income` (`src/coach-moments.js:102-236`)

> [They just built {sectionLabel} for this role. Here is what was built:
>
> {text}
>
> Give a short, genuine read: one specific strength actually in what they built, and at most one thing that would make it richer, framed as an invitation ("if you'd like...") never a correction. If it is already strong on both counts, say so plainly and specifically and stop there — do not manufacture a suggestion where none is warranted. Keep it to a few sentences, never a list. Open with this directly, in your own voice — this is the first thing they see after it was built. Do not mention that this is an automated check.]

### `buildBrandRichnessCheckText(text)` — Personal Brand's own version (pre-existing, Delivery's prototype)
**File:** `api/coach.js:627-628`

> [Their Personal Brand just came together. Here is the brand itself, followed by the raw material it was built from — if it says this is a return visit, they already acted on an earlier suggestion and this is a fresh look at what they have now:
>
> {text}
>
> Read it against two things, not a checklist of whether every section got touched: RELEVANCE (does this read as someone who can actually do the job — backed by resume specifics, assessment, skills, real evidence behind any "where this transfers" claim) and DIFFERENTIATION (does this read as distinctly them, not a qualified stranger — values, reputation, life story, passions coming through as real material, not trait words with nothing behind them). A brand can be strong on relevance and thin on differentiation (reads competent and interchangeable, like gasoline — gets the job done, could be from anywhere) or the reverse (personal and memorable but never actually earns the room). Judge honestly which axis is thinner here, using only what is actually in the raw material below it, and never invent a gap that is not there.
>
> If it is genuinely strong on both: say so plainly and specifically — name the actual relevant thing and the actual differentiating thing that make it work together, and stop there. Do not manufacture a suggestion where none is warranted.
>
> If one axis is thinner: open with a specific, genuine compliment naming what is actually working in the brand already — never generic praise. Then, in the same warm register, offer one thing, two at most, that would make it richer, framed as something the two of you could add together if they want to, never as something missing or wrong with what is there now. Use the shape "if you'd like, one thing that would make this even richer would be..." — their choice, always. Pull the suggestion from whichever axis is thinner, and from something concrete you can see is genuinely underused in the raw material, never a generic "add more to X."
>
> Values, passions, reputation, skills, priorities, and life story can all be added right here in conversation — if the suggestion touches one of those, invite them to just tell you. If what would help most is on the Resume or LinkedIn side, or in Where You Think You Fit, say so honestly and point to the actual screen — do not imply it can be added by just telling you, when it cannot yet.
>
> Close by naming both ways they can act on any of this: telling you right here and you will rework the brand directly, or using the "Does this feel right?" box on the screen if they would rather do it there. Say this plainly, not as a menu of options.
>
> Keep it to a few sentences, never a list. Open with this directly, in your own voice — this is the first thing they see after their brand comes together. Do not mention that this is an automated check.]

**Note for the review:** this one is the flagged example in Bob's own instructions — "throughline," "how they'd read you" style phrasing tendencies likely trace to how the model interprets "DIFFERENTIATION," "RELEVANCE," and the gasoline metaphor in this exact template. Worth reading closely.

---

## Family: Next move

**Not implemented.** Phase 3 was paused (per Bob's instruction, at the design-decision stage) before any code was written. No template exists anywhere in the codebase. Nothing to extract.

## Family: Stall

**Not implemented,** same as Next move — paused before code.

## Family: Return

Ships already (Phase 1, "returning-session opening recap" — predates the Phase 2/3 numbering but is one of the six families named in the request, so included for completeness).

### Session-open recap instruction
**File:** `api/coach.js:1271-1282`, the `sessionOpenNote` block (fed into the profile block alongside `SESSION_OPEN_TURN_TEXT`, `api/coach.js:342`, which is the silent turn-trigger wrapper, not itself shown)

The facts block (deterministic, not model-written):
> WHAT CHANGED SINCE THEIR LAST SESSION (authoritative — the ONLY source for what happened; never invent or infer anything beyond it, and never turn it into a count, a fraction, or a percentage):
> {one line per: added opportunities, interviews that happened, other pipeline movement, new directions saved, new search activity — or, if nothing changed: "Nothing changed in their pipeline or activity since their last session — a quiet stretch, not a stalled one."}

The instruction (what the model does with it):
> This is the first turn of a new session — open with this yourself, in your own voice, before they ask anything. Say hello and ask ONE question about how they are doing — pick a single natural way to ask it and stop; never ask twice in different words in the same reply ("how's it going?" followed later by "how has your week been?" is the same question asked twice, not two things). {Fold the one real thing that happened into that same greeting, naming it by name — the actual interview, the actual company — instead of adding it afterward as a separate status line. / Nothing changed, so skip a status line entirely — do not add a second sentence saying so; go straight from the mood question to the closing one.} Close with one more sentence handing them the wheel: ask whether there is something specific they would like to work on today, or whether they would rather you suggest something based on what you can see in their search. That is the whole opener: a greeting with one mood question, at most one line of context, and one closing question — if what you have written is longer than three sentences or asks more than those two questions, cut it down before you send it. If they name their own focus once they reply, follow it completely rather than steering back to your own read of what matters most; only when they ask you to suggest something do you reach for what is on the table for them below and make the case for it.

---

## Fixed strings shared across every dismissible moment

**File:** `src/App.jsx:9122` (generated-moment path, `fireMoment`) and `:9183` (static-moment path, the evaluator) — same two labels, both places, byte-identical.

- "I'm good for now" (quiets Coach for the rest of the session)
- "Not on this screen" (quiets Coach for this screen only)

No follow-up text is attached to either tap — they resolve silently.

---

## Deterministic replacement text (strippers)

Correction to an earlier draft of this document: `stripRoomsPlaceholder` (`src/text-strippers.js:368-407`, not `.mjs`) does insert fixed, user-visible replacement text when it fires on a model reply that used "rooms" as an audience metaphor (already a banned construction per the voice gate) — it doesn't just delete the offending phrase. Since this is exactly the register the review is targeting, including it:

- "rooms where / in which / that matter / that count" → "conversation(s) where / in which / that matter / that count"
- "get(ting) into / walk(ing) into / be(ing) in / step(ping) into rooms" → "...the conversations that matter"
- "into / in the room" (interview-audience sense) → "into / in the conversation"
- "in / into {the/those/these/any/certain/all/important/key/senior/right/wrong/decision-making} rooms" → "...{same determiner} conversations"

Worth a look in the same pass: "the conversations that matter" is itself a fixed phrase this stripper reaches for every time — if it reads as its own piece of product shorthand, that's a second thing to fix here, not just the "rooms" it's replacing.

## What this document does NOT cover (out of scope for Phases 2-3, flagging so the gap is visible)

- Everything that shipped before Coach-as-Concierge Phase 2 (onboarding framing, per-step narration, the employment/search-intake prompts, capture-offer copy, etc.) — a much larger body of existing Coach copy that may have the same voice problems but wasn't named in this request.
- `SYSTEM_PROMPT_STABLE`'s general posture rules (`api/coach.js:~1505-1530`) — these shape every ordinary typed-conversation reply, not just moment templates, and weren't named either.
- Build-offer button text — does not exist yet (BUILD tap was paused before implementation, same as Next move/Stall).
