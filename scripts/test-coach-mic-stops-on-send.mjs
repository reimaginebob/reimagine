// Guards a live-caught UX bug (2026-09-06): using the mic on My Coach's input
// and then pressing Send (or Enter) left the recognizer listening. Pressing
// Send means "I'm done talking" -- the mic should stop, not keep appending
// whatever gets said next into an input box that was just cleared and sent.
//
// SpeechBtn previously exposed no way for a caller to stop a recording it
// did not itself start (the person's own click on the mic button was the
// only way in or out) -- fixed with an optional ref API (forwardRef +
// useImperativeHandle) any caller can use, wired up in Chat.jsx's send().
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const SPEECH = 'src/components/SpeechBtn.jsx'
const speech = fs.readFileSync(SPEECH, 'utf8')

check(speech.includes('forwardRef') && speech.includes('useImperativeHandle'),
  `${SPEECH}: SpeechBtn no longer exposes a ref-based imperative API`)
check(/useImperativeHandle\(ref, \(\) => \(\{\s*stop: \(\) => \{ if \(listening\) recRef\.current\?\.stop\(\) \}/.test(speech),
  `${SPEECH}: the exposed stop() does not actually stop the underlying recognizer`)
check(speech.includes('export default SpeechBtn'),
  `${SPEECH}: SpeechBtn's default export changed shape`)

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

check(chat.includes('const speechBtnRef = useRef(null)'),
  `${CHAT}: Chat no longer holds a ref to the mic button`)
check(chat.includes('<SpeechBtn ref={speechBtnRef}'),
  `${CHAT}: the mic button in Chat.jsx is no longer wired to speechBtnRef`)
// Must fire on the real-send path specifically (not the silent/postCapture
// paths, which never involve this input box), right alongside clearing the
// input -- the same moment the person's own "done talking" action happens.
const realSendIdx = chat.indexOf("setMessages(m => [...m, userMsg, { role: 'assistant', content: '' }])")
check(realSendIdx !== -1, `${CHAT}: could not locate the real-send message-push to anchor the mic-stop check`)
const realSendBlock = realSendIdx !== -1 ? chat.slice(Math.max(0, realSendIdx - 200), realSendIdx) : ''
check(realSendBlock.includes('speechBtnRef.current') && realSendBlock.includes('.stop()'),
  `${CHAT}: send() does not stop the mic on a real (non-silent) send -- pressing Send would leave an in-progress dictation still listening`)

if (failures) {
  console.error(`test-coach-mic-stops-on-send: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-mic-stops-on-send: OK (SpeechBtn exposes a ref-based stop(), Chat wires it up, send() calls it on a real send)')
}
