// What a playbook is made of, by kind, in order, with the names the user sees.
//
// The Coach needs this to say "the company research on Imerys is not built"
// instead of guessing, and the name it uses has to be the name on the card or
// the person goes looking for something that is not there.
//
// TWO KINDS, AND THE SAME KEY IS NOT THE SAME LABEL. An Opportunity Playbook
// and a Focus Playbook share section keys but not their wording: `p5` is "The
// Role" on a direction and "Where you fit" on a specific opening, `p6` is "Your
// Bridge Story" and "Bridge Story". That is deliberate product wording, so the
// lookup is per kind rather than one merged map.
//
// Plain `.js`, no JSX: api/coach.js imports this across the api/* <-> src/*
// boundary, where `.mjs` is unsafe (CLAUDE.md section 8; the 2026-05-27
// FUNCTION_INVOCATION_FAILED outage, PR #76, reverted at 940557b).
import { NAV_LABELS } from './nav-labels.js'

// Opportunity Playbook. The first six mirror OP_COUNTED_KEYS and OP_CARD_LABELS
// in src/App.jsx and are checked against them by scripts/test-playbook-sections.mjs
// -- the Coach naming a card differently from the screen is the drift NAV_LABELS
// exists to prevent, and these two live in different files.
export const OP_COUNTED_SECTIONS = [
  { key: 'companyRead', label: 'About This Company' },
  { key: 'p5',          label: 'Where you fit' },
  { key: 'p6',          label: 'Bridge Story' },
  { key: 'p_res',       label: 'Resume Refresh' },
  { key: 'p_cover',     label: 'Cover Letter' },
  { key: 'p11',         label: 'Interview Prep' },
]

// Built only once an offer is on the table, and deliberately outside the counted
// set on the card. Named here so the Coach can see them; never described as
// missing on an opportunity that has no offer, because they are not due yet.
export const OP_OFFER_SECTIONS = [
  { key: 'salaryRead',      label: 'Compensation Read' },
  { key: 'offerNegotiation', label: 'Offer & Negotiation' },
]

// Focus Playbook. These are the sections that COUNT as building out a
// direction -- ROLE_OUTPUT_KEYS / PRACTICE_OUTPUT_KEYS in
// src/components/SavedPlaybooks.jsx, which is what the card's "8 of 8 sections
// built" is measured against.
//
// Networking Groups and Recruiters are deliberately NOT here even though
// FOCUS_ORDER renders them, exactly as Interview Team is left out of the
// opportunity count. They are live searches rather than generated sections, and
// a direction is finished without them. Counting them would have the coach
// report two things unbuilt on a playbook the screen calls complete -- the same
// invented gap as reporting a Compensation Read missing before there is an
// offer. They still appear in `built` when someone has run them; see
// FOCUS_EXTRA_SECTIONS below.
const FOCUS_KEYS = ['p5', 'p6', 'p9', 'p11', 'p_res', 'p8', 'p7', 'income']
const FOCUS_KEYS_INDEPENDENT = ['p6', 'income', 'p8', 'p_res', 'p7', 'p11']
// Available on a direction, never owed by it. Reported when built, never listed
// as missing.
const FOCUS_EXTRA_KEYS = ['groups', 'recruiters']
// The Go Independent track renames six of them (INDEPENDENT_SECTION_LABELS,
// src/App.jsx). Someone on that track has never seen the word "resume" here.
const INDEPENDENT_LABELS = {
  p7: 'Find Your Clients',
  income: 'Price, Package & Launch',
  p6: 'Your Pitch',
  p8: 'Your LinkedIn',
  p_res: 'Your One-Sheet',
  p11: 'Discovery Call & Pitch Prep',
}

const labelFor = (key, independent) => (independent && INDEPENDENT_LABELS[key]) || NAV_LABELS[key] || key

export function focusSections(independent = false) {
  const keys = independent ? FOCUS_KEYS_INDEPENDENT : FOCUS_KEYS
  return keys.map(key => ({ key, label: labelFor(key, independent) }))
}

export function focusExtraSections(independent = false) {
  return FOCUS_EXTRA_KEYS.map(key => ({ key, label: labelFor(key, independent) }))
}

