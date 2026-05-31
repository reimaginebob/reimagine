// src/voice-patterns.mjs
// Banned constructions across every Reimagine analytical output.
// Single source of truth, used by:
//   - scripts/check-voice.mjs at build time (scans source code; honors // voice-allow regions)
//   - generate() / generateSection() at runtime (scans model output before it reaches the user)
// ESM (.mjs) so Node can import it directly from check-voice.mjs while Vite bundles it for the app.
//
// Two-tier model (appliesTo):
//   ['build','runtime'] - tight constructions we author deliberately. Their
//       presence in source code IS the failure (banned intensifiers,
//       AI-coaching register).
//   ['runtime']        - source can legitimately quote or document these
//       (the Making Your Own Weather quote pool, demo fixtures, user-guide
//       examples). Only model OUTPUT producing them is a violation
//       (all logic-flip variants, comparative-standing, praise-shape).
//
// Step-scoping conventions (the `step` field on a pattern, honored by
// detectVoiceViolations when the caller passes a step option):
//   no step (universal)  - the pattern fires in any module the voice gate
//       wraps. Default for new patterns. Post-Foundation B (PR #84) the
//       formula-* family was rescoped to universal because the p4 umbrella
//       generates p3-shape analytical prose. Transition-* (PR #83) and
//       contamination-* (PR #85, Foundation B.1) are also universal.
//   step: 'p3'           - the pattern fires only on Personal Brand
//       generation. Closer-* family (PR #83, rescoped by #84) is p3-only
//       because the p4 umbrella's Covey-register framing-wager invitation
//       legitimately uses some of those phrasings.
//
// Pattern families currently in the file, by motivation:
//   - logic-flip-*           (sentence cadence; universal, runtime)
//   - comparative-standing-* (forbidden comparison to unnamed groups)
//   - praise-shape-*         (characterization not translation)
//   - process-*              (talk to the reader, not about the output)
//   - framework-*            (never name Bob's internal frameworks)
//   - drama-*                (stock attention-grabbing transitions)
//   - truth-*                (announce-the-truth discourse markers)
//   - meta-*                 (first-person authorial framing)
//   - formula-*              (stock tripartite enumerations; universal as of #84)
//   - closer-*               (closer-template variants; p3-only as of #84)
//   - transition-*           (narrower stock-transition survivors)
//   - contamination-*        (SYS-exemplar verbatim leak; universal, #85)
//
// Keep regexes Unicode-aware where it matters; use the case-insensitive flag.

