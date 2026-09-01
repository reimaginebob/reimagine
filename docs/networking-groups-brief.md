# Groups for This Path — brief

## Context

Reimagine tells someone where to aim (Career Paths, the Focus Playbook), who places people into those roles (Recruiters for This Path), which companies to work (Go-to-Market), and who they already know at a specific company (the three doors inside an Opportunity Playbook). It never tells them where the people in their new direction actually gather.

That gap is already named in the canon. *Making Your Own Weather* Lesson 2 — "Community: Your Job Search Is a Team Sport" — closes with a section titled **How to Find Your Community**, whose entire method is: search "job search group" plus your city, run the same string on LinkedIn, ask people you meet whether they are in a group they have found helpful, and check whether your outplacement provider runs one. This section automates that lesson and extends it past job-search groups to the professional bodies that serve the direction the person has chosen.

Lesson 2 also supplies the constraint on placement: *"if you start networking aggressively before you have your message right, it can work against you. Going on air before the commercial is ready is expensive."* This section must sit downstream of the Personal Brand and the bridge story, never upstream.

## What this is, and what it is deliberately not

**It is** a shortlist of real organizations, each with a first-party link, a plain statement of how you take part, and a plain statement of what it costs.

**It is not an events calendar.** Nothing in this section asserts a date. Dates are the part that rots, and the evidence below shows search returns dead ones confidently. Every row points at the organization's own events page and lets that page be current on its own.

**It is not a reminder system.** No stage, no due date, no pipeline row. See "Placement".

**It is not a directory dump.** A short honest list is the right answer. The recruiters card already carries the anti-padding language and it transfers verbatim.

## Settled decisions

**Two surfaces, one engine.** Settled 2026-09-01: job-search resources are a permanent sidebar destination, and networking groups appear in every playbook, tailored to that kind of role. The same discovery-and-verify machinery serves both; only the anchor differs — city and person for one, role and function for the other.

1. **Role-scoped, in every playbook.** A card in the Focus Playbook *and* in every Opportunity Playbook, tailored to that role. The groups worth joining are the ones for where the person is going, not where they have been — a manufacturing ops leader moving into healthcare tech should not be pointed at ASCM. Derived once per function/industry/seniority signature and shared across playbooks that match; see "Placement and timing".
2. **Paid options are named, with the price stated.** Chief, Pavilion, Vistage, dues-based associations and paid conferences all appear. Cost is a stated field on every row, never a hidden condition.
3. **National and online-only bodies are recommended, with or without a local presence.** Geography is a property of a row, not a filter on the search. See "The two discovery families" — this decision has a direct and non-obvious consequence for how the search has to run.
4. **Career Club Corner is always offered.** Not a search result. A fixed, first-position entry, present on every render regardless of what discovery returns. It lives on the **sidebar destination**, not inside the role-scoped card — a free weekly call for people in transition must not require building a playbook to find. See "Career Club Corner".
5. **Rejected: a My Pipeline placement.** My Pipeline holds `source==='door2'` records only, each with a stage from `PURSUIT_STAGES` (Researching → Applied → In conversation → Interviewing → Offer → Closed), a next meeting, a next step, and overdue/going-quiet flags computed off those dates. "Join ASCM Greater NC" has no stage in that vocabulary and no close. This rejection stands and is not what the sidebar destination above is: that is its own rail entry, not a row in a pursuit list.

## What the searches actually returned

Run 2026-09-01 against personas spanning industry, function, market size and seniority. These results are the evidence base for the design; a future change that contradicts them should re-run them first.

**Associations and their local chapters resolve cleanly.** "Supply chain professional association Charlotte NC local chapter events" returned ASCM Charlotte, ISM—Charlotte (`charlotte.ismworld.org`), NC World Trade Association and CSCMP — all first-party, all with real chapter pages, meeting cadences and membership structures.

**LinkedIn groups are not findable.** `site:linkedin.com/groups supply chain` returned six results, none on LinkedIn — Wikipedia articles and university pages. The unrestricted query returned only listicles ("The Top 46 Supply Chain Groups on LinkedIn") plus a LinkedIn *showcase* page and a *company* page. There is no first-party evidence for a LinkedIn group reachable through web search. This is the same wall as the internal company-facet id in the second-degree search.

