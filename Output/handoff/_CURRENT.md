# CURRENT — shared state

**Read this before starting anything. Update it when something changes.**

Both Cowork and Code work from this file. Briefs go stale the moment they are written; this one is meant to be edited in place. If you make a decision, close a question, or get blocked, edit the relevant line and stamp the date. Do not add a new section to record that an old section is wrong — fix the old section.

Last updated: **2026-08-22, evening** (Code — four campaign decisions closed; sender identity is the last one open)

---

## Decisions made — closed, do not reopen

| Decision | Date | Who |
|---|---|---|
| **No hold-out group.** Full population gets emailed; straightforward movement is the finding. Consequence: the campaign can claim "N crossed in the send week", not "the email caused it" — which makes the pre-campaign baseline the only comparison available. | 22 Aug | Bob + Cowork |
| **Corner and Reimagine lists stay separate.** Bob's long-standing intent, now enforceable. Reimagine users synced into Resend must never land in a segment that receives Corner. | 22 Aug | Bob |
| **Reimagine emails may go to Corner registrants.** They gave their address to Career Club and Reimagine is a Career Club product. Opting out of Reimagine must not remove them from Corner. | 22 Aug | Bob |
| **Sync creates missing contacts.** A Reimagine user with no Resend contact gets one created, into a dedicated Reimagine segment. | 22 Aug | Bob |
| **No opt-in language needed in the legal docs.** The Privacy Agreement already covers "product updates" and commits to an unsubscribe link. Changing the docs would trigger re-acceptance for every user, for no gain. | 22 Aug | Bob + Code |
| **Campaign domain split from the login domain.** `send.career.club` = transactional, tracking permanently off. `updates.career.club` = campaigns, tracking on. | 22 Aug | Bob + Code |
| **No custom tracking subdomain.** Does not help provider portability and slightly hurts it. Adding later is harmless; removing later kills every link in already-sent mail. | 22 Aug | Bob + Code |
| **Two campaigns, not one.** (a) Existing Reimagine users, copy tailored to where each person dropped out. (b) Corner registrants who are not using Reimagine, encouraging them to try it. | 22 Aug | Bob |
| **Frequency ceiling: two emails a week, and usually fewer.** Corner registrants already get the Monday recap; the "try Reimagine" note is on top of that and is one-off, not recurring. Existing Reimagine users get at most one a week. **Nobody receives both campaigns** — dedupe on email before either send. | 22 Aug | Bob |
| **Career Club Corner topic: not created.** Corner is already protected from Reimagine unsubscribes by the Reimagine topic. Creating one carries an irreversible default-subscription choice for no current gain. | 22 Aug | Bob |
| **Orientation is not assumed to be broken.** Bob's read is that people get busy or distracted rather than blocked. The drop-off is not treated as a product defect until there is direct feedback saying so — and the first email to the drop-out group is the way to get it. | 22 Aug | Bob |
| **Activation = a first playbook through EITHER door**, changed from "a Focus Playbook" on 21 Aug. Recorded on the dashboard. Do not move it again. | 21 Aug | Code |

---

## Blocked — and on whom

