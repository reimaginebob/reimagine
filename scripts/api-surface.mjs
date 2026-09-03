// What the preview smoke can actually speak to.
//
// WHY THIS EXISTS. The smoke runs on every preview, which is cheap and catches
// base-branch regressions. The cost is that a green check on a PR the smoke has
// nothing to say about reads as though the PR was validated. That is the mirror
// image of the failure the workflow's own guard is written against: there, a
// smoke that silently does not run leaves the merge gate LOOKING satisfied;
// here, a smoke that runs against code this PR never touched leaves it looking
// satisfied too. Same false confidence, opposite mechanism.
//
// So the check says which it is. This computes the api/* import surface and
// classifies a list of changed files against it. It changes no pass/fail
// decision anywhere -- the smoke still runs on every preview. It only makes the
// green self-describing.
//
// THE SURFACE IS DIRECTIONAL, and getting that backwards is the easy mistake.
// It is every file reachable FROM api/* by following imports, not every file
// that mentions api/* or that imports something api/* also imports. Worked
// example from PR #684: api/coach.js imports src/step-position.js, so that file
// is in the surface. src/data/staircase-explainers.js ALSO imports
// step-position.js, and is NOT in the surface -- nothing in api/ can reach it,
// so changing it cannot break a function bundle. Following imports the wrong
// way would drag most of src/ in and make the annotation meaningless.
//
// Transitive on purpose: api/ -> src/a.js -> src/b.js puts b.js in the surface,
// because that is the path the Vercel bundler traces and the 2026-05-27 outage
// was a bundler trace failure.
//
// Usage:
//   node scripts/api-surface.mjs                     print the surface
//   node scripts/api-surface.mjs --classify <files>  verdict for changed files
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()
const CODE = /\.(?:js|mjs|jsx|cjs)$/

// Relative specifiers only. A bare specifier is a package, and a package is not
// part of this repo's surface.
const SPEC = /(?:\bfrom\s*|\bimport\s*|\brequire\s*\(\s*)['"](\.[^'"]*)['"]/g

const rel = p => path.relative(ROOT, p).split(path.sep).join('/')

function listFiles(dir) {
  const out = []
  const walk = d => {
    let entries
    try { entries = fs.readdirSync(d, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const full = path.join(d, e.name)
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(full) }
      else if (CODE.test(e.name)) out.push(full)
    }
  }
  walk(dir)
  return out
}

// Node/bundler resolution, narrowed to what this repo actually writes: an exact
// path, an extensionless path needing one, or a directory index.
function resolveSpec(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec)
  const tries = [base, ...['.js', '.mjs', '.jsx', '.cjs'].map(e => base + e),
    ...['index.js', 'index.mjs', 'index.jsx'].map(f => path.join(base, f))]
  for (const t of tries) {
    try { if (fs.statSync(t).isFile()) return t } catch { /* next */ }
  }
  return null
}

export function apiSurface() {
  const roots = listFiles(path.join(ROOT, 'api'))
  const seen = new Set(roots.map(rel))
  const queue = [...roots]
  const unresolved = []
  while (queue.length) {
    const file = queue.pop()
    let src
    try { src = fs.readFileSync(file, 'utf8') } catch { continue }
    for (const m of src.matchAll(SPEC)) {
      const target = resolveSpec(file, m[1])
      if (!target) { unresolved.push(`${rel(file)} -> ${m[1]}`); continue }
      const r = rel(target)
      if (seen.has(r)) continue
      seen.add(r)
      queue.push(target)
    }
  }
  return { files: [...seen].sort(), unresolved }
}

export function classify(changed) {
  const surface = new Set(apiSurface().files)
  const inApi = changed.filter(f => f.startsWith('api/'))
  const inSurface = changed.filter(f => !f.startsWith('api/') && surface.has(f))
  const other = changed.filter(f => !f.startsWith('api/') && !surface.has(f))
  return { inApi, inSurface, other, inScope: inApi.length > 0 || inSurface.length > 0 }
}

// Only act as a CLI when run as one. Without this guard, importing the module
// runs the block below and prints the whole surface to stdout -- which is what
// scripts/test-api-surface.mjs did on its first run, dumping 89 lines above its
// own result. A library that writes to stdout when imported is a library that
// corrupts whatever pipes it.
const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
const argv = process.argv.slice(2)
const iClassify = argv.indexOf('--classify')

if (!isCli) {
  // imported as a module; nothing to print
} else if (iClassify === -1) {
  const { files, unresolved } = apiSurface()
  for (const f of files) console.log(f)
  if (unresolved.length) {
    console.error(`\n${unresolved.length} unresolved specifier(s):`)
    for (const u of unresolved) console.error(`  ${u}`)
  }
} else {
  const changed = argv.slice(iClassify + 1).filter(Boolean)
  const { inApi, inSurface, other, inScope } = classify(changed)

  if (!changed.length) {
    console.log('SMOKE SCOPE: unknown — no changed files were supplied, so this')
    console.log('says nothing about whether the smoke below covers this change.')
  } else if (inScope) {
    console.log('SMOKE SCOPE: IN SCOPE. A green smoke below is evidence about this change.')
    if (inApi.length) {
      console.log(`\napi/ files changed (${inApi.length}):`)
      for (const f of inApi) console.log(`  ${f}`)
    }
    if (inSurface.length) {
      console.log(`\nimport surface changed (${inSurface.length}) — reachable from api/:`)
      for (const f of inSurface) console.log(`  ${f}`)
    }
    if (other.length) console.log(`\nAlso changed, outside the surface: ${other.length} file(s).`)
  } else {
    console.log('SMOKE SCOPE: OUT OF SCOPE.')
    console.log(`None of the ${changed.length} changed file(s) is under api/ or reachable from`)
    console.log('it by following imports, so the deployed functions cannot be affected.')
    console.log('')
    console.log('The smoke still runs and a green below is real — but it is evidence that')
    console.log('the api/ bundle on this branch loads, NOT that this change was validated.')
    console.log('CLAUDE.md §8 scopes the merge blocker to PRs touching api/ or its surface;')
    console.log('this is not one of those.')
  }
}