**Meetup is highly indexed and first-party.** Boise returned `meetup.com/boiseproduct/`, UXDX Boise, Start.Boise, plus Meetup's own canonical browse URLs (`meetup.com/find/us--id--boise/tech/`, `meetup.com/topics/digital-product-creation/us/id/boise/`), which are constructible from city and topic. Coverage skews tech, startup and hobby — strong for product and engineering, thin for a CHRO or a plant manager.

**Generic "networking group" and "conference" queries degrade into marketing.** "HR executive networking group Nashville CHRO peer group monthly meeting 2026" returned i4cp, McLean and Executive Platforms — paid national conferences — and explicitly failed on the local dimension. "Healthcare technology industry association executive members conference calendar 2026" returned "The Definitive Guide to…" from a cloud vendor's blog and "Top 26 Events to Attend." Asking for events returns marketing; asking for the body that runs them returns the body.

**The niche body does not surface from a generic query.** "Consumer insights market research professional association membership" returned Insights Association (30,000 members, six US regional chapters, paid) and the Association for Consumer Research (academic) — the two obvious answers. Insights Career Network, which is free, career-focused, and the better fit for someone mid-transition, surfaced only when searched by name. This is the failure mode that would make the whole section worthless: it returns what the person could have named themselves.

**Worse: the model retrieves the best answer and then drops it.** "Talent acquisition leaders professional community network peer group" returned nine results. TALK Talent (`talktalent.com`) was **ninth**. The model's own prose summary named six other communities — TLIX, i4cp's Talent Acquisition Board, Resourcing Leaders, ATAP, Silicon Valley TALC, Recruiting Leader's Edge — and did not mention TALK at all.

Checked directly, TALK is nearly 14,000 members across 80 North American chapters, free to join, invite-only curated, with TA roles posted by members. It satisfies **both** discovery families at once (80 city chapters and a national online platform), it is free, and it is arguably the single best answer for that person. The generic query ranked it last and the summary discarded it.

Two consequences, both load-bearing:

1. **Structured JSON of every candidate, never prose.** The prose summary is where the best answer was lost. This is already the design, and this is why.
2. **An explicit ranking rule is required**, and TALK is the case that defines it — see "Ordering".

**Local job-search and transition groups are highly findable.** Stronger than the professional-association vein, because these organizations exist to be found by job seekers and optimize accordingly. Kenton County Public Library's NKY Accountability Group returned `kentonlibrary.org/nkyag/` first-party, with its own "Job Search Support Groups" page and a separate page for out-of-state jobseekers who join virtually — weekly, year-round, free, 240+ employers having hired from it. The Cincinnati query also returned Job Search Focus Group (`jsfg.com`, all-volunteer, Mondays 9–11am at Hyde Park Community UMC, running since 1992), OhioMeansJobs Cincinnati–Hamilton County, the public library's own job seeker services, and two church-based national networks with local affiliates (Crossroads Career Network, Career Network Ministry). See "Local transition support".

## Failure modes to design against

**1. Dead chapters that still look alive.** `charlotte.ascm.org/index.php` came back titled *"ASCM Triangle - Home Page"*. The Charlotte, Piedmont-Triad and Triangle chapters merged into `greaternc.ascm.org`. The obvious-looking subdomain is a ghost, and someone sent there shows up to nothing.

**2. Stale event pages indexed forever.** The top "ASCM Charlotte — Events and Courses" result was `charlotte.ascm.org/meetinginfo.php?id=80&ts=1556281524`; that trailing parameter reads as a Unix timestamp for April 2019. The Tennessee SHRM equivalent carried `ts=1740002245` — February 2025. Both are StarChapter sites, a chapter CMS whose per-event pages never expire and rank well. Separately, a query explicitly asking for 2026 returned the September 2025 Nashville conference as its lead answer.

**3. Domain ambiguity.** The Insights Career Network search returned both `insightscareernetwork.org` and `insightscareer.org`. One is likely a migration or a stale domain. Picking wrong is the same class of error as (1).

**4. Padding.** Six real options exist in Charlotte for supply chain. For a CHRO in Boise there may be two. The cap is a ceiling and never a target.

**5. The obvious answer.** Returning only the industry's largest trade association, which the person already knows.

## The two discovery families

