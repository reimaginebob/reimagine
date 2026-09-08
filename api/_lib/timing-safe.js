import crypto from 'node:crypto'

// Constant-time comparison for a bearer-secret check. crypto.timingSafeEqual
// throws on a length mismatch, so both operands are hashed to a fixed-length
// digest first rather than length-branched or padded -- a wrong-length guess
// takes exactly as long to reject as a right-length one.
export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const digestA = crypto.createHash('sha256').update(a).digest()
  const digestB = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(digestA, digestB)
}
