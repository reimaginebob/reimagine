// Unit test for src/offer-valuation.js (parseMoney + monetizeBenefits, Phase 3b).
import { parseMoney, monetizeBenefits } from '../src/offer-valuation.js'

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

// monetizeBenefits — full package
const full = monetizeBenefits(
  { base: '$150,000' },
  { employerPremiumAnnual: '$9,000', employeePremiumAnnual: '$1,440', employerRetirementAnnual: '4500', employerHSAAnnual: '1000', ptoDays: '20' }
)
// pto = round(150000/260 * 20) = round(11538.46) = 11538
eq('full pto value', full.components.pto, 11538)
eq('full health', full.components.health, 9000)
eq('full retirement', full.components.retirement, 4500)
eq('full hsa', full.components.hsa, 1000)
eq('full total', full.total, 9000 + 4500 + 1000 + 11538)
eq('full missing empty', full.missing.length, 0)
eq('full priced 4', full.priced, 4)

// missing base -> pto can't be priced
const noBase = monetizeBenefits({ base: '' }, { employerHSAAnnual: '1000', ptoDays: '20' })
eq('noBase pto null', noBase.components.pto, null)
eq('noBase total is hsa only', noBase.total, 1000)
ok('noBase reports pto missing', noBase.missing.includes('PTO value'))

// nothing entered -> total null (caller shows "not priced in")
const empty = monetizeBenefits({ base: '$150,000' }, {})
eq('empty total null', empty.total, null)
eq('empty priced 0', empty.priced, 0)

if (fail > 0) { console.error(`\ntest-monetize-benefits: ${fail} of ${pass + fail} checks failed.`); process.exit(1) }
console.log(`test-monetize-benefits: OK (${pass} checks passed)`)
