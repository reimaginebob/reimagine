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
import { useState, useRef } from 'react'
import { Mic } from 'lucide-react'

export const hasSpeech = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

const DEFAULT_C = { border: '#E2E5EA', gray: '#3D4A5C' }

export default function SpeechBtn({ onResult, style, C = DEFAULT_C, title }) {
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)
  const toggle = () => {
    if (listening) { recRef.current?.stop(); return }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
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
    rec.onerror = () => setListening(false)
    recRef.current = rec
    rec.start()
    setListening(true)
  }
  return <>
    <style>{"@keyframes recordingPulse{0%,100%{box-shadow:0 0 0 0 rgba(231,76,60,0.6)}50%{box-shadow:0 0 0 8px rgba(231,76,60,0)}}"}</style>
    <button onClick={toggle} title={listening ? 'Recording. Click to stop.' : (title || 'Speak instead of typing')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10, border: `2px solid ${listening ? '#e74c3c' : C.border}`, background: listening ? '#e74c3c' : 'white', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0, ...(listening ? { animation: 'recordingPulse 1.5s infinite' } : {}), ...(style || {}) }}>
      <Mic size={18} color={listening ? '#FFFFFF' : C.gray} />
    </button>
  </>
}
