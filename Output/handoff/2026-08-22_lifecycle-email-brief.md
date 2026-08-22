# Lifecycle email by stage — briefing for a new Cowork sibling

**Date:** 2026-08-22
**Type:** Opening brief — revised 2026-08-22 after the measurement layer shipped and the domain split was decided.
**Status (2026-08-22, afternoon):** the stage-movement log is live (section 3). `updates.career.club` DNS is in and correct — SPF verified, DKIM propagated globally and awaiting Amazon's verification cycle. Hold-out decision closed: none. No campaign has been designed or sent.
**From:** Claude Code, having just built the measurement layer this would run on.

**On sourcing:** claims about the codebase were checked against the repo and are cited by file path. Claims about how Bob runs the audience today came from Bob and are marked as such. Where neither applies, it is a question in section 7, not a statement. An earlier draft of this brief inferred operational detail that turned out to be wrong; if something here reads like an assumption about process rather than a verified fact, treat it as one and ask.

---

## What Bob wants

A drip campaign that emails users according to the stage they have reached, prompts the next move, and is **tracked over time** so he can refresh periodically and see whether people actually moved.

That last clause is the whole assignment. Anyone can send stage-based email. Knowing whether it worked is the hard part, and the current data cannot answer it yet. Section 3 is the thing to read first.

---

## 1. The stages already exist and are already computed

You are not starting from a blank page on segmentation. `api/admin/dormant.js` classifies every account into three groups today, and the Growth tab (`api/admin/growth.js`) computes the fuller picture.

The product's real shape is a **trunk with two doors**:

```
signed up → put material in → generated a Personal Brand   ← the gate
                                        ↓
                        Put It to Work: two doors
                        ├── Add an Opportunity   (recommended first — a live job)
                        └── Career Paths         (exploration → Focus Playbook)
```

Personal Brand is a hard gate, not a soft step: the entire sidebar renders behind `done.includes('p3')`, so until it exists a user cannot reach either door. That makes the natural stage taxonomy:

| Stage | Meaning | Current size |
|---|---|---|
| **Signed up, nothing entered** | never typed a thing | see dormant endpoint |
| **Gave material, no output** | entered orientation content, never generated | see dormant endpoint |
| **Personal Brand, no door** | reached the choice, took neither | `funnel.branch.neither` |
| **Opportunity-first** | took the recommended door | `funnel.branch.opportunity` |
| **Career Paths / Focus** | took the exploration door | `funnel.branch.career_paths` |
| **Active** | did something recently | should be suppressed from all sends |

Roughly 144 signups, ~58 activated, ~4 have completed all seven Focus sections. Fewer than half of signups ever reach the Personal Brand gate — the largest single drop-off in the product, and it sits *upstream* of everything the product recommends.

**Read `api/admin/dormant.js` before designing anything.** Its three-way split was built after looking at real behaviour, and the middle group is the interesting one.

---

## 2. What already exists for sending

- **Resend is wired up**: `api/_lib/email.js`, with four senders — magic link, account hold, admin alert, legal update.
- **Scheduling is solved**: Vercel cron, four jobs already running (`vercel.json`), including a daily digest at `api/survey/daily-digest.js`. A weekly lifecycle job is the same pattern.
- **Templates**: hand-rolled HTML in `email.js`. No template system, no design system for email.
- One SDK trap, documented in `CLAUDE.md` §8: Resend returns `{data, error}` rather than throwing. Unpack and throw, or sends fail silently behind a fake 200.

### What the app sends, and what Bob sends

These are two separate channels today, and confusing them will produce bad advice.

**The app sends transactional mail only**, through Resend, from the Reimagine domain: magic links (the login path — there is no password), account-hold notices, legal-update notices, and admin alerts. No campaign has ever gone out from the application.

**Mass communication has been going out from Gmail**, with an unsubscribe that removes people automatically and immediately. **Bob's intent is to move this to Resend**, synced to the subscribe list with automatic suppression - see section 4, which records what is actually in that account today.

So the situation is not "no campaign machinery exists". It is that the machinery exists in Resend and the application does not yet feed it. That is a sync problem, not a build-a-campaign-engine problem.

---

## 3. The measurement layer is built — use it, do not rebuild it

