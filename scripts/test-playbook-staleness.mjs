// Unit tests for src/playbook-staleness.mjs — the detection behind the
// opportunity-playbook staleness notice.
import { brandChanged, stalePlaybookSections, playbookIsStale, OP_BRAND_DEPENDENT_SECTIONS } from '../src/playbook-staleness.mjs'

let passed = 0
const fail = (msg) => { console.error('FAIL: ' + msg); process.exitCode = 1 }
const ok = (cond, msg) => { if (cond) passed++; else fail(msg) }
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} — got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`)

const OLD = 'You build trust by holding two truths at once.'
const NEW = 'You build your standing by holding two things at once.'
const T = (iso) => new Date(iso).getTime()

// brandChanged: text, not clocks.
ok(brandChanged(OLD, NEW), 'different brand text is a change')
ok(!brandChanged(OLD, OLD), 'identical brand text is not a change')
ok(!brandChanged(OLD, '  You build trust by holding   two truths at once.  '), 'whitespace differences are not a change')
ok(!brandChanged('', NEW), 'no snapshot means no conclusion, not a change')
ok(!brandChanged(NEW, ''), 'no current brand means no conclusion, not a change')
ok(!brandChanged(null, undefined), 'missing on both sides is not a change')

const rec = (sections, snapshot = OLD) => ({ id: 'sp_1', source: 'door2', upstream: { p3: snapshot }, sections })
const built = (iso) => ({ content: 'some content', builtAt: iso })
const outputs = (brand, changedAt) => ({ p3: brand, p3_updated_at: changedAt })

// Nothing moved: nothing is stale, however old the sections are.
eq(stalePlaybookSections(rec({ p5: built('2026-01-01T00:00:00Z'), p11: built('2026-01-01T00:00:00Z') }), outputs(OLD, T('2026-08-28T00:00:00Z'))),
  [], 'an unchanged brand leaves every section alone')

// The case that matters: brand moved, sections predate it.
eq(stalePlaybookSections(rec({ p5: built('2026-06-01T00:00:00Z'), p11: built('2026-06-01T00:00:00Z') }), outputs(NEW, T('2026-08-28T00:00:00Z'))),
  ['p5', 'p11'], 'sections built before the brand moved are stale')

// A section rebuilt after the change read the current brand already.
eq(stalePlaybookSections(rec({ p5: built('2026-06-01T00:00:00Z'), p11: built('2026-08-29T00:00:00Z') }), outputs(NEW, T('2026-08-28T00:00:00Z'))),
  ['p5'], 'a section rebuilt after the change is not stale')

// Never-built sections have nothing to be stale.
eq(stalePlaybookSections(rec({ p5: built('2026-06-01T00:00:00Z'), p11: { content: '', builtAt: null } }), outputs(NEW, T('2026-08-28T00:00:00Z'))),
  ['p5'], 'an empty section is not stale')

// Brand-independent sections stay out of it even when they are older.
eq(stalePlaybookSections(rec({ p5: built('2026-06-01T00:00:00Z'), companyRead: built('2026-01-01T00:00:00Z') }), outputs(NEW, T('2026-08-28T00:00:00Z'))),
  ['p5'], 'the Company Read is not brand-dependent and is left alone')
ok(!OP_BRAND_DEPENDENT_SECTIONS.includes('companyRead'), 'companyRead is not in the brand-dependent set')

// Missing stamps: an unknown build time can only be before the change.
eq(stalePlaybookSections(rec({ p5: { content: 'x' } }), outputs(NEW, T('2026-08-28T00:00:00Z'))),
  ['p5'], 'a section with no builtAt is treated as stale once the brand moves')
eq(stalePlaybookSections(rec({ p5: built('2026-06-01T00:00:00Z') }), { p3: NEW }),
  ['p5'], 'a missing p3_updated_at still reports the section once the text differs')

// Records with no snapshot predate upstream capture: say nothing rather than guess.
eq(stalePlaybookSections({ id: 'sp_2', sections: { p5: built('2026-01-01T00:00:00Z') } }, outputs(NEW, T('2026-08-28T00:00:00Z'))),
  [], 'a record with no upstream snapshot is not flagged')

// Plain-string section content (older shape) still counts.
eq(stalePlaybookSections(rec({ p6: 'bridge story text', p5: 'position fit text' }), outputs(NEW, T('2026-08-28T00:00:00Z'))),
  ['p5'], 'string-shaped sections are read for content, and p6 is not in the dependent set')

// Guards.
eq(stalePlaybookSections(null, outputs(NEW, 1)), [], 'no record yields nothing')
eq(stalePlaybookSections(rec({}), null), [], 'no outputs yields nothing')
ok(playbookIsStale(rec({ p5: built('2026-06-01T00:00:00Z') }), outputs(NEW, T('2026-08-28T00:00:00Z'))), 'playbookIsStale is true when a section is stale')
ok(!playbookIsStale(rec({ p5: built('2026-06-01T00:00:00Z') }), outputs(OLD, T('2026-08-28T00:00:00Z'))), 'playbookIsStale is false when the brand did not move')

console.log(`test-playbook-staleness: OK (${passed} cases passed)`)
