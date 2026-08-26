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

const clean = t => String(t == null ? '' : t)
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
const tokens = s => key(s).split(' ').filter(Boolean).map(stem)
const HAS_FIGURE = /[0-9%$]/

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for',
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
