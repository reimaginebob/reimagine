// src/text-strippers.mjs
// Foundation B.1 (2026-05-27, PR #85).
//
// Deterministic post-processors for LLM output. Extracted into their own
// ESM module so scripts/test-text-strippers.mjs can import them without
// pulling in the whole React app (App.jsx contains JSX and is not directly
// loadable from a Node test runner). App.jsx imports both helpers and
// chains them into the callClaude return path (stripCoachSpeak) and into
// the voice gate recovery branch (applyContaminationPlaceholders).
//
// Sibling helpers stripRoomsPlaceholder and stripMetaNarration remain
// inline in App.jsx for now; if a future PR adds tests for those, they
// can move here too. Keeping the new strippers in a separate file matches
// the existing convention for voice-patterns.mjs and personal-brand-tail.mjs:
// production logic in a small testable module, App.jsx imports it.

// stripCoachSpeak. Vocabulary substitutions that rewrite coach-speak surface
// phrases the longform-feature SYS block targets but the model still emits
// under output-budget pressure. Idempotent: running twice on the same input
// produces the same output. Telemetry via console.warn fires when at least
// one substitution lands, mirroring stripRoomsPlaceholder / stripMetaNarration.
//
// Substitution choices verified safe at the 2026-05-27 consult. Dropped
// substitutions ("at the intersection of" → "where" was grammar-breaking;
// "lives at the intersection" → "sits at the meeting point" was metaphor-
// for-metaphor and did no work) are NOT in the list. The SYS instruction
// bans those phrases and the model respects bans when stated directly.
// Inflection-preserving replacer factory. \bword\b in JavaScript regex only
// matches the bare root because the trailing s/d/ing keeps the word boundary
// inside the word. To catch "leverages" / "facilitating" / "utilized" while
// preserving subject-verb agreement on the replacement, we match the verb
// stem (silent-e dropped: "utiliz" not "utilize") plus the conjugation
// suffix, and pick the matching form of the replacement verb.
//
// English -e verbs drop the silent e before -ed and -ing ("utilize" →
// "utilizing", "leverage" → "leveraging"). So the stem is "leverag",
// "utiliz", "facilitat"; the form table maps e / es / ed / ing to the
// substitute verb's matching inflection.
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

// applyContaminationPlaceholders. Final-defense enforcement for SYS-exemplar
// substance contamination. Runs ONLY when the voice gate retry budget is
// exhausted AND the unrecovered violations include contamination-* hits.
// Substitutes bracketed placeholders for the offending exemplar phrases so
// the user sees an obvious visible glitch (cue to regenerate) instead of a
// foreign name leaking into prose. The retry on regenerate almost always
// succeeds because the previous output's contamination is no longer in
// conversation context.
//
// Placeholder text is deliberately bracketed so a "[the user]" string is
// unmistakable. This is the better failure mode than a real-feeling foreign
// name leaking unnoticed.
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

// stripLogicFlipCadence. Deterministic rewrite for the "X is not Y. It is Z."
// logic-flip cadence (2026-06-01, PR after #133). This pattern is model-robust:
// the runtime voice gate detects it (logic-flip-is-not in voice-patterns.mjs),
// retries, the model regenerates the same construction, and the gate falls
// open — the violation ships. PR 133's production smoke confirmed it live
// ("The answer to that question is not a feeling. It is architecture."), so
// the standing voice-rule memory's "logic-flips are model-robust and must be
// strip, not retry" applies. Same enforcement shape as stripMetaNarration /
// stripRoomsPlaceholder.
//
// Two logic-flip shapes, both handled here so the existing callClaude chain
// (which already calls stripLogicFlipCadence) picks them up without an App.jsx
// change:
//
// (A) Two-sentence pivot: "[Subject1] is/are/was/were not [phrase1].
//     [Subject2] is/are/was/were [phrase2]." Subject1 is a sentence-initial
//     (capitalized) noun phrase; the auxiliary matches between the two
//     sentences (\3 backref) so present and past tense both work; Subject2 is
//     either a pointer pronoun (It/They/These/Those/This/That) or a verbatim
//     repeat of Subject1 (\2 backref). Rewrite: "[Subject1] aux [phrase2]." —
//     drop the negation sentence, keep the positive claim with the original
//     subject. Anchored to a sentence boundary so embedded mid-sentence
//     "is/was not" (no pivot pair) and pivots into a different subject or a
//     non-assertion second clause are left untouched. (was/were added
//     2026-06-01: the past-tense form leaked in shipped Bridge Story output,
//     "What stayed with me was not just the layoff. It was how badly...".)
//
// (B) Single-sentence comparison: "[aux] less about [X] (and|,) more about
//     [Y]" -> "[aux] about [Y]". Drops the "less about X and more" segment,
//     keeps the positive assertion about Y. Requires BOTH halves to use
//     "about" (so "less about X ... more toward Y" does not fire) and an
//     auxiliary (is/are/was/were) immediately before "less about" (so
//     "knows less about", "care less about X than Y" do not fire). Added
//     2026-06-01: this family ("less about X and more about Y") is the same
//     banned logic-flip cadence per operating_context.md; it was detected by
//     the runtime gate (logic-flip-less-about-more-about) but not stripped,
//     and leaked in shipped musician-ops Bridge Story output.
//
// Both rewrites are idempotent: the output no longer contains "not" between
// the auxiliary pair, nor "less about ... more about", so a second pass is a
// no-op.
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

// stripSincerityQualifiers. Deterministic strip for the noun-phrase and
// adverbial sincerity-qualifier prefixes (2026-06-01, PR after #133). Same
// model-robust failure mode as the logic-flip cadence: PR 133 added the
// detection patterns (truth-the-honest-noun, truth-honestly-frankly-candidly)
// and its production smoke confirmed the construction still ships after the
// gate falls open ("The honest read: the conviction is general."). Strip, do
// not retry.
//
// Six variants, each anchored to a sentence boundary so mid-sentence
// descriptive uses of "honest" ("an honest review," "honest dialogue,"
// predicate "was honest") and "Honesty" as a noun are never touched:
//   "The honest [noun]: [claim]"        -> "[Claim]"
//   "The honest [noun] is that [claim]"  -> "[Claim]"
//   "To be honest, [claim]"              -> "[Claim]"
//   "Honestly, [claim]" / "Frankly," / "Candidly," -> "[Claim]"
// [noun] is the same whitelist as truth-the-honest-noun: read, reading,
// answer, truth, take, view, assessment, appraisal. The surviving claim's
// first letter is re-capitalized (the prefix removal leaves it lowercase).
// Idempotent: the rewritten claim no longer carries the qualifier prefix.
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
