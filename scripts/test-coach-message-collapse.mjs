// Guards the collapsed transcript treatment. Originally scoped to banner:true
// narration ("here's what's coming" lines, 2026-09-04 live report): with
// several piling up in the open transcript one after another, the newest,
// currently-relevant one was competing for attention with everything Coach
// had already said and moved past. Extended 2026-09-17 to EVERY message,
// not just banner/intro: a long My Coach session of ordinary questions and
// replies stacked full-height indefinitely with no way to shrink what was
// already read. Any message collapses to a thin, one-line strip once
// something has been said after it -- present, not deleted (nothing is
// removed from `messages`), expandable on tap. The most recent message is
// never collapsed, whatever it is -- and while a reply is still generating,
// "most recent" holds at the question just sent, not just its still-empty
// placeholder (2026-09-18 live fix; see collapseFloor below).
// Source-level for the same reason its siblings are: this needs a real
// signed-in browser session to exercise end to end.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

check(chat.includes('const [expandedMessages, setExpandedMessages] = useState(() => new Set())'),
  `${CHAT}: expandedMessages state is missing`)
check(chat.includes('const toggleMessageExpanded = i => setExpandedMessages(prev => {'),
  `${CHAT}: toggleMessageExpanded is missing`)

// The collapse condition itself applies to every message now, not just
// banner/intro: it collapses only once it is behind the collapse floor,
// only until the person taps it open again, and never while it carries live
// unresolved quick-reply taps.
check(chat.includes('const isCollapsedMessage = i < collapseFloor && !expandedMessages.has(i) && !hasLiveTaps'),
  `${CHAT}: isCollapsedMessage is missing or no longer requires a position behind collapseFloor, not already expanded, and no live taps -- any of those loosening would collapse the wrong messages (the current tail, one the person just opened, or a message with an unresolved action)`)

// The collapse floor itself (2026-09-18, reported live): send() appends the
// question and its reply's empty placeholder in the same update, so a naive
// "last index never collapses" rule let the person's own just-sent question
// collapse to a strip the instant they hit Send, before any reply existed to
// read it in. While the trailing assistant placeholder is still empty and
// loading, the floor holds at the question two positions back, not one.
check(chat.includes('const pendingReply = loading && lastMsg && lastMsg.role === \'assistant\' && !lastMsg.content'),
  `${CHAT}: pendingReply detection is missing -- an in-flight reply's placeholder is empty until the whole reply arrives in one write, so this is how a just-sent question is told apart from a truly superseded one`)
check(chat.includes('const collapseFloor = pendingReply ? messages.length - 2 : messages.length - 1'),
  `${CHAT}: collapseFloor no longer holds two positions back during a pending reply -- the just-sent question would collapse the instant Send is tapped`)

// The generic "Hi, I'm your coach" greeting (2026-09-05, reported live):
// opted into the same collapse treatment via intro:true rather than
// banner:true, since banner:true also feeds the closed-bubble preview-card
// effect and the greeting should not pop up as a card on every mount. That
// distinction still matters for the preview-card effect even though the
// collapse condition itself no longer keys on banner/intro at all.
check(chat.includes("export const INTRO_MSG = { role: 'assistant', intro: true, content:"),
  `${CHAT}: INTRO_MSG lost its intro:true flag`)
check(chat.includes('if (open || !last || last === prevLast || !last.banner) return'),
  `${CHAT}: the closed-bubble preview-card effect should still key on banner:true only, not intro -- the greeting should never pop up as a card`)

// Nothing is destroyed: nothing removes an entry from `messages` to collapse
// it, and the strip shows a preview built from the message's own content --
// collapsing is a render decision, not a data decision.
const collapsedIdx = chat.indexOf('isCollapsedMessage ? (')
check(collapsedIdx !== -1, `${CHAT}: the collapsed/expanded render branch is missing`)
const collapsedBlock = chat.slice(collapsedIdx, collapsedIdx + 700)
check(collapsedBlock.includes('onClick={() => toggleMessageExpanded(i)}'),
  `${CHAT}: the collapsed strip lost its tap-to-expand handler`)
