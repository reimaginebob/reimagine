// Guards prompt-engagement analytics + the Life Events thinness prompt
// (2026-09-07, Bob's decline-tracking ask plus the Cowork consult "measuring
// accept/decline patterns on profile-gap prompts"). Two things shipped
// together: (1) a shown/accepted/declined event log for the existing
// employment-status/search-intake/opportunity-archive prompts, retrofitted
// for a same-day baseline, and (2) a new Life Events thinness prompt with
// three firing mechanisms -- hub_arrival (one-shot, like its siblings) and
// the two zero-prompt-cost topic-close signals (tap-confirm, closing
// language), capped combined since those two are repeatable by design.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const MIGRATIONS = fs.readdirSync('migrations').filter(f => f.endsWith('.sql'))
const migrationFile = MIGRATIONS.find(f => f.includes('coach-prompt-engagement'))
check(!!migrationFile, 'migrations/: no coach-prompt-engagement migration found')
if (migrationFile) {
  const mig = fs.readFileSync(`migrations/${migrationFile}`, 'utf8')
  check(/CREATE TABLE IF NOT EXISTS coach_prompt_engagement/.test(mig),
    `migrations/${migrationFile}: does not create coach_prompt_engagement`)
  check(/REFERENCES users\(id\) ON DELETE CASCADE/.test(mig),
    `migrations/${migrationFile}: user_id should FK to users(id) ON DELETE CASCADE, matching the rest of this schema`)
  check(!/UNIQUE|PRIMARY KEY \(user_id/.test(mig.replace(/id\s+bigserial\s+PRIMARY KEY/, '')),
    `migrations/${migrationFile}: this must stay append-only (no uniqueness on user_id) -- the repeatable topic-close trigger can legitimately fire more than once for the same account`)
}

const CODES = 'src/coach-prompt-codes.js'
const codes = fs.readFileSync(CODES, 'utf8')
for (const code of ['employment_status', 'search_intake', 'opportunity_archive', 'life_events_thin']) {
  check(codes.includes(`'${code}'`), `${CODES}: PROMPT_CODES is missing '${code}'`)
}
for (const trig of ['hub_arrival', 'model_detected', 'topic_close_tap', 'topic_close_language']) {
  check(codes.includes(`'${trig}'`), `${CODES}: TRIGGER_TYPES is missing '${trig}'`)
}
check(/export const PROMPT_OUTCOMES = \['shown', 'accepted', 'declined'\]/.test(codes),
  `${CODES}: PROMPT_OUTCOMES has drifted from ['shown', 'accepted', 'declined']`)
check(!codes.includes("'no_response'"),
  `${CODES}: no_response should never be a written outcome -- it is derived (shown minus accepted+declined) at query time, not stored`)

const ENDPOINT = 'api/coach-prompt-engagement.js'
const endpoint = fs.readFileSync(ENDPOINT, 'utf8')
check(endpoint.includes("import { PROMPT_CODES, TRIGGER_TYPES, PROMPT_OUTCOMES } from '../src/coach-prompt-codes.js'"),
  `${ENDPOINT}: does not import the canonical bounded lists -- validation could silently drift from src/coach-prompt-codes.js`)
check(endpoint.includes("if (req.method !== 'POST')"), `${ENDPOINT}: not POST-only`)
check(endpoint.includes('PROMPT_CODES.includes(promptCode)') && endpoint.includes('TRIGGER_TYPES.includes(triggerType)') && endpoint.includes('PROMPT_OUTCOMES.includes(outcome)'),
  `${ENDPOINT}: does not validate all three fields against their bounded lists`)
check(endpoint.includes('getSessionUser') && endpoint.includes("res.status(401)"),
  `${ENDPOINT}: not signed-in-only`)
check(/INSERT INTO coach_prompt_engagement/.test(endpoint) && !/ON CONFLICT/.test(endpoint),
  `${ENDPOINT}: insert should carry no ON CONFLICT clause -- every firing is its own row, including repeats`)
check(!endpoint.includes('feature-flags') && !endpoint.includes('hasCloseReasonCapture'),
  `${ENDPOINT}: this endpoint stores no content (just a prompt_code and an outcome), so it should not be gated behind a feature flag the way pursuit-close-reason.js is`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// The client helper + the checkinKey -> {code, trigger} lookup table.
check(/const logPromptEngagement=\(promptCode,triggerType,outcome\)=>\{/.test(app),
  `${APP}: logPromptEngagement helper is missing`)
check(app.includes("fetch('/api/coach-prompt-engagement'"),
  `${APP}: logPromptEngagement does not call the engagement endpoint`)
const metaMapIdx = app.indexOf('const PROMPT_ENGAGEMENT_META_BY_CHECKIN=')
check(metaMapIdx !== -1, `${APP}: PROMPT_ENGAGEMENT_META_BY_CHECKIN is missing`)
const metaMapBlock = metaMapIdx !== -1 ? app.slice(metaMapIdx, metaMapIdx + 550) : ''
check(metaMapBlock.includes("'employment-status':{code:'employment_status',trigger:'hub_arrival'}"),
  `${APP}: PROMPT_ENGAGEMENT_META_BY_CHECKIN is missing or has drifted for employment-status`)
check(metaMapBlock.includes("'opportunity-archive':{code:'opportunity_archive',trigger:'model_detected'}"),
  `${APP}: PROMPT_ENGAGEMENT_META_BY_CHECKIN is missing or has drifted for opportunity-archive`)
check(metaMapBlock.includes("'life-events-thin-hub':{code:'life_events_thin',trigger:'hub_arrival'}") && metaMapBlock.includes("'life-events-thin-tap':{code:'life_events_thin',trigger:'topic_close_tap'}") && metaMapBlock.includes("'life-events-thin-lang':{code:'life_events_thin',trigger:'topic_close_language'}"),
  `${APP}: PROMPT_ENGAGEMENT_META_BY_CHECKIN is missing one of the three life-events-thin trigger variants`)
check(!metaMapBlock.includes("'search-intake'"),
  `${APP}: search-intake should NOT be in this map -- its accept event is logged where the model judges an answer substantive (Chat.jsx), not off a tap on this key`)

// The generic dispatcher: one dispatch point at the top of
// handleEmploymentQuickReply, correctly deriving accepted/declined from
// whether the tapped value was an explicit dismiss.
const dispatcherIdx = app.indexOf('const handleEmploymentQuickReply=async(checkinKey,value)=>{')
check(dispatcherIdx !== -1, `${APP}: handleEmploymentQuickReply is missing`)
const dispatcherBlock = dispatcherIdx !== -1 ? app.slice(dispatcherIdx, dispatcherIdx + 2000) : ''
check(dispatcherBlock.includes('const engMeta=PROMPT_ENGAGEMENT_META_BY_CHECKIN[checkinKey]') && dispatcherBlock.includes("if(engMeta)logPromptEngagement(engMeta.code,engMeta.trigger,value==='dismiss'?'declined':'accepted')"),
  `${APP}: the generic engagement-logging dispatch is missing from the top of handleEmploymentQuickReply`)

// Topic-close signal 1 (tap-confirm): fires off any OTHER accepted tap,
// respects the fire cap, never self-triggers, never stacks with a pending
// offer, only while the field is still thin.
check(dispatcherBlock.includes("!LIFE_EVENTS_THIN_CHECKIN_KEYS.includes(checkinKey)"),
  `${APP}: topic-close signal 1 can fire off its own life-events-thin taps -- missing the self-trigger guard`)
check(dispatcherBlock.includes('wc(profile.lifeEvents)<THIN_MIN.life'),
  `${APP}: topic-close signal 1 does not check that Life Events is actually still thin`)
check(dispatcherBlock.includes('lifeEventsThinTopicCloseCount<LIFE_EVENTS_THIN_TOPIC_CLOSE_CAP'),
  `${APP}: topic-close signal 1 does not respect the fire cap`)
check(dispatcherBlock.includes("logPromptEngagement('life_events_thin','topic_close_tap','shown')"),
  `${APP}: topic-close signal 1 does not log its own 'shown' event`)

// Bounded checkinKey list + message builder + fire cap constant.
check(app.includes("const LIFE_EVENTS_THIN_CHECKIN_KEYS=['life-events-thin-hub','life-events-thin-tap','life-events-thin-lang']"),
  `${APP}: LIFE_EVENTS_THIN_CHECKIN_KEYS is missing or has drifted`)
check(app.includes('const LIFE_EVENTS_THIN_TOPIC_CLOSE_CAP=2'),
  `${APP}: LIFE_EVENTS_THIN_TOPIC_CLOSE_CAP is missing or is no longer 2`)
check(/const lifeEventsThinPromptMessage=\(checkinKey\)=>\(\{role:'assistant',content:.*quickReplies:\[\{label:'Sure, let\\'s add one'/.test(app),
  `${APP}: lifeEventsThinPromptMessage is missing, or no longer offers a real accept/decline choice`)

// The write-path branch: nothing to persist on 'accept' itself -- the
// engagement log entry is the only durable effect of this specific tap.
check(app.includes('if(LIFE_EVENTS_THIN_CHECKIN_KEYS.includes(checkinKey))return true'),
  `${APP}: the life-events-thin write-path branch is missing from handleEmploymentQuickReply`)

// State + both hydration paths + the autosave blob/deps -- the established
// one-time-disclosure wiring pattern, generalized to a counter for the
// repeatable topic-close variant.
check(app.includes("const[seenLifeEventsThinHub,setSeenLifeEventsThinHub]=useState(false)"),
  `${APP}: seenLifeEventsThinHub useState declaration is missing`)
check(app.includes("const[lifeEventsThinTopicCloseCount,setLifeEventsThinTopicCloseCount]=useState(0)"),
  `${APP}: lifeEventsThinTopicCloseCount useState declaration is missing`)
const hubHydrationHits = (app.match(/if\(d\.seenLifeEventsThinHub\)setSeenLifeEventsThinHub\(true\)/g) || []).length
check(hubHydrationHits === 2, `${APP}: expected seenLifeEventsThinHub hydration in both the local pe_v4 path and the server profile/load path, found ${hubHydrationHits}`)
const countHydrationHits = (app.match(/if\(Number\.isFinite\(d\.lifeEventsThinTopicCloseCount\)\)setLifeEventsThinTopicCloseCount\(Number\(d\.lifeEventsThinTopicCloseCount\)\)/g) || []).length
check(countHydrationHits === 2, `${APP}: expected lifeEventsThinTopicCloseCount hydration in both hydration paths, found ${countHydrationHits}`)
const saveBlobIdx = app.indexOf('const blob=JSON.stringify(')
const saveBlobBlock = app.slice(saveBlobIdx, saveBlobIdx + 700)
check(saveBlobBlock.includes('seenLifeEventsThinHub') && saveBlobBlock.includes('lifeEventsThinTopicCloseCount'),
  `${APP}: seenLifeEventsThinHub/lifeEventsThinTopicCloseCount are missing from the autosave blob's JSON.stringify -- neither would actually persist`)
const saveDepsIdx = app.indexOf('saveRef.current=save')
const saveDepsBlock = app.slice(saveDepsIdx, saveDepsIdx + 700)
check(saveDepsBlock.includes('seenLifeEventsThinHub') && saveDepsBlock.includes('lifeEventsThinTopicCloseCount'),
  `${APP}: seenLifeEventsThinHub/lifeEventsThinTopicCloseCount are missing from the autosave effect's dependency array -- a change to either would not trigger a save`)

// The hub_arrival firing effect: gated on hasOnboardingConcierge, yields to
// every higher-priority same-visit prompt in the established order.
const hubEffectIdx = app.indexOf('lifeEventsThinHubFiredRef.current=true')
check(hubEffectIdx !== -1, `${APP}: the life-events-thin hub_arrival effect is missing`)
const hubEffectBlock = hubEffectIdx !== -1 ? app.slice(hubEffectIdx - 900, hubEffectIdx + 300) : ''
check(hubEffectBlock.includes('if(!hasOnboardingConcierge)return'),
  `${APP}: the hub_arrival variant is not gated on hasOnboardingConcierge`)
check(hubEffectBlock.includes('wc(profile.lifeEvents)>=THIN_MIN.life||seenLifeEventsThinHub||lifeEventsThinHubFiredRef.current'),
  `${APP}: the hub_arrival variant's thinness/one-shot guard is missing or has drifted`)
check(hubEffectBlock.includes("employmentPromptFiredRef.current||(!employmentStatus&&!seenEmploymentPrompt)") && hubEffectBlock.includes('searchIntakePromptFiredRef.current||(!searchGoingWell&&!searchFocus&&!seenSearchIntakePrompt)'),
  `${APP}: the hub_arrival variant does not yield to the employment/search-intake prompts in the established priority order`)
check(hubEffectBlock.includes("logPromptEngagement('life_events_thin','hub_arrival','shown')"),
  `${APP}: the hub_arrival variant does not log its own 'shown' event`)

// 'shown' logging retrofitted onto the two existing hub_arrival prompts.
check(app.includes("logPromptEngagement('employment_status','hub_arrival','shown')"),
  `${APP}: employment-status's hub_arrival effect does not log 'shown'`)
check(app.includes("logPromptEngagement('search_intake','hub_arrival','shown')"),
  `${APP}: search-intake's hub_arrival effect does not log 'shown'`)

// All three Chat mounts carry the three new props identically (2026-09-07:
// embedded myCoach panel, floating bubble, concierge orientation panel).
const mountHits = (app.match(/lifeEventsThinTriggerActive=\{hasOnboardingConcierge&&!isIndependent&&wc\(profile\.lifeEvents\)<THIN_MIN\.life&&lifeEventsThinTopicCloseCount<LIFE_EVENTS_THIN_TOPIC_CLOSE_CAP\} lifeEventsThinOfferMessage=\{hasOnboardingConcierge\?lifeEventsThinPromptMessage\('life-events-thin-lang'\):null\} onLifeEventsThinTopicClose=\{\(\)=>setLifeEventsThinTopicCloseCount\(c=>c\+1\)\}/g) || []).length
check(mountHits === 3, `${APP}: expected the three life-events-thin props at all three <Chat> mount sites (embedded myCoach, floating, concierge orientation), found ${mountHits}`)

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

check(chat.includes('lifeEventsThinTriggerActive = false, lifeEventsThinOfferMessage = null, onLifeEventsThinTopicClose = null,'),
  `${CHAT}: Chat no longer accepts the three life-events-thin props with the expected defaults`)
check(/const CLOSING_LANGUAGE_RE = \//.test(chat),
  `${CHAT}: CLOSING_LANGUAGE_RE is missing`)
check(/const logPromptEngagement = \(promptCode, triggerType, outcome\) => \{/.test(chat),
  `${CHAT}: Chat's own local logPromptEngagement helper is missing`)
check(chat.includes('const lifeEventsThinLangFiredRef = useRef(false)'),
  `${CHAT}: the session-local fire-once guard for topic-close signal 2 is missing`)

const sig2Idx = chat.indexOf('const lifeEventsThinPending =')
check(sig2Idx !== -1, `${CHAT}: topic-close signal 2's firing block is missing`)
const sig2Block = sig2Idx !== -1 ? chat.slice(sig2Idx, sig2Idx + 900) : ''
check(sig2Block.includes('userMsg.content.length < priorCoachReply.content.length'),
  `${CHAT}: signal 2 does not compare the user's message length against Coach's preceding reply -- the pairing that makes this closing language, not just a thank-you mid-conversation`)
check(sig2Block.includes('CLOSING_LANGUAGE_RE.test(userMsg.content)'),
  `${CHAT}: signal 2 does not test the closing-language regex against the user's message`)
check(sig2Block.includes("logPromptEngagement('life_events_thin', 'topic_close_language', 'shown')"),
  `${CHAT}: signal 2 does not log its own 'shown' event`)
check(sig2Block.includes('if (onLifeEventsThinTopicClose) onLifeEventsThinTopicClose()'),
  `${CHAT}: signal 2 does not call back into App.jsx to bump the persisted fire-cap counter -- the cap would never actually count this firing`)

// 'shown'/'accepted' logging retrofitted onto opportunity-archive and
// search-intake's own real offer-render sites (not the search-intake
// opener, which has no accept/decline UI at all).
check(chat.includes("logPromptEngagement('opportunity_archive', 'model_detected', 'shown')"),
  `${CHAT}: the opportunity-archive offer does not log 'shown' when it renders`)
check(chat.includes("logPromptEngagement('search_intake', 'hub_arrival', 'accepted')"),
  `${CHAT}: the search-intake offer does not log 'accepted' -- reaching this point is the model's own judgment that the person actually answered`)

if (failures) {
  console.error(`test-coach-prompt-engagement: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-prompt-engagement: OK (append-only shown/accepted/declined log with no flag needed, bounded prompt_code/trigger_type/outcome vocabulary, retrofitted onto employment-status/search-intake/opportunity-archive, new Life Events thinness prompt with hub_arrival + two zero-prompt-cost topic-close signals sharing one combined fire cap, both Chat mounts wired identically)')
}
