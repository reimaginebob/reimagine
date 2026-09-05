// Guards the api/* import surface calculation that annotates the preview smoke.
//
// The assertion that earns this file is DIRECTIONAL. The surface is every file
// reachable FROM api/* by following imports. Reverse it and most of src/ walks
// in, the annotation says "in scope" on nearly every PR, and it stops carrying
// information -- which is a quieter failure than being wrong, because the
// output still looks plausible.
//
// The live pair that pins it: api/coach.js imports src/step-position.js, so
// step-position is in the surface. src/data/staircase-explainers.js ALSO
// imports step-position, and must stay out -- nothing in api/ can reach it, so
// changing it cannot break a function bundle.
//
// The unresolved-specifier check is the other half. A rename that breaks an
// import path would otherwise silently shrink the surface, and a surface that
// is quietly too small reports "out of scope" on a change that really does
// touch the functions.
import { apiSurface, classify } from './api-surface.mjs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const { files, unresolved } = apiSurface()
const surface = new Set(files)

check(files.length > 20, `surface looks too small (${files.length} files) — did resolution break?`)
check(unresolved.length === 0,
  `${unresolved.length} import(s) did not resolve, so the surface is incomplete:\n    ${unresolved.join('\n    ')}`)

// Roots.
for (const f of ['api/claude.js', 'api/health.js', 'api/coach.js']) {
  check(surface.has(f), `${f} should be in the surface (it is under api/)`)
}

// Reached across the api/ <-> src/ boundary. This is the class the 2026-05-27
// outage lived in, so it is the class that must be visible.
check(surface.has('src/step-position.js'),
  'src/step-position.js should be in the surface — api/coach.js imports it')
check(surface.has('src/nav-labels.js'),
  'src/nav-labels.js should be in the surface — reached from api/ through coach-routing')

// Direction. These import INTO the surface and must not be counted.
for (const f of ['src/data/staircase-explainers.js', 'src/components/StaircaseExplainer.jsx', 'src/App.jsx']) {
  check(!surface.has(f), `${f} must NOT be in the surface — nothing in api/ can reach it`)
}

// Verdicts.
{
  const a = classify(['api/claude.js', 'CLAUDE.md'])
  check(a.inScope && a.inApi.length === 1 && a.other.length === 1, 'an api/ change should be in scope')

  const b = classify(['src/step-position.js'])
  check(b.inScope && b.inSurface.length === 1, 'an import-surface change should be in scope')

  const c = classify(['CLAUDE.md', '.github/workflows/smoke-preview.yml'])
  check(!c.inScope && c.other.length === 2, 'docs and workflow files alone should be out of scope')

  // The shape of PR #684: a client-only feature that reaches nothing in api/.
  const d = classify(['src/components/Staircase.jsx', 'src/data/staircase-explainers.js'])
  check(!d.inScope, 'a client-only change should be out of scope')

  // But that same PR also touched a file api/ does reach, which is why the
  // annotation is per-file rather than per-PR-shape.
  const e = classify(['src/components/Staircase.jsx', 'src/data/next-step-knowledge.js'])
  check(e.inScope && e.inSurface.includes('src/data/next-step-knowledge.js'),
    'one surface file among client files should still put the PR in scope')

  const f = classify([])
  check(!f.inScope && !f.inApi.length && !f.inSurface.length, 'no changed files should not claim scope')
}

if (failures) {
  console.error(`test-api-surface: FAIL (${failures})`)
  process.exit(1)
}
console.log(`test-api-surface: OK (${files.length} files in the api/ surface, ${[...surface].filter(f => f.startsWith('src/')).length} of them under src/)`)
