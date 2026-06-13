// Pure helpers for the corrections staleness indicator (Track 4, Levels 2/3).
//
// extractCorrectionTerms pulls the concrete words/phrases a correction asks us
// to stop using — hard negation ("not X", "never X", "stop using X"),
// substitution ("X instead of Y", "replace X with Y"), and explicit quoted
// forbidden phrases — so the stale-section indicator can quote them back and
// count how many still linger in a section written before the correction.
//
// Deliberately conservative and heuristic: a missed term simply falls the
// indicator back to its Level 2 (name-the-source) copy, which is harmless. No
// model call; runs entirely client-side. Plain `.js` so it is safe to import
// from anywhere (including future api/* use) without the .mjs cross-boundary risk.

// Words that are never useful as a "forbidden term" on their own.
const STOP = new Set(['the', 'a', 'an', 'my', 'me', 'i', 'you', 'your', 'it', 'is', 'was', 'that', 'this', 'to', 'of', 'in', 'on', 'and', 'or', 'word', 'phrase', 'term', 'please', 'instead', 'about', 'here', 'any', 'all', 'as', 'for', 'with', 'they', 'them', 'he', 'she', 'him', 'her', 'we', 'us', 'language', 'words'])

// Filler words trimmed from the edges of a captured phrase ("not say rigorous
// in any output" -> "rigorous"). Leading verbs/articles and trailing
// prepositions/adverbs are noise; the salient term sits in the middle.
const FILLER = new Set(['the', 'a', 'an', 'say', 'saying', 'says', 'use', 'using', 'used', 'write', 'writing', 'written', 'word', 'phrase', 'term', 'call', 'calling', 'called', 'me', 'as', 'that', 'it', 'in', 'on', 'at', 'any', 'anymore', 'output', 'outputs', 'again', 'here', 'this', 'my', 'your', 'please', 'describe', 'describing', 'to', 'of', 'when', 'ever', 'longer'])

