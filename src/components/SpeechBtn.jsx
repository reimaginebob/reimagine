// Voice-input button (speech-to-text). Extracted from App.jsx (PR-2, Interview
// Team round 2) so it can be reused on the Interview Team fields and the My Coach
// input as well as the Orientation surfaces. Client-side Web Speech API only —
// no server round-trip, no spoken replies (TTS). Callers gate on `hasSpeech`.
//
// API: <SpeechBtn onResult={text => ...} style={...} C={colorTokens} title={...}/>
//   onResult fires with the full transcript-so-far (final + interim) on each
//   recognition event. Callers decide replace vs append (append: onResult={t =>
//   setX((x||'') + t)} — the base is frozen at record-start, t accumulates).
// `C` is optional; it defaults to the app's border/gray tokens so existing call
// sites need not pass it.
//
// WHY THIS FILE HAS ERROR HANDLING (2026-08-20)
// ---------------------------------------------
// Reported: "the in-app microphone does not work" on a phone — tapping it did
// nothing at all. No red state, no permission prompt, no message.
//
// The cause was ordering. The old code was:
//     recRef.current = rec
//     rec.start()          <- throws on iOS when recognition cannot begin
//     setListening(true)   <- therefore never runs
// with `rec.onerror = () => setListening(false)` swallowing everything else. So
// every failure mode rendered as an inert button, and the app had no way to tell
// the user (or us) which one had happened.
//
// Three changes follow from that:
//   1. start() is wrapped, and the listening state is only claimed once it has
//      actually started.
//   2. Failures are SHOWN, carrying the real error code. A silent control that
//      does nothing is worse than one that says why.
//   3. A permission-shaped failure asks for the microphone, so the next tap has
//      a chance of working.
//
// start() deliberately stays SYNCHRONOUS inside the click handler. iOS requires
// recognition to begin in a user-gesture call stack, and awaiting anything first
// (a permission request, say) forfeits that gesture and breaks the very thing we
// are trying to fix. The permission request therefore happens AFTER a failure,
// never before the first attempt.
//
// Not changed here: `continuous` and `interimResults`. WebKit is documented as
// erratic with both, but that failure looks like "listens, transcribes nothing",
// which is a different report from this one — and the current settings work on
// desktop. Worth revisiting only if recognition starts and then misbehaves.
import { useState, useRef, useEffect } from 'react'
import { Mic } from 'lucide-react'

export const hasSpeech = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

const DEFAULT_C = { border: '#E2E5EA', gray: '#3D4A5C' }

// Error codes the spec defines that are not worth interrupting anyone over:
// 'aborted' is what stopping normally produces, and 'no-speech' just means the
// user did not say anything.
const QUIET_ERRORS = new Set(['aborted', 'no-speech'])

const BLOCKED_MSG = 'Microphone access is blocked. Allow it for this site in your browser settings, then tap again.'

export default function SpeechBtn({ onResult, style, C = DEFAULT_C, title, onError }) {
  const [listening, setListening] = useState(false)
  const [problem, setProblem] = useState('')
  const recRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  // The notice is position:fixed, so it cannot disturb any of the 15 call sites'
  // layouts — several place this button absolutely inside a textarea, and an
  // in-flow message would move things around.
  const report = (message, detail) => {
    setProblem(message)
    if (onError) onError(message, detail)
    if (typeof console !== 'undefined' && console.warn) console.warn('[SpeechBtn]', message, detail || '')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setProblem(''), 7000)
  }

  // Only called after a failure that looks like permission, so the system prompt
  // appears and the next tap can succeed. The stream is released immediately;
  // recognition opens its own capture.
  const requestMic = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => { stream.getTracks().forEach(t => t.stop()) })
      .catch(() => {})
  }

  const toggle = () => {
    if (listening) { recRef.current?.stop(); return }
    setProblem('')
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { report('Speech input is not available in this browser. You can type instead.'); return }

    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    let finalText = ''
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript
        else interim += e.results[i][0].transcript
      }
      onResult(finalText + interim)
    }
    rec.onend = () => setListening(false)
    rec.onerror = (e) => {
      setListening(false)
      const code = (e && e.error) || 'unknown'
      if (QUIET_ERRORS.has(code)) return
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        report(BLOCKED_MSG, code)
        requestMic()
        return
      }
      report(`Speech input stopped (${code}). You can type instead.`, code)
    }
    recRef.current = rec

    // The fix. start() throws synchronously on iOS when recognition cannot
    // begin; claiming the listening state before that is confirmed is what made
    // a failure indistinguishable from a dead button.
    try {
      rec.start()
    } catch (err) {
      const name = (err && err.name) || 'error'
      // InvalidStateError means a previous session is still winding down.
      if (name === 'InvalidStateError') {
        report('Speech input is still finishing the last recording. Try again in a moment.', name)
      } else {
        report(BLOCKED_MSG, name)
        requestMic()
      }
      return
    }
    setListening(true)
  }

  return <>
    <style>{"@keyframes recordingPulse{0%,100%{box-shadow:0 0 0 0 rgba(231,76,60,0.6)}50%{box-shadow:0 0 0 8px rgba(231,76,60,0)}}"}</style>
    <button onClick={toggle} title={listening ? 'Recording. Click to stop.' : (title || 'Speak instead of typing')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10, border: `2px solid ${listening ? '#e74c3c' : C.border}`, background: listening ? '#e74c3c' : 'white', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0, ...(listening ? { animation: 'recordingPulse 1.5s infinite' } : {}), ...(style || {}) }}>
      <Mic size={18} color={listening ? '#FFFFFF' : C.gray} />
    </button>
    {problem && <div role="status" data-print="hide" style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      maxWidth: 'calc(100vw - 32px)', background: '#1A2540', color: '#FFFFFF',
      padding: '12px 22px', borderRadius: 8, fontSize: 16, fontWeight: 500,
      lineHeight: 1.5, textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
      zIndex: 1200,
    }}>{problem}</div>}
  </>
}
