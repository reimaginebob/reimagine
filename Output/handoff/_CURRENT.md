# CURRENT — shared state

**Read this before starting anything. Update it when something changes.**

Both Cowork and Code work from this file. Briefs go stale the moment they are written; this one is meant to be edited in place. If you make a decision, close a question, or get blocked, edit the relevant line and stamp the date. Do not add a new section to record that an old section is wrong — fix the old section.

Last updated: **2026-08-22, afternoon** (Code)

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
| **Activation = a first playbook through EITHER door**, changed from "a Focus Playbook" on 21 Aug. Recorded on the dashboard. Do not move it again. | 21 Aug | Code |

---

## Blocked — and on whom

| What | Waiting on | Notes |
|---|---|---|
| `updates.career.club` verification | Amazon SES | DNS is correct and propagated globally (checked against Google, Cloudflare, Quad9). SPF + MX verified; DKIM pending on Amazon's cycle. Nothing to do. |
| Corner email-list endpoint | **Cowork** | Code needs one sentence: what question does it answer, and what fields come back. Will not be built on a guess. |
| First campaign send | The baseline | Movement log only started recording 22 Aug. Sending before a few ordinary weeks accumulate leaves no comparison at all. Target early September. |

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
- Whether this is reactivating the existing ~144 or standing infrastructure for everyone from here
- Who the emails come from — Bob personally, or Reimagine
- Frequency ceiling per person
- Whether the Career Club Corner topic should be created (see the open question below — the choice is irreversible)

---

## Open questions

**Should a "Career Club Corner" topic be created in Resend?** Not needed to protect Corner from Reimagine unsubscribes — that is already handled by the Reimagine topic. It would be for giving Corner its own managed preference.

The catch: a topic's default subscription **cannot be changed after creation**. Set it wrong and either Reimagine users get silently added to the newsletter, or existing Corner subscribers stop receiving it. Worth deciding deliberately rather than in passing. Bob's call.

**Would fixing the Personal Brand drop-off outrank the campaign?** Fewer than half of signups reach that gate, and it sits upstream of everything the product recommends. Email can walk people back to a step that is losing them; it cannot make the step work better.

---

## Infrastructure state — facts, not inference

Read directly from the Resend account 2026-08-22. None of this lives in the repo, so this table is the only record.

| | |
|---|---|
| `send.career.club` | Verified. Transactional only — magic links, account hold, legal, admin alerts. **Open and click tracking off, and they stay off.** Magic links are the login path; there is no password. |
| `updates.career.club` | Created 22 Aug, id `4f6e93d8-6f3b-461c-b809-3a0aaecfeff6`. SPF + MX verified, DKIM pending. Tracking to be enabled after verification — the flags do not persist while unverified. |
| Topics | **`Reimagine updates`** (id `2a78469a-...`, default opt-in) — created 22 Aug so a Reimagine unsubscribe cannot touch Corner. No Corner topic yet. |
| Segments | `General` (empty), `Corner Registrants` (populated) |
| Contacts | 100+, bulk-imported 14 Aug. **Larger than the ~144 Reimagine accounts** — the two populations overlap without matching. Any sync joins on email. |
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
