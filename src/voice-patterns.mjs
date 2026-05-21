// src/voice-patterns.mjs
// Banned constructions across every Reimagine analytical output.
// Single source of truth, used by:
//   - scripts/check-voice.mjs at build time (scans source code; honors // voice-allow regions)
//   - generate() / generateSection() at runtime (scans model output before it reaches the user)
// ESM (.mjs) so Node can import it directly from check-voice.mjs while Vite bundles it for the app.
//
// Two-tier model (appliesTo):
//   ['build','runtime'] - tight constructions we author deliberately. Their
//       presence in source code IS the failure (em dashes, banned
//       intensifiers, AI-coaching register).
//   ['runtime']        - source can legitimately quote or document these
//       (the Making Your Own Weather quote pool, demo fixtures, user-guide
//       examples). Only model OUTPUT producing them is a violation
//       (all logic-flip variants, comparative-standing, praise-shape).
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
  // Em dashes in shipped copy - authored deliberately; presence in source is the failure.
  {
    name: 'em-dash',
    re: /—/,
    severity: 'hard',
    appliesTo: ['build', 'runtime'],
    note: 'Em dash: banned in shipped copy.',
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
  // AI-meta-narration failure class. Two patterns cover it. Both runtime-
  // only because source content (this brief, prompt refusal examples) can
  // legitimately quote the construction.
  {
    name: 'ai-meta-narration-first-person',
    re: /\b(?:I\s+(?:need\s+to|will\s+now|am\s+going\s+to|should|can)\s+(?:continue|search|create|write|synthesize|finalize|now)|Let\s+me\s+(?:search|create|continue|synthesize|now|write|finalize))\b/,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'AI-meta-narration: first-person process commentary. Produce the output directly; do not narrate the act of producing it.',
  },
  {
    name: 'ai-meta-narration-token-constraints',
    re: /\b(?:due\s+to\s+token\s+(?:constraints?|limits?|budget)|token\s+(?:constraints?|limits?|budget)|context\s+(?:constraints?|limits?|window)|I'?ll\s+now\s+(?:synthesize|write|create|produce))\b/i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'AI-meta-narration: commenting on own token/context constraints. Produce what fits or stop; do not announce truncation.',
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

// Memorability principle (Bridge Story Slot 1 only). NOT part of HARD_PATTERNS:
// applied solely by the p6 Slot-1 validation step, never by the global runtime
// gate or the build-time check-voice scan. Slot 1 MUST start with something
// human, never a role/title/company/time-anchor/work-artifact framing.
export const MEMORABILITY_PATTERNS = [
  { name: 'mem-im-a-role', re: /^\s*i(?:['\u2019]m|\s+am)\s+(?:an?|the)\s+(?:senior|junior|principal|chief|head|director|manager|leader|engineer|designer|developer|architect|analyst|consultant|advisor|strategist|specialist|operator|founder|cofounder|partner|owner|executive|professional|marketer|recruiter|coach|writer|editor|researcher|scientist|programmer|coordinator|product|software|data|account|vice|customer|business|technical|sales|marketing|finance|operations|hr)\b/i },
  { name: 'mem-ive-spent', re: /^\s*i(?:['\u2019]ve|\s+have)\s+spent\b/i },
  { name: 'mem-after-n-years', re: /^\s*after\s+(?:\d+\s*\+?|an?\s+(?:few|couple|dozen|handful)|several|many|few|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\s*\+?\s*years?\b/i },
  { name: 'mem-for-the-past-over', re: /^\s*(?:for\s+the\s+(?:past|last)\s+(?:(?:\d+\s*\+?|an?\s+(?:few|couple|dozen|handful)|several|many|few|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\s+)?(?:years?|decades?|months?)|over\s+(?:the\s+(?:past|last)\s+)?(?:(?:\d+\s*\+?|an?\s+(?:few|couple|dozen|handful)|several|many|few|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\s+)?(?:years?|decades?|months?))\b/i },
  { name: 'mem-with-n-years-experience', re: /^\s*with\s+(?:\d+\s*\+?|an?\s+(?:few|couple|dozen|handful)|several|many|few|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\s*\+?\s*years?\s+of\s+experience\b/i },
  { name: 'mem-as-a-role', re: /^\s*as\s+(?:an?|the)\s+(?:senior|junior|principal|chief|head|director|manager|leader|engineer|designer|developer|architect|analyst|consultant|advisor|strategist|specialist|operator|founder|cofounder|partner|owner|executive|professional|marketer|recruiter|coach|writer|editor|researcher|scientist|programmer|coordinator|product|software|data|account|vice|customer|business|technical|sales|marketing|finance|operations|hr)\b/i },
  { name: 'mem-throughout-my-career', re: /^\s*throughout\s+my\s+career\b/i },
  { name: 'mem-my-career-background', re: /^\s*my\s+(?:career|background|experience)\s+(?:in|spans|is|has\s+been)\b/i },
  { name: 'mem-currently-i-verb', re: /^\s*currently[,]?\s+i\s+(?:lead|head|run|manage|oversee|direct|drive)\b/i },
  { name: 'mem-bare-title-with-years', re: /^\s*[a-z][\w\s]{2,40}\s+with\s+(?:\d+\s*\+?|an?\s+(?:few|couple|dozen|handful)|several|many|few|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\s*\+?\s*years?\s+of\b/i },
]

// Returns the first MEMORABILITY_PATTERNS name that matches (trimmed), else null.
export function detectMemorabilityViolation(text) {
  if (typeof text !== 'string' || !text.trim()) return null
  const t = text.trim()
  for (const p of MEMORABILITY_PATTERNS) { if (p.re.test(t)) return p.name }
  return null
}

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
 * Each detection: { name, match, index, severity, note }.
 */
export function detectVoiceViolations(text, { includeSoft = false, scope = 'runtime' } = {}) {
  if (typeof text !== 'string' || !text) return []
  const patterns = patternsFor(scope, { includeSoft })
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
      })
      if (m[0] === '') g.lastIndex++ // guard against zero-length-match infinite loop
    }
  }
  return detections
}
