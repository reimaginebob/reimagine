import { useState, useEffect, useRef } from 'react'
import MD from './MD'
import SpeechBtn, { hasSpeech } from './SpeechBtn'

const INTRO_MSG = { role: 'assistant', content: "Hi, I'm your coach. Ask me anything about your search — where to focus, how to tell your story, how to prepare for a conversation — and I'll work from what Reimagine already knows about you." }

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
export default function Chat({ currentStep, C, showPulse, onDismissPulse, messages, setMessages, bottomOffset = 0, embedded = false, openRequest = 0, seed = '', onSeedConsumed, coachSaveTarget = null, onSaveNote }) {
  const [open, setOpen] = useState(false)
  // App bumps openRequest to open the floating coach programmatically (e.g. the
  // Personal Brand check-in on first arrival at Put it to Work).
  useEffect(() => { if (openRequest) setOpen(true) }, [openRequest])
  const [input, setInput] = useState('')
  // Save-to-opportunity (PR-5, item I): transient per-reply UI state for the Copy
  // and "Save to this opportunity" actions. The save itself goes through the app
  // (onSaveNote -> setSavedPlaybooks); this component never writes.
  const [copiedId, setCopiedId] = useState(null)
  const [savedAs, setSavedAs] = useState(null)
  // Coach doors (PR-3, item H): when opened with a seed (e.g. "Help me prep for
  // my interview with Renata…"), prefill the input once so the user can review
  // and send. Consumed and cleared by the parent; never auto-sends.
  useEffect(() => {
    if (seed && seed.trim()) {
      setInput(seed)
      if (typeof onSeedConsumed === 'function') onSeedConsumed()
    }
  }, [seed])
  const [loading, setLoading] = useState(false)
  const messagesContainerRef = useRef(null)
  // Per-message DOM refs populated by the ref callback in the messages.map
  // render. Indexed by position in the messages array. The scroll effect
  // below pins the user's most recent question to the top of the visible
  // chat area so the assistant response reads downward from a fixed eyeline.
  const messageRefs = useRef([])
  // Per-reply feedback: which message's comment box is open, and its draft text.
  const [commentFor, setCommentFor] = useState(null)
  const [commentDraft, setCommentDraft] = useState('')

  useEffect(() => {
    if (!messages || messages.length === 0) return
    // Find the most recent user message and scroll it to the top of the
    // messages container. Replaces the prior scroll-to-bottom behavior,
    // which pushed the start of each new answer above the visible area.
    let lastUserIdx = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUserIdx = i; break }
    }
    if (lastUserIdx < 0) return
    const el = messageRefs.current[lastUserIdx]
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }, [messages, loading])

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
    try {
      await fetch('/api/pb-checkin', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkin: checkinKey || 'personal-brand', answer: opt.value }),
      })
    } catch { /* the conversation already continued; the tap is best-effort */ }
  }

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    const historyAtSend = messages
    setMessages(m => [...m, userMsg, { role: 'assistant', content: '' }])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          history: historyAtSend,
          currentStep,
          // Entry point for insight logging: the embedded variant is the My
          // Coach sidebar; the floating variant is the help bubble.
          surface: embedded ? 'sidebar' : 'help',
        }),
      })
      if (!res.ok || !res.body) {
        const fallback = res.status === 401
          ? 'Sign in first to talk with your coach.'
          : 'Sorry, something went wrong. Try again in a moment.'
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
      }
    } catch {
      setMessages(m => {
        const copy = [...m]
        copy[copy.length - 1] = { role: 'assistant', content: 'Sorry, I could not reach your coach just now. Try again in a moment.' }
        return copy
      })
    } finally {
      setLoading(false)
    }
  }

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
  const transcript = (
    <div ref={messagesContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
      {messages.map((m, i) => (
        <div key={i} ref={el => { messageRefs.current[i] = el }} data-message-role={m.role} style={{ marginBottom: 12, textAlign: m.role === 'user' ? 'right' : 'left' }}>
          <div style={{
            display: 'inline-block', maxWidth: '85%',
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
          {m.role === 'assistant' && Array.isArray(m.quickReplies) && m.quickReplies.length > 0 && (
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
                  style={{ background: m.rating === 1 ? '#E8F1EA' : 'transparent', border: `1px solid ${m.rating === 1 ? '#4A9E72' : '#D8DEE8'}`, color: m.rating === 1 ? '#2F7D54' : '#8A9BB8', borderRadius: 8, padding: '3px 10px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Helpful
                </button>
                <button onClick={() => rate(i, m.id, -1)} aria-pressed={m.rating === -1} aria-label="Not helpful"
                  style={{ background: m.rating === -1 ? '#FBEBE8' : 'transparent', border: `1px solid ${m.rating === -1 ? '#C0432F' : '#D8DEE8'}`, color: m.rating === -1 ? '#C0432F' : '#8A9BB8', borderRadius: 8, padding: '3px 10px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Not helpful
                </button>
                <button onClick={() => { try { navigator.clipboard && navigator.clipboard.writeText(m.content) } catch {} ; setCopiedId(m.id) }} aria-label="Copy reply"
                  style={{ background: 'transparent', border: '1px solid #D8DEE8', color: copiedId === m.id ? '#2F7D54' : '#8A9BB8', borderRadius: 8, padding: '3px 10px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {copiedId === m.id ? 'Copied' : 'Copy'}
                </button>
                {coachSaveTarget && (savedAs && savedAs.id === m.id
                  ? <span style={{ fontSize: 12, color: '#2F7D54' }}>Saved to {savedAs.title}</span>
                  : <button onClick={() => { const title = onSaveNote && onSaveNote(m.content); if (title) setSavedAs({ id: m.id, title }) }} aria-label="Save to this opportunity"
                      style={{ background: 'transparent', border: '1px solid #D8DEE8', color: '#8A9BB8', borderRadius: 8, padding: '3px 10px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Save to this opportunity
                    </button>)}
                {m.rating && commentFor !== m.id && (
                  <button onClick={() => { setCommentFor(m.id); setCommentDraft(m.ratingComment || '') }}
                    style={{ background: 'none', border: 'none', color: '#8A9BB8', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
                    {m.ratingComment ? 'Edit note' : 'Add a note'}
                  </button>
                )}
                {m.ratingComment && commentFor !== m.id && <span style={{ fontSize: 12, color: '#8A9BB8' }}>note saved</span>}
              </div>
              {commentFor === m.id && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: '85%' }}>
                  <textarea value={commentDraft} onChange={e => setCommentDraft(e.target.value)} maxLength={2000} rows={2} autoFocus
                    placeholder={m.rating === -1 ? 'What was off? A sentence helps us improve your coach.' : 'Glad it helped. What worked? (optional)'}
                    style={{ border: '1px solid #D8DEE8', borderRadius: 8, padding: '8px 10px', fontSize: 14, fontFamily: 'inherit', color: '#1A2540', resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => sendComment(i, m.id)} style={{ background: C.gold, color: '#fff', border: 'none', borderRadius: 8, padding: '4px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Send</button>
                    <button onClick={() => setCommentFor(null)} style={{ background: 'none', border: 'none', color: '#8A9BB8', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Skip</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )

  const inputRow = (
    <div style={{ padding: 12, borderTop: '1px solid #E2E5EA', display: 'flex', gap: 8 }}>
      <input
        type="text"
        autoFocus
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && send()}
        placeholder="Ask your coach anything about your search"
        disabled={loading}
        style={{
          flex: 1, padding: '8px 12px', border: '1px solid #E2E5EA',
          borderRadius: 8, fontSize: 18, fontFamily: 'inherit', color: '#1A2540',
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
  )

  // Embedded variant: full-width panel inside the content column (the My Coach
  // sidebar view). No fixed positioning, no bubble, no close button.
  if (embedded) {
    return (
      <div data-print="hide" style={{
        display: 'flex', flexDirection: 'column',
        height: 'min(72vh, 720px)', maxWidth: 820,
        background: '#fff', border: '1px solid #E2E5EA', borderRadius: 14,
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)', overflow: 'hidden',
        fontFamily: 'inherit',
      }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '10px 18px 0' }}>
          <button
            onClick={() => setMessages([INTRO_MSG])}
            style={{ background: 'none', border: 'none', color: '#8A9BB8', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
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
        {showPulse && <style>{"@keyframes pe-chat-pulse-scale{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}@keyframes pe-chat-pulse-fade{0%,100%{opacity:0.7}50%{opacity:1}}"}</style>}
        <div data-print="hide" style={{
          position: 'fixed', bottom: 24 + bottomOffset, right: 24, zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {showPulse && (
            <div style={{
              background: '#fff',
              border: `1px solid ${C.gold}`,
              color: C.gold,
              padding: '6px 12px',
              borderRadius: 16,
              fontSize: 14,
              fontWeight: 600,
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              animation: 'pe-chat-pulse-fade 2s ease-in-out infinite',
              fontFamily: 'inherit',
            }}>
              Talk to your coach
            </div>
          )}
          <button
            onClick={() => { setOpen(true); if (onDismissPulse) onDismissPulse() }}
            style={{
              background: C.gold, color: '#fff', border: 'none',
              borderRadius: '50%', width: 56, height: 56,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              fontSize: 22, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
              animation: showPulse ? 'pe-chat-pulse-scale 2s ease-in-out infinite' : 'none',
            }}
            aria-label={showPulse ? 'Talk to your coach. Open My Coach' : 'Open My Coach'}
          >
            ?
          </button>
        </div>
      </>
    )
  }

  return (
    <div data-print="hide" style={{
      position: 'fixed', bottom: 24 + bottomOffset, right: 24, zIndex: 1000,
      width: 480, maxWidth: 'calc(100vw - 24px)', height: 680, maxHeight: 'calc(100vh - 48px)',
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
            style={{ background: 'none', border: 'none', color: '#8A9BB8', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
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