Decision 3 has a consequence that is easy to miss: **a query anchored on city cannot find an organization that has no city.** The Charlotte results were good *because* a city was supplied; that same query shape would never have surfaced Insights Career Network. One query shape cannot cover both.

Discovery therefore runs two families:

- **Placed** — function, industry, seniority plus city and country. Returns local chapters, regional bodies, city job-search groups, Meetup groups.
- **Unplaced** — function, industry, seniority with **no geography at all**, looking for professional communities, career networks, practitioner Slack and Discord groups, and national bodies with virtual programming. Returns Insights Career Network and its equivalents.

This also repairs a weakness in the geography assumption generally: a fully-remote worker and someone planning to relocate both break the city anchor. With half the search never using geography, those cases degrade rather than returning empty.

The unplaced prompt must be told explicitly to look **past** the industry's largest trade association for peer groups, career networks and practitioner communities — and to say plainly when the only thing it found is the obvious one, rather than dressing it up.

## Search architecture

Modelled on the shipped recruiter mechanic (`findRecruiterMatches` → `RECRUITER_LEADER_LOOKUP_PROMPT` gap-fill) and the openings sweep (`findOpeningMatches`).

**Stage 1 — discovery.** Two `webSearch:true` calls, `effort:'low'`, one per family, structured JSON, safe-default to an empty list on any failure so a card never blocks. Told: find the body, not the event; a listicle is not a source; `sourceUrl` is evidence, not a second link to the same page; never invent a name or a link; the cap is a ceiling and padding toward it is the one thing that would make the list worthless.

**Stage 2 — liveness check.** One cheap parallel `webSearch:true` call per candidate: is this chapter or group alive, what is its events page, how often does it meet, what does membership cost, is there a jobs board, and is this the current domain. Returns a liveness verdict plus the fields the row renders.

**The degradation ladder**, mirroring the recruiter card's named-leader ladder:

- Chapter confirmed alive → render the chapter, link its own events page.
- Chapter unconfirmed or merged → render the **national body** with no chapter claim, link the body's own chapter-finder, and say plainly that we could not confirm a local chapter.
- No first-party link at all → the row does not render as sourced. Follow the recruiter precedent: keep it separated (`uncited`) rather than discarded, so a later surface can choose to show it.

**Constructed links, not searched ones**, wherever a pattern exists. These are free, always current, and cannot be stale by construction:

- Meetup city + topic browse URL, from `profile.loc.city` and a topic slug.
- The national body's own chapter-finder page.
- Eventbrite city + category browse.
- LinkedIn's groups-search URL for the function keyword. **Requires live verification against a real logged-in account before anyone builds on it**, the same way the alumni page was verified on 2026-09-01 (see `linkedInAlumniUrl`). Do not assume the URL form.
- The Lesson 2 string itself — "job search group" plus the city — as a live search link.

The honest shape of the card is a short verified list plus a few live doors.

## Row shape

Every row carries, as separate fields rather than prose:

| Field | Values |
| --- | --- |
| `name` | The organization |
| `kind` | professional body / career network / job-search group / local meetup / gated peer group / online community |
| `howYouTakePart` | local chapter meeting in person / national with virtual programming / online community / annual gathering only |
| `cost` | free / dues (with the figure where found) / invite-only / ticketed |
| `forPeopleInTransition` | boolean — does this exist to help people in transition, or is it a professional body that happens to have a jobs board |
| `url` | first-party |
| `eventsUrl` | the organization's own events page — never a specific event |
| `sourceUrl` | the page establishing the fit; empty rather than a duplicate of `url` |
| `whyThisFits` | one plain sentence tying it to this direction |
| `confidence` | high / medium / low |

`forPeopleInTransition` is a ranking signal, not just a label. Insights Career Network is a career network; ASCM Charlotte is a professional development body with a jobs board attached. For someone mid-search the first is more immediately useful and should sort above it.

## Ordering

1. Career Club Corner (fixed, always first).
2. Career networks and job-search groups that exist for people in transition.
3. Professional bodies serving the target function or industry — local chapter first where one is confirmed, national otherwise.
4. Open communities: Meetup groups, practitioner Slack and Discord.
5. Ticketed conferences and vendor-run programming, with the cost stated.

### The ranking rule, and the case that defines it

