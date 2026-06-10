// src/text-strippers.js
// Canonical deterministic post-processors for LLM output.
//
// History: these helpers originated inline in src/App.jsx and in
// src/text-strippers.mjs (Foundation B.1, PR #85). The My Coach PoC
// (2026-06-09) needs the same cleanup on a server-side streaming path
// (api/coach.js). api/* functions cannot import a `.mjs` sibling from
// src/* (the Vercel function bundler fails to trace `.mjs` across the
// api/src boundary -- the 2026-05-27 FUNCTION_INVOCATION_FAILED outage,
// PR #76). So this canonical copy uses the `.js` extension, which the
// bundler traces reliably (proven by api/chat.js importing
// src/data/user-guide-content.js). text-strippers.mjs now re-exports
// from this file so existing src/App.jsx and Node test imports are
// unchanged; the api function imports this `.js` directly.
//
// All strippers are idempotent: running twice on the same input produces
// the same output.

// --- stripCoachSpeak -------------------------------------------------------
// Vocabulary substitutions that rewrite coach-speak surface phrases the
// longform-feature SYS block targets but the model still emits under
// output-budget pressure. Telemetry via console.warn fires when at least one
// substitution lands.
//
// Inflection-preserving replacer factory. \bword\b in JavaScript regex only
// matches the bare root because the trailing s/d/ing keeps the word boundary
// inside the word. To catch "leverages" / "facilitating" / "utilized" while
// preserving subject-verb agreement on the replacement, we match the verb
// stem (silent-e dropped: "utiliz" not "utilize") plus the conjugation
// suffix, and pick the matching form of the replacement verb.
function inflectionReplacer(stem, replByForm) {
  // replByForm keys: e (base), es (3rd-singular), ed (past), ing (-ing form).
  // Longest first so "es" wins over "e" inside the alternation, "ing" wins
  // over "ed" / "es" / "e" inside the alternation.
  const suffixes = Object.keys(replByForm).sort((a, b) => b.length - a.length)
  const re = new RegExp(`\\b${stem}(${suffixes.join('|')})\\b`, 'gi')
  return [re, (_match, suf) => replByForm[suf.toLowerCase()] || replByForm.e || '']
}

export function stripCoachSpeak(text) {
  if (typeof text !== 'string' || !text) return text
  let out = text
  let count = 0
  const subs = [
    [/\bin service of\b/gi, 'for'],
    [/\btrace that line\b/gi, 'follow that'],
    [/\bcomes alive in\b/gi, 'thrives in'],
    [/\bspeaks to\b/gi, 'points to'],
    [/\bshows up as\b/gi, 'looks like'],
    // Inflection-preserving substitutions for -e verbs. The stem omits the
    // silent e so the regex matches "utilize" / "utilizes" / "utilized" /
    // "utilizing" alike; the replacer picks the matching form of the
    // substitute verb so subject-verb agreement and tense survive.
    inflectionReplacer('leverag', { e: 'use', es: 'uses', ed: 'used', ing: 'using' }),
    inflectionReplacer('utiliz', { e: 'use', es: 'uses', ed: 'used', ing: 'using' }),
    inflectionReplacer('facilitat', { e: 'support', es: 'supports', ed: 'supported', ing: 'supporting' }),
  ]
  for (const [re, repl] of subs) {
    const before = out
    out = out.replace(re, repl)
    if (out !== before) count++
  }
  if (count > 0) {
    console.warn(`[stripCoachSpeak] applied ${count} substitution${count === 1 ? '' : 's'}`)
  }
  return out
}

