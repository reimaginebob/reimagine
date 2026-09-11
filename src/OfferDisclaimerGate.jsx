import { useState } from 'react'

// One-time acknowledgment gate shown before the first Offer & Negotiation
// build on an account (src/App.jsx, generateOpOfferNegotiation). Mirrors
// LegalReacceptanceModal's shape but adds the checkbox affirmative-act step
// and records acceptance via /api/account/accept-offer-disclaimer instead of
// /api/account/reaccept. onAccepted fires after the write succeeds so the
// caller can resume the build that triggered the gate.

export default function OfferDisclaimerGate({ onAccepted, onCancel }) {
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const accept = async () => {
    if (!checked || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const r = await fetch('/api/account/accept-offer-disclaimer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
          maxWidth: 560,
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}
      >
        <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 700, color: '#1A2540', margin: '0 0 14px' }}>
          Before you use this feature
        </h2>
        <p style={{ fontSize: 17, color: '#3D4A5C', lineHeight: 1.65, margin: '0 0 14px' }}>
          Reimagine's Offer & Negotiation feature generates suggestions using artificial intelligence. Those suggestions are exactly that: suggestions. They are not legal advice, financial advice, tax advice, or professional negotiation representation, and no attorney-client, advisor-client, or fiduciary relationship is created by your use of this feature.
        </p>
        <p style={{ fontSize: 17, color: '#3D4A5C', lineHeight: 1.65, margin: '0 0 14px' }}>
          The analysis, insights, and recommendations you receive may be incomplete. They may be inaccurate. They may be based on assumptions that do not match your situation, your industry, your employer, or your jurisdiction. They may leave out factors that matter to you.
        </p>
        <p style={{ fontSize: 17, color: '#3D4A5C', lineHeight: 1.65, margin: '0 0 14px' }}>
          You alone decide whether to accept, decline, counter, or negotiate any offer, and what to say and do in that process. Every decision you make, and every consequence of that decision, is solely your responsibility. Career Club, Decima LLC, and the people who built Reimagine are not responsible for any outcome, including but not limited to a lost offer, a withdrawn offer, reduced compensation, a damaged relationship with an employer, or any other loss, whether or not it results from following, partly following, or not following anything this feature suggests.
        </p>
        <p style={{ fontSize: 17, color: '#3D4A5C', lineHeight: 1.65, margin: '0 0 22px' }}>
          If your offer involves significant money, equity, relocation, a non-compete, a severance clause, or anything you do not fully understand, consult a qualified attorney, accountant, or financial advisor before you act.
        </p>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 22 }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 3, flexShrink: 0, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 16, color: '#1A2540', lineHeight: 1.55 }}>
            I understand that these are suggestions that may be incomplete or inaccurate, and that any decision I make is solely my responsibility.
          </span>
        </label>
        {error && <div style={{ color: '#C0392B', fontSize: 16, marginBottom: 14 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={accept}
            disabled={!checked || submitting}
            style={{
              background: '#C8924A',
              color: '#1A2540',
              border: 'none',
              borderRadius: 8,
              padding: '12px 24px',
              fontSize: 17,
              fontWeight: 700,
              cursor: checked && !submitting ? 'pointer' : 'default',
              fontFamily: 'inherit',
              opacity: !checked || submitting ? 0.5 : 1,
            }}
          >
            {submitting ? 'Saving' : 'Continue to my analysis'}
          </button>
          <button
            onClick={() => onCancel && onCancel()}
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
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