This was the one thing that had to exist before any campaign, and it shipped on 2026-08-22 (PR #489). Read this section before designing anything, because it determines what claims the campaign will be able to make.

**The problem it solved.** `api/admin/dormant.js` computes stage membership live, from current state. It has no memory — ask it today and it tells you who is stuck today. If someone moves from "gave material, no output" to activated the week after an email, live state cannot distinguish the email causing it, them moving anyway, or them moving before the email even landed.

**What exists now.** `user_stage_events` records the first time each account reached each stage. Milestones, not a membership snapshot: nobody un-generates a Personal Brand, so the journey is forward-only and one row per (user, stage) is the whole model. `UNIQUE (user_id, stage)` means every writer is idempotent. A daily cron (`api/admin/stage-snapshot.js`, 06:00 UTC) appends newly reached milestones.

**It already has history.** The migration recovered real dates from data that was already timestamped — `savedPlaybooks` carry a per-playbook `createdAt`, `generation_events` carry `created_at` and a `kind` tag, `users` carry `created_at`. So signup, Personal Brand, and both doors have genuine history rather than starting from zero.

**Read the coverage note before quoting any number.** Milestones reached before anything recorded the date are stored with `entered_at NULL` and excluded from the weekly chart. Dating them to the day the log shipped would have invented a spike that never happened. The Movement panel reports how many are in that bucket and from what date the record is complete.

**On the dashboard:** the Growth tab now has a **Movement across stages** panel — how many accounts crossed each threshold, by week, heat-shaded. Aggregate only; no individual account appears in it. That is the baseline. Read a normal week first, then a week with a send has something to beat.

**Precedent worth knowing.** This repo made the opposite mistake once. `pursuit_status` recorded an opportunity's current stage and updated in place, so when one closed, the fact it had reached "interviewing" was gone. It was fixed with an append-only log (`pursuit_status_events`, PR #485), but the backfill could only capture where things stood that day. The earlier path is permanently unrecoverable. That is why the stage log was built before the campaign rather than after the first send.

### Decided: no hold-out group

**Settled by Bob and Cowork on 2026-08-22. Closed — do not reopen it.** The full population gets emailed; straightforward movement is the finding.

Recorded here so the consequence is understood rather than discovered later: without a concurrent control, movement in a send week cannot be separated from movement that would have happened anyway. What the campaign can claim is "N people crossed this threshold in the week we sent", not "the email caused N people to cross".

**That is exactly why the baseline period matters more, not less.** With no hold-out, the only comparison available is temporal — the send week against the historical average of ordinary weeks. That is a weaker design than a concurrent control, but it is a real one, and it is entirely dependent on having enough pre-campaign weeks in the movement log to establish what an ordinary week looks like. Protect that period. Sending before it accumulates leaves the campaign with no comparison of any kind.

---

## 4. Constraints and settled questions

### The mechanism Bob wants: Resend, synced to the subscribe list

This is decided, not open. Resend already holds the audience, and its unsubscribe removes a contact automatically and immediately; suppression is enforced by Resend at send time. There is nothing to build for consent, unsubscribe, or suppression.

**Account state, read directly and current as of 2026-08-22** (not inferred):

| | |
|---|---|
| Transactional domain | `send.career.club` - verified, sending enabled. Open and click tracking **off, and they stay off** |
| Campaign domain | `updates.career.club` - created 2026-08-22, **awaiting DNS**. Open and click tracking to be enabled once verified |
| Segments | `General` (empty), `Corner Registrants` (populated) |
| Contacts | 100+ (paginated), the bulk arriving 2026-08-14, a few since |
| Contact properties | one: `corner_2025` (string, fallback `no`) |
| Topics | none |
| Broadcasts | none sent yet |

Four things follow, and they shape the design more than anything else in this brief.

**1. The architecture is a sync, not a campaign engine.** `corner_2025` already proves the pattern: a contact property drives segmentation. So the app's whole job is to compute each user's stage and write it onto their Resend contact as a property - say `reimagine_stage` - on a schedule. Resend then does segments-by-property, broadcasts, unsubscribe, and suppression. Do not rebuild any of that in the app.

**2. The Resend list is not the same population as the app's users.** It is larger, and much of it arrived in one import. Reimagine has ~144 accounts; the contact list exceeds that. The sync must join on email address, and contacts who are not users have no stage - they need an explicit value (`not_a_user`, or similar) rather than an empty property, so a stage segment never silently includes people the product has never met.

**3. The two mail streams are being separated, and that is decided.** `send.career.club` carries magic links, which are the login path — there is no password in Reimagine. Broadcast volume to unengaged addresses must never share reputation with that, so lifecycle mail gets its own domain: `updates.career.club`, created 2026-08-22 and waiting on three DNS records (DKIM TXT on `resend._domainkey.updates`, MX and SPF TXT on `send.updates`) that Bob has sent to his IT admin.

Bob's instruction is explicit: **tracking is for campaigns only, never for magic links.** Open tracking was briefly enabled on `send.career.club` and reverted the same day. Do not turn it back on there.

**4. Open and click tracking will exist, on the campaign domain only.** Both were requested and both will be enabled on `updates.career.club` once it verifies. Note for whoever builds the reporting: the tracking flags do not persist while a domain is unverified — the API accepts them and they read back false — so they must be set again after verification and confirmed.

**A custom tracking subdomain was considered and deliberately skipped.** It would put click-tracking links on career.club rather than a Resend URL, which reads as more trustworthy and helps marginally with filters. It was rejected for now because it does not improve provider portability and slightly harms it: links in already-sent email would point at Bob's own domain, so that DNS record would have to keep pointing at the old provider forever or every historical link dies. Adding it later is harmless; removing it later is destructive. Revisit only for the branding gain, never as a portability argument.

**Topics are unused and worth considering.** Resend topics are the native way to give people per-stream unsubscribe ("stop the nudges, keep the product notices") rather than all-or-nothing. Nothing is set up today; if per-stream opt-out is wanted, this is where it lives.

### The one consent question left

Users accepted the Privacy Agreement and Terms at signup (versioned, on the `users` row), which covers transactional mail. Campaign consent and suppression are handled by Resend, above.

What remains is judgment, not mechanism: is it right to email someone who signed up months ago, never returned, and has heard nothing since? Legally it is fine. Whether it is the right thing is Bob's call.

### Deliverability

Covered in point 3 above: one verified domain carries both magic links and broadcasts. Separate the lifecycle stream onto its own subdomain, warm it slowly, and watch bounces and complaints from the first send. The login path must never share reputation with campaign volume.

### Voice rules apply in full

`CLAUDE.md` §3 governs every user-facing surface, and email is one. Standard SaaS re-engagement copy would breach several rules at once — the logic-flip cadence ("you don't just need a resume, you need a strategy"), comparative standing ("most job seekers…"), coaching register ("let that land"), and the deficit framing that "you haven't finished your profile" carries by default.

There is a build-time voice gate (`scripts/check-voice.mjs`) but it scans shipped app output, not email templates. **Recommend extending it to cover email copy**, or the rules apply in principle and nowhere in practice.

### Who these people are

This matters more than any of the mechanics.

The audience is people in career transition. Many were recently laid off. "You haven't finished setting up your account" lands very differently for someone whose confidence took a hit last month than for a SaaS user who forgot to configure a dashboard.

Reimagine's stated north star includes: *the user is not a problem to solve*, and *job search is heavy enough — Reimagine should be the lightest moment of the user's week*. A drip campaign is structurally in tension with that. Nudges are, by design, a product asking for something.

That tension is the central design problem, and it should be solved deliberately rather than discovered in a reply from an upset user. The framing that survives it is probably **offering something** ("here's what your resume already gave us") rather than **asking for something** ("come back and finish").

### State at send time, not queue time

Somebody who receives a Tuesday email may have moved on Monday. Every send must re-check the recipient's stage at the moment of sending and drop them if they no longer qualify. Queue-then-send-later without a re-check will produce the worst possible email: one telling someone to do a thing they have already done.

---

## 5. Design opinions, offered to be argued with

**Trigger on state, not on days since signup.** "You put a resume in and haven't seen what it says about you yet" is a true observation about that person. "It has been seven days" is an observation about us. The first earns a reply; the second reads as a mail-merge.

**One email per stage before any sequence.** Learn which stage responds at all before building a ladder. A five-step sequence built on an unproven first message industrialises a mistake.

**Exit the moment the stage is cleared.** Crossing the stage the email was about should remove someone from that stream immediately.

**Cap frequency globally and suppress the active.** Never email someone who used the product yesterday, regardless of which stream they qualify for.

**Consider not automating the highest-value group.** At 144 users, a personal note from Bob will outperform any template by a wide margin, and the "gave us material, got nothing back" group is small enough to read by hand — check the dormant endpoint for its current size. Automating that away may destroy the thing that works. A reasonable split: automate the low-value, high-volume stages; keep the high-value ones human until volume forces the issue.

**Fix before you send, for one group specifically.** The "gave material, got nothing back" cohort hit *something* — a step that asked too much, a confusing screen, a generation that failed. Reading five or ten of those accounts by hand will probably reveal it. If it is a product problem, an email asking them to try again is asking them to walk back into the same wall.

**Keep the highest-value group human anyway.** Bob's intent is Resend, and that settles the mechanism. It does not follow that every stage should be automated on day one. Automate the low-value, high-volume stages; keep the small, high-value ones as a personal note until volume forces the issue.

**Consider My Coach as an alternative channel.** An in-app prompt is cheaper, less intrusive, carries no deliverability or consent risk, and reaches people who return without opening email. It only reaches people who come back — so it complements email rather than replacing it, but for some stages it may be the better first move.

---

## 6. How to know whether it worked

**Success is stage movement within N days, measured against the hold-out.** Not opens, not clicks.

Open and click data will exist once `updates.career.club` verifies, and both are worth having. Neither should be the success metric. Apple's Mail Privacy Protection pre-fetches images and inflates opens across a large share of consumer mail, so an open rate is a soft signal about subject lines rather than a measure of whether anything happened. Clicks are a real signal about copy. Movement is the only thing that answers Bob's question.

Worth tracking, in priority order:

1. Movement out of the target stage, sent vs held out
2. Time-in-stage before and after the campaign starts
3. Return visits within 7 days of a send
4. Unsubscribes and complaints per stage — **the early warning that the tone is wrong**
5. Clicks, as a diagnostic for copy, and opens as a soft read on subject lines

And one qualitative signal worth more than all of them at this size: what people say when they reply. Reimagine already has a feedback pipeline (`feedback_event`, surfaced on the dashboard's Feedback tab) that could ingest replies.

---

## 7. Questions for Bob

1. **Reactivating the existing 144, or a standing system for everyone who signs up from here?** These are different designs. The first is a one-off campaign with a hold-out; the second is infrastructure.
2. **Is it acceptable to email people who signed up months ago and have not been contacted since?** Legal is probably fine; the judgment call is yours.
3. **Who does it come from — you personally, or Reimagine?** At this scale a note from you will outperform a template, and there may be a version of this where the system drafts and you send.
4. **What should happen to contacts who are not Reimagine users?** The Resend list is larger than the user base. They need an explicit non-user stage so they are never swept into a stage segment.
5. **What is the maximum acceptable frequency per person?** Once a week, once a fortnight, once a month? This bounds the whole design.
6. **Global unsubscribe, or per-stream?** Resend topics are the native mechanism; none exist yet. Per-stream is friendlier and more work.
7. **Would you rather fix the Personal Brand drop-off first?** Fewer than half of signups reach the gate. Email can bring people back to a step that is losing them; it cannot make that step work better. There is a real argument that the product fix outranks the campaign.

---

## 8. Where things are

| What | Where |
|---|---|
| Stage classification (three dormant groups) | `api/admin/dormant.js` |
| Funnel, cohorts, crossover | `api/admin/growth.js`, `src/GrowthDashboard.jsx` |
| Email sending | `api/_lib/email.js` (Resend) |
| Cron pattern | `vercel.json` + `api/survey/daily-digest.js` |
| Stage movement log | `migrations/2026-08-27_user-stage-events.sql`, `api/admin/stage-snapshot.js` |
| Movement panel | `src/GrowthDashboard.jsx` ("Movement across stages") |
| Append-only log precedent | `migrations/2026-08-26_pursuit-stage-events.sql`, `api/pursuit-status.js` |
| Voice rules | `CLAUDE.md` §3, `src/voice-patterns.mjs`, `scripts/check-voice.mjs` |
| Feedback ingestion | `feedback_event`, `api/admin/feedback-dashboard.js` |
| Economics context | `Output/handoff/2026-08-22_economics-what-shipped.md` |

Migrations auto-apply on production deploy; shipping the file in the PR is the whole deployment step. Any PR touching `api/*` gets a preview smoke test before merge.

---

## The one-sentence version

The memory is built and already has history. With no hold-out group, the pre-campaign baseline is the only comparison the campaign will ever have — so the weeks before the first send are not waiting, they are the measurement.