export const HARD_PATTERNS = [
  // Logic-flip cadence: "X is not Y. It is Z." and "X are not Y. We are Z."
  {
    name: 'logic-flip-is-not',
    re: /\b(?:is|are|was|were)\s+not\s+(?:a\s+|an\s+|about\s+|just\s+|only\s+)?[^.!?\n]{3,80}[.!?]\s*(?:It|That|They|You|We)\s+(?:is|are|was|were)\s+/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Logic-flip cadence: replace with the positive claim on its own.',
  },
  // Logic-flip cadence: "You do not just X, you Y" / "You do not X, you Y"
  {
    name: 'logic-flip-do-not-just',
    re: /\b(?:do|does|did)\s+not\s+(?:just\s+)?[^,.;\n]{3,80},\s*(?:you|we|they)\s+(?:[a-z]+)/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Logic-flip cadence: replace with the positive claim on its own.',
  },
  // Logic-flip cadence: "not X, but Y" inside a sentence
  {
    name: 'logic-flip-not-but',
    re: /\bnot\s+(?:just\s+)?[^,;.\n]{3,60},\s+but\s+(?!a\s+(?:result|consequence|matter|reflection|sign|signal|product))\w+/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Logic-flip "not X, but Y" cadence: rewrite as the positive claim.',
  },
  // Logic-flip cadence: sentence-boundary pivot
  // "You refuse to X. You Y" / "They do not X. They Y" (closes the gap the
  // mid-sentence "is-not" patterns miss; this was the third violation in
  // Bob's screenshot that no other pattern caught).
  {
    name: 'logic-flip-refuse-pivot',
    re: /\b(?:you|we|they)\s+(?:refuse|don't|do\s+not|will\s+not|won't)\s+(?:to\s+)?[^.!?\n]{3,80}[.!?]['"’”)\]]?\s+(?:You|We|They)\s+(?:[a-z]+)/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Logic-flip sentence-boundary pivot: state the positive claim on its own.',
  },
  // Comparative standing against unnamed groups
  {
    name: 'comparative-standing-most-many',
    re: /\b(?:most|many)\s+(?:people|candidates|professionals|leaders|executives|hiring\s+managers|others|managers|engineers|coaches|teams|companies|founders|consultants|operators)\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Comparative standing against unnamed group: forbidden by evidence-anchored confidence.',
  },
  {
    name: 'comparative-standing-average',
    re: /\b(?:the\s+)?average\s+(?:professional|candidate|person|executive|manager|leader|coach|engineer|consultant)/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Comparative standing against an average: forbidden.',
  },
  {
    name: 'comparative-standing-where-others',
    re: /\bwhere\s+others\s+(?:[a-z]+)/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Comparative standing: "where others X" is forbidden.',
  },
  {
    name: 'comparative-standing-unlike-ahead',
    re: /\b(?:unlike\s+most|more\s+than\s+most|ahead\s+of\s+(?:others|most|peers))\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Comparative standing: forbidden.',
  },
  // Banned intensifiers (when not in fixed phrases) - authored deliberately;
  // presence in source is the failure.
  {
    name: 'intensifier-truly-genuinely',
    re: /\b(?:truly|genuinely|absolutely|incredibly)\s+(?:[a-z]+)/i,
    severity: 'hard',
    appliesTo: ['build', 'runtime'],
    note: 'Banned intensifier.',
  },
  // AI-coaching register - authored deliberately; presence in source is the failure.
  // Widened 2026-05-21: the original deictic-only `sit with this/it/that`
  // regex missed the "worth sitting with" gerund form that landed in
  // production Personal Brand output. Adding the specific "worth sitting with"
  // anchor; intentionally NOT adding bare `sitting with` or `sit with the`
  // because the user-guide chapters use those forms legitimately ("the
  // question you are sitting with," "sit with the four questions"). Also
  // adding "take a moment to consider," "get curious about," and "honor your
  // process," all named in the p3 prompt banned list but previously uncaught.
  // Prerequisite P2 (edit of SYS book quote that contained "worth sitting
  // with") shipped in the same PR so the widened gate does not fire on every
  // model echo of its own system prompt.
  {
    name: 'ai-coaching-sit-with',
    re: /\b(?:worth\s+sitting\s+with|sit\s+with\s+(?:this|it|that)|let\s+that\s+land|lean\s+into|hold\s+space\s+for|honor\s+your\s+(?:journey|process)|trust\s+the\s+process|notice\s+what\s+(?:comes\s+up|arises)|what\s+comes\s+up\s+for\s+you|step\s+into\s+the\s+room|take\s+a\s+moment\s+to\s+consider|get\s+curious\s+about)\b/i,
    severity: 'hard',
    appliesTo: ['build', 'runtime'],
    note: 'AI-coaching register.',
  },
  // "Rooms where..." / "rooms in which..." used as audience or situation
  // placeholder (e.g., "make people visible in rooms where they have no
  // voice"). Singular and plural both fire. The existing
  // `room-as-situation-placeholder` SOFT_PATTERN catches some prefix-anchored
  // singular shapes; this HARD_PATTERN closes the relative-clause gap that
  // landed in production LinkedIn Remix output on 2026-05-20. Use
  // "conversations where" / "conversations in which" or a specific situation
  // label (interview, panel, screen, meeting).
  {
    name: 'rooms-where-relative-clause',
    re: /\brooms?\s+(?:where|in\s+which)\b/i,
    severity: 'hard',
    appliesTo: ['build', 'runtime'],
    note: 'Rooms used as audience placeholder followed by a relative clause. Use conversations or a specific situation label.',
  },
  // --- 2026-05-18 hedging-calibration / overclaim refusal (runtime-only;
  // absolutism words have legitimate uses outside interpretive synthesis,
  // so these must not block the build) ---
  {
    name: 'absolutism-every-major',
    re: /\bevery\s+(?:major|single|important|key|critical)\s+[a-z]+(?:\s+[a-z]+){0,2}\s+(?:\w+\s+){0,3}(?:you|she|he|they)\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Absolutism: "every [adjective] [noun] you [verb]": name the specific instances, do not collapse to "every".',
  },
  {
    name: 'absolutism-the-hardest',
    re: /\bthe\s+(?:hardest|most\s+\w+|only)\s+\w+/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Absolutism: "the hardest X" / "the most X" / "the only Y" without referent.',
  },
  {
    name: 'absolutism-career-arc',
    re: /\byou\s+have\s+spent\s+your\s+career\s+\w+ing\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Life-arc framing presented as fact.',
  },
  {
    name: 'mind-reading-by-verbing',
    re: /\bby\s+(?:refusing|choosing|caring|insisting|believing|wanting|hoping)\s+(?:to\s+|about\s+|in\s+)/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Mind-reading: "by [verb]-ing" attributing internal motivation. Require verbatim quote backing.',
  },
  {
    name: 'mind-reading-conviction-mission',
    re: /\byour\s+(?:conviction|mission|belief)\s+(?:that|is|to)\s+/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Mind-reading: claiming the user has a specific conviction/mission/belief without verbatim quote.',
  },
  // 2026-05-21 KYV polish: a Personal Brand output shipped three "less about X
  // and more about Y" sentences. The same logic-flip family the standing
  // memory bans, expressed as a comparative rather than a negation. Runtime-
  // only because source content (prompt examples, etc.) legitimately quotes
  // the construction as a banned demo. Prerequisite P1 (rewrite of the p3
  // worked example that contained this construction) shipped in the same PR
  // so the model is not instructed to emulate the banned shape.
  {
    name: 'logic-flip-less-about-more-about',
    re: /\bless\s+about\s+[^,;.\n]{2,80}\s+(?:and|than)\s+more\s+about\s+/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Logic-flip "less about X and more about Y" cadence: state the actual point directly.',
  },
  // 2026-05-21 KYV polish: same Personal Brand output attributed internal
  // states the user inputs did not establish ("a season of reassessment,"
  // "a sense of legacy"). Four sibling patterns cover the shapes the
  // model uses; existing `mind-reading-conviction-mission` covers a subset
  // but misses the "season of," "sense of," "gave you a sense of," and
  // "shaped your conviction" variants. All runtime-only. The "sense of"
  // pattern uses a whitelist of internal-state nouns to avoid catching
  // legitimate "sense of humor" / "sense of timing." Whitelist includes
  // `agency` and `stewardship` per consult finding.
  {
    name: 'mind-reading-season-of',
    re: /\b(?:in\s+)?a\s+season\s+of\s+\w+/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Mind-reading: "in a season of X" attributes internal state. Anchor in verbatim input or remove.',
  },
  {
    name: 'mind-reading-sense-of',
    re: /\b(?:your|a)\s+sense\s+of\s+(?:legacy|purpose|mission|calling|conviction|destiny|meaning|self|identity|belonging|duty|responsibility|urgency|injustice|fairness|agency|stewardship)\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Mind-reading: attributing a specific "sense of X" without verbatim quote. Anchor or remove.',
  },
  {
    name: 'mind-reading-gave-you',
    re: /\b(?:gave|gives|gave\s+you|gives\s+you)\s+(?:a|the)\s+(?:sense|feeling|conviction|belief|certainty|drive|hunger)\s+(?:of|that|to)\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Mind-reading: claiming an experience produced a specific internal state. Anchor in verbatim quote or remove.',
  },
  {
    name: 'mind-reading-shaped-your',
    re: /\b(?:left\s+you\s+with|shaped\s+your|built\s+your)\s+(?:a\s+)?(?:sense|conviction|certainty|drive|belief|feeling|hunger)\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Mind-reading: variant claim that an experience installed a specific internal state. Anchor or remove.',
  },
  {
    name: 'slogan-cadence-the-x-is-the-y',
    re: /\bThe\s+(?:\w+\s+){1,5}is\s+the\s+(?:\w+\s+)*\w+\.\s+The\s+(?:\w+\s+){1,5}is\s+the\s+(?:\w+\s+)*\w+\./i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Slogan cadence: paired declarative "The X is the Y. The Z is the W." sentences.',
  },
  // 2026-05-21 p7 hotfix: model under output-budget pressure broke the
  // fourth wall with first-person process narration ("I need to continue
  // searching," "Let me search for more," "Due to token constraints, I'll
  // now synthesize," "Let me create the structured output"). This is the
  // AI-meta-narration failure class. Two patterns cover it.
  //
  // 2026-05-21 follow-up hotfix: narrowed both to appliesTo: ['build'] only.
  // Runtime gate ran a 9-minute retry chain on a production p7 regeneration
  // and still shipped meta-narration to the user; the model is robust to
  // the corrective callout for this construction class. Deterministic
  // post-processing now happens via stripMetaNarration in src/App.jsx.
  // Build-time check stays so authored meta-narration in source still
  // fails the build.
  {
    name: 'ai-meta-narration-first-person',
    re: /\b(?:I\s+(?:need\s+to|will\s+now|am\s+going\s+to|should|can)\s+(?:continue|search|create|write|synthesize|finalize|now)|Let\s+me\s+(?:search|create|continue|synthesize|now|write|finalize))\b/,
    severity: 'hard',
    appliesTo: ['build'],
    note: 'AI-meta-narration: first-person process commentary. Produce the output directly; do not narrate the act of producing it.',
  },
  {
    name: 'ai-meta-narration-token-constraints',
    re: /\b(?:due\s+to\s+token\s+(?:constraints?|limits?|budget)|token\s+(?:constraints?|limits?|budget)|context\s+(?:constraints?|limits?|window)|I'?ll\s+now\s+(?:synthesize|write|create|produce))\b/i,
    severity: 'hard',
    appliesTo: ['build'],
    note: 'AI-meta-narration: commenting on own token/context constraints. Produce what fits or stop; do not announce truncation.',
  },
  // --- 2026-05-26 Foundation A.5 de-formularize p3 ---
  //
  // Personal Brand outputs settled into a templated rhetorical shape: stock
  // tripartite opener ("Three sources converge on it"), stock source order
  // (career-then-assessment-then-reputation-then-life-story), stock connector
  // sentences ("Your X shows it / Your Y describes you the same way / Your
  // story locates the source"), stock closer ("If the framing of X misses,
  // push back"). Two runs on app versions 9cad731 and ebd0c8a produced the
  // same shape against different profiles. The model satisfies the existing
  // TRIANGULATION DISCIPLINE rule the easiest path: enumerate sources in a
  // fixed order with fixed transitions. The rule is right; the shape is wrong.
  //
  // All entries are:
  //   - appliesTo: ['runtime'] — the prompt itself quotes these phrases as
  //     "REFUSE the following stock frames" examples; a build-time scan
  //     would fire on the prompt's own teaching material. Catch in shipped
  //     model output only.
  //   - no step field (universal) as of Foundation B (2026-05-27, PR #84):
  //     the umbrella in p4 produces p3-shape analytical prose and is the
  //     second observed surface for these AI stock-template phrasings.
  //     The patterns are anchored to ^...m or to highly stock substrings,
  //     so legitimate mid-paragraph uses across other steps do not fire.
  //   - surface: a short human-readable label for the variance-instructing
  //     corrective callout in callClaudeWithVoiceGate so the model gets a
  //     clean list of which formula shapes fired without having to parse
  //     the raw regex matches.
  {
    name: 'formula-three-sources-converge',
    re: /three sources converge/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Three sources converge',
    note: 'Formulaic opener: tripartite enumeration frame. Vary the opener across sessions.',
  },
  {
    name: 'formula-two-patterns-one-fact',
    re: /two patterns and one fact/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Two patterns and one fact',
    note: 'Formulaic opener: a likely substitute for the tripartite enumeration frame. Vary the opener across sessions.',
  },
  {
    name: 'formula-career-shows-it',
    re: /^[Yy]our career shows it\b/m,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Your career shows it',
    note: 'Formulaic transition: first-of-line enumeration of evidence sources. Weave evidence into prose; do not enumerate.',
  },
  {
    name: 'formula-reputation-describes-same',
    re: /[Yy]our reputation (answers )?describes? you the same way/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Your reputation [answers] describes you the same way',
    note: 'Formulaic transition: stock connector to a second evidence source. Vary the connector language across sessions.',
  },
  {
    name: 'formula-cliftonstrengths-same-way',
    re: /[Yy]our CliftonStrengths .{0,40}(shows the same|same way of thinking)/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Your CliftonStrengths shows the same way of thinking',
    note: 'Formulaic transition: stock connector to an assessment source. Vary the connector language across sessions.',
  },
  {
    name: 'formula-story-locates-source',
    re: /[Yy]our story locates (the source|where this came from|where this started|where it began)/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Your story locates [the source / where this came from / where this started / where it began]',
    note: 'Formulaic transition: stock close to a multi-source walk. Weave evidence into prose; do not enumerate. Widened 2026-05-27 (PR-C) to catch the location-target variants ("where this came from", "where this started", "where it began") that hopped past the original "the source" anchor.',
  },
  {
    name: 'formula-three-lines-of-evidence-converge',
    re: /^three lines of evidence converge/im,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Three lines of evidence converge',
    note: 'Near-variant of formula-three-sources-converge that uses "lines of evidence" instead of "sources". Same templated three-source opener.',
  },
  {
    name: 'formula-your-reputation-confirms-it',
    re: /^[Yy]our reputation confirms it\b/m,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Your reputation confirms it',
    note: 'Stock transition variant. Same family as formula-career-shows-it but applied to reputation rather than career.',
  },
  {
    name: 'formula-your-work-history-shows',
    re: /^[Yy]our work history shows\b/m,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Your work history shows',
    note: 'Near-variant of formula-career-shows-it. Same templated opener with "work history" substituted for "career".',
  },
  {
    name: 'formula-your-reputation-data-names',
    re: /^[Yy]our reputation data names\b/m,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Your reputation data names',
    note: 'Stock transition variant. Variant of formula-reputation-describes-same with "data names" framing.',
  },
  {
    name: 'formula-stock-closer-push-back',
    re: /[Ii]f the framing of .{1,80} misses,?\s+push back/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'If the framing of X misses, push back',
    note: 'Formulaic closer: stock wager-naming sentence. Vary the close across sessions or omit it when the read does not warrant one.',
  },
  {
    name: 'formula-converge-on-it',
    re: /converge on it/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'converge on it',
    note: 'Formulaic phrase pointing at a tripartite enumeration frame. Vary the opener and the connective language.',
  },
  // --- 2026-05-27 Voice guide application (PR 2 of 2; replays the
  // patterns from the reverted PR #77 in a deployment-safe shape) ---
  //
  // Applies the un-shipped rules from context/voice-and-style.md and
  // context/operating_context.md that were missed because the context
  // folder was never read at session start. Five families, all
  // appliesTo:['runtime'] so the build-time scan does not fire on:
  //   - the SYS REFUSE-example list (already inside voice-allow markers
  //     in src/App.jsx; api/claude.js is not scanned by check-voice)
  //   - src/data/user-guide/15-glossary.md where "KEEL principles" and
  //     "the 4 C's" are legitimately documented with explicit "not
  //     exposed in outputs" notes (the rule that motivates the patterns)
  //   - any future prompt-source quotation of a banned construction
  //
  // Step omitted (universal). The five families catch model output
  // regardless of which module produced it. If a future per-module
  // exception is needed (e.g., income flow legitimately uses "the truth
  // is"), add step-scoping at that point.
  //
  // The variance-instructing corrective callout in App.jsx
  // (buildVarianceCorrective) is extended to aggregate these surfaces
  // alongside the existing formula-* family so the model gets a single
  // consolidated retry instruction.

  // Process exposure: constructions that talk about the output rather
  // than to the reader. The closer formula the Foundation A.5 patterns
  // chased ("If the framing of X misses, push back") was a process-
  // exposure variant; these patterns generalize the catch.
  {
    name: 'process-the-framing-here',
    re: /the framing here is/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'The framing here is',
    note: 'Process exposure: talks about the output rather than to the reader. Say the thing directly.',
  },
  {
    name: 'process-the-framing-of-x-is-the-wager',
    re: /the framing of .{1,80} is the (interpretive )?wager/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'The framing of X is the wager',
    note: 'Process exposure: wager-naming language is internal scaffolding the user should not read.',
  },
  {
    name: 'process-the-interpretive-wager',
    re: /the (interpretive )?wager (here )?is/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'The interpretive wager is',
    note: 'Process exposure: same wager-naming family as the framing-of-X variant.',
  },
  {
    name: 'process-let-me-explain',
    re: /\blet me explain\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Let me explain',
    note: 'Process exposure: meta-narration that introduces content instead of producing it.',
  },
  {
    name: 'process-let-me-walk-you-through',
    re: /\blet me walk you through\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Let me walk you through',
    note: 'Process exposure: same meta-narration family as let-me-explain.',
  },
  {
    name: 'process-what-i-will-do-here',
    re: /\bwhat i (will|am going to) (do|walk|share)\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'What I will do/walk through',
    note: 'Process exposure: narrating the production instead of producing.',
  },

  // --- 2026-05-27 Closer-template widenings (PR #83, re-scoped by PR #84) ---
  //
  // Post-PR-#82 sampling against the Covey voice register showed five-of-five
  // outputs closing with a structural variant of "The [framing/through-line/
  // wager] [here/of X] is Y. If that misses how you experience [W], [feedback
  // box / name what / the read will adjust]." The model variant-hopped past
  // the existing process-* patterns (inserting words like "wager" between
  // "framing" and "here," or restructuring as "The choice of X as the
  // through-line is the wager"). These three families (A, B, C) catch the
  // p3 survivors. Family D (transition-*) remains universal because stock
  // tripartite transitions are not legitimate in any analytical context.
  //
  // PR #84 (Foundation B) added step: 'p3' to closer-* patterns. The p4
  // umbrella generates the Covey-register "framing wager invitation"
  // closing language legitimately; scoping the closer-* patterns to p3
  // lets the umbrella use that language while keeping it blocked in p3
  // where it was contaminating outputs.
  //
  // All runtime-only. Anchored with ^...m where the failure surface is
  // paragraph-opening, unanchored where the surface appears inline (the
  // meta-correction invitations in Family A and the feedback-box reference
  // in Family B can appear mid-paragraph).

  // Family A: meta-correction invitations (Part 2 of the closer template).
  // The most distinctive signal because the construction is unusual outside
  // the failure mode.
  {
    name: 'closer-if-that-misses-how-you-experience',
    re: /if (that|this|it) (misses|lands differently|reads differently)\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    step: 'p3',
    surface: 'If that misses / lands differently / reads differently',
    note: 'Closer template: meta-correction invitation. State the principle directly and invite correction in one direct sentence instead.',
  },
  {
    name: 'closer-name-what-it-misses',
    re: /name what it (is )?(missing|misses)\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    step: 'p3',
    surface: 'name what it is missing / misses',
    note: 'Closer template: meta-correction invitation. Same family as if-that-misses-how-you-experience.',
  },
  {
    name: 'closer-the-X-will-adjust',
    re: /the (analysis|read|framing|reading) will adjust\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    step: 'p3',
    surface: 'the analysis / read / framing / reading will adjust',
    note: 'Closer template: meta-correction invitation that exposes the tool. State the principle, invite correction, do not announce the adjustment mechanism.',
  },

  // Family B: feedback-box references (explicit meta-tool exposure).
  {
    name: 'closer-feedback-box-below',
    re: /(use )?the feedback box below\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    step: 'p3',
    surface: 'use the feedback box below',
    note: 'Closer template: explicit reference to the UI feedback mechanism. Invite correction without naming the tool.',
  },

  // Family C: closer principle-announcement openers (Part 1 of the closer
  // template, paragraph-opening). Anchored ^...im so they fire on
  // paragraph-opening surfaces but not on legitimate mid-paragraph uses
  // like "the through-line you described in your inputs."
  {
    name: 'closer-the-through-line-here',
    re: /^the through[\s-]?line here is\b/im,
    severity: 'hard',
    appliesTo: ['runtime'],
    step: 'p3',
    surface: 'The through-line here is',
    note: 'Closer template: announces the through-line as a framing. State the principle directly.',
  },
  {
    name: 'closer-the-framing-here',
    re: /^the framing( \w+)? here is\b/im,
    severity: 'hard',
    appliesTo: ['runtime'],
    step: 'p3',
    surface: 'The framing [optional word] here is',
    note: 'Closer template: variant of the framing-here construction that allows an inserted word (e.g., "wager") between framing and here.',
  },
  {
    name: 'closer-the-wager-here',
    re: /^the wager (here )?is\b/im,
    severity: 'hard',
    appliesTo: ['runtime'],
    step: 'p3',
    surface: 'The wager [here] is',
    note: 'Closer template: paragraph-opening wager-announcement, narrower than the existing process-the-interpretive-wager.',
  },
  {
    name: 'closer-the-choice-of-X-as',
    re: /^the choice of [^.]{1,80} as the through[\s-]?line\b/im,
    severity: 'hard',
    appliesTo: ['runtime'],
    step: 'p3',
    surface: 'The choice of X as the through-line',
    note: 'Closer template: announces the analytical choice as a wager. Produce the synthesis, do not narrate the choice.',
  },
  {
    name: 'closer-the-framing-of-X-is',
    re: /^the framing of [^.]{1,80} (as|is) the (interpretive )?(choice|wager|reading)\b/im,
    severity: 'hard',
    appliesTo: ['runtime'],
    step: 'p3',
    surface: 'The framing of X is the interpretive choice / wager',
    note: 'Closer template: variant of the framing-of-X-is-the-wager family. State the principle directly.',
  },

  // Family D: narrower stock-transition variants that survived PR #81.
  {
    name: 'transition-your-career-shows-the-pattern',
    re: /^[Yy]our career shows the pattern\b/m,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Your career shows the pattern',
    note: 'Stock transition: variant of the formula-career-shows-it family that pivots on "shows the pattern" rather than "shows it."',
  },
  {
    name: 'transition-three-things-in-your-background',
    re: /^three things in your background point to\b/im,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Three things in your background point to',
    note: 'Stock transition: tripartite enumeration opener. Vary the connective and the count.',
  },

  // --- 2026-05-27 Substance-contamination patterns (Foundation B.1, PR #85) ---
  //
  // Catch verbatim leak of SYS exemplar phrases into user-facing output. The
  // model has reproduced SYS demonstration text verbatim under low-temperature
  // conditions (PR #83 lesson on the Covey worked example). The longform
  // VOICE REFERENCE block in SYS includes four fabricated exemplars about
  // "Pia Lopez" at a "food bank in Sacramento" plus caregiving years and a
  // six-axis explanation; these patterns catch the distinctive signatures.
  //
  // Universal scope (no step field) because contamination can theoretically
  // leak into any module that runs through the voice gate. Post-Foundation B
  // (PR #84), p3 and p4 are the modules that route through the voice gate;
  // other modules call callClaude directly without gate wrapping. The
  // applyContaminationPlaceholders helper in App.jsx is the final-defense
  // enforcement when retries exhaust on these patterns.
  {
    name: 'contamination-pia-lopez',
    re: /\bPia Lopez\b/,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Pia Lopez',
    note: 'Substance contamination: name from SYS exemplar 1. Use the actual user.',
  },
  {
    name: 'contamination-food-bank-sacramento',
    re: /\bfood bank in Sacramento\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'food bank in Sacramento',
    note: 'Substance contamination: setting from SYS exemplar 1.',
  },
  {
    name: 'contamination-staff-knows-regulars',
    re: /\bthe staff knows the regulars by name\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'the staff knows the regulars by name',
    note: 'Substance contamination: distinctive phrase from SYS exemplar 1. Replaces the earlier "back office at a mid-sized" pattern which was too loose (matched legitimate prose about back offices at mid-sized firms).',
  },
  {
    name: 'contamination-caregiving-years-gap',
    re: /\bcaregiving years do not appear on a resume\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'caregiving years do not appear on a resume',
    note: 'Substance contamination: opening line from SYS exemplar 3.',
  },
  {
    name: 'contamination-grant-cycles',
    re: /\bgrant cycles and other people's good intentions\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'grant cycles and other people\'s good intentions',
    note: 'Substance contamination: distinctive phrase from SYS exemplar 1.',
  },

  // Framework naming: Bob's internal frameworks are how Reimagine thinks,
  // not vocabulary for the user. Production lane names (Familiar Ground,
  // Industry Insider, Work That Matters) are intentionally retained per
  // Bob's call; these patterns ban the framework names themselves.
  {
    name: 'framework-four-cs',
    re: /\b(four|4)\s*c'?s\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: '4 Cs',
    note: 'Framework name not exposed in user-facing outputs. Do the thing the framework describes in plain language.',
  },
  {
    name: 'framework-five-ps',
    re: /\b(five|5)\s*p'?s\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Five Ps',
    note: 'Framework name not exposed in user-facing outputs. Do the thing the framework describes in plain language.',
  },
  {
    name: 'framework-keel',
    re: /\bKEEL\b/,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'KEEL',
    note: 'Framework name not exposed in user-facing outputs. The KEEL principles inform tone; they are not vocabulary.',
  },
  {
    name: 'framework-keel-principles',
    re: /\bKEEL principles\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'KEEL principles',
    note: 'Framework name not exposed in user-facing outputs.',
  },
  {
    name: 'framework-quota-of-one',
    re: /\bquota of one\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Quota of One',
    note: 'Framework name not exposed in user-facing outputs.',
  },
  {
    name: 'framework-like-for-like',
    re: /\blike[\s-]?for[\s-]?like( fallacy)?\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Like-for-Like (Fallacy)',
    note: 'Framework name not exposed in user-facing outputs.',
  },
  {
    name: 'framework-three-lane-pivot',
    re: /\bthree[\s-]?lane pivot( model)?\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Three-lane pivot model',
    note: 'Framework name not exposed in user-facing outputs. Production lane names (Familiar Ground, Industry Insider, Work That Matters) are fine.',
  },
  {
    name: 'framework-bake-a-cake',
    re: /\bbake a cake\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Bake a Cake',
    note: 'Framework name not exposed in user-facing outputs.',
  },
  {
    name: 'framework-tide',
    re: /\bTide framework\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Tide framework',
    note: 'Framework name not exposed in user-facing outputs.',
  },

  // Drama punches: stock attention-grabbing transitions.
  {
    name: 'drama-heres-the-kicker',
    re: /\bhere'?s the kicker\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: "Here's the kicker",
    note: 'Drama punch. Let the substance carry; do not announce that something interesting is coming.',
  },
  {
    name: 'drama-here-is-where-it-gets',
    re: /\bhere'?s where it gets (interesting|good|hard|real)\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: "Here's where it gets [interesting/good/hard/real]",
    note: 'Drama punch. Same family as heres-the-kicker.',
  },
  {
    name: 'drama-this-is-where',
    re: /\bthis is where it (?:gets|starts to|really)\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'This is where it gets/starts/really',
    note: 'Drama punch. Same family as here-is-where-it-gets.',
  },

  // Truth announcements: discourse markers that announce the reveal of
  // a truth instead of stating it. "Honestly,/Frankly,/Candidly," is
  // matched only when followed by a comma to avoid false-positiving on
  // legitimate adverbial use ("she spoke honestly about her doubts").
  {
    name: 'truth-the-truth-is',
    re: /\bthe truth is\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'The truth is',
    note: 'Truth announcement. State the thing directly.',
  },
  {
    name: 'truth-here-is-the-thing',
    re: /\bhere'?s the thing\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: "Here's the thing",
    note: 'Truth announcement. State the thing directly.',
  },
  {
    name: 'truth-the-real-answer-is',
    re: /\bthe real answer is\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'The real answer is',
    note: 'Truth announcement. State the thing directly.',
  },
  {
    name: 'truth-honestly-frankly-candidly',
    re: /\b(honestly|frankly|candidly),/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Honestly,/Frankly,/Candidly,',
    note: 'Sincerity-qualifier truth announcement. Comma-anchored to avoid catching legitimate adverbial use.',
  },

  // Meta-framing: first-person announcements of authorial intent. The
  // existing ai-meta-narration-* patterns catch process-style narration;
  // these catch the conversational meta-framing variants.
  {
    name: 'meta-let-me-share',
    re: /\blet me share (my perspective|a perspective|what i think)\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'Let me share my perspective',
    note: 'Meta-framing: announce authorial intent instead of producing the content.',
  },
  {
    name: 'meta-i-want-to',
    re: /\bi want to (walk you through|share|explain)\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'I want to walk you through',
    note: 'Meta-framing: announce authorial intent instead of producing the content.',
  },
  {
    name: 'meta-what-i-find-interesting',
    re: /\bwhat i find (interesting|striking|notable)\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    surface: 'What I find interesting',
    note: 'Meta-framing: first-person observation framing instead of stating the observation.',
  },
  // Softening patterns added with the Company Read module (PR-1). The Watch-outs
  // subsection must state the negative signal plainly with its source; these are
  // the model's softening hedges that bury the watch-out and let the user skim
  // past it. Runtime-only (source legitimately quotes them in fixtures); fires
  // on model output. Universal scope by brief; surface and re-scope if false
  // positives appear in non-Company-Read outputs.
  {
    name: 'softening-might-be-worth',
    re: /\bmight\s+be\s+worth\s+noting\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Softening on watch-outs: state the watch-out directly with its source. Do not hedge with "might be worth noting".',
  },
  {
    name: 'softening-could-potentially',
    re: /\bcould\s+potentially\s+be\s+a\s+concern\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Softening on watch-outs: state the concern plainly with its source.',
  },
  {
    name: 'softening-some-have-suggested',
    re: /\bsome\s+have\s+suggested\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Softening on watch-outs: name the source directly. "Some have suggested" obscures who said it and when.',
  },
  {
    name: 'softening-may-suggest',
    re: /\bmay\s+suggest\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Softening: name what the source said. "May suggest" hedges away from the actual claim.',
  },
  {
    name: 'softening-could-indicate',
    re: /\bcould\s+indicate\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Softening: name what the indicator points to plainly. "Could indicate" hedges.',
  },
  {
    name: 'softening-its-possible-that',
    re: /\bit['’]s\s+possible\s+that\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Softening: state the claim if it has evidence; mark it as a hypothesis if it does not.',
  },
]

export const SOFT_PATTERNS = [
  // Praise-shape signals (lower confidence; flag for review, do not auto-regenerate)
  {
    name: 'praise-shape-you-are',
    re: /\bYou\s+are\s+(?:driven|wired|the\s+kind|someone\s+who|an\s+operator|a\s+builder|a\s+connector|a\s+strategist)\b/i,
    severity: 'soft',
    appliesTo: ['runtime'],
    note: 'Possible praise-shape; verify it carries a translation move.',
  },
  // "human flourishing" / similar LLM-poetic
  {
    name: 'ai-poetic-flourishing',
    re: /\bhuman\s+flourishing\b/i,
    severity: 'soft',
    appliesTo: ['runtime'],
    note: 'AI-poetic register.',
  },
  // "room/rooms" as an abstract stand-in for a situation, conversation, or
  // audience ("an answer for any room", "depending on the room", "carry into
  // a room"). Prefix-anchored and excludes the legitimate spatial sense
  // ("room for the content") and latitude sense ("room to run / to grow"),
  // so it does not fire on those. Scoped to build (source scan) and runtime
  // (model output). Specific situational labels (panel opener, recruiter
  // screen) are fine and unaffected.
  {
    name: 'room-as-situation-placeholder',
    re: /\b(?:for|in|into|on|across|enter(?:ing)?|walk(?:ing)?\s+into|step(?:ping)?\s+into|present\s+in|carr(?:y|ied|ying)\s+into|read(?:ing)?)\s+(?:the|a|an|any|every|each|that|this|another|some|no)\s+(?:right\s+|wrong\s+|same\s+|different\s+|next\s+|other\s+)?rooms?\b(?!\s+(?:for|to)\b)/i,
    severity: 'soft',
    appliesTo: ['build', 'runtime'],
    note: 'Abstract "room/rooms" for a situation, conversation, or audience. Use situation, conversation, interview, screen, panel, or meeting.',
  },
]

// Second-pass dimensional-fit regression detector for p3 (Personal Brand).
// The p3 prompt instructs the model to weave the six dimensions (Function,
// Industry, Position, Scale, Pace, Mission) inline with bolded keywords as
// the worked example demonstrates. The known failure shape is producing
// six dedicated dimension-titled paragraphs of equal length, which is the
// old Wiring & Compass output regressed. Counts paragraphs whose first 100
// characters open with `**[Dimension]**`; five or more dedicated paragraphs
// is treated as the regression. Used by callClaudeWithVoiceGate in
// src/App.jsx as a second-pass check that runs only after voice violations
// clear; runs only when meta.step === 'p3'. Returns a synthetic violation
// object compatible with the gate's existing telemetry shape on regression,
// or null when the output is clean.
export function detectDimensionalFitRegression(text) {
  if (typeof text !== 'string') return null
  const dimRe = /^\*\*(Function|Industry|Position(?:\s+in\s+the\s+value\s+chain)?|Scale|Pace|Mission)\*\*/im
  const paragraphs = text.split(/\n\n+/)
  const dedicated = paragraphs.filter(p => dimRe.test(p.trim().slice(0, 100)))
  return dedicated.length >= 5
    ? { name: 'dimensional-fit-regression', count: dedicated.length, match: `${dedicated.length} dedicated dimension paragraphs`, note: 'Six dedicated dimension paragraphs detected. Output shape is the old W&C structure; this output should weave dimensions inline per the worked example.' }
    : null
}

/**
 * Patterns that apply in a given scope ('runtime' | 'build').
 */
export function patternsFor(scope, { includeSoft = false } = {}) {
  const base = includeSoft ? [...HARD_PATTERNS, ...SOFT_PATTERNS] : [...HARD_PATTERNS]
  return base.filter(p => p.appliesTo.includes(scope))
}

/**
 * Scan text for banned constructions. Returns an array of detections, one per
 * occurrence (a single pattern that fires three times yields three
 * detections, so per-step violation counts in telemetry are accurate and the
 * brief's "detect on Bob's sample" gate is met). Default scope is 'runtime'
 * (model output); pass scope:'build' to get the source-safe subset.
 *
 * Step filter (Foundation A.5, 2026-05-26): a pattern with a `step` field
 * only fires when the caller passes a matching `step` option. Patterns
 * without a `step` field fire regardless. This lets formulaic-shape
 * detections be p3-only without false-positiving on Bridge Story slot
 * validation or other surfaces where the same phrases might land naturally.
 * Build-time check-voice.mjs does not pass step; step-scoped patterns are
 * runtime-only by construction (appliesTo: ['runtime']) so the build never
 * sees them anyway.
 *
 * Each detection: { name, match, index, severity, note, surface }.
 */
export function detectVoiceViolations(text, { includeSoft = false, scope = 'runtime', step } = {}) {
  if (typeof text !== 'string' || !text) return []
  const patterns = patternsFor(scope, { includeSoft }).filter(p => !p.step || p.step === step)
  const detections = []
  for (const p of patterns) {
    const flags = p.re.flags.includes('g') ? p.re.flags : p.re.flags + 'g'
    const g = new RegExp(p.re.source, flags)
    let m
    while ((m = g.exec(text)) !== null) {
      detections.push({
        name: p.name,
        match: m[0],
        index: m.index,
        severity: p.severity,
        note: p.note,
        surface: p.surface,
      })
      if (m[0] === '') g.lastIndex++ // guard against zero-length-match infinite loop
    }
  }
  return detections
}
