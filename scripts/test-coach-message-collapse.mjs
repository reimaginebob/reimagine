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

// The collapse condition itself: a banner message collapses only once it is
// no longer the last message, and only until the person taps it open again.
check(chat.includes('const isCollapsedBanner = m.banner && i < messages.length - 1 && !expandedBanners.has(i)'),
  `${CHAT}: isCollapsedBanner is missing or no longer requires banner:true, a later message present, and not already expanded -- any of those three loosening would collapse the wrong messages (a real answer, the current tail, or one the person just opened)`)

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

if (failures) {
  console.error(`test-coach-message-collapse: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-message-collapse: OK (superseded narration collapses to a tap-to-expand strip, nothing removed from message state, tappable-label font floor met, quick replies gated off a collapsed bubble)')
}
