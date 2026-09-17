// The screen name My Coach is told, per turn (2026-09-13). Coach used to get
// only the raw step id ("[The user is currently on step "p4".]") and, asked
// "where am I?", correctly refused to guess what "p4" meant -- same defect the
// 2026-09-09 SECTION IN VIEW fix closed for playbook sections, one level up.
// Every name here is the one the UI renders: NAV_LABELS / LANE_LABELS, plus the
// ecosystem category labels below and the Opportunity screen's own headings.
//
// Plain `.js` so api/coach.js can import it across the api/src boundary.
// ECOSYSTEM_CATEGORY_LABELS duplicates ECOSYSTEM_CATEGORIES in
// src/industry-ecosystem.mjs because api/ cannot import .mjs;
// scripts/test-coach-screen.mjs fails if the two drift.
import { NAV_LABELS, LANE_LABELS } from './nav-labels.js'

export const ECOSYSTEM_CATEGORY_LABELS = {
  primary: 'Primary players',
  customers: 'Customers & channels',
  suppliers: 'Suppliers',
  data: 'Data & measurement',
  consulting: 'Consulting & advisory',
  distribution: 'Distribution & brokers',
  adjacent: 'Adjacent industries',
}

// Returns a plain-English description of the screen, or '' when the step has
// no known name. Never returns the raw step id.
//
// p4 renders three different screens under one step id (the lane's role list,
// the Industry Insider industry map, a category opened from that map). op
// renders two: the empty "Add an Opportunity" form, and the Opportunity
// Playbook once an opportunity is open -- the sidebar calls both "Add an
// Opportunity", so the label alone would name the wrong screen for anyone
// already reading a playbook. hasRecord is Situation's open record, which is
// set exactly when a playbook is open on that screen.
export function describeScreen({ step, lane, ecosystemView, ecosystemCategory, hasRecord, independent }) {
  if (!step) return ''
  if (step === 'p4') {
    const laneLabel = LANE_LABELS[lane] || ''
    if (lane === 'insider' && ecosystemView) {
      const cat = ECOSYSTEM_CATEGORY_LABELS[ecosystemCategory]
      return cat
        ? `Career Paths > Industry Insider > ${cat}: the roles typically found in that part of the industry (the screen is headed "${cat}"; the sidebar calls this area Role Options)`
        : `Career Paths > Industry Insider: the industry map, seven categories to explore (the screen is headed "Your Industry Ecosystem"; the sidebar calls it Role Options)`
    }
    return laneLabel
      ? `Career Paths > ${laneLabel}: the role options for that direction (the screen is headed "${laneLabel}"; the sidebar calls it Role Options)`
      : `${NAV_LABELS.p4}, under Career Paths`
  }
  if (step === 'op') {
    if (independent) {
      return hasRecord
        ? `a client opportunity's playbook (the screen is headed "This Client Opportunity")`
        : `Add a Client Opportunity: where they add a client opportunity to build its playbook (the screen is headed "Add a Client Opportunity")`
    }
    return hasRecord
      ? `an Opportunity Playbook for a live opportunity they added (the screen is headed "Your Opportunity Playbook"; the sidebar calls this area ${NAV_LABELS.op})`
      : `${NAV_LABELS.op}: where they paste or upload a job description to build an Opportunity Playbook (the screen is headed "${NAV_LABELS.op}")`
  }
  return NAV_LABELS[step] ? `${NAV_LABELS[step]}` : ''
}