// --- applyContaminationPlaceholders ---------------------------------------
// Final-defense enforcement for SYS-exemplar substance contamination. Runs
// ONLY when the voice gate retry budget is exhausted AND the unrecovered
// violations include contamination-* hits. Substitutes bracketed placeholders
// for offending exemplar phrases so the user sees an obvious visible glitch
// (cue to regenerate) instead of a foreign name leaking into prose.
export const CONTAMINATION_PLACEHOLDERS = [
  [/\bPia Lopez\b/g, '[the user]'],
  [/\bfood bank in Sacramento\b/gi, '[their work setting]'],
  [/\bthe staff knows the regulars by name\b/gi, '[a specific detail from their work]'],
  [/\bcaregiving years do not appear on a resume\b/gi, '[whatever years are missing from the resume]'],
  [/\bgrant cycles and other people's good intentions\b/gi, '[the constraints of their work]'],
  // 2026-06-01 (PR 1): guide-injection echo phrases. Final-defense placeholders
  // for the two distinctive user-guide phrases the contamination-* gate catches.
  [/\bthe will to stay inside something while it is breaking\b/gi, '[the through-line in the user\'s own terms]'],
  [/\bmapping the entire spend\b/gi, '[what the user actually did]'],
]

export function applyContaminationPlaceholders(text) {
  if (!text || typeof text !== 'string') return text
  let out = text
  for (const [re, repl] of CONTAMINATION_PLACEHOLDERS) {
    out = out.replace(re, repl)
  }
  if (out !== text) {
    console.warn('[contamination] applied placeholder substitutions on retry-exhausted output')
  }
  return out
}

// --- stripLogicFlipCadence -------------------------------------------------
// Deterministic rewrite for the "X is not Y. It is Z." logic-flip cadence.
// This pattern is model-robust: the runtime voice gate detects it, retries,
// the model regenerates the same construction, and the gate falls open, so
// the violation ships. Strip, do not retry.
//
// (A) Two-sentence pivot: "[Subject1] is/are/was/were not [phrase1].
//     [Subject2] is/are/was/were [phrase2]." -> "[Subject1] aux [phrase2]."
// (B) Single-sentence comparison: "[aux] less about [X] (and|,) more about
//     [Y]" -> "[aux] about [Y]".
//
// voice-allow
// Apostrophe class (straight ' and typographic ’) and emphasis-run class (markdown
// ** * _ ~). EMPH is defined here, before its first use, and reused by the
// comparative / intensifier / verdict strippers below.
const AP = "['’]"
const EMPH = '[*_~]*'
// (A) Full-word two-sentence pivot, markdown-aware: "[Subject] is/are/was/were
// [**]not[**] [negPred]. [Pointer] <aux> [phrase2]." -> "[Subject] aux phrase2."
// The pointer must repeat the auxiliary (\3 backref) or use its contraction
// ('s/'re), so it is a genuine copular pivot -- "is not finalized. It requires
// more input." (no matching copula) is left alone. Reconstruction preserves the
// subject. EXCEPTION (fragment guard): if the negated predicate itself starts
// with a copula ("What they are not IS a verdict. They are a signal."), the
// subject is a cleft and reconstructing it would fragment, so we keep the whole
// pointer sentence instead. Either branch yields a complete sentence.
const LOGIC_FLIP_CADENCE_RE = new RegExp(
  '(^|[.!?]' + EMPH + '\\s+|\\n+)' + EMPH +
  '([A-Z][^.!?\\n]*?)\\s+(is|are|was|were)\\s+' + EMPH + 'not' + EMPH + '\\s+' +
  '([^.!?\\n]+?)[.!?]\\s+' + EMPH +
  '((?:It|They|These|Those|This|That|\\2)(?:(?:' + AP + 's|' + AP + 're)\\s+|\\s+\\3\\s+)' + EMPH + ')' +
  '([^.!?\\n]+?[.!?])',
  'g'
)
// Contracted-negation two-sentence pivot ("That's not weakness. It's being
// human." / "These aren't icebreakers. They're active gathering.") -> keep the
// affirmative pointer sentence whole.
const LF_PTR = '(?:It' + AP + '?s|That' + AP + '?s|They' + AP + '?re|These are|Those are|This is|It is|That is|They are)'
const LOGIC_FLIP_CONTRACTED_RE = new RegExp(
  '(^|[.!?]' + EMPH + '\\s+|\\n+)' + EMPH + '[A-Z][^.!?\\n]*?\\s*(?:(?:is|are|was|were)n' + AP + 't|(?:' + AP + 's|' + AP + 're)\\s+not)\\s+[^.!?\\n]+?[.!?]\\s+' + EMPH + '(' + LF_PTR + '\\s+[^.!?\\n]+?[.!?])',
  'g'
)
// (B) Single-sentence "less about X ... more about Y".
const LOGIC_FLIP_LESS_MORE_RE = /\b(is|are|was|were)\s+less\s+about\s+[^.,;!?\n]+?(?:,\s*|\s+and\s+)more\s+about\s+/gi
// (D) Negated lexical verb, same subject repeated: "You didn't come to X via an
// MBA. You came to it through Y." -> keep the affirmative second sentence whole.
const LOGIC_FLIP_LEXICAL_RE = new RegExp(
  '(^|[.!?]' + EMPH + '\\s+|\\n+)' + EMPH + '(You|I|We|They|He|She)\\s+(?:did|do|does)(?:n' + AP + 't|\\s+not)\\s+[^.!?\\n]+?[.!?]\\s+' + EMPH + '(\\2\\s+[^.!?\\n]+?[.!?])',
  'g'
)
// (E) Appositive single clause after a copula: "is an exchange, not a transaction"
// -> "is an exchange". Requires a copula before the kept phrase so "to help, not
// hover" (no copula) is left alone.
const LOGIC_FLIP_APPOSITIVE_RE = new RegExp(
  '\\b(is|are|was|were|' + AP + 's|' + AP + 're|feels?\\s+like|becomes?)\\s+([^.,;:!?\\n]+?),\\s+not\\s+[^.,;:!?\\n]+',
  'gi'
)
// (F) "not because X, but because Y" -> "because Y".
const LOGIC_FLIP_NOT_BECAUSE_RE = /\bnot because\s+[^.,;:!?\n]+?,?\s+but because\s+/gi
export function stripLogicFlipCadence(text) {
  if (typeof text !== 'string' || !text) return text
  let count = 0
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1)
  let out = text.replace(LOGIC_FLIP_CADENCE_RE, (_match, lead, subject1, aux, negPred, pointerPrefix, phrase2) => {
    count++
    if (/^(?:is|are|was|were)\b/i.test(negPred.trim())) {
      // Cleft subject ("What they are not is X") -> reconstructing would fragment;
      // keep the whole pointer sentence instead.
      return `${lead}${cap((pointerPrefix + phrase2).trim())}`
    }
    return `${lead}${subject1} ${aux} ${phrase2}`
  })
  out = out.replace(LOGIC_FLIP_CONTRACTED_RE, (_match, lead, secondSentence) => {
    count++
    return `${lead}${cap(secondSentence)}`
  })
  out = out.replace(LOGIC_FLIP_LEXICAL_RE, (_match, lead, _subj, secondSentence) => {
    count++
    return `${lead}${cap(secondSentence)}`
  })
  out = out.replace(LOGIC_FLIP_LESS_MORE_RE, (_match, aux) => {
    count++
    return `${aux} about `
  })
  out = out.replace(LOGIC_FLIP_APPOSITIVE_RE, (_match, aux, kept) => {
    count++
    return `${aux} ${kept}`
  })
  out = out.replace(LOGIC_FLIP_NOT_BECAUSE_RE, () => {
    count++
    return 'because '
  })
  if (count > 0) {
    console.warn(`[stripLogicFlipCadence] rewrote ${count} logic-flip cadence${count === 1 ? '' : 's'} from LLM output`)
  }
  return out
}
// voice-allow-end

