// Guards the Coach narration banner (2026-09-04 follow-on to Coach-as-
// Concierge item 1): the onboarding "here's what's coming" / "why this
// matters" lines are narration, not a question, so they surface as a small
// dismissing card next to the closed bubble instead of forcing the full
// panel open over the very screen they are pointing the person at.
// Source-level for the same reason its siblings are -- this needs a real
// signed-in browser session to exercise end to end.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// Both narration-only messages carry banner:true. Losing either regresses
// straight back to "Coach sits on top of the field it just told the person
// to use."
check(app.includes("{role:'assistant',banner:true,content:`Welcome — I'm glad you're here."),
  `${APP}: the first-arrival framing message lost its banner:true flag`)
check(app.includes("{role:'assistant',banner:true,content:line}"),
  `${APP}: the per-step narration message lost its banner:true flag`)

// Neither effect force-opens the full panel any more -- banner:true alone
// does nothing if a setPbCheckinOpenReq bump is still sitting right next to
// where the message gets pushed.
const framingIdx = app.indexOf('onboardingFramingFiredRef.current=true')
check(framingIdx !== -1, `${APP}: could not find the framing effect's fire marker`)
const framingBlock = app.slice(framingIdx, framingIdx + 700)
check(!framingBlock.includes('setPbCheckinOpenReq'),
  `${APP}: the framing effect still force-opens the full panel`)

const narrationIdx = app.indexOf('narratedOrientationStepsFiredRef.current.add(step)')
check(narrationIdx !== -1, `${APP}: could not find the per-step narration effect's fire marker`)
const narrationBlock = app.slice(narrationIdx, narrationIdx + 300)
check(!narrationBlock.includes('setPbCheckinOpenReq'),
  `${APP}: the per-step narration effect still force-opens the full panel`)

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

check(chat.includes('const [bannerMsg, setBannerMsg] = useState(null)'),
  `${CHAT}: bannerMsg state is missing`)
// 2026-09-07 (live QA on a genuinely fresh signup): detection compares the
// previous LAST message by reference, not array length. A length-only
// comparison missed the framing effect's same-length REPLACE of the
// untouched seed message (below), so the very first Coach narration never
// rendered for a real new signup.
check(chat.includes('const bannerPrevLastRef = useRef(null)'),
  `${CHAT}: the banner-detection effect no longer tracks the previous last message -- reverting to a length-only comparison would miss the framing effect's same-length replace of the seed message`)
check(chat.includes('if (open || !last || last === prevLast || !last.banner) return'),
  `${CHAT}: the banner-detection effect lost its identity/open/flag guard`)
// No auto-dismiss timer (2026-09-04, reported live): a fixed timeout could
// hide the card before someone had actually read it, with no way to bring
// it back short of opening the full panel and scrolling. The card now stays
// until the person dismisses it or opens the panel -- pin the ABSENCE of a
// timer so it does not quietly come back.
check(!chat.includes('setTimeout(() => setBannerMsg(null)'),
  `${CHAT}: the banner has an auto-dismiss timer again -- it can hide guidance before the person has read it, with no way to bring it back (this is the exact live-reported failure this fixed)`)
check(!chat.includes('bannerTimerRef'),
  `${CHAT}: bannerTimerRef is back -- the banner should have no auto-dismiss mechanism`)
const openClearIdx = chat.indexOf('useEffect(() => {\n    if (!open) return\n    setBannerMsg(null)')
check(openClearIdx !== -1,
  `${CHAT}: opening the panel no longer clears the banner -- it would linger behind the open panel and reappear on close`)

// The banner card is itself clickable (its onClick opens the panel), so its
// text counts as a tappable label under the 16px floor, not the 15px floor
// for plain text -- scripts/check-fontsize.mjs enforces this generically,
// but pin the two banner-specific sites directly since a regression here is
// easy to miss in a diff.
check(chat.includes('fontSize: 16, fontWeight: 700, color: C.gold, textTransform: \'uppercase\''),
  `${CHAT}: the banner's "Coach" label dropped below the 16px tappable-label floor`)
check(chat.includes("fontSize: 16, color: '#1A2540', lineHeight: 1.5,"),
  `${CHAT}: the banner's message text dropped below the 16px tappable-label floor`)

// Clicking the card (not just some inner element) opens the panel, and a
// dedicated dismiss control stops propagation so it does not also open it.
check(chat.includes('onClick={() => setOpen(true)}') ,
  `${CHAT}: the banner card lost its click-to-open handler`)
check(chat.includes("onClick={e => { e.stopPropagation(); setBannerMsg(null) }}"),
  `${CHAT}: the banner's dismiss button no longer stops propagation -- dismissing would also open the panel`)