| What | Waiting on | Notes |
|---|---|---|
| Link tracking data | Eric (DNS) | **Cause found.** Tracking in Resend is not a toggle — it requires a tracking subdomain that links redirect through. That is why three API calls to set the flags reported success and changed nothing: there was no mechanism for them to attach to. Creating `links.updates.career.club` switched both flags on. One CNAME left: `links.updates` → `links1.resend-dns.com`, sent to Eric 22 Aug. Until it resolves, campaigns send fine but produce no open or click data. |
| ~~Corner email-list endpoint~~ | Done | `/api/admin/user-stages` shipped 22 Aug (PR #490). Returns email, stage, active, last activity, suspended for every account. |
| Cowork data access | Done | `ANALYST_TOKEN` live on the `reimagine2` project, Production, from 22 Aug 20:38 UTC. Read-only, opens `user-stages`, `growth`, `dormant` only. **Note the project name**: `reimagine2` serves `reimagine.career.club`; a sibling project called `reimagine` exists and does not. Code sent Bob to the wrong one first. |
| First campaign send | The baseline | Movement log only started recording 22 Aug. Sending before a few ordinary weeks accumulate leaves no comparison at all. Target early September. |
| First campaign send | **Domain warming** | `updates.career.club` has zero sending history. A first send to ~969 mostly-unengaged addresses is the classic pattern for getting throttled or filtered, and it would burn the domain's reputation on day one. Ramp instead: start with the most engaged few dozen, watch bounces and complaints, grow over one to two weeks. This is a real constraint on the send plan, not a nicety. |

---

## Who owns what next

**Cowork**
- Campaign structure and the stage-to-message mapping
- The copy itself — the long pole, and the thing most likely to go wrong given this audience
- Reading the `inputs_only` accounts to check for a product snag before writing to that group
- Answer the Corner endpoint question above

**Code**
- Stage-to-Resend sync (contact property + dedicated segment). Not started. Dry-run first.
- Corner endpoint, once the question is defined
- Finish `updates.career.club` — verify, then enable open + click tracking and confirm they read back true

**Bob**
- Confirm the sender identity (Code's recommendation is in the open questions below)
- Confirm the Anthropic API key rotation landed on the `reimagine2` project, not the sibling `reimagine`

---

## Open questions

**How does Cowork get data access?** The `ADMIN_TOKEN` is a master key — it unlocks every admin endpoint including all user emails, revenue figures, and **write** operations that can suspend an account or grant beta access. It should not be handed around for a read-only list match. Two better routes: Bob calls `/api/admin/user-stages` himself and passes the JSON on, or Code adds a separate read-only analyst token if this is going to recur. Bob's call.

**Sender identity — Code's recommendation, awaiting Bob.** Display name **Bob Goodwin**, address `bob@updates.career.club`, **Reply-To set to Bob's real inbox**.

Why not `bob@career.club`: Resend can only send from a domain verified in Resend, and the apex is not one. Verifying it would entangle campaign reputation with Google Workspace, which is the opposite of what the domain split was for. A `bob+tag@` variant has the same problem and reads as suspicious to some filters.

Why the display name carries the recognition: recipients see "Bob Goodwin", not the address. The address only has to be deliverable.

Why Reply-To matters: `updates.career.club` has receiving disabled, so replies would bounce without it — and replies are the direct feedback the drop-off question needs.

---

## Infrastructure state — facts, not inference

Read directly from the Resend account 2026-08-22. None of this lives in the repo, so this table is the only record.

| | |
|---|---|
| `send.career.club` | Verified. Transactional only — magic links, account hold, legal, admin alerts. **Open and click tracking off, and they stay off.** Magic links are the login path; there is no password. |
| `updates.career.club` | Created 22 Aug, id `4f6e93d8-6f3b-461c-b809-3a0aaecfeff6`. **Verified and sending.** Open + click tracking both on. Status reads `partially_verified` only because the tracking CNAME is still pending — sending is unaffected. |
| `links.updates.career.club` | The tracking subdomain. Required for any click or open data; not optional branding, which is what Code first called it. CNAME pending with Eric. Once live, links in campaigns redirect through it — which means that record must keep pointing at Resend for as long as links in already-sent mail matter. |
| Topics | **`Reimagine updates`** (id `2a78469a-...`, default opt-in) — created 22 Aug so a Reimagine unsubscribe cannot touch Corner. No Corner topic yet. |
| Segments | `General` (empty), `Corner Registrants` — holds the **full** Corner list, not a partial batch |
| Contacts | **971** — 969 Corner registrants plus 2 unrelated. Corrected 22 Aug by Cowork; Code's earlier "100+" was a paginated read that stopped at the first page and should not have been written as a total. |
| Population gap | 971 contacts against ~144 Reimagine accounts — the contact list is roughly **seven times** the user base. Most Corner registrants have never opened Reimagine. Any sync joins on email; see the warming risk below. |
| Contact properties | `corner_2025` (string, fallback `no`) |
| DMARC | `career.club` is `p=none`, no subdomain override — the subdomain inherits, nothing extra needed |

---

## Measurement — what exists and what it can honestly claim

**Shipped 22 Aug, PR #489.** `user_stage_events` records the first time each account reached each stage. Milestones, not snapshots — nobody un-generates a Personal Brand. Daily cron at 06:00 UTC. Growth tab has a **Movement across stages** panel: crossings by week, aggregate only.

**It already has history**, backfilled with real dates from `savedPlaybooks.createdAt`, `generation_events.created_at`, and `users.created_at`.

**Before quoting any number:** milestones reached before anything recorded the date are stored with `entered_at NULL` and excluded from the weekly chart, because dating them to the day the log shipped would have invented a spike. The panel reports how many are in that bucket and from what date the record is complete.

**Ceiling on claims:** with no hold-out, movement in a send week can be compared only against the historical average of ordinary weeks. Do not write "the email drove X" — the data cannot support it.

---

## Where things live

| What | Where |
|---|---|
| This file | `Output/handoff/_CURRENT.md` |
| Lifecycle email brief | `Output/handoff/2026-08-22_lifecycle-email-brief.md` |
| Economics handoff | `Output/handoff/2026-08-22_economics-what-shipped.md` |
| Stage classification | `api/admin/dormant.js` |
| Funnel, cohorts, crossover, movement | `api/admin/growth.js`, `src/GrowthDashboard.jsx` |
| Stage movement log | `migrations/2026-08-27_user-stage-events.sql`, `api/admin/stage-snapshot.js` |
| Email sending | `api/_lib/email.js` |
| Voice rules | `CLAUDE.md` §3, `src/voice-patterns.mjs`, `scripts/check-voice.mjs` |

---

## House rules for this file

- **Fix stale lines, do not append corrections.** A file that records its own history of being wrong is as bad as a stale brief.
- **Decisions move to the closed table and stay there.** Reopening one costs more than making it did.
- **Mark inference as inference.** If something here is a guess, say so in the line. Twice in one day this workstream lost time to a confident statement that turned out to be reconstructed rather than checked.
- **Stamp the date and your name** on anything you change.
