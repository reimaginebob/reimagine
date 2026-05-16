import { useState } from 'react'

const STORAGE_KEY = 'reimagine_cookie_acknowledged_v1'

export default function CookieBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  if (dismissed) return null

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {}
    setDismissed(true)
  }

  return (
    <div
      data-print="hide"
      role="region"
      aria-label="Cookie notice"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2147483000,
        background: '#1A2540',
        color: '#FFFFFF',
        borderTop: '2px solid #C8924A',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        flexWrap: 'wrap',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.18)',
      }}
    >
      <div
        style={{
          fontSize: 18,
          lineHeight: 1.6,
          maxWidth: 760,
          flex: '1 1 320px',
        }}
      >
        This site uses cookies and your browser's local storage to keep you signed in and to save
        your progress. By continuing to use Reimagine, you accept this use. Read our{' '}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#E9B86A', textDecoration: 'underline' }}
        >
          Privacy Agreement
        </a>{' '}
        for details.
      </div>
      <button
        onClick={accept}
        style={{
          background: '#C8924A',
          color: '#1A2540',
          border: 'none',
          borderRadius: 8,
          padding: '12px 28px',
          fontSize: 17,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          minHeight: 44,
          flexShrink: 0,
        }}
      >
        Got it
      </button>
    </div>
  )
}