// Two "hello" bubbles stacked (2026-09-04, reported live): the generic
// INTRO_MSG was always seeded first, and the framing effect always appended
// after it, so a flagged account saw both on arrival. INTRO_MSG is now the
// single shared source (App.jsx seeds chatMessages from it, no longer a
// second hardcoded copy of the same string), and the framing effect
// REPLACES it rather than appending, when the chat is still exactly that
// untouched seed.
check(chat.includes('export const INTRO_MSG ='),
  `${CHAT}: INTRO_MSG is no longer exported -- App.jsx cannot import the single source of truth for the intro text`)
check(app.includes('import Chat, { INTRO_MSG } from "./components/Chat"'),
  `${APP}: App.jsx no longer imports INTRO_MSG from Chat.jsx -- it may have reverted to a second hardcoded copy of the intro text, which is exactly the drift that caused the double-stack`)
check(app.includes('return[INTRO_MSG]'),
  `${APP}: chatMessages no longer seeds from the shared INTRO_MSG constant`)
check(app.includes("setChatMessages(m=>(m.length===1&&m[0]&&m[0].role==='assistant'&&!m[0].banner&&m[0].content===INTRO_MSG.content)?[framingMsg]:[...m,framingMsg])"),
  `${APP}: the framing effect no longer replaces an untouched intro-only chat with the framing message -- it would append after INTRO_MSG again, stacking two "hello" bubbles on arrival`)

// "See how this works" (2026-09-07): gated on hasOnboardingConcierge, not
// removed outright. Coach's framing message says the same thing out loud
// for a flagged account, so the static duplicate is redundant there -- but
// the other 144 accounts have no Coach narration doing that job yet, and
// would lose their only explanation of how the product works if this
// disappeared for everyone.
const seeHowIdx = app.indexOf("<span style={{fontSize:18,fontWeight:700,color:'#1A2540'}}>See how this works</span>")
check(seeHowIdx !== -1, `${APP}: could not find the "See how this works" section`)
const seeHowGateBlock = app.slice(Math.max(0, seeHowIdx - 500), seeHowIdx)
check(seeHowGateBlock.includes('{!hasOnboardingConcierge&&<div'),
  `${APP}: "See how this works" is not gated on !hasOnboardingConcierge -- it would either vanish for all 145 accounts (most of whom get no Coach narration to replace it) or keep showing redundantly for the pilot`)

// "Coach is thinking" indicator (2026-09-04, reported live): a small dot on
// the closed bubble, visible for as long as an orientation-check request is
// in flight, so a reaction that lands after the person has already moved on
// does not arrive with zero warning it was ever coming.
check(chat.includes('thinking = false'),
  `${CHAT}: the thinking prop is missing from Chat's destructured props`)
const thinkingDotIdx = chat.indexOf('{thinking && (')
check(thinkingDotIdx !== -1, `${CHAT}: the thinking-dot render block is missing`)
const thinkingDotBlock = chat.slice(thinkingDotIdx, thinkingDotIdx + 600)
check(thinkingDotBlock.includes("aria-hidden=\"true\""),
  `${CHAT}: the thinking dot is missing aria-hidden -- it is decorative, and the button's own aria-label already carries the same information for a screen reader`)
check(thinkingDotBlock.includes('pe-chat-thinking-dot'),
  `${CHAT}: the thinking dot lost its pulse animation`)
check(chat.includes("aria-label={thinking ? 'Coach is thinking. Open My Coach'"),
  `${CHAT}: the closed bubble's aria-label no longer announces "Coach is thinking" for a screen reader when a check is in flight`)
check(app.includes('thinking={coachThinkingCount>0}'),
  `${APP}: coachThinkingCount is not passed through as the thinking prop -- check both <Chat> call sites if this fails`)
// Three mounts as of 2026-09-07 (myCoach embedded, the floating bubble, and
// the concierge orientation-flow embedded panel) -- see
// test-coach-embedded-orientation.mjs for the third mount's own coverage.
const thinkingMountHits = (app.match(/thinking=\{coachThinkingCount>0\}/g) || []).length
check(thinkingMountHits === 3,
  `${APP}: expected thinking={coachThinkingCount>0} passed at all three <Chat> call sites -- found ${thinkingMountHits}`)

if (failures) {
  console.error(`test-coach-banner: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-banner: OK (narration messages flagged banner:true and no longer force the panel open, Chat.jsx detects and renders the dismissing banner card, font sizes meet the tappable-label floor, framing message replaces rather than stacks on the untouched intro)')
}
