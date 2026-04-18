// demoData.js — Static demo content for Reimagine ?demo=true mode
// Persona: Sarah Chen, VP Talent Acquisition, Meridian Health System
// Update this file when new modules are added to the app.

export const demoProfile = {
  loc: {
    country: "United States",
    city: "Atlanta, GA",
    work: "Hybrid — within commuting distance of home base"
  },
  resume: `SARAH CHEN
VP Talent Acquisition | Meridian Health System | Atlanta, GA

PROFESSIONAL SUMMARY
Senior talent acquisition and people-strategy leader with 14 years of progressive experience in healthcare. Proven track record of building scalable hiring infrastructure, reducing costs, and driving measurable business outcomes in complex, regulated environments. Known as a trusted architect who delivers results through process design, team development, and cross-functional partnership.

EXPERIENCE

Vice President, Talent Acquisition & Workforce Planning
Meridian Health System, Atlanta, GA | 2014–Present
• Lead talent acquisition for 14,000-employee integrated health system across multiple locations
• Reduced clinical hiring costs by $4.2M annually through process redesign and referral program development
• Built employee referral program now generating 34% of all hires
• Scaled recruiting team 175% during COVID while executing Taleo-to-Workday ATS migration for 300+ managers
• Compressed offer decline rate from 22% to 9% through redesigned offer experience and manager engagement
• Support $280M workforce planning and clinical service line staffing models

Director, Talent Acquisition
Meridian Health System | 2011–2014
• Grew recruiting function from 2 to 6 full-time recruiters
• Established employer brand strategy; improved application volume 40%
• Launched formal referral program achieving 28% of hires in first year

Manager, Recruitment & Staffing Operations
Meridian Health System | 2008–2011
• Built recruiting operations function across 40+ hiring managers
• Led initial ATS (Taleo) implementation
• Improved time-to-hire from 65 days to 42 days

EDUCATION
MBA, Emory University Goizueta Business School
BS, Human Resources Management, University of Georgia

CERTIFICATIONS
SHRM-SCP | PHR | Workday HCM Certified`,
  resumeFile: "SarahChen_Resume.pdf",
  assess: `CliftonStrengths Top 5:
1. Achiever — Relentless drive to complete and deliver. You set internal benchmarks others can't see and measure yourself against them daily.
2. Arranger — You manage complexity by continuously optimizing how people, resources, and processes fit together. You see the configuration others miss.
3. Strategic — You see patterns and pathways before others do. When a problem appears, you've already mapped 3 possible routes forward.
4. Relator — Deep, trust-based relationships are your currency. You invest in knowing people, and they invest back.
5. Responsibility — When you commit, it's done. People trust you because your word is your deliverable.

Supporting Strengths (6-10): Learner, Individualization, Communication, Activator, Futuristic`,
  assessFile: "SarahChen_CliftonStrengths.pdf",
  assessType: "clifton",
  values: `What matters most to me in work:

1. Impact — I need to see that my work changes something real. Not reports that sit on shelves. Actual outcomes: people hired faster, costs reduced, teams that work better.

2. Trust — I build my career on being the person people come to when it matters. I need to work in an environment where trust is earned through delivery, not politics.

3. Growth — I'm always learning. The moment I stop growing is the moment I start looking for something new. I want to be challenged, not comfortable.

4. Autonomy — I do my best work when I have the room to design, build, and execute without being micromanaged. Give me the problem and the guardrails, and I'll figure out the rest.

5. People — At the end of the day, I care about people. Not in a soft way. I care about setting people up to do their best work, and I care about working with people who share that same standard.`,
  passions: `What energizes me outside of work:

- Healthcare innovation — I follow digital health closely. I believe technology can solve real access and cost problems in healthcare, and I want to be part of that.
- Organizational psychology — I read about how teams work, how culture forms, and why some organizations thrive while others stagnate. This isn't just professional interest; it genuinely fascinates me.
- Real estate investing — I've been building a small portfolio of rental properties. I enjoy the strategy, the numbers, and the long-term wealth building.
- Travel — I recharge through travel, especially internationally. New perspectives keep me sharp.
- Mentoring — I spend time mentoring emerging HR leaders, especially women in healthcare. This gives me energy and purpose beyond my day job.`,
  rep: {
    memory: "When I think about the moments in my career I'm most proud of, they all involve building something from nothing and watching it work. The referral program is the best example — I designed it, launched it with minimal budget, and it now generates a third of our hires. The CHRO told me, 'I don't know how you did that, but you just saved this organization.' That moment matters to me because it was real impact, not theater.",
    emergency: "Strategic, calm under pressure, gets things done, trusted, direct but warm, operates with integrity, builds systems that actually work, connects the dots between people problems and business outcomes.",
    twoWords: "Trusted Architect",
    other: "I've been told I'm the person people call when something is broken and needs to work by Monday. I take that seriously. I also know I can be impatient with people who don't share my sense of urgency — that's something I'm working on."
  }
};

export const demoDeepOpts = [
  "Chief People Officer, Digital Health Company",
  "Workforce Strategy Consultant (Independent)",
  "VP People Operations, High-Growth Healthtech Company"
];

export const demoChosen = "Chief People Officer at a digital health company";

export const demoDone = [
  "welcome", "location", "resume", "assessment", "values", "reputation",
  "p1", "p2", "p3", "p4", "p5", "decision",
  "p6", "p7", "p8", "p_res", "p9", "p10", "complete", "income"
];

