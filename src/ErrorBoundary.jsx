import { Component } from 'react'
import { BUILD_SHA } from './build-meta.js'
import { recordLocalFailure, buildDiagnosticsPayload } from './support-trail.js'

// Top-level React Error Boundary. When any child throws during render or in a
// lifecycle method, this catches it, renders a recoverable fallback, and writes
// a single rolling diagnostic record to localStorage so the user can copy it
// into a support email. Required to be a class component: React 18 has no
// functional Error Boundary API (getDerivedStateFromError / componentDidCatch
// are class-only).
//
// The palette is inlined (not imported from App.jsx's C) on purpose: if App.jsx
// is the crashing module, the boundary must not depend on it. BUILD_SHA is
// imported from the auto-generated, dependency-free build-meta.js, which is safe
// to read even when App.jsx fails.

const C = {
  bg: '#F7F8FA',
  card: '#FFFFFF',
  border: '#E2E5EA',
  gold: '#C8924A',
  cream: '#1A2540',
  gray: '#3D4A5C',
}

const STORAGE_KEY = 'reimagine_last_error'

const btnSolid = {
  background: C.gold, color: '#FFF', border: 'none', borderRadius: 8,
  padding: '10px 18px', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}
const btnOutline = {
  background: '#FFF', color: C.gold, border: `1px solid ${C.gold}`, borderRadius: 8,
  padding: '10px 18px', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, errorInfo: null, copied: false, sendOpen: false, sending: false, sent: false, sendError: null }
  }

  static getDerivedStateFromError(error) {
    return { error, errorInfo: null, copied: false, sendOpen: false, sending: false, sent: false, sendError: null }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    let lastStep = ''
    try { lastStep = sessionStorage.getItem('reimagine_last_step') || '' } catch {}
    const record = {
      ts: Date.now(),
      iso: new Date().toISOString(),
      message: String(error?.message || error || 'Unknown error'),
      stack: String(error?.stack || ''),
      componentStack: String(errorInfo?.componentStack || ''),
      step: lastStep,
      build: BUILD_SHA || 'unknown',
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      url: typeof location !== 'undefined' ? location.href : '',
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(record)) } catch {}
    // Local mirror, so the Send box below can show the person what it would
    // send. Same discipline as the server row: class and screen, no content.
    recordLocalFailure({ kind: 'client_crash', step: record.step, error_class: 'render', detail: record.message })
    this.reportCrash(record)
  }

  // Tell the server a crash happened (2026-09-08 observability brief). Until
  // this existed, a crash left the browser only if the user copied the record
  // above and pasted it into an email, so every crash nobody bothered to report
  // simply never happened as far as we knew.
  //
  // THREE of the record's fields are deliberately NOT sent. `stack` and
  // `componentStack` are strings we do not control the contents of, and `url`
  // can carry query state; support_events has no column for any of them and
  // would drop them anyway, but not sending them at all is the honest version
  // of that. What goes is the error message (capped at 200), which screen, and
  // which build -- enough to tell "this one user hit something odd" from "the
  // build that shipped an hour ago is crashing on p3".
  //
  // Fire-and-forget inside a try/catch, with the promise rejection swallowed:
  // this runs on a screen that has ALREADY failed, and an unhandled rejection
  // here would be a second error on top of the first. No await, no state, no
  // effect on what the user sees. The fuller record (component stack included)
  // still reaches us only if the user clicks Send on the crash screen, where
  // they can read exactly what they are sending first.
  reportCrash(record) {
    try {
      fetch('/api/support/client-event', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'client_crash',
          step: record.step,
          error_class: 'render',
          build_sha: record.build,
          detail: record.message,
        }),
        keepalive: true,
      }).catch(() => {})
    } catch {}
  }

  // "Send to Career Club" (2026-09-08 observability brief, part C). The
  // automatic crash row (reportCrash above) is deliberately thin -- no
  // component stack, no URL. This is the consented path for the cases where
  // seeing more than that is what solves the problem, and the consent is real:
  // the exact JSON is rendered on screen first, built by the same function that
  // posts it, so what is shown and what is sent cannot drift.
  openSend = () => {
    let record = null
    try { record = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch {}
    this.setState({ sendOpen: true, sent: false, sendError: null, payload: buildDiagnosticsPayload({ crash: record }) })
  }

  cancelSend = () => this.setState({ sendOpen: false, sendError: null })

  sendDiagnostic = async () => {
    this.setState({ sending: true, sendError: null })
    try {
      const r = await fetch('/api/support/diagnostics', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.state.payload),
      })
      if (!r.ok) {
        this.setState({ sending: false, sendError: 'That did not go through. The Copy button below still works, and the details are on this device either way.' })
        return
      }
      this.setState({ sending: false, sent: true })
    } catch {
      this.setState({ sending: false, sendError: 'We could not reach the server. The Copy button below still works, and the details are on this device either way.' })
    }
  }

  copyDiagnostic = async () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || ''
      await navigator.clipboard.writeText(raw)
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    } catch {}
  }

  reload = () => { try { location.reload() } catch {} }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{
        minHeight: '100vh', background: C.bg, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 24,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
        color: C.cream, fontSize: 16, lineHeight: 1.55,
      }}>
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: '32px 36px', maxWidth: 560, width: '100%',
        }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 600, marginBottom: 16 }}>
            Something went wrong on this screen.
          </div>
          <p style={{ margin: '0 0 16px' }}>
            Your work is saved. Reload to keep going. If the same screen keeps failing,
            send us what happened and we can look into it.
          </p>
          {!this.state.sendOpen && !this.state.sent && <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
            <button onClick={this.reload} style={btnSolid}>Reload</button>
            <button onClick={this.openSend} style={btnOutline}>Send to Career Club</button>
            <button onClick={this.copyDiagnostic} style={btnOutline}>{this.state.copied ? 'Copied' : 'Copy diagnostic info'}</button>
          </div>}

          {/* The payload, shown in full before anything is sent. Guidance gets
              the gold-accent treatment (CLAUDE.md section 8) so it reads as
              explanation rather than as more of the error. */}
          {this.state.sendOpen && !this.state.sent && <div style={{ marginTop: 20 }}>
            <div style={{
              background: `${C.gold}10`, borderLeft: `3px solid ${C.gold}`, padding: '14px 18px',
              borderRadius: 8, marginBottom: 14, fontSize: 16, color: C.gray, lineHeight: 1.6,
            }}>
              This sends Career Club a record of what the app was doing when it ran into trouble:
              the screen you were on, the kind of error, and the version you were running.
              It does not include your resume, your profile, your playbooks, or anything you have
              said to My Coach. Here is exactly what will be sent.
            </div>
            <pre style={{
              background: '#F2F4F7', border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '14px 16px', margin: 0, maxHeight: 260, overflow: 'auto',
              fontSize: 15, lineHeight: 1.5, color: C.cream,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>{JSON.stringify(this.state.payload, null, 2)}</pre>
            {this.state.sendError && <div role="alert" style={{
              marginTop: 12, fontSize: 16, color: C.cream, lineHeight: 1.55,
              background: '#C0392B10', border: '1px solid #C0392B40', borderLeft: '4px solid #C0392B',
              borderRadius: 8, padding: '12px 16px',
            }}>{this.state.sendError}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button onClick={this.sendDiagnostic} disabled={this.state.sending} style={{
                ...btnSolid, cursor: this.state.sending ? 'default' : 'pointer', opacity: this.state.sending ? 0.6 : 1,
              }}>{this.state.sending ? 'Sending…' : 'Send to Career Club'}</button>
              <button onClick={this.cancelSend} style={btnOutline}>Cancel</button>
            </div>
          </div>}

          {this.state.sent && <div style={{ marginTop: 20 }}>
            <p style={{ margin: '0 0 16px' }}>
              Sent. If you emailed support@career.club, mention the time and we&rsquo;ll match it up.
            </p>
            <button onClick={this.reload} style={btnSolid}>Reload</button>
          </div>}
        </div>
      </div>
    )
  }
}
