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
]

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