export const demoOutputs = {

// ─── P1: FUNCTIONAL IDENTITY ────────────────────────────────────────────

p1: `# YOUR RESUME ANALYSIS

## ALTITUDE AND CONTEXT

You lead talent acquisition for a 14,000-person integrated health system across multiple locations, which means you operate in a high-complexity, regulated, multi-stakeholder environment every day. You report to a CHRO, manage a recruiting team, coordinate with 300+ hiring managers across clinical and administrative functions, and support a $280M workforce planning mandate.

---

## TRANSLATED ACCOMPLISHMENTS

**1. Saved $4.2M annually in clinical hiring costs**
You identified the cost drivers (fragmented sourcing, agency dependency, no referral channel), redesigned the talent acquisition function around them, and built solutions that stayed in place.

**2. Built a referral program generating 34% of all hires**
You started this from nothing, and now a third of your hires come through employee referral, which means both quality and speed improved while sourcing costs dropped.

**3. Scaled recruiting team 175% during peak crisis (COVID)**
You grew from baseline to 175% during the worst hiring environment healthcare has seen, while executing a parallel enterprise ATS migration for 300 managers at the same time.

**4. Compressed offer decline from 22% to 9%**
That's a 13-point swing on a metric that directly affects hiring cycles and culture, and you did it by redesigning the offer experience and manager engagement rather than adding headcount.

**5. Migrated 300+ managers from legacy Taleo to Workday without losing hiring velocity**
You could have created a 12-month implementation project, but instead you planned for speed, built guardrails, trained tight, and kept the business humming in eight weeks with zero broken cycles.

**6. Built recruiting operations function from ground zero**
You started with 2 recruiters, grew to 6, and established the process standards, metrics, sourcing strategy, and brand positioning that let the function scale beyond you.

**7. Established employer brand strategy that improved application volume 40%**
Clinical and administrative roles were getting the same generic treatment, so you differentiated them, and both application volume and quality improved as a result.

---

## YOUR WIRING DECODED

Your CliftonStrengths top 5 (Achiever, Arranger, Strategic, Relator, Responsibility) show up clearly in how you work:

**Achiever + Responsibility:** You finish what you start and set internal benchmarks higher than what's asked of you, which is why people trust your word as a contract.

**Arranger + Strategic:** You see configuration problems others miss, and when something has 10 moving parts you're already testing which arrangement works best. This is what draws you to process design.

**Relator:** Your influence comes from earned trust rather than title. You've invested deeply in understanding the CHRO's pressures, the hiring managers' constraints, and the candidates' hesitations, and people come to you because you've proven you'll deliver.

Together, these strengths form an operating system: you see the pattern, you build for it, you deliver when it counts, and people trust you because you follow through.

---

## THE SIGNAL IN YOUR CREDENTIAL STACK

Fourteen years at a single organization signals loyalty and depth. An MBA from a top-tier program signals strategic thinking beyond HR. Your SHRM-SCP, PHR, and Workday HCM certifications signal commitment to the craft and technical depth in the systems. Together, they tell the story of a thoughtful, serious operator.`,

// ─── P2: ASSESSMENT DEEP DIVE ───────────────────────────────────────────

p2: `# YOUR WIRING AND COMPASS

## THE HOW ANALYSIS

When you look at how you work, three patterns emerge:

**Pattern 1: Achiever + Responsibility creates relentless delivery**
You finish what you start and set internal standards higher than what's asked of you. When you say you'll handle something it becomes a personal contract, and that's why people trust you with the hard assignments.

**Pattern 2: Arranger + Strategic creates diagnosis speed**
You see 3-4 possible paths almost immediately when a problem appears, and you mentally test which configuration of people, resources, and sequence produces the best outcome. In meetings you're often two steps ahead of the conversation, and when you see inefficiency you redesign it instinctively.

**Pattern 3: Relator means you influence through earned trust**
You invest deeply in understanding people's problems rather than networking casually. Your CHRO gave you the biggest projects because you'd earned that trust through years of consistent delivery, and people put their reputation on the line with you (like in your referral program) because they trust your judgment.

**The supporting forces:** Learner drives you to master new domains, Communication helps you translate complexity into clarity, Activator keeps you from overthinking, and Futuristic helps you see where things are headed while executing today.

---

## ENVIRONMENT FILTER

Looking at where you thrive versus where you struggle:

**You thrive in:**
- Organizations where trust is earned through delivery rather than politics
- Environments where you can see direct business impact from your decisions
- Complex, multi-stakeholder environments where you need to coordinate across functions
- Situations that require both strategic thinking and operational execution
- Places where you have autonomy to design solutions your way

**You struggle in:**
- Highly political organizations where success requires playing the game
- Roles where impact is invisible or unmeasurable
- Environments where process matters more than results
- Situations with excessive micromanagement
- Companies where people strategy is treated as a cost center rather than a business driver

Your reputation at Meridian (trusted, direct, gets things done) signals you thrive in high-trust, results-oriented cultures, and that matters for your CPO search.

---

## PASSION LOG

Your values and passions connect directly to your next move:

**Healthcare innovation:** You follow digital health closely because you believe it solves real access and cost problems, and a CPO role at a digital health company puts you at the center of that work, building the people infrastructure that enables the mission.

**Organizational psychology:** You read about how teams work, how culture forms, why some organizations thrive while others stagnate. A CPO role is applied organizational psychology: you'd be designing culture, feedback systems, team structures, and leadership development every day.

**Real estate investing:** Your portfolio gives you financial independence to take career risks, which means you can choose a role for fit rather than just compensation.

**Travel:** Growth-stage companies are usually more flexible on schedules and remote work than large health systems, and more autonomy often means more breathing room.

**Mentoring:** As CPO, you'd mentor the entire leadership team on people decisions and develop emerging HR talent on your own team. This passion becomes your daily work.

All of this points toward a role where you build something that matters, in an innovative healthcare context, with the autonomy and trust you need to do your best work.`,

// ─── P3: VALUES + PASSIONS SYNTHESIS ────────────────────────────────────

p3: `# YOUR GOLDEN THREAD

## THE CONSISTENT PATTERN

Looking at your accomplishments, your wiring, and your values, one theme surfaces:

You turn complicated people-and-process problems into measured business outcomes. The referral program that now generates 34% of hires, the $4.2M in cost reduction, the offer decline rate you compressed from 22% to 9%, the ATS migration you ran while scaling the team 175% during COVID. Each of these required the same approach: diagnose what's actually broken, design the smallest system that fixes it, implement fast, and iterate.

That's your thread across 14 years.

---

## YOUR PERSONAL BRAND

You build people and recruiting systems that create measurable business results, specifically at the intersection of operations, strategy, and execution. Your diagnosis speed, execution discipline, and understanding that people challenges are often process or structure challenges make this a specific and valuable combination.

---

## YOUR VALUE PROPOSITION

You bring healthcare operations credibility (14 years inside a complex, regulated, multi-location health system), process and systems thinking (Arranger + Strategic), and proven ability to solve talent problems that have direct P&L impact. You understand cost, you understand quality, you understand the constraints of regulated environments, and you can move fast without creating chaos.

That combination is rare. You've lived inside health systems long enough to have operational credibility, and you've built talent infrastructure at scale while holding it accountable to business outcomes.`,

// ─── P4: THE WIDE VIEW ──────────────────────────────────────────────────

p4: `# THE WIDE VIEW

Three paths forward, grounded in what you've built and what energizes you:

---

## PATH 1: IKIGAI (Skills + Passion + Market Need + Compensation)

**Chief People Officer, Digital Health Company**
*Title:* Chief People Officer or VP People Operations
*What you'd do:* Build people and recruiting infrastructure for a growth-stage digital health company at 150-400 employees, owning talent strategy, compensation, culture, organizational design, and hiring execution. You'd partner with the CEO on scaling without losing culture and report to the board on people metrics.
*Why it fits:* You've built this exact infrastructure at 14,000 scale, and digital health companies at Series B-C face identical problems at smaller scale and faster pace. Your healthcare credibility (you know what they're solving for), your cost thinking (they live and die by unit economics), and your systems approach (they need to scale without chaos) are all directly applicable. You'd be at the center of healthcare innovation, which is a passion, and you'd build something from the ground up, which matches your Learner and growth values.
*Honest brief:* You've worked in a stable, regulated, hierarchical organization, and a startup feels like organized chaos. You can do the work; the question is whether you want to trade institutional stability for speed, equity upside, and the chance to shape culture from the ground floor.

---

## PATH 2: THE INDUSTRY INSIDER (Stay in Healthcare, Shift Your Leverage)

**Workforce Strategy Consultant or Fractional CPO**
*Title:* Independent Consultant, Fractional Chief People Officer
*What you'd do:* Work with 3-4 health systems or healthtech companies per year on specific talent and people strategy problems, doing the diagnostic work you know how to do (what's broken, why, and how to fix it), designing solutions, implementing them, then moving to the next client.
*Why it fits:* You've solved these problems once at Meridian and can solve them again, faster, at other health systems. You understand healthcare's specific constraints, you have a network to seed clients, and you can charge at value rather than hours because you know the scope.
*Honest brief:* Sales and business development become your job, along with proposals, scope management, and feast-and-famine cycles. You need to be comfortable with the business side of being independent, and you also lose the operating leverage of leading a team and the equity upside of a venture-backed company.

---

## PATH 3: FAMILIAR GROUND (Upgrade Your Current Path)

**Senior Vice President, Talent Acquisition + Retention at Another Health System**
*Title:* SVP Talent Acquisition, Chief Talent Officer, or VP People Operations
*What you'd do:* Move to another health system or IDN in a bigger role where you own not just acquisition but retention, organizational design, and talent strategy, with more authority, bigger scope, and likely higher compensation.
*Why it fits:* You know how to win in this environment, you understand regulatory constraints, you know the customer (hiring managers, clinicians, HR leaders), and you could be a CHRO within 3-5 years. The learning curve is minimal, and you could move to a city you prefer.
*Honest brief:* This is the safest path, and it's optimization rather than reinvention. You'd be doing similar work to what you do now, so the question is whether "bigger at a similar organization" is what you want, or whether you're looking for something fundamentally different.

---

Each path requires different things from you. You have options because you've proven you can execute, and now it's about choosing the context where you want to do that.`,

// ─── P5: THE DEEP DIVE ──────────────────────────────────────────────────

p5: `# THE DEEP DIVE

Each path requires you to understand what you're trading and whether the trade makes sense for you.

---

## OPTION A: CHIEF PEOPLE OFFICER, DIGITAL HEALTH COMPANY

**What you'll spend your time on:**
- 30% recruiting and hiring system design (you own the funnel)
- 25% retention and culture problems (founders don't coach people, turnover spikes, you diagnose and fix)
- 20% board and investor questions (they'll want people metrics)
- 15% compensation and benefits strategy
- 10% organizational design and leadership coaching

**The daily reality:**
You work with a CEO who is brilliant in their domain but doesn't yet understand that people decisions have business impact. You'll fight for a recruiting budget, coach founders on feedback and delegation, make fast decisions about policy that would take three committees at Meridian, and hire your own team (small, 2-3 people) and build them fast.

**Why you fit:**
You've grown recruiting 175% on a tight timeline, you understand cost and quality in healthcare hiring, and you know how to move fast without breaking things (the ATS migration proves this). You're used to being the trusted operator who solves hard problems without a playbook.

**The real obstacle:**
You've worked in an organization with clear structure, stable processes, and consensus decision-making, and a startup CPO works in ambiguity. Things change weekly, the CEO makes decisions and unmakes them, and compensation gets redesigned mid-year. You'll need to be comfortable with that uncertainty.

**How to know if it's right:**
Ask yourself: do I want to be the architect of something new, or do I want to optimize something existing? If new excites you more than optimization, this path works.

---

## OPTION B: WORKFORCE STRATEGY CONSULTANT

**What you'll spend your time on:**
- 40% active consulting (on-site or virtual with 3-4 clients per year)
- 20% diagnosis and design (what you're best at)
- 15% business development and sales
- 15% admin, invoicing, contract management
- 10% thought leadership and content

**The daily reality:**
You're your own CEO now, with flexibility in who you work with but without the institutional support. You manage feast-and-famine cycles, price engagements, scope them, deliver them, and move to the next one. Success depends on reputation and referral network.

**Why you fit:**
You've solved these exact problems, you understand the customer (health systems), you know what value looks like, and you have a network. You can command premium rates because your work has proven ROI.

**The real obstacle:**
Sales and business development is different from executing inside an organization, and you need to be comfortable with pipeline uncertainty because some weeks you're selling, some weeks you're delivering, and some weeks you're doing both.

**How to know if it's right:**
Ask yourself: am I energized or drained by business development? Do I want the autonomy and flexibility more than I want predictable income and a team? If yes to both, this works.

---

## OPTION C: VP PEOPLE OPERATIONS, HEALTHTECH COMPANY

**What you'll spend your time on:**
- 35% recruiting and hiring (scaling fast, no established process)
- 25% onboarding and enablement (people come in without context, you have to set them up)
- 20% compensation, benefits, and policy
- 15% culture and team building
- 5% business planning with the leadership team

**The daily reality:**
You inherit dysfunction. Founders hired the first 30 people without much system, compensation is all over the place, and people are confused about roles. You come in, diagnose, and rebuild while hiring continues, which is simultaneously exciting and exhausting.

**Why you fit:**
You've been through chaos (COVID, ATS migration, scaling recruiting 175%) and you can keep people operations humming while you redesign it. You understand health tech as both an insider (you know health systems) and an observer (you follow digital health closely).

**The real obstacle:**
Same as the CPO path: startup pace and ambiguity. The difference is scope, because at a smaller company you're doing more operational work and less strategy. At Meridian you had a team; at a healthtech company you might be one person initially.

**How to know if it's right:**
Ask yourself: do I want to operate (do the work) or design (build the system)? If you want both, a healthtech company is right. If you want mostly to design and have others execute, CPO at a larger company is better.

---

**The connector across all three:** you're the person who solves talent problems that have business impact, and the question is what context you want to do that in.`,

// ─── P6: BRIDGE STORY ───────────────────────────────────────────────────

p6: `# YOUR BRIDGE STORY

Three versions of "tell me about yourself" for different contexts and time limits.

---

## 30 SECONDS (Elevator pitch, networking)

I'm a people-strategy leader who specializes in turning talent problems into business results. I spent 14 years building talent and recruiting infrastructure at Meridian Health System, a 14,000-person health system, where I cut clinical hiring costs by 4.2 million dollars, built a referral program that generates 34 percent of hires, and scaled the recruiting team 175 percent during COVID while executing a complex ATS migration. I'm now looking for a Chief People Officer role at a growth-stage digital health company where I can build people infrastructure from the ground up.

---

## 60 SECONDS (Phone screen, first conversation)

I build systems that make hiring and organizational scaling work in the real world. For the past 14 years, I've been the trusted operator behind talent decisions at Meridian Health System, a 14,000-person integrated health system.

I'll give you three examples. First, cost discipline: I cut clinical hiring costs by 4.2 million per year by redesigning our process and building a referral program that now generates 34 percent of our hires. Second, scaling through complexity: I grew the recruiting team 175 percent during COVID while migrating 300 managers to a new ATS without breaking a hiring cycle. Third, conversion: I compressed offer decline from 22 percent down to 9 percent by rethinking how we communicate roles and structure offers.

What ties these together is that most talent problems are process problems, role-clarity problems, or manager-coaching problems wearing a different label. When you diagnose the real problem and design systems that work, business outcomes follow.

I'm now looking for a Chief People Officer role at a growth-stage digital health company where I can take that operational approach and build people infrastructure faster. I understand both sides: the problems health systems face and the operational challenges of scaling a healthtech company.

---

## 90 SECONDS (Formal interview, more context)

I'm a people-strategy leader who specializes in solving talent and organizational problems in ways that drive measurable business results. My background is healthcare operations at scale, and I've spent the last 14 years building talent and people infrastructure at Meridian Health System, a 14,000-person integrated delivery network across multiple locations, reporting to the CHRO.

I focus on problems at the intersection of people strategy and business operations. Let me walk you through the results.

First, cost and efficiency. I identified where money was leaking in our clinical hiring process, designed solutions, and cut costs by 4.2 million per year while improving both speed and quality. Part of that came from building a referral program that now generates 34 percent of hires, which means we're accessing high-quality candidates before they hit the open market.

Second, scaling through complexity. During COVID, I scaled the recruiting team 175 percent while simultaneously managing an enterprise ATS migration for 300 managers, and we moved from legacy Taleo to Workday without missing a hiring cycle. That required systematic thinking about change management, training, and adoption.

Third, conversion and retention. I compressed our offer decline rate from 22 percent down to 9 percent by rethinking the offer experience and how managers engage new hires. When you're hiring 300 people per year, that 13-point improvement saves money, protects culture, and accelerates time-to-productivity.

What all of these projects share is a diagnostic approach: I diagnose what's broken, design the smallest system that fixes it, implement it fast, and iterate. That's what enabled us to move quickly at Meridian while keeping quality high.

I'm now looking to bring that approach to a Chief People Officer role at a growth-stage digital health company, ideally Series B stage, around 150 to 300 employees. I've followed digital health for years because I believe it solves real access and cost problems in healthcare, and I understand both sides: the health system problems these companies are solving and the operational challenges of scaling. I'd partner with your leadership team to build talent strategy and people infrastructure that enables growth without breaking culture.`,

// ─── P7: GO-TO-MARKET ───────────────────────────────────────────────────

p7: `# YOUR GO-TO-MARKET

This is how to reach the people who hire Chief People Officers at digital health companies.

---

## PART 1: THE HIRING EXECUTIVE

**Who you're looking for:**
CEO or COO at a venture-backed digital health company, Series B-C stage (100-300 employees). They're past product-market fit and scaling revenue, but people operations hasn't kept up with growth.

**What they're feeling:**
Hiring is getting slower and they can't explain why, offer acceptance rates are inconsistent, the person handling HR is overwhelmed, and board members are starting to ask about retention metrics and talent risk. They know they need a real CPO but aren't sure when or how to make that hire.

**What they need:**
Someone who can build infrastructure without creating bureaucracy, who understands healthcare well enough that they don't have to explain the market, and who can move fast because they've done this before.

**What they're worried about:**
That you'll slow them down with process, that you'll be too corporate for a startup, and that you won't understand the pace and ambiguity of early-stage companies.

---

## PART 2: TARGET COMPANIES

### Telehealth and Remote Care
Teladoc Health, Ro, LifeStance Health, Talkspace, Sesame, MDLive, Doctor on Demand

### Clinical Decision Support and AI
Tempus, PathAI, Flatiron Health, Veradigm, Turquoise Health

### Health Data and Interoperability
Redox, Truveta, Komodo Health, Health Catalyst

### Healthcare Staffing and Workforce Tech
Shift, CloudHealth, Staffing 360

### Specialty Clinical
Physera, Notable Care, Clarify Health

### Employer Health and Benefits
Catch, Collective, Omada Health

---

## PART 3: OUTREACH

**Email subject line:**
"Scaling talent as you hit 200+ people"

**Email (keep it direct):**

Hi [Name],

I spent 14 years building talent and people infrastructure at Meridian Health System, a 14,000-person health system in Atlanta. I cut clinical hiring costs by 4.2 million and built a referral program that now generates 34 percent of hires. I also lived through the exact scaling challenges you're probably facing now: hiring gets slower, comp gets messy, culture fragments.

I've also been on the other side of health system relationships. I understand what problems digital health companies are trying to solve because I've lived inside the organizations you serve.

I'm exploring a Chief People Officer role at a growth-stage digital health company, and [Company Name] caught my attention because of [specific signal: Series B close, new VP of Engineering, recent clinical hire]. That tells me you're at exactly the stage where professional people operations becomes a competitive advantage.

Would you be open to a 20-minute conversation? No pitch. Just someone who's built on both sides talking about what breaks when you scale from 100 to 300 people.

Best, Sarah

---

## PART 4: LINKEDIN POSITIONING

**Current headline:**
VP Talent Acquisition | Meridian Health System

**Better headline:**
Building talent strategy and people operations at growth-stage companies | Ex-Meridian | Healthcare operator

**Why it works:**
It positions you as someone who builds (future-focused), includes the target role type (talent strategy, people operations), signals your context (growth-stage), establishes credibility (Ex-Meridian), and describes your expertise (healthcare operator).

**About section highlight:**
Lead with the fact that you build people infrastructure that scales. Mention healthcare operations depth. Signal that you're looking for a CPO role. Keep it under 200 words.`,

// ─── P8: LINKEDIN REMIX ─────────────────────────────────────────────────

p8: `# LINKEDIN REMIX

How to position yourself on LinkedIn for a Chief People Officer search.

---

## THREE HEADLINE OPTIONS

**Option 1 (Most searchable):**
Chief People Officer | VP People Operations | Healthcare talent strategy for growth-stage companies

Searches for "Chief People Officer" and "VP People Operations" will find you, "Healthcare talent strategy" signals domain knowledge, and "Growth-stage" signals your target.

**Option 2 (Most human):**
Building talent infrastructure at growth-stage digital health companies | Ex-Meridian, 14 years healthcare operations

Opens with what you do, names your specific target (digital health companies), and uses Meridian to signal healthcare credibility and scale.

**Option 3 (Most proof-oriented):**
Scaled recruiting 175% during COVID, cut hiring costs 4.2M, now building CPO role | Healthcare operations expert

The specific numbers prove you can move and produce results, and it signals you're actively looking for a CPO role.

---

## ABOUT SECTION (200 words)

I build talent and people infrastructure that enables companies to scale without losing culture or financial discipline.

For the past 14 years, I've been the operator behind talent decisions at Meridian Health System, a 14,000-person integrated health system. I focus on problems where people strategy connects directly to business results.

Here's what I've delivered: I cut clinical hiring costs by 4.2 million per year by redesigning our sourcing and building a referral program. That referral program now generates 34 percent of our hires. I scaled the recruiting team 175 percent during COVID while migrating 300 managers to a new ATS without breaking a hiring cycle. I compressed offer decline from 22 percent down to 9 percent by rethinking how we communicate roles and onboard people.

What these projects share is a philosophy: most talent problems are process problems, role-clarity problems, or manager-coaching problems wearing a different label. When you diagnose the real problem and design systems that work for real people, business outcomes follow.

I'm now looking to bring that operational approach to a Chief People Officer role at a growth-stage digital health company. I understand both sides: the health system problems digital health companies are solving and the operational challenges of building people infrastructure through rapid growth.

I'm passionate about healthcare innovation, real estate investing, travel, and mentoring emerging HR leaders.

---

## EXPERIENCE SECTION (Most Recent Role)

**Vice President, Talent Acquisition & Workforce Planning | Meridian Health System | 2014-Present**

- Cut clinical hiring costs by 4.2M annually through process redesign and referral program development (now generates 34% of all hires), while improving time-to-fill and quality of hire
- Scaled recruiting function 175% during COVID while executing enterprise ATS migration (Taleo to Workday) for 300+ managers without losing hiring velocity; designed training and change management frameworks that drove adoption and maintained hiring pace
- Compressed offer decline rate from 22% to 9% by redesigning offer communication, role clarity, and manager engagement protocols; reduced hiring cycle friction and accelerated time-to-productivity for 300+ annual hires
- Partnered with CHRO and CFO on workforce planning strategy supporting 14,000-person organization and $280M healthcare operations across multiple locations
- Built recruiting operations function including hiring metrics, job marketing, recruiting team development, and ATS implementation`,

// ─── P_RES: RESUME REFRESH ──────────────────────────────────────────────

p_res: `# RESUME REFRESH

Repositioned for Chief People Officer role at digital health companies.

---

## PROFESSIONAL SUMMARY

Chief People Officer and talent strategy leader with 14 years of progressive experience building people and recruiting infrastructure at scale in complex, regulated healthcare environments. Proven track record of designing talent strategies and organizational systems that deliver measurable business results: cost reduction, improved quality of hire, faster scaling, and sustained retention. Core competencies include talent strategy, recruiting operations, organizational design, compensation strategy, and change management in regulated, multi-location environments. Known for moving fast without creating bureaucracy, balancing strategic vision with operational execution, and earning trust from boards, executives, and teams.

---

## KEY ACCOMPLISHMENTS

**Cost Architecture:** Designed and executed talent strategy that reduced clinical hiring costs by 4.2M annually while improving time-to-fill and quality of hire. Identified cost drivers (fragmented sourcing, agency dependency, no referral channel) and built integrated solutions that stayed in place.

**Scaling Under Pressure:** Scaled recruiting function 175% during COVID while simultaneously migrating 300+ managers from legacy Taleo to Workday ATS. Maintained hiring velocity without disruption through systematic change management and training frameworks.

**Conversion Engineering:** Redesigned offer experience and candidate communication that compressed offer decline rate from 22% to 9%. Outcome: reduced hiring cycle friction, improved new hire satisfaction, and sustained retention through first 18 months.

**Referral Ecosystem:** Built first systematic referral program from zero to generating 34% of all hires. Created self-sustaining system where employees actively participate because structure, rewards, and ease make it valuable.

**Team Building:** Grew recruiting team from 2 to 6 FTEs while establishing infrastructure, process standards, and sourcing strategy. Built recruiting function that scales and trains.

---

## PROFESSIONAL EXPERIENCE

### Vice President, Talent Acquisition & Workforce Planning
**Meridian Health System, Atlanta, GA | 2014-Present**

- Architected talent strategy and recruiting infrastructure for 14,000-person integrated health system across multiple locations; reduced clinical hiring costs 4.2M annually while maintaining quality and improving time-to-fill through process redesign, referral program development, and total rewards positioning
- Scaled recruiting function 175% during COVID while executing enterprise ATS migration (Taleo to Workday) for 300+ managers without losing hiring velocity; designed and delivered training, change management, and adoption frameworks
- Designed offer experience, role clarity, and manager engagement protocols that compressed offer decline rate from 22% to 9%; outcomes included reduced hiring cycle time and improved new hire productivity and retention
- Led workforce planning and compensation strategy work with executive team and board; supported 280M in healthcare operations and clinical service line staffing models across 20+ locations

### Director, Talent Acquisition
**Meridian Health System | 2011-2014**

- Built recruiting function from 2 to 6 full-time recruiters; established process standards, sourcing strategy, and recruiting infrastructure that enabled scaling from 150 to 300+ annual hires
- Implemented employer brand strategy and career positioning for clinical and administrative roles; improved application volume 40%
- Designed and launched first formal referral program; achieved 28% of hires from referrals within first full year

### Manager, Recruitment & Staffing Operations
**Meridian Health System | 2008-2011**

- Established recruiting operations function including job posting systems, applicant tracking, metrics, and process documentation across 40+ hiring managers
- Led implementation of Taleo ATS; managed training and adoption across recruiting team and hiring managers
- Improved time-to-hire from 65 days to 42 days through process redesign and manager coaching

---

## EDUCATION & CREDENTIALS

MBA, Emory University Goizueta Business School
BS, Human Resources Management, University of Georgia
SHRM-SCP, PHR, Workday HCM Certified

---

## KEY KEYWORDS FOR ATS & SEARCH

Talent Strategy | Chief People Officer | VP People Operations | Talent Acquisition | Recruiting Operations | Workforce Planning | Organizational Design | Compensation Strategy | ATS Implementation | Workday HRIS | Change Management | Healthcare | High-Growth Companies | Team Building | Culture`,

// ─── P9: CRASH COURSE ───────────────────────────────────────────────────

p9: `# YOUR PLAYBOOK

Essential context, tools, and credibility moves for the CPO search.

---

## THE LINGO (10 key terms)

**1. Series B / Series C**
Company funding rounds. Series B is growth capital ($20-100M), Series C is expansion ($50M+). Digital health companies you'd target are typically Series B-C, 18-36 months of runway, 100-300 employees.

**2. Product-Market Fit (PMF)**
When a company's product solves a real problem and customers want to pay for it. Series B companies have PMF. Now they're scaling.

**3. Burn Rate**
Monthly cash spend divided by cash on hand. Directly affects hiring pace. "We have 24 months of runway" means 24 months to get to profitability or next funding.

**4. Board-Approved Headcount Plan**
The hiring plan the board approved. This is your hiring ceiling. Your job is to fill it on time, with quality, at the right cost.

**5. ARR / MRR**
Annual Recurring Revenue and Monthly Recurring Revenue. Key metrics for SaaS and subscription health tech. Growing 20% month-over-month is typical Series B growth.

**6. Total Cost of Hire (TCH)**
Fully-loaded cost to hire one person. Includes recruiter salary, software, bonuses, etc. Healthcare tech companies care about this because margins are tight.

**7. Equity / Strike Price / Vesting**
Standard offer includes salary plus equity. Strike price is your purchase price. Vesting is usually 4 years with 1-year cliff (you get nothing if you leave before year one).

**8. Employee Retention Rate**
Percentage of employees who stay. Early-stage tech averages 75-85% retention. Healthcare is higher (80-90%). You'll own this metric.

**9. Talent Stack**
The quality and diversity of your leadership team. Investors worry if you're "founder-heavy" or lack depth in operations. As CPO, you strengthen this.

**10. Runway**
Months of cash left at current burn rate. "We have 18 months of runway" drives urgency and hiring pace.

---

## THE TECH STACK (three tools you need to know)

**1. Workday**
Enterprise HR platform for hiring, payroll, benefits, reporting. Most venture-backed companies use or are moving to Workday. Complex to implement (3-6 months, expensive). You'll own the relationship.

**2. Lattice or 15Five**
Cloud platform for employee feedback, performance reviews, engagement, learning. Lighter than traditional HR systems. Growth-stage companies use these to build culture without bureaucracy.

**3. LinkedIn Recruiter**
Sourcing platform for passive candidates. Essential for recruiting at any scale. Costs $3-10K per recruiter per year. Table-stakes tool.

---

## THOUGHT LEADERS TO FOLLOW

**April Dunford** — Positioning and strategy. Her frameworks apply to employer brand: how does your company differ as an employer?

**Laszlo Bock** — Former CHRO at Google. "Work Rules" is the playbook for scaling culture without losing it.

**Satya Nadella and Sundar Pichai** — CEO-level thinking on culture and organizational design. Watch how they talk about talent.

---

## FASTEST CREDIBILITY MOVE (7 days)

**Write and publish a 600-word LinkedIn article on a specific problem you've solved.**

Title ideas:
- "What breaks in recruiting when you scale from 100 to 300 people (and how to fix it)"
- "Why your offer acceptance rate matters more than you think"
- "Three hiring mistakes I see growth-stage companies make"

Write from your Meridian experience, translate to digital health context. Post it. Seed 3-4 comments from your network. Do this in week 1 of your search.

**Why this works:** It proves you can think and articulate clearly. It shows you understand both healthcare and growth-stage challenges. It gives prospects something to read that says "this person gets it."`,

// ─── P10: DEVIL'S ADVOCATE ──────────────────────────────────────────────

p10: `# THE TOUGHEST QUESTION

The legitimate concern hiring managers will raise.

---

## THE HARD QUESTION

"You've spent 14 years in a large, regulated, stable healthcare organization. Meridian is hierarchical, process-driven, and slow-moving. A growth-stage digital health company is the opposite. We move fast, we change our minds, we hire without perfect process, and we're fundraising constantly. How do I know you won't slow us down with too much process?"

This is a fair question, and it deserves a direct answer.

---

## THE RESPONSE

I have no interest in building a healthcare-style HR function at a startup, because that would be the wrong approach and would slow you down.

What I learned at Meridian is that well-designed process makes you faster, and bad process or no process is what slows you down. The difference is entirely in how you design it.

The Taleo-to-Workday migration is a good example. I could have built a 12-month implementation where every manager had to master the new system, but instead I designed it for speed and clarity: start with hiring and onboarding, train managers for 2 hours instead of 20, build guardrails so they can't break it, and give them autonomy to move fast. We completed it in eight weeks with zero hiring disruption, which is exactly the pace a startup needs.

Same with the cost reduction work during COVID. I diagnosed where money was leaking (fragmented sourcing, no referral program, agencies doing work we could do), designed experiments, and scaled what worked. No committees, no approval chains, just clarity about the problem and discipline about the solution.

I would never build compliance theater or create 5-person hiring committees when you need to move fast or require weeks of onboarding curriculum when a good first week plus embedded context works better. What I would do is identify which chaos is costing you money or people, because there are usually 3-4 real problems (sourcing, offer communication, onboarding ownership), and then design the smallest system that fixes each one, implement fast, measure, and iterate. During COVID at Meridian we grew recruiting 175% in six months, and the reason we could move that fast is that we had a plan, a system, and clear roles.

That's what a growth-stage company needs: clarity about which problems to solve first and the discipline to solve them without overbuilding.

---

## PRACTICE SAYING THIS

"I identify which chaos is costing you money and which is just part of being early-stage, and then I design the smallest system that fixes the real problem. The Taleo migration at Meridian is the example: 300 managers, eight weeks, no disruption, because we designed for speed rather than perfection."

Practice this until it feels natural. Hiring managers are watching to see whether you're defensive or whether you understand the difference between good and bad process, and the specific example is what makes the answer credible.`,

// ─── INCOME: INCOME WHILE PURSUING ──────────────────────────────────────

income: `# INCOME: Income While Pursuing CPO Role
## Building a Consulting and Fractional Practice

---

## PART 1: WHERE TO SHOW UP (4-6 platforms)

**1. LinkedIn (Daily presence)**
Your primary platform. Share insights 2x per week, comment thoughtfully, engage with your network. Builds visibility with hiring managers and consulting prospects.

**2. SHRM (Society for Human Resource Management)**
Join, attend 2-3 events per quarter, volunteer to lead a learning group or speak. Position yourself as the expert on scaling talent in growth companies.

**3. Healthcare Leadership Association (ACHE or regional equivalent)**
Join as an Individual member, engage with the Atlanta chapter, consider presenting on talent strategy or organizational scaling.

**4. Guidepoint (Expert network)**
Register as an expert. Receive calls from investment firms and healthcare companies at $200-400 per call. 1-2 calls per month = $7,200/year passive income.

**5. Medium or Substack (Thought leadership)**
Publish 2x per month (500-800 words). Builds credible authority and gives prospects something to read before hiring you.

**6. Local Atlanta CEO roundtables and business groups**
Aim for 1-2 memberships where you attend monthly. Direct access to business leaders who hire consultants.

---

## PART 2: CONSULTING PRESENCE

**Professional Headline:**
"Scaling Talent and Culture | Chief People Officer Advisor | Former VP Talent Acquisition, Meridian Health System"

**Bio (150 words):**
I help growth-stage companies and health systems solve talent challenges that slow them down. For 14 years, I built talent and people infrastructure at scale, cutting hiring costs, designing recruiting systems, and building cultures that hold up through 175% growth. Now I work with leadership teams on specific problems: scaling recruiting, designing offer and onboarding experiences, building compensation strategies, and organizing people functions for rapid growth. I specialize in healthcare organizations and digital health companies.

---

## PART 3: CONSULTING OFFERINGS WITH PRICING

**Offering 1: Hiring System Audit & Redesign**
*"Why Your Hiring is Slow (And How to Fix It)"*
Scope: 20-25 hours | Price: $8,000-12,000

**Offering 2: Compensation & Total Rewards Strategy**
*"Why Your Comp is Messy (And Why It Matters)"*
Scope: 25-30 hours | Price: $10,000-15,000

**Offering 3: Build Your People Operations Function**
*"From Founder HR to Real People Ops"*
Scope: 40-50 hours | Price: $15,000-25,000

**Offering 4: Executive Coaching (Quarterly)**
*"Leadership Coaching for Scaling CEOs & Executives"*
Scope: 4 hours/month | Price: $3,500-5,000/quarter

---

## PART 4: PASSION-ADJACENT OPPORTUNITIES

**1. Healthcare Innovation Advisory** — Advise 3-4 early-stage companies. $500-1,000/month per company.

**2. Adjunct Faculty / Guest Lecturer** — Emory, Georgia Tech, or UGA. $5,000-15,000/semester.

**3. Real Estate Investing Advisory** — Fractional advisory to real estate syndications or healthcare real estate funds. $2,000-5,000 per deal review.

---

## PART 5: THE ONE SHEET

**Header:** Sarah Chen | Chief People Officer | Scaling talent and culture in growth-stage healthcare companies

**Problem I Solve:** Growth-stage companies hit three talent problems: hiring becomes slow and expensive, compensation gets messy, and people leave because they're not set up to win.

**How I Help:** I run diagnostics, design the smallest system that fixes it, and implement it fast. 14 years of building talent operations at scale in a 14,000-person health system.

**What Happens:** 2-3 hour assessment → identify top 2-3 problems → design and implement over 4-8 weeks. Most projects: 20-50 hours, $8,000-25,000.

---

## PART 6: FIRST WEEK LAUNCH

**Day 1:**
- Update LinkedIn headline and About section
- Register with Guidepoint and GLG
- Email 10 key contacts: "I'm exploring consulting and CPO opportunities. Let's talk."

**Day 2:**
- Join SHRM Atlanta and ACHE (if not already member)
- Draft one Substack/Medium article on a problem you've solved
- Research 3 local CEO networks or roundtables

**Day 3:**
- Publish article
- Attend one networking event or CEO roundtable meeting
- Reach out to 5 consulting prospects with one-pager

**Days 4-7:**
- Take first consulting call (aim for week 1)
- Draft 2-3 project proposals for prospects
- Set up business email and simple website (1-pager)
- Block 5-10 hours per week for business development

**Result:** First consulting project started by week 3, income generated, and visibility maintained for CPO opportunities.`

};
