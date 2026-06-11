// My Coach feature-routing — reachability sanitizer + SELFCHECK parsing.
//
// Replaces the earlier keyword router (detectFeatureNavigate). The model now
// runs a "hidden self-check" each turn and emits a SELFCHECK trailer naming the
// matched feature by a stable slug (or "none"). This module's job is NOT to
// guess intent — the model does that well — but to GUARANTEE the navigation
// button can never be dead or wrong-target, by resolving the slug to a step
// that actually renders, given the user's profile state.
//
// Why a slug, not a step id: the playbook features (Go-to-Market, LinkedIn
// Remix, Resume Refresh, Bridge Story, Interview Prep, Industry Background) have
// NO standalone rStep() case — they render only as sections inside `focus`,
// gated on a selected lane. So a literal "NAVIGATE: p8" is a dead screen. Slugs
// decouple the model's intent from the step ids, and the sanitizer maps a slug
// to a reachable step (or null = prose-only) per the locked product rule:
// focus-section features with NO lane selected get NO button (a button that
// lands on a "pick a direction first" gate is the soft version of a dead link).
//
// Cross-boundary import note: imported by api/coach.js, so this file is `.js`
// (never `.mjs`); the Vercel bundler does not reliably trace `.mjs` from api/*
// into src/* (the 2026-05-27 FUNCTION_INVOCATION_FAILED outage, PR #76).

// The stable feature vocabulary the model emits in SELFCHECK. Decoupled from
// step ids on purpose.
// The single structured source for the coach's feature catalog + reachability.
// Labels are NOT stored here — they are joined from NAV_LABELS (src/nav-labels.js)
// by `labelId` at generate time (scripts/lib/render-coach-nav-map.mjs), so the
// label a feature carries is exactly what the UI renders and a rename can't
// desync. Order here = order in the generated COACH_NAV_MAP.
//
// reach (drives the generated nav map's grouping + the focus-gating prose):
//   'standalone'  — its own always-rendering step.
//   'focus-gated' — a section inside the Focus Playbook, for a chosen direction.
//   'community'   — not an in-app tool; carries an inline `label` + `where`
//                   pointer (no NAV_LABELS entry to join).
// labelId: the NAV_LABELS key to join the user-facing label from (standalone +
//   focus-gated). The generator hard-fails if it is not in NAV_LABELS.
export const FEATURE_MAP = [
  { slug: 'personal-brand',       reach: 'standalone',  labelId: 'p3',
    does: 'finds the through-line that ties a varied background together' },
  { slug: 'role-options',         reach: 'standalone',  labelId: 'laneSelect',
    does: 'opens up directions worth exploring, including off the obvious path' },
  { slug: 'income-now',           reach: 'standalone',  labelId: 'income',
    does: 'surfaces faster ways to bring in money while the bigger search runs' },
  { slug: 'opportunity-playbook', reach: 'standalone',  labelId: 'op',
    does: 'turns one specific live opening into a tailored plan of attack' },

  { slug: 'bridge-story',         reach: 'focus-gated', labelId: 'p6',
    does: 'builds the "tell me about yourself" pitch for a chosen direction' },
  { slug: 'go-to-market',         reach: 'focus-gated', labelId: 'p7',
    does: 'researches target companies live and drafts the outreach' },
  { slug: 'linkedin-remix',       reach: 'focus-gated', labelId: 'p8',
    does: "rewrites the person's own LinkedIn profile for where they're headed" },
  { slug: 'resume-refresh',       reach: 'focus-gated', labelId: 'p_res',
    does: 'repoints the resume at a chosen direction' },
  { slug: 'interview-prep',       reach: 'focus-gated', labelId: 'p11',
    does: 'works the likely interview questions with worked-through answers' },
  { slug: 'industry-background',  reach: 'focus-gated', labelId: 'p9',
    does: "builds fluency in a new sector's language and players" },

  // Community resources — surfaced in prose only (especially on discouragement
  // turns when someone is carrying the search alone). No step. The Corner pointer
  // is always "register at career.club", never an in-app screen.
  { slug: 'career-club-corner',     reach: 'community', label: 'Career Club Corner',
    where: 'register at career.club',            does: 'a free weekly call with people in the same search' },
  { slug: 'accountability-partner', reach: 'community', label: 'an accountability partner',
    where: 'one person to check in with weekly', does: 'turns a lonely grind into a standing date' },
]