// Whether one section holds real content. Shape is not uniform across records:
// door2 stores { content, builtAt } (and a bare string for p6 on older ones),
// door1 stores a plain string on `outputs`. Both answered here so no caller has
// to know which kind it is holding.
export function sectionState(record, key) {
  if (!record || typeof record !== 'object') return { built: false, builtAt: null }
  const bag = record.source === 'door2' ? record.sections : record.outputs
  const v = bag && bag[key]
  if (!v) return { built: false, builtAt: null }
  if (typeof v === 'string') return { built: !!v.trim(), builtAt: null }
  const builtAt = typeof v.builtAt === 'string' ? v.builtAt : null
  const text = typeof v.content === 'string' ? v.content : ''
  if (text.trim()) return { built: true, builtAt }
  // THE BRIDGE STORY IS NOT SHAPED LIKE THE OTHERS. Records written before
  // 2026-05-31 store it as { bridge_story, user_picks, user_freeform } with no
  // `content` at all, and normalizeProfileState preserves that rather than
  // migrating it (see bridgeStoryToProse in src/App.jsx, whose legacy branch
  // carries a do-not-delete note). The screen decodes it and shows the section
  // as built; reading only `content` here would report a finished Bridge Story
  // as missing and have the coach offer to build it again -- the exact failure
  // this file exists to prevent. Presence is enough: the decoding itself stays
  // in App.jsx, because all this needs to know is whether there is something.
  if (v.bridge_story) return { built: true, builtAt }
  if (typeof v.user_freeform === 'string' && v.user_freeform.trim()) return { built: true, builtAt }
  return { built: false, builtAt }
}

// Which section set a saved direction was actually built with.
//
// The track is a mutable per-user column (api/admin/track-access.js does
// `UPDATE users SET track`), so someone moved onto Go Independent still has the
// directions they built before, and those carry the standard ten. Reading the
// current session's track for every record would rename their old work -- their
// Resume Refresh reported to the coach as "Your One-Sheet", a name they have
// never seen on it.
//
// The independent set is a strict subset of the standard one, so a record
// holding any standard-only section proves which it is. Anything else follows
// the session, which is right for every record built under the current track.
export function recordIsIndependent(record, sessionIndependent) {
  // The record says so itself. The positioning step stamps lane 'independent'
  // the same way Door 2 stamps 'specific' (LANE_LABELS, src/nav-labels.js), and
  // SavedPlaybooks.jsx already counts its sections off exactly this -- per
  // record rather than per session, so a direction counted right today stays
  // counted right whoever opens it later, and a track switch cannot rename
  // someone's finished work at them.
  if (record && typeof record === 'object' && record.lane) return record.lane === 'independent'
  // Only for a record old enough to carry no lane at all. The independent set is
  // a strict subset of the standard one, so a standard-only section still proves
  // which it is; anything else follows the session.
  if (!sessionIndependent) return false
  return !['p5', 'p9'].some(k => sectionState(record, k).built)
}

// The sections that apply to this record, so nothing is reported missing that
// was never due. The offer pair joins an opportunity only once one of them
// exists or the opportunity has reached an offer.
export function sectionsFor(record, { independent = false, hasOffer = false } = {}) {
  if (!record || record.source !== 'door2') {
    const extra = focusExtraSections(independent).filter(s => sectionState(record, s.key).built)
    return [...focusSections(independent), ...extra]
  }
  const offer = OP_OFFER_SECTIONS.filter(s => hasOffer || sectionState(record, s.key).built)
  return [...OP_COUNTED_SECTIONS, ...offer]
}

// What is built in one record and what is not, by user-facing name, in the
// order the screen builds them. Returns names only: no count, no total, no
// fraction. Callers phrase it; nobody is handed a score.
export function describeSections(record, opts = {}) {
  const built = [], todo = []
  const resolved = { ...opts, independent: recordIsIndependent(record, !!opts.independent) }
  for (const sec of sectionsFor(record, resolved)) {
    (sectionState(record, sec.key).built ? built : todo).push(sec.label)
  }
  return { built, todo }
}
