// Unit tests for the My Coach self-check sanitizer (src/coach-routing.js).
// Run by `npm test` and the prebuild gate.
import { resolveSelfcheckNavigate, parseSelfcheck, BUTTON_TARGETS, CANONICAL_FEATURE_SLUGS } from '../src/coach-routing.js'

let pass = 0, fail = 0
function eq(label, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) pass++
  else { fail++; console.error(`FAIL: ${label}\n   got  ${g}\n   want ${w}`) }
}
function ok(label, cond) { if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`) } }

// --- resolveSelfcheckNavigate: standalone features (button always, any state) ---
const noLane = {}, withLane = { selectedLane: 'FG' }, emptyLane = { selectedLane: '' }
eq('personal-brand -> p3', resolveSelfcheckNavigate('personal-brand', noLane), 'p3')
eq('role-options -> laneSelect', resolveSelfcheckNavigate('role-options', noLane), 'laneSelect')
eq('income-now -> income', resolveSelfcheckNavigate('income-now', noLane), 'income')
eq('opportunity-playbook -> op', resolveSelfcheckNavigate('opportunity-playbook', withLane), 'op')

// --- focus-section features: button (focus) ONLY when a lane is selected ---
eq('go-to-market + lane -> focus', resolveSelfcheckNavigate('go-to-market', withLane), 'focus')
eq('linkedin-remix + lane -> focus', resolveSelfcheckNavigate('linkedin-remix', withLane), 'focus')
eq('resume-refresh + lane -> focus', resolveSelfcheckNavigate('resume-refresh', withLane), 'focus')
eq('interview-prep + lane -> focus', resolveSelfcheckNavigate('interview-prep', withLane), 'focus')
eq('go-to-market + NO lane -> null (prose-only)', resolveSelfcheckNavigate('go-to-market', noLane), null)
eq('linkedin-remix + empty lane -> null', resolveSelfcheckNavigate('linkedin-remix', emptyLane), null)
eq('bridge-story + null profile -> null', resolveSelfcheckNavigate('bridge-story', null), null)

// --- verdict edge cases ---
eq('none -> null', resolveSelfcheckNavigate('none', withLane), null)
eq('null slug -> null', resolveSelfcheckNavigate(null, withLane), null)
eq('unknown slug -> null', resolveSelfcheckNavigate('foobar', withLane), null)
eq('case-insensitive slug', resolveSelfcheckNavigate('Personal-Brand', noLane), 'p3')

// --- parseSelfcheck: strips the trailer, returns the matched feature ---
eq('matched slug parsed + stripped',
  parseSelfcheck('Here is your coaching.\nSELFCHECK: go-to-market'),
  { feature: 'go-to-market', text: 'Here is your coaching.' })
eq('SELFCHECK none -> feature null',
  parseSelfcheck('Just coaching, no feature.\nSELFCHECK: none'),
  { feature: null, text: 'Just coaching, no feature.' })
eq('no trailer -> unchanged, feature null',
  parseSelfcheck('A reply with no trailer at all.'),
  { feature: null, text: 'A reply with no trailer at all.' })
eq('strips a stray NAVIGATE then SELFCHECK (either order)',
  parseSelfcheck('Reply body.\nNAVIGATE: p7\nSELFCHECK: go-to-market'),
  { feature: 'go-to-market', text: 'Reply body.' })
eq('strips SELFCHECK then a stray NAVIGATE',
  parseSelfcheck('Reply body.\nSELFCHECK: linkedin-remix\nNAVIGATE: p8'),
  { feature: 'linkedin-remix', text: 'Reply body.' })
eq('case-insensitive + pipe surfaced-hint tolerated',
  parseSelfcheck('Reply.\nSELFCHECK: Go-To-Market | prose'),
  { feature: 'go-to-market', text: 'Reply.' })
eq('markdown-decorated trailer line tolerated',
  parseSelfcheck('Reply.\n> SELFCHECK: resume-refresh'),
  { feature: 'resume-refresh', text: 'Reply.' })
eq('non-string input safe', parseSelfcheck(null), { feature: null, text: '' })

// --- community resources: recognized slugs, but prose-only (no button) ---
eq('career-club-corner -> null (prose-only, no in-app screen)', resolveSelfcheckNavigate('career-club-corner', withLane), null)
eq('accountability-partner -> null (prose-only)', resolveSelfcheckNavigate('accountability-partner', withLane), null)
ok('community slugs are in the canonical set',
  CANONICAL_FEATURE_SLUGS.includes('career-club-corner') && CANONICAL_FEATURE_SLUGS.includes('accountability-partner'))

// --- BUTTON_TARGETS sanity: only the reachable set ---
ok('BUTTON_TARGETS = the reachable set',
  JSON.stringify([...BUTTON_TARGETS].sort()) === JSON.stringify(['focus', 'income', 'laneSelect', 'op', 'p3']))
ok('CANONICAL_FEATURE_SLUGS has 12 entries', CANONICAL_FEATURE_SLUGS.length === 12)

console.log(`coach-routing tests: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