// The coach's feature vocabulary (the SELFCHECK slugs). The coach is prose-only
// (2026-06-11): it names a feature and the SELFCHECK trailer logs the verdict —
// there is no NAVIGATE button, so the slug->step routing that used to live here
// (resolveSelfcheckNavigate, BUTTON_TARGETS, and the standalone/focus-section
// lookup tables) was removed. CANONICAL_FEATURE_SLUGS stays:
// scripts/check-coach-nav-map.mjs asserts FEATURE_MAP's slugs equal it.
export const CANONICAL_FEATURE_SLUGS = FEATURE_MAP.map(f => f.slug)

// Pull the SELFCHECK verdict off the reply and strip every control line from the
// visible text. Returns { feature: <slug|null>, text: <cleaned> }. `feature` is
// null when the self-check verdict is "none" or absent; a non-canonical slug is
// returned verbatim (so model drift is visible in logs) but resolves to no button.
//
// Strip-ANYWHERE, not just trailing (2026-06-11): the model occasionally emits a
// SELFCHECK or a stray NAVIGATE control line mid-body, or drops a markdown
// horizontal rule ("---") between the reply and its trailer. The earlier
// trailing-only peel left those in the user-visible text (a stray "NAVIGATE: Pick
// a Direction" and a "---" rule both leaked live). Now any line that IS a control
// line (SELFCHECK / NAVIGATE) or a bare horizontal rule is removed wherever it
// appears; the last SELFCHECK seen wins the feature. The canonical NAVIGATE is
// re-attached server-side from the resolved slug after this runs, so dropping all
// model-emitted NAVIGATE lines here is correct.
// A control line is any line that CONTAINS a SELFCHECK:/NAVIGATE: token —
// regardless of what wraps it. The model has wrapped the trailer in invented
// XML-ish tags (`<selfcheck>SELFCHECK: x</selfcheck>`, `<final_gauge>SELFCHECK:
// none</final_gauge>`) and markdown, which a start-anchored match missed and let
// leak live (2026-06-11). Match the token anywhere on the line and drop the whole
// line; read the slug up to the first `<`, `|`, or end. Also drop a bare tag-only
// line (`<selfcheck>` / `</foo>`) and stray horizontal rules.
const SELFCHECK_TOKEN_RE = /\bSELFCHECK:\s*([^\n|<]*?)\s*(?:[|<].*)?$/i
const NAVIGATE_LINE_RE = /\bNAVIGATE:/i
// A line that is ONLY an XML-ish element: <tag>inner</tag>, a bare <tag> / </tag>,
// or a self-closing <tag/>. The model wraps the verdict in invented, varying tags
// (<selfcheck>interview-prep</selfcheck>, <final_gauge>SELFCHECK: none</final_gauge>)
// with no reliable "SELFCHECK:" token. A coaching reply uses markdown, never a
// standalone XML element, so dropping such a line is always safe; the inner text
// (minus any "SELFCHECK:" prefix) is read as the slug when it looks like one.
const XML_ELEMENT_LINE_RE = /^\s*<([A-Za-z][\w-]*)(?:\s[^>]*)?>\s*([\s\S]*?)\s*<\/\1\s*>\s*$/
const BARE_TAG_RE = /^\s*<\/?[A-Za-z][\w-]*(?:\s[^>]*)?\/?>\s*$/
const SLUG_RE = /^[a-z][a-z0-9-]*$/
const HRULE_LINE_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/

export function parseSelfcheck(text) {
  if (typeof text !== 'string' || !text) return { feature: null, text: text || '' }
  let feature = null
  const setFeature = raw => { const s = raw.trim().toLowerCase(); feature = (s && s !== 'none') ? s : null }
  const kept = []
  for (const line of text.split('\n')) {
    const sc = line.match(SELFCHECK_TOKEN_RE)
    if (sc) { setFeature(sc[1]); continue } // explicit "SELFCHECK:" token, any wrapper
    const el = line.match(XML_ELEMENT_LINE_RE)
    if (el) {
      const inner = el[2].replace(/^\s*SELFCHECK:\s*/i, '').trim()
      if (SLUG_RE.test(inner.toLowerCase())) setFeature(inner)
      continue // drop a standalone <tag>...</tag> verdict line
    }
    if (BARE_TAG_RE.test(line)) continue // drop a stray bare / self-closing tag line
    if (NAVIGATE_LINE_RE.test(line)) continue // drop stray NAVIGATE lines anywhere
    if (HRULE_LINE_RE.test(line)) continue // drop stray markdown horizontal rules
    kept.push(line)
  }
  const out = kept.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '')
  return { feature, text: out }
}
