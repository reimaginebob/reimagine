import { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'pe_chat_history'
const INTRO_MSG = { role: 'assistant', content: 'Hi. I can help you with how Reimagine works. What would you like to know?' }
const IDLE_MS = 120000

export default function Chat({ currentStep, onNavigate, C }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return [INTRO_MSG]
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pulse, setPulse] = useState(false)
  const idleTimer = useRef(null)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50))) } catch {}
  }, [messages])

  useEffect(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    setPulse(false)
    if (open) return
    idleTimer.current = setTimeout(() => setPulse(true), IDLE_MS)
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current) }
  }, [currentStep, open])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          history: messages,
          currentStep,
        }),
      })
      if (!res.ok) {
        setMessages(m => [...m, { role: 'assistant', content: res.status === 401 ? 'Sign in first and the helper will come back online.' : 'Sorry, something went wrong. Try again in a moment.' }])
      } else {
        const data = await res.json()
        setMessages(m => [...m, {
          role: 'assistant',
          content: data.reply || 'Sorry, something went wrong.',
          navigateTo: data.navigateTo || null,
        }])
      }
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Sorry, I could not reach the helper just now. Try again in a moment.' }])
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <>
        {pulse && <style>{"@keyframes pe-chat-pulse{0%{box-shadow:0 4px 12px rgba(0,0,0,0.15),0 0 0 0 rgba(200,146,74,0.55)}70%{box-shadow:0 4px 12px rgba(0,0,0,0.15),0 0 0 14px rgba(200,146,74,0)}100%{box-shadow:0 4px 12px rgba(0,0,0,0.15),0 0 0 0 rgba(200,146,74,0)}}"}</style>}
        <button
          onClick={() => { setOpen(true); setPulse(false) }}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
            background: C.gold, color: '#fff', border: 'none',
            borderRadius: '50%', width: 56, height: 56,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: 22, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
            animation: pulse ? 'pe-chat-pulse 1.6s infinite' : 'none',
          }}
          aria-label={pulse ? 'Need help? Open helper chat' : 'Open helper chat'}
        >
          ?
        </button>
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
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#4A5568', fontFamily: 'inherit' }} aria-label="Close">×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
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
              {m.content}
            </div>
            {m.navigateTo && (
              <div style={{ marginTop: 6 }}>
                <button
                  onClick={() => { onNavigate(m.navigateTo); setOpen(false) }}
                  style={{
                    background: '#fff', color: C.gold,
                    border: `1px solid ${C.gold}`, borderRadius: 8,
                    padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Take me there →
                </button>
              </div>
            )}
          </div>
        ))}
        {loading && <div style={{ color: '#8A9BB8', fontSize: 13, fontStyle: 'italic' }}>Thinking…</div>}
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
