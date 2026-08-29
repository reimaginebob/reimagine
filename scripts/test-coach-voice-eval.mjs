#!/usr/bin/env node
// Keeps the voice detector and the prompt's own examples honest about each
// other. Two invariants, both cheap and both real:
//
//   1. Every "YES" rewrite in the prompt's REWRITE THESE SHAPES block must
//      score ZERO. If someone adds a corrected example that still carries a
//      banned shape, the prompt is teaching the tic it is trying to remove.
//   2. Every "NO" example must score at least one hit. If it does not, the
//      detector has drifted away from the shape the prompt is warning about,
//      and the eval would report a clean transcript that is not.
//
// The pairs live in api/coach.js rather than here on purpose: the prompt is the
// source of truth for what good looks like, and this file only checks it.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHECKS, score, splitReplies } from './eval-coach-voice.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const coach = fs.readFileSync(path.join(__dirname, '..', 'api', 'coach.js'), 'utf8')

const start = coach.indexOf('REWRITE THESE SHAPES')
const end = coach.indexOf('Voice rules, enforce strictly:')
if (start < 0 || end < 0 || end < start) {
  console.error('test-coach-voice-eval: FAIL — could not locate the REWRITE THESE SHAPES block in api/coach.js')
  process.exit(1)
}
const pairs = [...coach.slice(start, end).matchAll(/- NO: "([^"]+)" → YES: "([^"]+)"/g)]

if (pairs.length < 4) {
  console.error(`test-coach-voice-eval: FAIL — expected at least 4 contrastive pairs, found ${pairs.length}.`)
  console.error('Paired examples are the mechanism here; a positive-only example set teaches the target without the boundary.')
  process.exit(1)
}

const asTranscript = (items) => items.map((t, i) => `=== ${i + 1}\n${t}`).join('\n')
const bad = score(splitReplies(asTranscript(pairs.map(p => p[1]))))
const good = score(splitReplies(asTranscript(pairs.map(p => p[2]))))

let failed = 0

// The "closing-question" and "attribution" checks are not what these pairs are
// demonstrating, so a YES example ending in a question would be a false alarm.
// Score the YES side only against the shapes the pairs exist to teach.
const TAUGHT = new Set(['opening-validation', 'insight-flagging', 'negative-parallelism', 'signposting', 'coaching-register'])
const taughtTotal = (s) => [...TAUGHT].reduce((n, id) => n + s.totals[id], 0)

if (taughtTotal(good) !== 0) {
  failed++
  console.error(`FAIL: the corrected ("YES") examples still carry ${taughtTotal(good)} banned shape(s):`)
  for (const c of CHECKS) if (TAUGHT.has(c.id) && good.totals[c.id]) console.error(`  ${c.id}: ${good.totals[c.id]} — ${c.what}`)
  console.error('  A corrected example that still trips the detector teaches the tic it is meant to remove.')
} else {
  console.log(`pass  all ${pairs.length} corrected examples score zero on the shapes they teach`)
}

if (taughtTotal(bad) < pairs.length) {
  failed++
  console.error(`FAIL: the "NO" examples scored only ${taughtTotal(bad)} hits across ${pairs.length} pairs — expected at least one each.`)
  console.error('  A NO example the detector cannot see means the regex has drifted from the shape the prompt bans.')
  for (const [i, p] of pairs.entries()) {
    const one = score(splitReplies(`=== x\n${p[1]}`))
    if (taughtTotal(one) === 0) console.error(`  undetected: "${p[1].slice(0, 80)}…"`)
  }
} else {
  console.log(`pass  all "NO" examples are detected (${taughtTotal(bad)} hits across ${pairs.length} pairs)`)
}

if (failed) { console.error(`\ntest-coach-voice-eval: ${failed} failure(s)`); process.exit(1) }
console.log('test-coach-voice-eval: OK')
