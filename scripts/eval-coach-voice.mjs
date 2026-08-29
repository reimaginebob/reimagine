#!/usr/bin/env node
// Scores My Coach replies for the structural tics that make prose read as
// machine-written. Offline tool, NOT a prebuild gate: it scores model OUTPUT,
// which the build cannot see.
//
//   node scripts/eval-coach-voice.mjs <transcript-file> [--baseline <file>]
//
// Transcript format: replies separated by a line starting with `=== `, whose
// remainder is the label. Anything before the first marker is ignored.
//
//   === 1 pdf question
//   <the reply text>
//   === 2 eighty applications
//   <the reply text>
//
// PRIVACY: transcripts are real user conversations and DO NOT belong in the
// repo. Keep them in a scratch directory and pass the path. This script reads
// what you point it at and writes nothing.
//
// Why structures and not a word list: banning vocabulary moves the tic to a
// synonym. Reimagine has watched this happen — "genuinely" banned, "actually"
// appeared; a worked example written around the logic-flip, and the model
// produced one anyway. So each check below targets a SHAPE, and the headline
// number is density (tics per 1,000 words), because density rather than any
// single phrase is what makes prose read as generated.

import fs from 'node:fs'

// Each check is a rhetorical move, named the way the prompt's BANNED SHAPES
// names it, so a score maps directly onto a rule someone can go and edit.
export const CHECKS = [
  {
    id: 'opening-validation',
    what: 'opens by rating the question or the feeling',
    // Anchored to the start of the reply: the same words mid-paragraph are
    // usually doing honest work ("that feeling of being stuck is what KEEL is
    // for"), so only the opener counts.
    perReply: true,
    re: /^\s*(?:but\s+)?(?:fair|good|great|smart|tough|hard)\s+(?:question|point|worry|one)\b|^\s*that(?:'s| is)?\s+(?:a\s+lot|a\s+fair|feeling\s+is|makes\s+sense)\b|^\s*(?:that|this)\s+feeling\s+is\b|^\s*(?:i\s+)?hear\s+you\b/i,
  },
  {
    id: 'insight-flagging',
    what: 'announces that a point is worth attention before making it',
    // Attention and speech verbs only. "worth doing / building / having /
    // reactivating" judge an ACTION and are legitimate; the banned move is
    // flagging a point as worth notice before making it. Widened 2026-08-29
    // after the model answered a ban on "worth noting" with "Worth noticing:" —
    // an enumerated synonym list is a blocklist by another name, which is the
    // exact failure this whole approach exists to avoid.
    re: /\bworth\s+(?:nam|not|notic|know|mention|surfac|flag|say|call|point|observ|highlight|underscor|stress|emphasi|ask|repeat|remember|try|tri)\w*\b|\bworth\s+\w+ing\s*:|\bthe\s+thing\s+(?:to\s+notice|worth\s+noting)\b|\bwhat\s+stands\s+out\s+(?:here\s+)?is\b|\bhere(?:'s| is)\s+what\s+matters\b/gi,
  },
  {
    id: 'negative-parallelism',
    what: 'defines a thing by what it is not',
    // Negative-FIRST only: "it's not X, it's Y" / "isn't X — that's Y". The
    // reverse order ("the list has been worked, not that the network is
    // finished") states the positive first and is ordinary English, so it is
    // deliberately not matched. Widened 2026-08-29 to cover "that's" as well as
    // "it's", and em-dash as well as comma, after three instances slipped by.
    // One adverb may sit before "not" ("it's often not the market"), and both
    // the contracted and spelled-out forms count ("it is not X, it is Y").
    re: /\b(?:is|are|was|were|isn'?t|aren'?t|it'?s|that'?s|you'?re)\s+(?:\w+\s+)?not\s+(?:just\s+)?[^.;:]{2,80}?\s*[,—-]\s*(?:it'?s|it is|that'?s|that is|they'?re|they are|you'?re|but)\b|\bnot\s+just\s+[^.,;:]{2,60}?\s+but\b|\bless\s+about\s+[^.,;:]{2,60}?\s+and\s+more\s+about\b/gi,
  },
  {
    id: 'signposting',
    what: 'narrates the structure of its own reply',
    // Up to three words may sit between "here's" and the signpost noun, so
    // "here's part of why" is caught alongside "here's why". Same widening and
    // same reason as insight-flagging above.
    re: /\bhere(?:'s| is)\s+(?:\w+\s+){0,3}?(?:thing\b|why\b|how\s+it\s+works|what\s+(?:doesn'?t|does))|\bone\s+more\s+thing\b|\bi\s+want\s+to\s+say\s+something\b|\blet\s+me\s+(?:explain|walk|say)\b/gi,
  },
  {
    id: 'closing-question',
    what: 'ends on a question',
    perReply: true,
    re: /\?\s*$/,
  },
  {
    id: 'attribution-full-name',
    what: 'uses the full "Bob Goodwin" rather than the short form',
    re: /\bBob Goodwin\b/g,
  },
  {
    id: 'coaching-register',
    what: 'AI-coaching vocabulary',
    re: /\b(?:sit with|sitting with|lean into|hold space|get curious|notice what comes up|trust the process|honor your journey|let that land)\b/gi,
  },
]

export function splitReplies(raw) {
  const parts = raw.split(/^===\s*/m).slice(1)
  return parts.map(p => {
    const nl = p.indexOf('\n')
    return { label: p.slice(0, nl < 0 ? p.length : nl).trim(), body: (nl < 0 ? '' : p.slice(nl + 1)).trim() }
  }).filter(r => r.body)
}

export function score(replies) {
  const totals = Object.fromEntries(CHECKS.map(c => [c.id, 0]))
  const rows = []
  let words = 0
  for (const r of replies) {
    words += r.body.split(/\s+/).filter(Boolean).length
    const hits = {}
    for (const c of CHECKS) {
      // perReply checks answer "does this reply do it", so they cap at 1 and
      // the totals read as "N of M replies" rather than a raw count.
      const n = c.perReply ? (c.re.test(r.body) ? 1 : 0) : (r.body.match(c.re) || []).length
      hits[c.id] = n
      totals[c.id] += n
    }
    rows.push({ label: r.label, hits, total: Object.values(hits).reduce((a, b) => a + b, 0) })
  }
  const total = Object.values(totals).reduce((a, b) => a + b, 0)
  return { rows, totals, words, total, density: words ? (total / words) * 1000 : 0, replies: replies.length }
}

function render(name, s) {
  console.log(`\n${name} — ${s.replies} replies, ${s.words} words`)
  console.log('  ' + 'shape'.padEnd(26) + 'count  what it is')
  for (const c of CHECKS) {
    const n = s.totals[c.id]
    const suffix = c.perReply ? `${n}/${s.replies}` : String(n)
    console.log(`  ${(n > 0 ? '! ' : '  ') + c.id.padEnd(24)}${suffix.padEnd(7)}${c.what}`)
  }
  console.log(`  ${'TOTAL'.padEnd(26)}${String(s.total).padEnd(7)}density ${s.density.toFixed(1)} per 1,000 words`)
  const worst = [...s.rows].sort((a, b) => b.total - a.total).slice(0, 3)
  if (worst.length) console.log('  worst replies: ' + worst.map(w => `${w.label} (${w.total})`).join(', '))
}

if (process.argv[1] && process.argv[1].endsWith(`eval-coach-voice.mjs`)) {
const args = process.argv.slice(2)
const file = args.find(a => !a.startsWith('--'))
const bIdx = args.indexOf('--baseline')
const baseline = bIdx > -1 ? args[bIdx + 1] : null
if (!file) {
  console.error('usage: node scripts/eval-coach-voice.mjs <transcript-file> [--baseline <file>]')
  process.exit(1)
}

const now = score(splitReplies(fs.readFileSync(file, 'utf8')))
if (baseline) {
  const before = score(splitReplies(fs.readFileSync(baseline, 'utf8')))
  render('BEFORE  ' + baseline, before)
  render('AFTER   ' + file, now)
  const d = now.density - before.density
  const pct = before.density ? Math.round((d / before.density) * 100) : 0
  console.log(`\n  density ${before.density.toFixed(1)} -> ${now.density.toFixed(1)} per 1,000 words (${pct >= 0 ? '+' : ''}${pct}%)`)
  // Per-shape movement, so a win in one structure and a regression in another
  // do not cancel out into a flat headline number.
  console.log('  by shape:')
  for (const c of CHECKS) {
    const a = before.totals[c.id], b = now.totals[c.id]
    if (a || b) console.log(`    ${c.id.padEnd(24)} ${a} -> ${b}${b > a ? '   REGRESSION' : ''}`)
  }
} else {
  render(file, now)
}
}
