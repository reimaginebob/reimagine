// Offer valuation helpers (offer-benefits net-pay frame 2026-08-07). Pure,
// dependency-free, unit-tested in scripts/test-monetize-benefits.mjs. Kept in its
// own module (not App.jsx) so the test can import it. .js extension (src-only).
//
// Framing (Bob's call): a benefits comparison should reflect what lands in the
// person's own paycheck, not the employer's abstract contribution. So health is a
// COST the person pays (subtract it), and the real money that comes back to them —
// 401(k) match, employer HSA seed, PTO value — is added. The employer's premium
// contribution is deliberately ignored; it never touches the person's wallet.
// Net benefits = (match + HSA + PTO value) − (your annual health premium).

// parseMoney: tolerant number extraction from free-text strings
// ("$148,000" -> 148000, "150k" -> 150000, "20" -> 20). Returns null when there is
// no parseable number, so callers distinguish "unset" from zero.
export function parseMoney(v) {
  if (v == null) return null
  if (typeof v === 'number') return isFinite(v) ? v : null
  let s = String(v).trim().toLowerCase().replace(/[$,\s]/g, '')
  if (!s) return null
  let mult = 1
  if (/k$/.test(s)) { mult = 1e3; s = s.replace(/k$/, '') }
  else if (/m$/.test(s)) { mult = 1e6; s = s.replace(/m$/, '') }
  const m = s.match(/-?\d+(\.\d+)?/)
  if (!m) return null
  const n = parseFloat(m[0]) * mult
  return isFinite(n) ? n : null
}

// monetizeBenefits: the net-pay benefits figure for one offer.
//   adds (money to you):   retirement = employer 401(k) match ($/yr, if you capture it)
//                          hsa        = employer HSA/FSA contribution ($/yr)
//                          pto        = (base / 260 working days) * PTO days
//   cost (money from you): premiumAnnual = your monthly health premium * 12
//   net = addTotal − premiumAnnual   (can be negative — the benefits net cost you)
// Returns null net only when nothing was entered, so the caller shows "not priced
// in" rather than a misleading $0. Deductible/out-of-pocket are intentionally NOT
// priced here — they are situational ("only if you use care") and belong in a
// caveat, not the firm number.
const ADD_LABELS = { retirement: '401(k) match', hsa: 'HSA / FSA', pto: 'PTO value' }
export function monetizeBenefits(offer, benefits) {
  const b = benefits || {}
  const base = parseMoney(offer && offer.base)
  const ptoDays = parseMoney(b.ptoDays)
  const adds = {
    retirement: parseMoney(b.employerRetirementAnnual),
    hsa: parseMoney(b.employerHSAAnnual),
    pto: (base != null && ptoDays != null) ? Math.round((base / 260) * ptoDays) : null,
  }
  const premMonthly = parseMoney(b.employeePremiumMonthly)
  const premiumAnnual = premMonthly != null ? Math.round(premMonthly * 12) : null
  const addTotal = Object.values(adds).filter(v => v != null && v > 0).reduce((s, v) => s + v, 0)
  const anyInput = Object.values(adds).some(v => v != null && v > 0) || premiumAnnual != null
  const net = anyInput ? (addTotal - (premiumAnnual || 0)) : null
  const missing = [
    adds.retirement == null && ADD_LABELS.retirement,
    adds.hsa == null && ADD_LABELS.hsa,
    adds.pto == null && ADD_LABELS.pto,
    premiumAnnual == null && 'your health premium',
  ].filter(Boolean)
  return { net, adds, addTotal, premiumAnnual, missing, priced: anyInput }
}

// parseBonus: read the offer's free-text bonus into a framing the modeler can use.
//   'pct'    — a percent of base (the standard annual bonus). Carries targetPct and,
//              when base is known, the dollar value at 100% attainment.
//   'dollar' — a stated dollar target, OR a commission/variable plan we can't derive
//              from base (the user supplies an expected number).
//   null     — nothing parseable.
export function parseBonus(bonusStr, base) {
  const s = String(bonusStr || '')
  if (!s.trim()) return { framing: null }
  const commissionLike = /\b(arr|revenue|sales|quota|commission|ote|deal|bookings)\b/i.test(s)
  const pctM = s.match(/(\d+(?:\.\d+)?)\s*%/)
  const dollarM = s.match(/\$\s?[\d,]+(?:\.\d+)?[km]?/i)
  if (pctM && !commissionLike) {
    const targetPct = parseFloat(pctM[1])
    return { framing: 'pct', targetPct, targetDollar: base != null ? Math.round(base * targetPct / 100) : null }
  }
  if (dollarM) return { framing: 'dollar', targetDollar: parseMoney(dollarM[0]) }
  return { framing: 'dollar', targetDollar: null } // commission / unparseable -> user enters expected
}

// bonusModel: the interactive bonus band for one offer. The user drives "the number"
// — attainment % for a percent-of-base bonus, or an expected dollar for a dollar/
// commission bonus — and sees the payout. Defaults to the stated target (100% / the
// dollar target), which is the optimistic case; the UI invites dialing it to reality.
// modeled is the value at the user's chosen level; targetValue is the value at target.
export function bonusModel(offer, benefits) {
  const b = benefits || {}
  const base = parseMoney(offer && offer.base)
  const p = parseBonus(offer && offer.bonus, base)
  if (p.framing == null) return { framing: null, modeled: null }
  if (p.framing === 'pct') {
    const attRaw = parseMoney(b.bonusAttainment)
    const attainment = attRaw != null ? attRaw : 100
    const modeled = (base != null && p.targetPct != null)
      ? Math.round(base * (p.targetPct / 100) * (attainment / 100)) : null
    return { framing: 'pct', targetPct: p.targetPct, targetValue: p.targetDollar, attainment, modeled }
  }
  const expected = parseMoney(b.bonusExpected)
  const modeled = expected != null ? expected : p.targetDollar
  return { framing: 'dollar', targetValue: p.targetDollar, expected: expected != null ? expected : p.targetDollar, modeled }
}

export { ADD_LABELS }
