// Coach-as-Concierge Phase 1a (Output/handoff/2026-09-08_coach-concierge-
// phase-1a-situation.md): the Situation object gives Coach one shared answer
// to "what is this person looking at" on every turn, pinning the in-view
// record on EITHER door -- unlike coachSaveTarget(), which is deliberately
// door2-only for opportunity-specific chat-capture targeting (archiving,
// Interview Team edits, and the like). This is the mechanical fix for the
// button-vs-free-chat grounding gap found live: Career Paths never had a way
// to pin its own record the way the Opportunity Playbook's "Get My Coach's
// read" button already did for itself.
//
// App.jsx is JSX, not importable by plain Node, so computeSituation's
// record-resolution rule is re-derived here and checked against inline cases,
// then checked for source-presence against the real function body. The
// server-side three-tier fallback and the new flag/GRANTABLE_FLAGS wiring are
// checked the same way -- source-presence plus a pure re-derivation of the
// fallback order.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')
const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')
const FLAGS = 'api/_lib/feature-flags.js'
const flags = fs.readFileSync(FLAGS, 'utf8')
const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

// --- Pure re-derivation of computeSituation's record resolution ---
// Mirrors the rule exactly: find by currentSavedSlotIdRef, no source filter.
function resolveSituationRecord(savedPlaybooks, currentSlotId) {
  const rec = currentSlotId ? savedPlaybooks.find(x => x && x.id === currentSlotId) : null
  return rec ? { id: rec.id, source: rec.source, title: rec.title || (rec.source === 'door2' ? 'this opportunity' : 'this direction'), lane: rec.lane || null, company: rec.company || null } : null
}
// Mirrors coachSaveTarget()'s rule exactly: same lookup, PLUS source==='door2'.
function resolveCoachSaveTarget(savedPlaybooks, currentSlotId) {
  const rec = savedPlaybooks.find(x => x && x.id === currentSlotId && x.source === 'door2')
  return rec ? { id: rec.id, title: rec.title || 'this opportunity' } : null
}

const door1Record = { id: 'd1', source: 'door1', title: 'Head of Supply Chain', lane: 'industry_insider' }
const door2Record = { id: 'd2', source: 'door2', title: 'Site Director', company: 'Cart.com' }
const both = [door1Record, door2Record]

check(resolveSituationRecord(both, 'd1') && resolveSituationRecord(both, 'd1').id === 'd1',
  'computeSituation must resolve a door1 (Career Paths direction) record -- this is the entire point of the fix')
check(resolveSituationRecord(both, 'd2') && resolveSituationRecord(both, 'd2').id === 'd2',
  'computeSituation must still resolve a door2 (Opportunity Playbook) record')
check(resolveCoachSaveTarget(both, 'd1') === null,
  'coachSaveTarget() must stay door2-only -- the fix adds a new resolver, it must not touch this one')
check(resolveCoachSaveTarget(both, 'd2') !== null,
  'coachSaveTarget() must still resolve a door2 record (unchanged behavior)')
check(resolveSituationRecord(both, null) === null && resolveSituationRecord(both, 'nope') === null,
  'computeSituation must return null with no pin or an unknown id, not throw')

// --- Pure re-derivation of the server's three-tier pin fallback ---
function resolvePinnedId(situationRecordId, focusRecordId) {
  return situationRecordId || (typeof focusRecordId === 'string' ? focusRecordId.trim() : '')
}
check(resolvePinnedId('d1', '') === 'd1', 'situationRecordId must win when present, even with no focusRecordId')
check(resolvePinnedId('d1', 'd2') === 'd1', 'situationRecordId must be tried BEFORE focusRecordId, not merged with it')
check(resolvePinnedId('', 'd2') === 'd2', 'focusRecordId must still work as the fallback when situationRecordId is empty (non-flagged account, or old cached client)')
check(resolvePinnedId('', '') === '', 'empty pinnedId must fall through to findInFocusRecord (the title-match scan), not resolve to a stale id')

// --- Source-presence: the fix is actually wired the way the logic above assumes ---
check(app.includes("const computeSituation=()=>{"), `${APP}: computeSituation is missing`)
check(app.includes("const record=rec?{id:rec.id,source:rec.source,title:rec.title||(rec.source==='door2'?'this opportunity':'this direction'),lane:rec.lane||null,company:rec.company||null}:null"),
  `${APP}: computeSituation's record mapping has drifted from the door-agnostic shape`)
check(app.includes('const rec=slotId?savedPlaybooks.find(x=>x&&x.id===slotId):null'),
  `${APP}: computeSituation's lookup must NOT filter on source (unlike coachSaveTarget's find) -- that would silently reintroduce the Career Paths pinning gap this fix closes. (source==='door2' appearing elsewhere in the function, in the title-fallback label, is expected and fine.)`)
check(app.includes("situation={computeSituation()}"),
  `${APP}: at least one <Chat> mount is missing the situation prop`)
const situationMountCount = (app.match(/situation=\{computeSituation\(\)\}/g) || []).length
check(situationMountCount === 3, `${APP}: expected all 3 <Chat> mounts to carry situation={computeSituation()}, found ${situationMountCount}`)
check(app.includes("new IntersectionObserver(entries=>{"), `${APP}: the visibleSection IntersectionObserver tracker is missing`)

// presence/setPresence (Phase 1b) now sit between situation and onSaveNote
// in the destructure -- checking situation's own presence, not exact
// adjacency to a neighbor that had no reason to stay adjacent.
check(chat.includes('coachSaveTarget = null, situation = null,'), `${CHAT}: situation prop is missing from Chat's destructure`)
check(chat.includes('          situation,'), `${CHAT}: situation is missing from the /api/coach request body`)

check(coach.includes("hasCoachSituation } from './_lib/feature-flags.js'"), `${COACH}: hasCoachSituation import is missing`)
check(coach.includes('const situationRecordId = hasCoachSituation({ feature_flags: featureFlags, email: userEmail }) && situation && situation.record && typeof situation.record.id === \'string\''),
  `${COACH}: situationRecordId derivation is missing or has drifted (must be gated on hasCoachSituation)`)
check(coach.indexOf('const situationRecordId') < coach.indexOf('let inFocusRecordId = null'),
  `${COACH}: situationRecordId must be derived before the in-focus resolution block that uses it`)
check(coach.includes("const pinnedId = situationRecordId || (typeof focusRecordId === 'string' ? focusRecordId.trim() : '')"),
  `${COACH}: pinnedId no longer tries situationRecordId first -- this is the actual fix, not a detail`)
check(coach.includes('situation: req.body && req.body.situation && typeof req.body.situation === \'object\' ? req.body.situation : null,'),
  `${COACH}: the /api/coach handler is not passing situation from the request body into buildCoachRequest`)
check(coach.includes('They are currently looking at the "${situationSection}" section.'),
  `${COACH}: the section-in-view context line is missing`)

check(flags.includes("export const COACH_SITUATION_FLAG = 'coach_situation'"), `${FLAGS}: COACH_SITUATION_FLAG is missing`)
check(flags.includes('export function hasCoachSituation(user) {'), `${FLAGS}: hasCoachSituation is missing`)
check(flags.includes('[COACH_SITUATION_FLAG]: { label: \'Coach situational grounding\' },'), `${FLAGS}: GRANTABLE_FLAGS entry is missing`)

if (failures) {
  console.error(`test-coach-situation: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-situation: OK (Situation pins the in-view record on either door, section-in-view rides the same context line as the step id, and a non-flagged/old client degrades to exactly today\'s focusRecordId/title-match behavior)')
}
