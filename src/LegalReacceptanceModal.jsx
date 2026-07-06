import { useState } from 'react'

// Fires at sign-in when the user's stored privacy/terms version differs from the
// current _MATERIAL constant (src/config/legal.js). Activated 2026-06-24 for the
// conversation-review privacy update: PRIVACY_VERSION_MATERIAL was bumped, and the
// App.jsx gate now also prompts grandfathered (NULL-version) users for privacy so
// this material content-review disclosure reaches every existing signed-in user
// before content review is enabled. Records the acknowledgment (user + timestamp +
// version) via /api/account/reaccept. CHANGE_SUMMARY is the plain-language notice.

const CHANGE_SUMMARY =
  "We've updated our Privacy Agreement. To improve our coaching, our team now reviews conversations with the coach and chat — your questions, the responses, and any feedback you give. This review uses de-identified records: your name and email are removed, so reviewers see the conversation but not who you are. We don't sell this content, use it to train AI models, or use it to contact you."

export default function LegalReacceptanceModal({
  needsPrivacyReaccept,
  needsTermsReaccept,
  onAccepted,
  onDecline,
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const both = needsPrivacyReaccept && needsTermsReaccept
  const title = both
    ? 'Our agreements have changed'
    : needsPrivacyReaccept
      ? 'Our Privacy Agreement has changed'
      : 'Our Terms of Service have changed'

  const accept = async () => {
    setSubmitting(true)
    setError('')
    try {
      const r = await fetch('/api/account/reaccept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          privacy: !!needsPrivacyReaccept,
          terms: !!needsTermsReaccept,
        }),
      })
      if (!r.ok) {
        setError('Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }
      onAccepted && onAccepted()
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
      setSubmitting(false)
    }
  }

  return (
    <div
      data-print="hide"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 2147483600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 14,
          padding: '32px 36px',
          maxWidth: 540,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}
      >
        <h2
          style={{
            fontFamily: 'Georgia,serif',
            fontSize: 24,
            fontWeight: 700,
            color: '#1A2540',
            margin: '0 0 14px',
          }}
        >
          {title}
        </h2>
        <p style={{ fontSize: 18, color: '#3D4A5C', lineHeight: 1.65, margin: '0 0 18px' }}>
          {CHANGE_SUMMARY}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
          {needsPrivacyReaccept && (
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#C8924A', fontSize: 17, fontWeight: 600 }}
            >
              Read the full Privacy Agreement
            </a>
          )}
          {needsTermsReaccept && (
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#C8924A', fontSize: 17, fontWeight: 600 }}
            >
              Read the updated Terms of Service
            </a>
          )}
        </div>
        {error && (
          <div style={{ color: '#C0392B', fontSize: 16, marginBottom: 14 }}>{error}</div>
        )}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={accept}
            disabled={submitting}
            style={{
              background: '#C8924A',
              color: '#1A2540',
              border: 'none',
              borderRadius: 8,
              padding: '12px 24px',
              fontSize: 17,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              opacity: submitting ? 0.5 : 1,
            }}
          >
            {submitting ? 'Saving' : 'Got it'}
          </button>
          <button
            onClick={() => onDecline && onDecline()}
            disabled={submitting}
            style={{
              background: 'transparent',
              color: '#3D4A5C',
              border: '1px solid #E2E5EA',
              borderRadius: 8,
              padding: '11px 20px',
              fontSize: 17,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
