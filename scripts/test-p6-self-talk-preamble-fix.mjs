// Fix 2 from Bob's production test on 268a812: a freshly built Bridge Story
// opened with the model's own self-talk before the story -- "Coaching myself
// before I write this: ... Here it is." -- then the actual story. The
// existing ---COACHING NOTE--- split (bridgeStoryToProse, src/App.jsx) only
// looks for content AFTER that delimiter, so a preamble BEFORE it walked
// straight through.
//
// Two layers, matching CLAUDE.md's "pair the instruction with a detection or
// stripping mechanism" rule:
// 1. P.p6 (src/App.jsx) gained an explicit OUTPUT FORMAT instruction: the
//    first word of the reply is the first word of the story, no preamble or
//    self-talk, and any alternate-anchor note goes only after the
//    ---COACHING NOTE--- separator.
// 2. stripSelfTalkPreamble (src/text-strippers.js) is a deterministic guard
//    in the same family as stripMetaNarration -- wired into callClaude's
//    universal cleanup chain in src/App.jsx so it runs on every model
//    response, not just p6's.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const STRIPPERS = 'src/text-strippers.js'
const app = fs.readFileSync(APP, 'utf8')
const strippers = fs.readFileSync(STRIPPERS, 'utf8')

// 1. Prompt tightening: P.p6 tells the model not to open with self-talk, and
// that any alternate-anchor note belongs only after the delimiter.
check(app.includes('OUTPUT FORMAT: The first word you write is the first word of the story itself.'),
  `${APP}: P.p6 no longer carries the no-preamble OUTPUT FORMAT instruction`)
check(app.includes('that goes ONLY after the ---COACHING NOTE--- separator described below, never before the story'),
  `${APP}: P.p6's OUTPUT FORMAT instruction no longer ties the alternate-anchor note to the delimiter`)

// 2. Deterministic guard exists and is exported.
check(strippers.includes('export function stripSelfTalkPreamble(text)'),
  `${STRIPPERS}: stripSelfTalkPreamble is missing`)

// 3. Wired into App.jsx's import and the universal cleanup chain in callClaude
// -- every model response goes through this, matching how stripMetaNarration
// is wired (same family: a model-robust AI tell that gets stripped, not just
// instructed away).
check(app.includes('stripSelfTalkPreamble') && /import\s*\{[^}]*stripSelfTalkPreamble[^}]*\}\s*from\s*"\.\/text-strippers\.mjs"/.test(app),
  `${APP}: stripSelfTalkPreamble is not imported from text-strippers.mjs`)
check(app.includes('const cleaned=stripSincerityQualifiers(stripLogicFlipCadence(stripCoachSpeak(stripSelfTalkPreamble(stripMetaNarration(stripRoomsPlaceholder(raw))))))'),
  `${APP}: stripSelfTalkPreamble is not wired into callClaude's universal cleanup chain`)

// 4. Functional check on the stripper itself, run in isolation (mirrors the
// exact leaked shape from Bob's report).
const strippersModPath = new URL('../src/text-strippers.js', import.meta.url)
const { stripSelfTalkPreamble } = await import(strippersModPath)

const leaked = `Coaching myself before I write this: your through-line still leans on "trust," and this person told us to lose that word entirely. So the theme has to hold without it. Here it is.\n\nPeople bring her the conversation before they bring it to their own boss.`
const cleanedLeaked = stripSelfTalkPreamble(leaked)
check(!/coaching myself/i.test(cleanedLeaked), 'stripSelfTalkPreamble: leaked self-talk preamble (paragraph form) survived the strip')
check(cleanedLeaked.trim().startsWith('People bring her'), 'stripSelfTalkPreamble: story content was damaged, not just the preamble removed')

const leakedNoBreak = `Before I write this, here's the anchor I'm choosing and why it fits better than the alternative. Here it is. This is the actual story that should ship to the user.`
const cleanedNoBreak = stripSelfTalkPreamble(leakedNoBreak)
check(!/before i write this/i.test(cleanedNoBreak), 'stripSelfTalkPreamble: leaked self-talk preamble (handoff-phrase form, no paragraph break) survived the strip')
check(cleanedNoBreak.trim().startsWith('This is the actual story'), 'stripSelfTalkPreamble: handoff-phrase form did not cleanly hand off to the story')

const clean = `This is a normal Bridge Story with no preamble at all, and it happens to mention "before" and "here it is" later on for unrelated reasons.`
check(stripSelfTalkPreamble(clean) === clean, 'stripSelfTalkPreamble: a normal story with no leading self-talk anchor was altered -- false positive')

if (failures) {
  console.error(`test-p6-self-talk-preamble-fix: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-p6-self-talk-preamble-fix: OK (P.p6 instructs the story to open with no preamble and ties any alternate-anchor note to the ---COACHING NOTE--- delimiter; stripSelfTalkPreamble is wired into the universal cleanup chain and correctly removes both a paragraph-form and a handoff-phrase-form self-talk preamble while leaving a normal story untouched)')
}
