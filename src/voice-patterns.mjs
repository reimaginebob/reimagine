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
  {
    name: 'ai-coaching-sit-with',
    re: /\b(?:sit\s+with\s+(?:this|it|that)|let\s+that\s+land|lean\s+into|hold\s+space\s+for|honor\s+your\s+journey|trust\s+the\s+process|notice\s+what\s+(?:comes\s+up|arises)|what\s+comes\s+up\s+for\s+you|step\s+into\s+the\s+room)\b/i,
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
  {
    name: 'slogan-cadence-the-x-is-the-y',
    re: /\bThe\s+(?:\w+\s+){1,5}is\s+the\s+(?:\w+\s+)*\w+\.\s+The\s+(?:\w+\s+){1,5}is\s+the\s+(?:\w+\s+)*\w+\./i,
    severity: 'hard',
    appliesTo: ['runtime'],
    note: 'Slogan cadence: paired declarative "The X is the Y. The Z is the W." sentences.',
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
