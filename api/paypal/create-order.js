// Creates a PayPal order for a Pay It Forward donation. Called by
// src/PayPalDonate.jsx's createOrder callback, right before the PayPal
// Buttons widget opens its own approval popup. Nothing is written to
// `donations` here or in capture-order.js -- api/webhooks/paypal.js is the
// sole writer, the same division of labor api/webhooks/stripe.js already
// uses (the browser never records its own donation, only a webhook does),
// so there is exactly one place a donation can end up recorded twice or
// not at all, and it is the same place for both providers.
import { asText, UUID_RE, paypalFetch } from '../_lib/paypal.js'

// Loose sanity bounds, not a real limit -- catches a stray NaN or a typo
// amount before it reaches PayPal, not a policy decision about gift size.
const MIN_AMOUNT = 1
const MAX_AMOUNT = 10000

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const amount = Number(req.body && req.body.amount)
  if (!Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return res.status(400).json({ error: 'Invalid amount' })
  }

  // Same attribution posture as Stripe's client_reference_id: a
  // client-supplied id, validated for shape and nothing else. It carries no
  // access or privilege -- it only tells the webhook whose account to credit
  // the gift to -- so trusting the browser here is the same trust Stripe's
  // own flow already extends.
  const rawUserId = asText(req.body && req.body.userId)
  const userId = rawUserId && UUID_RE.test(rawUserId) ? rawUserId : undefined

  try {
    const { ok, status, json } = await paypalFetch('/v2/checkout/orders', {
      method: 'POST',
      body: {
        intent: 'CAPTURE',
        purchase_units: [{
          custom_id: userId,
          amount: { currency_code: 'USD', value: amount.toFixed(2) },
          description: 'Reimagine — Pay It Forward',
        }],
      },
    })
    if (!ok || !json || !json.id) {
      console.error('paypal/create-order: PayPal order create failed', status, json)
      return res.status(502).json({ error: 'PayPal order create failed' })
    }
    return res.status(200).json({ orderId: json.id })
  } catch (err) {
    console.error('paypal/create-order: request failed', err && err.message)
    return res.status(500).json({ error: 'Request failed' })
  }
}
