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
  // My Pipeline (GA 2026-08-30). It spent its pilot described only in the
  // uncached per-user block of api/coach.js, because naming it here would have
  // put it in the cached prefix every user receives and leaked a gated feature.
  // GA removes that reason: it belongs in the catalog like everything else, and
  // the chapter in the user guide carries the operating detail.
  { slug: 'my-pipeline',          reach: 'standalone',  labelId: 'pipeline',
    does: 'is the daily home for a live search: every saved Opportunity Playbook with where it stands, when they next talk, the next step they are taking, and which cards are built, ordered so whatever needs attention comes first. A next step whose date has passed is flagged Overdue; Mark done clears the step, its date, and the flag together and files what they finished onto that opportunity\'s Notes. Distinct from My Playbooks, which is the library of everything they have built. They keep it current by editing a card or by telling the coach what changed, and accepting the one-tap save' },
  { slug: 'role-options',         reach: 'standalone',  labelId: 'laneSelect', parent: 'twoDoors',
    does: 'opens up directions worth exploring, including off the obvious path' },
  { slug: 'income-now',           reach: 'standalone',  labelId: 'income',     parent: 'twoDoors',
    does: 'surfaces faster ways to bring in money while the bigger search runs. On the Go Independent track it is called "Price, Package & Launch" and is one of the two lead sections rather than a bonus: there the practice IS the goal, so it covers what to charge, how to package the work, where the buyers already gather, and the immediate next steps, never framed as a stopgap' },
  // Go Independent (2026-08-27). A second entry track, reached by its own URL,
  // for someone building a consulting or fractional-executive practice. It reuses
  // Orientation, Personal Brand, Go-to-Market and Income Now; these two entries
  // are the parts that exist only there. Named here so the Coach can speak about
  // them to the people who have them, and does not offer them to anyone else.
  { slug: 'where-you-fit',        reach: 'standalone',  labelId: 'fit',
    does: 'captures, during Orientation, the person\'s own read on the problem they solve and the kind of client who needs it. Go Independent track only. It feeds the Personal Brand as raw signal, gives Go-to-Market a hypothesis to start its client research from instead of starting cold, and tells the pricing plan who it is pricing for' },
  { slug: 'positioning-line',     reach: 'standalone',  labelId: 'positioning',
    does: 'drafts one editable sentence describing what the person sells, built from their Personal Brand and their own read on where they fit, which they edit until it sounds like them. Go Independent track only. Confirming it is what starts the practice plan, and every section after it is built from that line; it replaces Put It to Work on that track, and can be changed later' },
  { slug: 'opportunity-playbook', reach: 'standalone',  labelId: 'op',         parent: 'twoDoors',
    does: 'turns one specific live opening into a tailored plan of attack. On the Go Independent track these hold prospective clients rather than job openings, and they live in My Pipeline, which is also where a person adds one: a person can open one before they have spoken to anyone or after a first conversation, writing or speaking whatever they know so far. "Where this stands" then gives a fast read -- which of the four selling conversations they are actually in, the one move to make this week, at most three things to find out first ranked by what each unblocks, and anything worth changing in how they are selling it. "The full playbook" is the deeper build for a live one, covering what the client actually needs, whether it is worth pursuing, who is really deciding, what scoping has to settle, three ways to shape the work, what to charge and when to name it, the objections, and a follow-up note. Both run on the same sequence the business-of-consulting chapters teach, so what they read here agrees with what you tell them. Each opportunity also keeps a Notes card, where they can write anything worth remembering about it, keep a reply of yours they chose to save, and collect the steps they have finished. Those notes are private to them: nothing there feeds what Reimagine generates, and you never see them, so ask what they have written rather than assuming' },

  // Your Stories (2026-08-31). Its own surface because a story is told at this
  // company and the next one, so it belongs to the person rather than to any
  // one playbook.
  { slug: 'your-stories',        reach: 'standalone',  labelId: 'stories',
    does: 'holds the handful of STAR stories they tell in interviews, which the book puts at roughly twelve covering the range of what gets asked. The first set is built from what Orientation already holds, and the parts come from different places: the resume carries Situation and Result, the reputation answers and career pattern carry the Thought Process, and the assessment carries the story about what they are still working on. Nothing is invented — where an input does not support a story they get the question instead of a guess, and every part is editable because their words win. It tracks the six kinds a good set covers and, for one they do not have yet, shows the shape of a strong answer rather than an empty box. Remember the T here is Thought Process, never Task: that is the change this method makes to STAR and the reason its answers land. This is the set Interview Prep remixes from when it prepares them for named people' },

  { slug: 'bridge-story',         reach: 'focus-gated', labelId: 'p6',
    does: 'builds the "tell me about yourself" pitch for a chosen direction. On the Go Independent track it is called "Your Pitch" and is anchored on the person\'s earned authority to operate on their own, told to a prospective client deciding whether to buy rather than to an interviewer deciding whether to hire' },
  { slug: 'go-to-market',         reach: 'focus-gated', labelId: 'p7',
    does: 'researches target companies live, flags any with a role open right now that fits, and drafts the outreach. On the Go Independent track it is called "Find Your Clients" and starts from the buyer the person named in Where You Think You Fit, treating that as a hypothesis to confirm or productively contradict rather than a directive' },
  { slug: 'recruiters',           reach: 'focus-gated', labelId: 'recruiters',
    does: 'finds executive-search recruiters who specialize in the target function, industry, and level — boutique firms and named practice leaders at the big firms, with a note to reach out; available for a chosen direction in the Focus Playbook and for a specific role in an Opportunity Playbook' },
  { slug: 'linkedin-remix',       reach: 'focus-gated', labelId: 'p8',
    does: "rewrites the person's own LinkedIn profile for where they're headed. Called 'Your LinkedIn' on the Go Independent track" },
  { slug: 'resume-refresh',       reach: 'focus-gated', labelId: 'p_res',
    does: 'repoints the resume at a chosen direction, with a Human version for recruiters and an ATS version for online applications behind a toggle; the top Career Highlights and the body bullets are written to complement, not repeat, each other. Called "Your One-Sheet" on the Go Independent track, where it reads as a credentials document rather than a job application' },
  { slug: 'interview-prep',       reach: 'focus-gated', labelId: 'p11',
    does: 'works the likely interview questions with worked-through answers. Once the person has named anyone in Interview Team it changes shape entirely — it prepares them for each conversation by name rather than for the role in general, and marks each interviewer with the one SCOPE dimension they are mainly reading for (Strategy, Culture, Oneself, Passion, Expertise) plus a line on why, and then one more thing to consider — aimed deliberately at what they would NOT have thought of, since the first is drawn from what they already wrote and mostly confirms what they already think. That second line may be another dimension, another face of the same one, or what follows a step or two on from their own read, and it is left blank when there is nothing worth adding. All of it is written as a read rather than as fact, because it is inferred from a seat and from what the person wrote down, and nobody has spoken to these interviewers: hold that same line yourself and never tell someone what an interviewer WILL ask. Each story on a card can also be drafted in full with a chosen SCOPE emphasis, so the same story can be heard as a Strategy answer and then as a Culture one, which is the remix made concrete. So when someone has a panel, do not teach SCOPE from scratch as though it were new: it is already on their screen, named per person, and the useful conversation is which story to lead with for a given lens and what to push to the front of it — but it does NOT refresh itself when a name is added, so someone who has just filled in their panel needs to rebuild it, and that is worth telling them plainly.; under each question a "Practice this answer" box lets the person speak or type their own answer and send it here for written feedback on it. Called "Discovery Call & Pitch Prep" on the Go Independent track, where the questions are the ones a prospect asks' },
  { slug: 'industry-background',  reach: 'focus-gated', labelId: 'p9',
    does: "builds fluency in a new sector's language and players" },

  // Compensation benchmarking (comp-benchmarking brief 2026-08-07). These live
  // inside a surface as cards, not as their own nav step, so they carry an explicit
  // `label` (no NAV_LABELS join) and a `where` pointer. Compensation Read also
  // appears in Income Now for a chosen direction; Offer & Negotiation is built on it.
  { slug: 'compensation-read',    reach: 'opportunity-gated', label: 'Compensation Read',
    does: 'gives a sourced pay range for a role and market, triangulated across public salary sites and cited so the person can check it themselves; for a specific opportunity it anchors to the company\'s size and industry and sets aside sources that are matching a mislabeled version of the role',
    where: 'inside the Opportunity Playbook, and inside Income Now once a direction is picked' },
  { slug: 'buyer-read',           reach: 'opportunity-gated', label: 'Find Your Clients',
    does: 'names real, currently-operating organizations matching the buyer types the Income Now plan describes — up to eight of them, each with what they do, which buyer type it fits, and a source link to check; anything found but not sourceable is shown separately rather than dropped. If the list is off on size, industry, geography, stage, or ownership, saying so rebuilds it around that, and the card shows which screen is in force until it is cleared. It names who might buy; the plan itself covers what to say to them',
    where: 'inside Income Now, under the plan, once a direction is picked' },
  { slug: 'offer-negotiation',    reach: 'opportunity-gated', label: 'Offer & Negotiation',
    does: 'takes the offer (typed, or uploaded as a letter that it parses into its parts), places it against the sourced range, frames the ask as an evidence case from the person\'s own accomplishments, checks it against the Practical Priorities they set in Orientation, lets them price the benefits package, generates a printable set of talking points for the conversation (what to confirm, what to ask for with the words to use, what to get in writing, condensed from the analysis), and carries a static total-compensation checklist plus negotiation scripts; judgment calls (severance timing, algorithmic offers, reading layoff history, who to talk to) route here to Coach, whose ground truth is the "How an offer is put together" guide chapter',
    where: 'inside the Opportunity Playbook, built on the Compensation Read' },
  // Who You Know Here (2026-08-30). A card, not a nav step, so it carries its own
  // label and `where`. The limits matter more than the feature here: the coach
  // must never imply Reimagine can see a LinkedIn network on its own, and must
  // never promise second-degree connections, which LinkedIn exports to nobody.
  { slug: 'known-contacts',       reach: 'opportunity-gated', label: 'Who You Know Here',
    does: 'shows which of the person\'s own LinkedIn connections already work at the company on an opportunity, so they can ask for an introduction instead of applying cold, and drafts the note to send. WHEN THEY NAME SOMEONE THEY ALREADY KNOW, START THERE: they do NOT need the connections file for that. They add that one person on the card by name and draft to them straight away. Never answer "how should I approach my former colleague at X" by telling them to load a file first and come back — that sends someone with a live opportunity away for up to two days for something that takes fifteen seconds. The file is for DISCOVERING people they had forgotten they know, across every opportunity at once; it is worth having, and worth mentioning second. The full list comes from their own LinkedIn connections export, a file they request from LinkedIn on a computer and which can take up to two days to arrive — but the file is NOT a prerequisite for using this. Someone who already knows who they want to write to can add that one person by name on the card and draft immediately, and that is the right thing to tell them rather than sending them away to wait two days. That file is read in their browser and never reaches Reimagine, so you cannot see it, cannot see who they know, and must ask rather than assume. It matches first-degree connections only: LinkedIn exports no data about who their connections are connected to, so second-degree introductions are handed off to a pre-filtered LinkedIn search link on the card rather than computed. That hand-off is stronger than it sounds and worth telling people about: on LinkedIn\'s own results page every person carries a "mutual connections" line, which is the introduction path — so the move is to find someone senior enough to matter there, see who they and the person both know, and ask that shared connection for the introduction. That search is deliberately wide rather than restricted to current staff, so it also turns up people who USED to work at the company — worth steering someone toward, because a former employee will usually say plainly why a seat is open and who really decides, and because the card\'s own matching cannot find them at all (LinkedIn exports only where a connection works now, never where they worked before). If the company on the posting is wrong, or they want a parent, a subsidiary or a former name, or the results are noisy because the company\'s name is a common word, an Edit control on the card\'s "Matching on" line changes what it matches and searches for, and can add a function or city to narrow the LinkedIn search — it re-runs instantly and costs nothing, since nothing on this card is generated. They can also add someone by hand on any opportunity — worth suggesting whenever they mention knowing somebody the card has not found, since the export only knows where people worked the day it was downloaded and a fresh one can take two days. A name is enough, a title makes the note better, and every part of the card then works for that person. A blank result can mean an out-of-date file as easily as no connection, and never means the person knows nobody there — big employers run divisions and subsidiaries under their own names, people list a business unit or a former employer rather than the parent, and the file only knows where each connection worked the day it was exported. Never tell someone their network has no one at a company on the strength of an empty card; the card itself offers near-misses whose employer merely mentions the name, a way to try a different company name, and a first-degree LinkedIn check to confirm it. Before drafting it asks what the person actually wants from that contact, because reaching out is not one thing: find out who owns the role, learn what the place is really like, ask them to put in a word, or simply reconnect with no ask at all. Each keeps its own draft, so two angles on the same contact can be compared. Worth coaching on which to pick — a name costs the recipient a moment and is the right ask when an application needs to reach the right desk; a request to put in a word is the strongest move available with someone who genuinely knows their work and the wrong one to send a near-stranger; and someone they have not spoken to in years is usually best met with a note that asks for nothing. Every one of the four also offers the recipient something back, which is the Making Your Own Weather principle that a note asking for something has to put something on the table or the relationship runs one way — worth reinforcing when someone is uneasy about reaching out, because it is what makes the note a conversation rather than a request. There is also an optional line for how they know the person and what they could help them with, and it changes the draft materially: without it the note stays on the present, because nothing here will invent a shared project or a past conversation. The draft comes in two versions from one build — an email and a shorter LinkedIn message. Email is the version to push: a LinkedIn message only arrives if that person happens to be checking LinkedIn. When LinkedIn did not export the address (most connections withhold it), the card explains the common employer conventions, takes the company\'s mail domain from the person, lays out the likely address forms to try, and points at Hunter.io to confirm one — it never presents a guessed address as known. Drafting a note is the one point at which anything about a connection leaves the device — the person\'s first name, title and connection date, all of it public on their LinkedIn profile — while the connections file itself is still never uploaded and the drafts are kept on the device too',
    where: 'inside the Opportunity Playbook, under About This Company' },
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
