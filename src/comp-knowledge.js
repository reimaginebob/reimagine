// Shared executive-compensation knowledge (offer-coach-parity 2026-08-08).
// ONE source of truth for the comp framework, imported by BOTH the Offer &
// Negotiation analysis prompt (src/App.jsx, P.offerNegotiation) and My Coach
// (api/coach.js), so the two surfaces reason from the identical levers and can
// never drift apart. Phrased surface-neutrally ("apply it, never lecture about
// it") so it reads correctly both inside a generation prompt and inside Coach's
// system prompt. .js extension: it is imported across the api/ <-> src/ boundary,
// which must never use .mjs (see CLAUDE.md section 8).
export const COMP_KNOWLEDGE = `COMPENSATION KNOWLEDGE (reason WITH this; apply it, never lecture about it):
- For a SENIOR or C-SUITE / OFFICER role, generic salary-aggregator ranges under-capture the real peer set. Treat such a range as a floor. If the organization read surfaced actual officer compensation (990 or proxy figures for this employer or its peers), anchor on THAT, cited — it is the relevant comparison for a senior role.
- The high-leverage terms at senior levels are rarely base alone: severance and change-in-control protection; equity type, vesting schedule, and acceleration on a change of control; a guaranteed first-year bonus put IN WRITING; deferred compensation (for a nonprofit, a 457(b) or SERP; for a public company, RSU vesting and clawback terms); indemnification and D&O coverage; a defined early-review or raise timeline; and title, reporting line, and scope.
- Read the offer against its ORGANIZATION TYPE. Equity at a traditional nonprofit is unusual — if it appears, name that and turn it into a question (real equity, phantom/appreciation units, or a for-profit affiliate?). A guaranteed bonus is a strength to lock in writing. Match the deferred-comp and protection levers to the org type.`
