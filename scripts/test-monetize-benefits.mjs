// Unit test for src/offer-valuation.js (parseMoney + monetizeBenefits, net-pay frame).
import { parseMoney, monetizeBenefits, parseBonus, bonusModel } from '../src/offer-valuation.js'

let pass = 0, fail = 0
const ok = (name, cond) => { if (cond) { pass++ } else { fail++; console.error(`FAIL: ${name}`) } }
const eq = (name, a, b) => ok(`${name} (got ${a}, want ${b})`, a === b)

// parseMoney
eq('parseMoney $148,000', parseMoney('$148,000'), 148000)
eq('parseMoney 150k', parseMoney('150k'), 150000)
eq('parseMoney 1.5M', parseMoney('1.5M'), 1500000)
eq('parseMoney plain 20', parseMoney('20'), 20)
eq('parseMoney number passthrough', parseMoney(5000), 5000)
eq('parseMoney empty -> null', parseMoney(''), null)
eq('parseMoney junk -> null', parseMoney('to be determined'), null)
eq('parseMoney null -> null', parseMoney(null), null)

// Net benefits — full package (adds minus your premium)
const full = monetizeBenefits(
  { base: '$150,000' },
  { employeePremiumMonthly: '500', employerRetirementAnnual: '4500', employerHSAAnnual: '1000', ptoDays: '20' }
)
// pto = round(150000/260 * 20) = 11538; adds = 4500+1000+11538 = 17038; premium = 500*12 = 6000
eq('full pto value', full.adds.pto, 11538)
eq('full addTotal', full.addTotal, 17038)
eq('full premiumAnnual', full.premiumAnnual, 6000)
eq('full net = adds - premium', full.net, 17038 - 6000)
eq('full missing empty', full.missing.length, 0)

// Bob's worked example: benefits are ONLY the premium difference.
// Offer A: premium $0/mo -> net 0 ; Offer B: premium $500/mo -> net -6000.
const offerA = monetizeBenefits({ base: '$100,000' }, { employeePremiumMonthly: '0' })
const offerB = monetizeBenefits({ base: '$105,000' }, { employeePremiumMonthly: '500' })
eq('A net (no premium)', offerA.net, 0)
eq('B net (premium only)', offerB.net, -6000)
// base + net: A = 100000, B = 99000 -> A ahead by 1000 despite higher salary
eq('A base+net', 100000 + (offerA.net || 0), 100000)
eq('B base+net', 105000 + (offerB.net || 0), 99000)
ok('A beats B on firm cash+benefits', (100000 + offerA.net) > (105000 + offerB.net))

// employer premium contribution is ignored entirely (not a field, not in the math)
const withEmployerNoise = monetizeBenefits({ base: '$100,000' }, { employerPremiumAnnual: '12000', employeePremiumMonthly: '0' })
eq('employer contribution ignored -> net 0', withEmployerNoise.net, 0)

// nothing entered -> net null (caller shows "not priced in")
const empty = monetizeBenefits({ base: '$150,000' }, {})
eq('empty net null', empty.net, null)
eq('empty priced false', empty.priced, false)

// parseBonus framing
eq('parseBonus percent of base', parseBonus('15% of base target, paid annually', 100000).framing, 'pct')
eq('parseBonus percent target dollar', parseBonus('15% of base target', 100000).targetDollar, 15000)
eq('parseBonus dollar target', parseBonus('$10,000 target', 100000).framing, 'dollar')
eq('parseBonus dollar target value', parseBonus('$10,000 target', 100000).targetDollar, 10000)
eq('parseBonus commission -> dollar/no target', parseBonus('1% of net new ARR, uncapped', 100000).framing, 'dollar')
eq('parseBonus commission target null', parseBonus('1% of net new ARR', 100000).targetDollar, null)
eq('parseBonus empty -> null', parseBonus('', 100000).framing, null)

// bonusModel — percent framing, user drives attainment
const pctDefault = bonusModel({ base: '$100,000', bonus: '15% of base target' }, {})
eq('pct default attainment 100', pctDefault.attainment, 100)
eq('pct modeled at target = 15000', pctDefault.modeled, 15000)
const pctHalf = bonusModel({ base: '$100,000', bonus: '15% of base target' }, { bonusAttainment: '50' })
eq('pct modeled at 50% attainment = 7500', pctHalf.modeled, 7500)
eq('pct targetValue stays 15000', pctHalf.targetValue, 15000)
// dollar framing — user drives expected dollar
const dollarDefault = bonusModel({ base: '$100,000', bonus: '$10,000 target' }, {})
eq('dollar default modeled = target', dollarDefault.modeled, 10000)
const dollarOverride = bonusModel({ base: '$100,000', bonus: '$10,000 target' }, { bonusExpected: '6000' })
eq('dollar modeled = user expected', dollarOverride.modeled, 6000)
// no bonus -> framing null
eq('no bonus -> framing null', bonusModel({ base: '$100,000', bonus: '' }, {}).framing, null)

if (fail > 0) { console.error(`\ntest-monetize-benefits: ${fail} of ${pass + fail} checks failed.`); process.exit(1) }
console.log(`test-monetize-benefits: OK (${pass} checks passed)`)
