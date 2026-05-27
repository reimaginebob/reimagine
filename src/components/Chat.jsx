import { useState, useEffect, useRef } from 'react'
import MD from './MD'

const INTRO_MSG = { role: 'assistant', content: 'Hi. I can help you with how Reimagine works. What would you like to know?' }

// Mirror of META in src/App.jsx. The build-time invariant in
// scripts/check-prompt-refs.mjs verifies every key here exists in META
// AND that each STEP_LABELS value matches the corresponding META value.
const STEP_LABELS = {
  welcome: 'Welcome',
  location: 'Location & Work',
  resume: 'Your Resume',
  linkedin: 'Your LinkedIn',
  assessment: 'Assessments',
  values: 'Values, Passions & Causes',
  reputation: 'Reputation',
  'life-events': 'Your Story',
  'skills': 'Your Skills',
  'orientation-done': 'Orientation Complete',
  p3: 'Personal Brand',
  twoDoors: 'Choose Your Path',
  laneSelect: 'Pick a Direction',
  p4: 'Role Options',
  focus: 'Focus Playbook',
  mylib: 'My Playbooks',
  p6: 'Your Bridge Story',
  p7: 'Go-to-Market',
  p8: 'LinkedIn Remix',
  p_res: 'Resume Refresh',
  p9: 'Industry Background',
  p10: 'Interview Prep',
  complete: 'Complete',
  income: 'Income Now',
  op: 'Upload a Live Opportunity',
}
const VALID_STEPS = new Set(Object.keys(STEP_LABELS))

// Post-Personal-Brand step ids. The chat helper refuses to set a
// message.navigateTo for any of these when personalBrandDone is false,
// because their pages assert "Your Personal Brand is built" or depend on
// outputs that do not yet exist. The gate enforces deterministically at
// the parser below (Layer 2); nav() in App.jsx is a Layer 3 safety net
// for any future entry point that bypasses this parser. The server-side
// check in api/chat.js is observability: it logs navigation_blocked rows
// to chat_messages so we can audit how often the LLM violates the prompt
// instruction documented in SYSTEM_PROMPT. p11 is intentionally absent:
// it is not a NAVIGATE target in the current api/chat.js step-id table.
const POST_P3_STEPS = new Set(['twoDoors','laneSelect','p4','focus','mylib','p6','p7','p8','p_res','p9','p10','complete','income','op'])

export default function Chat({ currentStep, onNavigate, C, showPulse, onDismissPulse, messages, setMessages, bottomOffset = 0, personalBrandDone = false }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesContainerRef = useRef(null)
  // Per-message DOM refs populated by the ref callback in the messages.map
  // render. Indexed by position in the messages array. The scroll effect
  // below pins the user's most recent question to the top of the visible
  // chat area so the assistant response reads downward from a fixed eyeline.
  const messageRefs = useRef([])

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

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    const historyAtSend = messages
    setMessages(m => [...m, userMsg, { role: 'assistant', content: '', navigateTo: null }])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          history: historyAtSend,
          currentStep,
          personalBrandDone,
        }),
      })
      if (!res.ok || !res.body) {
        const fallback = res.status === 401
          ? 'Sign in first to use Reimagine Help.'
          : 'Sorry, something went wrong. Try again in a moment.'
        setMessages(m => {
          const copy = [...m]
          copy[copy.length - 1] = { role: 'assistant', content: fallback }
          return copy
        })
      } else {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let fullText = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullText += decoder.decode(value, { stream: true })
          // Hide any trailing NAVIGATE line from the visible bubble as it
          // streams. Catches both the common case (newline before NAVIGATE)
          // and the rare case where NAVIGATE starts the buffer with no
          // preceding newline (the LLM occasionally drops the leading break).
          const navIdx = (() => {
            const withNewline = fullText.lastIndexOf('\nNAVIGATE')
            if (withNewline >= 0) return withNewline
            if (fullText.startsWith('NAVIGATE')) return 0
            return -1
          })()
          const visible = navIdx >= 0 ? fullText.slice(0, navIdx).trimEnd() : fullText
          setMessages(m => {
            const copy = [...m]
            copy[copy.length - 1] = { ...copy[copy.length - 1], content: visible }
            return copy
          })
        }
        // Regex [\w-]+ (not \w+) so hyphenated step ids like life-events and
        // orientation-done are captured. Same fix lives in api/chat.js:173.
        // Synchronous gate: when personalBrandDone is false and the LLM
        // targets a post-p3 step, navigateTo stays null and the "Take me to
        // X" button does not render. The gate check and the assignment are
        // intentionally in the same synchronous block so there is no flicker
        // window where the button briefly appears then disappears.
        const navMatch = fullText.match(/\n?NAVIGATE:\s*([\w-]+)\s*$/i)
        const parsedTarget = navMatch ? navMatch[1] : null
        const blockedByGate = parsedTarget && !personalBrandDone && POST_P3_STEPS.has(parsedTarget)
        const navigateTo = blockedByGate ? null : parsedTarget
        if (blockedByGate && import.meta.env.DEV) {
          console.warn('[chat-gate] blocked navigation to', parsedTarget, '(Personal Brand not yet built)')
        }
        if (navigateTo) {
          setMessages(m => {
            const copy = [...m]
            copy[copy.length - 1] = { ...copy[copy.length - 1], navigateTo }
            return copy
          })
        }
      }
    } catch {
      setMessages(m => {
        const copy = [...m]
        copy[copy.length - 1] = { role: 'assistant', content: 'Sorry, I could not reach Reimagine Help just now. Try again in a moment.' }
        return copy
      })
    } finally {
      setLoading(false)
    }
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
              Need help?
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
            aria-label={showPulse ? 'Need help? Open Reimagine Help' : 'Open Reimagine Help'}
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
        <div style={{ fontFamily: 'Georgia,serif', fontSize: 19, fontWeight: 600, color: C.gold }}>Reimagine Help</div>
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
            {m.navigateTo && VALID_STEPS.has(m.navigateTo) && (
              <div style={{ marginTop: 6 }}>
                <button
                  onClick={() => { onNavigate(m.navigateTo); setOpen(false) }}
                  style={{
                    background: '#fff', color: C.gold,
                    border: `1px solid ${C.gold}`, borderRadius: 8,
                    padding: '8px 14px', fontSize: 17, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Take me to {STEP_LABELS[m.navigateTo]} →
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ padding: '8px 18px', borderTop: '1px solid #E2E5EA', background: '#FAFBFC', fontSize: 15, color: '#718096', textAlign: 'center', lineHeight: 1.5 }}>
        Need more depth? <a href="/reimagine-user-guide.pdf" target="_blank" rel="noopener noreferrer" style={{ color: C.gold, fontWeight: 600, textDecoration: 'none' }}>Download the full User Guide (PDF)</a>
      </div>
      <div style={{ padding: 12, borderTop: '1px solid #E2E5EA', display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask anything about Reimagine"
          disabled={loading}
          style={{
            flex: 1, padding: '8px 12px', border: '1px solid #E2E5EA',
            borderRadius: 8, fontSize: 18, fontFamily: 'inherit', color: '#1A2540',
          }}
        />
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
}