Tier alone is not enough. Within every tier, four signals decide order, and **TALK is the worked example** — it wins on all four and the generic query still ranked it last:

- **Free beats paid.** TALK is free; i4cp's Talent Acquisition Board is a paid enterprise membership.
- **Has local chapters beats national-only.** 80 North American chapters.
- **Function-specific beats general.** A TA society beats a general HR body for a TA professional.
- **Practitioner-run beats vendor-run.** A community with no vendor upsell beats one built to sell into its own members.

"Invite-only" is **not** a demotion on its own. TALK is curated and invite-only *and* free; that combination is a quality signal, not a cost. Only price and inaccessibility demote a row, and both must be stated on the card either way.

## Career Club Corner

Always present, first position, not a search result and never subject to the discovery call.

**The copy comes from `corner.career.club`, not from the book and not written fresh here.** That page is the live source of truth for what Corner is and when it runs; anything this card says has to match it, and a rewrite in the app's own words is how the two drift apart.

What that page says, as of 2026-09-01:

- **Headline:** *"Job search is a team sport. This is your team."*
- **Subheadline:** *"Join Bob Goodwin, a LinkedIn Top Voice, and dozens of fellow job seekers as we bring order to the chaos, build community with one another, and find encouragement."*
- **Cadence:** every Monday at 12:00 ET. **Cost:** free. **Every session recorded.**
- Teaches from *Making Your Own Weather* — "a five-step process that will renew your job search."
- Benefits listed: staying on an even keel through the search; discover new viable career options; tailored LinkedIn and resume; STAR interview prep from your own stories; a negotiation playbook; a targeted company list with live research.

**The headline does both jobs Bob asked for in one line.** "Job search is a team sport" is the support-group half — it is the title of MYOW Lesson 2 — and "this is your team" is the networking half. Use it; do not paraphrase it.

**The cadence is stateable, and this is not a contradiction of the no-dates rule.** "Every Monday at 12:00 ET" is a recurring cadence, not a dated event, and it comes from a first-party page we control rather than from a search result. "Every session recorded" is worth carrying for the same reason it is on that page: a schedule conflict is not a reason to skip it. A searched row still never gets a time.

**Do not draft a rationale for why Corner belongs here.** The subheadline already is one. The card states what it is, when it runs, that it is free, and links to `corner.career.club` to register.

The entry is the first row of the list, in the same shape as every other row, with `cost: free`.

One observation worth a light touch and no more: Corner's six benefit bullets map closely onto Reimagine's own sections. The card is not cross-selling something unrelated — it points at the live, human version of the same method. That is a reason the pairing is honest, not a line of copy to write.

### What a good group looks like

Lesson 2's two warnings inform the section's general guidance: avoid the pity party (*"if the group's primary activity is validating each other's grievances, find a different group"*) and avoid fake LinkedIn community. Both belong in a `CoachingCallout`, phrased as what to look for rather than as a warning about the reader.

### Maintenance

`corner.career.club` can change its day, time or framing without this repo knowing. The card's copy is a hardcoded mirror of a page we own, so it needs the same treatment as any other duplicated constant: a note at the definition naming `corner.career.club` as the source, and a check on it whenever that page changes. Do not fetch it at runtime.

## Local transition support — the sibling feature

Bob, 2026-09-01: local job-search and career-transition groups and services are a related but **separate** feature. Kenton County Public Library's NKY Accountability Group is the worked example.

**Why separate rather than a sixth tier here.** These groups are not direction-scoped. A library accountability group serves anyone in transition in that city and does not care whether the person picked healthcare tech. That breaks this section's anchor — and, more importantly, its timing. The professional-bodies section earns its place by being specific to a chosen direction, which means it cannot exist until a direction exists. Someone laid off last week needs the free weekly group in week one, before any playbook. Making them pick a direction to reach it is the wrong gate.

**What it covers**, all of it free or near-free:

- Public library job-seeker programs and accountability groups (Kenton County, Cincinnati & Hamilton County).
- All-volunteer community groups (Job Search Focus Group, weekly since 1992).
- Public workforce services — American Job Centers / WIOA-funded (OhioMeansJobs).
- Church- and ministry-based networks with local affiliates (Crossroads Career Network, Career Network Ministry).
- Outplacement group programming, where a former employer provided it — the entry point Lesson 2 names explicitly.
- Community college and university career services open to non-students.