function clean(s) {
  return (s || '').trim().replace(/^["'“”‘’]+|["'“”‘’.!,;:]+$/g, '').trim()
}

// Drop leading and trailing FILLER words, keeping the salient core phrase.
function trimPhrase(s) {
  let w = clean(s).split(/\s+/).filter(Boolean)
  while (w.length && FILLER.has(w[0].toLowerCase())) w = w.slice(1)
  while (w.length && FILLER.has(w[w.length - 1].toLowerCase())) w = w.slice(0, -1)
  return w.join(' ')
}

export function extractCorrectionTerms(text) {
  if (!text || typeof text !== 'string') return []
  const out = []
  const push = (p) => {
    const c = trimPhrase(p)
    if (c && c.length >= 3 && !STOP.has(c.toLowerCase())) out.push(c)
  }
  // Hard negation + substitution-by-precedence ("instead of X", "rather than X").
  const neg = /\b(?:not|never|no longer|stop using|stop saying|don'?t (?:use|say|write)|do not (?:use|say|write)|avoid|no more|quit using|instead of|rather than)\s+(?:the\s+(?:word|phrase|term)\s+)?["'“‘]?([a-zA-Z][\w'-]*(?:\s+[\w'-]+){0,3})["'”’]?/gi
  // "replace X with Y" -> forbid X.
  const sub = /\breplace\s+["'“‘]?([a-zA-Z][\w'-]*(?:\s+[\w'-]+){0,2})["'”’]?\s+with\b/gi
  // Explicit quoted phrase, only honored when the correction reads as forbidding.
  const quoted = /["'“‘]([^"'”’]{3,40})["'”’]/g
  let m
  while ((m = neg.exec(text))) push(m[1])
  while ((m = sub.exec(text))) push(m[1])
  const forbidding = /\b(not|never|stop|don'?t|do not|avoid|no more|instead|replace|wrong|isn'?t|aren'?t)\b/i.test(text)
  if (forbidding) { while ((m = quoted.exec(text))) push(m[1]) }
  // Dedupe case-insensitively, keep first casing.
  const seen = new Set(), res = []
  for (const t of out) { const k = t.toLowerCase(); if (!seen.has(k)) { seen.add(k); res.push(t) } }
  return res
}

// Count whole-word (boundary-aware, case-insensitive) occurrences of `term` in
// `text`. Multiword terms allow flexible whitespace. Avoids lookbehind so the
// regex stays valid on older Safari. "architect" matches "architect's" but not
// "architectural".
export function countTermInText(text, term) {
  if (!text || !term) return 0
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  const re = new RegExp(`(?:^|[^\\w-])(${esc})(?![\\w-])`, 'gi')
  let c = 0
  while (re.exec(text) !== null) c++
  return c
}

// ---- Pre-submit conflict detection (Track 6 / Track 7) ----
//
// A "conflict" is when a correction asks us to USE a phrase that Reimagine
// writes around (typology labels, AI-speak/resume cliches, passion-stack,
// comparative-standing). It is NOT a conflict when the correction asks us to
// AVOID such a phrase (e.g. "stop using architect") — that is the user helping.
//
// CURATED set on purpose. We deliberately do NOT check sincerity qualifiers,
// intensifiers, em-dashes, meta-narration, or the formula-* family: they
// over-fire on ordinary correction phrasing or describe output shape the user
// would never type. Each entry carries the plain-English reason and an example
// rephrase the modal offers. Keep reasons/rephrases in the "way Reimagine
// writes" register — no rule/jargon framing in user-facing strings.
const CONFLICT_PATTERNS = [
  {
    key: 'typology',
    terms: ['architect', 'operator', 'builder', 'integrator', 'strategist', 'connector', 'hunter', 'farmer', 'fixer', 'closer', 'maven', 'guru', 'rockstar', 'ninja', 'wizard', 'unicorn'],
    reason: 'a one-word type label reads as filler to hiring readers — they want the move you actually made, not a category',
    rephrase: 'Name the move you made, not a one-word type — e.g. "I rebuilt the planning system."',
  },
  {
    key: 'ai-speak',
    terms: ['leverage', 'leveraged', 'utilize', 'utilized', 'synergy', 'synergies', 'robust', 'seamless', 'world-class', 'best-in-class', 'results-driven', 'results-oriented', 'proven track record', 'move the needle', 'game-changer', 'game changer', 'thought leader', 'go-getter', 'detail-oriented', 'team player', 'self-starter'],
    reason: 'this is the kind of phrase hiring readers flag as AI-written or resume-cliche',
    rephrase: 'Say what you actually did in plain words instead of the buzzword — e.g. "used" rather than "leveraged".',
  },
  {
    key: 'passion',
    terms: ['passionate', 'passionate about', 'passion for', 'deeply passionate'],
    reason: 'naming the feeling states it without showing it; readers discount "passionate" as a tell',
    rephrase: 'Show what you care about through what you have built, not the word "passionate."',
  },
  {
    key: 'comparative',
    terms: ['most people', 'unlike most', 'better than most', 'more than most', 'unlike others', 'stand out from the crowd', 'ahead of the pack'],
    reason: 'comparing you to an unnamed crowd reads as a flattery move rather than evidence',
    rephrase: 'Point to your specific result instead of comparing yourself to others.',
  },
]

const FORBIDDING_BEFORE = /\b(not|never|no|stop|don'?t|do not|avoid|without|drop|remove|less|instead of|rather than|replace|cut)\b/

// Returns { phrase, reason, rephrase } for the first conflicting phrase the
// correction asks us to USE, or null. Skips phrases in a forbidding context.
export function detectCorrectionConflict(text) {
  if (!text || typeof text !== 'string') return null
  const lower = text.toLowerCase()
  for (const pat of CONFLICT_PATTERNS) {
    for (const term of pat.terms) {
      const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
      const re = new RegExp(`(?:^|[^\\w-])(${esc})(?![\\w-])`, 'i')
      const m = re.exec(lower)
      if (!m) continue
      const idx = m.index + m[0].toLowerCase().indexOf(term.toLowerCase().split(/\s+/)[0])
      const before = lower.slice(Math.max(0, idx - 24), idx)
      if (FORBIDDING_BEFORE.test(before)) continue
      return { phrase: term, reason: pat.reason, rephrase: pat.rephrase }
    }
  }
  return null
}
