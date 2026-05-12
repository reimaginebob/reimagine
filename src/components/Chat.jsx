import { useState, useEffect, useRef } from 'react'

const INTRO_MSG = { role: 'assistant', content: 'Hi. I can help you with how Reimagine works. What would you like to know?' }

const STEP_LABELS = {
  welcome: 'Welcome',
  location: 'Location & Work',
  resume: 'Your Resume',
  assessment: 'Assessments',
  values: 'Values, Passions & Causes',
  reputation: 'Reputation',
  p1: 'Resume Analysis',
  p2: 'Wiring & Compass',
  p3: 'Brand Synthesis',
  p4: 'The Wide View',
  p5: 'The Deep Dive',
  decision: 'Your Decision',
  p6: 'Your Bridge Story',
  p7: 'Go-to-Market',
  p8: 'LinkedIn Remix',
  p_res: 'Resume Refresh',
  p9: 'Your Playbook',
  complete: 'Complete',
  income: 'Income Now',
  op: 'Upload a Live Opportunity',
}
const VALID_STEPS = new Set(Object.keys(STEP_LABELS))

export default function Chat({ currentStep, onNavigate, C, showPulse, onDismissPulse, messages, setMessages }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesContainerRef = useRef(null)

  useEffect(() => {
    const el = messagesContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
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
        }),
      })
      if (!res.ok || !res.body) {
        const fallback = res.status === 401
          ? 'Sign in first and the helper will come back online.'
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
          // Hide any trailing NAVIGATE line from the visible bubble as it streams.
          const navIdx = fullText.lastIndexOf('\nNAVIGATE')
          const visible = navIdx >= 0 ? fullText.slice(0, navIdx).trimEnd() : fullText
          setMessages(m => {
            const copy = [...m]
            copy[copy.length - 1] = { ...copy[copy.length - 1], content: visible }
            return copy
          })
        }
        const navMatch = fullText.match(/\n?NAVIGATE:\s*(\w+)\s*$/i)
        const navigateTo = navMatch ? navMatch[1] : null
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
        copy[copy.length - 1] = { role: 'assistant', content: 'Sorry, I could not reach the helper just now. Try again in a moment.' }
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
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {showPulse && (
            <div style={{
              background: '#fff',
              border: `1px solid ${C.gold}`,
              color: C.gold,
              padding: '6px 12px',
              borderRadius: 16,
              fontSize: 13,
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
            aria-label={showPulse ? 'Need help? Open helper chat' : 'Open helper chat'}
          >
            ?
          </button>
        </div>
      </>
    )
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
      width: 380, maxWidth: 'calc(100vw - 24px)', height: 560, maxHeight: 'calc(100vh - 48px)',
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
        <div style={{ fontWeight: 600, color: C.gold }}>Reimagine helper</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={() => setMessages([INTRO_MSG])}
            style={{ background: 'none', border: 'none', color: '#8A9BB8', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
            aria-label="Clear conversation"
          >
            Clear
          </button>
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#4A5568', fontFamily: 'inherit' }} aria-label="Close">×</button>
        </div>
      </div>
      <div ref={messagesContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 12, textAlign: m.role === 'user' ? 'right' : 'left' }}>
            <div style={{
              display: 'inline-block', maxWidth: '85%',
              padding: '10px 14px', borderRadius: 12,
              background: m.role === 'user' ? C.gold : '#F4F6F9',
              color: m.role === 'user' ? '#fff' : '#1A2540',
              fontSize: 14, lineHeight: 1.5, textAlign: 'left',
              whiteSpace: 'pre-wrap',
            }}>
              {m.role === 'assistant' && !m.content && loading && i === messages.length - 1
                ? <span style={{ color: '#8A9BB8', fontStyle: 'italic' }}>Thinking…</span>
                : m.content}
            </div>
            {m.navigateTo && VALID_STEPS.has(m.navigateTo) && (
              <div style={{ marginTop: 6 }}>
                <button
                  onClick={() => { onNavigate(m.navigateTo); setOpen(false) }}
                  style={{
                    background: '#fff', color: C.gold,
                    border: `1px solid ${C.gold}`, borderRadius: 8,
                    padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Take me to {STEP_LABELS[m.navigateTo]} →
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ padding: '8px 18px', borderTop: '1px solid #E2E5EA', background: '#FAFBFC', fontSize: 13, color: '#718096', textAlign: 'center', lineHeight: 1.5 }}>
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
            borderRadius: 8, fontSize: 14, fontFamily: 'inherit', color: '#1A2540',
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            background: C.gold, color: '#fff', border: 'none',
            borderRadius: 8, padding: '8px 14px', cursor: loading || !input.trim() ? 'default' : 'pointer',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
            opacity: loading || !input.trim() ? 0.6 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