**Same machinery, built once, exposed twice.** The discovery-plus-liveness architecture, the degradation ladder, the row shape and the no-dates rule all transfer unchanged. Only the query family and the placement differ: this one is anchored on `profile.loc` alone, with no direction and no function.

**Placement — SETTLED 2026-09-01 (Bob): a permanent sidebar destination.** Not a card inside anything. Its own entry in the rail, always there.

This is right, and the precedent for making it reachable early already ships. The rail has two states, gated on `personalBrandDone = done.includes('p3')` (App.jsx ~6162): before the Personal Brand, the Orientation rail; after it, "Your work". A plain `primaryItems` entry would therefore be invisible until the brand is built — still far better than requiring a direction, but not week one.

**My Coach already solves exactly this and is the pattern to copy.** It is pinned to the top of the Orientation rail so it is reachable from the very first screen, gated only on `signedIn`, and the later "Your work" rail carries its own separate entry. Job Search Resources takes the same shape: pinned on the Orientation rail, plus a `primaryItems` entry after the brand. No new mechanism.

Unlike My Coach it needs no account and no generation to be useful, so the `signedIn` gate is optional here — worth deciding deliberately rather than copying by default.

**Career Club Corner moves here.** In the earlier draft it was the first row of the direction-scoped section, which meant a free weekly call for people in transition could not be found until someone had picked a direction and built a playbook. On a permanent sidebar destination it is reachable from the first screen, which is where it belongs. It stays first, in the same row shape, with the copy from `corner.career.club`.

**The categories overlap and neither section owns a row.** AMA Cincinnati runs a Job Transition Group: a professional association operating a transition group. It is a legitimate result for both features. The row shape's `forPeopleInTransition` flag is what lets one organization appear correctly in either place.

**Staleness carries over, harder.** "Mondays 9–11am at Hyde Park Community UMC" is exactly the detail that rots, and these groups change rooms and times more often than a national body changes its chapter list. Name the group, link its page, never assert the time. `jsfg.com` running since 1992 and NKYAG meeting weekly year-round are durable facts about the *organization*; the meeting time is not.

## Inputs

Nothing new in Orientation. `profile.loc` already carries `{city, country, work}` from Your Current Situation, and function, industry and seniority derive from the chosen direction exactly as they do for the recruiter card (`recruitersSignatureFor`, `inferSeniorityBand`).

Two optional controls belong **on the card**, not in Orientation, and only if the card visibly changes when they are set (the no-blind-capture rule):

- **Anchor on where you live, or where you are targeting.** Covers relocation and fully-remote.
- **Are dues and travel on the table.** This single answer reorders the list.

## Placement and timing

**Every playbook, tailored to the role — SETTLED 2026-09-01 (Bob).** Both kinds, not just the Focus Playbook.

- **Focus Playbook** (`source==='door1'`): under "Carry it into the market" alongside `p_res` / `p8` / `p7`, a bonus card outside the numbered `FOCUS_GROUPS` — the same structural position as `recruiters` and `income`.
- **Opportunity Playbook** (`source==='door2'`): a card on the record, alongside the existing extras — the three doors, the company read, the salary read, the panel read.

**This corrects an earlier call in this brief.** The first draft said "not in the Opportunity Playbook" because that surface is company-anchored and already has the three doors. That was too conservative: the doors answer *who do I know at this company*, and this answers *where does this profession gather*. Different questions, and the second is useful precisely when the first comes up empty. An Opportunity Playbook carries a JD, so it has a role, a company and usually an industry — enough to tailor on.

**Add it as a NON-counted card.** `OP_COUNTED_KEYS` is `['companyRead','p5','p6','p_res','p_cover','p11']` and drives the "N of 6 built" progress shown on every My Pipeline row. Adding a seventh key would retroactively make every existing playbook look incomplete. The extras already on that surface (who-you-know, salary read, panel) are the precedent.

**Generated on demand**, never in the initial sweep.

### Derive once per signature, not once per playbook

"In all playbooks" has one real cost, and it has to be designed out rather than discovered later. Someone working five supply-chain opportunities would otherwise get the same ASCM row five times, generated five times and paid for five times.

