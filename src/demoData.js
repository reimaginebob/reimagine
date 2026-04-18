// demoData.js — Static demo content for Reimagine ?demo=true mode
// Persona: Sarah Chen, VP Talent Acquisition, Meridian Health System
// Update this file when new modules are added to the app.

export const demoProfile = {
  loc: {
    country: "United States",
    city: "Atlanta, GA",
    work: "Open to relocation for the right opportunity; prefer Southeast or remote"
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

p1: `# YOUR FUNCTIONAL IDENTITY

## THE TWO-WORD HANDLE
**Trusted Architect**

You build the systems other people depend on. Not the flashy, visible kind — the structural kind. The kind where, six months later, someone says "hiring just works now" and can't quite remember who made it work. You did.

---

## HERO CHIPS — What You're Known For

**1. Cost Architecture**
You cut $4.2M in clinical hiring costs not by slashing budgets but by redesigning how money moved through the system. You found the leaks (fragmented sourcing, over-reliance on agencies, a referral program that didn't exist) and built structures that redirected spend toward outcomes. This is rare. Most HR leaders manage costs. You engineered them.

**2. Scaling Under Pressure**
You grew the recruiting function 175% during COVID — a period when healthcare hiring was simultaneously the most critical and most chaotic it has ever been. You did this while migrating 300 managers to a new ATS. That combination of velocity and complexity is your signature.

**3. Conversion Engineering**
Offer decline from 22% to 9%. That's not a "people" fix. That's a systems fix — you redesigned the offer experience, role clarity, and manager engagement at every touchpoint. You treated the hiring funnel the way a product team treats a conversion funnel. Most HR leaders don't think this way. You do.

**4. Referral Ecosystem Design**
34% of hires from referrals. You didn't just launch a referral program — you built a self-sustaining ecosystem where employees actively participate in hiring because the system rewards, recognizes, and makes it easy. This is infrastructure, not a campaign.

**5. Enterprise Migration Leadership**
Taleo to Workday for 300+ managers without losing hiring velocity. This is change management at scale, compressed into a tight timeline. You designed training, managed resistance, built adoption frameworks, and kept the business running. Most migrations create chaos. Yours didn't.

---

## CLIFTONSTRENGTHS TRANSLATION

Your top 5 — Achiever, Arranger, Strategic, Relator, Responsibility — form a specific pattern. Here's what it means in practice:

**Achiever + Responsibility = Relentless Delivery**
You don't just start projects. You finish them. You hold yourself to internal standards that are often higher than what's asked of you. People trust you because when you say "I'll handle it," it's handled.

**Arranger + Strategic = Systems Thinking**
You see how pieces fit together before anyone else does. When a problem has 12 moving parts, you're already optimizing the configuration. This is why you're drawn to process design and infrastructure — you see the pattern, then you build for it.

**Relator = Trust-Based Influence**
Your influence doesn't come from title. It comes from deep, earned relationships. People come to you because you've invested in understanding their problems, and you deliver when it counts. This is your competitive advantage in any role that requires cross-functional partnership.

---

## PEDIGREE SNAPSHOT

- **14 years progressive healthcare HR leadership** at a single, complex organization — this signals loyalty, depth, and the ability to grow within institutional constraints
- **MBA, Emory Goizueta** — top-tier business school credential that signals strategic thinking beyond HR
- **SHRM-SCP + PHR** — professional HR certifications showing commitment to the craft
- **Workday HCM Certified** — technical depth in the dominant enterprise HR platform

---

## AI-FLUENT OPERATOR

You're not a technologist, but you understand how technology serves people operations. Your Workday migration, ATS implementation experience, and comfort with data-driven decision making position you as someone who can evaluate, implement, and optimize HR technology without being dependent on IT. In a market where AI is reshaping recruiting, screening, and workforce planning, your combination of operational depth and systems thinking makes you credible in conversations about AI-enabled people operations.`,

// ─── P2: ASSESSMENT DEEP DIVE ───────────────────────────────────────────

p2: `# YOUR ASSESSMENT — DECODED

## STRENGTHS OPERATING SYSTEM

Your CliftonStrengths profile isn't just a list of traits. It's an operating system — a predictable pattern of how you think, decide, and deliver. Here's how yours actually works:

---

### THE ENGINE: Achiever + Responsibility

This pair is your baseline. Every day, you wake up with an internal scoreboard. You need to accomplish something tangible. "Responsibility" means that when you commit, it becomes a personal contract — breaking it isn't just a professional failure, it feels like a character failure.

**What this looks like in practice:**
- You volunteer for the hard assignments because leaving them undone feels worse than doing them
- You over-deliver consistently, which builds trust but also means you sometimes absorb work others should own
- You have a hard time delegating to people who don't share your standards — not because you're controlling, but because unfinished or sloppy work creates genuine discomfort for you

**The risk:** Burnout. You will push through exhaustion because your Achiever doesn't have an off switch. In a new role, especially a startup CPO role, this means you need to be intentional about what you own versus what you delegate, or you'll become a bottleneck.

---

### THE PROCESSOR: Arranger + Strategic

This is your thinking engine. When a problem shows up, here's what happens in your brain:

1. **Strategic** maps the options — you see 3-4 possible paths almost immediately
2. **Arranger** evaluates configurations — you mentally test which combination of people, resources, and sequence produces the best outcome
3. You arrive at a recommendation faster than most people even frame the problem

**What this looks like in practice:**
- In meetings, you're often 2-3 steps ahead of the conversation — this can make you impatient
- You redesign processes instinctively — when you see inefficiency, you can't unsee it
- You're the person who says "here's what we should actually do" and is usually right
- You get frustrated with organizations that value consensus over speed

**In the CPO search:** This is your killer app. Digital health companies at Series B-C have messy people operations. They need someone who can walk in, see the 3-4 things that are actually broken, and design fixes fast. Your Arranger + Strategic combination means you'll diagnose faster and design better than most candidates.

---

### THE CONNECTOR: Relator

Relator is your relationship currency. You don't network — you invest. You build deep, trust-based relationships with a smaller number of people, and those relationships compound over time.

**What this looks like in practice:**
- Your CHRO trusted you with the biggest projects because you'd earned that trust through years of delivery
- People come to you with their real problems, not just the official ones
- Your referral program works because people trust you enough to put their own reputation on the line by referring candidates
- You'll have an easier time earning trust with a CEO at a 200-person company than many candidates, because your Relator means you'll listen first, build rapport, and then advise

**The risk:** Relator means you invest deeply in fewer relationships. In a new organization, you may need to build trust faster and wider than you're used to. Startups require you to earn credibility with 8-10 people in your first 30 days, not 2-3 over 6 months.

---

## SUPPORTING STRENGTHS — THE BENCH

Your 6-10 strengths (Learner, Individualization, Communication, Activator, Futuristic) add important texture:

- **Learner** — You're driven to master new domains. This is critical for moving into digital health from traditional healthcare. You'll invest in understanding the new context deeply.
- **Individualization** — You see people as individuals, not categories. This makes you excellent at matching people to roles and coaching leaders on their specific challenges.
- **Communication** — You can translate complex ideas into clear, direct language. This matters enormously as a CPO presenting to boards and investors.
- **Activator** — You don't just plan. You start. This balances your Strategic strength and prevents analysis paralysis.
- **Futuristic** — You think about where things are going, not just where they are. Combined with Strategic, this makes you a long-range planner who also executes today.

---

## YOUR ASSESSMENT STORY (For Interviews)

When someone asks "Tell me about your strengths," don't list Achiever, Arranger, Strategic. Instead, tell this story:

"My operating pattern is: I see how systems should work, I build them, and I make sure they deliver. At Meridian, that looked like redesigning a hiring process that saved $4.2M, building a referral ecosystem that generates a third of our hires, and migrating 300 managers to a new ATS during the most chaotic hiring environment in healthcare history. I do this because I'm wired to see configuration problems and solve them — and because once I commit to a result, I don't stop until it's delivered."

This translates your assessment into a performance narrative. It shows how you think without sounding like you're reading a personality report.`,

// ─── P3: VALUES + PASSIONS SYNTHESIS ────────────────────────────────────

p3: `# VALUES + PASSIONS — YOUR COMPASS

## WHAT ACTUALLY DRIVES YOU

Your values and passions aren't decorative. They're decision filters. Here's how they shape where you should go next — and what you should avoid.

---

### VALUE 1: IMPACT
**What it means for your search:**
You need to see results. Not "we improved the process" results — "$4.2M saved" results. "Offer decline cut by 13 points" results. You measure yourself by outcomes, and you'll be miserable in a role where success is defined by activity rather than impact.

**Filter:** Any role where your impact will be invisible or unmeasurable is wrong for you. This eliminates: large bureaucratic HR functions where you're one of 12 VPs, consulting firms where you advise but don't implement, organizations that measure HR success by compliance rather than business outcomes.

**Best fit:** Roles where the People function is directly tied to business performance — CPO at a growth-stage company, fractional CPO where you own client outcomes, or consulting with implementation (not just advisory).

---

### VALUE 2: TRUST
**What it means for your search:**
Trust is your operating currency. You've built your career on being the person people come to when something needs to work. You need an environment where trust is earned through delivery, not politics.

**Filter:** Avoid organizations with heavy political cultures, frequent leadership turnover, or environments where trust is performative. You'll know it when you see it: if the interview process feels political or performative, the culture will be too.

**Best fit:** Founder-led companies where the CEO values directness, organizations with a track record of empowering leaders, or independent work where trust is between you and your clients.

---

### VALUE 3: GROWTH
**What it means for your search:**
You're a Learner (CliftonStrengths #6). You need intellectual challenge. The moment a role becomes repetitive, you'll start looking around.

**Filter:** Avoid roles that are pure maintenance — "keep the HR function running." You need a building mandate: build the function, design the systems, solve new problems.

**Best fit:** Growth-stage companies where the people function is being built for the first time. Consulting, where every client brings a new problem. Or a CPO role at a company entering a new market, launching new products, or scaling into new geographies.

---

### VALUE 4: AUTONOMY
**What it means for your search:**
You do your best work when you own the problem end-to-end. "Give me the problem and the guardrails, and I'll figure out the rest." This is a signature of your Arranger + Strategic combination — you need room to configure solutions your way.

**Filter:** Avoid roles with heavy oversight, rigid processes, or organizations where the CEO micromanages the People function. In interviews, ask: "How much autonomy does the CPO have to design and implement people strategy?"

**Best fit:** CPO roles where the CEO says "I need someone to own this" rather than "I need someone to execute my vision for HR." Also, independent consulting, where you are the autonomous operator by design.

---

### VALUE 5: PEOPLE
**What it means for your search:**
You care about setting people up to do their best work. This isn't soft — it's structural. You see people challenges as design problems, and you solve them with systems, coaching, and clarity.

**Filter:** Avoid organizations that treat HR as a cost center or compliance function. You need a leadership team that believes people strategy is a business strategy.

**Best fit:** Mission-driven organizations (healthcare, digital health, education) where people operations directly enables the mission. Companies where the CEO talks about culture as a competitive advantage, not a nice-to-have.

---

## PASSION ALIGNMENT MAP

| Passion | How It Connects to Your Career Direction |
|---|---|
| Healthcare innovation | Digital health CPO role puts you at the center of healthcare innovation. You'd be building the people infrastructure that enables companies to solve real healthcare problems. |
| Organizational psychology | CPO role is applied organizational psychology. You're designing culture, feedback systems, team structures, and leadership development — the topics you read about for fun. |
| Real estate investing | Financial independence from real estate gives you freedom to take career risks. You can choose a role for fit, not just compensation. This is a strategic advantage. |
| Travel | Growth-stage companies often offer more flexibility than large health systems. Remote-friendly cultures, flexible PTO, and less rigid schedules align with this passion. |
| Mentoring | As CPO, you'll mentor the entire leadership team on people decisions. At a growth-stage company, you'll also develop emerging HR talent on your team. This passion becomes your daily work. |

---

## THE COMPASS SUMMARY

Your values + passions point clearly toward a specific kind of role:

**Build something that matters, with people who trust you, in a context where you're learning and growing, with the autonomy to design solutions your way, in service of a mission that connects to healthcare innovation.**

That's not aspirational. That's operational. Use it to evaluate every opportunity: Does this role give me impact, trust, growth, autonomy, and meaningful people work? If the answer is "yes to all five," pursue aggressively. If the answer is "yes to three," investigate further. If the answer is "yes to two or fewer," pass.`,

// ─── P4: THE WIDE VIEW ──────────────────────────────────────────────────

p4: `# P4: THE WIDE VIEW — Opportunity Landscape

## LANE 3: REINVENTION (Ikigai: Skills + Passion + Market Need + Compensation)

**1. Chief People Officer, Digital Health Company**
*Role.* Chief People Officer, VP People Operations
*Vehicle:* W-2, fully employed
*Rationale:* You've built HR infrastructure at scale in healthcare. Digital health companies with 200-500 employees need exactly what you've proven: the ability to design talent and organizational systems that work through hyper-growth. Your cost-reduction work translates directly to their margin pressure. This keeps you in healthcare innovation, builds equity upside, and positions you for board seats over time.

**2. Fractional Chief People Officer (Healthcare Portfolio)**
*Role:* Fractional CPO, Chief Operating Officer (Human Capital)
*Vehicle:* Fractional, self-employed (3-4 clients)
*Rationale:* Healthcare organizations and health-adjacent companies often need C-level HR strategy without full-time investment. You could work 2 days/week with 3-4 clients at $300-400/hour, earning $300-400K while maintaining autonomy and picking clients aligned with your values. This model suits your interest in real estate investing and family time.

**3. Founder: Workforce Optimization for Health Systems**
*Role:* CEO/Founder
*Vehicle:* Entrepreneurship (venture-backed or bootstrapped)
*Rationale:* You've identified where health systems bleed money in talent: fragmented hiring, low referral conversion, offer decline management. You could build software or services to solve these problems. Your operational credibility means pilots at your network of 20+ hospital systems. Initial revenue possible from consulting before venture funding.

**4. Head of Talent Strategy, Healthcare Venture Capital**
*Role:* Operating Partner, Growth Advisor
*Vehicle:* W-2, venture partnership
*Rationale:* You understand healthcare operations and talent scaling. Healthcare-focused VCs (Bessemer, Khosla, Lowerbound) hire people like you to add value to portfolio companies. This position blends strategy work, mentoring founders, and access to deal flow. Salary $180-220K, but 0.5-1% equity across 8-12 companies compounds substantially over 5-7 years.

**5. Vice President, Talent Solutions, Healthcare Staffing/PEO**
*Role:* VP Talent, VP Product (Healthcare)
*Vehicle:* W-2, fully employed
*Rationale:* Companies like Insperity, Justworks, or Slack (healthcare market) are scaling talent services to hospital systems. They need someone who understands both the supply side (hiring operations) and the customer problem deeply. You'd own go-to-market for healthcare vertical. Salary $180-220K, path to EVP in 4 years.

**6. Consultant + Adjunct Faculty, Healthcare Leadership**
*Role:* Management Consultant, Lecturer/Senior Fellow
*Vehicle:* Hybrid (consulting + academia)
*Rationale:* You have a unique voice on organizational scaling and healthcare talent. Emory (nearby), Rollins School of Public Health, or University of Georgia could offer adjunct faculty role ($10-20K/year) while you consult on major health system transformations ($150-200K/year). This builds intellectual capital and keeps you connected to research and emerging talent trends.

**7. Executive Coach, Organizational Development Specialist**
*Role:* Executive Coach (healthcare focus), Senior Consultant
*Vehicle:* Self-employed (practice-building)
*Rationale:* Healthcare executives often struggle with scaling teams and delegation. Your track record and people orientation position you well as a coach or senior OD practitioner. Entry earning potential $150-250/hour after IC Coaching or equivalent certification. Could reach $250-350K with a strong referral base. Passion alignment with mentorship and psychological frameworks.

**8. Director of Workforce Innovation, State or National Healthcare Association**
*Role:* Senior Director, Workforce Policy
*Vehicle:* W-2, nonprofit/association
*Rationale:* Organizations like the American Hospital Association, AAFP, or state hospital associations are expanding workforce programs. They need someone who can translate real operational experience into policy and programming. Salary $140-170K, federal benefits, mission alignment around healthcare access. Less lucrative but high impact and built-in authority.

---

## LANE 2: ECOSYSTEM PIVOT (Start with Adjacency Map, Then Specific Options)

Your ecosystem spans:
- **Upstream:** Recruiting firms, staffing agencies, HR consulting (Mercer, Willis Towers Watson, Deloitte consulting), ATS vendors (Workday, Taleo), HRIS vendors
- **Downstream:** Healthcare delivery organizations, independent practices, health plans
- **Adjacent:** Healthcare IT companies, digital health startups, health-adjacent nonprofits
- **Communities:** SHRM, HR leadership groups, healthcare associations, boards
- **Educators:** Universities (business schools, public health, healthcare admin), leadership development firms
- **Regulators/Enablers:** CMS, state health departments, accreditation bodies

**1. Vice President, Healthcare Solutions, Major Recruiting Firm**
*Org Type:* National recruiting/staffing firm
*Vehicle:* W-2, fully employed
*Rationale:* Firms like Kforce, Apex Group, or healthcare-specialized recruiters need to understand health system hiring from the employer side. Your empathy advantage: you've been the buyer. You know what works, what kills deals, and where recruiters create friction.

**2. VP Product, Human Capital Management Platform**
*Org Type:* SaaS/Software (HRIS, ATS, learning)
*Vehicle:* W-2, fully employed
*Rationale:* Workday, BambooHR, Lattice, or healthcare-specific platforms need product leaders who've lived in the trenches of HR operations. Your empathy advantage: you did the Taleo-to-Workday migration. You know exactly where implementations break.

**3. Founding Partner, Healthcare HR Consulting Practice**
*Org Type:* Boutique consulting firm
*Vehicle:* Partnership
*Rationale:* Join or launch a 5-10 person consulting practice focused on health system transformation. Your empathy advantage: you've done everything they'll advise on. Partner compensation: $150-250K salary plus profit share.

**4. Senior Director, Talent Solutions, Healthcare Consulting Firm**
*Org Type:* Tier-1 consulting firm (Deloitte, Mercer, Bain, McKinsey)
*Vehicle:* W-2, fully employed
*Rationale:* Management consulting firms have healthcare and "people strategy" sub-practices. They value operating experience. Salary $180-220K plus bonus plus partnership trajectory.

**5. Head of Sales, Healthcare + HR Tech Company**
*Org Type:* SaaS (health IT, recruiting tech, learning tech)
*Vehicle:* W-2, fully employed
*Rationale:* Healthcare tech startups solving recruiting or HR problems need sales leaders who've bought from them. Salary $150-180K plus uncapped commission.

**6. Chief Operating Officer, Healthcare Staffing Company**
*Org Type:* Staffing/workforce solutions firm
*Vehicle:* W-2, fully employed
*Rationale:* Health system labor challenges have created opportunities for staffing firms. You understand both supply and demand. COO scaling 200+ employees and $50-200M revenue.

**7. Advisor/Strategic Investor, Healthcare Venture Fund**
*Org Type:* Venture fund or angel network
*Vehicle:* Advisory role + investment
*Rationale:* Healthcare-focused angel networks want operator-advisors who understand health system challenges. Earn $5-15K per advisory seat on 3-4 company boards.

**8. Executive Director, Workforce Development Program**
*Org Type:* Nonprofit, foundation, or hospital association
*Vehicle:* W-2, nonprofit leadership
*Rationale:* Organizations like medical student debt funds or workforce development nonprofits need leaders who understand health system hiring. Salary $130-160K, mission focus.

**9. Chief People Officer, Regional Health System or IDN**
*Org Type:* Healthcare delivery (hospital, health system, insurance)
*Vehicle:* W-2, fully employed
*Rationale:* Mid-market and regional health systems (250-8,000 employees) often lack senior HR leadership with your depth. Salary $140-180K, clear path to CHRO.

**10. Membership Director or Senior Advisor, Healthcare Leadership Association**
*Org Type:* Professional association
*Vehicle:* W-2 or advisory
*Rationale:* Professional organizations (ACHE, MGMA, AAFP) have membership and community programs. Salary $110-150K, significant speaking and thought leadership platform.

---

## LANE 1: UPGRADE (Modernize Your Core Function)

**What has changed in talent acquisition in the last 3 years:**
1. Shift from pure volume recruiting to talent strategy (total rewards, retention, internal mobility)
2. Rise of AI-assisted screening, reducing manual sourcing burden but increasing strategy complexity
3. Tightness in clinical labor markets driving need for total cost-of-hire analytics
4. Regulatory pressure: non-competes, wage transparency, benefits equity
5. Employee experience expectations (healthcare workers comparing total package to market every 90 days)

**Lane 1 Options: Upgraded Talent Acquisition Roles**

**1. Senior Vice President, Talent Acquisition + Retention**
*What Changed:* Talent acquisition + talent management merged. You'd own hiring to 18-month retention.
*Credential Priority:* Strategic workforce planning (highest impact), Total rewards, Employee retention analytics, Workday deep expertise.

**2. Chief Talent Officer, Health System or Integrated Delivery Network**
*What Changed:* This title now includes supply chain for labor. You'd own talent strategy for 10,000+ employees across 20+ locations.
*Credential Priority:* Health system P&L basics (highest impact), Integrated workforce planning, Scenario modeling.

**3. Senior Vice President, People Operations**
*What Changed:* People Ops now means data-driven talent strategy: predictive attrition, compensation analytics, org design.
*Credential Priority:* People analytics/data literacy (highest impact), Organization design, Compensation strategy.

**4. Vice President, Talent + Culture Strategy**
*What Changed:* Culture is now a competitive advantage in clinical hiring.
*Credential Priority:* Organizational culture assessment (highest impact), Employer brand development, Engagement design.

**5. Director, Strategic Workforce Planning**
*What Changed:* Workforce planning is now linked to financial planning and clinical service line strategy.
*Credential Priority:* Healthcare financial modeling (highest impact), Scenario planning and forecasting.

**6. Chief People Officer, Virtual/Hybrid-First Health Organization**
*What Changed:* As health systems build virtual care, people strategy has to change.
*Credential Priority:* Virtual/hybrid talent strategy (highest impact), Remote team dynamics, Digital employee experience.`,

// ─── P5: THE DEEP DIVE ──────────────────────────────────────────────────

p5: `# P5: THE DEEP DIVE — Three Selected Options

## OPTION A: Chief People Officer, Digital Health Company

### REALITY CHECK

**What this role is actually called:**
- Chief People Officer (CPO)
- VP People Operations
- Chief Human Resources Officer (early-stage)
- Head of Culture and People

**What the job description says:**
- Own all people strategy, HR operations, compensation, culture, and organizational design for a high-growth company
- Build HR infrastructure from 200 to 500+ employees
- Partner with CEO and executive team on organizational design, compensation strategy, and culture initiatives
- Lead recruitment, onboarding, and retention efforts across engineering, clinical, commercial, and operations
- Manage benefits, compliance, and people analytics

**What you will actually spend your time on:**
*Problems you'll face:* Founders who think "people strategy" is a luxury until you show how it impacts retention and scaling. Talent wars with health systems and big tech for the same engineers and clinical talent. Equity/compensation complexity. Culture ambiguity when you're adding 50 people in 12 months.

*Who you're talking to daily:* CEO, COO, CFO (constantly discussing comp and headcount). Clinical leadership who care about clinical hiring. Engineering leadership who want to build, not do onboarding. Sales and CS teams burning out.

*Where time goes:* 30% recruiting and hiring process design. 25% solving retention crises. 20% board and investor preparation. 15% benefits, compliance, policy. 10% culture initiatives.

*Success in 90 days:* Documented talent philosophy the CEO and board endorse. Closed 8-12 critical hires. Diagnosed top 3 people problems. Put in place comp strategy and benefits plan.

*Hardest part:* Founders who are amazing domain experts but terrible at feedback and delegation. They hire the wrong people, don't coach them, then blame you when they leave.

**What they are really looking for:**
- Someone who won't slow them down: build infrastructure without creating bureaucracy
- Credibility in healthcare: you've been inside a 14,000-person health system
- Financial discipline: you've cut clinical hiring costs by $4.2M/year

---

### WHY YOU FIT

**1. You've scaled the function at pace**
You grew the TA team 175% during COVID while hiring 300+ people into a new ATS. You know what breaks in onboarding at scale.

**2. You've proven financial impact in healthcare specifically**
"I cut hiring costs $4.2M while improving time-to-fill" resonates. You're not speaking theoretical HR.

**3. You know how to survive institutional complexity while shipping fast**
You designed a Taleo-to-Workday migration for 300+ managers without losing hiring velocity.

**4. You understand that people decisions have ROI**
You compressed offer decline from 22% to 9%. That's a business outcome.

---

### THE HONEST BRIEF

**The pivot in two sentences:**
Your core strength is turning people-and-process problems into measured business outcomes. A digital health company at 200-400 employees faces identical problems at a different scale.

**The one real obstacle:**
You've led in a highly regulated, stable organization. A startup will feel like organized chaos by comparison.

**The fastest path to close it:**
Get 2-3 conversations with current CPOs at venture-backed digital health companies (Ro, Talkspace, Headspace Health). Ask them: "What surprised you most about moving from a regulated org to a startup?"

---

## OPTION B: Workforce Strategy Consultant (Independent)

### REALITY CHECK

**What this role is actually called:**
- Independent Consultant, Workforce Strategy
- Fractional Chief People Officer
- HR Advisor, Talent Strategy
- Strategic Talent Consultant

**What you will actually spend your time on:**
*Problems you'll face:* Feast and famine cycles. Sales is now your job (15-20% of time on business development). Clients who define scope poorly. Scope creep.

*Where time goes:* 40% active client work. 20% delivery. 15% business development. 15% admin. 10% learning and thought leadership.

*Hardest part:* When a client won't follow your advice and blames you for outcomes. Or 40 hours on a proposal for a prospect who ghosts you.

---

### WHY YOU FIT

**1. Proven track record solving the exact problems consultants are hired to solve**
Cost reduction, retention, capability building during transitions — you've done all three.

**2. You understand the health system customer from the inside**
Most consultants are outsiders. You've been the CHRO's trusted partner.

**3. You have a network to seed your practice**
Dozens of leaders across health system operations, many now at other organizations.

**4. Financial discipline and ROI thinking**
You'll price at value, not hours. You'll structure engagements around specific outcomes.

---

### THE HONEST BRIEF

**The pivot in two sentences:**
You've proven you can solve talent strategy problems at scale. As an independent consultant, you're doing the same work for 4-6 different health systems per year.

**The one real obstacle:**
You need to be comfortable with sales and business development.

**The fastest path to close it:**
Start part-time. Take on 1-2 small projects while staying employed.

---

## OPTION C: VP People Operations, High-Growth Healthtech Company

### REALITY CHECK

**What this role is actually called:**
- VP People Operations (or VP People)
- Chief People Officer (at smaller organizations)
- VP Talent and Operations

**What you will actually spend your time on:**
*Problems you'll face:* You're one of the first "real" people people at the company. Founders made hiring decisions on gut feel. Compensation is all over the place. You're fighting two battles: scaling hiring while cleaning up old dysfunction.

*Where time goes:* 35% recruiting and hiring. 25% onboarding and enablement. 20% compensation and benefits. 15% culture and operations. 5% business planning.

*Hardest part:* The scaling never stops. Just when onboarding runs smoothly, you're hiring 20 in a month.

---

### WHY YOU FIT

**1. You've scaled recruiting operations at high velocity**
You systematized, scaled, and delivered 300+ hires in a tight market.

**2. You've been the trusted operator for a CHRO**
"I don't know how you did that, but you just saved this organization."

**3. You understand both the business and the people side**
You know costs, margins, workforce planning, and P&L.

**4. Practical experience with ATS, compensation, benefits, and systems**
You did the Taleo-to-Workday migration. You've built compensation models.

---

### THE HONEST BRIEF

**The pivot in two sentences:**
You've led the People function at a 14,000-person organization. At a healthtech company (80-200 people), you'd have fewer constraints, more flexibility, and the chance to build culture from the start.

**The one real obstacle:**
A growth-stage healthtech company will feel chaotic compared to Meridian.

**The fastest path to close it:**
Talk to 2-3 VPs of People at healthtech companies. Then take a fractional project to test the pace.`,

// ─── P6: BRIDGE STORY ───────────────────────────────────────────────────

p6: `# P6: BRIDGE STORY — Tell Me About Yourself

**Chosen path:** Chief People Officer at a digital health company

---

## [30 SECONDS]

I'm a senior people-strategy leader who specializes in turning complicated talent and organizational problems into measurable business outcomes. Over 14 years, I've built talent and HR infrastructure at scale—most recently at Meridian Health System, where I led talent acquisition for a 14,000-person organization. I cut clinical hiring costs by $4.2 million annually through process design and built a referral program that generates 34 percent of our hires. I'm looking to move into a CPO role at a growth-stage digital health company where I can bring that operational expertise to build people infrastructure from the ground up, partnering with leadership to scale without losing culture or financial discipline.

---

## [60 SECONDS]

I'm a senior people-strategy leader who builds systems that make hiring and organizational scaling work in the real world. For the past 14 years, I've been the trusted architect behind talent and people decisions at Meridian Health System, a 14,000-person integrated health system. That experience taught me how to solve talent problems that have real business impact.

A few examples: I cut clinical hiring costs by $4.2 million per year by redesigning our hiring process. I scaled the recruiting team 175 percent during COVID while bringing 300 managers onto a new ATS without losing hiring velocity. I built a referral program that now generates 34 percent of our hires—which means we hire faster, with better retention and lower costs. More recently, I compressed our offer decline rate from 22 percent down to 9 percent by rethinking how we communicate roles, structure offers, and onboard people.

What I've learned is that talent problems usually aren't talent problems. They're process problems or role-clarity problems or manager-capability problems. When you design systems thoughtfully and make sure they work for real people, business outcomes follow.

I'm now looking for a CPO role at a high-growth digital health company—ideally Series A or B—where I can take that operational playbook and build people infrastructure at a much faster pace. The problems are the same at a smaller scale, and there's real opportunity to shape culture and capability from the beginning.

---

## [90 SECONDS]

I'm a senior people-strategy leader who specializes in solving complicated talent and organizational problems in ways that drive measurable business outcomes. My background is clinical operations at scale. I've spent the last 14 years building talent and HR infrastructure at Meridian Health System, where I currently lead talent acquisition for a 14,000-person integrated delivery network across multiple locations.

In that role, I've had the opportunity to work on problems that sit at the intersection of people strategy and business operations. Here are the results that matter most to me:

First, cost and efficiency: I cut clinical hiring costs by $4.2 million per year by redesigning our hiring process and building a referral program. That referral program now generates 34 percent of our hires, which means we're accessing a network of high-quality candidates before they ever hit the open market. Combined, these initiatives reduced cost per hire by roughly 40 percent while improving retention.

Second, scaling through complexity: I led our recruiting team through a 175 percent expansion during COVID while simultaneously managing an ATS migration. We moved 300 managers from legacy Taleo to Workday without missing a hiring cycle. That required systematic thinking about training, change management, and process documentation.

Third, offer acceptance and onboarding: I compressed our offer decline rate from 22 percent to 9 percent by rethinking the offer experience, role clarity, and how managers engage new hires. That might sound small, but when you're hiring 300 people per year, reducing decline by 13 percentage points saves money, protects culture, and accelerates business impact.

What all of these projects share is a philosophy: talent problems usually aren't talent problems. They're process problems, or role-clarity problems, or manager-coaching problems. When you diagnose the real problem and design systems that work for real people, business outcomes follow.

I'm now looking to move into a CPO role at a high-growth digital health company, ideally at Series A or B stage, around 150 to 300 employees. Digital health is solving real problems in healthcare. I've seen both sides: the health system problems these companies are trying to solve, and the operational challenges of scaling through them. I'd bring that perspective to a leadership team, helping build talent strategy and people infrastructure that enables growth without breaking culture or burning out the team.`,

// ─── P7: GO-TO-MARKET ───────────────────────────────────────────────────

p7: `# P7: GO-TO-MARKET STRATEGY
## Chief People Officer at a Digital Health Company

---

## PART 1: THE HIRING EXECUTIVE

**Who:** Chief Executive Officer or Chief Operating Officer at a venture-backed digital health company

**Organization type:** Digital health companies (telehealth platforms, clinical decision support software, remote monitoring solutions, health data/interoperability platforms, healthcare staffing tech, consumer health applications with clinical anchors)

**Stage:** Series B-C (100-300 employees, post-product-market-fit, scaling revenue and headcount)

**The problem they own:** By Series B-C, these companies have moved past scrappy. They've hired 80-150 people. The founder or early HR person has been doing people operations on top of other responsibilities. Now they're scaling to 200-400 people, and people operations is becoming a bottleneck.

Specific pain points:
- Hiring is slowing down (no recruiting system, sales teams are recruiting to fill gaps)
- Offer acceptance rates are inconsistent
- Onboarding is ad-hoc
- Comp philosophy is all over the place
- Culture is fragmenting
- Board and investors are asking about retention metrics and talent risk

**What they actually need:** Someone who can build HR infrastructure and recruiting function without creating bureaucracy, who understands their specific market (healthcare), and who can move fast.

---

## PART 2: TARGET COMPANY LIST

### TELEHEALTH PLATFORMS
Teladoc Health | Ro (formerly Roman) | Sesame | LifeStance Health | Talkspace | Headspace Health | MDLive

### CLINICAL DECISION SUPPORT & AI
Tempus | PathAI | Turquoise Health | Humedica | Flatiron Health

### HEALTH DATA & INTEROPERABILITY
Redox | Truveta | Komodo Health | Health Catalyst

### HEALTHCARE STAFFING & WORKFORCE TECH
Shift | CloudHealth | ShiftLeft

### EMPLOYER/BENEFITS-FOCUSED DIGITAL HEALTH
Catch | Collective

### SPECIALIZED CLINICAL
Notable Care | Clarify Health | Physera

---

## PART 3: OUTREACH TEMPLATE

**Opening Email (4-6 sentences, pain-first, no buzzwords)**

Subject: Scaling talent and culture as you hit 200+ employees

Hi [Name],

I spent 14 years building talent and people infrastructure at Meridian Health System, a 14,000-person integrated health system in Atlanta. In that role, I learned a lot about what breaks when you're scaling from 100 to 300 people: hiring becomes slow, offer acceptance rates drop, compensation gets messy, and culture fragments.

I've also worked on the other side of health system relationships—understanding the operational problems that digital health companies are trying to solve. I know the clinical hiring challenge from the inside.

I'm now looking to bring that operational experience to a digital health company as Chief People Officer, and I've been following [Company Name] for a while. Your [recent product launch / Series C / recent hires in leadership] suggests you're at exactly the stage where professional people operations become a competitive advantage.

Would you be open to a brief conversation about talent challenges at [Company Stage]? No pitch, just perspective from someone who's built on both sides.

Best, Sarah

---

## PART 4: LINKEDIN SIGNAL TWEAK

**Current headline:**
VP Talent Acquisition | Meridian Health System | Healthcare Staffing, Leadership Development

**Recommended headline change:**
Chief People Officer | Leading talent and culture through scale | Healthcare operations expert

**Rationale:**
Your current headline speaks to your past role. Digital health hiring managers search for "Chief People Officer" and "VP People Operations." The phrase "Leading talent and culture through scale" signals growth dynamics. "Healthcare operations expert" signals domain credibility.`,

// ─── P8: LINKEDIN REMIX ─────────────────────────────────────────────────

p8: `# P8: LINKEDIN REMIX
## Chief People Officer at a Digital Health Company

---

## THREE HEADLINE OPTIONS

**Option 1 (Search visibility + authority):**
Chief People Officer | VP People Operations | Healthcare talent strategy & culture-building at scale

*Why this works:* Picks up searches for "Chief People Officer" and "VP People Operations." "Healthcare talent strategy" signals domain expertise. "At scale" signals you've done this at significant size.

**Option 2 (Human resonance + specificity):**
Building people and culture at high-growth digital health companies | Ex-Meridian | VP Talent Acquisition

*Why this works:* Opens with what you do (human-friendly). "High-growth digital health companies" is your target. Establishes credibility with Meridian anchor.

**Option 3 (Authority + positioning):**
People strategy in healthcare | Scaled recruiting 175% during COVID | Now building CPO foundations for growth companies

*Why this works:* Leads with expertise domain. Proves scale with specific proof point (175%). Signals readiness for CPO role.

---

## ABOUT SECTION (~200 words, first person, natural voice)

I'm a senior people-strategy leader who specializes in solving complex talent and organizational problems in ways that drive measurable business outcomes. For the past 14 years, I've built talent and HR infrastructure at scale—most recently as VP Talent Acquisition at Meridian Health System, a 14,000-person integrated health system.

In that role, I've focused on problems at the intersection of people strategy, operations, and business results. Here's what I'm proud of: I cut clinical hiring costs by $4.2 million annually through process redesign and built a referral program that now generates 34 percent of our hires. I scaled the recruiting team 175 percent during COVID while managing a complex ATS migration for 300 managers. Most recently, I compressed our offer decline rate from 22 percent down to 9 percent—which matters because every declined offer ripples through hiring cycles and culture.

What I've learned is that talent problems usually aren't talent problems. They're process problems, role-clarity problems, or manager-coaching problems. When you diagnose the real problem and design systems thoughtfully, business outcomes follow.

I'm now looking to bring that operational expertise to a Chief People Officer role at a growth-stage digital health company. I understand both the health system problems these companies are solving and the operational challenges of scaling. I'm drawn to work that combines strategic thinking with hands-on execution, where people decisions connect directly to business impact.

Outside of work, I'm passionate about healthcare innovation, real estate, travel, and mentoring emerging leaders in healthcare.

---

## EXPERIENCE REFRAME
### Most Recent Role

**Vice President, Talent Acquisition & Workforce Planning | Meridian Health System | 2014-Present**

- Architected talent strategy and processes that enabled 14,000-person health system to reduce clinical hiring costs by $4.2M annually while improving candidate quality and retention—achieved through process redesign, referral program development (now 34% of hires), and total-rewards positioning
- Scaled recruiting function 175% during COVID while executing complex ATS migration (Taleo to Workday) for 300+ managers without losing hiring velocity; established frameworks for manager training, change management, and system adoption
- Compressed offer decline rate from 22% to 9% through redesigned offer experience, role clarity, and manager engagement protocols; outcome: reduced hiring cycle friction, protected culture during rapid scaling, and improved time-to-productivity for 300+ annual new hires
- Led organizational design and compensation strategy work with executive team and board; supported $280M workforce planning and clinical service line staffing models
- Established reporting relationships, built trust with CHRO and business leaders, and earned reputation as "trusted architect" who delivers outcomes in complex, regulated environment`,

// ─── P_RES: RESUME REFRESH ──────────────────────────────────────────────

p_res: `# RESUME REFRESH
## Chief People Officer at a Digital Health Company

---

## REPOSITIONED SUMMARY (3-4 sentences)

Chief People Officer with 14 years of proven talent strategy and organizational leadership experience in complex, regulated healthcare environments. Specialized in solving talent and people problems that have direct business impact: cutting costs, improving retention, building capability, and enabling growth. Track record includes designing talent strategies that generated $4.2M in annual savings, built recruiting infrastructure for 300+ annual hires, and compressed offer decline by 13 percentage points. Proven ability to balance strategic thinking with operational rigor, working effectively with boards, executives, and frontline teams to translate vision into results.

---

## EXPERIENCE REWRITE (Last 10 years, top 3-4 bullets per role)

### Vice President, Talent Acquisition & Workforce Planning
**Meridian Health System, Atlanta, GA | 2014-Present**

- Architected end-to-end talent strategy for 14,000-person integrated health system; reduced clinical hiring costs $4.2M annually while improving hiring velocity, candidate quality, and retention through process redesign, referral program development (now 34% of hires), and total-rewards positioning
- Scaled recruiting function 175% during COVID while executing enterprise-wide ATS migration from Taleo to Workday for 300+ managers; designed change management, training, and adoption frameworks that maintained hiring velocity without disruption
- Designed offer experience and candidate communication protocols that compressed offer decline rate from 22% to 9%; outcomes included reduced hiring cycle time, improved new hire satisfaction, and stronger retention through first 18 months
- Supported workforce planning strategy for $280M healthcare operations; partnered with CFO, board, and clinical leadership on headcount modeling, compensation strategy, and organizational design for new service lines and geographic expansion

### Director, Talent Acquisition
**Meridian Health System | 2011-2014**

- Built recruiting function from 2 to 6 full-time recruiters; established recruiting infrastructure, process standards, and sourcing strategy that scaled from 150 annual hires to 300+ hires
- Implemented first systematic employer brand strategy and career positioning for clinical and administrative roles; improved application volume 40% and hiring team efficiency
- Designed and launched first formal referral program; achieved 28% of hires from referrals within first full year

### Manager, Recruitment & Staffing Operations
**Meridian Health System | 2008-2011**

- Established recruiting operations function including job posting systems, applicant tracking, recruiting metrics, and hiring process documentation across 40+ hiring managers
- Led implementation of initial ATS (Taleo); trained hiring managers and recruiting team on system use
- Improved time-to-hire from 65 days to 42 days through process streamlining and manager engagement

---

## SKILLS AND KEYWORDS

**Keywords to prioritize (for CPO positioning):**
1. Talent Strategy & Workforce Planning
2. People Operations & HR Leadership
3. Organizational Design
4. Compensation & Benefits Strategy
5. ATS & HRIS Systems
6. Recruiting Operations at Scale
7. Culture & Employee Retention
8. Change Management
9. Leadership Development
10. Healthcare Operations`,

// ─── P9: CRASH COURSE ───────────────────────────────────────────────────

p9: `# P9: CRASH COURSE
## Chief People Officer at a Digital Health Company

---

## THE LINGO — 10 Terms/Acronyms

**1. Series A / Series B / Series C**
Funding rounds for venture-backed companies. Series A is first venture round ($5-20M), Series B is growth round ($20-100M), Series C is expansion round ($50M+).
Example: "We're looking for a CPO who's worked in high-growth Series B and C companies where talent infrastructure becomes a competitive advantage."

**2. Burn Rate**
The monthly rate at which a company spends cash. Burn rate = monthly cash spend divided by cash on hand to determine runway.
Example: "Our burn rate is $2M per month, so we have 18 months of runway."

**3. Product-Market Fit (PMF)**
The point at which a company's product solves a real market problem and customers want to pay for it.
Example: "We've achieved product-market fit with health plans and now we're scaling go-to-market."

**4. Total Cost of Hire (TCH)**
The fully-loaded cost to hire one person, including recruiter salary, recruiting software, referral bonuses, etc.
Example: "Our total cost of hire is $8K per person, but clinical roles run $12K."

**5. ARR / MRR**
Annual Recurring Revenue / Monthly Recurring Revenue. Key metric for SaaS and subscription businesses.
Example: "We're at $15M ARR and growing 20% month-over-month."

**6. CAC / LTV**
Customer Acquisition Cost / Lifetime Value. Healthy companies have LTV at least 3x CAC.
Example: "Our CAC is $5K and LTV is $50K, which means the unit economics support aggressive hiring."

**7. Equity / Strike Price / Vesting**
Equity means ownership stake. Strike price is the price at which you buy shares. Vesting is the schedule (usually 4-year vest with 1-year cliff).
Example: "Standard offer is salary plus equity at a strike price of $2.50 with a 4-year vest and 1-year cliff."

**8. Board-Approved Headcount Plan**
The hiring plan that the board of directors has approved for the next 12 months. This is your hiring ceiling.
Example: "The board approved 50 new employees this year. Your job is to fill those spots on time, with quality."

**9. Employee Retention Rate / Turnover**
Retention rate is the percentage of employees who stay over a period. Turnover is the inverse.
Example: "Our year-one retention is 82%, which is good for early-stage tech."

**10. Talent Stack / Bench Strength**
The collection of talent and capabilities your leadership team has. "Bench strength" means having strong succession candidates.
Example: "One board concern is our talent stack—we're founder-heavy and don't have depth in operations."

---

## THE TECH STACK — Top 3 Tools

**1. Workday (HRIS/ATS/Payroll)**
Enterprise-grade people management system. Most venture-backed companies migrating to Workday. Implementation is complex (3-6 months), expensive ($500K-$2M), and critical. As CPO, you'll own this.

**2. Lattice or 15Five (Engagement/Performance/Learning)**
Cloud-based platform for employee engagement, feedback, performance reviews, and learning. Growth-stage companies use this to build feedback culture without heavy HR bureaucracy.

**3. LinkedIn Recruiter (Sourcing/Recruiting)**
Platform for sourcing passive candidates. Table-stakes for any recruiting function. Costs $3-10K per recruiter seat per year.

---

## THE THOUGHT LEADERS — 3 LinkedIn Follows

**1. April Dunford (@aprildunford)**
Positioning and strategy expert. Her content on clarity and differentiation applies to talent strategy: How does your company differ as an employer?

**2. Laszlo Bock (@laszlobock)**
Former CHRO at Google, now CEO of Humu. His book "Work Rules" is the playbook for scaling culture.

**3. Rand Fishkin (@randfish)**
Founder of SparkToro. Known for radically transparent communication about business and people challenges. His frameworks help communicate why people operations matter.

---

## THE FASTEST CREDIBILITY MOVE — One Action in 7 Days

**Action: Publish a short LinkedIn article (500-800 words) on scaling recruiting or culture in growth-stage healthcare companies.**

Title ideas:
- "What breaks in recruiting when you go from 100 to 300 people (and how to fix it)"
- "Three hiring mistakes I see growth-stage digital health companies make"
- "The offer decline problem nobody talks about"

Write from your experience at Meridian, but translate it to the digital health context. Post it, then seed engagement with 3-4 comments/shares from your network. Do this in week 1.`,

// ─── P10: DEVIL'S ADVOCATE ──────────────────────────────────────────────

p10: `# P10: DEVIL'S ADVOCATE
## Chief People Officer at a Digital Health Company

---

## THE HARD QUESTION

**Legitimate concern a hiring manager will have:**

"You've built your entire career in a large, regulated healthcare organization. Meridian is stable, hierarchical, and process-driven. A growth-stage digital health company is the opposite—we move fast, we make decisions and unmake them, we hire without perfect process, and we're fundraising constantly. How do you know you won't slow us down or try to build too much process into what is still a chaotic organization?"

---

## THE RESPONSE

I get this question, and it's fair. Let me be direct: I'm not interested in building a healthcare-style HR function at your company. That would be wrong and would slow you down. You need a different approach.

Here's what I actually learned at Meridian that applies to your situation: process doesn't slow you down. Bad process does. Or no process does. The difference is in how you design.

At Meridian, when we did the Taleo-to-Workday migration, I could have built an implementation that took 12 months and required every manager to learn the new system perfectly. Instead, I designed it in phases. We started with hiring and onboarding. We trained managers for 2 hours, not 20. We built in guardrails so they couldn't break things, but also gave them autonomy to move fast. The whole migration took 8 weeks without losing a single hire.

When I built the cost reduction initiative, I didn't create a new committee or approval process. I looked at where money was leaking (fragmented sourcing, no referral program, third-party agencies doing work our recruiting team could do) and designed experiments to fix it. Then we scaled what worked.

What I won't do is different. I won't build compliance theater. I won't create 5-person hiring committees when you need to move fast. I won't require 6 weeks of onboarding curriculum when you could give someone a good first week and then context as they go.

What I will do is this: identify where chaos is actually costing you money or people. There are usually 3-4 problems. Chaos in sourcing? Chaos in offer communication? Chaos in who owns onboarding? I'll design the smallest process that fixes the leak, implement it fast, measure it, and iterate. That's what happened at Meridian during COVID—we had to grow recruiting 175% in 6 months. No time for perfect process. But we still had a plan, a system, and clear roles.

At a growth-stage digital health company, that's exactly what you need. Not bureaucracy. Just clarity.

---

## THE PRACTICE NOTE

**One thing to practice saying aloud:**

"I'm not here to slow you down with process. I'm here to identify which chaos is costing you money and which is just part of being early-stage. Then I'll design the smallest system that fixes the real problem. The Taleo-to-Workday migration at Meridian is an example: 300 managers, 8 weeks, no hiring disruption, because we designed for speed, not perfection."

Practice this until it feels natural. Hiring managers will be watching to see if you're defensive or if you genuinely understand the distinction between good and bad process. The word "identify" and the specific example (Taleo migration) are what sell it.`,

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
I help growth-stage companies and health systems solve talent challenges that slow them down. For 14 years, I built talent and people infrastructure at scale—cutting hiring costs, designing recruiting systems, and building cultures that hold up through 175% growth. Now I work with leadership teams on specific problems: scaling recruiting, designing offer and onboarding experiences, building compensation strategies, and organizing people functions for rapid growth. I specialize in healthcare organizations and digital health companies.

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

## PART 6: FIRST 48 HOURS

**Hour 0-6:** Create business email. Update LinkedIn. Join Guidepoint. Identify 5 network contacts to notify.

**Hour 6-12:** Publish first Substack article. Set up one-page website. Reach out to 3-5 contacts.

**Hour 12-24:** Research 5 local CEO roundtables. Schedule 2-3 coffee chats. Draft 3 consulting proposals.

**Hour 24-48:** Talk to 1-2 existing consultants. Create rate card. Join one networking group. Block 4 hours/week for business development.`

};
