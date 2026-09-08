// Guards finding #4.8 from the 2026-09-07 My Coach diagnostic review:
// Coach-driven profile writes were skipping the staleness path the screens
// use. values-capture and reputation-capture already set pbNeedsUpdate
// directly (pr()'s own markInputEdited() is gated on INPUT_EDIT_STEPS.has(step),
// which a Coach tap firing from myCoach or the floating bubble never
// satisfies), but skills-capture, skills-remove, life-story-capture, and
// assessment-capture did not, even though all four write fields p3analysis
// reads directly (VALIDATED HARD SKILLS, LIFE-SHAPING EXPERIENCES, RAW
// ASSESSMENT) -- so building on a Coach-added skill, life story detail, or
// assessment answer never surfaced the "your brand may be out of date" nudge.
//
// Pre-flight discovery narrowed the brief's own scope: the brief also named
// priorities-capture, but p3analysis (verified by reading its full prompt
// body) never reads compFloor/workReq/benefitsWeight/riskTolerance/
// dealBreakers -- those feed the Live Opportunity Playbook's compensation
// read once an offer is in hand, a different section with no comparable
// staleness mechanism today. Setting pbNeedsUpdate there would misdirect the
// person toward rebuilding a document those fields never touch, so
// priorities-capture is deliberately left alone. skills-remove was not named
// in the brief but shares the identical gap -- it writes the same
// pr('skills', ...) field skills-capture does -- so it is fixed here too.
//
// Source-level: the write handlers live inside App.jsx's single giant
// onQuickReply function, not an importable module.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

const STALE_LINE = "if(!isDemo&&outputs.p3&&!pbNeedsUpdate)setPbNeedsUpdate(true)"

// Baseline: the two write paths the review already found correct should stay
// correct -- this guards against a future refactor accidentally dropping them
// while touching this area for something else.
for (const key of ['values-capture', 'reputation-capture']) {
  const idx = app.indexOf(`checkinKey==='${key}'`)
  check(idx !== -1, `${APP}: checkinKey==='${key}' handler is missing`)
  const end = idx !== -1 ? app.indexOf('\n    }', idx) : -1
  check(idx !== -1 && end !== -1 && app.slice(idx, end).includes(STALE_LINE),
    `${APP}: ${key} lost its pbNeedsUpdate staleness line -- it already had this before finding #4.8`)
}

// The four write paths finding #4.8 flagged as missing the parity fix
// (skills-capture, life-story-capture, assessment-capture named directly;
// skills-remove added here for the same root cause).
for (const key of ['skills-capture', 'skills-remove', 'life-story-capture', 'assessment-capture']) {
  const idx = app.indexOf(`checkinKey==='${key}'`)
  check(idx !== -1, `${APP}: checkinKey==='${key}' handler is missing`)
  const end = idx !== -1 ? app.indexOf('\n    }', idx) : -1
  check(idx !== -1 && end !== -1 && app.slice(idx, end).includes(STALE_LINE),
    `${APP}: ${key} does not set pbNeedsUpdate -- a Coach write here would not surface the Personal Brand staleness nudge, even though this field feeds p3analysis`)
}

// priorities-capture is a deliberate exclusion, not an oversight -- assert it
// stays that way so a future "just add it everywhere" pass does not
// reintroduce a misleading nudge for fields p3 never reads.
{
  const idx = app.indexOf("checkinKey==='priorities-capture'")
  check(idx !== -1, `${APP}: checkinKey==='priorities-capture' handler is missing`)
  const end = idx !== -1 ? app.indexOf('\n    }', idx) : -1
  check(idx !== -1 && end !== -1 && !app.slice(idx, end).includes(STALE_LINE),
    `${APP}: priorities-capture now sets pbNeedsUpdate -- these fields feed the Live Opportunity Playbook's compensation read, not Personal Brand, so this would misdirect the person`)
}

// p3analysis (the actual Personal Brand synthesis prompt, distinct from the
// p3 compositor) is the ground truth for which fields the staleness flag
// should track -- confirms the fields behind the four fixed handlers are
// genuinely read there, and priorities fields genuinely are not.
const p3AnalysisIdx = app.indexOf('p3analysis:(pr,previousBrand')
check(p3AnalysisIdx !== -1, `${APP}: p3analysis prompt builder is missing`)
const p3AnalysisEnd = p3AnalysisIdx !== -1 ? app.indexOf("\n  },\n  // Stage two", p3AnalysisIdx) : -1
const p3AnalysisBlock = p3AnalysisIdx !== -1 && p3AnalysisEnd !== -1 ? app.slice(p3AnalysisIdx, p3AnalysisEnd) : ''
check(p3AnalysisBlock.includes('pr.assess'), `${APP}: p3analysis no longer reads pr.assess -- assessment-capture's staleness fix would be pointless`)
check(p3AnalysisBlock.includes('pr.lifeEvents'), `${APP}: p3analysis no longer reads pr.lifeEvents -- life-story-capture's staleness fix would be pointless`)
check(p3AnalysisBlock.includes('formatSkills(pr.skills)'), `${APP}: p3analysis no longer reads pr.skills -- skills-capture/skills-remove's staleness fix would be pointless`)
check(!p3AnalysisBlock.includes('pr.compFloor') && !p3AnalysisBlock.includes('pr.dealBreakers'),
  `${APP}: p3analysis now reads a priorities field -- if this is intentional, priorities-capture should also set pbNeedsUpdate and this test's exclusion check above should be removed`)

if (failures) {
  console.error(`test-coach-write-staleness-parity: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-write-staleness-parity: OK (skills-capture, skills-remove, life-story-capture, and assessment-capture now set pbNeedsUpdate like values-capture/reputation-capture already did; priorities-capture deliberately excluded since p3analysis never reads those fields)')
}
