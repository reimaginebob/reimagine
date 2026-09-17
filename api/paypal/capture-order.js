// Captures an approved PayPal order and reports the result to the browser
// so it can show a thank-you state. Deliberately does NOT write to
// `donations` -- see the header comment in create-order.js. If the capture
// here succeeds but PAYMENT.CAPTURE.COMPLETED is delayed or never arrives,
// the donor still correctly sees success (the money moved); a missing
// webhook delivery is PayPal's retry problem, not something this endpoint
// should paper over by writing its own, second, uncoordinated donation row.
import { asText, paypalFetch } from '../_lib/paypal.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const orderId = asText(req.body && req.body.orderId)
  if (!orderId) {
    return res.status(400).json({ error: 'Missing orderId' })
  }

  try {
    const { ok, status, json } = await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
    })
    if (!ok) {
      console.error('paypal/capture-order: PayPal capture failed', status, json)
      return res.status(502).json({ error: 'PayPal capture failed' })
    }
    return res.status(200).json({ ok: true, status: json && json.status })
  } catch (err) {
    console.error('paypal/capture-order: request failed', err && err.message)
    return res.status(500).json({ error: 'Request failed' })
  }
}
