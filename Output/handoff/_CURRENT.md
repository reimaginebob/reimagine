# CURRENT — shared state

**Read this before starting anything. Update it when something changes.**

Both Cowork and Code work from this file. Briefs go stale the moment they are written; this one is meant to be edited in place. If you make a decision, close a question, or get blocked, edit the relevant line and stamp the date. Do not add a new section to record that an old section is wrong — fix the old section.

Last updated: **2026-08-23** (Code — segment cap found, send architecture reopened; #495/#496 from the parallel session folded in)

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
| **Sender identity: "Bob Goodwin" <bob@updates.career.club>, Reply-To `bob@career.club`.** Display name carries the recognition; the address only has to be deliverable. Reply-To is required — `updates.career.club` has receiving disabled, so replies would otherwise bounce. | 22 Aug | Bob |
| **Registration excludes the "Try Reimagine" email.** Simpler than a dedupe pass: if someone has a Reimagine account they are by definition not a candidate for the try-it campaign. | 22 Aug | Bob |
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

**Survey buttons in the drop-out email — proposed, awaiting Bob.** Real radio buttons do not survive email clients; each answer is a styled link instead. Two options: distinct URLs counted by Resend click tracking (no build, aggregate counts only), or a small Reimagine endpoint that records the answer per person into `feedback_event` and joins to their stage. Code recommends the second. The link must not require sign-in — a magic link before answering would collapse the response rate — so each recipient gets a token that can do one thing only: record a survey answer.

The option list is the load-bearing part and must include the uncomfortable answer, or the exercise only confirms what we already believe. Proposed: bad timing / asked more than I had time for / wasn't sure what to do next / didn't think it would help me / something didn't work / something else.

**Superseded — sender identity, now decided above.** Kept only for the reasoning: `bob@career.club` is not available because Resend can only send from a domain verified in Resend, and verifying the apex would entangle campaign reputation with Google Workspace.

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

## OPEN FORK — how the tailored campaign gets sent

Found 2026-08-22 while building the stage-to-Resend sync, and it invalidates the original architecture.

**The Resend plan allows 3 segments; 2 exist.** Creating a third was rejected by the API. **Segments are also static** — membership is assigned per contact, with no filter rules on properties. So "everyone at stage X" cannot be a segment, and broadcasts target segments. Stage-based targeting cannot be expressed the way the brief assumed.

Two ways out, Bob to choose:

- **(a) Broadcasts, one segment rewritten before each send.** Keeps the Resend composer. Fiddly, and a send during a rewrite reaches the wrong people.
- **(b) The app sends the tailored emails itself** from its own data. No segment cap, targeting from data we already trust, campaign tagging is trivial because we set it, and the `survey_token` merge-field requirement disappears entirely — the app builds the link. Individual sends still carry the Reimagine topic, so unsubscribes work identically. **Cost: no Resend composer for that campaign** — copy lives in a template. That is a real workflow loss for whoever writes it.

Code recommends a split: the Corner "try Reimagine" email is one message to one audience with no per-person variation, so broadcast it. The stage-tailored emails need per-person data, so the app sends those.

**Until this is settled, the stage-to-Resend sync is not being built** — under (b) most of it does not exist.

---

## Shipped by the other Code session, 2026-08-22/23

- **PR #496** (`2635d3c`) — Resend webhook receiver plus a Lifecycle email panel on the Growth tab: campaign rollup (delivered, opened, clicked, bounced, complaints) and a per-person trace of the first milestone crossed within seven days of a click. Counts are distinct people, not events. **Needs `RESEND_WEBHOOK_SECRET` in Vercel plus a redeploy before it does anything**; until then the webhook 500s and Resend retries harmlessly.
- **PR #495** (`c1fc767`) — search-intake answers made readable.
- **`CLAUDE.md` headcount corrected** from "~20 users (as of May 2026)" to 145 accounts / 71 active in 30 days. That stale figure had been steering judgment across sessions.

**A question the new number raises, worth Cowork answering with the analyst token:** 71 active in 30 days against 58 activated. If a meaningful number of people are active but not "activated" by our definition, either the definition still misses a real usage pattern, or people are getting value somewhere the funnel does not look. Worth knowing before copy assumes those people are stuck.

---

## Survey buttons — what Cowork needs to build the email

Shipped 22 Aug (PRs #492, #493). Each answer is a link; clicking records it and shows a thank-you page. No sign-in.

**Link format**

```
https://reimagine.career.club/api/survey/respond?t={{survey_token}}&q=dropout&a=<code>
```

`{{survey_token}}` is a Resend merge field. **This is a requirement on the stage sync**: it must push `survey_token` onto each contact as a property, alongside `reimagine_stage`. Without it the merge field renders empty and every link is dead.

**Option codes** — the label text is fixed in `src/survey-questions.js` and the email must match it exactly, or the recorded answer will not mean what the reader thought they clicked.

| `a=` | Label |
|---|---|
| `timing` | Life got busy — bad timing |
| `forgot` | I forgot — I'll be back |
| `effort` | It asked for more than I had time to give |
| `unclear` | I wasn't sure what to do next |
| `not_for_me` | I didn't think it would help me |
| `broken` | Something didn't work |
| `other` | Something else |

**Two behaviours the copy should account for.** `forgot` gets a way back into the product rather than a dead end — it is the only answer that states an intention, and that intention peaks the second after the click. `other` points the person at replying to the email, so the email must be replyable (Reply-To is `bob@career.club`).

**Read the results with this caution:** `timing` and `forgot` are the socially frictionless answers, the ones a person can give without implying any criticism. Expect them over-represented; treat a high count on either as a ceiling rather than a finding.

Answers land in `feedback_event` as source `survey-dropout` and appear on the Feedback tab.

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
