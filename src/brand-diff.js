// What changed between two versions of a Personal Brand.
//
// Why this exists: rebuilds now amend rather than rewrite (#515-#523), but
// amending still loses the occasional phrase, and because every rebuild anchors
// on the version before it, the anchor protects an absence as faithfully as it
// protects the text. Measured on 2026-08-26: "trusted advisor" dropped out of
// one sentence and never came back across three further builds. Nobody can
// hold two versions of a five-page document in their head, so the app has to
// say what moved.
//
// Prose only, deliberately. Section labels and the results strip are decided by
// the layout pass, and before #523 they churned on every single run. Comparing
// them would bury one real removal under a dozen cosmetic ones, and a panel
// that cries wolf is worse than no panel.
//
// Pure and dependency-free so the build gate can exercise it directly.

const SENTENCE_MIN = 20

export const clean = t => String(t == null ? '' : t)
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/—/g, ' - ')
  .replace(/\s+/g, ' ')
  .trim()

// The section bodies together ARE the brand (see the layout pass contract).
// Falls back to raw text for brands written before the structured format.
export function brandProse(presentation, rawText) {
  if (presentation && Array.isArray(presentation.sections)) {
    const bodies = presentation.sections.map(s => s && s.body).filter(Boolean)
    if (bodies.length) return bodies.join('\n\n')
  }
  return clean(rawText)
}