**Key the result on a signature, not on a playbook id.** The precedent is `recruitersSignatureFor(c)` — `function|industry|seniority`, lowercased and stripped, with **geography deliberately excluded** so a geo-focused refinement does not thrash the key. Two playbooks that resolve to the same signature share one result and one generation.

This also matters for storage, not just cost. Playbooks live inside the `savedPlaybooks` blob, which has a known whole-blob clobber problem and a 1MB profile-state save cap that has already silently broken saves for at least one account. N copies of the same list inside N playbook records makes both worse. One signature-keyed record does not.

**The consequence to accept:** the list is not company-specific, and it should not pretend to be. Two Opportunity Playbooks in the same function and industry show the same groups, correctly. Company-specific is what the three doors are for.

## Copy rules

- **"Room" and "rooms" are banned** as a synonym for a group or a situation (CLAUDE.md §3), and `stripRoomsPlaceholder` will strip them. Use chapter, group, meeting, community.
- No coaching that states the obvious. The section must not explain that networking matters.
- **No unverifiable assertions about the reader or the world.** This section is unusually exposed to them — "most jobs are found through networking", "nobody gets hired off job boards". Lesson 2's own claim about third and fourth degree connections is Bob's to make in his book; the app states mechanics, not statistics.
- No custody language. We never take the person's network.
- All guidance in `CoachingCallout` (CLAUDE.md §8). No sub-15px text; 16px+ on anything interactive.
- Say what a membership costs plainly. A reader who is out of work should never discover a price by clicking.

## Cost

Two discovery calls plus N liveness checks, all `effort:'low'`. Comparable to the recruiter card and its leader lookups. Price it against the Economics tab's per-generation capture before committing, and confirm the on-demand generation does not push a typical session toward the hourly cap that trips the rogue-activity watchdog.

## Affected files

- `src/App.jsx` — prompts, `find*` helpers, the card, the Focus Playbook wiring.
- `src/nav-labels.js` — the section label. Proposed: **"Groups for This Path"**, mirroring "Recruiters for This Path" so the sibling relationship is legible. Alternative: "Where Your People Are". This is the single source of truth for the name and Bob's call.
- `src/coach-routing.js` — `FEATURE_MAP` entry, then `npm run gen:coach-nav-map`.
- `src/data/user-guide/` — the Focus Playbook chapter. Both required in the same PR (CLAUDE.md §8); "guide and coach later" is not a valid scope cut.
- A new pure module under `src/components/` or a `.mjs` alongside `connections-match.mjs` for the URL constructors, with a Node test in `scripts/` — the font-size gate scans `src/App.jsx` and `src/components/`, so new UI goes in `src/components/`.

## Verification before build

1. **Verify the LinkedIn groups-search URL live**, against a real logged-in account. Do not build on an assumed URL form.
2. **Verify the Meetup browse-URL patterns** for two cities and two topics, including a small market where coverage is thin.
3. **Run both discovery families against four personas** spanning industry, function, market size and seniority — one deliberately in a small market and one deliberately mid-pivot — and read the output for the obvious-answer failure before writing any UI.
4. **Confirm the liveness check catches the ASCM Charlotte case**: given `charlotte.ascm.org`, it should degrade to the national body or resolve to `greaternc.ascm.org`, not render a live Charlotte chapter.
5. **The TALK test — blocking.** Run the talent-acquisition persona. **If TALK Talent is not in the top three, the ranking rule is wrong** and must be fixed before any UI is written. A generic query ranked it ninth of nine and the model's prose summary omitted it entirely, while it wins on every one of the four ranking signals. This is the sharpest available test of whether the section returns something the person did not already know.
6. **The Kenton County test, for the sibling feature.** Run the Cincinnati persona with no direction set. NKYAG, Job Search Focus Group and OhioMeansJobs should all appear, all marked free, and no meeting time should be asserted anywhere in the output.

## Open

- Section label (above), and the sidebar destination's label — proposed **"Job Search Resources"**.
- Whether the sidebar destination is gated on `signedIn` the way My Coach is. It needs no account and no generation, so the gate is a choice rather than a requirement.
- Whether `forPeopleInTransition` is exposed to the reader as a visible label or used only for ordering.
- Whether the Opportunity Playbook's three-doors empty state links across to the groups card on the same record.
