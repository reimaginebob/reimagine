// Guards Opportunity Context capture (2026-09-06), Phase 2 of
// Output/handoff/2026-09-06_coach-opportunity-playbook-proactive-signals.md.
// Coach can now propose adding durable, non-person-attached intel about an
// opportunity itself (company context, a culture signal, what the loop is
// really testing for) to the same free-text "opportunity context" field the
// Interview Team card's own box already writes to -- which already feeds
// Interview Prep generation (src/App.jsx buildP11PanelBlock). Deliberately
// distinct from OPPORTUNITY_UPDATE_CAPTURE_NOTE's person-attached
// `people[].note`: this is for context not tied to any one interviewer.
// Reuses hasPipelineCapture (no new flag) since it is the same "opportunity
// data" idea applied to a different field on the same panel object.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

check(coach.includes('const OPPORTUNITY_CONTEXT_CAPTURE_NOTE ='),
  `${COACH}: OPPORTUNITY_CONTEXT_CAPTURE_NOTE is missing`)
check(coach.includes('not tied to a specific named person in the loop'),
  `${COACH}: the capture note does not distinguish itself from OPPORTUNITY_UPDATE_CAPTURE_NOTE's person-attached notes`)
check(coach.includes('OPPORTUNITYCONTEXT: {"opportunity"') && coach.includes('"text":"<the context'),
  `${COACH}: the capture note's trailer example is missing or malformed`)
check(coach.includes('NEVER SAY YOU HAVE ADDED OR SAVED IT'),
  `${COACH}: the capture note does not forbid claiming an unmade write`)
check(coach.includes('appended to whatever is already in that field, never overwriting it'),
  `${COACH}: the capture note does not state the append-not-overwrite contract`)

check(/const opportunityContextNote = hasPipelineCapture\(\{ feature_flags: featureFlags, email: userEmail \}\) \? OPPORTUNITY_CONTEXT_CAPTURE_NOTE : ''/.test(coach),
  `${COACH}: opportunityContextNote is not gated on hasPipelineCapture, the same flag opportunityUpdateNote already uses for this same panel object`)
const profileTemplateMatch = coach.match(/return `THIS USER'S REIMAGINE PROFILE[\s\S]*?`\n\}/)
check(!!profileTemplateMatch && profileTemplateMatch[0].includes('${opportunityContextNote}'),
  `${COACH}: opportunityContextNote is not spliced into the profile block template`)

check(/const occMatch = strippedText\.match\(\/\^\\s\*OPPORTUNITYCONTEXT:\\s\*/.test(coach),
  `${COACH}: the OPPORTUNITYCONTEXT trailer regex is missing`)
check(/if \(text\) opportunityContextB64 = Buffer\.from/.test(coach),
  `${COACH}: opportunityContextB64 is not built only when text is present`)
check(coach.includes("res.setHeader('X-Coach-Opportunity-Context', opportunityContextB64)"),
  `${COACH}: the X-Coach-Opportunity-Context response header is not set`)

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

check(chat.includes('opportunityContextCaptureActive = false,'),
  `${CHAT}: Chat() is missing the opportunityContextCaptureActive prop`)
check(chat.includes("const occHeader = res.headers.get('X-Coach-Opportunity-Context') || null"),
  `${CHAT}: does not read the X-Coach-Opportunity-Context header`)
check(chat.includes('if (opportunityContextCaptureActive && occHeader)'),
  `${CHAT}: the opportunity-context capture block is not gated on its capture-active prop`)
check(chat.includes("checkinKey: 'opportunity-context',"),
  `${CHAT}: the tap offer does not carry the opportunity-context checkinKey`)
check(chat.includes("It adds to whatever's already there"),
  `${CHAT}: the tap offer does not tell the person this appends rather than replaces`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check((app.match(/opportunityContextCaptureActive=\{hasPipeline&&!isIndependent&&hasPipelineCapture\}/g) || []).length === 2,
  `${APP}: opportunityContextCaptureActive is not wired identically at both <Chat> mount sites`)

// The write path: resolves by title (same precedent as opportunity-update and
// interview-team), appends rather than overwrites, and -- unlike op-card-rework
// -- needs no current-slot switch, since updateOpPanel takes an explicit id.
const handlerIdx = app.indexOf("if(checkinKey==='opportunity-context'){")
check(handlerIdx !== -1, `${APP}: the opportunity-context quick-reply handler is missing`)
const handlerBlock = handlerIdx !== -1 ? app.slice(handlerIdx, handlerIdx + 700) : ''
check(handlerBlock.includes("activePlaybooks.find(r=>r&&r.source==='door2'&&String(r.title||'').toLowerCase().includes(oppName))"),
  `${APP}: does not resolve the opportunity by title the same way the opportunity-update/interview-team handlers do`)
check(handlerBlock.includes("updateOpPanel(targetId,p=>({...p,opportunity_context:(p.opportunity_context&&p.opportunity_context.trim()?p.opportunity_context.trim()+'\\n\\n':'')+text}))"),
  `${APP}: the write does not append to opportunity_context, or risks overwriting existing content`)
check(!handlerBlock.includes('restoreFromSavedSlot'),
  `${APP}: the opportunity-context handler switches the current slot -- unnecessary here since updateOpPanel writes by explicit id, unlike the op-card-rework dispatchers`)

if (failures) {
  console.error(`test-coach-opportunity-context: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-opportunity-context: OK (capture note distinct from person-attached and pipeline-fact notes, gated on hasPipelineCapture, trailer/header wired, tap offer states the append contract, write path resolves by title and appends without switching views)')
}
