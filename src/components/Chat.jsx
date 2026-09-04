import { useState, useEffect, useRef } from 'react'
import MD from './MD'
import SpeechBtn, { hasSpeech } from './SpeechBtn'
import { useIsMobile } from '../use-is-mobile.js'

export const INTRO_MSG = { role: 'assistant', content: "Hi, I'm your coach. Ask me anything about your search — where to focus, how to tell your story, how to prepare for a conversation — and I'll work from what Reimagine already knows about you." }

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
export default function Chat({ currentStep, C, showPulse, onDismissPulse, messages, setMessages, bottomOffset = 0, embedded = false, openRequest = 0, seed = '', seedAuto = false, onSeedConsumed, coachSaveTarget = null, onSaveNote, onQuickReply = null, onOpen = null, employmentCaptureActive = false, employmentOfferMessage = null, pursuitCaptureActive = false, pursuitOfferMessage = null, interviewTeamCaptureActive = false, valuesCaptureActive = false, assessmentCaptureActive = false, brandReworkCaptureActive = false, pipelineCaptureActive = false, activityCaptureActive = false, sessionOpenEligible = false, allowGeneralMode = false, thinking = false }) {
  // General-question mode (Career Club team only): ask a general/client question
  // without this account's job-search profile loaded. The toggle only renders
  // when allowGeneralMode is passed; the flag is re-checked server-side.
  const [generalMode, setGeneralMode] = useState(false)
  const [open, setOpen] = useState(false)
  // App bumps openRequest to open the floating coach programmatically (e.g. the
  // Personal Brand check-in on first arrival at Put it to Work).
  useEffect(() => { if (openRequest) setOpen(true) }, [openRequest])
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
  useEffect(() => {
    if (!sessionOpenEligible) return
    if (!embedded && !open) return
    let already = false
    try { already = sessionStorage.getItem('reimagine_session_recap_fired') === '1' } catch {}
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
  const bannerPrevLenRef = useRef(0)
  useEffect(() => {
    const len = messages ? messages.length : 0
    const prevLen = bannerPrevLenRef.current
    bannerPrevLenRef.current = len
    if (len <= prevLen || open) return
    const added = messages.slice(prevLen)
    const latest = [...added].reverse().find(m => m.banner)
    if (!latest) return
    setBannerMsg(latest.content)
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
      c.push({ role: 'user', content: opt.label })
      if (opt.followUp) c.push({ role: 'assistant', content: opt.followUp })
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
    try {
      const handled = onQuickReply ? await onQuickReply(checkinKey, opt.value) : false
      if (handled && typeof handled === 'object' && handled.content) {
        setMessages(m => [...m, { role: 'assistant', ...handled }])
      }
      if (!handled) {
        await fetch('/api/pb-checkin', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkin: checkinKey || 'personal-brand', answer: opt.value }),
        })
      }
    } catch { /* the conversation already continued; the tap is best-effort */ }
  }

  // `silent` (session-open recap, Phase 1): the app fires this itself, with
  // no typed text and no user bubble — the coach speaks first with what
  // changed since the account's last session. Everything below reduces to
  // the same request/stream/log path a normal send takes; the two
  // differences are what goes in the request body (sessionOpen instead of a
  // message) and that nothing is pushed into the transcript until we know
  // there is something to show (a 204 means there wasn't, and that renders
  // nothing at all rather than a bubble that briefly appears and vanishes).
  const send = async (explicit, { silent = false } = {}) => {
    const text = silent ? '' : (typeof explicit === 'string' ? explicit : input).trim()
    if (silent) { if (loading) return } else if (!text || loading) return
    const userMsg = { role: 'user', content: text }
    // (sendRef is refreshed just below so the seed effect can call the latest send.)
    const historyAtSend = messages
    if (silent) {
      setLoading(true)
    } else {
      setMessages(m => [...m, userMsg, { role: 'assistant', content: '' }])
      setInput('')
      setLoading(true)
    }
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(silent ? { sessionOpen: true } : { message: userMsg.content }),
          history: historyAtSend,
          currentStep,
          // Entry point for insight logging: the embedded variant is the My
          // Coach sidebar; the floating variant is the help bubble.
          surface: embedded ? 'sidebar' : 'help',
          // General-question mode (Career Club team only; re-checked server-side).
          // Never sent on a silent open — the recap needs this account's real
          // profile, and general mode explicitly has none loaded.
          general: silent ? false : generalMode,
          // Which saved opportunity this conversation is pinned to, when the app
          // knows. The server otherwise infers it by scanning the person's own
          // words for the title or company (findInFocusRecord), which works for
          // the pre-filled "read on this opportunity" prompt and not at all for
          // someone who opened the Coach from inside a playbook and simply said
          // what they are doing next. Sent as a hint only: the server re-checks
          // that the id belongs to this account's saved work before using it.
          focusRecordId: (coachSaveTarget && coachSaveTarget.id) || undefined,
        }),
      })
      if (silent && res.status === 204) {
        // Nothing to recap (no prior session to diff against, or the pilot
        // turned out not to be on) — say nothing, exactly as if this call had
        // never been made.
        setLoading(false)
        return
      }
      if (silent && !res.ok) {
        // A proactive opener nobody asked for; a failure here should not
        // greet the person with an error message they never triggered. A
        // normal send still shows its fallback below — this branch only
        // covers the silent path.
        setLoading(false)
        return
      }
      if (silent) setMessages(m => [...m, { role: 'assistant', content: '' }])
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
          copy[copy.length - 1] = { role: 'assistant', content: fallback }
          return copy
        })
      } else {
        // The persisted reply row id rides back on this header (same-origin, so
        // it's readable without CORS config). Stash it on the assistant message so
        // the thumbs below it can attach a rating to that exact row.
        const msgId = res.headers.get('X-Coach-Message-Id') || null
        const itHeader = res.headers.get('X-Coach-Interviewers') || null
        const vcHeader = res.headers.get('X-Coach-Values') || null
        const assessHeader = res.headers.get('X-Coach-Assessment') || null
        const brHeader = res.headers.get('X-Coach-Brand-Rework') || null
        const pcHeader = res.headers.get('X-Coach-Pipeline') || null
        const acHeader = res.headers.get('X-Coach-Activity') || null
        const siHeader = res.headers.get('X-Coach-Search-Intake') || null
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
        // Interview-team capture: the server extracted people the user named as
        // interviewers onto the X-Coach-Interviewers header. Offer a one-tap add.
        if (interviewTeamCaptureActive && itHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(itHeader), c => c.charCodeAt(0))))
            const names = (data && Array.isArray(data.people) ? data.people : []).map(p => p && p.name).filter(Boolean)
            if (names.length) {
              const where = data.opportunity ? ` to your ${data.opportunity} Interview Team` : ' to your Interview Team'
              setMessages(m => [...m, { role: 'assistant', content: `It looks like you're interviewing with ${names.join(', ')}. Want me to add ${names.length > 1 ? 'them' : 'them'}${where}?`, checkinKey: 'interview-team', quickReplies: [{ label: 'Add to my team', value: JSON.stringify(data), followUp: 'Added to your Interview Team.' }, { label: 'Not now', value: 'dismiss' }] }])
            }
          } catch { /* malformed header — no offer */ }
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
        // Pipeline capture: the server extracted a next move, a scheduled meeting,
        // or both. Show the exact wording and the resolved dates ON the button —
        // voice input is least reliable on names and numbers, and this is entirely
        // names and numbers, so the interpretation has to be visible BEFORE the tap
        // rather than discovered two weeks later when the plan is wrong.
        if (pipelineCaptureActive && pcHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(pcHeader), c => c.charCodeAt(0))))
            const move = data && typeof data.move === 'string' ? data.move.trim() : ''
            const meeting = data && typeof data.meeting === 'string' ? data.meeting.trim() : ''
            // Formatted in UTC: these are calendar days, not instants, and a local
            // rendering can show the day before.
            const fmt = d => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
            if (move || meeting) {
              const where = data.opportunity ? ` on ${data.opportunity}` : ''
              // One offer covering whatever they said, so a sentence carrying both
              // does not produce two competing buttons under one reply.
              const lines = []
              if (move) lines.push(`Next move: ${move}${data.date ? ` — ${fmt(data.date)}` : ' — no date set'}`)
              if (meeting) lines.push(`Next scheduled meeting: ${fmt(meeting)}`)
              const what = (move && meeting) ? 'both of those' : (meeting ? 'that meeting' : 'that')
              setMessages(m => [...m, {
                role: 'assistant',
                content: `Want me to put ${what} on My Pipeline${where}? You can change it there any time.\n\n${lines.join('\n')}`,
                checkinKey: 'pursuit-update',
                quickReplies: [
                  { label: 'Save it', value: JSON.stringify(data), followUp: 'Saved to My Pipeline.' },
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
              setMessages(m => [...m, { role: 'assistant', content: `Want me to keep this on your profile? I'd read it as background on where things stand, not as a fixed picture, and it lives on your Your Current Situation screen if you want to change it.\n\n${label}: ${body}`, checkinKey: 'search-intake', quickReplies: [{ label: 'Keep it', value: JSON.stringify(data), followUp: 'Kept.' }, { label: 'Not now', value: 'dismiss' }] }])
            }
          } catch { /* malformed header — no offer */ }
        }
      }
    } catch {
      // A silent open never pushed a placeholder to overwrite here (it only
      // does that once a real, non-204 response is in hand) -- so on a thrown
      // error (network down, etc.) there is nothing of its own to fail into,
      // and clobbering whatever the transcript's real last message happens to
      // be would be worse than saying nothing. Fail exactly as silently as
      // the 204/!res.ok branches above do.
      if (!silent) {
        setMessages(m => {
          const copy = [...m]
          copy[copy.length - 1] = { role: 'assistant', content: 'Sorry, I could not reach your coach just now. Try again in a moment.' }
          return copy
        })
      }
    } finally {
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
        const isCollapsedBanner = m.banner && i < messages.length - 1 && !expandedBanners.has(i)
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
      {hasSpeech && <SpeechBtn onResult={t => setInput((input || '') + t)} C={C} title="Speak your question" />}
      <button
        onClick={send}
        disabled={loading || !input.trim()}
        style={{
          background: C.gold, color: '#fff', border: 'none',
          borderRadius: 8, padding: '8px 14px', cursor: loading || !input.trim() ? 'default' : 'pointer',
          fontFamily: 'inherit', fontSize: 17, fontWeight: 600,
          opacity: loading || !input.trim() ? 0.6 : 1,
        }}
      >
        Send
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '10px 18px 0' }}>
          <button
            onClick={() => setMessages([INTRO_MSG])}
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
      width: 'min(44vw, 620px)', minWidth: 'min(480px, calc(100vw - 24px))', maxWidth: 'calc(100vw - 24px)',
      // maxHeight has to reserve the bottom anchor too, not just the 24px gap at
      // each end. The panel is bottom-anchored at 24 + bottomOffset and grows
      // upward, so with bottomOffset at 72 (any playbook surface, src/App.jsx
      // renders showPlaybookFooter ? 72 : 0) the top edge lands at 14vh - 96px
      // and goes negative on any viewport under roughly 686px. On a 1366x768
      // laptop that put the header, and the only close button, above the top of
      // the window. That is the "the X is hidden" report from 2026-08-06.
      height: 'min(86dvh, 900px)', maxHeight: `calc(100dvh - ${48 + bottomOffset}px)`,
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
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#4A5568', fontFamily: 'inherit' }} aria-label="Close">×</button>
        </div>
      </div>
      {transcript}
      {inputRow}
    </div>
  )
}