check(collapsedBlock.includes('{stripPreview}'),
  `${CHAT}: the collapsed strip no longer renders the computed preview -- it should be a truncated preview of the real text, not placeholder copy`)

// Banner/intro narration keeps its own content verbatim in the strip; a
// regular Q&A message gets a role-prefixed, truncated preview instead of its
// full text (which for a real Coach reply or question is far too long for a
// one-line strip).
check(chat.includes('const stripPreview = (m.banner || m.intro)') && chat.includes('? m.content'),
  `${CHAT}: banner/intro messages should still show their own content verbatim in the strip`)
check(/role === 'assistant' \? 'Coach' : 'You'/.test(chat),
  `${CHAT}: the regular-message strip preview lost its role prefix (Coach: / You:)`)

// The collapsed strip is itself a tappable control, so its text is under the
// 16px tappable-label floor (CLAUDE.md), not the 15px floor for plain text.
check(collapsedBlock.includes('fontSize: 16, color: \'#8A9BB8\''),
  `${CHAT}: the collapsed strip's text dropped below the 16px tappable-label floor`)

// Quick replies and the rating/comment row must not render on a collapsed
// message -- there is nothing to reply to or rate until it is reopened, and
// the guard is what stops either from appearing detached from its own
// bubble.
check(chat.includes('{!isCollapsedMessage && m.role === \'assistant\' && Array.isArray(m.quickReplies)'),
  `${CHAT}: quick replies are no longer gated on !isCollapsedMessage -- they could render detached from a collapsed bubble`)
check(chat.includes("{!isCollapsedMessage && m.role === 'assistant' && m.id && ("),
  `${CHAT}: the rating/comment row is no longer gated on !isCollapsedMessage -- it could render detached from a collapsed bubble`)

// Re-collapse control (2026-09-05, reported live): the strip's own tap
// toggled expandedMessages both ways, but nothing on the expanded bubble
// called it back -- a superseded message opened once had no way back to its
// one-line strip. isExpandableMessage is the same eligibility as
// isCollapsedMessage with the expanded check dropped, so it stays true
// whichever way the toggle currently sits.
check(chat.includes('const isExpandableMessage = i < collapseFloor && !hasLiveTaps'),
  `${CHAT}: isExpandableMessage is missing -- there is no way to compute re-collapse eligibility once a message is expanded`)
const recollapseIdx = chat.indexOf('{!isCollapsedMessage && isExpandableMessage && (')
check(recollapseIdx !== -1, `${CHAT}: the expanded-message re-collapse control is missing`)
const recollapseBlock = recollapseIdx !== -1 ? chat.slice(recollapseIdx, recollapseIdx + 300) : ''
check(recollapseBlock.includes('onClick={() => toggleMessageExpanded(i)}'),
  `${CHAT}: the re-collapse control no longer calls toggleMessageExpanded`)
check(chat.includes('‹ Collapse'),
  `${CHAT}: the re-collapse control lost its label`)

// Already-persisted accounts have INTRO_MSG saved in localStorage from
// before intro:true existed -- the hydration path must backfill the flag by
// content match, or the fix would only ever apply to brand-new sessions.
const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')
check(app.includes("return(e&&e.role==='assistant'&&e.content===INTRO_MSG.content&&!e.intro)?{...e,intro:true}:e})"),
  `${APP}: chatMessages hydration no longer backfills intro:true onto a previously-persisted INTRO_MSG -- an existing account's stale local history would never collapse`)

if (failures) {
  console.error(`test-coach-message-collapse: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-message-collapse: OK (every message type collapses to a tap-to-expand strip once superseded, nothing removed from message state, tappable-label font floor met, quick replies and the rating row gated off a collapsed bubble, existing local history backfilled with intro:true)')
}
