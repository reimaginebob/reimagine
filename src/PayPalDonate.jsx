// PayPal / Venmo / card option for the Pay It Forward panel (SupportPanel,
// src/App.jsx). A second, independent way to give alongside the existing
// Stripe amount buttons -- Stripe is untouched -- one-time only (no PayPal
// equivalent of Stripe's $10/mo option -- see Output/handoff/2026-09-17_
// paypal-commerce-integration.md for why that is a scope choice, not an
// oversight). SupportPanel places it beside the Stripe column on desktop
// and below it on mobile (2026-09-18 layout pass); this component owns no
// outer margin itself so either placement can control its own spacing.
//
// Loaded on demand: the PayPal JS SDK script tag is injected the first time
// this component mounts (i.e. only when a signed-in or signed-out visitor
// actually opens the Support panel), never globally, so nothing outside
// this one panel pays for it.
//
// userId (signedInUser.id, when signed in) is sent as `custom_id` on the
// PayPal order -- the same attribution role Stripe's client_reference_id
// plays for the Stripe buttons above. Same trust model too: unauthenticated,
// shape-checked, carries no privilege. api/webhooks/paypal.js is the only
// place a donation is actually recorded; this component and its two API
// calls (create-order, capture-order) only drive PayPal's own checkout flow.
import { useEffect, useRef, useState } from 'react'

const GOLD = '#C8924A'
const GRAY = '#3D4A5C'
const GRAYL = '#718096'
const OK = '#2E7D52'

const AMOUNTS = [20, 50, 100]

// Module-level so the SDK script is fetched once per page load, even if
// the Support panel is closed and reopened (unmounting/remounting this
// component) several times in one session.
let sdkLoadPromise = null
function loadPaypalSdk(clientId) {
  if (typeof window !== 'undefined' && window.paypal) return Promise.resolve(window.paypal)
  if (sdkLoadPromise) return sdkLoadPromise
  sdkLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons&enable-funding=venmo`
    script.async = true
    script.onload = () => resolve(window.paypal)
    script.onerror = () => { sdkLoadPromise = null; reject(new Error('PayPal SDK failed to load')) }
    document.body.appendChild(script)
  })
  return sdkLoadPromise
}

export default function PayPalDonate({ userId }) {
  const containerRef = useRef(null)
  const amountRef = useRef(20)
  const [amount, setAmount] = useState(20)
  const [customAmount, setCustomAmount] = useState('')
  // 'loading' | 'ready' | 'unavailable' | 'success'. 'unavailable' covers
  // both a missing client id and an SDK load failure -- either way there is
  // nothing to render, and the Stripe options above remain a working way to
  // give, so this degrades to silence rather than a scary error box.
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    amountRef.current = customAmount ? Number(customAmount) : amount
  }, [amount, customAmount])

  useEffect(() => {
    const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID
    if (!clientId) { setStatus('unavailable'); return }

    let buttons = null
    let cancelled = false

    loadPaypalSdk(clientId).then(paypal => {
      if (cancelled || !containerRef.current) return
      buttons = paypal.Buttons({
        style: { color: 'gold', shape: 'rect', label: 'paypal', height: 45 },
        createOrder: async () => {
          const res = await fetch('/api/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amountRef.current, userId }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok || !data.orderId) throw new Error(data.error || 'Could not start PayPal checkout')
          return data.orderId
        },
        onApprove: async (data) => {
          const res = await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: data.orderID }),
          })
          const result = await res.json().catch(() => ({}))
          if (!res.ok || !result.ok) throw new Error(result.error || 'Could not complete the donation')
          setStatus('success')
        },
        onError: (err) => {
          console.error('PayPalDonate: Buttons error', err)
        },
      })
      buttons.render(containerRef.current)
      setStatus('ready')
    }).catch(err => {
      if (cancelled) return
      console.error('PayPalDonate: SDK load failed', err)
      setStatus('unavailable')
    })

    return () => {
      cancelled = true
      if (buttons && typeof buttons.close === 'function') buttons.close()
    }
  }, [userId])

  if (status === 'unavailable') return null

  const pillStyle = (active) => ({
    padding: '9px 16px', borderRadius: 8, border: `1.5px solid ${active ? GOLD : '#E2E5EA'}`,
    background: active ? `${GOLD}22` : 'transparent', color: active ? GOLD : GRAY,
    fontSize: 16, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
  })

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: '#718096', margin: '0 0 10px' }}>
        Or pay with PayPal, Venmo, or card
      </div>
      {status === 'success'
        ? <div style={{ fontSize: 17, color: OK, fontWeight: 700 }}>Thank you — your gift went through.</div>
        : <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {AMOUNTS.map(a => (
                <button key={a} type="button" onClick={() => { setAmount(a); setCustomAmount('') }} style={pillStyle(!customAmount && amount === a)}>
                  {`$${a}`}
                </button>
              ))}
              <input
                type="number"
                min="1"
                placeholder="Other"
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value)}
                style={{ width: 90, padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${customAmount ? GOLD : '#E2E5EA'}`, fontSize: 16, fontFamily: 'inherit' }}
              />
            </div>
            <div ref={containerRef} style={{ maxWidth: 320, minHeight: status === 'loading' ? 45 : undefined }} />
            {status === 'loading' && <div style={{ fontSize: 15, color: GRAYL }}>Loading…</div>}
          </>}
    </div>
  )
}
