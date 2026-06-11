// Unit tests for the My Coach self-check sanitizer (src/coach-routing.js).
// Run by `npm test` and the prebuild gate.
//
// The coach is prose-only: it names a feature and emits a SELFCHECK trailer that
// the server strips and logs. There is no NAVIGATE button, so the slug->step
// routing (resolveSelfcheckNavigate / BUTTON_TARGETS) was removed (2026-06-11);
// these tests cover what remains — the trailer stripping and the FEATURE_MAP.
import { parseSelfcheck, CANONICAL_FEATURE_SLUGS, FEATURE_MAP } from '../src/coach-routing.js'
import { NAV_LABELS } from '../src/nav-labels.js'

let pass = 0, fail = 0
function eq(label, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) pass++
  else { fail++; console.error(`FAIL: ${label}\n   got  ${g}\n   want ${w}`) }
}
function ok(label, cond) { if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`) } }

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

// --- strip control lines ANYWHERE, not just trailing (2026-06-11) ---
eq('strips a stray mid-body NAVIGATE line + a dangling --- rule',
  parseSelfcheck('Want me to take you there?\nNAVIGATE: Pick a Direction\n\n---\nSELFCHECK: personal-brand'),
  { feature: 'personal-brand', text: 'Want me to take you there?' })
eq('strips a --- rule sitting between body and SELFCHECK trailer',
  parseSelfcheck('Here is your coaching.\n\n---\nSELFCHECK: go-to-market'),
  { feature: 'go-to-market', text: 'Here is your coaching.' })
eq('strips a SELFCHECK line that lands mid-body (last one wins)',
  parseSelfcheck('First part.\nSELFCHECK: none\nSecond part.\nSELFCHECK: income-now'),
  { feature: 'income-now', text: 'First part.\nSecond part.' })
eq('drops a bare horizontal rule even with no trailer',
  parseSelfcheck('Line one.\n---\nLine two.'),
  { feature: null, text: 'Line one.\nLine two.' })

// --- SELFCHECK wrapped in invented XML-ish tags must still be stripped (2026-06-11) ---
eq('strips <selfcheck>SELFCHECK: x</selfcheck> wrapper, keeps the slug',
  parseSelfcheck('Here is your coaching.\n<selfcheck>SELFCHECK: interview-prep</selfcheck>'),
  { feature: 'interview-prep', text: 'Here is your coaching.' })
eq('strips a differently-named wrapper tag (<final_gauge>SELFCHECK: none</final_gauge>)',
  parseSelfcheck('Reply body.\n<final_gauge>SELFCHECK: none</final_gauge>'),
  { feature: null, text: 'Reply body.' })
eq('drops a stray bare tag line on its own',
  parseSelfcheck('Reply body.\n<selfcheck>\nSELFCHECK: go-to-market\n</selfcheck>'),
  { feature: 'go-to-market', text: 'Reply body.' })
eq('strips <selfcheck>slug</selfcheck> with NO "SELFCHECK:" token, reads the slug',
  parseSelfcheck('Want to start there?\n<selfcheck>interview-prep</selfcheck>'),
  { feature: 'interview-prep', text: 'Want to start there?' })
eq('strips <verdict>none</verdict> element (arbitrary tag), feature null',
  parseSelfcheck('Reply.\n<verdict>none</verdict>'),
  { feature: null, text: 'Reply.' })

// --- CANONICAL_FEATURE_SLUGS (the SELFCHECK vocabulary) ---
ok('community slugs are in the canonical set',
  CANONICAL_FEATURE_SLUGS.includes('career-club-corner') && CANONICAL_FEATURE_SLUGS.includes('accountability-partner'))
ok('CANONICAL_FEATURE_SLUGS has 12 entries', CANONICAL_FEATURE_SLUGS.length === 12)

// --- FEATURE_MAP is the single structured source ---
eq('CANONICAL_FEATURE_SLUGS derives from FEATURE_MAP (same order)',
  CANONICAL_FEATURE_SLUGS, FEATURE_MAP.map(f => f.slug))
ok('every standalone/focus-gated labelId resolves in NAV_LABELS',
  FEATURE_MAP.filter(f => f.reach !== 'community').every(f => typeof NAV_LABELS[f.labelId] === 'string'))
ok('community features carry an inline label + where (no NAV_LABELS join)',
  FEATURE_MAP.filter(f => f.reach === 'community').every(f => f.label && f.where && !f.labelId))
eq('role-options label is the render-true "Career Paths" (not stale "Role Options")',
  NAV_LABELS[FEATURE_MAP.find(f => f.slug === 'role-options').labelId], 'Career Paths')

console.log(`coach-routing tests: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
