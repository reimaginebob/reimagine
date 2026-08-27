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
// parent: OPTIONAL NAV_LABELS key. When present, this feature renders as a child
//   of that sidebar item rather than at the top level, and the generated map says
//   so. Set it whenever a feature is nested — a coach that says "point someone
//   straight there" about a nested feature sends them looking for a label that is
//   not on their screen (the Aug 11 2026 navigation reports). The sidebar itself
//   was corrected for this nesting on 2026-06-04 (src/App.jsx primaryItems);
//   FEATURE_MAP was not, and drifted for two months.
export const FEATURE_MAP = [
  { slug: 'personal-brand',       reach: 'standalone',  labelId: 'p3',
    does: 'finds the through-line that ties a varied background together' },
  { slug: 'role-options',         reach: 'standalone',  labelId: 'laneSelect', parent: 'twoDoors',
    does: 'opens up directions worth exploring, including off the obvious path' },
  { slug: 'income-now',           reach: 'standalone',  labelId: 'income',     parent: 'twoDoors',
    does: 'surfaces faster ways to bring in money while the bigger search runs' },
  { slug: 'opportunity-playbook', reach: 'standalone',  labelId: 'op',         parent: 'twoDoors',
    does: 'turns one specific live opening into a tailored plan of attack' },

  { slug: 'bridge-story',         reach: 'focus-gated', labelId: 'p6',
    does: 'builds the "tell me about yourself" pitch for a chosen direction' },
  { slug: 'go-to-market',         reach: 'focus-gated', labelId: 'p7',
    does: 'researches target companies live, flags any with a role open right now that fits, and drafts the outreach' },
  { slug: 'recruiters',           reach: 'focus-gated', labelId: 'recruiters',
    does: 'finds executive-search recruiters who specialize in the target function, industry, and level — boutique firms and named practice leaders at the big firms, with a note to reach out; available for a chosen direction in the Focus Playbook and for a specific role in an Opportunity Playbook' },
  { slug: 'linkedin-remix',       reach: 'focus-gated', labelId: 'p8',
    does: "rewrites the person's own LinkedIn profile for where they're headed" },
  { slug: 'resume-refresh',       reach: 'focus-gated', labelId: 'p_res',
    does: 'repoints the resume at a chosen direction, with a Human version for recruiters and an ATS version for online applications behind a toggle; the top Career Highlights and the body bullets are written to complement, not repeat, each other' },
  { slug: 'interview-prep',       reach: 'focus-gated', labelId: 'p11',
    does: 'works the likely interview questions with worked-through answers; under each question a "Practice this answer" box lets the person speak or type their own answer and send it here for written feedback on it' },
  { slug: 'industry-background',  reach: 'focus-gated', labelId: 'p9',
    does: "builds fluency in a new sector's language and players" },

  // Compensation benchmarking (comp-benchmarking brief 2026-08-07). These live
  // inside a surface as cards, not as their own nav step, so they carry an explicit
  // `label` (no NAV_LABELS join) and a `where` pointer. Compensation Read also
  // appears in Income Now for a chosen direction; Offer & Negotiation is built on it.
  { slug: 'compensation-read',    reach: 'opportunity-gated', label: 'Compensation Read',
    does: 'gives a sourced pay range for a role and market, triangulated across public salary sites and cited so the person can check it themselves; for a specific opportunity it anchors to the company\'s size and industry and sets aside sources that are matching a mislabeled version of the role',
    where: 'inside the Opportunity Playbook, and inside Income Now once a direction is picked' },
  { slug: 'buyer-read',           reach: 'opportunity-gated', label: 'Who Fits That Description',
    does: 'names real, currently-operating organizations matching the buyer types the Income Now plan describes — five to eight of them, each with what they do, which buyer type it fits, and a source link to check; anything found but not sourceable is shown separately rather than dropped. If the list is off on size, industry, geography, stage, or ownership, saying so rebuilds it around that, and the card shows which screen is in force until it is cleared. It names who might buy; the plan itself covers what to say to them',
    where: 'inside Income Now, under the plan, once a direction is picked' },
  { slug: 'offer-negotiation',    reach: 'opportunity-gated', label: 'Offer & Negotiation',
    does: 'takes the offer (typed, or uploaded as a letter that it parses into its parts), places it against the sourced range, frames the ask as an evidence case from the person\'s own accomplishments, checks it against the Practical Priorities they set in Orientation, lets them price the benefits package, generates a printable set of talking points for the conversation (what to confirm, what to ask for with the words to use, what to get in writing, condensed from the analysis), and carries a static total-compensation checklist plus negotiation scripts; judgment calls (severance timing, algorithmic offers, reading layoff history, who to talk to) route here to Coach, whose ground truth is the "How an offer is put together" guide chapter',
    where: 'inside the Opportunity Playbook, built on the Compensation Read' },
  { slug: 'offer-comparison',     reach: 'opportunity-gated', label: 'Compare offers',
    does: 'lines up the person\'s logged offers side by side, with the priced value of each benefits package on its own line rather than blended into one number; informational, it does not rank the offers or say which to take',
    where: 'in My Playbooks, once two or more opportunities have a logged offer' },
  { slug: 'playbook-markdown',    reach: 'focus-gated', label: 'Markdown download',
    does: 'downloads one playbook as a plain text file — the Personal Brand, then every section built for that role — for editing, pasting elsewhere, or feeding into another tool; the Save Playbook as PDF button is the formatted version to hand to a person',
    where: 'on each card in My Playbooks' },

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
  // Strip the wrapper characters the model puts around the verdict before testing
  // it. Without this, "**none**", "none.", and "\"none\"" all fail the !== 'none'
  // test and get logged as matched features, and a real slug wrapped in emphasis
  // ("go-to-market**") buckets separately from the clean one in the insights
  // dashboard. A canonical slug is [a-z][a-z0-9-]*, so no stripped character is
  // ever load-bearing. The prompt already forbids XML wrappers by name and the
  // parser already defends against them; markdown emphasis was the family nobody
  // covered, and it accounted for 3 of the 6 "matched" turns in the two weeks to
  // 2026-08-13.
  const normalizeSlug = raw => String(raw).trim().toLowerCase().replace(/^[\s*_`'"]+|[\s*_`'".,;:!?]+$/g, '')
  const setFeature = raw => { const s = normalizeSlug(raw); feature = (s && s !== 'none') ? s : null }
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
