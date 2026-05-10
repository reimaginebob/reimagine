# Underlying Drivers Architecture

**Status:** Scoped 2026-05-09. Not yet committed to a build window. **Owner:** Bob Goodwin **Audience:** Claude Code, working on the Reimagine project.

**How to read this document:**

- **If you are working on V2 right now**, read Part 1 (V2 Coordination) first and stop there. It tells you what to leave alone so this future work has clean ground when it starts.  
- **If you are scoping or implementing the Underlying Drivers initiative itself**, Part 2 (Full Architecture) is the canonical design reference. Part 1 is still useful context for understanding the V2 dependencies.

**Related items:** [Mental Frameworks brief](http://../briefs/2026-05-06_mental-frameworks-brief.md) (Later); [Wide View collapses to current function](http://../reimagine-future-enhancements.md) (Backlog); [Multiple assessment uploads](http://../reimagine-future-enhancements.md) (Backlog); [Reimagine V2 Launch Plan](http://../briefs/2026-05-04_reimagine-launch-plan.md) (Now).

---

# Part 1 — V2 Coordination

## TL;DR

A substantial post-V2 initiative — the Underlying Drivers Architecture — has been scoped (Part 2 below). It will replace the current free-text values capture with a multi-source, multi-framework architecture (Affintus structured ingest \+ Schwartz PVQ-21 \+ narrative inputs \+ inference layer \+ validation loop). It is queued in Later, paired with Multi-assessment uploads (Backlog), and feeds the Wide View capability-first reverse pass (Backlog) downstream.

V2 is not blocked on this work and should not delay launch for it. But V2's design choices in three specific areas have downstream implications, so V2 must be aware of them.

## What V2 should know

### 1\. The Brand Synthesis recovery prompt (planned, not built) needs V2's accounts

The Underlying Drivers work introduces a new flow at Brand Synthesis: if a user's assessment data was thin AND the synthesis output shows visible gaps in dimensions Affintus would cover, present a recovery prompt offering "I'll take Affintus now" — the user leaves to take Affintus, comes back, uploads, and the system recomputes the chain (Resume Analysis p1, Wiring & Compass p2, Brand Synthesis p3).

That return flow only works cleanly when the user comes back on the same browser (`localStorage` `pe_v3` key handles this). Cross-device return — took Affintus on phone, comes back on laptop — is broken until V2's magic-link accounts ship.

**Implication for V2:** when designing the magic-link accounts work, ensure the user's profile state (including `profile.assess`, eventually `profile.affintus`) round-trips correctly on cross-device login. The recovery prompt itself is not part of V2 — do not build it. But the accounts work that V2 ships will be exercised by it shortly after.

### 2\. The values step is structurally replaced by this work

App.jsx \~line 798 (`case 'values':`) currently has two textareas: "Core Values — 3 to 5 non-negotiables" and "Passions, Interests & Causes — 3 to 5 things you care about." The Underlying Drivers work replaces this step with three layers:

- **PVQ-21 (Schwartz Portrait Values Questionnaire) embedded directly** — 21 click-driven items, scored internally, \~5–7 minutes. Administered inside Reimagine, not referred out (items are public-domain, scoring is straightforward arithmetic).  
- **User-stated values in their own words** — annotated tags with quick disambiguation pop-ups, framed "Now in your own words: what are 3–5 values you'd actually name to describe yourself? These are the words we'll use in your brand story." Complements the PVQ-21 — Schwartz drives the structured scoring; user words drive the brand-output vocabulary.  
- **Passions/Interests/Causes as a separate narrative input** — also reworked toward annotated tags rather than free comma-separated entry.

**Implication for V2:** if V2 has any reason to touch the values step, do not redesign or modify it independently. Any V2 change to that step would be churn — it's getting structurally replaced. If V2 needs the step touched (e.g., for accounts integration), keep changes to mechanical infrastructure only (pulling/pushing profile data on login), not UX or schema.

### 3\. The Affintus referral has a graded-encouragement architecture

Today the Affintus referral lives at the assessment step (App.jsx lines 645, 776, 790\) and uses generic encouragement. The Underlying Drivers work introduces *graded* encouragement based on coverage gaps — strong push for users with nothing or thin assessments, none for users who arrive with a recent Hogan or Clifton, with the push message itself customized to the dimensions that are missing (not a generic "take this please").

**Implication for V2:** if V2 touches the assessment step (e.g., to associate uploads with an account), do not change the Affintus referral copy or prominence. The referral is a deliberate design surface that this future work will rebuild against the graded principle. Equally important — do not make it *less* prominent in V2 (e.g., to clean up the welcome screen) without flagging.

## What V2 should NOT do

- Do not build the Brand Synthesis recovery prompt or chain-recompute logic. Both belong to the Underlying Drivers initiative.  
- Do not modify the values step UX or its schema (`profile.values`, `profile.passions`). Both are being replaced.  
- Do not embed the Schwartz PVQ-21 or any other structured values assessment. That's part of the queued work.  
- Do not change Affintus referral copy or placement.  
- Do not redesign the assessment step ingestion logic. The Underlying Drivers work introduces structured Affintus parsing (recognizing the 19 dimensions explicitly). V2 should leave assessment ingestion as-is so the future work has clean ground to build on.

## Coordination points

### Schema

The Underlying Drivers work will introduce schema changes:

- `profile.values` (single string) → `profile.values_pvq` (Schwartz item responses \+ computed scores) \+ `profile.values_tags` (annotated tag list)  
- `profile.assess` (single string) → potentially `profile.affintus` (structured) \+ `profile.assess_other` (narrative array, for the Multi-upload work)

If V2 is doing any data migration for accounts (e.g., associating existing localStorage profiles with newly-created accounts), it doesn't need to anticipate these future schema changes — this work will handle its own migrations. But if V2 introduces a new profile schema version (`pe_v4` or similar), keep that in mind so the future migrations have a clear baseline to work from.

### Sequencing recommendation

Three coherent paths, in order of preference:

1. **V2 ships first, Underlying Drivers ships in the release after.** Cleanest. V2 gets full focus; Underlying Drivers gets full focus; recovery prompt activates once accounts are live.  
2. **V2 and Underlying Drivers ship together as one release.** More ambitious. Possible if engineering capacity allows, but doubles the change surface for the same launch window.  
3. **Underlying Drivers ships first.** Not recommended — the recovery prompt would be device-locked until V2 ships, which means the cross-device dropoff that motivates accounts is exactly the dropoff that motivates the recovery prompt going wide.

Default to (1) unless Bob signals otherwise.

---

# Part 2 — Full Architecture

## Problem

Users currently provide values, passions, and interests as comma-separated tags ("Independence, Family, Justice, Stability") and lists of activities ("Youth mentoring, Formula 1, Fintech"). The form is two textareas with placeholders that read like tag lists, which trains tag-shaped input. The system never asks *why* these things matter. Beta-user feedback (May 2026\) names this gap: people input values, passions, and interests "without necessarily stating why they are interested in these things, value them, or whatever."

The same word means very different things to different users. "Justice" can be Universalism (broad social fairness), Benevolence (taking care of one's people), Conformity (rule-of-law orientation), or even Power (justice as control). Without a structured pass, the inference layer has to guess from context, and single-signal guesses are exactly the failure mode that produces shallow ("horoscope-grade") and wrong ("told them they're driven by X when they're driven by Y") output.

The fix is not making the input form longer or more essay-like — beta users push back on heavy text composition and the existing form's surface-tag structure makes that worse. The fix is shifting to a multi-source, multi-framework architecture that uses validated assessment components for what assessment is good at, narrative inference for what narrative is good at, and triangulation across both to produce confident reads on the user's underlying drivers.

## Philosophy anchor

Reimagine is a career tool by *output* but a whole-person tool by *input* and *philosophy*. The deeper the human capture, the more distinctive and durable the career synthesis. This is a strategic differentiator and shapes every framework choice in this brief: life-framed instruments are preferred over work-framed ones (Schwartz over Schein for values, Big Five over a workplace-personality-only instrument, etc.). Career-specific framings layer on top of whole-person inputs in synthesis; they do not replace whole-person capture in input.

## Architecture overview

Five components, arranged from most-structured (assessment-grade validity) to most-flexible (narrative inference):

1. **Affintus** — workplace personality, organizational culture fit, cognitive aptitude. When the user takes it (\~50% expected adoption given current referral prominence). Structured ingest path that recognizes the 19 dimensions explicitly, not opaque text.  
2. **Schwartz Portrait Values Questionnaire (PVQ-21)** — life values across the 10 universal value types. For everyone. Five-to-seven minutes of click-driven items.  
3. **Narrative inputs** — passions, hobbies, causes, reputation, accomplishments, resume, LinkedIn. Existing inputs, repurposed as multi-signal evidence rather than primary capture for any single dimension.  
4. **Inference layer** — synthesizes deeper drivers, activity archetypes, meaning, and idiosyncratic patterns from all of the above. No structured assessment for these dimensions; narrative inference plus the structured signals from \#1 and \#2 carry the load.  
5. **Validation loop** — system proposes its read, user confirms/edits/rejects at the *driver* level (not at the signal level). User edits become signal themselves.

User-facing strengths language is our own synthesis. No third-party framework like CliftonStrengths or VIA needs to be a first-class component — Affintus and Schwartz handle the assessment-grade work, and the inference layer plus narrative inputs handle the rest. This sidesteps third-party IP and licensing exposure while keeping language recognizable to lay users.

## Components in detail

### Affintus structured ingest

**What changes from today:** App.jsx currently treats Affintus as one of many possible assessments (line 64 in the system prompt: "Any format (Affintus, CliftonStrengths, DiSC, MBTI, Hogan, PI, Enneagram): extract work style..."). Whatever the user uploads goes into `profile.assess` as opaque text. Given expected adoption, we should build Affintus-specific parsing that recognizes its 19 dimensions and ingests them as structured data, not narrative.

**What Affintus covers:** 12 Work Style dimensions (Big Five-flavored personality applied to work — Conscientiousness, Openness, Sociableness=extroversion, Reactiveness=neuroticism, Self Reliance=locus of control, plus workplace facets like Leadership, Persuasiveness, Stamina). 4 Work Culture dimensions (organizational fit — Competitive, Perfectionism, Power, Work Interactions). 3 Learning Style dimensions (cognitive aptitude — Logic, Numeric, Verbal).

**What Affintus does *not* cover:** Values (Schwartz territory). Motivational drivers (SDT-style autonomy/competence/relatedness). Activity archetypes (the Sparketype "what kind of work animates me" question). Meaning or calling. These belong to the inference layer.

**Implementation note:** Affintus delivers narrative descriptions per dimension, not raw numeric scores in its consumer output. Structured parsing means recognizing dimension names and keying off the narrative text per dimension, then mapping each to a normalized internal score (high/medium/low or a 1–5 scale) so downstream synthesis can reason quantitatively across dimensions. Worth verifying whether Affintus offers an API or scored export that bypasses the narrative-only PDF; if so, that's the cleaner path.

### Schwartz PVQ-21

**What it is:** 21-item short form of the Portrait Values Questionnaire. Each item is a brief third-person portrait ("It is important to this person to...") and the user rates similarity to themselves on a 6-point scale. Validated cross-culturally in 80+ countries; standard in the European Social Survey since 2002\. Public domain for non-commercial use; commercial use should be verified but is generally permitted with attribution.

**Administered inside Reimagine — not referred out.** The 21 items are embedded directly in the values step, scored internally, and interpreted by the inference layer. This is the opposite model from Affintus (which is referred out because it's a proprietary 15-minute assessment we can't embed). PVQ-21's items are public, the assessment is short enough that external referral would create more friction than value, and the scoring is straightforward arithmetic (item-to-value mapping with one normalization step controlling for individual response style). Linking out to a third-party host like IDRlabs or Freudly is only useful for *internal team reference* — taking those tests gives the team a feel for the item style — and is not part of the user flow.

**What it produces:** Scores across the 10 universal values — Self-Direction, Stimulation, Hedonism, Achievement, Power, Security, Conformity, Tradition, Benevolence, Universalism. These cluster into four higher-order categories (Openness to Change, Self-Enhancement, Conservation, Self-Transcendence) that are also useful for the synthesis layer.

**Where it lives in the flow:** PVQ-21 sits at the start of the values step, replacing the structural-assessment role of the current "Core Values — 3 to 5 non-negotiables" textarea. After the PVQ-21, the user is asked for their values *in their own words* — annotated tags with quick disambiguation pop-ups, framed as "Now in your own words: what are 3–5 values you'd actually name to describe yourself? These are the words we'll use in your brand story." This is *not* a duplicate ask. PVQ-21 produces the structured scoring used by the inference layer; the user-stated values produce the vocabulary used in brand-synthesis output and serve as triangulation evidence (discrepancies between typed values and PVQ-21 scores are signal worth surfacing in the validation loop, not noise to suppress). The current "Passions, Interests & Causes" textarea also stays as a separate narrative input, similarly reworked toward annotated tags rather than free comma-separated entry.

**User time:** 5–7 minutes for PVQ-21. Adds friction to the orientation phase but is the load-bearing structured assessment for everyone (since Affintus is only \~50% adopted) and produces validated signal that the current free-text approach cannot.

### Narrative inputs and the inference layer

The inference layer reads everything the user has provided — Schwartz scores, Affintus dimensions if available, resume, LinkedIn, passions/causes, reputation, accomplishments — and synthesizes underlying drivers, activity archetypes, meaning, and idiosyncratic patterns. The design rules for this layer:

**Multi-signal triangulation as a hard rule.** No confident claim from a single signal. Single-signal observations become hypotheses ("crosswords *might* indicate a Strategic pattern"); multi-signal observations become assertions ("Strategic shows up in your puzzle preference, your 'connect the dots' Foundation answer, and your STAR story about pattern-spotting"). The Schwartz scores anchor the values claims; Affintus anchors the personality and culture-fit claims; everything else triangulates with these and with each other.

**Cite the evidence.** Every claim in the synthesis must reference the specific user input(s) that support it. "You said X in p7, plus Y in your STAR story, suggests Z." This kills most horoscope risk because horoscopes can't cite specifics.

**Produce non-obvious implications, not just labels.** Not "you value autonomy" but "you value autonomy, which is why being micromanaged early in your career was a particular kind of suffering, and why fractional work appeals even though income volatility doesn't." The implication is the substance; the label is the tag.

**Surface at least one observation the user wouldn't articulate themselves.** This is the test for the "stitch together a story the user won't recognize on her own" goal that anchored the original brief request. Without this, the synthesis is just rephrasing what the user told us.

**Comparative weight visible.** If "Strategic" surfaces from five signals and "Empathic" from one, the user should see that. It's how they know what's load-bearing in the reading and what's tentative.

### Validation loop

After the inference layer produces its synthesis, the user sees a structured presentation of proposed underlying drivers and is asked to confirm, edit, or reject at the *driver* level. ("Strategic — yes / kind of / no, that's not me.") Driver-level granularity, not signal-level — the latter would be tedious. User edits feed back into the synthesis as additional signal, and the final synthesis is generated only after this loop closes.

**Confidence framing.** Tentative claims marked as such, with the user offered an explicit affordance to "tell us more about this" if they want to deepen a hesitant claim. High-confidence claims earned by multi-signal evidence are presented assertively. The system should be confident-but-correctable, not hedging.

## UX design

### Click-driven elicitation, not story essays

Story-prompt elicitation ("tell me about a moment you felt most alive at work") was considered and rejected for two reasons: (a) single-prompt responses produce single ambiguous data points, and (b) cognitive load of composing stories is high, voice support notwithstanding, and turns off a meaningful portion of users.

The dominant input mode is click-driven: forced-choice items (Schwartz PVQ-21), multi-select behavioral checklists (where applicable), annotated tags for the user's own values vocabulary (each tag disambiguated with a quick pick — "your version of Justice is closest to: standing up for someone / institutional accountability / fair process / personal integrity / other"). One short optional text field for "anything else we should know" as a safety valve.

Total user time for the redesigned values/passions/interests area should be roughly comparable to today's two-textarea form (which users typically engage with shallowly), but produces 5–10x richer structured signal because the work is reaction-shaped rather than composition-shaped.

### Graded Affintus encouragement

Three calibrated push moments, each tuned to what's actually missing in the user's input:

**At the assessment step (existing).** Stronger language for users who have nothing, soft mention for users with thin assessments, none at all for users who arrive with a recent Hogan or Clifton. The push message itself is customized to the dimensions that are missing, not generic.

**At the values step (new — Schwartz).** Schwartz is required for everyone and is not optional. No graded push needed here; this is part of the orientation phase.

**At Brand Synthesis (new — recovery prompt).** If the user's assessment data was thin AND the synthesis output shows visible gaps in dimensions Affintus would cover, present a recovery prompt: "We've produced your Brand Synthesis with what we have, but the read on \[specific dimensions: e.g., work-pace fit, cooperative-vs-competitive culture, novelty tolerance\] is generic because we don't have assessment data on those. Affintus would close this gap in 15 minutes. We can either keep going with what we have, or you can take Affintus now and we'll recompute."

Two buttons:

- **"Keep going as is"** — proceeds with current synthesis, flags persist as a reduced-confidence indicator on the affected sections.  
- **"I'll take Affintus now"** — opens Affintus in a new tab, surfaces an upload affordance back in Reimagine, and recomputes the chain when the user returns.

Critical: the recovery prompt triggers on *output thinness* combined with input thinness, not input thinness alone. If a user's synthesis came out rich despite thin assessment input (because resume and values inputs were strong), the prompt does not fire — interrupting a strong moment with "it could be better" feels ungrateful and dampens the emotional payoff.

### Backfill behavior on Affintus return

When the user comes back from Affintus and uploads, recompute the full chain, not only Brand Synthesis (p3). Specifically:

- **Resume Analysis (p1)** — if applicable; some prompts read the resume in light of assessment data.  
- **Wiring & Compass (p2)** — always; this is where Affintus contributes most directly.  
- **Brand Synthesis (p3)** — always.

User feedback and edits captured on prior phases should be preserved across the recompute and re-applied to the regenerated outputs. Phases beyond Brand Synthesis (Wide View, Deep Dive, etc.) regenerate naturally from the updated upstream.

### Session continuity

`localStorage` (existing `pe_v3` key) handles same-device return — the user reopens the same browser and is back in flow. Cross-device return (took Affintus on phone, came back on laptop) is broken until V2's magic-link accounts ship. **This means the Brand Synthesis recovery prompt and V2's accounts work want to land in the same release.** Shipping the recovery prompt before accounts means a meaningful subset of users hit a dead end when they switch devices to take Affintus.

## Failure modes addressed

The two failure modes Bob named — *wrong* (asserting an underlying driver that isn't true of the user) and *shallow* (horoscope-grade output that sounds plausible but says nothing specific) — are addressed by:

**Anti-wrong:** Triangulation rule (no confident claim from single signal); framework backbone constrains the inference space (we can only assert constructs that exist in Affintus, Schwartz, or the inference taxonomy — the LLM cannot invent flattering categories); validation loop catches errors before they propagate; confidence levels visible.

**Anti-shallow:** Citation requirement (every claim references specific user inputs); non-obvious implications required (the implication is the substance); at least one observation the user wouldn't articulate themselves required; comparative weight visible.

## Open questions

1. **Affintus structured ingest vs. narrative parsing.** Does Affintus expose an API or scored export, or are we parsing narrative descriptions per dimension? If narrative-only, the parsing layer needs careful prompt engineering to produce stable normalized scores.  
2. **Schwartz PVQ-21 commercial-use licensing.** PVQ items are widely cited as public-domain or near-public-domain for non-commercial research use. Commercial use should be verified before launch — likely fine with attribution, but worth confirming with Schwartz's published terms or a brief legal pass.  
3. **PVQ-21 vs. PVQ-40 length tradeoff.** PVQ-21 is the standard short form (5–7 minutes). PVQ-40 is the longer version (8–12 minutes, somewhat better psychometrics). Recommendation is PVQ-21 unless user time is judged a non-issue, but worth confirming.  
4. **Annotated tags implementation depth.** The values tag list with disambiguation pop-ups is well-defined as a concept but needs UI design work — the disambiguation options for each user-supplied tag have to be generated dynamically (per tag) by the LLM, or come from a curated lookup. Curated is simpler but limited; dynamic is richer but slower and adds an LLM call per tag.  
5. **Where the validation loop lives in the existing flow.** Most natural insertion point is between Wiring & Compass (p2) and Brand Synthesis (p3) — after the underlying drivers are first synthesized, before they get woven into the brand statement. But it could also live at p3 itself or as a dedicated step. Worth deciding during scoping.

## Implementation considerations

- **Schema changes.** `profile.values` (single textarea) → `profile.values_pvq` (Schwartz scores per item) plus `profile.values_tags` (annotated tag list with per-tag context). `profile.assess` may need to fork into `profile.affintus` (structured) and `profile.assess_other` (narrative) for the multi-upload work referenced in the related-items section.  
- **Prompt structure changes.** The system prompt's assessment-handling instruction (line 64 of App.jsx) needs to fork: structured handling for Affintus, narrative for everything else, and explicit Schwartz integration. The synthesis prompts (p2, p3) need to read structured Schwartz scores and Affintus dimensions distinctly rather than concatenating narrative inputs.  
- **Sequencing dependency.** The multi-assessment upload backlog item should ship in the same release as this work — structured Affintus \+ N narrative assessments composes more cleanly than N narrative assessments alone.  
- **Engineering size.** Larger than M, smaller than the V2 Launch. Estimated 2–3 weeks engineering plus prompt-engineering iteration.

## Cross-references

- [**Mental Frameworks brief**](http://../briefs/2026-05-06_mental-frameworks-brief.md) — overlaps in spirit (both surface things from the user's existing material that the user hasn't named themselves). Worth deciding whether they're one initiative or two when this gets prioritized.  
- [**Wide View collapses to current function**](http://../reimagine-future-enhancements.md) — the underlying-drivers architecture feeds the capability-first reverse pass directly. Once we have rich underlying-driver signal, the Wide View can generate role suggestions seeded on capabilities rather than current job title.  
- [**Multiple assessment uploads**](http://../reimagine-future-enhancements.md) — paired with this work; should ship together.  
- [**Reimagine V2 Launch Plan**](http://../briefs/2026-05-04_reimagine-launch-plan.md) — V2's magic-link accounts are required for cross-device session continuity in the Brand Synthesis recovery prompt. This work and V2 want to land in the same release window or this one waits for V2 to ship first.

