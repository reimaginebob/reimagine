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
const LOGIC_FLIP_CADENCE_RE = /(^|[.!?]\s+|\n+)([A-Z][^.!?\n]*?)\s+(is|are|was|were)\s+not\s+[^.!?\n]+?[.!?]\s+(?:It|They|These|Those|This|That|\2)\s+\3\s+([^.!?\n]+?[.!?])/g
const LOGIC_FLIP_LESS_MORE_RE = /\b(is|are|was|were)\s+less\s+about\s+[^.,;!?\n]+?(?:,\s*|\s+and\s+)more\s+about\s+/gi
export function stripLogicFlipCadence(text) {
  if (typeof text !== 'string' || !text) return text
  let count = 0
  let out = text.replace(LOGIC_FLIP_CADENCE_RE, (_match, lead, subject1, aux, phrase2) => {
    count++
    return `${lead}${subject1} ${aux} ${phrase2}`
  })
  out = out.replace(LOGIC_FLIP_LESS_MORE_RE, (_match, aux) => {
    count++
    return `${aux} about `
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
export function stripSincerityQualifiers(text) {
  if (typeof text !== 'string' || !text) return text
  let count = 0
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1)
  let out = text
  out = out.replace(HONEST_NOUN_RE, (_match, lead, claim) => { count++; return `${lead}${cap(claim)}` })
  out = out.replace(SINCERITY_ADVERB_RE, (_match, lead, claim) => { count++; return `${lead}${cap(claim)}` })
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

// --- applyOutputStrippers --------------------------------------------------
// The canonical cleanup chain, in the same order src/App.jsx callClaude
// applies it. Shared so api/coach.js runs identical cleanup on its output.
export function applyOutputStrippers(text) {
  return stripSincerityQualifiers(
    stripLogicFlipCadence(
      stripCoachSpeak(
        stripMetaNarration(
          stripRoomsPlaceholder(text)
        )
      )
    )
  )
}
