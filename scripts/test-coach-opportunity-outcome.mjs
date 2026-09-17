// Guards Coach recording HOW an opportunity ended (2026-09-14). Before this,
// Coach's one-tap update could only move an opportunity to Closed, so an
// accepted offer told to Coach was stored exactly like a rejection -- every
// closed row in production had no outcome. Source-level, like its siblings.
import fs from 'node:fs'
import { PURSUIT_OUTCOMES, PURSUIT_OUTCOME_LABELS } from '../src/pursuit-stages.js'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const coach = fs.readFileSync('api/coach.js', 'utf8')
const chat = fs.readFileSync('src/components/Chat.jsx', 'utf8')
const app = fs.readFileSync('src/App.jsx', 'utf8')
const statusApi = fs.readFileSync('api/pursuit-status.js', 'utf8')

// One vocabulary everywhere: the shared list must match what the API accepts.
const apiOutcomes = (statusApi.match(/VALID_OUTCOMES = new Set\(\[([^\]]*)\]\)/) || [])[1] || ''
check(JSON.stringify(PURSUIT_OUTCOMES.map(o => o.value)) === JSON.stringify(apiOutcomes.split(',').map(s => s.trim().replace(/'/g, ''))),
  'src/pursuit-stages.js PURSUIT_OUTCOMES must match api/pursuit-status.js VALID_OUTCOMES exactly')
check(PURSUIT_OUTCOME_LABELS.accepted === 'Accepted', 'accepted must render as Accepted')

// The instruction: the key exists, it is tied to closed, and it comes from their words only.
check(coach.includes('"outcome":"one of accepted|declined|not_selected|withdrew|no_response ONLY together with stage closed'),
  'api/coach.js: OPPORTUNITY_UPDATE_CAPTURE_NOTE must offer the outcome key, tied to stage closed')
check(coach.includes('Never infer an outcome from silence'), 'api/coach.js: the note must forbid inferring an outcome')
check(coach.includes('An accepted outcome is good news: congratulate them, and do not ask why it ended.'),
  'api/coach.js: an accepted outcome must not trigger the why-did-it-end question')

// Server validation: outcome implies closed; disagreeing outcome is dropped; it ships on the header.
check(/const outcome = rawOutcome && \(!rawStage \|\| rawStage === 'closed'\) \? rawOutcome : ''/.test(coach) && coach.includes("const stage = outcome ? 'closed' : rawStage"),
  'api/coach.js: an outcome must imply closed, and an outcome with a different stage must be dropped')
check(/stage,\s*outcome,\s*move,/.test(coach), 'api/coach.js: outcome must be carried on X-Coach-Opportunity-Update')

// Recap shows it before the tap; the write sends it; the gate accepts an outcome-only update.
check(chat.includes("${outcome ? `, ${PURSUIT_OUTCOME_LABELS[outcome]}` : ''}"), 'Chat.jsx: the recap must name the outcome before the tap')
check(app.includes('if(outcome)patch.outcome=outcome'), 'App.jsx: execOpportunityUpdate must write the outcome')
check(app.includes("return{stage:outcome?'closed':rawStage,outcome}") && app.includes('const{stage,outcome}=updateStageAndOutcome(data)'), 'App.jsx: an outcome must close the opportunity on write')
check(app.includes('if(!stage&&!(data&&PURSUIT_OUTCOME_LABELS[data.outcome])&&!move&&!meeting&&!people.length&&!removePeople.length)return false'),
  'App.jsx: the opportunity-update tap handler must not reject an outcome-only update')

// Docs.
const guide = fs.readFileSync('src/data/user-guide/my-pipeline.md', 'utf8')
check(guide.includes('tell the coach how: that you accepted the offer'), 'my-pipeline.md must say Coach records how an opportunity ended')

if (failures) { console.error(`test-coach-opportunity-outcome: ${failures} check(s) failed`); process.exit(1) }
console.log('test-coach-opportunity-outcome: OK (shared vocabulary matches the API, instruction tied to closed and to their words, server drops disagreeing outcomes, recap names it, write sends it, guide updated)')
