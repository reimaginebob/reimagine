// Splits src/data/user-guide/focus-playbook.md into named units keyed by the
// Focus Playbook section (or shared preamble/tail) each documents, so My
// Coach's step-aware grounding (api/coach.js) can send just the one section
// relevant to wherever the person actually is, instead of the whole 55K
// chapter -- the single largest chapter in the guide, and the one behind
// more than half the currentStep vocabulary (p5, p6, p9, salaryRead, p11,
// p_res, p8, p7, groups, recruiters, income all draw on it).
//
// The chapter is already organized by heading; this doesn't rewrite
// anything, it just finds the existing boundaries. A heading in BOUNDARIES
// starts a new unit (flushing whatever was accumulating); any other line,
// including a heading that isn't in BOUNDARIES (an H1 "Group" label
// immediately followed by its one H2 section, or a sub-heading inside a
// section), is appended to whichever unit is currently accumulating.
//
// FOCUS_PLAYBOOK_UNIT_ORDER is the source of truth for both the split and
// the reassembly test in scripts/test-split-focus-playbook.mjs --
// concatenating every unit's text, in this order, must reproduce the
// original file byte for byte. If the chapter is ever restructured (a
// heading renamed, a section reordered, a new section added), that test
// fails loudly rather than the split silently going stale.

export const FOCUS_PLAYBOOK_UNIT_ORDER = [
  'preamble', 'role', 'bridgeStory', 'industryBackground', 'compensationRead',
  'interviewPrep', 'resumeRefresh', 'linkedinRemix', 'goToMarket',
  'networkingGroups', 'recruiters', 'incomeNow', 'tail',
]

// [exact heading line, unit it starts]. Order does not matter here -- match
// is by line content, not position -- but is kept in file order for
// readability. A heading that continues the unit already accumulating (most
// of the chapter's own sub-headings) is deliberately absent.
const BOUNDARIES = [
  ['# Your Focus Playbook', 'preamble'],
  ['# Group 1 · Understand the role', 'role'],
  ['# Group 2 · Build your story', 'bridgeStory'],
  ['## 3. Industry Background', 'industryBackground'],
  ['# Group 3 · Prepare for the conversation', 'compensationRead'],
  ['## 5. Interview Prep', 'interviewPrep'],
  ['# Group 4 · Carry it into the market', 'resumeRefresh'],
  ['## 7. LinkedIn Remix', 'linkedinRemix'],
  ['## 8. Go-to-Market', 'goToMarket'],
  ['# The three bonuses', 'networkingGroups'],
  ['## Bonus · Recruiters for This Path', 'recruiters'],
  ['## Bonus · Income Now', 'incomeNow'],
  ['# Working with the playbook', 'tail'],
]

export function splitFocusPlaybook(markdown) {
  const boundaryMap = new Map(BOUNDARIES)
  const lines = markdown.split('\n')
  const buckets = Object.fromEntries(FOCUS_PLAYBOOK_UNIT_ORDER.map(k => [k, []]))
  let current = 'preamble'
  for (const line of lines) {
    if (boundaryMap.has(line)) current = boundaryMap.get(line)
    buckets[current].push(line)
  }
  const units = {}
  for (const key of FOCUS_PLAYBOOK_UNIT_ORDER) units[key] = buckets[key].join('\n')
  return units
}
