// Guards the collapsed-narration transcript treatment (2026-09-04, reported
// live): with several banner:true narration messages ("here's what's
// coming" lines) now piling up in the open transcript one after another,
// the newest, currently-relevant one was competing for attention with
// everything Coach had already said and moved past. A banner:true message
// collapses to a thin, one-line strip once anything has been said after it
// -- present, not deleted (nothing is removed from `messages`), expandable
// on tap. The most recent message is never collapsed, whatever it is.
// Source-level for the same reason its siblings are: this needs a real
// signed-in browser session to exercise end to end.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

check(chat.includes('const [expandedBanners, setExpandedBanners] = useState(() => new Set())'),
  `${CHAT}: expandedBanners state is missing`)
check(chat.includes('const toggleBannerExpanded = i => setExpandedBanners(prev => {'),
  `${CHAT}: toggleBannerExpanded is missing`)

// The collapse condition itself: a banner (or intro) message collapses only
// once it is no longer the last message, and only until the person taps it
// open again.
check(chat.includes('const isCollapsedBanner = (m.banner || m.intro) && i < messages.length - 1 && !expandedBanners.has(i)'),
  `${CHAT}: isCollapsedBanner is missing or no longer requires banner:true/intro:true, a later message present, and not already expanded -- any of those loosening would collapse the wrong messages (a real answer, the current tail, or one the person just opened)`)

// The generic "Hi, I'm your coach" greeting (2026-09-05, reported live):
// opted into the same collapse treatment via intro:true rather than
// banner:true, since banner:true also feeds the closed-bubble preview-card
// effect and the greeting should not pop up as a card on every mount.
check(chat.includes("export const INTRO_MSG = { role: 'assistant', intro: true, content:"),
  `${CHAT}: INTRO_MSG lost its intro:true flag -- it would no longer collapse once superseded`)
check(chat.includes('const latest = [...added].reverse().find(m => m.banner)'),
  `${CHAT}: the closed-bubble preview-card effect should still key on banner:true only, not intro -- the greeting should never pop up as a card`)

// Nothing is destroyed: nothing removes an entry from `messages` to collapse
// it, and the full content (m.content) is still what renders once expanded
// -- collapsing is a render decision, not a data decision.
const collapsedIdx = chat.indexOf('isCollapsedBanner ? (')
check(collapsedIdx !== -1, `${CHAT}: the collapsed/expanded render branch is missing`)
const collapsedBlock = chat.slice(collapsedIdx, collapsedIdx + 700)
check(collapsedBlock.includes('onClick={() => toggleBannerExpanded(i)}'),
  `${CHAT}: the collapsed strip lost its tap-to-expand handler`)
check(collapsedBlock.includes('{m.content}'),
  `${CHAT}: the collapsed strip no longer shows the message's own content -- it should be a truncated preview of the real text, not placeholder copy`)

// The collapsed strip is itself a tappable control, so its text is under the
// 16px tappable-label floor (CLAUDE.md), not the 15px floor for plain text.
check(collapsedBlock.includes('fontSize: 16, color: \'#8A9BB8\''),
  `${CHAT}: the collapsed strip's text dropped below the 16px tappable-label floor`)

// Quick replies must not render on a collapsed message -- there is nothing
// to reply to until it is reopened, and the guard is what stops a stray
// quick-reply row from appearing detached from its own bubble.
check(chat.includes('{!isCollapsedBanner && m.role === \'assistant\' && Array.isArray(m.quickReplies)'),
  `${CHAT}: quick replies are no longer gated on !isCollapsedBanner -- they could render detached from a collapsed bubble`)

// Re-collapse control (2026-09-05, reported live): the strip's own tap
// toggled expandedBanners both ways, but nothing on the expanded bubble
// called it back -- a superseded message opened once had no way back to its
// one-line strip. isExpandableBanner is the same eligibility as
// isCollapsedBanner with the expanded check dropped, so it stays true
// whichever way the toggle currently sits.
check(chat.includes('const isExpandableBanner = (m.banner || m.intro) && i < messages.length - 1'),
  `${CHAT}: isExpandableBanner is missing -- there is no way to compute re-collapse eligibility once a banner/intro message is expanded`)
const recollapseIdx = chat.indexOf('{!isCollapsedBanner && isExpandableBanner && (')
check(recollapseIdx !== -1, `${CHAT}: the expanded-banner re-collapse control is missing`)
const recollapseBlock = recollapseIdx !== -1 ? chat.slice(recollapseIdx, recollapseIdx + 300) : ''
check(recollapseBlock.includes('onClick={() => toggleBannerExpanded(i)}'),
  `${CHAT}: the re-collapse control no longer calls toggleBannerExpanded`)
check(chat.includes('‹ Collapse'),
  `${CHAT}: the re-collapse control lost its label`)

// Already-persisted accounts have INTRO_MSG saved in localStorage from
// before intro:true existed -- the hydration path must backfill the flag by
// content match, or the fix would only ever apply to brand-new sessions.
const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')
check(app.includes("return p.map(m=>(m&&m.role==='assistant'&&m.content===INTRO_MSG.content&&!m.intro)?{...m,intro:true}:m)"),
  `${APP}: chatMessages hydration no longer backfills intro:true onto a previously-persisted INTRO_MSG -- an existing account's stale local history would never collapse`)

if (failures) {
  console.error(`test-coach-message-collapse: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-message-collapse: OK (superseded narration AND the generic intro greeting collapse to a tap-to-expand strip, nothing removed from message state, tappable-label font floor met, quick replies gated off a collapsed bubble, existing local history backfilled with intro:true)')
}
