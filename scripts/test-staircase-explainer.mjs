// Renders the staircase and its explainer popup and checks the rules that
// matter, because they are rules a future edit can break silently.
//
// The one worth the whole file: A GATED FEATURE NEVER GETS A BUTTON. Go-to-
// Market needs a chosen direction, Offer & Negotiation needs a live
// opportunity, and a control that lands on a "pick a direction first" wall is
// the soft version of a dead link. Those rows are NAMED, with what opens them,
// and carry no way in. That rule lives in a comment and in one boolean; a
// refactor that inverted it would look fine in review and would be found by a
// user hitting a wall.
//
// The same check covers `canGo`, the guard for a screen the app cannot serve
// right now (Your STAR Stories renders null before it is ready), and that
// button text comes from NAV_LABELS rather than the row's own name -- the
// Career Club Corner row opens Job Search Resources, and saying otherwise
// would be a label the UI does not render.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import esbuild from 'esbuild'

const ROOT = process.cwd()
// The bundle has to sit INSIDE the repo: react and react-dom stay external so
// the components run against the real installed copies, and Node resolves a
// bare "react" import from the importing file's own node_modules chain. Built
// into the system temp dir, that chain does not reach this project.
const tmp = path.join(ROOT, 'node_modules/.cache/staircase-test')
fs.mkdirSync(tmp, { recursive: true })
const entry = path.join(tmp, 'entry.jsx')
const out = path.join(tmp, 'bundle.mjs')

fs.writeFileSync(entry, `
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Staircase from ${JSON.stringify(path.join(ROOT, 'src/components/Staircase.jsx'))}
import StaircaseExplainer from ${JSON.stringify(path.join(ROOT, 'src/components/StaircaseExplainer.jsx'))}
import { STAIRCASE_EXPLAINERS, NEEDS_LABEL } from ${JSON.stringify(path.join(ROOT, 'src/data/staircase-explainers.js'))}
import { NAV_LABELS } from ${JSON.stringify(path.join(ROOT, 'src/nav-labels.js'))}
export { React, renderToStaticMarkup, Staircase, StaircaseExplainer, STAIRCASE_EXPLAINERS, NEEDS_LABEL, NAV_LABELS }
`)

await esbuild.build({
  entryPoints: [entry], bundle: true, format: 'esm', outfile: out,
  platform: 'node', jsx: 'automatic', logLevel: 'silent',
  external: ['react', 'react-dom', 'react-dom/server'],
})

// pathToFileURL, not the bare path: on Windows `out` is C:\... and the ESM
// loader reads the drive letter as a URL scheme (ERR_UNSUPPORTED_ESM_URL_SCHEME).
// Linux CI never sees it, so this failed only on a developer machine -- and it
// failed by halting `npm run build` before vite ever ran.
const M = await import(pathToFileURL(out).href)
const { React, renderToStaticMarkup, Staircase, StaircaseExplainer, STAIRCASE_EXPLAINERS, NEEDS_LABEL, NAV_LABELS } = M

const C = {
  bg: '#F7F8FA', panel: '#FFFFFF', card: '#FFFFFF', input: '#F3F4F6',
  border: '#E2E5EA', gold: '#C8924A', goldL: '#A06828',
  cream: '#1A2540', creamD: '#2D3748', gray: '#3D4A5C', grayL: '#2D3748',
  ok: '#2E7D52', err: '#C0392B',
}
const Btn = ({ children }) => React.createElement('button', null, children)
const render = el => renderToStaticMarkup(el)
const strip = html => html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&times;/g, '×')
  .replace(/&mdash;|&#x2014;/g, '—').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ')

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// Split the rendered dialog into its feature rows, keyed by label. Each row
// carries data-give (its label) and data-door ("open" when it rendered a way
// in). Boundaries are the next row marker or the end of the markup.
function rowsOf(html) {
  const marks = [...html.matchAll(/data-give="([^"]*)"\s+data-door="([^"]*)"/g)]
  const map = new Map()
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : html.length
    map.set(m[1].replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&'),
      { door: m[2], html: html.slice(m.index, end) })
  })
  return map
}

// --- The explainer, term by term -------------------------------------------
const terms = Object.keys(STAIRCASE_EXPLAINERS)
check(terms.length === 10, `expected 10 explainers, found ${terms.length}`)

