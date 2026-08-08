// Offer valuation helpers (offer-benefits-intake brief 2026-08-07, Phase 3b).
// Pure, dependency-free, unit-tested in scripts/test-monetize-benefits.mjs. Kept in
// its own module (not App.jsx) precisely so it is importable by the test. Monetization
// is locked to 2026-08-07_offer-composition-deep-reference.md Part 2 "Benefits
// monetization". .js extension (src-only import; no api/ boundary crossed).

// parseMoney: tolerant number extraction from the free-text offer/benefits strings
// ("$148,000" -> 148000, "150k" -> 150000, "20" -> 20). Returns null when there is
// no parseable number, so callers can distinguish "unset" from zero.
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

// monetizeBenefits: turn the 3a benefits intake into a dollar value, per the
// reference doc. Components:
//   - health     = employer's premium contribution (the subsidy the employee receives;
//                   the doc's "employer premium contribution net of the alternative cost")
//   - retirement = employer 401(k) match, entered as an annual dollar figure
//   - hsa        = employer HSA/FSA contribution, annual dollars
//   - pto        = (base / 260 working days) * PTO days
// Returns { total, components, missing[], priced } where total is null when nothing
// could be priced (so the caller shows "not priced in", never a silent $0).
const BENEFIT_LABELS = { health: 'Employer health premium', retirement: '401(k) match', hsa: 'HSA / FSA', pto: 'PTO value' }
export function monetizeBenefits(offer, benefits) {
  const b = benefits || {}
  const base = parseMoney(offer && offer.base)
  const ptoDays = parseMoney(b.ptoDays)
  const components = {
    health: parseMoney(b.employerPremiumAnnual),
    retirement: parseMoney(b.employerRetirementAnnual),
    hsa: parseMoney(b.employerHSAAnnual),
    pto: (base != null && ptoDays != null) ? Math.round((base / 260) * ptoDays) : null,
  }
  const present = Object.entries(components).filter(([, v]) => v != null && v > 0)
  const total = present.length ? present.reduce((s, [, v]) => s + v, 0) : null
  const missing = Object.keys(components).filter(k => components[k] == null).map(k => BENEFIT_LABELS[k])
  return { total, components, missing, priced: present.length }
}

export { BENEFIT_LABELS }
