// Close-reason taxonomy (2026-09-07). Bob + Cowork's external research into
// real applicant-tracking-style disposition taxonomies, refined across
// several rounds: separated reasons a candidate could plausibly be told
// from ones only an employer would ever say (Bob's own coaching practice
// confirmed candidates report the full range, including the "employer-only"
// ones -- people are sometimes told "there's a hiring freeze" or "honestly,
// we always intended to promote internally" directly); kept near-duplicate
// pairs distinct where they describe genuinely different situations
// (hiring_freeze is company-wide and macro, role_paused_or_cancelled can be
// specific to this one role for other reasons; ghosted is disappearing
// mid-engagement, employer_non_responsive is never engaging at all); and
// renamed the one ambiguous code (a bare "declined, no reason given," which
// both Bob and Cowork independently flagged) so its direction reads from
// the name alone, matching every other code here -- not left for the
// separate `initiated_by` field to disambiguate.
//
// Deliberately does not try to be exhaustive or perfectly orthogonal to the
// existing pursuit_status.outcome field (accepted|declined|not_selected|
// withdrew|no_response). outcome answers WHAT happened; this answers WHY,
// in more useful detail, and some overlap in spirit between the two is
// fine since they answer different questions.
//
// Every category here is deliberately a bounded key, never free text --
// the ONLY thing ever meant to be looked at in aggregate, later, across
// every account. `detail` (the person's own words, captured alongside a
// code) is the opposite: always per-account, never touched by an aggregate
// query. That split is what makes a future cross-account analysis pass
// possible without redesigning anything -- the category has been correct
// from day one, so there is nothing to retrofit.
export const CLOSE_REASON_CODES = [
  'insufficient_tenure',
  'insufficient_domain_experience',
  'insufficient_technical_depth',
  'overqualified',
  'weak_interview_performance',
  'failed_assessment_or_test',
  'compensation_mismatch',
  'work_arrangement',
  'relocation_required',
  'start_date_or_notice_period_mismatch',
  'culture_or_team_fit',
  'background_check_failed',
  'reference_check_failed',
  'credential_or_certification_missing',
  'work_authorization_or_visa',
  'role_filled_internally',
  'internal_candidate_preferred',
  'role_paused_or_cancelled',
  'hiring_freeze',
  'lost_to_another_candidate',
  'pursuing_other_opportunities',
  'accepted_another_offer',
  'not_selected_no_reason_given',
  'withdrew_no_reason_given',
  'ghosted',
  'employer_non_responsive',
  'other',
]

// User-facing labels, for the one-tap offer's confirmation text.
export const CLOSE_REASON_LABEL = {
  insufficient_tenure: 'Not enough tenure or years of experience',
  insufficient_domain_experience: 'Not enough industry or domain experience',
  insufficient_technical_depth: 'Not enough technical depth',
  overqualified: 'Seen as overqualified',
  weak_interview_performance: 'Interview performance',
  failed_assessment_or_test: 'Failed an assessment or test',
  compensation_mismatch: 'Compensation mismatch',
  work_arrangement: 'Work arrangement (return-to-office, hybrid, travel, commute)',
  relocation_required: 'Relocation required',
  start_date_or_notice_period_mismatch: 'Start date or notice period mismatch',
  culture_or_team_fit: 'Culture or team fit',
  background_check_failed: 'Background check',
  reference_check_failed: 'Reference check',
  credential_or_certification_missing: 'Missing a credential or certification',
  work_authorization_or_visa: 'Work authorization or visa',
  role_filled_internally: 'Filled internally',
  internal_candidate_preferred: 'Internal candidate preferred from the start',
  role_paused_or_cancelled: 'Role paused or cancelled',
  hiring_freeze: 'Company-wide hiring freeze',
  lost_to_another_candidate: 'Lost to another candidate',
  pursuing_other_opportunities: 'Chose to pursue other opportunities',
  accepted_another_offer: 'Accepted another offer',
  not_selected_no_reason_given: 'Not selected, no reason given',
  withdrew_no_reason_given: 'Withdrew, no reason given',
  ghosted: 'Went silent after engaging',
  employer_non_responsive: 'Employer never responded at all',
  other: 'Other',
}

export const INITIATED_BY_VALUES = ['employer', 'candidate', 'external', 'mutual', 'unknown']
