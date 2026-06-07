import { Component } from 'react'
import { BUILD_SHA } from './build-meta.js'

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

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, errorInfo: null, copied: false }
  }

  static getDerivedStateFromError(error) {
    return { error, errorInfo: null, copied: false }
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
            Your work is saved. The error has been recorded on this device.
            Reload to keep going; if the same screen keeps failing, copy the diagnostic
            info below and email it to bob@career.club so we can investigate.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button onClick={this.reload} style={{
              background: C.gold, color: '#FFF', border: 'none', borderRadius: 8,
              padding: '10px 18px', fontSize: 16, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit',
            }}>Reload</button>
            <button onClick={this.copyDiagnostic} style={{
              background: '#FFF', color: C.gold, border: `1px solid ${C.gold}`,
              borderRadius: 8, padding: '10px 18px', fontSize: 16, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>{this.state.copied ? 'Copied' : 'Copy diagnostic info'}</button>
          </div>
        </div>
      </div>
    )
  }
}
