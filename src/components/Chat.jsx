import { useState, useEffect, useRef } from 'react'
import MD from './MD'
import SpeechBtn, { hasSpeech } from './SpeechBtn'
import { useIsMobile } from '../use-is-mobile.js'
import { detectVoiceViolations } from '../voice-patterns.js'
import { PURSUIT_STAGE_LABELS } from '../pursuit-stages.js'
import { OP_COUNTED_SECTIONS } from '../playbook-sections.js'
import { CLOSE_REASON_LABEL } from '../pursuit-close-reasons.js'

// intro: true opts this one message into the same collapse-to-strip
// treatment as banner:true narration (see isCollapsedBanner below) without
// also feeding the closed-bubble preview-card effect, which keys on
// banner:true specifically -- this is the generic greeting, not a "here's
// what's coming" line worth surfacing as a popup.
export const INTRO_MSG = { role: 'assistant', intro: true, content: "Hi, I'm your coach. Ask me anything about your search — where to focus, how to tell your story, how to prepare for a conversation — and I'll work from what Reimagine already knows about you." }

// Plain-language employment mentions. Deliberately conservative: it gates only
// WHETHER to offer the save prompt (all three options are always shown, so the
// user picks the real value). Misses some phrasings on purpose — the on-open
// prompt is the primary capture path; this is the belt-and-suspenders.
const EMPLOYMENT_MENTION_RE = /\b(i['’]?m|i am|currently|presently)\s+(employed|unemployed|between jobs|in transition|out of work|laid off|jobless|job[- ]?hunting|job[- ]?searching|looking for (a job|work|another))\b|\bmy\s+(job|role|position|contract)\b[^.?!]{0,48}\b(is ending|ends|ending soon|is up|wrapping up|being eliminated|notice period|last day)\b/i

// Plain-language pursuit-status mentions for the My Search one-tap capture.
// Conservative like the employment one: it only gates WHETHER to offer the save,
// and all stage options are shown, so a false positive is an ignorable prompt
// rather than a wrong value. Deliberately misses phrasings — the My Search card
// is the primary edit path; this is the belt-and-suspenders.
const STAGE_MENTION_RE = /\b(interview|phone screen|screening call|final round|on-?site)\b[^.?!]{0,40}\b(scheduled|booked|set up|coming up|next week|tomorrow|monday|tuesday|wednesday|thursday|friday|moved|pushed|rescheduled|happened|went|done|finished)\b|\b(got|received|have|got an)\s+(an?\s+)?(offer|rejection)\b|\b(they|it|this)\s+(passed|rejected|declined|ghosted)\b|\b(withdrew|pulled out|turned (it|them) down|accepted (the|their) offer)\b|\b(date|meeting|conversation|call)\s+(moved|changed|got pushed|rescheduled|slipped)\b/i

// Closing-language, topic-close trigger signal 2 (2026-09-07 Cowork consult:
// "measuring accept/decline patterns on profile-gap prompts"). Same
// belt-and-suspenders shape as the two regexes above: conservative on
// purpose, gates only WHETHER a low-stakes, dismissible offer appears, never
// asserts anything or feeds a model call. Paired at the call site with the
// message being shorter than Coach's own preceding reply -- a short,
// satisfied-sounding reply right after a longer answer is the actual
// "topic just wrapped" signal, not the phrase alone.
const CLOSING_LANGUAGE_RE = /\b(thanks|thank you|thx|got it|that helps|that('|’)s? helpful|makes sense|perfect|great,? thanks|sounds good|good to know|appreciate it|cool,? thanks)\b/i
// Fire-and-forget product telemetry -- see api/coach-prompt-engagement.js.
// Mirrors App.jsx's own logPromptEngagement exactly; kept local rather than
// threaded through as a prop since Chat already fetches its own endpoints
// directly (e.g. /api/pb-checkin in tapQuickReply below).
const logPromptEngagement = (promptCode, triggerType, outcome) => {
  try { fetch('/api/coach-prompt-engagement', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ promptCode, triggerType, outcome }) }).catch(() => {}) } catch {}
}

// My Coach. PROSE-ONLY on feature references (2026-06-11): the coach names a
// feature in prose ("you'll find this in Career Paths") and never renders a
// clickable navigation button. Render-true labels come from COACH_NAV_MAP in the
// prompt (api/coach.js); the silent SELFCHECK trailer still logs unmet needs.
// This removed the dead-link risk and the stale STEP_LABELS button-label map.
//
// Two doors, one engine: the floating bubble (default) and the
// embedded sidebar view (embedded=true) are the same component talking to
// /api/coach and sharing one conversation via the messages/setMessages props
// lifted to App.jsx. The embedded variant drops the fixed positioning and the
// open/close affordance and fills its container instead.
export default function Chat({ currentStep, C, showPulse, onDismissPulse, messages, setMessages, bottomOffset = 0, embedded = false, openRequest = 0, open: openProp = false, setOpen: setOpenProp = null, maximized = false, setMaximized = null, seed = '', seedAuto = false, onSeedConsumed, coachSaveTarget = null, onSaveNote, onQuickReply = null, onOpen = null, employmentCaptureActive = false, employmentOfferMessage = null, pursuitCaptureActive = false, pursuitOfferMessage = null, lifeEventsThinTriggerActive = false, lifeEventsThinOfferMessage = null, onLifeEventsThinTopicClose = null, opportunityUpdateCaptureActive = false, opportunityContextCaptureActive = false, opportunityArchiveCaptureActive = false, closeReasonCaptureActive = false, opCardReworkCaptureActive = false, valuesCaptureActive = false, assessmentCaptureActive = false, reputationCaptureActive = false, skillsCaptureActive = false, prioritiesCaptureActive = false, lifeStoryCaptureActive = false, brandReworkCaptureActive = false, sectionReworkTarget = null, activityCaptureActive = false, sessionOpenEligible = false, notesCaptureActive = false, allowGeneralMode = false, thinking = false, onVoiceViolation = null }) {
  // General-question mode (Career Club team only): ask a general/client question
  // without this account's job-search profile loaded. The toggle only renders
  // when allowGeneralMode is passed; the flag is re-checked server-side.
  const [generalMode, setGeneralMode] = useState(false)
  // Open state (2026-09-06): lifted to App.jsx, mirroring messages/setMessages
  // above -- fixes the coach silently re-collapsing on every round trip through
  // the dedicated My Coach step. That step's embedded view fully unmounts this
  // component's floating counterpart (App.jsx: `step!=='myCoach'` gates the
  // floating mount), which used to reset `open` to its initial false. A local
  // fallback state covers embedded (which never reads `open` meaningfully --
  // see the "always open" comments below) and any caller that does not pass
  // the controlled props, so this stays safe as a plain uncontrolled component
  // if setOpenProp/setMaximized are ever omitted.
  const [localOpen, setLocalOpen] = useState(false)
  const open = setOpenProp ? openProp : localOpen
  const setOpen = setOpenProp || setLocalOpen
  const [localMaximized, setLocalMaximized] = useState(false)
  const isMaximized = setMaximized ? maximized : localMaximized
  const setIsMaximized = setMaximized || setLocalMaximized
  // App bumps openRequest to open the floating coach programmatically (e.g. the
  // Personal Brand check-in on first arrival at Put it to Work).
  useEffect(() => { if (openRequest) setOpen(true) }, [openRequest])
  // Focus-return on close (accessibility audit, 2026-09-05): a keyboard or
  // screen-reader user who opens the floating coach and then closes it --
  // either the panel's own Close button or Escape, both just set open:false --
  // was left with focus fallen back to <body>, with no way to tell where they
  // landed. The trigger bubble and the open panel are two different branches
  // of one early-return, so the bubble's DOM node does not exist yet at the
  // instant either close handler fires; it exists once this component
  // re-renders into the closed branch. A single effect keyed on `open` (not a
  // .focus() call duplicated inside both close handlers) fires after that
  // render has committed, and skips the very first render via wasOpenRef --
  // there is nothing to return focus TO on initial page load, since nothing
  // was closed yet. Floating only: the embedded My Coach view has no bubble
  // and no open/close state of its own.
  const bubbleBtnRef = useRef(null)
  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (!embedded && !open && wasOpenRef.current && bubbleBtnRef.current) bubbleBtnRef.current.focus()
    wasOpenRef.current = open
  }, [open, embedded])
  // Tell the app when the floating panel opens, so it can surface a first-time
  // prompt (e.g. the employment one-tap) on coach-open, not only on a hub screen.
  // Floating only; the embedded view is always "open" and handles its own surfacing.
  useEffect(() => { if (open && !embedded && onOpen) onOpen() }, [open])
  // Below the breakpoint the floating panel renders as a bottom sheet instead;
  // see the shell further down. The embedded My Coach view is unaffected.
  const isMobile = useIsMobile()
  // Esc closes the floating panel. There is no backdrop to click and no
  // dismiss-on-outside-click, so before this the header button was the only exit
  // and a bad top edge could take it off the screen. Floating only: the embedded
  // sidebar view has no open state to toggle. The draft in `input` survives,
  // because the component stays mounted and only `open` flips.
  useEffect(() => {
    if (embedded || !open) return
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [embedded, open])
  const [input, setInput] = useState('')
  // Save-to-opportunity (PR-5, item I): transient per-reply UI state for the Copy
  // and "Save to this opportunity" actions. The save itself goes through the app
  // (onSaveNote -> setSavedPlaybooks); this component never writes.
  const [copiedId, setCopiedId] = useState(null)
  const [savedAs, setSavedAs] = useState(null)
  // Holds the latest send() so the seed effect (declared above send) can fire it
  // for seedAuto without a use-before-define; refreshed each render below.
  const sendRef = useRef(null)
  // Stop generating (accessibility/UX audit, 2026-09-05, Gap 1): holds the
  // AbortController for whichever request is currently in flight, so the
  // Send button can double as Stop while loading. Only one send() can run at
  // a time (the guard at the top of send() below returns early if loading is
  // already true), so a single ref is enough -- no collection needed.
  const abortRef = useRef(null)
  // Handle to the mic button so send() can stop an in-progress recording the
  // moment the person hits Send -- pressing Send means "I'm done talking,"
  // and leaving the mic listening after that reads as the app not noticing.
  const speechBtnRef = useRef(null)
  // The input grows with its content (2026-08-20). It was a fixed 2 rows, which
  // is fine for "how do I answer this?" and wrong for everything longer — a
  // prefilled seed or a dictated interview answer arrived scrolled to its last
  // line with no way to see the whole thing without dragging the resize handle.
  // Capped so a long message cannot eat the reply thread; past the cap it
  // scrolls. The CSS min-height holds the resting two-row size.
  const inputTaRef = useRef(null)
  // Embedded panel sizing. It used a FIXED height of min(72dvh, 720px), which
  // was wrong in both directions: with a short conversation most of the panel
  // was empty scroll area, and because the height took no account of the page
  // header sitting above it (title, description, the never-looks-you-up note —
  // roughly 200px, more when the back button shows or the text wraps further),
  // header plus panel ran past the bottom of the viewport and pushed the input
  // box off screen at 100% zoom.
  //
  // Now the panel sizes to its content between a floor and a measured ceiling.
  // The ceiling is whatever room is left below the panel's own top edge, so it
  // adapts to however tall the header happens to render rather than assuming.
  // Measured on mount and on resize; rect.top is taken against an unscrolled
  // page, which is self-correcting — once the panel fits, the page stops
  // scrolling, so the measurement stays true.
  const panelRef = useRef(null)
  const [panelMaxH, setPanelMaxH] = useState(null)
  useEffect(() => {
    if (!embedded) return
    const measure = () => {
      const el = panelRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top + (window.scrollY || 0)
      // 24px of breathing room below the panel so it does not sit flush on the
      // viewport edge. Floored so a very short window still gets a usable panel
      // rather than a sliver.
      setPanelMaxH(Math.max(360, Math.round(window.innerHeight - top - 24)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [embedded])
  // Coach doors (PR-3, item H): when opened with a seed (e.g. "Help me prep for
  // my interview with Renata…"), prefill the input once so the user can review
  // and send. seedAuto flips that to fire-immediately — the My Pipeline "read"
  // buttons and the Interview Prep "Practice this answer" door open the coach
  // and want the message sent, not left sitting in the box.
  useEffect(() => {
    if (seed && seed.trim()) {
      if (seedAuto) sendRef.current(seed)
      else setInput(seed)
      if (typeof onSeedConsumed === 'function') onSeedConsumed()
    }
  }, [seed])
  // Session-open recap (Phase 1, next_step pilot only): the first time this
  // account opens My Coach in a NEW LOGIN SESSION, the coach leads with what
  // changed since the last one instead of waiting to be asked. The persisted
  // transcript (reimagine_chat_history, localStorage) spans every login on
  // this browser, so it cannot tell "a new session" from "the same session,
  // reopened" -- sessionStorage can, because it clears when the tab/browser
  // session ends. Firing is idempotent across both Chat surfaces (the
  // floating bubble and the embedded My Coach view) because they read and
  // write the same sessionStorage key and are never mounted at once (the
  // bubble is suppressed on the 'myCoach' step -- see the render call below).
  // embedded is "always open" (no open/close state of its own), so mounting
  // it IS opening it; the floating variant fires when `open` flips true.
  //
  // 2026-09-06 fix: `open` also flips true when App.jsx's proactive pipeline
  // check-in (pipelineCheckinOpener) force-opens the bubble via openRequest,
  // on arrival at My Pipeline -- not just on a real tap from the person. That
  // opener already asks "has anything moved on your pipeline" and pushes its
  // own message before bumping openRequest, so this effect used to fire right
  // behind it and answer its own question a beat later ("Nothing's shifted in
  // your pipeline..."), reading as Coach greeting the person twice and
  // contradicting itself in the same breath. Checking reimagine_pipeline_
  // checkin_fired here is the same "whichever opener claims the welcome-back
  // slot first, the other stands down" pattern already used for the Personal
  // Brand delivery / check-in pair -- see test-onboarding-brand-delivery.mjs.
  useEffect(() => {
    if (!sessionOpenEligible) return
    if (!embedded && !open) return
    let already = false
    try {
      already = sessionStorage.getItem('reimagine_session_recap_fired') === '1' ||
        sessionStorage.getItem('reimagine_pipeline_checkin_fired') === '1'
    } catch {}
    if (already) return
    try { sessionStorage.setItem('reimagine_session_recap_fired', '1') } catch {}
    if (sendRef.current) sendRef.current(null, { silent: true })
  }, [sessionOpenEligible, embedded, open])
  useEffect(() => {
    const el = inputTaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 220) + 'px'
  }, [input])
  const [loading, setLoading] = useState(false)
  const messagesContainerRef = useRef(null)
  // Narration-only Coach messages (banner:true -- the onboarding "here's
  // what's coming" / "why this matters" lines, which tell the person
  // something rather than asking them anything) show as a small dismissing
  // card next to the closed bubble instead of forcing the full panel open.
  // The full panel still floats over a good chunk of the screen by design
  // (it floats over the content column it discusses), which is fine for a
  // real back-and-forth but was the wrong footprint for a message whose
  // entire job is to point the person at a field on the same screen -- Coach
  // ends up sitting on top of the very thing it just told them to do. The
  // message still lands in the transcript either way; opening the panel
  // (bubble, banner tap, or a forced open elsewhere) always supersedes it.
  //
  // No auto-dismiss timer (reported live, 2026-09-04): a fixed timeout meant
  // the card could vanish before someone had actually read it -- caught when
  // it disappeared while going to go find and copy a resume, leaving the
  // resume screen with no visible guidance and no way to bring it back short
  // of opening the full panel and scrolling. The card is small and sits
  // beside a closed bubble, not over the page, so there is no real cost to
  // leaving it up: it now stays until the person dismisses it or opens the
  // panel, same as it always has for those two paths.
  const [bannerMsg, setBannerMsg] = useState(null)
  // Tracks the previous LAST message by reference, not array length
  // (2026-09-07, live QA on a genuinely fresh signup): App.jsx's
  // onboarding-framing effect REPLACES the untouched seed message with the
  // framing message rather than appending, so the array stays exactly as
  // long as before -- a length-only comparison never saw it as "new," and
  // the very first thing Coach was supposed to say went dark for every
  // real new signup. Every banner:true push, append or replace, ends up as
  // the new last element, so comparing that one message's identity catches
  // both cases the same way.
  const bannerPrevLastRef = useRef(null)
  useEffect(() => {
    const len = messages ? messages.length : 0
    const last = len ? messages[len - 1] : null
    const prevLast = bannerPrevLastRef.current
    bannerPrevLastRef.current = last
    if (open || !last || last === prevLast || !last.banner) return
    setBannerMsg(last.content)
  }, [messages, open])
  useEffect(() => {
    if (!open) return
    setBannerMsg(null)
  }, [open])
  // Reported live: with several banner:true narration messages now piling up
  // in the open transcript one after another (each step's "here's what's
  // coming" line), the newest, currently-relevant one was competing for
  // attention with everything Coach had already said and moved past.
  // Collapsing a superseded narration message to a thin, one-line strip --
  // present, not deleted, expandable on tap -- keeps the transcript honest
  // (nothing vanishes) while keeping the visual weight on what is current. A
  // banner message collapses once something has been said after it; the
  // most recent message is never collapsed, whatever it is.
  //
  // Extended 2026-09-05 (reported live) to INTRO_MSG as well: the generic
  // "Hi, I'm your coach" greeting isn't flagged banner:true (it should not
  // also trigger the closed-bubble preview-card effect below, which is keyed
  // on banner:true), but it deserves the same fate once anything follows it
  // -- it is exactly as superseded as a narration line the moment a real
  // exchange starts.
  const [expandedBanners, setExpandedBanners] = useState(() => new Set())
  const toggleBannerExpanded = i => setExpandedBanners(prev => {
    const next = new Set(prev)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    return next
  })
  // Per-message DOM refs populated by the ref callback in the messages.map
  // render. Indexed by position in the messages array. The scroll effect
  // below pins the user's most recent question to the top of the visible
  // chat area so the assistant response reads downward from a fixed eyeline.
  const messageRefs = useRef([])
  // Tracks message count so the pin-to-top scroll fires only when a NEW message
  // is appended (a new turn) and not on in-place edits like rating a reply or
  // opening its note box — those must leave the scroll position alone.
  const prevLenRef = useRef(0)
  // Per-reply feedback: which message's comment box is open, and its draft text.
  const [commentFor, setCommentFor] = useState(null)
  const [commentDraft, setCommentDraft] = useState('')
  const noteTaRef = useRef(null)
  const noteActionsRef = useRef(null)
  // Caps the in-conversation employment save-offer to once per session.
  const employmentOfferedRef = useRef(false)
  // Rendered assistant-reply nodes, keyed by message id — so Copy can grab the
  // real formatted HTML (headings/bold/bullets), not just the plain text.
  const contentRefs = useRef({})

  // Copy a reply WITH its formatting. Writes rich HTML (from what's actually on
  // screen) so a paste into an email or doc keeps the headings, bold, and
  // bullets, plus a plain-text copy for plain targets. Falls back to plain text
  // where the async Clipboard API or ClipboardItem is unavailable.
  // MD.jsx sets an explicit fontSize on every block it emits (paragraphs and
  // bullets at 20, headings 19-26) plus Georgia and Reimagine's palette. Copying
  // the rendered HTML carried all of that into the paste target: Gmail read the
  // 20px and showed the whole reply as "Large" against a Normal draft. Strip the
  // typography from a CLONE — never the live DOM — and keep everything that
  // carries meaning: bold, headings, lists, the structure itself. The paste then
  // lands in whatever font the destination is already using.
  const COPY_STRIP_PROPS = ['font-size', 'font-family', 'line-height', 'color']
  const copyReply = async (id, content) => {
    const el = contentRefs.current[id]
    let html = ''
    if (el) {
      const clone = el.cloneNode(true)
      clone.querySelectorAll('*').forEach(n => {
        if (n.style) COPY_STRIP_PROPS.forEach(p => n.style.removeProperty(p))
      })
      html = clone.innerHTML
    }
    try {
      if (html && navigator.clipboard && typeof window !== 'undefined' && window.ClipboardItem) {
        await navigator.clipboard.write([new window.ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([content], { type: 'text/plain' }),
        })])
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(content)
      }
      setCopiedId(id)
    } catch {
      try { if (navigator.clipboard) await navigator.clipboard.writeText(content); setCopiedId(id) } catch { /* clipboard blocked */ }
    }
  }
  // Same cap for the My Search pursuit-status save-offer.
  const pursuitOfferedRef = useRef(false)
  // Topic-close trigger, signal 2 (closing language): once per Chat mount,
  // same session-local cap the two offers above use, on top of the
  // persisted cross-session fire cap (lifeEventsThinTriggerActive already
  // reflects that) -- stops the same session from re-showing this the
  // moment it is dismissed once.
  const lifeEventsThinLangFiredRef = useRef(false)

  useEffect(() => {
    const len = messages ? messages.length : 0
    // Only pin a question to the top when a new message was APPENDED (a new
    // turn). In-place mutations — rating a reply, opening/closing its note box —
    // keep the same length and must not move the view (that yanked the user off
    // the note textarea they just opened).
    const prevLen = prevLenRef.current
    const grew = len > prevLen
    prevLenRef.current = len
    if (!grew || len === 0) return
    // A Coach-initiated turn (a check-in, a chained continuation) appends only
    // assistant messages, with no new user message in this growth. Pinning the
    // last EXISTING user message in that case scrolls to wherever that older
    // turn was, which can leave the new message stranded below the fold in a
    // conversation with any real history -- the person opens the panel, lands
    // on old ground, and never sees Coach was waiting on them. Scroll those
    // straight to the new message; only pin-to-top when this turn's growth
    // itself included a fresh user message.
    const turnHasNewUserMsg = messages.slice(prevLen).some(m => m.role === 'user')
    if (!turnHasNewUserMsg) {
      const el = messageRefs.current[len - 1]
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'end', behavior: 'smooth' })
      return
    }
    // Find the most recent user message and scroll it to the top of the
    // messages container so the assistant response reads downward.
    let lastUserIdx = -1
    for (let i = len - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUserIdx = i; break }
    }
    if (lastUserIdx < 0) return
    const el = messageRefs.current[lastUserIdx]
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }, [messages, loading])

  // When a note box opens, focus its textarea and bring it just into view
  // (block:'nearest' scrolls minimally, never to the top), so the user lands in
  // the field they are meant to type in.
  useEffect(() => {
    if (commentFor == null) return
    const t = noteTaRef.current
    if (t) t.focus()
    // Reveal the whole note block — textarea AND the Send/Skip row — by bringing
    // its bottom (the action row) into view. block:'nearest' scrolls minimally
    // and never to the top; the note block is short, so the textarea above stays
    // visible too. Falls back to the textarea if the action ref is not mounted.
    const target = noteActionsRef.current || t
    if (target && target.scrollIntoView) target.scrollIntoView({ block: 'nearest' })
  }, [commentFor])

  // One-tap quick-reply (e.g. the Personal Brand check-in: Yes / Mostly / Not
  // quite). The tap is the measurable signal: it records best-effort to
  // /api/pb-checkin, drops the buttons, and continues the conversation with a
  // canned, on-voice follow-up. The user can keep chatting normally from there.
  const tapQuickReply = async (idx, opt, checkinKey) => {
    setMessages(m => {
      const c = [...m]
      if (c[idx]) c[idx] = { ...c[idx], quickReplies: null }
      // synthetic: true (My Coach review finding #2.4) -- this is the button
      // label, not something the person actually typed. The server strips
      // synthetic turns before building the model's history so a tap never
      // reads back as the person having said it.
      c.push({ role: 'user', content: opt.label, synthetic: true })
      return c
    })
    // Persistence is best-effort and routed by App: an onQuickReply handler owns
    // where the value lands (e.g. employment status -> its own column endpoint).
    // Falls back to the personal-brand check-in log when App does not handle it.
    //
    // A handler may return a message object instead of `true` when the tap has
    // somewhere to go next. A save that lands and then says nothing leaves the
    // person sitting in the Coach with the thing they just updated one screen
    // away and no way back that is on screen -- the "Back to…" link lives at the
    // top of the conversation, which is exactly where they are not after a long
    // exchange. The completion moment is where the way back belongs.
    //
    // The confirmation bubble (opt.followUp) used to be pushed BEFORE awaiting
    // onQuickReply, so a handler that returned false (target not found, JSON
    // malformed, nothing new to add) had already shown "Saved."/"Updated."/
    // "Archived." with no way to retract it -- a resolver miss read as data
    // loss. Now it is pushed only once the write is confirmed to have actually
    // landed (handled === true), and a genuine miss says so honestly instead of
    // silently logging a pb-checkin row that would not even fit that table.
    // Found in the 2026-09-07 full My Coach review.
    try {
      const handled = onQuickReply ? await onQuickReply(checkinKey, opt.value) : false
      if (handled && typeof handled === 'object' && handled.content) {
        setMessages(m => [...m, { role: 'assistant', ...handled, synthetic: true }])
        // Opportunity-update capture (2026-09-06): the tap just landed a real
        // write (a stage, a move, a meeting, a new interviewer), and the reply
        // that offered it was deliberately short and tactical -- coaching on
        // what was just confirmed is a separate, following turn, triggered
        // here now that the write has actually succeeded, not bundled into
        // the offer itself. See buildPostCaptureTurnText in api/coach.js.
        if (checkinKey === 'opportunity-update') {
          let capturedData = null
          try { capturedData = JSON.parse(opt.value) } catch { /* dismiss, or malformed -- no follow-up */ }
          if (capturedData && sendRef.current) sendRef.current(null, { postCaptureUpdate: capturedData })
        }
      } else if (handled === true) {
        // synthetic: true (My Coach review finding #2.4) -- an
        // action-confirmation string ("Saved.", "Archived.") the app wrote,
        // not the model. This is the exact class of turn that used to teach
        // the model it had already done what it is told never to claim.
        if (opt.followUp) setMessages(m => [...m, { role: 'assistant', content: opt.followUp, synthetic: true }])
      } else {
        const r = await fetch('/api/pb-checkin', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkin: checkinKey || 'personal-brand', answer: opt.value }),
        })
        // 'dismiss' is not a logged pb-checkin answer (and, post-2026-09-07,
        // every capture key returns true on its own dismiss branch before
        // reaching here) -- a non-ok response there is expected, not a miss.
        if (!r.ok && opt.value !== 'dismiss') {
          setMessages(m => [...m, { role: 'assistant', content: "That didn't go through — nothing matched, so nothing changed.", synthetic: true }])
        }
      }
    } catch { /* the conversation already continued; the tap is best-effort */ }
  }

  // `silent` (session-open recap, Phase 1) / `postCaptureUpdate` (2026-09-06,
  // opportunity-update follow-up): the app fires either itself, with no
  // typed text and no user bubble — the coach speaks first, either with
  // what changed since the account's last session, or with the coaching
  // that follows a just-confirmed opportunity update. Everything below
  // reduces to the same request/stream/log path a normal send takes; the
  // differences are what goes in the request body (sessionOpen, or
  // postCaptureUpdate carrying exactly what the tap just confirmed, instead
  // of a message) and that nothing is pushed into the transcript until we
  // know there is something to show (a 204 on the sessionOpen path means
  // there wasn't, and that renders nothing at all rather than a bubble that
  // briefly appears and vanishes).
  const send = async (explicit, { silent = false, postCaptureUpdate = null } = {}) => {
    const isSilentTurn = silent || !!postCaptureUpdate
    const text = isSilentTurn ? '' : (typeof explicit === 'string' ? explicit : input).trim()
    if (isSilentTurn) { if (loading) return } else if (!text || loading) return
    const userMsg = { role: 'user', content: text }
    // (sendRef is refreshed just below so the seed effect can call the latest send.)
    const historyAtSend = messages
    if (isSilentTurn) {
      setLoading(true)
    } else {
      // Pressing Send (or Enter) means "I'm done talking" -- stop an
      // in-progress dictation rather than leaving it listening into
      // whatever the person says next.
      if (speechBtnRef.current) speechBtnRef.current.stop()
      setMessages(m => [...m, userMsg, { role: 'assistant', content: '' }])
      setInput('')
      setLoading(true)
    }
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          ...(postCaptureUpdate ? { postCaptureUpdate } : (silent ? { sessionOpen: true } : { message: userMsg.content })),
          history: historyAtSend,
          currentStep,
          // Entry point for insight logging: the embedded variant is the My
          // Coach sidebar; the floating variant is the help bubble.
          surface: embedded ? 'sidebar' : 'help',
          // General-question mode (Career Club team only; re-checked server-side).
          // Never sent on a silent open — the recap needs this account's real
          // profile, and general mode explicitly has none loaded.
          general: isSilentTurn ? false : generalMode,
          // Which saved opportunity this conversation is pinned to, when the app
          // knows. The server otherwise infers it by scanning the person's own
          // words for the title or company (findInFocusRecord), which works for
          // the pre-filled "read on this opportunity" prompt and not at all for
          // someone who opened the Coach from inside a playbook and simply said
          // what they are doing next. Sent as a hint only: the server re-checks
          // that the id belongs to this account's saved work before using it.
          focusRecordId: (coachSaveTarget && coachSaveTarget.id) || undefined,
          // Which single-target Focus section (if any) this conversation
          // started from, via that section's own "Ask My Coach about this"
          // button -- the only signal that safely disambiguates a correction
          // among the several sections sharing the 'focus' step. See
          // sectionReworkCaptureNote in api/coach.js.
          returnSection: sectionReworkTarget || undefined,
        }),
      })
      if (silent && res.status === 204) {
        // Nothing to recap (no prior session to diff against, or the pilot
        // turned out not to be on) — say nothing, exactly as if this call had
        // never been made.
        setLoading(false)
        return
      }
      if (isSilentTurn && !res.ok) {
        // A proactive opener nobody asked for; a failure here should not
        // greet the person with an error message they never triggered. A
        // normal send still shows its fallback below — this branch only
        // covers the silent paths (session-open recap, post-capture
        // follow-up). The post-capture write itself already succeeded
        // independently of this call, so there is nothing to roll back --
        // only a bonus coaching turn that silently does not arrive.
        setLoading(false)
        return
      }
      if (isSilentTurn) setMessages(m => [...m, { role: 'assistant', content: '' }])
      if (!res.ok || !res.body) {
        // When the model itself is unreachable the server sends one written
        // sentence explaining it (api/_lib/anthropic-error.js), so the coach
        // says the same thing every other surface says instead of a generic
        // shrug. Any other failure keeps the short fallback.
        let systemMsg = null
        if (res.status === 503) {
          const body = await res.json().catch(() => null)
          const m = body && body.error && body.error.message
          if (typeof m === 'string' && m.trim()) systemMsg = m.trim()
        }
        const fallback = res.status === 401
          ? 'Sign in first to talk with your coach.'
          : systemMsg || 'Sorry, something went wrong. Try again in a moment.'
        setMessages(m => {
          const copy = [...m]
          // synthetic: true (My Coach review finding #2.4) -- a client-side
          // error message, never something the model said.
          copy[copy.length - 1] = { role: 'assistant', content: fallback, synthetic: true }
          return copy
        })
      } else {
        // The persisted reply row id rides back on this header (same-origin, so
        // it's readable without CORS config). Stash it on the assistant message so
        // the thumbs below it can attach a rating to that exact row.
        const msgId = res.headers.get('X-Coach-Message-Id') || null
        const ouHeader = res.headers.get('X-Coach-Opportunity-Update') || null
        const ocrHeader = res.headers.get('X-Coach-Op-Card-Rework') || null
        const occHeader = res.headers.get('X-Coach-Opportunity-Context') || null
        const oaHeader = res.headers.get('X-Coach-Opportunity-Archive') || null
        const crHeader = res.headers.get('X-Coach-Close-Reason') || null
        const vcHeader = res.headers.get('X-Coach-Values') || null
        const repHeader = res.headers.get('X-Coach-Reputation') || null
        const skillsHeader = res.headers.get('X-Coach-Skills') || null
        const skillsRemoveHeader = res.headers.get('X-Coach-Skills-Remove') || null
        const prioritiesHeader = res.headers.get('X-Coach-Priorities') || null
        const lifeStoryHeader = res.headers.get('X-Coach-Life-Story') || null
        const assessHeader = res.headers.get('X-Coach-Assessment') || null
        const brHeader = res.headers.get('X-Coach-Brand-Rework') || null
        const secHeader = res.headers.get('X-Coach-Section-Rework') || null
        const acHeader = res.headers.get('X-Coach-Activity') || null
        const siHeader = res.headers.get('X-Coach-Search-Intake') || null
        const noteHeader = res.headers.get('X-Coach-Note-Offer') || null
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let fullText = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullText += decoder.decode(value, { stream: true })
          // Prose-only: the wire carries no NAVIGATE trailer to strip.
          setMessages(m => {
            const copy = [...m]
            copy[copy.length - 1] = { ...copy[copy.length - 1], content: fullText, id: msgId }
            return copy
          })
        }
        // Coach's live replies stream straight into the visible UI, so a
        // silent pre-display retry (matching generation's callClaudeWithVoiceGate)
        // is not possible without buffering the whole reply and losing the
        // live-typing effect. This checks the completed reply after it has
        // already rendered and reports hard violations for detection and
        // telemetry rather than correcting the displayed text.
        const voiceViolations = detectVoiceViolations(fullText, { scope: 'runtime' }).filter(v => v.severity === 'hard')
        if (voiceViolations.length && onVoiceViolation) onVoiceViolation(voiceViolations)
        // One-time in-conversation offer to persist a stated employment status.
        // Only when the value is unset, we have not offered this session, and no
        // employment prompt is already pending — so the on-open prompt and this
        // never stack. The tap routes through onQuickReply like the other prompt;
        // the model never writes, and all three options are shown so the stored
        // value is always the user's tap, never the regex's guess.
        const alreadyPending = (messages || []).some(mm => mm && mm.checkinKey === 'employment-status' && Array.isArray(mm.quickReplies) && mm.quickReplies.length)
        const empJustFired = employmentCaptureActive && employmentOfferMessage && !employmentOfferedRef.current && !alreadyPending && EMPLOYMENT_MENTION_RE.test(userMsg.content)
        if (empJustFired) {
          employmentOfferedRef.current = true
          setMessages(m => [...m, employmentOfferMessage])
        }
        // One-time in-conversation offer to save a pursuit-status change to My
        // Search. Same shape as the employment offer: only when the feature is on
        // and an opportunity is open (pursuitOfferMessage is null otherwise), we
        // have not offered this session, none is pending, and the employment offer
        // did not just fire this turn — so the two never stack in one reply.
        const pursuitPending = (messages || []).some(mm => mm && mm.checkinKey === 'pursuit-stage' && Array.isArray(mm.quickReplies) && mm.quickReplies.length)
        if (pursuitCaptureActive && pursuitOfferMessage && !pursuitOfferedRef.current && !pursuitPending && !empJustFired && STAGE_MENTION_RE.test(userMsg.content)) {
          pursuitOfferedRef.current = true
          setMessages(m => [...m, pursuitOfferMessage])
        }
        // Topic-close trigger, signal 2 (closing language, 2026-09-07 Cowork
        // consult). lifeEventsThinTriggerActive already reflects the thin-
        // field check, hasOnboardingConcierge, and the persisted cross-
        // session fire cap (all computed in App.jsx, which owns that
        // state) -- this only adds the session-local guard, the "already
        // pending" check, and the actual regex + length comparison. The
        // preceding Coach reply is the last assistant message already in
        // `messages` before this turn's reply was appended above.
        const lifeEventsThinPending = (messages || []).some(mm => mm && ['life-events-thin-hub', 'life-events-thin-tap', 'life-events-thin-lang'].includes(mm.checkinKey) && Array.isArray(mm.quickReplies) && mm.quickReplies.length)
        const priorCoachReply = [...(messages || [])].reverse().find(mm => mm && mm.role === 'assistant' && typeof mm.content === 'string')
        if (lifeEventsThinTriggerActive && lifeEventsThinOfferMessage && !lifeEventsThinLangFiredRef.current && !lifeEventsThinPending && priorCoachReply && userMsg.content.length < priorCoachReply.content.length && CLOSING_LANGUAGE_RE.test(userMsg.content)) {
          lifeEventsThinLangFiredRef.current = true
          logPromptEngagement('life_events_thin', 'topic_close_language', 'shown')
          setMessages(m => [...m, lifeEventsThinOfferMessage])
          if (onLifeEventsThinTopicClose) onLifeEventsThinTopicClose()
        }
        // Opportunity update capture: the server extracted any combination of a
        // stage move, a next move (+ date), a scheduled meeting, and new
        // Interview Team members onto X-Coach-Opportunity-Update -- one merged
        // offer replacing the separate interview-team and pipeline offers this
        // used to be (2026-09-06, folding a live-eval finding that several
        // narrow, independently-authored capture notes compete for attention
        // in Coach's full prompt; see OPPORTUNITY_UPDATE_CAPTURE_NOTE in
        // api/coach.js). Recaps exactly what it heard, then asks what's
        // missing -- naming the one gap this can actually detect (a move with
        // no date) and asking generically otherwise. Never a flat yes/no: a
        // person who gave four updates and had three caught is naturally going
        // to say "wait, you forgot..." rather than "no."
        if (opportunityUpdateCaptureActive && ouHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(ouHeader), c => c.charCodeAt(0))))
            const stage = data && typeof data.stage === 'string' ? data.stage : ''
            const move = data && typeof data.move === 'string' ? data.move.trim() : ''
            const meeting = data && typeof data.meeting === 'string' ? data.meeting.trim() : ''
            const people = (data && Array.isArray(data.people) ? data.people : []).filter(p => p && p.name)
            const removePeople = (data && Array.isArray(data.removePeople) ? data.removePeople : []).filter(n => typeof n === 'string' && n.trim())
            if (stage || move || meeting || people.length || removePeople.length) {
              // Formatted in UTC: these are calendar days, not instants, and a
              // local rendering can show the day before.
              const fmt = d => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
              const heard = []
              if (stage) heard.push(`Stage: ${PURSUIT_STAGE_LABELS[stage] || stage}`)
              if (move) heard.push(`Next move: ${move}${data.date ? ` — ${fmt(data.date)}` : ' — no date set'}`)
              if (meeting) heard.push(`Next scheduled meeting: ${fmt(meeting)}`)
              if (people.length) heard.push(`Interview Team: ${people.map(p => p.name).join(', ')}`)
              if (removePeople.length) heard.push(`Remove from Interview Team: ${removePeople.join(', ')}`)
              const where = data.opportunity ? ` on ${data.opportunity}` : ''
              const ask = (move && !data.date)
                ? "I didn't catch a date for that — anything else, or is that everything?"
                : 'Anything else, or is that everything?'
              setMessages(m => [...m, {
                role: 'assistant',
                content: `Here's what I heard${where}:\n\n${heard.join('\n')}\n\n${ask}`,
                checkinKey: 'opportunity-update',
                quickReplies: [
                  { label: "That's everything — update it", value: JSON.stringify(data) },
                  { label: 'Not yet', value: 'dismiss' },
                ],
              }])
            }
          } catch { /* malformed header — no offer */ }
        }
        // Op card rework: the server named a specific built card and a note
        // that should change it. Recap both in plain language before offering
        // the tap -- the person should know exactly what's about to change
        // and where, the same as every other capture offer.
        if (opCardReworkCaptureActive && ocrHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(ocrHeader), c => c.charCodeAt(0))))
            const section = data && typeof data.section === 'string' ? data.section : ''
            const note = data && typeof data.note === 'string' ? data.note.trim() : ''
            const label = (OP_COUNTED_SECTIONS.find(s => s.key === section) || {}).label || section
            if (section && note) {
              const where = data.opportunity ? ` on ${data.opportunity}` : ''
              setMessages(m => [...m, {
                role: 'assistant',
                content: `Want me to update ${label}${where} with this: "${note}"?`,
                checkinKey: 'op-card-rework',
                quickReplies: [
                  { label: `Update ${label}`, value: JSON.stringify(data) },
                  { label: 'Not now', value: 'dismiss' },
                ],
              }])
            }
          } catch { /* malformed header — no offer */ }
        }
        // Opportunity context: durable, non-person-attached intel about the
        // opportunity itself, appended to the same free-text field the
        // Interview Team card's own "opportunity context" box writes to.
        // ADDS to whatever is already there, same append contract as
        // assessment capture above -- never a replace, so a tap can never
        // look like it could wipe out real intel already logged.
        if (opportunityContextCaptureActive && occHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(occHeader), c => c.charCodeAt(0))))
            const text = data && typeof data.text === 'string' ? data.text.trim() : ''
            if (text) {
              const where = data.opportunity ? ` to ${data.opportunity}'s context` : " to this opportunity's context"
              setMessages(m => [...m, {
                role: 'assistant',
                content: `Want me to add this${where}? It adds to whatever's already there, and it'll shape Interview Prep the next time you build it.\n\n${text}`,
                checkinKey: 'opportunity-context',
                quickReplies: [
                  { label: 'Add it', value: JSON.stringify(data), followUp: "Added to the opportunity's context." },
                  { label: 'Not now', value: 'dismiss' },
                ],
              }])
            }
          } catch { /* malformed header — no offer */ }
        }
        // Opportunity archive (2026-09-06, deletion/retraction Tier 1): the
        // person is done tracking this one. Says plainly it archives, not
        // deletes, and that it is recoverable -- the same honesty the
        // screen's own "Remove from pipeline" language already uses.
        if (opportunityArchiveCaptureActive && oaHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(oaHeader), c => c.charCodeAt(0))))
            const opportunity = data && typeof data.opportunity === 'string' ? data.opportunity.trim() : ''
            if (opportunity) {
              logPromptEngagement('opportunity_archive', 'model_detected', 'shown')
              setMessages(m => [...m, {
                role: 'assistant',
                content: `Want me to take ${opportunity} off your active pipeline? It moves to Archived, not gone — you can restore it any time in the next 90 days.`,
                checkinKey: 'opportunity-archive',
                quickReplies: [
                  { label: `Archive ${opportunity}`, value: JSON.stringify(data), followUp: 'Archived.' },
                  { label: 'Not now', value: 'dismiss' },
                ],
              }])
            }
          } catch { /* malformed header — no offer */ }
        }
        // Close reason (2026-09-07): shows the exact category and their own
        // words before the tap, same as every other capture offer -- the
        // category alone is what a later cross-account view could ever look
        // at, and that promise only holds if the person sees precisely what
        // gets filed under it.
        if (closeReasonCaptureActive && crHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(crHeader), c => c.charCodeAt(0))))
            const opportunity = data && typeof data.opportunity === 'string' ? data.opportunity.trim() : ''
            const label = CLOSE_REASON_LABEL[data && data.reasonCode] || ''
            const detail = data && typeof data.detail === 'string' ? data.detail.trim() : ''
            if (opportunity && label) {
              const parts = [`Category: ${label}`]
              if (detail) parts.push(`In your words: ${detail}`)
              setMessages(m => [...m, {
                role: 'assistant',
                content: `Want me to log this as why ${opportunity} ended?\n\n${parts.join('\n')}`,
                checkinKey: 'close-reason',
                quickReplies: [
                  { label: 'Save it', value: JSON.stringify(data) },
                  { label: 'Not now', value: 'dismiss' },
                ],
              }])
            }
          } catch { /* malformed header — no offer */ }
        }
        // Save-to-notes: the server saw an explicit request to keep this reply
        // and set X-Coach-Note-Offer. The content offered is this reply's own
        // text -- exactly what the manual "Save to this opportunity" button
        // already saves. No JSON to decode: there is nothing to carry beyond
        // the text already sitting in fullText.
        if (notesCaptureActive && noteHeader === '1' && fullText.trim()) {
          setMessages(m => [...m, { role: 'assistant', content: "Want me to add this to the opportunity's notes?", checkinKey: 'coach-note-save', quickReplies: [{ label: 'Save it', value: fullText }, { label: 'Not now', value: 'dismiss' }] }])
        }
        // Values capture: the server extracted what this turn settled for Values
        // and/or Passions & Causes onto X-Coach-Values. Show it back in full — the
        // person accepts the exact text they are about to store, never a summary
        // of it — and offer a one-tap save.
        if (valuesCaptureActive && vcHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(vcHeader), c => c.charCodeAt(0))))
            const parts = []
            if (data && data.values) parts.push(`Core Values: ${data.values}`)
            if (data && data.passions) parts.push(`Passions, Interests & Causes: ${data.passions}`)
            if (parts.length) {
              setMessages(m => [...m, { role: 'assistant', content: `Want me to save this to your Values, Passions & Causes screen? It replaces whatever is in the ${parts.length > 1 ? 'fields' : 'field'} now, and you can edit it there any time.\n\n${parts.join('\n\n')}`, checkinKey: 'values-capture', quickReplies: [{ label: 'Save it', value: JSON.stringify(data), followUp: 'Saved to your Values, Passions & Causes.' }, { label: 'Not now', value: 'dismiss' }] }])
            }
          } catch { /* malformed header — no offer */ }
        }
        // Reputation capture: same shape as Values just above, for the
        // Reputation screen's four fields.
        if (reputationCaptureActive && repHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(repHeader), c => c.charCodeAt(0))))
            const parts = []
            if (data && data.memory) parts.push(`Praise you receive: ${data.memory}`)
            if (data && data.emergency) parts.push(`Who calls you in an emergency: ${data.emergency}`)
            if (data && data.twoWords) parts.push(`How people describe your superpower: ${data.twoWords}`)
            if (data && data.other) parts.push(`Other reputation notes: ${data.other}`)
            if (parts.length) {
              setMessages(m => [...m, { role: 'assistant', content: `Want me to save this to your Reputation screen? It replaces whatever is in the ${parts.length > 1 ? 'fields' : 'field'} now, and you can edit it there any time.\n\n${parts.join('\n\n')}`, checkinKey: 'reputation-capture', quickReplies: [{ label: 'Save it', value: JSON.stringify(data), followUp: 'Saved to your Reputation screen.' }, { label: 'Not now', value: 'dismiss' }] }])
            }
          } catch { /* malformed header — no offer */ }
        }
        // Skills capture: adds to whatever chips are already there per
        // category -- never replaces, since resume/LinkedIn extraction may
        // already hold real entries this conversation never mentioned.
        if (skillsCaptureActive && skillsHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(skillsHeader), c => c.charCodeAt(0))))
            const CAT_LABEL = { technical: 'Technical and tools', systems: 'Systems and platforms', certifications: 'Certifications', languages: 'Languages', methodologies: 'Methodologies and frameworks' }
            const parts = Object.keys(CAT_LABEL).map(k => (data && Array.isArray(data[k]) && data[k].length) ? `${CAT_LABEL[k]}: ${data[k].join(', ')}` : null).filter(Boolean)
            if (parts.length) {
              setMessages(m => [...m, {
                role: 'assistant',
                content: `Want me to add this to your Skills screen? It adds to whatever is already there, and you can edit it any time.\n\n${parts.join('\n')}`,
                checkinKey: 'skills-capture',
                quickReplies: [
                  { label: 'Add it', value: JSON.stringify(data), followUp: 'Added to your Skills screen.' },
                  { label: 'Not now', value: 'dismiss' },
                ],
              }])
            }
          } catch { /* malformed header — no offer */ }
        }
        // Skills removal (2026-09-06): same gate as the add offer above --
        // one account eligibility, two directions. Named items are shown
        // back in full; the client write path is the one that actually
        // checks each name against the real current list, so a name that
        // does not match anything simply removes nothing rather than
        // erroring.
        if (skillsCaptureActive && skillsRemoveHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(skillsRemoveHeader), c => c.charCodeAt(0))))
            const CAT_LABEL = { technical: 'Technical and tools', systems: 'Systems and platforms', certifications: 'Certifications', languages: 'Languages', methodologies: 'Methodologies and frameworks' }
            const parts = Object.keys(CAT_LABEL).map(k => (data && Array.isArray(data[k]) && data[k].length) ? `${CAT_LABEL[k]}: ${data[k].join(', ')}` : null).filter(Boolean)
            if (parts.length) {
              setMessages(m => [...m, {
                role: 'assistant',
                content: `Want me to remove this from your Skills screen?\n\n${parts.join('\n')}`,
                checkinKey: 'skills-remove',
                quickReplies: [
                  { label: 'Remove it', value: JSON.stringify(data), followUp: 'Removed from your Skills screen.' },
                  { label: 'Not now', value: 'dismiss' },
                ],
              }])
            }
          } catch { /* malformed header — no offer */ }
        }
        // Priorities capture: up to five fields, three different offer
        // framings depending on which settled -- compFloor/workReq/
        // benefitsWeight/riskTolerance read as a replace (their own current
        // answer), dealBreakers reads as add-or-replace the same way Values
        // does.
        if (prioritiesCaptureActive && prioritiesHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(prioritiesHeader), c => c.charCodeAt(0))))
            const parts = []
            if (data && data.compFloor) parts.push(`Compensation floor: ${data.compFloor}`)
            if (data && data.workReq) parts.push(`Commute or remote needs: ${data.workReq}`)
            if (data && data.benefitsWeight) parts.push(`How much benefits weigh: ${data.benefitsWeight}`)
            if (data && data.riskTolerance) parts.push(`Stability vs upside: ${data.riskTolerance}`)
            if (data && data.dealBreakers) parts.push(`Hard deal-breakers: ${data.dealBreakers}`)
            if (parts.length) {
              setMessages(m => [...m, { role: 'assistant', content: `Want me to save this to your Priorities & Non-Negotiables screen? It replaces whatever is in the ${parts.length > 1 ? 'fields' : 'field'} now, and you can edit it there any time.\n\n${parts.join('\n\n')}`, checkinKey: 'priorities-capture', quickReplies: [{ label: 'Save it', value: JSON.stringify(data), followUp: 'Saved to your Priorities & Non-Negotiables.' }, { label: 'Not now', value: 'dismiss' }] }])
            }
          } catch { /* malformed header — no offer */ }
        }
        // Life Story capture: adds a new paragraph, never overwrites --
        // same append contract as Assessment and Skills above.
        if (lifeStoryCaptureActive && lifeStoryHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(lifeStoryHeader), c => c.charCodeAt(0))))
            const text = data && typeof data.text === 'string' ? data.text.trim() : ''
            if (text) {
              setMessages(m => [...m, {
                role: 'assistant',
                content: `Want me to add this to your Story screen? It adds a new paragraph to what's already there, and you can edit it any time.\n\n${text}`,
                checkinKey: 'life-story-capture',
                quickReplies: [
                  { label: 'Add it', value: JSON.stringify(data), followUp: 'Added to your Story.' },
                  { label: 'Not now', value: 'dismiss' },
                ],
              }])
            }
          } catch { /* malformed header — no offer */ }
        }
        // Assessment capture: the server extracted remembered assessment
        // content onto X-Coach-Assessment. Show it back in full, and make
        // clear it ADDS to the field rather than replacing it -- unlike
        // Values above, someone may already have real assessment content
        // saved, and this should never look like it could wipe that out.
        if (assessmentCaptureActive && assessHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(assessHeader), c => c.charCodeAt(0))))
            const text = data && typeof data.text === 'string' ? data.text.trim() : ''
            if (text) {
              setMessages(m => [...m, {
                role: 'assistant',
                content: `Want me to add this to your assessment field? It adds to whatever is already there, and you can edit it any time.\n\n${text}`,
                checkinKey: 'assessment-capture',
                quickReplies: [
                  { label: 'Add it', value: JSON.stringify(data), followUp: 'Added to your assessment field.' },
                  { label: 'Not now', value: 'dismiss' },
                ],
              }])
            }
          } catch { /* malformed header — no offer */ }
        }
        // Brand rework capture: the server judged the reply as a real
        // correction to the Personal Brand, not just a reaction. Show the
        // note back before acting on it — the DTFR box always shows what it
        // is about to send, and this offer holds to the same bar.
        if (brandReworkCaptureActive && brHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(brHeader), c => c.charCodeAt(0))))
            const note = data && typeof data.note === 'string' ? data.note.trim() : ''
            if (note) {
              setMessages(m => [...m, {
                role: 'assistant',
                content: `Want me to rework it with that?\n\n${note}`,
                checkinKey: 'brand-rework',
                quickReplies: [
                  { label: 'Yes, rework it', value: JSON.stringify(data), followUp: 'Reworking it now — give it a moment.' },
                  { label: 'Not now', value: 'dismiss' },
                ],
              }])
            }
          } catch { /* malformed header — no offer */ }
        }
        // Section rework capture: same shape as brand rework, generalized to
        // the four single-target Focus sections. The section id rides in the
        // header payload itself (set server-side from returnSection, never
        // from the model), so the write path always targets the section this
        // conversation actually started from.
        if (sectionReworkTarget && secHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(secHeader), c => c.charCodeAt(0))))
            const note = data && typeof data.note === 'string' ? data.note.trim() : ''
            if (note) {
              setMessages(m => [...m, {
                role: 'assistant',
                content: `Want me to rework it with that?\n\n${note}`,
                checkinKey: 'section-rework',
                quickReplies: [
                  { label: 'Yes, rework it', value: JSON.stringify(data), followUp: 'Reworking it now — give it a moment.' },
                  { label: 'Not now', value: 'dismiss' },
                ],
              }])
            }
          } catch { /* malformed header — no offer */ }
        }
        // Activity capture: the person said something about the human half of
        // their search -- a group they joined, someone holding them accountable,
        // a note they wrote directly. Reimagine cannot see any of it, so the only
        // way it ever gets known is this. The tap writes; the model never does.
        //
        // A `not_yet` or `declined` is offered the same way as a `done`, because
        // recording that they do not want something is what stops the coach
        // raising it a fourth time. The wording changes so the offer never reads
        // as logging a failure.
        if (activityCaptureActive && acHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(acHeader), c => c.charCodeAt(0))))
            const label = data && typeof data.label === 'string' ? data.label.trim() : ''
            const st = data && typeof data.state === 'string' ? data.state : ''
            if (label && st) {
              const detail = data.detail ? ` — ${data.detail}` : ''
              const line = st === 'done'
                ? `Remember: ${label}${detail}`
                : st === 'declined'
                  ? `Remember: not interested in ${label}${detail} — I won't bring it up again`
                  : `Remember: ${label} is still open${detail}`
              setMessages(m => [...m, {
                role: 'assistant',
                content: `Want me to remember that? It stays with your profile so I am not asking you twice.\n\n${line}`,
                checkinKey: 'activity-fact',
                quickReplies: [
                  // No canned follow-up: it is pushed optimistically, before the
                  // write is attempted, so a failed save would still read "Got
                  // it." The handler confirms only once the write has landed.
                  { label: 'Remember it', value: JSON.stringify(data) },
                  { label: 'Not now', value: 'dismiss' },
                ],
              }])
            }
          } catch { /* malformed header — no offer */ }
        }
        // Search intake: the coach answered the person's message normally, and
        // judged that what they said is a real answer to one of the two intake
        // questions and substantive enough to carry in their profile. A thin or
        // deflecting reply produces no header and therefore no offer — that
        // judgement is the whole point, since the alternative is storing noise.
        if (siHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(siHeader), c => c.charCodeAt(0))))
            const label = data && data.goingWell ? "What's going well" : 'What you\'d like to improve'
            const body = data && (data.goingWell || data.focus)
            if (body) {
              // 'accepted' logged here, not on the Keep-it/Not-now tap below:
              // reaching this point IS the answer to the actual question
              // (search_intake's solicitation), and its own decline-able
              // moment further down is a separate "save this or not" choice
              // on content already given -- see PROMPT_ENGAGEMENT_META_BY_
              // CHECKIN's comment in App.jsx for why that one is not logged.
              logPromptEngagement('search_intake', 'hub_arrival', 'accepted')
              setMessages(m => [...m, { role: 'assistant', content: `Want me to keep this on your profile? I'd read it as background on where things stand, not as a fixed picture, and it lives on your Your Current Situation screen if you want to change it.\n\n${label}: ${body}`, checkinKey: 'search-intake', quickReplies: [{ label: 'Keep it', value: JSON.stringify(data), followUp: 'Kept.' }, { label: 'Not now', value: 'dismiss' }] }])
            }
          } catch { /* malformed header — no offer */ }
        }
      }
    } catch (err) {
      if (err && err.name === 'AbortError') {
        // The person clicked Stop. Whatever streamed in before the click is
        // already the last message's content -- it was updated on every
        // chunk as it arrived -- so there is nothing to restore and nothing
        // to apologize for. The one cleanup this needs: stopping before any
        // text arrived at all would otherwise leave an empty bubble sitting
        // in the transcript forever.
        setMessages(m => {
          const last = m[m.length - 1]
          if (last && last.role === 'assistant' && !last.content) return m.slice(0, -1)
          return m
        })
      } else if (!isSilentTurn) {
        // A silent turn (session-open or post-capture) never pushed a
        // placeholder to overwrite here (it only does that once a real,
        // non-204 response is in hand) -- so on a thrown error (network down,
        // etc.) there is nothing of its own to fail into, and clobbering
        // whatever the transcript's real last message happens to be would be
        // worse than saying nothing. Fail exactly as silently as the
        // 204/!res.ok branches above do.
        setMessages(m => {
          const copy = [...m]
          // synthetic: true (My Coach review finding #2.4) -- see the 503/401
          // fallback above; same reasoning.
          copy[copy.length - 1] = { role: 'assistant', content: 'Sorry, I could not reach your coach just now. Try again in a moment.', synthetic: true }
          return copy
        })
      }
    } finally {
      abortRef.current = null
      setLoading(false)
    }
  }
  sendRef.current = send

  // Per-reply rating. Optimistic; reverts on a non-200. Re-clicking the active
  // thumb sends rating:null (undo). A down-vote opens the note box with a stronger
  // nudge. Ownership (own message only) is enforced server-side.
  const postRating = async (messageId, rating, comment) => {
    const res = await fetch('/api/coach-rate', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comment === undefined ? { messageId, rating } : { messageId, rating, comment }),
    })
    if (!res.ok) throw new Error('rate failed')
  }

  const rate = async (idx, messageId, value) => {
    const cur = messages[idx] || {}
    const next = (cur.rating || null) === value ? null : value
    const prev = { rating: cur.rating || null, ratingComment: cur.ratingComment || null }
    setMessages(m => {
      const c = [...m]
      c[idx] = next === null ? { ...c[idx], rating: null, ratingComment: null } : { ...c[idx], rating: next }
      return c
    })
    // Both thumbs auto-open the optional note (parity): down nudges for what was
    // off, up invites what worked. The note is optional and dismissible; the
    // rating itself posts immediately below and is never blocked by it. Undo
    // (next === null) closes the box.
    if (next === -1 || next === 1) { setCommentFor(messageId); setCommentDraft(cur.ratingComment || '') }
    else if (commentFor === messageId) setCommentFor(null)
    try { await postRating(messageId, next) }
    catch { setMessages(m => { const c = [...m]; c[idx] = { ...c[idx], ...prev }; return c }) }
  }

  const sendComment = async (idx, messageId) => {
    const text = commentDraft.trim().slice(0, 2000)
    const rating = messages[idx] && messages[idx].rating ? messages[idx].rating : -1
    setMessages(m => { const c = [...m]; c[idx] = { ...c[idx], rating, ratingComment: text || null }; return c })
    setCommentFor(null)
    try { await postRating(messageId, rating, text || null) } catch { /* keep optimistic; the rating itself already saved */ }
  }

  // Shared inner content: the scrolling transcript, the user-guide footer, and
  // the input row. Rendered into either the floating shell or the embedded one.
  // The transcript is `1 1 auto` with minHeight 0, not `flex: 1`. The embedded
  // panel no longer has a fixed height, and a flex-basis of 0% would contribute
  // nothing to the panel's natural height — the transcript would collapse and
  // the panel would sit at its floor however long the conversation got. Basis
  // auto lets the panel grow with the messages; minHeight 0 is what lets it
  // shrink and scroll inside once the panel hits its ceiling (a flex item
  // defaults to min-height:auto, which refuses to shrink below its content and
  // would overflow the panel instead of scrolling).
  const transcript = (
    <div ref={messagesContainerRef} style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '14px 18px' }}>
      {messages.map((m, i) => {
        const isCollapsedBanner = (m.banner || m.intro) && i < messages.length - 1 && !expandedBanners.has(i)
        // Same eligibility as isCollapsedBanner, minus the expanded check --
        // true whether the strip is showing or the person tapped it open.
        // Reported live (2026-09-05): the strip's tap toggled expandedBanners
        // in both directions, but nothing on the EXPANDED bubble called
        // toggleBannerExpanded back -- once opened, a superseded message had
        // no way to return to its one-line strip.
        const isExpandableBanner = (m.banner || m.intro) && i < messages.length - 1
        return (
        <div key={i} ref={el => { messageRefs.current[i] = el }} data-message-role={m.role} style={{ marginBottom: 12, textAlign: m.role === 'user' ? 'right' : 'left' }}>
          {isCollapsedBanner ? (
            <button onClick={() => toggleBannerExpanded(i)} style={{
              display: 'flex', alignItems: 'center', gap: 6, maxWidth: 'min(100%, 74ch)',
              background: '#F4F6F9', border: 'none', borderRadius: 8,
              padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            }}>
              <span aria-hidden="true" style={{ color: '#8A9BB8', fontSize: 16, flexShrink: 0 }}>›</span>
              <span style={{
                fontSize: 16, color: '#8A9BB8', lineHeight: 1.4,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {m.content}
              </span>
            </button>
          ) : (
          <div ref={el => { if (m.id) contentRefs.current[m.id] = el }} style={{
            // The coach's prose holds a readable line length however wide the
            // panel gets: past roughly 75 characters the eye starts losing its
            // place on the return sweep, so a full-width answer would take
            // fewer lines and be harder to read. The person's own messages are
            // short and stay narrower still, which keeps the two sides visually
            // distinct without a rule between them.
            display: 'inline-block',
            maxWidth: m.role === 'user' ? 'min(85%, 56ch)' : 'min(100%, 74ch)',
            padding: '10px 14px', borderRadius: 12,
            background: m.role === 'user' ? C.gold : '#F4F6F9',
            color: m.role === 'user' ? '#fff' : '#1A2540',
            fontSize: 18, lineHeight: 1.5, textAlign: 'left',
            // User messages render as plain text (pre-wrap preserves
            // newlines the user typed). Assistant messages route through
            // MD, which emits its own paragraph and list structure, so
            // pre-wrap would double-space its output.
            whiteSpace: m.role === 'user' ? 'pre-wrap' : 'normal',
          }}>
            {m.role === 'assistant' && !m.content && loading && i === messages.length - 1
              ? <span style={{ color: '#8A9BB8', fontStyle: 'italic' }}>Thinking…</span>
              : m.role === 'assistant'
                ? <MD text={m.content} />
                : m.content}
          </div>
          )}
          {!isCollapsedBanner && isExpandableBanner && (
            <button onClick={() => toggleBannerExpanded(i)} style={{
              display: 'block', marginTop: 4, background: 'transparent', border: 'none',
              color: '#8A9BB8', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
            }}>
              ‹ Collapse
            </button>
          )}
          {!isCollapsedBanner && m.role === 'assistant' && Array.isArray(m.quickReplies) && m.quickReplies.length > 0 && (
            <div data-print="hide" style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {m.quickReplies.map((opt, qi) => (
                <button key={qi} onClick={() => tapQuickReply(i, opt, m.checkinKey)}
                  style={{ background: '#fff', border: `1px solid ${C.gold}`, color: C.gold, borderRadius: 16, padding: '6px 16px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          {m.role === 'assistant' && m.id && (
            <div data-print="hide" style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => rate(i, m.id, 1)} aria-pressed={m.rating === 1} aria-label="Helpful"
                  style={{ background: m.rating === 1 ? '#E8F1EA' : 'transparent', border: `1px solid ${m.rating === 1 ? '#4A9E72' : '#D8DEE8'}`, color: m.rating === 1 ? '#2F7D54' : '#8A9BB8', borderRadius: 8, padding: '3px 10px', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Helpful
                </button>
                <button onClick={() => rate(i, m.id, -1)} aria-pressed={m.rating === -1} aria-label="Not helpful"
                  style={{ background: m.rating === -1 ? '#FBEBE8' : 'transparent', border: `1px solid ${m.rating === -1 ? '#C0432F' : '#D8DEE8'}`, color: m.rating === -1 ? '#C0432F' : '#8A9BB8', borderRadius: 8, padding: '3px 10px', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Not helpful
                </button>
                <button onClick={() => copyReply(m.id, m.content)} aria-label="Copy reply"
                  style={{ background: 'transparent', border: '1px solid #D8DEE8', color: copiedId === m.id ? '#2F7D54' : '#8A9BB8', borderRadius: 8, padding: '3px 10px', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {copiedId === m.id ? 'Copied' : 'Copy'}
                </button>
                {coachSaveTarget && (savedAs && savedAs.id === m.id
                  ? <span style={{ fontSize: 15, color: '#2F7D54' }}>Saved to {savedAs.title}</span>
                  : <button onClick={() => { const title = onSaveNote && onSaveNote(m.content); if (title) setSavedAs({ id: m.id, title }) }} aria-label="Save to this opportunity"
                      style={{ background: 'transparent', border: '1px solid #D8DEE8', color: '#8A9BB8', borderRadius: 8, padding: '3px 10px', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Save to this opportunity
                    </button>)}
                {m.rating && commentFor !== m.id && (
                  <button onClick={() => { setCommentFor(m.id); setCommentDraft(m.ratingComment || '') }}
                    style={{ background: 'none', border: 'none', color: '#8A9BB8', fontSize: 15, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
                    {m.ratingComment ? 'Edit note' : 'Add a note'}
                  </button>
                )}
                {m.ratingComment && commentFor !== m.id && <span style={{ fontSize: 15, color: '#8A9BB8' }}>note saved</span>}
              </div>
              {commentFor === m.id && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: '85%' }}>
                  <textarea ref={noteTaRef} value={commentDraft} onChange={e => setCommentDraft(e.target.value)} maxLength={2000} rows={2}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(i, m.id) } }}
                    placeholder={m.rating === -1 ? 'What was off? A sentence helps us improve your coach.' : 'Glad it helped. What worked? (optional)'}
                    style={{ border: '1px solid #D8DEE8', borderRadius: 8, padding: '8px 10px', fontSize: 15, fontFamily: 'inherit', color: '#1A2540', resize: 'vertical' }} />
                  <div ref={noteActionsRef} style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => sendComment(i, m.id)} style={{ background: C.gold, color: '#fff', border: 'none', borderRadius: 8, padding: '4px 12px', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Send</button>
                    <button onClick={() => setCommentFor(null)} style={{ background: 'none', border: 'none', color: '#8A9BB8', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>Skip</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )})}
    </div>
  )

  const inputRow = (
    <div style={{ borderTop: '1px solid #E2E5EA' }}>
      {allowGeneralMode && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 0', fontSize: 15, color: generalMode ? '#A06828' : '#8A9BB8', cursor: 'pointer', fontFamily: 'inherit' }}>
          <input type="checkbox" checked={generalMode} onChange={e => setGeneralMode(e.target.checked)} style={{ margin: 0, cursor: 'pointer' }} />
          General question — answer without my profile
        </label>
      )}
      <div style={{ padding: 12, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <textarea
        ref={inputTaRef}
        autoFocus
        rows={2}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
        placeholder="Ask your coach anything. Shift+Enter for a new line."
        disabled={loading}
        style={{
          flex: 1, padding: '8px 12px', border: '1px solid #E2E5EA',
          borderRadius: 8, fontSize: 18, fontFamily: 'inherit', color: '#1A2540',
          resize: 'vertical', lineHeight: 1.4, minHeight: 62, maxHeight: 220, overflowY: 'auto',
        }}
      />
      {hasSpeech && <SpeechBtn ref={speechBtnRef} onResult={t => setInput((input || '') + t)} C={C} title="Speak your question" />}
      <button
        onClick={loading ? () => { if (abortRef.current) abortRef.current.abort() } : send}
        disabled={!loading && !input.trim()}
        style={{
          background: loading ? '#fff' : C.gold, color: loading ? C.gold : '#fff',
          border: loading ? `1px solid ${C.gold}` : 'none',
          borderRadius: 8, padding: '8px 14px', cursor: (!loading && !input.trim()) ? 'default' : 'pointer',
          fontFamily: 'inherit', fontSize: 17, fontWeight: 600,
          opacity: (!loading && !input.trim()) ? 0.6 : 1,
        }}
      >
        {loading ? 'Stop' : 'Send'}
      </button>
      </div>
    </div>
  )

  // Embedded variant: full-width panel inside the content column (the My Coach
  // sidebar view). No fixed positioning, no bubble, no close button.
  if (embedded) {
    return (
      <div ref={panelRef} data-print="hide" style={{
        display: 'flex', flexDirection: 'column',
        minHeight: 360,
        maxHeight: panelMaxH ? `${panelMaxH}px` : 'min(72dvh, 720px)',
        // Fills the content column. The old 820px cap was doing two jobs at
        // once -- keeping the READING measure sane and, as a side effect,
        // leaving most of a wide screen empty. The measure is a property of the
        // text, so it now lives on the message bubbles below, where it belongs;
        // the panel itself takes the room, which is what the input row, the
        // person's own messages and the one-tap save offers actually want.
        maxWidth: '100%',
        background: '#fff', border: '1px solid #E2E5EA', borderRadius: 14,
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)', overflow: 'hidden',
        fontFamily: 'inherit',
      }}>
        {/* Thinking indicator (2026-09-07, live QA follow-on): the closed-
            bubble dot that signals a silent background reaction is in
            flight (src/App.jsx's orientationCheck POSTs -- exactly what
            fires heaviest during orientation) only ever renders in the
            floating, closed-bubble branch below. The embedded panel is now
            the sole surface for the whole orientation flow, so without this
            it went dark for precisely the screens that generate the most
            of those reactions -- a reply would just pop in unannounced,
            undoing the reason the dot was built in the first place. */}
        {thinking && <style>{"@keyframes pe-chat-thinking-dot{0%,100%{opacity:0.35}50%{opacity:1}}"}</style>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 18px 0' }}>
          {thinking ? (
            <span role="status" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, color: '#8A9BB8' }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: C.gold, animation: 'pe-chat-thinking-dot 1.1s ease-in-out infinite' }}/>
              Coach is thinking
            </span>
          ) : <span/>}
          <button
            onClick={() => { if (window.confirm('This clears your entire conversation with Coach, including everything it has noticed about you so far.\n\nThis cannot be undone.\n\nContinue?')) setMessages([INTRO_MSG]) }}
            style={{ background: 'none', border: 'none', color: '#8A9BB8', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}
            aria-label="Clear conversation"
          >
            Clear
          </button>
        </div>
        {transcript}
        {inputRow}
      </div>
    )
  }

  if (!open) {
    return (
      <>
        {showPulse && !bannerMsg && <style>{"@keyframes pe-chat-pulse-scale{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}@keyframes pe-chat-pulse-fade{0%,100%{opacity:0.7}50%{opacity:1}}"}</style>}
        {thinking && <style>{"@keyframes pe-chat-thinking-dot{0%,100%{opacity:0.35}50%{opacity:1}}"}</style>}
        <div data-print="hide" style={{
          position: 'fixed', bottom: 24 + bottomOffset, right: 24, zIndex: 1000,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10,
        }}>
          {bannerMsg && (
            <div role="status" onClick={() => setOpen(true)} style={{
              background: '#fff', border: `1px solid ${C.gold}`, borderRadius: 12,
              padding: '12px 14px', width: 'min(320px, calc(100vw - 48px))',
              boxShadow: '0 6px 20px rgba(0,0,0,0.18)', cursor: 'pointer',
              fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: '.03em' }}>Coach</span>
                <button
                  onClick={e => { e.stopPropagation(); setBannerMsg(null) }}
                  aria-label="Dismiss"
                  style={{ background: 'none', border: 'none', color: '#8A9BB8', cursor: 'pointer', fontSize: 17, lineHeight: 1, padding: 0, fontFamily: 'inherit' }}
                >
                  &times;
                </button>
              </div>
              <div style={{
                fontSize: 16, color: '#1A2540', lineHeight: 1.5,
                overflow: 'hidden', textOverflow: 'ellipsis',
                display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
              }}>
                {bannerMsg}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!bannerMsg && showPulse && (
              <div style={{
                background: '#fff',
                border: `1px solid ${C.gold}`,
                color: C.gold,
                padding: '6px 12px',
                borderRadius: 16,
                fontSize: 15,
                fontWeight: 600,
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                animation: 'pe-chat-pulse-fade 2s ease-in-out infinite',
                fontFamily: 'inherit',
              }}>
                Talk to your coach
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <button
                ref={bubbleBtnRef}
                onClick={() => { setOpen(true); if (onDismissPulse) onDismissPulse() }}
                style={{
                  background: C.gold, color: '#fff', border: 'none',
                  borderRadius: '50%', width: 56, height: 56,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  fontSize: 22, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
                  animation: (showPulse && !bannerMsg) ? 'pe-chat-pulse-scale 2s ease-in-out infinite' : 'none',
                }}
                aria-label={thinking ? 'Coach is thinking. Open My Coach' : (showPulse ? 'Talk to your coach. Open My Coach' : 'Open My Coach')}
              >
                ?
              </button>
              {/* Reported live: the reaction to a pasted resume or LinkedIn
                  upload is a real network call, often several seconds, and
                  the person is usually already on the next screen by the
                  time it lands -- with nothing to say Coach was ever working
                  on it. This dot is the entire fix: visible the moment the
                  request goes out, gone the moment every request in flight
                  has resolved. Decorative (aria-hidden); the aria-label
                  above already carries the same information for a screen
                  reader. */}
              {thinking && (
                <div aria-hidden="true" style={{
                  position: 'absolute', top: -2, right: -2, width: 14, height: 14,
                  borderRadius: '50%', background: '#fff', border: `2px solid ${C.gold}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)', pointerEvents: 'none',
                }}>
                  <div style={{
                    width: '100%', height: '100%', borderRadius: '50%', background: C.gold,
                    animation: 'pe-chat-thinking-dot 1.1s ease-in-out infinite',
                  }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <div data-print="hide" style={isMobile ? {
      // PHONE: a bottom sheet, not a floating card. The corner panel was sized
      // for a laptop, where it covers a fraction of the screen; on a phone it
      // resolved to nearly full width and sat on top of the content (and the
      // buttons) it was answering questions about. The sheet is anchored to the
      // bottom edge with only its top corners rounded, so a strip of the page
      // stays visible above it and the reader keeps their place.
      //
      // It sits ABOVE the playbook action bar rather than over it (bottom is
      // bottomOffset, not 0), so Save as PDF stays reachable while it is open,
      // and its height reserves that same offset plus a 56px strip of page.
      position: 'fixed', left: 0, right: 0, bottom: bottomOffset, zIndex: 1000,
      width: '100%', maxWidth: '100%',
      height: `min(78dvh, calc(100dvh - ${56 + bottomOffset}px))`,
      background: '#fff',
      borderTop: '1px solid #E2E5EA',
      borderRadius: '16px 16px 0 0',
      boxShadow: '0 -6px 28px rgba(0,0,0,0.22)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'inherit',
    } : {
      position: 'fixed', bottom: 24 + bottomOffset, right: 24, zIndex: 1000,
      // Sized for reading, but pulled back from PR #358's half-screen footprint
      // (2026-08-09, min(50vw, 760px)) to min(44vw, 620px): the panel floats over
      // the Focus content column it is answering questions about, so a narrower
      // ceiling covers less of it (especially the Generate button). Floor stays at
      // the old 480px so it never gets cramped on small windows, and the ceiling
      // still stops short of full-screen (that's the My Coach sidebar view's job).
      //
      // Maximize (2026-09-06): a reversible size toggle, not a second My Coach
      // destination -- the whole point is that it stays a panel over the current
      // screen, not a replacement for it. maxWidth is a hard 300px reserve, not
      // just vw math, specifically so the 260px nav rail (src/App.jsx Sidebar,
      // railBase width:260) can never be covered even at the toggle's largest
      // size -- staying visible is what keeps this reading as part of the
      // workspace instead of a takeover, the same property VS Code's own
      // maximized panel keeps by leaving its activity bar on screen.
      width: isMaximized ? 'min(70vw, 1040px)' : 'min(44vw, 620px)',
      minWidth: 'min(480px, calc(100vw - 24px))',
      maxWidth: isMaximized ? 'calc(100vw - 300px)' : 'calc(100vw - 24px)',
      // maxHeight has to reserve the bottom anchor too, not just the 24px gap at
      // each end. The panel is bottom-anchored at 24 + bottomOffset and grows
      // upward, so with bottomOffset at 72 (any playbook surface, src/App.jsx
      // renders showPlaybookFooter ? 72 : 0) the top edge lands at 14vh - 96px
      // and goes negative on any viewport under roughly 686px. On a 1366x768
      // laptop that put the header, and the only close button, above the top of
      // the window. That is the "the X is hidden" report from 2026-08-06.
      height: isMaximized ? 'min(94dvh, 1400px)' : 'min(86dvh, 900px)',
      maxHeight: `calc(100dvh - ${(isMaximized ? 16 : 48) + bottomOffset}px)`,
      transition: 'width 0.16s ease, height 0.16s ease, max-width 0.16s ease',
      background: '#fff',
      border: '1px solid #E2E5EA', borderRadius: 14,
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'inherit',
    }}>
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid #E2E5EA',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontFamily: 'Georgia,serif', fontSize: 19, fontWeight: 600, color: C.gold }}>My Coach</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={() => setMessages([INTRO_MSG])}
            style={{ background: 'none', border: 'none', color: '#8A9BB8', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}
            aria-label="Clear conversation"
          >
            Clear
          </button>
          {!isMobile && (
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              style={{ background: 'none', border: 'none', color: '#8A9BB8', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}
              aria-label={isMaximized ? 'Restore to default size' : 'Expand for more room'}
            >
              {isMaximized ? 'Restore' : 'Expand'}
            </button>
          )}
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#4A5568', fontFamily: 'inherit' }} aria-label="Close">×</button>
        </div>
      </div>
      {transcript}
      {inputRow}
    </div>
  )
}