for (const term of terms) {
  const ex = STAIRCASE_EXPLAINERS[term]
  const html = render(React.createElement(StaircaseExplainer, {
    term, onClose: () => {}, onGo: () => {}, canGo: () => true, C, Btn,
  }))
  const text = strip(html)

  check(text.includes(ex.title), `${term}: title missing`)
  check(html.includes('role="dialog"'), `${term}: not a dialog`)
  check(html.includes('aria-label="Close"'), `${term}: no close control`)

  // Per ROW, not per document. Two rows can point at the same screen -- BATNA
  // names Compare offers (gated) and My Pipeline (open), both `pipeline` -- so
  // searching the whole page for "Open My Pipeline" finds the open row's button
  // and calls the gated row a pass. That false negative is exactly the failure
  // this file exists to catch, so the boundary matters.
  const rows = rowsOf(html)
  for (const g of ex.gives) {
    const row = rows.get(g.label)
    check(!!row, `${term}: give "${g.label}" not rendered`)
    if (!row) continue
    const rowText = strip(row.html)
    check(rowText.includes(g.label), `${term}: give "${g.label}" not named`)
    check(rowText.includes(g.does.slice(0, 40)), `${term}: give "${g.label}" says nothing about what it does`)
    const dest = (g.to && NAV_LABELS[g.to]) || g.label
    if (g.needs) {
      // THE LOCKED RULE.
      check(row.door === 'none' && !/<button/.test(row.html),
        `${term}: GATED give "${g.label}" rendered a button — a gated feature is named, never a door`)
      check(rowText.includes(NEEDS_LABEL[g.needs]), `${term}: gated give "${g.label}" does not say what opens it`)
    } else if (g.to) {
      check(row.door === 'open' && rowText.includes(`Open ${dest}`),
        `${term}: open give "${g.label}" has no way in (expected "Open ${dest}")`)
    } else {
      check(row.door === 'none' && !/<button/.test(row.html),
        `${term}: give "${g.label}" has no target but rendered a button`)
    }
  }

  // Acrostic rows are a list, and the letters have to survive as letters.
  if (Array.isArray(ex.bullets) && ex.bullets.length) {
    check(html.includes('<ul'), `${term}: bullets did not render as a list`)
    for (const b of ex.bullets) check(text.includes(b.lead), `${term}: bullet "${b.lead}" missing`)
    const spelled = ex.bullets.map(b => b.letter).join('')
    check(/^[A-Z]+$/.test(spelled), `${term}: bullet letters are not letters (${spelled})`)
  }
  if (ex.outro) check(text.includes(ex.outro.slice(0, 40)), `${term}: outro missing`)

  // A quote has to arrive AS a quote, with its credit. An unattributed
  // borrowed line reads as ours, which is the only way this field can be wrong.
  if (ex.quote) {
    check(text.includes(ex.quote.text), `${term}: quote text missing`)
    check(/<blockquote/.test(html), `${term}: quote did not render as a blockquote`)
    check(!!ex.quote.attribution, `${term}: quote carries no attribution`)
    check(text.includes(ex.quote.attribution), `${term}: quote attribution missing from the page`)
  }
}

// --- canGo closes the door --------------------------------------------------
{
  const html = render(React.createElement(StaircaseExplainer, {
    term: 'STAR Stories', onClose: () => {}, onGo: () => {}, canGo: () => false, C, Btn,
  }))
  const row = rowsOf(html).get('Your STAR Stories')
  check(!!row, 'canGo=false: the feature should still be named')
  check(row && row.door === 'none' && !/<button/.test(row.html),
    'canGo=false: rendered a button to a screen the app cannot serve')
}

// --- The staircase itself ---------------------------------------------------
{
  const wired = render(React.createElement(Staircase, {
    step: 3, keelLetter: 'E', keelGloss: '', stalled: false, positions: [],
    C, Btn, onGo: () => {}, canGo: () => true,
  }))
  for (const term of terms) {
    const re = new RegExp(`aria-label="What ${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} means"`)
    check(re.test(wired), `staircase: "${term}" is not a control`)
  }
  // Assert that an invitation EXISTS, not what it says -- the wording is copy
  // and changes on Bob's read; the affordance is behaviour and must not vanish.
  // Anchored on the two things it has to do: tell them to press, and say the
  // features are behind it.
  const wiredText = strip(wired)
  check(/press it/i.test(wiredText), 'staircase: nothing tells the reader the terms are pressable')
  check(/Reimagine/.test(wiredText), 'staircase: the invitation does not say the product is behind them')

  // Without the wiring the terms must degrade to plain text rather than to
  // buttons that do nothing.
  const bare = render(React.createElement(Staircase, {
    step: 3, keelLetter: 'E', keelGloss: '', stalled: false, positions: [], C,
  }))
  check(!/aria-label="What /.test(bare), 'staircase: rendered controls with nothing behind them')
  check(!/press it/i.test(strip(bare)), 'staircase: invited a press that does nothing')
  for (const term of terms) check(strip(bare).includes(term), `staircase: "${term}" vanished when unwired`)
}

fs.rmSync(tmp, { recursive: true, force: true })

if (failures) {
  console.error(`test-staircase-explainer: FAIL (${failures})`)
  process.exit(1)
}
console.log(`test-staircase-explainer: OK (${terms.length} explainers, gated rows carry no door)`)
