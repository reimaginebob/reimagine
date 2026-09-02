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

// Focus Playbook, in the order the screen builds them (FOCUS_ORDER, src/App.jsx).
// Labels join from NAV_LABELS so a rename lands here at the same time.
const FOCUS_KEYS = ['p5', 'p6', 'p9', 'p11', 'p_res', 'p8', 'p7', 'groups', 'recruiters', 'income']
const FOCUS_KEYS_INDEPENDENT = ['p6', 'income', 'p8', 'p_res', 'p7', 'p11']
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

export function focusSections(independent = false) {
  const keys = independent ? FOCUS_KEYS_INDEPENDENT : FOCUS_KEYS
  return keys.map(key => ({
    key,
    label: (independent && INDEPENDENT_LABELS[key]) || NAV_LABELS[key] || key,
  }))
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
  const text = typeof v.content === 'string' ? v.content : ''
  return { built: !!text.trim(), builtAt: typeof v.builtAt === 'string' ? v.builtAt : null }
}

// The sections that apply to this record, so nothing is reported missing that
// was never due. The offer pair joins an opportunity only once one of them
// exists or the opportunity has reached an offer.
export function sectionsFor(record, { independent = false, hasOffer = false } = {}) {
  if (!record || record.source !== 'door2') return focusSections(independent)
  const offer = OP_OFFER_SECTIONS.filter(s => hasOffer || sectionState(record, s.key).built)
  return [...OP_COUNTED_SECTIONS, ...offer]
}

// What is built in one record and what is not, by user-facing name, in the
// order the screen builds them. Returns names only: no count, no total, no
// fraction. Callers phrase it; nobody is handed a score.
export function describeSections(record, opts = {}) {
  const built = [], todo = []
  for (const sec of sectionsFor(record, opts)) {
    (sectionState(record, sec.key).built ? built : todo).push(sec.label)
  }
  return { built, todo }
}
