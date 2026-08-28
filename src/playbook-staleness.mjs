// Does this playbook still reflect the person it was built for?
//
// The Focus surface has answered that since PR #148, per section, by comparing
// timestamps in `outputs`. The Opportunity surface never has: its sections live
// on the saved-playbook record (rec.sections[key].builtAt), not in `outputs`,
// and no opportunity section appears in SECTION_UPSTREAMS at all. So the
// surface a person actually walks into an interview with has carried no signal
// of any kind. Measured 2026-08-28: 17 of 145 live playbooks across 11 accounts
// were built on a Personal Brand their owner has since changed, 7 of them
// opportunity playbooks, none of them saying so.
//
// Pure module, no React, so scripts/test-playbook-staleness.mjs can exercise it.

// Which opportunity sections are built FROM the Personal Brand, decided by
// which calls actually receive it rather than by intuition: buildUserProfileBlock
// puts the brand in the prompt, and only these four call sites pass one.
//
// The rest of the opportunity playbook — Company Read, Salary Read, Offer &
// Negotiation, the negotiation checklist, the Panel Interviewer Read — is about
// the company, the money and the interviewers. A changed Personal Brand does not
// make any of them wrong, and flagging them would train people to ignore the
// flag on the four that matter.
export const OP_BRAND_DEPENDENT_SECTIONS = ['p5', 'p_res', 'p11', 'p_cover']

// Sections that read the Bridge Story as well, so a refresh has to follow it.
export const OP_SECTION_UPSTREAMS = {
  p5: ['p3'],
  p_res: ['p3'],
  p11: ['p3', 'p6'],
  p_cover: ['p3'],
}

const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim()

// Compare the brand a playbook was built from against the brand that exists now.
//
// Text, not clocks. A rebuild that produced the same read should not light up
// every playbook a person owns, and a clock comparison cannot tell those apart:
// `p3_updated_at` advances on every regeneration, including one that changed
// nothing. Tonight's own no-change rebuild would have flagged 145 playbooks.
export function brandChanged(snapshotBrand, currentBrand) {
  const before = norm(snapshotBrand)
  const after = norm(currentBrand)
  // No snapshot means an older record that predates upstream capture. Nothing
  // can be concluded, and guessing "stale" would cry wolf on every one of them.
  if (!before || !after) return false
  return before !== after
}

const toMs = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v) {
    const t = Date.parse(v)
    if (Number.isFinite(t)) return t
  }
  return null
}

// The opportunity sections in this playbook that no longer reflect the current
// Personal Brand.
//
//   rec      a saved playbook record (source 'door2'), with .upstream and .sections
//   outputs  the live outputs blob, for the current p3 and its _updated_at stamp
//
// A section is stale when the brand text has moved AND the section was built
// before it moved. A section rebuilt after the change already read the current
// brand — opportunity sections build from live `outputs`, not from the record's
// snapshot — so it is fine, and saying otherwise would send someone to
// regenerate work that is already correct.
export function stalePlaybookSections(rec, outputs) {
  if (!rec || !outputs) return []
  const snapshot = rec.upstream && rec.upstream.p3
  if (!brandChanged(snapshot, outputs.p3)) return []
  const changedAt = toMs(outputs.p3_updated_at)
  const sections = rec.sections || {}
  return OP_BRAND_DEPENDENT_SECTIONS.filter((key) => {
    const entry = sections[key]
    const content = entry && typeof entry === 'object' ? entry.content : entry
    if (!norm(content)) return false            // never built; nothing to be stale
    const builtAt = toMs(entry && entry.builtAt)
    // Built before the brand moved, or built at an unknown time — which can only
    // mean before, since the record predates the stamping either way.
    if (changedAt === null || builtAt === null) return true
    return builtAt < changedAt
  })
}

// Whether this playbook has anything worth telling its owner about.
export function playbookIsStale(rec, outputs) {
  return stalePlaybookSections(rec, outputs).length > 0
}
