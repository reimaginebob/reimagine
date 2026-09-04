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
check(chat.includes('const latest = [...added].reverse().find(m => m.banner)'),
  `${CHAT}: the banner-detection effect no longer looks for banner-flagged messages`)
check(chat.includes('if (len <= prevLen || open) return'),
  `${CHAT}: the banner-detection effect lost its growth/open guard -- it would fire on every render or override an already-open panel`)
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

if (failures) {
  console.error(`test-coach-banner: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-banner: OK (narration messages flagged banner:true and no longer force the panel open, Chat.jsx detects and renders the dismissing banner card, font sizes meet the tappable-label floor)')
}