// --- stripSincerityQualifiers ---------------------------------------------
// Deterministic strip for the noun-phrase and adverbial sincerity-qualifier
// prefixes. Same model-robust failure mode as the logic-flip cadence; strip,
// do not retry. Each variant is anchored to a sentence boundary so
// mid-sentence descriptive uses of "honest" are never touched.
//
// voice-allow
const HONEST_NOUN_RE = /(^|[.!?]\s+|\n+)the honest (?:read|reading|answer|truth|take|view|assessment|appraisal)(?::\s+|\s+is\s+that\s+)([^\n]+)/gi
const SINCERITY_ADVERB_RE = /(^|[.!?]\s+|\n+)(?:to be honest|honestly|frankly|candidly),\s+([^\n]+)/gi
// Battery 2026-06-09: the prefix forms above missed the mid-sentence ones that
// shipped. Three new shapes:
//   "I need to be honest with you - I don't have X yet." -> "I don't have X yet."
//   "And this is where brutal honesty comes in." -> dropped
//   "So here's the honest answer: X" -> "X"
// Re-run additions: "be straight with you" is the same announce-your-honesty move
// as "be honest with you"; and the model emitted "## The honest read" as a markdown
// header (no colon), which the noun form below did not catch.
const SINCERITY_MID_RE = /\b(?:I need to be (?:honest|straight) with you|I['’]?ll be (?:honest|straight) with you|I have to be (?:honest|straight) with you|I want to be (?:honest|straight) with you|let me be (?:honest|straight) with you|I['’]?m going to be (?:honest|straight) with you|to be (?:honest|straight) with you)\b[\s,:.—–-]*/gi
const BRUTAL_HONESTY_RE = /(^|[.!?]\s+|\n+)(?:and\s+)?(?:this|here) is where (?:brutal|radical|real|total|complete) honesty comes in[.:]?\s*/gi
const HERES_HONEST_RE = /(^|[.!?]\s+|\n+)(?:so,?\s+)?here(?:['’]s| is) the honest (?:answer|read|reading|truth|take|view)\b(?::\s*|\s+is\s+that\s+|\s*[—–-]\s*)?/gi
const HONEST_HEADER_RE = /(^|\n)#{1,6}\s*the honest (?:read|reading|answer|truth|take|view)[^\n]*(?=\n|$)/gi
// "I'll give you the honest read." / "Let me give you the honest take." -- a
// throat-clear sentence announcing honesty; drop the whole sentence.
const GIVE_HONEST_RE = /(^|[.!?]\s+|\n+)(?:I['’]?ll\s+|I will\s+|let me\s+|so\s+)?give you the honest (?:read|reading|answer|truth|take|view|assessment|appraisal)\b[^.!?\n]*?[.!?]\s*/gi
export function stripSincerityQualifiers(text) {
  if (typeof text !== 'string' || !text) return text
  let count = 0
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1)
  let out = text
  out = out.replace(HONEST_HEADER_RE, (_match, lead) => { count++; return lead })
  out = out.replace(GIVE_HONEST_RE, (_match, lead) => { count++; return lead })
  out = out.replace(HONEST_NOUN_RE, (_match, lead, claim) => { count++; return `${lead}${cap(claim)}` })
  out = out.replace(SINCERITY_ADVERB_RE, (_match, lead, claim) => { count++; return `${lead}${cap(claim)}` })
  out = out.replace(BRUTAL_HONESTY_RE, (_match, lead) => { count++; return lead })
  out = out.replace(HERES_HONEST_RE, (_match, lead) => { count++; return lead })
  out = out.replace(SINCERITY_MID_RE, () => { count++; return '' })
  if (count > 0) {
    console.warn(`[stripSincerityQualifiers] stripped ${count} sincerity qualifier${count === 1 ? '' : 's'} from LLM output`)
  }
  return out
}
// voice-allow-end

// --- stripRoomsPlaceholder -------------------------------------------------
// Audience-placeholder "rooms where / rooms in which" -> "conversation(s)".
// Moved here from src/App.jsx (My Coach PoC, 2026-06-09) so the coach path
// can share it. (Em-dash stripping was removed 2026-05-27 when Bob dropped
// the em-dash ban; em dashes are now normal punctuation the model uses freely.)
//
// voice-allow
export function stripRoomsPlaceholder(text) {
  if (typeof text !== 'string' || !text) return text
  const roomsHits = (text.match(/\brooms?\s+(?:where|in\s+which)\b/gi) || []).length
  if (roomsHits === 0) return text
  // Audience-placeholder noun phrase becomes conversation(s). Preserves
  // singular vs plural and capitalization of the original noun so sentence-
  // initial occurrences do not drop their capital.
  const out = text.replace(/\b(rooms?)\s+(where|in\s+which)\b/gi, (_match, noun, tail) => {
    const isPlural = /s$/i.test(noun)
    let repl = isPlural ? 'conversations' : 'conversation'
    if (/^[A-Z]/.test(noun)) repl = repl.charAt(0).toUpperCase() + repl.slice(1)
    const cleanTail = tail.toLowerCase().replace(/\s+/g, ' ')
    return `${repl} ${cleanTail}`
  })
  console.warn(`[stripRoomsPlaceholder] rewrote ${roomsHits} audience-placeholder noun phrase${roomsHits === 1 ? '' : 's'} from LLM output`)
  return out
}
// voice-allow-end

// --- stripMetaNarration ----------------------------------------------------
// Drops AI-meta-narration lines the model produces under output-budget
// pressure and does not respond to the voice gate's corrective callout for.
// Moved here from src/App.jsx (My Coach PoC, 2026-06-09). Matching is
// case-insensitive on phrase but case-sensitive on the first-person "I"
// (lowercase "i" would false-positive on "if I need to know" and similar).
//
// voice-allow
const META_NARRATION_PATTERNS = [
  /\bI need to (?:continue|search|create|write|synthesize|finalize|now|compile|gather)\b/,
  /\bLet me (?:search|create|continue|synthesize|now|write|finalize|compile|gather)\b/,
  /\b(?:due to|given|with) (?:the )?token (?:constraints?|limits?|budget)\b/i,
  /\bI'?ll (?:now|continue) (?:synthesize|write|create|produce|compile|search|finalize|gather)\b/,
  /\bI (?:will|am going to) now (?:synthesize|write|create|produce|compile|finalize|gather)\b/,
]
export function stripMetaNarration(text) {
  if (typeof text !== 'string' || !text) return text
  const lines = text.split('\n')
  let dropped = 0
  const kept = lines.filter(line => {
    for (const re of META_NARRATION_PATTERNS) {
      if (re.test(line)) { dropped++; return false }
    }
    return true
  })
  if (dropped > 0) {
    console.warn(`[stripMetaNarration] dropped ${dropped} meta-narration line${dropped === 1 ? '' : 's'} from LLM output`)
  }
  return kept.join('\n')
}
// voice-allow-end

// --- stripComparativeStanding ----------------------------------------------
// Battery 2026-06-09 + voice-gate-fix re-run. Remove the unearned "rank the user
// against a group" shape. Two-sentence forms (drop the group sentence, keep the
// affirmative "You" sentence) in BOTH orders, plus a conservative trailing inline
// clause.
//
// The re-run showed the first version's plain-text anchors were defeated by the
// model's heavy markdown: "**Your combination is rare.** Most senior..." put
// `.** ` between the sentence boundary and "Most", so the anchor never fired.
// The anchors here see through emphasis runs (** * _ ~) via EMPH, and the
// apostrophe class AP matches straight and typographic so "can't" / "don't" /
// "aren't" are all caught.
//
// Skips comparisons the voice rules permit: sourced quotes of real feedback
// (looksSourced), the user's own option comparisons, and where/when/in-which
// clauses (the inline rule's lookbehind) so those are not grammar-mangled.
//
// voice-allow
// EMPH and AP are defined in the logic-flip block above (single source).
const CMP_GROUP = '(?:Most|Many|Almost every(?:one|body)?|Plenty of|A lot of|Other|Fewer|The average|The typical)'
// The "lesser" trigger that ends a comparative clause. Contractions are matched
// by their suffix n't (don't / can't / won't / aren't / couldn't) which is robust
// where a full \bword\b match is not (an apostrophe is itself a word boundary in
// JS regex). Requiring the apostrophe means "important" (ends in "nt") is not a
// false trigger. The spelled-out negations and the scope words (just/only/etc.)
// are listed explicitly.
const CMP_TRIGGER = "(?:n['’]t\\b|\\bcannot\\b|\\bdo not\\b|\\bdoes not\\b|\\bwill not\\b|\\brarely\\b|\\bnever\\b|\\bseldom\\b|\\bjust\\b|\\bonly\\b|\\bmerely\\b|\\bsimply\\b|\\bstruggles?\\b|\\bmiss(?:es|ed)?\\b|\\bfalls? short\\b|\\bfails?\\b|\\bclaims?\\b|\\boptimizes?\\b|\\bmanages?\\b)"
// Group-first: "Most <group> ... . [You|Yours|When you|...] ... ." -> keep the
// affirmative contrast sentence. The contrast sentence may start with You / Your /
// Yours, optionally led by "When/Where/Now/But/And/So/Yet you", since the model
// phrases the user-side contrast that way ("...have relationships. Yours run
// deeper." / "...in receive mode. When you show up trying to help, ...").
const CMP_YOU_START = "(?:(?:When|Where|Now|But|And|So|Yet)\\s+)?You(?:['’]re|rs|r)?\\b"
const CMP_GROUP_FIRST_RE = new RegExp(
  '(^|[.!?]' + EMPH + '\\s+|\\n+)' + EMPH +
  '(' + CMP_GROUP + '\\b[^.!?\\n]*?[.!?])' +
  EMPH + '\\s+' +
  '(' + EMPH + CMP_YOU_START + '[^.!?\\n]*?[.!?])',
  'g'
)
// You-first (reversed): "You ... . Most <group> ... <lesser> ... ." -> keep You.
const CMP_YOU_FIRST_RE = new RegExp(
  '(^|[.!?]' + EMPH + '\\s+|\\n+)' +
  '(' + EMPH + "You(?:['’]re|r)?\\b[^.!?\\n]*?[.!?])" +
  EMPH + '\\s+' + EMPH +
  CMP_GROUP + '\\b[^.!?\\n]*?' + CMP_TRIGGER + '[^.!?\\n]*?[.!?]',
  'g'
)
// Trailing inline comparative clause: "... most people <...> cannot match." Drop
// the clause, keep the head. Lookbehind skips where/when/in-which antecedents
// (no trailing \s -- the clause's own \s+ is consumed by the match, so the
// lookbehind asserts on the bare antecedent word), where dropping the clause
// would break the sentence.
const CMP_INLINE_RE = new RegExp(
  '(?<!\\bwhere)(?<!\\bwhen)(?<!\\bin which)' +
  '\\s+(?:that |which )?(?:most|many|few|fewer)\\s+(?:people|professionals|candidates|leaders|others|peers|executives)\\b' +
  '[^.,;:!?\\n]*?' + CMP_TRIGGER +
  '[^.,;:!?\\n]*?(?=[.,;:!?\\n]|$)',
  'gi'
)
const CMP_GROUP_NOUN = '(?:people|professionals|candidates|leaders|others|peers|executives)'
// Trailing "...-er than most people <...>" comparison. "communicated more care
// than most people show." -> "communicated more care." (?<=\w) keeps it to a
// trailing clause so it never fires at a sentence start.
const CMP_THAN_RE = new RegExp('(?<=\\w)\\s+than (?:most|many) ' + CMP_GROUP_NOUN + '\\b[^.,;:!?\\n]*?(?=[.,;:!?\\n]|$)', 'gi')
// Trailing "...most people would <...>" comparison (the trigger-less "would"
// excuse shape). "under conditions most people would use as an excuse." ->
// "under conditions." (?<=\w) and the where/when guards keep it grammar-safe.
const CMP_MOST_WOULD_RE = new RegExp('(?<=\\w)(?<!\\bwhere)(?<!\\bwhen)\\s+(?:that |which )?(?:most|many) ' + CMP_GROUP_NOUN + '\\s+would\\b[^.,;:!?\\n]*?(?=[.,;:!?\\n]|$)', 'gi')
function looksSourced(s) {
  // Double quotes (straight or typographic) or an attribution verb signal a
  // sourced quote that the voice rules permit. Single quotes / apostrophes are
  // NOT a signal -- they appear in every contraction ("can't", "don't"), and
  // treating them as quotes made the guard skip exactly the comparatives we want
  // to strip. Real single-quoted speech is still caught by the attribution verb.
  return /["“”]/.test(s) || /\b(said|says|saying|told|tells|wrote|writes|quote[ds]?|according to|noted|notes|call[s]?\s+you|called you)\b/i.test(s)
}
export function stripComparativeStanding(text) {
  if (typeof text !== 'string' || !text) return text
  let count = 0
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1)
  let out = text.replace(CMP_GROUP_FIRST_RE, (match, lead, groupClause, youSentence) => {
    if (looksSourced(groupClause)) return match
    count++
    return `${lead}${cap(youSentence)}`
  })
  out = out.replace(CMP_YOU_FIRST_RE, (_match, lead, youSentence) => {
    count++
    return `${lead}${youSentence}`
  })
  out = out.replace(CMP_INLINE_RE, (match) => {
    if (looksSourced(match)) return match
    count++
    return ''
  })
  out = out.replace(CMP_THAN_RE, (match) => {
    if (looksSourced(match)) return match
    count++
    return ''
  })
  out = out.replace(CMP_MOST_WOULD_RE, (match) => {
    if (looksSourced(match)) return match
    count++
    return ''
  })
  if (count > 0) {
    console.warn(`[stripComparativeStanding] removed ${count} comparative-standing construction${count === 1 ? '' : 's'} from LLM output`)
  }
  return out
}
// voice-allow-end

// --- stripIntensifiers -----------------------------------------------------
// Battery 2026-06-09 (soft, leaked 12x, mostly "actually"). Remove
// emphasis-only intensifiers. Sentence-initial occurrences re-capitalize the
// following word; mid-sentence occurrences drop the word and the space before
// it. Idempotent.
//
// Markdown-aware: the re-run leaked "**actually care**" because the asterisks sat
// between the space and the word, so the plain `\s+\bword\b` adjacency missed it.
// MID captures the leading "space + optional emphasis" and restores it, so the
// emphasis run stays attached to the next word ("You **care**").
// voice-allow
const INTENSIFIER_WORDS = 'actually|really|genuinely|honestly|truly|literally|absolutely|incredibly|deeply'
const INTENSIFIER_LEAD_RE = new RegExp('(^|[.!?]' + EMPH + '\\s+|\\n+)' + EMPH + '(?:' + INTENSIFIER_WORDS + ')' + EMPH + ',?\\s+' + EMPH + '([A-Za-z])', 'gi')
// Mid-sentence: drop the word and ONE following horizontal space. Removing the
// trailing space (not the leading one) keeps it markdown-clean ("**actually
// care**" -> "**care**") and makes adjacent intensifiers ("really actually X")
// collapse in a single pass, so the function stays idempotent.
const INTENSIFIER_MID_RE = new RegExp('\\b(?:' + INTENSIFIER_WORDS + ')\\b[^\\S\\n]?', 'gi')
export function stripIntensifiers(text) {
  if (typeof text !== 'string' || !text) return text
  let count = 0
  let out = text.replace(INTENSIFIER_LEAD_RE, (_m, lead, ch) => { count++; return `${lead}${ch.toUpperCase()}` })
  out = out.replace(INTENSIFIER_MID_RE, () => { count++; return '' })
  if (count > 0) {
    console.warn(`[stripIntensifiers] removed ${count} emphasis intensifier${count === 1 ? '' : 's'} from LLM output`)
  }
  return out
}
// voice-allow-end

// --- stripHireabilityVerdict -----------------------------------------------
// Voice-gate-fix re-run (approved scope change): the prompt-only odds posture
// held ~2 of 4 times. Promote it to a deterministic guard. Removes:
//   - copular odds verdicts: "your odds [are] excellent / very strong"
//   - Q&A verdicts: "your odds in healthcare broadly? Very strong."
//   - sentence-initial candidate verdicts: "You are a strong candidate."
// Requires a copula before the qualifier so "your odds from 'strong candidate'..."
// and the conditional "Whether you're a strong candidate depends..." are left
// alone. Drops the offending sentence/header, keeps the surrounding redirect.
//
// voice-allow
const VERDICT_QUAL = '(?:excellent|very strong|strong|good|great|high|solid|favorable|exceptional|in your favor|as high as they get|as good as it gets|couldn' + "['’]" + 't be (?:higher|better))'
// Optional adverb before the candidate qualifier ("a VERY strong candidate") --
// the re-run showed "You're a very strong candidate for VP TA roles" slipped the
// guard because it had no adverb slot.
const VERDICT_ADV = "(?:very|quite|extremely|genuinely|really|truly|incredibly|remarkably|exceptionally|undeniably|absolutely|highly|a\\s+remarkably)?\\s*"
const ODDS_QA_RE = new RegExp(
  '(^|\\n+|[.!?]' + EMPH + '\\s+)' + EMPH + '[^.?\\n]*?\\b(?:your|the) (?:odds|chances)\\b[^.?\\n]*?\\?\\s+' + EMPH + VERDICT_QUAL + '\\b[^.!?\\n]*?[.!?]',
  'gi'
)
const ODDS_VERDICT_RE = new RegExp(
  '(^|\\n+|[.!?]' + EMPH + '\\s+)#{0,6}\\s*' + EMPH + '[^.!?\\n]*?\\b(?:your|the) (?:odds|chances)\\b[^.!?\\n]*?\\b(?:are|is|look[s]?|seem[s]?|remain[s]?|stay[s]?)\\s+' + EMPH + VERDICT_QUAL + '\\b[^.!?\\n]*?(?=[.!?\\n]|$)[.!?]?',
  'gi'
)
const CANDIDATE_VERDICT_RE = new RegExp(
  '(^|[.!?]' + EMPH + '\\s+|\\n+)' + EMPH + "You(?:['’]re| are)\\s+(?:an?\\s+)?" + VERDICT_ADV + "(?:strong|solid|great|competitive|weak|excellent|good|exceptional|compelling)\\s+candidate\\b[^.!?\\n]*?[.!?]",
  'gi'
)
export function stripHireabilityVerdict(text) {
  if (typeof text !== 'string' || !text) return text
  let count = 0
  let out = text.replace(ODDS_QA_RE, (_m, lead) => { count++; return lead })
  out = out.replace(ODDS_VERDICT_RE, (_m, lead) => { count++; return lead })
  out = out.replace(CANDIDATE_VERDICT_RE, (_m, lead) => { count++; return lead })
  if (count > 0) {
    console.warn(`[stripHireabilityVerdict] removed ${count} hire-ability verdict${count === 1 ? '' : 's'} from LLM output`)
  }
  return out
}
// voice-allow-end

// --- stripFrameworkNames ---------------------------------------------------
// Voice-gate-fix re-run: framework/chapter naming held poorly on instruction
// alone. Neutralize the recurring named items, doing what the framework
// describes in plain language. The book title itself ("Making Your Own Weather")
// is left intact -- it names a real resource the coach legitimately points to.
//
// voice-allow
const FRAMEWORK_SUBS = [
  [/\bRock['’]s Fab Five\b/gi, 'a few opening questions'],
  [/\bthe Perspiration P\b/gi, 'the work-ethic point'],
  [/\b(?:one of the )?bonus Ps from the book\b/gi, 'an additional point worth making'],
  [/\bChapter\s+\d+(?:\s+of the book)?\s*\(([^)]+)\)/gi, '$1'],
  [/\s*\(\s*(?:Chapter|Lesson)\s+\d+\w*(?:\s+(?:in|of)\s+the book)?\s*\)/gi, ''],
  [/\b(?:Chapter|Lesson)\s+\d+\w*\s+(?:in|of)\s+the book\b/gi, 'the book'],
  [/\b(?:Chapter|Lesson)\s+\d+\w*\b/gi, 'the book'],
  [/\bthe KEEL (?:principles?|section|framework|model|idea)\b/gi, 'these attitude principles'],
  [/\bthe KEEL\b/gi, 'the attitude'],
  [/\bthe (?:Four|4) Cs\b/gi, 'this approach'],
  [/\bthe Five Ps\b/gi, 'these points'],
  [/\bQuota of One\b/gi, 'the one-yes idea'],
  [/\bLike-for-Like Fallacy\b/gi, 'that trap'],
]
export function stripFrameworkNames(text) {
  if (typeof text !== 'string' || !text) return text
  let out = text
  let count = 0
  for (const [re, repl] of FRAMEWORK_SUBS) {
    const before = out
    out = out.replace(re, repl)
    if (out !== before) count++
  }
  if (count > 0) {
    console.warn(`[stripFrameworkNames] neutralized ${count} framework name${count === 1 ? '' : 's'} from LLM output`)
  }
  return out
}
// voice-allow-end

// --- tidyOutput ------------------------------------------------------------
// Final pass over coach output only. Repairs the small artifacts the rewrite
// rules leave: doubled spaces, a stray space before punctuation, a doubled
// period from a dropped clause, and a lowercase letter that now starts a
// sentence (e.g. the "not because X, but because Y" rewrite leaving "this.
// because"). Runs last so it cleans up after every other stripper.
function tidyOutput(text) {
  if (typeof text !== 'string' || !text) return text
  let out = text
  out = out.replace(/[^\S\n]{2,}/g, ' ')                 // collapse runs of spaces/tabs (not newlines)
  out = out.replace(/[^\S\n]+([.,;:!?])/g, '$1')         // drop space before punctuation
  out = out.replace(/(?<!\.)\.\.(?!\.)/g, '.')           // collapse a doubled period (keep ellipsis)
  out = out.replace(/([.!?]\s+|\n{2,})([a-z])/g, (_m, b, c) => b + c.toUpperCase()) // recapitalize sentence starts
  out = out.replace(/^\s+/, '')                          // trim leading whitespace from a removed opening sentence
  return out
}

// --- stripFabricatedMarketData ---------------------------------------------
// Narrow deterministic backstop for the no-invented-market-data rule. The prompt
// instruction is primary and the model refused in every salary/hiring bait prompt
// across both battery runs; this catches the obvious fabrication SHAPES if the
// model ever states them: a salary figure asserted as fact, a hiring-odds
// percentage, or "N companies are hiring." Scoped tightly to avoid touching the
// user's own profile numbers ("$4.2M cost reduction", "22% to 9%").
//
// voice-allow
const MARKET_SUBS = [
  // "the average/median/typical/going/market salary is/ranges ... $X ..."
  /(^|[.!?]\s+|\n+)[^.!?\n]*?\b(?:average|median|typical|going|market|expected)\s+(?:salary|salaries|compensation|comp|pay|rate)\b[^.!?\n]*?\$\s?\d[\d,]*[^.!?\n]*?[.!?]/gi,
  // "salary/salaries is/are/ranges/runs/averages ... $X ..."
  /(^|[.!?]\s+|\n+)[^.!?\n]*?\b(?:salary|salaries|compensation)\b[^.!?\n]*?\b(?:is|are|ranges?|runs?|sits?|averages?|typically|around|roughly|between)\b[^.!?\n]*?\$\s?\d[\d,]*[^.!?\n]*?[.!?]/gi,
  // "you can expect (to make/earn) $X ..."
  /(^|[.!?]\s+|\n+)[^.!?\n]*?\byou\s+(?:can|could|should|would|might)\s+expect\b[^.!?\n]*?\$\s?\d[\d,]*[^.!?\n]*?[.!?]/gi,
  // hiring-odds percentage: "a 70% chance/odds/probability of landing ..."
  /(^|[.!?]\s+|\n+)[^.!?\n]*?\b\d{1,3}\s?%\s*(?:chance|odds|probability|likelihood)\b[^.!?\n]*?[.!?]/gi,
  // "N companies are hiring ..."
  /(^|[.!?]\s+|\n+)[^.!?\n]*?\b\d+\s+companies\s+(?:are\s+)?(?:hiring|are\s+looking)\b[^.!?\n]*?[.!?]/gi,
]
export function stripFabricatedMarketData(text) {
  if (typeof text !== 'string' || !text) return text
  let out = text
  let count = 0
  for (const re of MARKET_SUBS) {
    out = out.replace(re, (_m, lead) => { count++; return lead })
  }
  if (count > 0) {
    console.warn(`[stripFabricatedMarketData] removed ${count} fabricated market-data claim${count === 1 ? '' : 's'} from LLM output`)
  }
  return out
}
// voice-allow-end

// --- ensureDistressSupport -------------------------------------------------
// Deterministic floor for the distress boundary. Instruction alone regressed:
// on "some days I don't see the point anymore" the coach stayed warm but did not
// point the person to a human. This guarantees the pointer. It needs the USER's
// message (the triggers live in the input), so it runs in api/coach.js after the
// output strippers, NOT inside applyOutputStrippers.
//
// If the user's message matches a genuine-distress trigger AND the reply does not
// already name a human to reach out to, append one warm sentence (not a bolted-on
// disclaimer). The wording is permission-giving and matches the coach's register.
//
// voice-allow
const DISTRESS_TRIGGER_RE = /\b(?:don['’]?t|do not|can['’]?t)\s+(?:really\s+|even\s+|quite\s+|always\s+|honestly\s+)?see\s+(?:the|any|a|much)\s+point\b|\bwhat['’]?s\s+the\s+point\b|\bno\s+point\s+(?:in|to|anymore|any\s?more|doing)\b|\bcan['’]?t\s+(?:go on|keep going|keep doing this|do this anymore|take (?:it|this) anymore|keep going on|keep doing this)\b|\bgiving up\b|\bwant to give up\b|\bhopeless\b|\bwhat['’]?s the use\b|\bdon['’]?t want to (?:go on|be here|do this anymore|keep going)\b|\bnothing matters\b|\blosing the will\b|\bfalling apart\b|\bbreaking down\b|\bat the end of my rope\b|\bcan['’]?t keep doing this\b|\bcan['’]?t keep going\b/i
const HUMAN_POINTER_RE = /\b(?:counselor|therapist|therapy|a friend|your friend|a partner|your partner|loved one|someone you trust|a real human|talk to someone|reach out to someone|professional(?: help| support)|bob@career\.club|lean on someone|a human in your corner|a trusted)\b/i
const DISTRESS_POINTER = " And one more thing, because it matters more than any of the tactics: if this is heavier than ordinary job-search frustration, please reach out to someone you trust today — a friend, a partner, or a counselor. You can also reach Bob directly at bob@career.club. You don't have to carry this alone."
export function ensureDistressSupport(userMessage, output) {
  if (typeof output !== 'string') return output
  if (typeof userMessage !== 'string' || !DISTRESS_TRIGGER_RE.test(userMessage)) return output
  if (HUMAN_POINTER_RE.test(output)) return output
  console.warn('[ensureDistressSupport] distress trigger matched and reply lacked a human-pointer; appended one')
  return output.replace(/\s*$/, '') + '\n\n' + DISTRESS_POINTER.trim()
}
// voice-allow-end

// --- applyOutputStrippers --------------------------------------------------
// The canonical cleanup chain. src/App.jsx callClaude applies the original
// subset (rooms, meta, coach-speak, logic-flip, sincerity); api/coach.js applies
// this full chain, which adds the voice-gate-fix strippers (comparative-standing,
// hire-ability verdict, framework names, market data, intensifiers) and a final
// tidy pass. The distress safety-net (ensureDistressSupport) runs separately in
// api/coach.js because it needs the user's message.
export function applyOutputStrippers(text) {
  let out = stripRoomsPlaceholder(text)
  out = stripMetaNarration(out)
  out = stripCoachSpeak(out)
  out = stripComparativeStanding(out)
  out = stripHireabilityVerdict(out)
  out = stripFabricatedMarketData(out)
  out = stripFrameworkNames(out)
  out = stripLogicFlipCadence(out)
  out = stripSincerityQualifiers(out)
  out = stripIntensifiers(out)
  out = tidyOutput(out)
  return out
}
