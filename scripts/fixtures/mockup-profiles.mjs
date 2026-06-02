// Shared mockup profiles for the voice A/B harness (test-p3-prompt.mjs).
//
// Three canonical shapes used across the P.p3 and P.p6 mockup rounds:
//   - Sarah Chen      — senior, near-linear (the demo profile; has a real p3)
//   - Daniel Okafor   — multi-pivot operator (constructed; no p3, generated on demand)
//   - Priya Nair      — reinvention case (constructed; no p3, generated on demand)
//
// Each entry carries pr (profile), o1 (Resume Analysis / p1), o2 (Wiring &
// Compass / p2), and for P.p6 an optional o3 (Personal Brand / p3) plus a
// chosen direction (sel) and lane label. Only Sarah ships a canonical p3
// (demoOutputs.p3); the constructed profiles set o3:null so the p6 harness
// generates one with the current P.p3 before running the Bridge Story A/B.
//
// (runAbMockup in test-p3-prompt.mjs still carries its own inline copy of the
// Sarah/Daniel/Priya pr/o1/o2; that path predates this module and is stale
// against HEAD — see the --p6 dispatch comment. A future cleanup can point it
// here. This module is the forward source of truth.)
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

export async function loadMockupProfiles() {
  const demo = await import(pathToFileURL(path.join(REPO, 'src', 'demoData.js')).href)
  return [
    {
      name: 'Sarah Chen',
      shape: 'senior, near-linear: 14 years building talent infrastructure inside one healthcare institution',
      slug: 'sarah-chen',
      pr: demo.demoProfile,
      o1: demo.demoOutputs.p1,
      o2: demo.demoOutputs.p2,
      o3: demo.demoOutputs.p3, // canonical Personal Brand prose
      sel: demo.demoChosen,    // "Chief People Officer at a digital health company"
      lane: 'Familiar Ground',
    },
    {
      name: 'Daniel Okafor',
      shape: 'multi-pivot operator: consulting -> fintech COO -> logistics ops -> fractional advisory; multiple lanes already in history',
      slug: 'multi-pivot-operator',
      o3: null,
      sel: 'Chief Operating Officer at a Series B fintech',
      lane: 'Familiar Ground',
      pr: {
        loc: { country: 'United States', city: 'Chicago, IL', work: 'Open to relocation for the right role' },
        resume: `DANIEL OKAFOR
Operating executive | Chicago, IL

EXPERIENCE
Fractional COO / Operating Advisor (Independent) | 2021-Present
- Embedded operating leader for three venture-backed companies (Series A to C) across fintech, logistics software, and consumer health.
- Built the financial-operations and hiring engine for a 60-person fintech through its Series B.

VP Operations | Cartage (logistics / supply-chain SaaS) | 2017-2021
- Ran operations for a 400-person logistics-software company; owned support, implementation, and revenue operations.
- Scaled implementation throughput 3x without proportional headcount.

Chief Operating Officer | Ledgerline (early-stage fintech) | 2014-2017
- Second hire. Built finance, operations, and people functions from zero to 90 people.

Engagement Manager | Bain & Company | 2009-2014
- Led operational-turnaround and growth-strategy cases across industrial, financial-services, and retail clients.

EDUCATION
MBA, University of Chicago Booth; BS Industrial Engineering, Purdue`,
        assess: 'CliftonStrengths Top 5: Strategic, Activator, Arranger, Learner, Command.',
        assessType: 'clifton',
        values: `Momentum over polish. I would rather ship and correct than wait and perfect.
Range. I get restless inside a single function or industry.
Ownership. I want the call and the consequences.
Building teams that outlast me.`,
        passions: `Operating systems and org design: how young companies turn chaos into a working machine.
Coaching first-time founders through their first 100 hires.
Endurance cycling.`,
        rep: {
          memory: 'The thing people remember is that I walk into a mess and within a month there is a plan and the team can breathe again.',
          emergency: 'Decisive, fast, calm in chaos, sees the whole board, sometimes moves before the team has caught up.',
          twoWords: 'Turnaround operator',
          other: 'I have been told I get bored once the machine runs smoothly, which is probably why I keep changing contexts.',
        },
        lifeEvents: 'I moved countries three times before I was twelve. I learned to read a new room fast and make myself useful before anyone explained the rules. That is still how I enter a company.',
        linkedin: 'linkedin.com/in/danielokafor-demo',
      },
      o1: `### Capability

Daniel is an operator who stabilizes and scales young companies through their messiest inflection points. The constant across his work is not an industry or a function; it is the inflection point itself.

### Proof

At Ledgerline he was the second hire and built finance, operations, and people from zero to ninety. At Cartage he scaled implementation throughput threefold without matching headcount. Since 2021 he has done the same embedded-operator work across fintech, logistics software, and consumer health as a fractional COO. The Bain years gave him the diagnostic habit; the operating years gave him the cost of being wrong. He has changed industry four times and changed function less than the resume suggests: every role is the same operating move applied to a different mess.

### Personal Brand statement

"I take young companies from chaos to a working machine, then I hand them the keys."

### Hedge

One read is that Daniel is a generalist who has not committed to a domain. The competing read, better supported by the staying-just-long-enough pattern, is that the inflection point is his domain and the industry is incidental. We carry the second read forward, with the user invited to refine.`,
      o2: `The Five Ps read the kind of work and the kind of place that fit the operator p1 described.

### Passion

The energy is highest in the first eighteen months of a company's scramble: the org chart that does not exist yet, the process that has to be invented. Coaching first-time founders is the same drive one layer out.

### Personality

The assessment (Strategic, Activator, Command) matches the work. The watch-out the reputation data already names is the boredom once the machine runs; the strength and the flip side are the same trait.

### Perspiration

The grind he sustains is the early-stage scramble, not the steady-state operate. Four context changes in fifteen years is the signature of someone who renews on novelty and pays for it in continuity.

### Potential

The open question is whether the next move is a permanent seat he stays in past the scramble, or a portfolio of scrambles (operating partner at a fund, serial fractional work). Both fit the evidence; the inputs do not yet decide it.

### Environment fit

Daniel fits early-stage and turnaround contexts with real ownership and a high tolerance for unfinished edges. He does not fit a mature function that mostly needs maintaining.`,
    },
    {
      name: 'Priya Nair',
      shape: 'reinvention case: corporate tax director whose current title and industry do not predict the next move, which points toward climate / mission work',
      slug: 'reinvention-case',
      o3: null,
      sel: 'Climate Finance Lead at a mission-driven company',
      lane: 'Work That Matters',
      pr: {
        loc: { country: 'United States', city: 'Seattle, WA', work: 'Remote preferred' },
        resume: `PRIYA NAIR
Director, Corporate Tax | Seattle, WA

EXPERIENCE
Director, Corporate Tax | Evergreen Industrial Holdings | 2016-Present
- Lead the corporate tax function for a 3B-dollar industrial manufacturer; manage a team of nine.
- Built the company's first sustainability-linked tax-credit capture program (clean-energy investment credits, R&D credits).
- Chair of the employee Green Team; led the internal push that moved three plants to renewable-power contracts.

Senior Tax Manager | Deloitte | 2009-2016
- Advised industrial and energy clients on federal tax planning and credits.

Board Member (volunteer) | Cascade Climate Coalition | 2019-Present
- Finance lead for a regional climate-advocacy nonprofit; built its first multi-year operating budget.`,
        assess: 'CliftonStrengths Top 5: Responsibility, Analytical, Belief, Connectedness, Learner.',
        assessType: 'clifton',
        values: `Doing work I would defend if someone asked me what it was for.
Rigor. The numbers have to be right.
Quiet impact over visible credit.`,
        passions: `Climate and the energy transition, approached through finance and incentives.
Reading climate policy and carbon-market design on weekends.
Mentoring women entering finance.`,
        rep: {
          memory: 'People remember that I find the credit or the structure nobody else saw, and that I am the one who actually reads the whole contract.',
          emergency: 'Calm, precise, will not sign off on something she cannot stand behind.',
          twoWords: 'Rigorous translator',
          other: 'I have spent fifteen years being excellent at something that is not what I care most about. I am trying to carry the skill into work that matters to me without starting over at the bottom.',
        },
        lifeEvents: 'I grew up in a town downwind of a refinery; my mother kept the windows closed on bad-air days. I went into finance because it was stable, and I have spent years feeling the gap between what I am good at and what I would defend if someone asked me what my work is for.',
        linkedin: 'linkedin.com/in/priyanair-demo',
      },
      o1: `### Capability

Priya turns dry financial mechanics into decisions leaders act on, and she has started pointing that skill at climate. The capability is translation between technical rigor and executive action; the new element is the subject she is aiming it at.

### Proof

She built her company's first sustainability-linked tax-credit program and made it pay for itself, then chaired the Green Team push that moved three plants onto renewable power. At Deloitte she advised energy and industrial clients on credits. On the Cascade Climate Coalition board she built the nonprofit's first multi-year budget. The throughline is a tax professional who keeps finding the climate lever inside the finance seat.

### Personal Brand statement

"I make the financial case for the climate decision, in language the people who control the capital will act on."

### Hedge

The resume says corporate tax director; the energy says climate-finance translator. One read treats the climate work as a side interest. The better-supported read treats the tax title as the venue she is outgrowing and the climate work as where the capability is heading. We carry the second read, with the user invited to refine.`,
      o2: `The Five Ps read what kind of work and place fit the person, with the reinvention tension named directly.

### Passion

The stated passions converge on one place: changing behavior through incentives, with climate as the domain. The volunteer time and the reading both point there, not at tax.

### Personality

The assessment (Responsibility, Analytical, Belief, Connectedness) explains both the fifteen years of rigor and the growing pull toward work she would defend. Belief and Analytical together is a principled analyst, not a crusader; the climate move would be made with numbers, not slogans.

### Perspiration

The effort she sustains is the unglamorous, precise kind: reading the whole contract, building the budget no one wanted to build. That transfers to climate-finance work, which is long on detail and short on people who will do it rigorously.

### Potential

The open question is the size of the step. A climate-finance or sustainability role inside a larger company would let her keep her level; a pure-play climate nonprofit or startup might cost title and pay. The inputs show the direction clearly and leave the magnitude of the leap unsettled.

### Environment fit

Priya fits a mission-driven organization that still respects financial rigor, where the climate goal and the numbers are the same conversation. She does not fit a place that wants either the rigor without the mission or the mission without the rigor.`,
    },
    {
      // Round 3: hobby/passion-anchored. The strongest distinctive signal is
      // competitive cycling and what it taught about how she approaches work —
      // NOT an early-life formative event. Tests whether the broadened anchor
      // framing lets the model lead with the passion anchor. o3 is provided
      // directly with a substantive throughLine (first sentence) for the
      // theme-from-force professional beat.
      name: 'Maya Rodriguez',
      shape: 'hobby/passion-anchored: senior product manager whose strongest distinctive signal is competitive cycling and how it shapes her approach to product work',
      slug: 'cycling-pm',
      sel: 'Head of Product at a connected-fitness company',
      lane: 'Industry Insider',
      pr: {
        loc: { country: 'United States', city: 'Boulder, CO', work: 'Hybrid; open to relocation' },
        resume: `MAYA RODRIGUEZ
Senior Product Manager | Boulder, CO

EXPERIENCE
Senior Product Manager | Strava (consumer fitness app) | 2019-Present
- Own the segments and competitive-features product area used by 30M+ athletes.
- Led the leaderboard-integrity rebuild that cut disputed results 61% and lifted weekly active engagement on the feature 18%.
- Shipped the indoor-training integration that added 2.4M monthly active sessions in its first year.

Product Manager | Garmin (wearables) | 2015-2019
- Managed the cycling-computer companion app through two hardware launches.
- Ran the data-accuracy program that took GPS-track error complaints from the top support driver to outside the top ten.

EDUCATION
BS Mechanical Engineering, Colorado School of Mines`,
        assess: 'CliftonStrengths Top 5: Focus, Competition, Analytical, Discipline, Achiever.',
        assessType: 'clifton',
        values: `Train for the moment that decides the race, not the whole ride.
Effort honestly measured. The data either backs the claim or it does not.
Win as a team or do not really win.`,
        passions: `Competitive amateur road cycling: I race regional crits and one or two stage races a year.
Coaching newer riders on race tactics and pacing.
Sensor data and the science of measuring effort.`,
        rep: {
          memory: 'People remember that I am calm when a launch is on fire and that I already know which number we should be watching.',
          emergency: 'Reads the whole field fast, waits longer than feels comfortable, then commits hard and does not flinch.',
          twoWords: 'Patient closer',
          other: 'A teammate once said I manage a roadmap like a breakaway: I know exactly when to spend and when to sit in.',
        },
        lifeEvents: 'Nothing dramatic in my early life shaped this; the thing that actually formed how I work is fifteen years of bike racing.',
        linkedin: 'linkedin.com/in/mayarodriguez-demo',
      },
      o1: `### Capability

Maya builds competitive and social features for endurance athletes, and she does it with a racer's read on timing and effort. The capability is product judgment under pressure: knowing which signal matters, holding position until the decisive moment, then committing fully.

### Proof

At Strava she owns segments and competitive features for 30M+ athletes; the leaderboard-integrity rebuild cut disputed results 61% while lifting engagement 18%, and the indoor-training integration added 2.4M monthly sessions in year one. At Garmin she ran the data-accuracy program that moved GPS-error complaints from the top support driver to outside the top ten. The through-line is an athlete building for athletes, with effort measured honestly.

### Personal Brand statement

"I build the features that make competition feel fair and worth showing up for."

### Hedge

One read is a solid consumer PM with a fitness specialty. The better-supported read, given the racing and the reputation language, is that the competitive instinct IS the product instinct, and the domain is where it compounds. We carry the second read, with the user invited to refine.`,
      o3: `You read a product the way you read a race: you watch the whole field, wait for the moment the gap opens, and commit everything to it before the rest of the bunch has decided to move. Fifteen years of competitive cycling did not just give you a hobby to mention; it built the operating instinct your colleagues describe as "calm when the launch is on fire, already watching the right number." The patience to sit in, the discipline to measure effort honestly, the timing to spend at the decisive moment — those are the same moves whether the finish line is a crit sprint or a feature launch.

That instinct shows up most clearly in the work where competition has to feel fair: the leaderboard-integrity rebuild at Strava that cut disputed results by 61% while engagement rose, because you understood from the inside that athletes will only chase a number they trust. You build for people like you, and you measure what you ship the way you measure a training block: against the data, without flattering yourself.

The open question is scale of ownership. You have run a competitive-features area inside a large product; the inputs point toward owning the whole product for a company whose users are athletes, where your read on what makes effort worth showing up for sets the direction rather than one feature of it.`,
    },
    {
      // Round 3: training/credential-anchored. The distinctive anchor is
      // classical-music training and its dual lesson — individual mastery
      // inside an ensemble — carried into operations leadership. Tests the
      // training/skill anchor path. o3 provided with a substantive throughLine.
      name: 'David Kim',
      shape: 'training/credential-anchored: classically-trained musician now in operations leadership, carrying the dual-skills lesson (personal excellence inside a team construct) into how he runs teams',
      slug: 'musician-ops',
      sel: 'Vice President of Operations at a scaling consumer-hardware company',
      lane: 'Familiar Ground',
      pr: {
        loc: { country: 'United States', city: 'Austin, TX', work: 'Onsite' },
        resume: `DAVID KIM
Operations leader | Austin, TX

EXPERIENCE
Senior Director, Operations | Lumen Devices (consumer hardware) | 2018-Present
- Run supply chain, manufacturing ops, and customer fulfillment for a hardware company that grew from 40 to 260 people.
- Built the cross-functional launch process that took on-time-launch rate from 55% to 92% across six product releases.
- Cut fulfillment error rate from 3.1% to 0.6% by rebuilding the warehouse-to-carrier handoff.

Director of Operations | Cohere Audio | 2013-2018
- Owned operations for an audio-hardware startup through its first three product lines.

EARLIER
Section violinist, regional professional orchestra (part-time) | 2008-2013
- Performed while building an operations career; trained at conservatory through a performance degree.

EDUCATION
BMus, Violin Performance, New England Conservatory; later coursework in operations management`,
        assess: 'CliftonStrengths Top 5: Harmony, Discipline, Responsibility, Consistency, Relator.',
        assessType: 'clifton',
        values: `Prepare your own part so well it is never the weak link.
The ensemble sounds better than any soloist; build for that.
Tempo discipline. The plan only works if everyone keeps the same time.`,
        passions: `Chamber music; I still play in a string quartet most weekends.
Teaching young players how to listen across a section rather than just play their own line.
Process design: the operations equivalent of a well-rehearsed score.`,
        rep: {
          memory: 'People remember that my launches feel rehearsed, like everyone already knew their entrance.',
          emergency: 'Calm, exact, hears when one part is off before anyone else, fixes it without stopping the music.',
          twoWords: 'Quiet conductor',
          other: 'I have been told I run a standup like a rehearsal: short, prepared, and everyone leaves knowing their part.',
        },
        lifeEvents: 'I trained as a classical violinist before I ever managed an operation. Conservatory taught me two things at once: master your own part completely, and then subordinate it to the room.',
        linkedin: 'linkedin.com/in/davidkim-demo',
      },
      o1: `### Capability

David runs hardware operations with a musician's ear for an ensemble: individual parts prepared to mastery, then tuned to each other in real time. The capability is orchestrating complex cross-functional launches so they feel rehearsed rather than rescued.

### Proof

At Lumen Devices he scaled operations from 40 to 260 people, took on-time-launch rate from 55% to 92% across six releases, and cut fulfillment error from 3.1% to 0.6%. At Cohere Audio he owned operations through three product lines. The conservatory training and the orchestra years are not a footnote; the reputation language ("launches feel rehearsed," "runs a standup like a rehearsal") shows the musical discipline is the operating method.

### Personal Brand statement

"I make complex launches feel rehearsed, because everyone knew their entrance."

### Hedge

One read treats the music background as colorful trivia. The better-supported read treats the dual lesson of conservatory — personal excellence inside a team construct — as the actual source of how he runs operations. We carry the second read, with the user invited to refine.`,
      o3: `You run operations the way a chamber ensemble plays: every part rehearsed to mastery on its own, then tuned in real time to everyone else in the room. Conservatory taught you two things at once, and you have never separated them: prepare your own line until it is never the weak link, and then subordinate it to the sound of the whole group. That is why your colleagues say your launches "feel rehearsed, like everyone already knew their entrance." It is not luck and it is not heroics; it is the same discipline that lets a string quartet start together without a conductor.

The force shows up most clearly in how you take chaos to coordination: at Lumen Devices the cross-functional launch process you built moved on-time-launch from 55% to 92%, because you treat a release the way you treat a score, every section knowing its entrance before the downbeat. You do not run operations by force of will; you run it by rehearsal.

The open question is altitude. You have directed operations inside a growing company; the inputs point toward owning the whole operation at a larger scale, where the job is less about playing your own part and more about making the entire room play in time.`,
    },
    {
      // Round 4: assessment-anchored. Strongest distinctive signal is a
      // CliftonStrengths result (Restorative) that named what he had already
      // been doing for years. Tests the three-move assessment-anchor pattern
      // (graceful intro + own-words definition + recognition reflection).
      name: 'Marcus Bell',
      shape: 'assessment-anchored: senior operations leader whose CliftonStrengths Restorative theme named the fix-what-is-broken instinct that has run through eighteen years of turnaround work',
      slug: 'assessment-anchored',
      o3: null,
      sel: 'Head of Operations at a post-Series-C company cleaning up its scaling mess',
      lane: 'Familiar Ground',
      pr: {
        loc: { country: 'United States', city: 'Columbus, OH', work: 'Hybrid' },
        resume: `MARCUS BELL
Operations leader | Columbus, OH

EXPERIENCE
Director of Operations | Greentree Logistics | 2015-Present
- Inherited a distribution network running 14% late and brought it to 2% in eighteen months.
- Rebuilt the returns process that was bleeding $3.1M a year down to $700K.
- Took over the lowest-rated regional hub and made it the company's benchmark within two years.

Operations Manager | Maxon Retail | 2009-2015
- Ran store-operations turnaround for the bottom-decile region; moved it to top-quartile on shrink and on-time replenishment.

EARLIER
Operations Supervisor | regional grocery chain | 2006-2009

EDUCATION
BS Supply Chain Management, Ohio State`,
        assess: 'CliftonStrengths Top 5: Restorative, Responsibility, Analytical, Discipline, Consistency.',
        assessType: 'clifton',
        values: `Leave the system better than I found it.
The unglamorous fix matters more than the launch.
Do not walk past a broken process.`,
        passions: `Restoring old cars; I have brought three back from the scrapyard.
Watching how complex systems fail and what it takes to make them whole.
Coaching new ops managers through their first real mess.`,
        rep: {
          memory: 'People remember that I get handed the thing nobody else can fix and quietly make it work.',
          emergency: 'Calm in a mess, methodical, finds the root cause instead of the symptom, does not need credit.',
          twoWords: 'Quiet fixer',
          other: 'I took CliftonStrengths a few years ago and Restorative came up first; it was the first time I had a name for what I do.',
        },
        lifeEvents: 'No single dramatic event; the through-line is that I have always been the one who fixes the broken thing nobody else wanted to touch.',
        linkedin: 'linkedin.com/in/marcusbell-demo',
      },
      o1: `### Capability

Marcus restores broken operations to health and leaves them stronger than he found them. The capability is diagnostic repair under pressure: finding the root cause in a failing system and rebuilding it to hold.

### Proof

At Greentree he took a network running 14% late to 2% in eighteen months and cut a $3.1M returns leak to $700K. At Maxon he moved a bottom-decile region to top-quartile. The pattern is consistent: he is handed the worst-performing unit and makes it the benchmark. His CliftonStrengths Restorative theme names from the outside what the career shows from the inside.

### Personal Brand statement

"I get handed the thing nobody else can fix, and I make it work."

### Hedge

One read is a competent ops manager with a turnaround streak. The better-supported read is that restoration is his actual signal, the named instinct (Restorative) confirmed across eighteen years, and the next move should put him where something specific is broken. We carry the second read, with the user invited to refine.`,
      o3: `What runs through your work is the instinct to fix what is broken before anyone asks, and to leave the system stronger than you found it. For eighteen years you have been handed the worst-performing unit and quietly made it the benchmark, and a few years ago CliftonStrengths gave that instinct a name you had never had for it: Restorative came up first, and you recognized yourself immediately. The restored cars in your garage are the same instinct off the clock.

That force shows up most clearly when the numbers are ugly and the fix is unglamorous: at Greentree you took a distribution network running 14% late down to 2% in eighteen months, because you went after the root cause instead of the symptom. You do not chase the launch; you chase the thing that is quietly costing the company and nobody else wants to touch.

The open question is venue, not direction. You do your best work where something specific is already broken and the mandate is to make it whole, which points toward an operation in trouble rather than one running smoothly.`,
    },
    {
      // Round 4: value-anchored. Distinctive opening hinges on a value with a
      // defensible opposite (depth/legacy over reach/scale), shown driving
      // specific career choices (turned-down bigger roles, sustained tenure).
      // Tests the four-move value-anchor pattern (name + evidence + defensible
      // opposite acknowledgment + own framing).
      name: 'Elena Vasquez',
      shape: 'value-anchored: senior engineering leader whose distinctive opening is a value (depth and legacy over reach) with a defensible opposite, shown in turned-down bigger roles and a decade building one platform to last',
      slug: 'value-anchored',
      o3: null,
      sel: 'Principal Engineer or Distinguished Engineer on a long-horizon platform team',
      lane: 'Work That Matters',
      pr: {
        loc: { country: 'United States', city: 'Portland, OR', work: 'Remote' },
        resume: `ELENA VASQUEZ
Staff Software Engineer | Portland, OR

EXPERIENCE
Staff Engineer | Cartwright Health (health-data platform) | 2014-Present
- Architected and still maintain the patient-records platform that 40M records depend on; designed it to outlast my tenure.
- Turned down two engineering-management promotions to stay close to the systems work.
- Mentored eleven engineers into senior roles; six still maintain parts of the platform I designed.

Senior Software Engineer | Inkwell Systems | 2010-2014
- Built core billing infrastructure still in production a decade later.

EDUCATION
MS Computer Science, University of Washington`,
        assess: 'CliftonStrengths Top 5: Deliberative, Responsibility, Discipline, Belief, Connectedness.',
        assessType: 'clifton',
        values: `Build things meant to outlast me, not things that make me look big this quarter.
Depth over reach. I would rather own one system completely than ten shallowly.
Stewardship: the next engineer should bless my name, not curse it.`,
        passions: `Long-horizon systems design and the craft of code that ages well.
Mentoring engineers who will maintain what they build.
Restoring a 1920s house, one honest repair at a time.`,
        rep: {
          memory: 'People remember that the systems I build are still running and still understandable years later.',
          emergency: 'Careful, principled, will not ship a shortcut she knows the next person will pay for.',
          twoWords: 'Patient steward',
          other: 'I have turned down management twice because the title was bigger but the work was further from what I care about.',
        },
        lifeEvents: 'My grandmother built a business meant to pass down, and watching her choose the durable option over the flashy one shaped how I think about building anything.',
        linkedin: 'linkedin.com/in/elenavasquez-demo',
      },
      o1: `### Capability

Elena builds software systems designed to outlast her own tenure, and she has repeatedly chosen depth over advancement to do it. The capability is durable architecture plus the stewardship instinct to maintain it well.

### Proof

She architected and still maintains a patient-records platform 40M records depend on, designed to outlast her. She turned down two management promotions to stay close to the systems work, and mentored eleven engineers into senior roles. At Inkwell she built billing infrastructure still in production a decade later. The pattern is a builder who optimizes for longevity, not visibility.

### Personal Brand statement

"I build systems meant to outlast me, and I stay to keep them honest."

### Hedge

One read is a strong staff engineer who avoided management. The better-supported read is that a value, durability over advancement, is actively steering her choices, and the next move should be a track that rewards depth (Principal/Distinguished) rather than a management ladder. We carry the second read, with the user invited to refine.`,
      o3: `What runs through your work is a commitment to building things meant to outlast you, even when the bigger title was sitting right there. You have turned down management twice, not because you could not do it, but because the title was further from the work you actually care about, and you would rather own one system completely than ten shallowly. I respect engineers who chase the broader mandate; that is a real way to build a career. It is just not yours. The platform you architected at Cartwright, the one 40M patient records depend on, you designed to be understood and maintained long after you are gone.

That value shows up in the evidence, not just the words: six of the eleven engineers you mentored still maintain parts of that platform, because you built it and them to last. You optimize for the engineer who inherits your code blessing your name, not for how big you look this quarter.

The open question is altitude, not direction. The next chapter is a track that rewards exactly this, depth and stewardship at the highest individual-contributor level, rather than a management ladder that would pull you away from the work.`,
    },
  ]
}