export function splitSentences(text) {
  return clean(text)
    .split(/(?<=[.!?])\s+(?=[A-Z"'(])/)
    .map(s => s.trim())
    .filter(s => s.length >= SENTENCE_MIN)
}

// Punctuation is dropped entirely: a sentence-final "desk." must match the
// same word mid-sentence, or every last word of every sentence reads as lost.
// Digits, % and $ survive because a vanished number is exactly the kind of
// change worth telling someone about.
const key = s => clean(s).toLowerCase().replace(/[^a-z0-9 %$]/g, '').trim()
// Light stem so "signal" and "signals" are the same word. Without it, a
// sentence that had to adapt reads as a wholly new one.
const stem = w => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
export const tokens = s => key(s).split(' ').filter(Boolean).map(stem)
const HAS_FIGURE = /[0-9%$]/

export const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for',
  'is', 'was', 'are', 'were', 'be', 'been', 'it', 'its', 'that', 'this', 'you', 'your', 'with',
  'as', 'by', 'from', 'not', 'so', 'if', 'then', 'than', 'when', 'what', 'which', 'who'])

// Overlap against the LONGER sentence, so appending a clause to an existing
// sentence still reads as a rewrite of it rather than as one removal plus one
// unrelated addition.
function similarity(a, b) {
  // Content words only. Two sentences making the same point through different
  // grammar share few function words and would otherwise score as unrelated.
  const A = new Set(tokens(a).filter(w => !STOP.has(w)))
  const B = new Set(tokens(b).filter(w => !STOP.has(w)))
  if (!A.size || !B.size) return 0
  let shared = 0
  for (const t of A) if (B.has(t)) shared++
  return shared / Math.max(A.size, B.size)
}


// Contiguous runs of words present in `before` and absent from `after`. This is
// what turns "the sentence was reworded" into "you lost 'trusted advisor'".
export function wordsDropped(before, after) {
  const A = new Set(tokens(after))
  const runs = []
  let run = []
  for (const t of tokens(before)) {
    if (A.has(t)) { if (run.length) { runs.push(run); run = [] } }
    else run.push(t)
  }
  if (run.length) runs.push(run)
  return runs
    .filter(r => r.some(w => !STOP.has(w)))
    // One short ordinary word going missing is not news. A figure always is.
    .filter(r => r.length > 1 || r[0].length >= 5 || HAS_FIGURE.test(r[0]))
    .map(r => r.join(' '))
}

/**
 * @returns {{added:string[], removed:string[], reworded:{before:string,after:string,dropped:string[]}[], unchanged:number}}
 */
export function diffBrandProse(prevText, nextText, opts = {}) {
  const threshold = typeof opts.threshold === 'number' ? opts.threshold : 0.5
  const prev = splitSentences(prevText)
  const next = splitSentences(nextText)
  const nextKeys = new Set(next.map(key))
  const prevKeys = new Set(prev.map(key))

  const gone = prev.filter(s => !nextKeys.has(key(s)))
  const fresh = next.filter(s => !prevKeys.has(key(s)))
  const unchanged = prev.length - gone.length

  // Greedy best-first pairing: a removed sentence and an added sentence that
  // are mostly the same sentence are one rewrite, not two events.
  const pairs = []
  const usedNext = new Set()
  const scored = []
  gone.forEach((g, gi) => fresh.forEach((f, fi) => {
    const score = similarity(g, f)
    if (score >= threshold) scored.push({ score, gi, fi })
  }))
  scored.sort((x, y) => y.score - x.score)
  const usedPrev = new Set()
  for (const { gi, fi } of scored) {
    if (usedPrev.has(gi) || usedNext.has(fi)) continue
    usedPrev.add(gi); usedNext.add(fi)
    pairs.push({ before: gone[gi], after: fresh[fi], dropped: wordsDropped(gone[gi], fresh[fi]) })
  }

  return {
    added: fresh.filter((_, i) => !usedNext.has(i)),
    removed: gone.filter((_, i) => !usedPrev.has(i)),
    // A rewrite that dropped nothing is a rephrasing with nothing at stake;
    // showing it would be the noise this module exists to avoid.
    reworded: pairs.filter(p => p.dropped.length > 0),
    unchanged,
  }
}

export function diffIsEmpty(d) {
  return !d || (!d.added.length && !d.removed.length && !d.reworded.length)
}

// --- Rework guard (2026-09-10) -------------------------------------------
//
// A correction ("Does this feel right?") is supposed to amend the brand, not
// regenerate it -- runP3TwoStage's prompt already carries a strong in-prompt
// instruction to that effect (App.jsx, P.p3analysis's previousBrand branch).
// That instruction is necessary but not sufficient: the model is
// probabilistic, and a 2026-09-10 production incident (one sentence about
// organizational scale came back with 21 new lines, 27 lines silently gone,
// and three stat tiles empty) proved a prompt instruction alone is not a
// guarantee. This is the deterministic, code-level backstop: every numeric
// token and every capitalized proper-noun-shaped token (a program, a company,
// an acronym) that appeared in the previous brand must still appear in the
// new one, verbatim, and the sentence-level diff above must not touch more
// than a handful of lines.
//
// Numbers only in digit form ($4.8M, 76%, 1,400) are checked -- a spelled-out
// number ("six-point drop") is real prose a rewrite could legitimately
// rephrase as "6 points" without losing anything, and reliably telling that
// apart from an ordinary word ("won", "to") that happens to spell a number is
// not worth the false-positive rate it would cost. Every real incident seen
// so far (this one included) carried its numbers in digit form.
// Comma-grouped alternative listed before the bare digit-run one: JS
// alternation tries left-to-right at a given start position, and without
// this order "1,400" matches as bare "400" (the leading "1" is only one
// digit, so \d{2,} skips it and starts fresh after the comma).
const NUMERIC_TOKEN_RE = /\$\d[\d,.]*\s?[MBKmbk]?\b|\d[\d,.]*\s?%|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d{2,}(?:\.\d+)?\b/g

export function extractNumericTokens(text) {
  const t = clean(text)
  const seen = new Set()
  const out = []
  for (const m of t.matchAll(NUMERIC_TOKEN_RE)) {
    const v = m[0].trim()
    if (v && !seen.has(v)) { seen.add(v); out.push(v) }
  }
  return out
}

// A deliberately narrow heuristic, not a named-entity model: acronyms (2-6
// capital letters, optionally with an internal "&" -- "DEI", "M&A") anywhere,
// plus runs of two or more consecutive Titlecase words that do NOT start a
// sentence (so an ordinary capitalized sentence opener is never mistaken for
// a name). This catches "Continental Casualty Partners" and "DEI" without
// tripping on every sentence's first word. It will miss a genuine one-word
// proper noun ("Continental" alone, mid-sentence) -- a real gap, but a
// two-word-or-acronym floor keeps false positives low enough that the check
// is usable rather than perpetually retrying on ordinary capitalized prose.
const ACRONYM_RE = /^([A-Z]{2,6}|[A-Z]{1,6}&[A-Z]{1,6})$/
const TITLECASE_RE = /^[A-Z][a-zA-Z'.-]*$/

export function extractEntityTokens(text) {
  const seen = new Set()
  const out = []
  const add = (v) => { if (v && !seen.has(v)) { seen.add(v); out.push(v) } }
  for (const sentence of splitSentences(text)) {
    const words = clean(sentence).split(' ').filter(Boolean)
    let run = []
    words.forEach((w, i) => {
      // A trailing period is sentence punctuation, not part of the name --
      // splitSentences leaves it attached to the sentence's last word.
      const bare = w.replace(/^[^A-Za-z]+|[^A-Za-z0-9&]+$/g, '')
      const isAcronym = ACRONYM_RE.test(bare)
      // Position 0 of the sentence is always capitalized by grammar, not by
      // being a name -- never treated as evidence on its own.
      const isTitlecase = i > 0 && TITLECASE_RE.test(bare) && bare.length > 1
      if (isAcronym) { if (run.length > 1) add(run.join(' ')); run = []; add(bare) }
      else if (isTitlecase) { run.push(bare) }
      else { if (run.length > 1) add(run.join(' ')); run = [] }
    })
    if (run.length > 1) add(run.join(' '))
  }
  return out
}

export const MAX_CHANGED_LINES = 6

/**
 * @returns {{ok:boolean, missingNumbers:string[], missingEntities:string[], changedLines:number, maxChangedLines:number, diff:object}}
 */
export function checkBrandPreservation(prevText, nextText, opts = {}) {
  const maxChangedLines = typeof opts.maxChangedLines === 'number' ? opts.maxChangedLines : MAX_CHANGED_LINES
  const next = clean(nextText)
  const missingNumbers = extractNumericTokens(prevText).filter(n => !next.includes(n))
  const missingEntities = extractEntityTokens(prevText).filter(e => !next.includes(e))
  const diff = diffBrandProse(prevText, nextText)
  const changedLines = diff.added.length + diff.removed.length + diff.reworded.length
  const ok = missingNumbers.length === 0 && missingEntities.length === 0 && changedLines <= maxChangedLines
  return { ok, missingNumbers, missingEntities, changedLines, maxChangedLines, diff }
}

// Fed back into a retry as an addendum ahead of the correction itself (never
// attributed to the person -- they never said this) so the model is told
// exactly what it must restore rather than being asked to guess harder at the
// same instruction that already failed once.
export function describeBrandPreservationGap(check) {
  const parts = []
  if (check.missingNumbers.length) parts.push(`These exact figures from the version they already have went missing from your last draft and must be restored, verbatim, in whatever passage they belong to: ${check.missingNumbers.map(n => `"${n}"`).join(', ')}.`)
  if (check.missingEntities.length) parts.push(`These exact names/terms from the version they already have went missing and must be restored: ${check.missingEntities.map(n => `"${n}"`).join(', ')}.`)
  if (check.changedLines > check.maxChangedLines) parts.push(`Your last draft changed ${check.changedLines} lines from the version they already had; only the passage this correction actually touches may change. Copy every other sentence forward exactly as it already reads, word for word.`)
  return `IMPORTANT -- your previous attempt at this amendment lost ground that must not be lost. ${parts.join(' ')} Try again: touch only what the correction below actually asks for, and copy everything else forward unchanged.`
}

// Never invent a stat tile, and never blank one that used to have a real
// number behind it. `nextPoints` wins whenever it still names a value; a
// previous point is carried forward only when its value is still verbatim in
// the final brand text -- if the number itself is genuinely gone (which
// checkBrandPreservation's retry/reconcile path above should already have
// prevented), inventing a tile for it would be worse than showing none.
export function mergeProofPoints(prevPoints, nextPoints, finalText) {
  const prev = Array.isArray(prevPoints) ? prevPoints : []
  const next = Array.isArray(nextPoints) ? nextPoints : []
  const nextValues = new Set(next.map(p => p && String(p.value || '').trim()).filter(Boolean))
  const text = clean(finalText)
  const carried = prev.filter(p => {
    const v = p && String(p.value || '').trim()
    if (!v || nextValues.has(v)) return false
    return text.includes(clean(v))
  })
  return [...next, ...carried]
}

// Second-failure fallback: keep each part of the previous version verbatim
// unless its replacement's changed words actually overlap the correction's
// own words -- the closest deterministic proxy available for "the passage
// the correction names" without spending a third model call on it. Covers
// every free-text part of the presentation, not just sections -- the incident
// this guards against actually lost its content from `edges` ("Worth naming,
// and how to use it"), which a sections-only patch would have missed
// entirely. `origin` and `edges` entries have no kicker to match on, so they
// pair positionally (both arrays are short and stage two is told to preserve
// order); a hero or forwardClose that changed with no overlap at all is
// unusual enough to be worth reverting the same way rather than special-cased
// as untouchable.
function overlapsCorrection(text, correctionWords) {
  const words = new Set(tokens(text).filter(w => !STOP.has(w)))
  for (const w of correctionWords) if (words.has(w)) return true
  return false
}

function revertUnlessTouched(prevText, nextText, correctionWords) {
  if (clean(prevText) === clean(nextText)) return nextText
  return overlapsCorrection(nextText, correctionWords) ? nextText : prevText
}

export function patchUnrelatedRegressions(prevPresentation, nextPresentation, correctionNote) {
  const prev = prevPresentation || {}
  const next = nextPresentation || {}
  const correctionWords = new Set(tokens(correctionNote).filter(w => !STOP.has(w)))
  const revert = (a, b) => revertUnlessTouched(a, b, correctionWords)

  const prevSections = Array.isArray(prev.sections) ? prev.sections : []
  const nextSections = Array.isArray(next.sections) ? next.sections : []
  const sections = nextSections.map((nextSec, i) => {
    if (!nextSec) return nextSec
    const prevSec = prevSections.find(p => p && clean(p.kicker) === clean(nextSec.kicker)) || prevSections[i]
    if (!prevSec) return nextSec
    return { ...nextSec, body: revert(prevSec.body, nextSec.body) }
  })

  const prevEdges = Array.isArray(prev.edges) ? prev.edges : []
  const nextEdges = Array.isArray(next.edges) ? next.edges : []
  const edges = nextEdges.map((nextEdge, i) => {
    const prevEdge = prevEdges[i]
    if (!nextEdge || !prevEdge) return nextEdge
    return {
      ...nextEdge,
      claim: revert(prevEdge.claim, nextEdge.claim),
      detail: revert(prevEdge.detail, nextEdge.detail),
    }
  })

  const origin = (next.origin && prev.origin)
    ? { ...next.origin, body: revert(prev.origin.body, next.origin.body) }
    : next.origin

  const forwardClose = (typeof next.forwardClose === 'string' && typeof prev.forwardClose === 'string')
    ? revert(prev.forwardClose, next.forwardClose)
    : next.forwardClose

  const hero = (typeof prev.hero === 'string') ? revert(prev.hero, next.hero) : next.hero

  return { ...next, hero, sections, origin, edges, forwardClose }
}
