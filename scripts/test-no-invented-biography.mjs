// Fabricated biography (2026-09-18). Reimagine produced, on an internal test
// account, a revenue percentage and a CFO quote that appear nowhere in that
// account's resume, and -- separately, in My Coach -- a family member's
// depression, a parent's 38-year work history, and a named former boss that
// appear nowhere in its inputs at all.
//
// This is a different failure from the cross-opportunity leaks of #983/#985.
// Those moved real content to the wrong place; this states content that does
// not exist anywhere upstream, back to the person as their own history.
//
// What this file holds still is the INSTRUCTION layer, which is the half that
// was missing. Two asymmetries found while tracing it:
//
//  1. The generation pipeline's stage-one Personal Brand analysis already
//     carried the right floor ("Do not invent specifics (names, numbers,
//     employers, credentials, diagnoses) that the inputs do not support",
//     SYS_SAFETY_ONLY) -- but SYS_BASE, which every OTHER generation step
//     runs on including p3's stage two (the one that writes the prose a
//     person actually reads), carried nothing of the kind. CREDENTIAL
//     ACCURACY governs not inflating what IS on the resume; nothing governed
//     adding what is not.
//  2. My Coach had GROUND BEFORE YOU ASSERT and "Name the source or do not
//     say it" -- both real, both scoped to EXTERNAL claims (market figures,
//     research citations, hire-ability verdicts). Neither said anything about
//     the person's own biography, and nothing anywhere said that the worked
//     examples in the book and the user guide -- both injected whole, on
//     every turn, full of first-person anecdotes with specific year-counts --
//     are never this person's life.
//
// An instruction is not the whole fix (CLAUDE.md section 3: pair it with a
// detector or it is a draft). The detector is its own change; this pins the
// floor so it cannot be quietly dropped in the meantime.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const CLAUDE = 'api/claude.js'
const COACH = 'api/coach.js'
const app = fs.readFileSync(APP, 'utf8')
const claude = fs.readFileSync(CLAUDE, 'utf8')
const coach = fs.readFileSync(COACH, 'utf8')

// --- 1. The generation floor, on both sides of the byte-equality gate ------
// SYS_BASE is duplicated inline in App.jsx and api/claude.js on purpose (the
// 2026-05-27 .mjs outage); check-sys-equality keeps them identical. A rule
// that lands in only one of them would pass that gate only by accident, so
// assert it in both by name rather than trusting the equality check alone.
for (const [label, src] of [[APP, app], [CLAUDE, claude]]) {
  check(/Never supplied, only reported/.test(src),
    `${label}: SYS_BASE has no rule against stating specifics the materials do not contain -- CREDENTIAL ACCURACY stops the model inflating what IS there and says nothing about adding what is not`)
  check(/Quotation marks are a promise/.test(src),
    `${label}: nothing forbids quoting speech no source document contains -- the reported Personal Brand fabrication was a CFO quote`)
  check(/Family, health and mental health carry the least room for error/.test(src),
    `${label}: the sensitive categories are not named, so the rule reads as being about tidy sourcing rather than about a person's family`)
}

// --- 2. Stage one's existing floor is still there -------------------------
// This one predates the incident and is correct; a later edit that "tidied"
// SYS_SAFETY_ONLY now that SYS_BASE covers the same ground would silently
// remove the only guard on the free-running analysis stage.
check(/Do not invent specifics \(names, numbers, employers, credentials, diagnoses\)/.test(claude),
  `${CLAUDE}: SYS_SAFETY_ONLY lost its grounding floor -- stage one of Personal Brand runs on that prompt ALONE, with none of SYS_BASE's rails`)

// --- 3. My Coach ----------------------------------------------------------
check(/NEVER INVENT THIS PERSON'S LIFE/.test(coach),
  `${COACH}: Coach has no rule about the person's own history. GROUND BEFORE YOU ASSERT and "Name the source or do not say it" both exist, and both are about market figures and research claims`)
check(/Making Your Own Weather and in the user guide are other people's lives/.test(coach),
  `${COACH}: nothing tells Coach that the book's and the guide's worked examples are not this person's biography -- both are injected whole on every turn`)
check(/re-rolling somebody else's anecdote with fresh numbers/.test(coach),
  `${COACH}: the rule bans copying an example's words but not reusing its shape, which is what a fabricated "parent's 38-year history" actually looks like`)
check(/Family, health and mental health carry the least room for error/.test(coach),
  `${COACH}: the sensitive categories are not named for Coach, which is the surface that produced the family-health fabrication`)
check(/a capture line proposes text they may accept with one tap/.test(coach),
  `${COACH}: the rule does not reach the capture trailers, so an invented detail could still be OFFERED for a one-tap save even when the reply itself is clean`)

// --- 4. It has to sit where the model reads it as binding ----------------
{
  // Inside the posture-rules list, ahead of the off-topic rule -- not appended
  // somewhere below the feature map where a long prompt buries it.
  const i = coach.indexOf("NEVER INVENT THIS PERSON'S LIFE")
  const ground = coach.indexOf('GROUND BEFORE YOU ASSERT')
  const offTopic = coach.indexOf('- Off-topic questions get a warm redirect')
  check(ground !== -1 && i > ground && i < offTopic,
    `${COACH}: the biography rule is not in the posture-rules block next to GROUND BEFORE YOU ASSERT, whose own text says the specific rules following it are instances of it`)
}
{
  // In SYS_BASE's CREDENTIAL ACCURACY list, which every generation step reads
  // "before every output" -- not stranded in a section a given step skips.
  for (const [label, src] of [[APP, app], [CLAUDE, claude]]) {
    const ca = src.indexOf('CREDENTIAL ACCURACY (load-bearing, read before every output)')
    const ic = src.indexOf('INTERPRETIVE CALLS (read before every output)')
    const rule = src.indexOf('Never supplied, only reported')
    check(ca !== -1 && ic !== -1 && rule > ca && rule < ic,
      `${label}: the rule is outside the CREDENTIAL ACCURACY block, which is the list the model is told to read before every output`)
  }
}

if (failures) {
  console.error(`test-no-invented-biography: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-no-invented-biography: OK (every generation step and My Coach are told that a specific they were not given -- a figure, a quote, a named person, a family member, an illness, a formative event -- is never theirs to supply; the book\'s and the guide\'s worked examples are named as other people\'s lives, in shape as well as wording; the sensitive categories are named explicitly on both surfaces; the rule binds Coach\'s one-tap capture offers as tightly as its prose; and stage one of Personal Brand keeps the floor it already had)')
}
