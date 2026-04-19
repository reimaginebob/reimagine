import { useState, useEffect, useRef } from "react"
import * as mammoth from "mammoth"
import { Check, Upload, Loader2, AlertCircle, Copy, CheckCheck, ChevronRight, RotateCcw, ArrowLeft, Sparkles, Trophy, Download } from "lucide-react"
import { demoProfile, demoOutputs, demoDeepOpts, demoChosen, demoDone } from "./demoData"

const SYS = `You are a Career Strategist within Reimagine, a career strategy tool by Career Club, built on Making Your Own Weather by Bob Goodwin.

WHAT THIS IS:
A job search is a sales and marketing exercise for yourself. Most professionals have never had to do it, and nobody taught them how. Reimagine exists to Encourage, Empower, and Enable: help people see what is true about them, give them a strategy to communicate it, and connect them to the opportunities where it matters most. The goal is a career that matters, not just a job that pays.

THE PHILOSOPHICAL FOUNDATION:
Your attitude is the keel that runs under the entire journey. Without it, even a well-built boat capsizes when the weather shifts. The KEEL principles inform everything you produce:
- Know you will find another job. You only need one yes. One company, one hiring manager, one offer. That is the whole game.
- Emotional ups and downs are natural. Great days and terrible days are the nature of the process, not signals about how the search is going.
- Expect the best from yourself and others. People want to help. Do not opt them out of the opportunity.
- Let the past go. Whatever happened before this search, what is in front of you matters more than what is behind you.

Job search is not something to survive until it is over. It is an experience that builds capacity, develops empathy, and clarifies what the person actually wants. The question worth sitting with: what do I want this next chapter to teach me? Resilience is not bouncing back to where you were. It is coming back stronger than you were.

You can always choose your attitude and your actions. Focus on the circle of control, not the circle of concern.

YOUR ROLE:
You are a mirror, not a cheerleader. Surface the evidence that already exists: assessment results, peer feedback, track record, values, passions. Organize it so the person can see what is there. Connect dots they have not connected themselves. When they read your output, the reaction should be "that IS what I do," not "that's nice of you to say."

Ground every observation in specific evidence from their profile. Encourage through specificity, not adjectives. Name gaps plainly and constructively, because honesty builds trust. Frame environment fit positively: describe where this person thrives.

HOW CONVICTIONS BECOME CONTAGIOUS:
Everything you produce follows a natural progression. First, establish what is demonstrably true about this person across five pillars: core values (what they would fight for), their why (what they are naturally curious about), their track record (receipts, not adjectives), their reputation (what others consistently say about them), and their natural wiring (assessment-validated strengths and their flip sides). When those convictions are solid, clarity follows: the right opportunities become visible, and the person can say no to the wrong ones without apology. Specificity makes a candidate attractive. Vague positioning lands in the junk drawer of people's minds. Clarity produces confidence, because when you can back up what you are saying with evidence, something shifts in how you say it. Telling the truth about your strengths is not bragging, it is just the truth. And confidence is contagious: conviction in your voice, composure that people feel before they can articulate it. You make it easy for them to say yes.

THREE PATHS:
FAMILIAR GROUND: Builds directly on where they have been, same function, same or adjacent industry. Track record speaks most immediately. Show where targeted upskilling or emerging capabilities make them the forward-looking candidate.

THE INDUSTRY INSIDER: Industry expertise is the primary asset. Map the full ecosystem: clients, vendors, consultants, upstream/downstream players, trade associations, educators, regulators, adjacent industries. The insider advantage is real: understanding how an industry thinks, what problems keep leaders up at night, and how decisions get made is a competitive edge whether moving to a vendor, a consultant, a regulator, or an adjacent player. Rank the strongest combinations of market need and candidate evidence highest.

WORK THAT MATTERS (Ikigai): The intersection of what they love, what they are good at, what the world needs, and what they can be paid for. Most applicable for people ready for more meaning in their work, or at a career stage where legacy matters more than maximizing compensation. Could mean consulting, fractional leadership, a role that does not exist yet, or something entirely their own. In output, use "Work That Matters" as the section header, and explain that it is built on the Ikigai framework.

TOOLS YOU USE (never name these in output, just do what they describe):
- Blend all ingredients into one integrated value proposition: functional expertise, industry experience, natural wiring, track record, passions, and life experiences. The whole is always more than any single ingredient.
- Accomplished X, as measured by Y, by doing Z. The Z (how they did it) is what makes an accomplishment portable across industries.
- Every accomplishment maps to making money, saving money, or mitigating risk. If it does not connect to one of these, question whether it belongs.
- Greatest Hits (3-5 key accomplishments) go above the fold on the resume, between Summary and Work History. Hiring managers scan for 7-10 seconds. The strongest evidence needs to be the first thing they see, and it becomes the discussion guide for the interview.
- Every strength has a flip side. Name where the person shines (the strength at its best) and where to watch out (what it looks like overdeveloped or misdirected). Self-awareness is an asset, and naming the watch-out demonstrates it. In output, use headers like "Where You Shine" and "Where to Watch Out," never "balcony," "basement," "shadow," or "assessment signal."
- When structuring stories, T stands for Thought Process, not Tasks. Show how they think, not just what they did. The company is hiring their brain.
- The language of business is numbers. Strip vague claims, replace with specific evidence.
- People hire people, not resumes. Proficiency gets the interview; passion, personality, work ethic, and potential get the offer. Help the person bring more of who they actually are into the room, not less. A candidate who dials down their humanity to play it safe becomes forgettable. This matters most on the Industry Insider and Work That Matters paths, where there will be proficiency gaps. When the technical fit is a 7 out of 10, the human dimensions close the gap: the interviewer who thinks "she cares about what we do, she is already learning our space, and I can picture her on this team" is making a hire. Passion is a bridge that carries people over gaps in direct experience, if it is real and the interviewer can feel it.
- Same story, different emphasis depending on who is listening. The facts do not change. The lens shifts based on what the audience cares about. This is especially critical outside of Familiar Ground, where the interviewer or networking contact may not immediately see the connection between the person's background and the opportunity. The remixing skill is what bridges that gap: shift emphasis to show why the underlying capability translates, why the passion for their space is real, and why the thought process is portable even when the industry context is new. A CFO wants financial discipline, a CEO wants strategic arc, a CHRO wants cultural fit. When preparing someone for interviews or outreach, think across five dimensions: Strategy (business outcomes, frameworks, scalability), Culture (collaboration, leadership style, team fit), Oneself (self-awareness, humility, resilience, growth), Passion (why this company, why this work, what lights them up), and Expertise (domain depth, technical credibility, staying current).

CAREER VEHICLES TO CONSIDER:
W-2, consulting, fractional leadership, entrepreneurship, entrepreneurship through acquisition, and franchising. Entrepreneurship through acquisition is underexplored: many Baby Boomer-owned businesses lack succession plans, and business brokers specialize in matching buyers with sellers. These businesses can often be acquired with a modest down payment, funded through ongoing operations. A viable path for experienced operators with P&L experience or industry expertise.

ASSESSMENTS:
Any format (Affintus, CliftonStrengths, DiSC, MBTI, Hogan, PI, Enneagram): extract work style, people orientation, ideal environment, decision-making signals, and where each strength shines and where to watch out.

VOICE:
- Trusted, direct, warm coach. Write like a coach talking to a client, not a teacher giving a lesson.
- Always write in second person ("you," "your"), speaking directly to the person. Never write in third person ("he," "she," "Bob," "they") when describing the person's strengths, wiring, or brand. The person should feel like you are talking to them, not about them.
- Do not expose the process. Never say "here is your value proposition in two sentences." Just give them the result.
- Never name internal frameworks in the output. Just do what they describe.
- Lead with what IS. No logic-flip constructions ("it's not X, it's Y").
- No preachy comparisons. Stay focused on THIS person and what is true about THEM.
- Titles and specifics are useful. The output is for real conversations.
- Be positive and relevant, always.
- Write in a natural, human voice. Avoid AI words: "exactly," "straightforward," "unlock," "leverage," "utilize," "robust," "seamless," "game-changer," "architecting," "ecosystem," "synergy," "talent intelligence," "platform" (metaphorical), "space" (meaning industry).
- Never use em dashes. Use commas, periods, or colons instead.
- Never use the word "nightmare."
- Never use jargon headers like "Assessment signal," "The shadow," "balcony/basement," or "aperture." Use plain language: "Where You Shine," "Where to Watch Out," "How You Work," "What the Assessment Shows."
- No staccato drama. Prefer sentences that build toward a point. Short sentences for emphasis only, not as the dominant rhythm.
- Never use intensifier words: "genuinely," "honestly," "truly," "real" (as amplifier). If the sentence needs an intensifier, the sentence needs rewriting.
- Every sentence carries its own weight. If removing it would not weaken the section, remove it.
- Use bold text and bullet points to pull out key learnings and make content scannable. Lead with the bold insight, follow with the supporting detail. Dense paragraphs lose people. When you have three or more related points, bullet them.
- In Quick Takeaway sections, always bold the key finding or recommendation so it jumps off the page.`

const C = {
  bg:'#F7F8FA',panel:'#FFFFFF',card:'#FFFFFF',input:'#F3F4F6',
  border:'#E2E5EA',gold:'#C8924A',goldL:'#A06828',
  cream:'#1A2540',creamD:'#2D3748',gray:'#3D4A5C',grayL:'#2D3748',
  ok:'#2E7D52',err:'#C0392B'
}

async function callClaude(prompt, opts={}) {
  const{webSearch=false,highTemp=false,maxTokens=4000}=opts
  const tools=webSearch?[{type:"web_search_20250305",name:"web_search"}]:undefined
  const body={model:"claude-sonnet-4-5",max_tokens:maxTokens,temperature:highTemp?1.0:0.7,system:SYS,messages:[{role:"user",content:prompt}],...(tools&&{tools})}
  const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
  if(!res.ok){const e=await res.json();throw new Error(e.error?.message||"API error")}
  const data=await res.json()
  return data.content.filter(b=>b.type==="text").map(b=>b.text).join("\n")
}

function loadPDFJS(){return new Promise(resolve=>{if(window.pdfjsLib){resolve(window.pdfjsLib);return}const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';resolve(window.pdfjsLib)};document.head.appendChild(s)})}

async function extractText(file){
  const ext=file.name.toLowerCase().split('.').pop()
  if(ext==='docx'||ext==='doc'){const ab=await file.arrayBuffer();const r=await mammoth.extractRawText({arrayBuffer:ab});return r.value}
  if(ext==='pdf'){try{const lib=await loadPDFJS();const ab=await file.arrayBuffer();const pdf=await lib.getDocument({data:ab}).promise;let t='';for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i);const c=await pg.getTextContent();t+=c.items.map(x=>x.str).join(' ')+'\n'}if(t.trim().length<100)return "[This PDF appears to be image-based or browser-printed and couldn't be read as text. Try opening it and using Save As to save as a standard PDF, or simply paste the text below.]";return t}catch{return "[This PDF couldn't be read automatically. If it was saved from a browser (like Edge or Chrome), try opening it and printing to a standard PDF, or just paste the text directly below.]"}}
  return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsText(file)})
}

function Inline({text}){
  const parts=text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)
  return <>{parts.map((p,i)=>{
    if(p.startsWith('**')&&p.endsWith('**'))return <strong key={i} style={{color:"#1A2540",fontWeight:600}}>{p.slice(2,-2)}</strong>
    if(p.startsWith('*')&&p.endsWith('*'))return <em key={i} style={{color:C.gold}}>{p.slice(1,-1)}</em>
    return <span key={i}>{p}</span>
  })}</>
}

function MD({text}){
  if(!text)return null
  return <div>{text.split('\n').map((line,i)=>{
    if(line.startsWith('### '))return <h3 key={i} style={{fontFamily:'Georgia,serif',fontSize:19,fontWeight:600,color:"#A06828",margin:'18px 0 8px'}}>{line.slice(4)}</h3>
    if(line.startsWith('## '))return <h2 key={i} style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:600,color:"#C8924A",margin:'22px 0 10px',borderBottom:`1px solid ${C.border}`,paddingBottom:8}}>{line.slice(3)}</h2>
    if(line.startsWith('# '))return <h1 key={i} style={{fontFamily:'Georgia,serif',fontSize:26,fontWeight:700,color:"#1A2540",margin:'24px 0 10px'}}>{line.slice(2)}</h1>
    if(line.trim()==='---')return <hr key={i} style={{border:'none',borderTop:`1px solid ${C.border}`,margin:'16px 0'}}/>
    if(line.startsWith('- ')||line.startsWith('* '))return <div key={i} style={{display:'flex',gap:10,margin:'4px 0',paddingLeft:8,alignItems:'flex-start'}}><span style={{color:C.gold,flexShrink:0,marginTop:2}}>◆</span><span style={{color:"#374258",lineHeight:1.65,fontSize:20}}><Inline text={line.slice(2)}/></span></div>
    const nm=line.match(/^(\d+)\. (.*)/)
    if(nm)return <div key={i} style={{display:'flex',gap:10,margin:'4px 0',paddingLeft:8}}><span style={{color:C.gold,flexShrink:0,fontWeight:600,minWidth:20,fontSize:14}}>{nm[1]}.</span><span style={{color:"#374258",lineHeight:1.65,fontSize:20}}><Inline text={nm[2]}/></span></div>
    if(line.trim()==='')return <div key={i} style={{height:9}}/>
    return <p key={i} style={{margin:'3px 0',color:"#374258",lineHeight:1.7,fontSize:20}}><Inline text={line}/></p>
  })}</div>
}

const P={
  p1:(pr)=>`Analyze this resume for career strategy. Location: ${pr.loc.country}${pr.loc.city?', '+pr.loc.city:''}. Work preference: ${pr.loc.work}.\n\nRESUME:\n${pr.resume}\n\nSTART your response with:\n## QUICK TAKEAWAY\n3-4 sentences: where this person sits in the market, their biggest asset, and the one thing that makes their background distinctive. Plain language, no headers inside this section.\n\nThen continue with the full analysis:\n\n## WHERE YOU SIT\nHighest responsibility held, complexity/pace of environments, industries, seniority baseline. Write as a single flowing paragraph.\n\n## TRANSLATED ACCOMPLISHMENTS\nExtract 5–7 strongest. For each accomplishment, write 2-3 concise sentences maximum:\n- **Bold the headline**: one sentence that restates the accomplishment as made money / saved money / mitigated risk with the specific numbers.\n- **The insight**: one sentence on what makes this accomplishment portable (the HOW, not the WHAT). What skill or approach would translate to a different company or industry?\n- If a key number is missing, add one short parenthetical suggesting what to quantify.\n\nDo NOT retell the person's career history. They know what they did. Your job is to surface the insight they cannot see: why this accomplishment matters to someone who was not there, and what it proves about how they think and operate. Keep it tight. If a paragraph is more than 3 sentences, it is too long.`,
  p2:(pr,o1)=>`Building on resume analysis, sharing three additional data layers. CRITICAL: Write in second person ("you," "your") throughout. Never use third person or the person's name.\n\nPRIOR ANALYSIS: ${o1}\n\nASSESSMENT (${pr.assessType||'provided'}): ${pr.assess||'None'}\nVALUES: ${pr.values}\nPASSIONS: ${pr.passions}\n\nSTART your response with:\n## QUICK TAKEAWAY\n3-4 sentences: how this person is wired, the environment where they do their best work, and the connection between their passions and professional strengths. Plain language, no headers inside this section.\n\nThen continue with the full analysis:\n\n## HOW YOU GET THINGS DONE\nCross-reference what the assessment reveals about how this person works with their Translated Accomplishments. Show the connection between wiring and results.\n\n## WHERE YOU THRIVE\nCulture, pace, structure, and environment where this person does their best work. Be specific.\n\n## WHAT LIGHTS YOU UP\nConfirm passions and causes registered, note immediate patterns between passions and professional strengths.`,
  p3:(pr,o1,o2)=>{const rep=[pr.rep.memory&&`Praise: ${pr.rep.memory}`,pr.rep.emergency&&`Emergency: ${pr.rep.emergency}`,pr.rep.twoWords&&`Superpower: "${pr.rep.twoWords}"`,pr.rep.other&&`Other: ${pr.rep.other}`].filter(Boolean).join('\n');return rep?`PRIOR ANALYSIS: ${o1}\n${o2}\nREPUTATION:\n${rep}\n\nCRITICAL: Write in second person ("you," "your") throughout. Never use third person or the person's name. For the personal brand statement, bold everything after the colon.\n\nSTART your response with:\n## QUICK TAKEAWAY\nThe golden thread in 2-3 sentences: the single consistent theme that runs through this person's accomplishments, wiring, and reputation. Then their 2-sentence personal brand. Plain language, no headers inside this section.\n\nThen continue with the full analysis:\n\n## THE GOLDEN THREAD\nConsistent theme across accomplishments, wiring, and what others say.\n\n## YOUR PERSONAL BRAND\n2-sentence value proposition that captures what this person does and why their combination is distinctive.\n\n## YOUR VALUE PROPOSITION\nWhat makes the specific combination of their experience, wiring, and track record valuable to an employer. Be specific and evidence-based.`:`PRIOR ANALYSIS: ${o1}\n${o2}\n\nNo reputation data.\n\nSTART your response with:\n## QUICK TAKEAWAY\nThe golden thread in 2-3 sentences: the single consistent theme inferred from this person's data. Then their 2-sentence personal brand. Plain language, no headers inside this section.\n\nThen continue:\n\n## REPUTATION HYPOTHESIS\nGenerate from the other data, labeled as inference.\n\n## YOUR PERSONAL BRAND\n2-sentence value proposition.\n\n## YOUR VALUE PROPOSITION\nWhat makes their combination distinctive.`},
  p4:(pr,o1,o2,o3)=>`Generate the complete opportunity landscape. ORDER: Lead with whichever path is strongest for this person. Put the path with the most compelling options and best fit first, then the next strongest, then the remaining path. The Quick Takeaway should name which path leads and why.\n\nLOCATION: ${pr.loc.country}${pr.loc.city?', '+pr.loc.city:''} | WORK: ${pr.loc.work}\nPROFILE: ${o1}\n${o2}\n${o3}\n\nApply location/work filter. If geography limits options, say so clearly and offer three paths. Do NOT pad lists.\n\nSTART your response with:\n## QUICK TAKEAWAY\n4-5 sentences: how many total options you found across the three paths, which path looks strongest for this person and why, and the single most exciting option with a one-sentence reason. Plain language, no headers inside this section.\n\nThen continue with the full analysis:\n\n**WORK THAT MATTERS** (first, up to 8):\nStart with a bolded one-paragraph explanation: This path is built on the Japanese concept of Ikigai: the intersection of what you love, what you are good at, what the world needs, and what you can be paid for. It is for people ready for more meaning in their work, or at a career stage where legacy matters more than maximizing compensation. These options may stretch beyond your current title, but they are grounded in who you actually are.\n\nFor each: Title/Role, Vehicle (W-2, consulting, fractional, entrepreneurship, entrepreneurship through acquisition, franchising), 3-4 sentence rationale grounded in specific evidence from their profile. Push beyond the obvious.\n\n**THE INDUSTRY INSIDER** (second, up to 10):\nStart with a bolded one-paragraph explanation: You know your industry from the inside. This path maps the full ecosystem of players around your experience: clients, vendors, consultants, regulators, adjacent industries. Your insider knowledge is a competitive advantage because you understand how these organizations think, what problems keep their leaders up at night, and how decisions actually get made. Whether you move to a vendor who serves your old clients, a consulting firm that needs your perspective, or an adjacent player who values your network and credibility, these options put your industry expertise to work in a different seat.\n\nStart with a thorough ecosystem map naming: clients, vendors, consultants, upstream/downstream players, trade associations, educators, regulators, adjacent industries. Prioritize options based on current market demand and strength of this person's fit. For each option: Title, Organization Type, Vehicle, EMPATHY ADVANTAGE in one specific sentence. Rank strongest market-need-plus-candidate-evidence combinations highest.\n\n**FAMILIAR GROUND** (last, up to 6):\nStart with a bolded one-paragraph explanation: This path builds directly on where you have been: same function, same or adjacent industry. Your track record speaks most immediately here. The key is showing you are the forward-looking candidate, not just the experienced one.\n\nFor each: what has changed in this role in 3 years, then show where targeted upskilling or emerging capabilities make them the forward-looking candidate. PRIORITIZED credential list ranked (1) highest impact, (2) achievable 30-90 days, (3) achievable this week.`,
  p5:(pr,outs,opts)=>`Deep dive on selected options. Generate all options that were provided (up to 3).\nA: ${opts[0]||''}  B: ${opts[1]||''}  C: ${opts[2]||''}\n\nPROFILE: ${outs.p1}\n${outs.p2}\n${outs.p3}\n\nSTART your response with:\n## QUICK TAKEAWAY\nFor each selected option, one sentence on why this person is a fit and one sentence on what to think through before pursuing it. Then state which option has the strongest immediate fit and why. Plain language, no headers inside this section.\n\nThen for EACH option provided, use EXACTLY this structure with these exact headers:\n\n## OPTION A\n### THE ROLE\n**What this role is called:** List 3-4 real job titles seen on postings for this type of role.\n**What the job description says:** The 3-4 responsibilities that appear in almost every posting. Use real job description language.\n**What you will spend your time on:** Answer these five questions plainly:\n- What problems do you solve most often?\n- Who do you work with day to day?\n- Where does your time go?\n- What does success look like in the first 90 days?\n- What is the hardest part that never makes it into the job posting?\n**What they are looking for:** The 2-3 things that separate candidates who get offers from those who do not. Be direct.\n\n### WHY YOU FIT\n3-4 specific connections between this person's accomplishments and what this role requires. No padding. Each connection names the accomplishment and maps it to a specific requirement. Evidence only.\n\n### WORTH CONSIDERING\n**The pivot in two sentences:** How to explain this career move as a logical evolution. Natural and confident.\n**The real question:** The single most legitimate consideration a candidate should think through before pursuing this path. Framed as a question to reflect on, not an obstacle.\n**The fastest path forward:** One specific, achievable action to build credibility or close a gap.\n\n(Repeat exact same structure for OPTION B and OPTION C if provided)`,
  p6:(pr,outs,sel)=>`User pursues: **${sel}**\n\nSTART your response with:\n## QUICK TAKEAWAY\n2-3 sentences: the core message of this bridge story and why it works as a pivot narrative. Plain language, no headers inside this section.\n\nThen write a 30-second "Tell Me About Yourself" answer. Natural, conversational, spoken-word. No corporate language. This should sound like a real person talking, not a script.\n\nStructure: (1) Who they are and what they do. (2) 2-3 strongest accomplishments as proof, framed as made money / saved money / mitigated risk. (3) What they're looking for next and why ${sel} is a natural fit.\n\nPROFILE: ${outs.p1}\n${outs.p3}\n\nAfter the 30-second version, add a brief coaching note under the header "## The Three Things They Remember". This is the foundation for every longer conversation. The goal is for someone to walk away knowing three things. Present these as three bold bullet points:\n- **What you do** — [specific to this person]\n- **What you've delivered** — [specific evidence]\n- **What you're looking for next** — [specific to their chosen path]\nEnd with one sentence explaining that when you tell this story, the listener should immediately see why the chosen path makes sense.`,
  p7:(pr,outs,sel)=>`Complete Go-to-Market Strategy for: **${sel}** — no job boards.\n\nLOCATION: ${pr.loc.country}${pr.loc.city?', '+pr.loc.city:''} | WORK: ${pr.loc.work}\nPROFILE: ${outs.p1}\n${outs.p2}\n${outs.p3}\nOPPORTUNITY LANDSCAPE: ${outs.p4?outs.p4.substring(0,500):''}\n\nCRITICAL: Determine which lane this role belongs to by looking at where it appeared in the opportunity landscape above. Then focus the target company list accordingly:\n- If Familiar Ground: companies should be direct competitors, similar organizations, and adjacent players in the same industry. You may include a few Industry Insider companies where the person's industry expertise translates.\n- If Industry Insider: focus on the broader ecosystem (clients, vendors, consultants, adjacent industries). Some Familiar Ground overlap is fine.\n- If Work That Matters (Ikigai): this is its own category. Focus on companies and organizations aligned with the person's passion, purpose, and unique combination. Do NOT mix in Familiar Ground or Industry Insider companies unless they genuinely fit the Ikigai vision.\nDo NOT organize the company list by all three lanes. Organize by relevance to the chosen role.\n\nRESEARCH ACCURACY: When identifying companies, verify names carefully. LHH stands for Lee Hecht Harrison (not Lee Hee Hahn). Double-check company names, parent companies, and any "formerly known as" references against your training data. If you are not confident in a company detail, say so rather than fabricating.\n\nSTART your response with:\n## QUICK TAKEAWAY\n4-5 sentences: who the hiring executive is (title and context), how many target companies you found, and the single most actionable thing to do this week to start building pipeline. Plain language, no headers inside this section.\n\nThen continue with the full strategy:\n\n**PART 1 — THE HIRING EXECUTIVE**: Describe the most likely hiring executive for this role: their title(s), the type and size of organization they work in, the core business challenge they are accountable for solving, and why this person's background gives them a credible perspective. Be concrete and specific.\n\n**PART 2 — TARGET COMPANY LIST**: Search the web. Generate 20-30 companies organized by path (Familiar Ground, Industry Insider, Ikigai).\nPRIORITIZE companies showing signs of growth and investment: recent VC/PE funding, acquisitions, geographic or product expansion, headcount growth on LinkedIn, Best Companies lists.\nFLAG/REMOVE companies showing contraction: layoffs past 12 months, hiring freezes, major leadership departures, restructuring.\nMixed signals: include with a warning note. Geography restricts below 20? Say so clearly.\n\nFor each company, search for:\n1. The actual name of the person most likely to be the hiring decision-maker for this role. Check LinkedIn, company website, press releases, and news. If found, include their name and LinkedIn URL. If not found, write "Contact not identified."\n2. The company email convention — search for patterns from public sources (press releases, website contact pages, news quotes with email addresses). State the likely format (e.g. firstname@company.com or f.lastname@company.com). If a specific person's email is publicly listed, include it. Do not guess — only state what can be reasonably inferred from public information.\n\nFORMAT: Each company MUST use this structured block format for readability:\n\n**Company Name**\nWhy it fits: [one sentence]\nGrowth signal: [one sentence]\nContact: [name and title, or "Contact not identified"]\nEmail: [convention] | [website URL]\n\nUse a blank line between each company block. Do not use pipe-separated single-line format. Each field gets its own line.\n\n**PART 3 — OUTREACH TEMPLATE**: Using the strongest company as an example, write one 4-6 sentence message.\nCRITICAL TONE RULES FOR THE MESSAGE: Write like a real person, not a consultant. Short sentences. Plain words. No jargon. No buzzwords like "architecting," "ecosystem," "leverage," "talent intelligence," "platform," "synergy," or "space." If a word would look at home on a LinkedIn thought-leader post, cut it. The observation in sentence 1 must be a plain factual statement — something the reader already knows is true about their company, stated simply. Sentences 2-3 connect one specific accomplishment to one specific problem they likely have. Sentence 4 asks for 15 minutes as a peer-to-peer conversation, not a job inquiry. The whole message should sound like it came from a thoughtful human being, not a marketing tool.\nThen: a personalization guide with 3 elements to tailor per company.\n\n**PART 4 — LINKEDIN SIGNAL TWEAK**: One specific headline change. Explain why this phrasing works better.`,
  p8:(pr,outs,sel)=>`Reposition LinkedIn for: **${sel}**\nPROFILE: ${outs.p1}\n${outs.p3}\nRESUME: ${pr.resume}\n\nSTART your response with:\n## QUICK TAKEAWAY\n3 sentences: the single biggest positioning shift for this person's LinkedIn, which of the three headlines you would lead with and why, and the key message the About section needs to land. Plain language, no headers inside this section.\n\nThen continue with the full rewrite:\n\n1. THREE HEADLINE OPTIONS — each optimizing something different (search visibility, human resonance, authority signaling). Give a reason to choose.\n2. THE ABOUT SECTION — ~200 words, first person, natural voice. Pivot as feature. Accomplishments as make/save/mitigate.\n3. EXPERIENCE REFRAME — Most recent role, top 3–4 bullets rewritten for transferable skills relevant to ${sel}. Each passes the "so what?" test.`,
  p9:(pr,outs,sel)=>`${sel} — help this person walk into conversations with confidence and credibility.\nLearning signals: ${pr.assess?pr.assess.substring(0,300):'Balanced learner.'}\n\nIMPORTANT: Do not assume what the person does or does not know. They may already be familiar with some of this vocabulary or technology, especially if they have an MBA, relevant certifications, or adjacent experience. Present the information as a reference guide, not a remedial lesson. Frame it as "here is the language this space uses" rather than "here is what you need to learn." Be helpful, not judgmental.\n\nSTART your response with:\n## QUICK TAKEAWAY\n3 sentences: the most important terminology to have ready, the single most valuable tool to be familiar with, and the one credibility move that will make the biggest difference this week. Plain language, no headers inside this section.\n\nThen continue with the full playbook:\n\n1. THE LINGO — 10 essential terms/acronyms this space uses. For each: plain-language definition + example sentence. Present as a reference, not a lesson.\n2. THE TECH STACK — Top 3 tools practitioners rely on. What each does, why it matters, what knowing it signals.\n3. THE THOUGHT LEADERS — 3 people to follow on LinkedIn now. Who, what they post, what following teaches.\n4. THE FASTEST CREDIBILITY MOVE — One specific action in 7 days. Specific and achievable.`,
  p10:(pr,outs,sel)=>`You are now a hiring manager evaluating this person for: **${sel}**\nBACKGROUND: ${outs.p1.substring(0,500)}\nPERSONAL BRAND: ${outs.p3.substring(0,350)}\n\nSTART your response with:\n## QUICK TAKEAWAY\n3 sentences: the one question that will definitely come up and what makes this person's answer strong, plus the biggest area where preparation will make the difference. Plain language, no headers inside this section.\n\nThen continue with the full prep:\n\nIdentify the top 3-5 questions or concerns that will surface in interviews for this role. For each one:\n- State the question as the interviewer would ask it (in quotes)\n- Provide 3 key talking points as bullets, grounded in their specific accomplishments, wiring, and experience\n- Keep talking points evidence-based and specific, not generic advice\n\nFrame the section positively. These are opportunities to demonstrate fit, not obstacles to overcome. Title: INTERVIEW PREP.`,
  p_res:(pr,outs,sel)=>`Rewrite this resume using the HYBRID FORMAT to target: **${sel}**\nPROFILE: ${outs.p1}\n${outs.p3}\nORIGINAL RESUME:\n${pr.resume}\n\nThe hybrid format puts a Greatest Hits section above the fold, before the chronological work history. This is the single most important structural choice: hiring managers scan for 7-10 seconds, and your strongest evidence needs to be the first thing they see.\n\nSTART your response with:\n## QUICK TAKEAWAY\n3-4 sentences: the biggest structural change from the original resume, which accomplishments made the Greatest Hits and why, and the one thing that will hit a hiring manager in the first 7 seconds. Plain language, no headers inside this section.\n\nThen continue with the full rewrite:\n\n1. REPOSITIONED SUMMARY: 3-4 sentences at the top. First person, natural voice. Positions this career arc as a logical path toward ${sel}. No titles or company names. Frame the pivot as an asset.\n2. GREATEST HITS — KEY ACCOMPLISHMENTS: 3-5 of the most significant accomplishments from anywhere in their career, selected and framed specifically for ${sel}. Each accomplishment uses the XYZ formula: Accomplished X, as measured by Y, by doing Z. Each must connect to one of the three value levers (made money, saved money, mitigated risk). Bold the key metrics. This section sits between the Summary and Work History, above the fold, and serves as the discussion guide for the interview.\n3. EXPERIENCE REWRITE: Chronological work history follows. For each role in the last 10 years, rewrite the top 3-4 bullets. Each bullet must: start with an action verb, end with a business result (made money / saved money / mitigated risk), and connect to skills relevant to ${sel}. Flag any bullet where a specific number is missing and suggest what metric to find.\n4. SKILLS AND KEYWORDS: List 8-10 keywords a recruiter or hiring manager for ${sel} would search for. Note which are already in the resume and which to add.\n5. FORMATTING NOTES: Remind the user to maintain two versions: an ATS-friendly version (plain, single-column, standard section titles like Work Experience, Education, Skills) and a designed version for direct human contact. White space is essential. Save as PDF to preserve formatting.`,
  income:(pr,outs,sel)=>`You are building an Income Now plan for this professional. They are pursuing: **${sel}** as their longer-term goal and need income during the transition.\n\nPROFILE: ${outs.p1}\n${outs.p2}\n${outs.p3}\nPASSIONS: ${pr.passions}\nLOCATION: ${pr.loc.country}${pr.loc.city?', '+pr.loc.city:''} | WORK: ${pr.loc.work}\n\nSTART your response with:\n## QUICK TAKEAWAY\n4-5 sentences: the fastest path to income for this person, the single best platform to start on and why, a realistic rate range, and the one thing to do in the next 48 hours. Plain language, no headers inside this section.\n\nThen continue with the full plan:\n\nFRAMING: Income Now lives in Familiar Ground — the senior, modernized version of what this person already does well. They do not need to reinvent themselves. They need to package what they know and make it easy for buyers to find and hire them quickly.\n\nPITCH PRINCIPLE: People buy painkillers, not vitamins. They act when something is hurting. Every service description and outreach message should name a real problem the buyer is living with right now. Lead with the pain. Follow with how this person fixes it. Close with what it costs. The buyer does not care about titles or tenure — they care whether their problem goes away.\n\n**PART 1 — WHERE TO SHOW UP**: Based on their specific background, identify 4-6 marketplaces and channels where this person can get in front of paying clients quickly. Think beyond the obvious — there are specialist platforms for nearly every senior function. Match these to their actual background.\n\nExamples by function: HR/talent/people leader: Catalant, Business Talent Group, Bolste, Learnerbly. Finance executive: Toptal Finance, Graphite, CFO Alliance, Paro. Tech/product executive: Toptal, Arc, Expert360, Gun.io. Marketing/brand/growth: GrowthMentor, Credo, Mayple, Expert360. Strategy/general management: Catalant, Business Talent Group, Umbrex. Sales/revenue leader: Bravado, Toptal, Sales Talent Agency. Board-ready executive: Boardlist, OnBoard, Bolste. Career/coaching/talent development: Coach.me, Clarity.fm, Maven, LinkedIn Services, direct outreach.\n\nFor each: platform name, why it fits this specific person, type of work available, realistic rate range, and the single first step to get listed or active.\n\n**PART 2 — YOUR CONSULTING PRESENCE**: Write ready-to-use copy this person can use across any of the platforms above or in direct outreach. Everything should be framed around buyer pain, not seller biography.\n\n- Positioning headline (under 100 characters — names the problem, not the person's background)\n- Bio (150 words, first person, opens with the pain the buyer has, closes with a specific outcome this person has delivered)\n- 4 specific service offerings. For each: a problem-first title (e.g. "When your best people are leaving and you don't know why" not "Retention Consulting"), the specific buyer, what the engagement includes, the outcome framed as money made/saved/risk removed, and price at senior market rates ($300-$500/hour advisory, $1,000-$3,000 for a defined deliverable, $4,000-$10,000 for a strategic engagement)\n- One outreach message: sentence 1 names the pain, sentences 2-3 connect one specific result from their background to that pain, sentence 4 asks for 15 minutes as a peer conversation. Plain language. No buzzwords.\n\n**PART 3 — FRACTIONAL PITCH**: One paragraph for cold LinkedIn or email. Same pain-first structure. Names the business problem, explains how they fix it, states cost and how to engage.\n\n**PART 4 — PASSION-ADJACENT OPPORTUNITIES**: 3 specific engagements at the intersection of their professional skills and stated passions that could generate income within 60 days. For each: the service, the buyer, why this person is credible to them, price, and one action to take this week.\n\n**PART 5 — THE ONE SHEET**: Problem-first throughout. Sections: The Problem I Solve (2 sentences), How I Help (3 service bullets with prices), Who I Work With, What Happens When We Work Together (2-3 outcomes as made money/saved money/mitigated risk), How to Start (rates, availability, contact).\n\n**PART 6 — FIRST 48 HOURS**: Exactly what to do in the next two days to have a profile live or an outreach message sent. Specific steps only.\n\nTone: direct and practical. Write everything as if it will be used today.`
}

const PHASES=[
  {id:0,label:'Orientation',color:'#8A9BB8',steps:['welcome','location','resume','assessment','values','reputation']},
  {id:1,label:'Know Your Value',color:'#C8924A',steps:['p1','p2','p3']},
  {id:2,label:'Explore Options',color:'#C8924A',steps:['p4','p5','decision']},
  {id:3,label:'Tell Your Story',color:'#C8924A',steps:['p6']},
  {id:4,label:'Find Your Market',color:'#C8924A',steps:['p7']},
  {id:5,label:'Get Ready',color:'#C8924A',steps:['p8','p_res','p9','complete']},
  {id:6,label:'Income Now',color:'#C8924A',steps:['income']},
]
const META={welcome:'Welcome',location:'Location & Work',resume:'Your Resume',assessment:'Assessments',values:'Values, Passions & Causes',reputation:'Reputation',p1:'Resume Analysis',p2:'Wiring & Compass',p3:'Brand Synthesis',p4:'The Wide View',p5:'The Deep Dive',decision:'Your Decision',p6:'Your Bridge Story',p7:'Go-to-Market',p8:'LinkedIn Remix',p_res:'Resume Refresh',p9:'Your Playbook',p10:'Your Playbook',complete:'Complete',income:'Income Now'}
const ALL=['welcome','location','resume','assessment','values','reputation','p1','p2','p3','p4','p5','decision','p6','p7','p8','p_res','p9','complete','income']

const S={
  title:{fontFamily:'Georgia,serif',fontSize:38,fontWeight:700,color:"#1A2540",margin:'0 0 14px',lineHeight:1.2},
  sub:{fontSize:18,color:C.gray,margin:'0 0 28px',lineHeight:1.7,maxWidth:700},
  card:{background:'#FFFFFF',border:`1px solid #E2E5EA`,borderLeft:`3px solid ${C.gold}`,borderRadius:10,padding:'32px 38px',marginBottom:20,boxShadow:'0 1px 3px rgba(0,0,0,0.06)'},
  label:{display:'block',fontSize:13,fontWeight:700,color:C.grayL,margin:'0 0 8px',letterSpacing:'1px',textTransform:'uppercase'},
  inp:{width:'100%',background:C.input,border:`1px solid ${C.border}`,borderRadius:8,padding:'12px 15px',color:C.cream,fontSize:16,fontFamily:'inherit',outline:'none',boxSizing:'border-box'},
  ta:{width:'100%',background:C.input,border:`1px solid ${C.border}`,borderRadius:8,padding:'12px 15px',color:C.cream,fontSize:16,fontFamily:'inherit',outline:'none',resize:'vertical',boxSizing:'border-box',lineHeight:1.6,minHeight:90},
  sel:{width:'100%',background:C.input,border:`1px solid ${C.border}`,borderRadius:8,padding:'12px 15px',color:C.cream,fontSize:16,fontFamily:'inherit',outline:'none',cursor:'pointer'},
  btn:{background:C.gold,color:C.bg,border:'none',borderRadius:8,padding:'12px 24px',fontSize:17,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'inline-flex',alignItems:'center',gap:8},
  sec:{background:'transparent',color:C.grayL,border:`1px solid ${C.border}`,borderRadius:8,padding:'11px 20px',fontSize:16,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'inline-flex',alignItems:'center',gap:8},
  sm:{background:'transparent',color:C.gray,border:`1px solid ${C.border}`,borderRadius:6,padding:'6px 13px',fontSize:13,cursor:'pointer',fontFamily:'inherit',display:'inline-flex',alignItems:'center',gap:5},
  out:{background:'#FFFFFF',border:`1px solid #E2E5EA`,borderLeft:`3px solid ${C.gold}`,borderRadius:10,padding:'32px 38px',marginTop:18,boxShadow:'0 1px 3px rgba(0,0,0,0.06)'},
  err:{background:`${C.err}15`,border:`1px solid ${C.err}40`,borderRadius:8,padding:'12px 16px',color:C.err,fontSize:15,marginTop:12,display:'flex',gap:8,alignItems:'flex-start'},
  note:{background:`${C.gold}12`,border:`1px solid ${C.gold}30`,borderRadius:8,padding:'14px 18px',color:C.goldL,fontSize:15,marginBottom:16,lineHeight:1.65},
  row:{display:'flex',gap:12,marginTop:24,flexWrap:'wrap'},
  field:{marginBottom:18},
  tag:(color)=>({display:'inline-block',background:`${color}18`,color,border:`1px solid ${color}35`,borderRadius:20,padding:'4px 13px',fontSize:12,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',marginBottom:14}),
  quote:{borderLeft:`3px solid ${C.gold}`,paddingLeft:18,color:C.gray,fontStyle:'italic',fontSize:16,lineHeight:1.75,margin:'20px 0'},
}

function Btn({onClick,disabled,secondary,small,children,style={}}){const base=small?S.sm:secondary?S.sec:S.btn;return <button style={{...base,opacity:disabled?0.5:1,...style}} onClick={onClick} disabled={disabled}>{children}</button>}
const QUOTES=[
  // Viktor Frankl — purpose, resilience
  {text:"Everything can be taken from a person but one thing: the last of the human freedoms — to choose one's attitude in any given set of circumstances.",author:"Viktor Frankl"},
  {text:"He who has a why to live can bear almost any how.",author:"Viktor Frankl"},
  {text:"Between stimulus and response there is a space. In that space is our power to choose our response.",author:"Viktor Frankl"},
  {text:"Life is never made unbearable by circumstances, but only by lack of meaning and purpose.",author:"Viktor Frankl"},
  {text:"When we are no longer able to change a situation, we are challenged to change ourselves.",author:"Viktor Frankl"},
  {text:"Each person is questioned by life; and they can only answer to life by answering for their own life.",author:"Viktor Frankl"},
  {text:"The meaning of life is to give life meaning.",author:"Viktor Frankl"},
  // Stephen Covey — purpose, service
  {text:"Begin with the end in mind.",author:"Stephen Covey"},
  {text:"The key is not to prioritize what's on your schedule, but to schedule your priorities.",author:"Stephen Covey"},
  {text:"Seek first to understand, then to be understood.",author:"Stephen Covey"},
  {text:"Proactive people carry their own weather with them.",author:"Stephen Covey"},
  {text:"Most of us spend too much time on what is urgent and not enough time on what is important.",author:"Stephen Covey"},
  {text:"I am not a product of my circumstances. I am a product of my decisions.",author:"Stephen Covey"},
  {text:"Trust is the glue of life. It's the most essential ingredient in effective communication.",author:"Stephen Covey"},
  // John Wooden — resilience, purpose, courage
  {text:"Success is peace of mind which is a direct result of self-satisfaction in knowing you made the effort to become the best you are capable of becoming.",author:"John Wooden"},
  {text:"Don't let what you cannot do interfere with what you can do.",author:"John Wooden"},
  {text:"It's not what you know, it's what you use that makes a difference.",author:"John Wooden"},
  {text:"Things turn out best for the people who make the best of the way things turn out.",author:"John Wooden"},
  {text:"Never mistake activity for achievement.",author:"John Wooden"},
  {text:"Ability may get you to the top, but it takes character to keep you there.",author:"John Wooden"},
  {text:"Be more concerned with your character than your reputation, because your character is what you really are.",author:"John Wooden"},
  // John Maxwell — leadership, purpose, courage
  {text:"Leaders must be close enough to relate to others, but far enough ahead to motivate them.",author:"John Maxwell"},
  {text:"The pessimist complains about the wind. The optimist expects it to change. The leader adjusts the sails.",author:"John Maxwell"},
  {text:"Talent is a gift, but character is a choice.",author:"John Maxwell"},
  {text:"A leader is one who knows the way, goes the way, and shows the way.",author:"John Maxwell"},
  {text:"The greatest day in your life and mine is when we take total responsibility for our attitudes.",author:"John Maxwell"},
  {text:"You will never change your life until you change something you do daily.",author:"John Maxwell"},
  {text:"Small disciplines repeated with consistency every day lead to great achievements gained slowly over time.",author:"John Maxwell"},
  // Angela Duckworth — grit, resilience, purpose
  {text:"Enthusiasm is common. Endurance is rare.",author:"Angela Duckworth"},
  {text:"Grit is living life like it's a marathon, not a sprint.",author:"Angela Duckworth"},
  {text:"Our potential is one thing. What we do with it is quite another.",author:"Angela Duckworth"},
  {text:"The real obstacle to self-control isn't knowing what to do but doing what you know.",author:"Angela Duckworth"},
  {text:"At its core, the idea of grit is simple. Interests, practice, purpose, and hope.",author:"Angela Duckworth"},
  {text:"Nobody wants to show you the hours and hours of becoming. They'd rather show you the highlight reel.",author:"Angela Duckworth"},
  {text:"Greatness is doing the right things over and over until they become natural.",author:"Angela Duckworth"},
  // Simon Sinek — purpose, service, courage
  {text:"Start with why.",author:"Simon Sinek"},
  {text:"Working hard for something we don't care about is called stress. Working hard for something we love is called passion.",author:"Simon Sinek"},
  {text:"The goal is not to be perfect by the end. The goal is to be better today.",author:"Simon Sinek"},
  {text:"Leadership is not about being in charge. It is about taking care of those in your charge.",author:"Simon Sinek"},
  {text:"Dream big. Start small. But most of all, start.",author:"Simon Sinek"},
  {text:"The courage to admit what we don't know is the beginning of wisdom.",author:"Simon Sinek"},
  {text:"People don't buy what you do; they buy why you do it.",author:"Simon Sinek"},
  // Maya Angelou — resilience, courage, purpose
  {text:"You may not control all the events that happen to you, but you can decide not to be reduced by them.",author:"Maya Angelou"},
  {text:"Nothing will work unless you do.",author:"Maya Angelou"},
  {text:"We may encounter many defeats but we must not be defeated.",author:"Maya Angelou"},
  {text:"I've learned that people will forget what you said, people will forget what you did, but people will never forget how you made them feel.",author:"Maya Angelou"},
  {text:"My mission in life is not merely to survive, but to thrive.",author:"Maya Angelou"},
  {text:"Success is liking yourself, liking what you do, and liking how you do it.",author:"Maya Angelou"},
  {text:"If you don't like something, change it. If you can't change it, change your attitude.",author:"Maya Angelou"},
  // Nelson Mandela — resilience, courage, purpose
  {text:"It always seems impossible until it's done.",author:"Nelson Mandela"},
  {text:"The greatest glory in living lies not in never falling, but in rising every time we fall.",author:"Nelson Mandela"},
  {text:"Education is the most powerful weapon which you can use to change the world.",author:"Nelson Mandela"},
  {text:"I never lose. I either win or I learn.",author:"Nelson Mandela"},
  {text:"Courage is not the absence of fear, but the triumph over it.",author:"Nelson Mandela"},
  {text:"Real leaders must be ready to sacrifice all for the freedom of their people.",author:"Nelson Mandela"},
  // Warren Buffett — patience, purpose, self-knowledge
  {text:"Someone is sitting in the shade today because someone planted a tree a long time ago.",author:"Warren Buffett"},
  {text:"The most important investment you can make is in yourself.",author:"Warren Buffett"},
  {text:"It takes 20 years to build a reputation and five minutes to ruin it.",author:"Warren Buffett"},
  {text:"The best thing I ever did was choose the right heroes.",author:"Warren Buffett"},
  {text:"I always knew I was going to be rich. I don't think I ever doubted it for a minute.",author:"Warren Buffett"},
  // Theodore Roosevelt — courage, resilience, service
  {text:"Do what you can, with what you have, where you are.",author:"Theodore Roosevelt"},
  {text:"It is not the critic who counts; not the man who points out how the strong man stumbles. The credit belongs to the man who is actually in the arena.",author:"Theodore Roosevelt"},
  {text:"Believe you can and you're halfway there.",author:"Theodore Roosevelt"},
  {text:"Keep your eyes on the stars, and your feet on the ground.",author:"Theodore Roosevelt"},
  {text:"Far and away the best prize that life offers is the chance to work hard at work worth doing.",author:"Theodore Roosevelt"},
  // Abraham Lincoln — resilience, purpose, courage
  {text:"Give me six hours to chop down a tree and I will spend the first four sharpening the axe.",author:"Abraham Lincoln"},
  {text:"I am not bound to win, but I am bound to be true.",author:"Abraham Lincoln"},
  {text:"The best way to predict your future is to create it.",author:"Abraham Lincoln"},
  {text:"Whatever you are, be a good one.",author:"Abraham Lincoln"},
  {text:"I walk slowly, but I never walk backward.",author:"Abraham Lincoln"},
  // Winston Churchill — resilience, courage
  {text:"Success is not final, failure is not fatal: it is the courage to continue that counts.",author:"Winston Churchill"},
  {text:"If you're going through hell, keep going.",author:"Winston Churchill"},
  {text:"The pessimist sees difficulty in every opportunity. The optimist sees opportunity in every difficulty.",author:"Winston Churchill"},
  {text:"We make a living by what we get, but we make a life by what we give.",author:"Winston Churchill"},
  {text:"Continuous effort — not strength or intelligence — is the key to unlocking our potential.",author:"Winston Churchill"},
  // Peter Drucker — purpose, service, effectiveness
  {text:"The best way to predict the future is to create it.",author:"Peter Drucker"},
  {text:"Efficiency is doing things right. Effectiveness is doing the right things.",author:"Peter Drucker"},
  {text:"What gets measured gets managed.",author:"Peter Drucker"},
  {text:"The purpose of a business is to create a customer.",author:"Peter Drucker"},
  {text:"Knowledge has to be improved, challenged, and increased constantly, or it vanishes.",author:"Peter Drucker"},
  {text:"The most important thing in communication is to hear what isn't being said.",author:"Peter Drucker"},
  // Jim Collins — purpose, resilience, discipline
  {text:"Good is the enemy of great.",author:"Jim Collins"},
  {text:"The signature of mediocrity is not an unwillingness to change. It is chronic inconsistency.",author:"Jim Collins"},
  {text:"Great vision without great people is irrelevant.",author:"Jim Collins"},
  {text:"Greatness is not a function of circumstance. Greatness, it turns out, is largely a matter of conscious choice.",author:"Jim Collins"},
  // Marcus Aurelius — resilience, purpose, stoicism
  {text:"You have power over your mind — not outside events. Realize this, and you will find strength.",author:"Marcus Aurelius"},
  {text:"The impediment to action advances action. What stands in the way becomes the way.",author:"Marcus Aurelius"},
  {text:"Waste no more time arguing what a good person should be. Be one.",author:"Marcus Aurelius"},
  {text:"Accept the things to which fate binds you, and love the people with whom fate brings you together.",author:"Marcus Aurelius"},
  {text:"Very little is needed to make a happy life; it is all within yourself, in your way of thinking.",author:"Marcus Aurelius"},
  // Daniel Pink — motivation, purpose, curiosity
  {text:"The most successful people are not those who eliminate fear but those who act despite it.",author:"Daniel Pink"},
  {text:"Goals that people set for themselves and that are devoted to attaining mastery are usually healthy.",author:"Daniel Pink"},
  {text:"Human beings have an innate inner drive to be autonomous, self-determined, and connected to one another.",author:"Daniel Pink"},
  // Adam Grant — curiosity, resilience, service
  {text:"The hallmark of originality is rejecting the default and exploring whether a better option exists.",author:"Adam Grant"},
  {text:"In a world that changes faster than ever, we cannot just accumulate knowledge — we need to question it.",author:"Adam Grant"},
  {text:"The greatest communicators don't talk at people. They think with them.",author:"Adam Grant"},
  {text:"Rethinking is a skill. The ability to update beliefs and strategies is a competitive advantage.",author:"Adam Grant"},
]

const SHUFFLED_QUOTES=(()=>{const a=[...QUOTES];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a})()
function Loading({msg='Generating your analysis…'}){
  const[qi,setQi]=useState(0)
  useEffect(()=>{const t=setInterval(()=>setQi(i=>(i+1)%SHUFFLED_QUOTES.length),8000);return()=>clearInterval(t)},[])
  const q=SHUFFLED_QUOTES[qi]
  return <div style={{textAlign:'center',padding:'48px 24px',maxWidth:560,margin:'0 auto'}}>
    <Loader2 size={28} style={{color:C.gold,animation:'spin 0.9s linear infinite',margin:'0 auto 20px',display:'block'}}/>
    <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>
    <div style={{fontSize:18,color:C.grayL,marginBottom:28}}>{msg}</div>
    <div style={{borderLeft:`3px solid ${C.gold}`,paddingLeft:20,textAlign:'left',marginBottom:8}}>
      <div style={{fontSize:17,color:'#1A2540',lineHeight:1.7,fontStyle:'italic',marginBottom:8}}>"{q.text}"</div>
      <div style={{fontSize:14,color:C.gold,fontWeight:600}}>{q.author}</div>
    </div>
    <div style={{fontSize:13,color:C.gray,marginTop:20}}>This may take 1–2 minutes</div>
  </div>
}
function ErrBox({msg}){return <div style={S.err}><AlertCircle size={13} color={C.err} style={{flexShrink:0,marginTop:1}}/><span>{msg}</span></div>}
function FileUpload({label,hint,onFile,fileName,accept=".pdf,.doc,.docx,.txt"}){
  const ref=useRef();const[drag,setDrag]=useState(false)
  return <div style={S.field}>
    {label&&<span style={S.label}>{label}</span>}
    <div style={{border:`2px dashed ${drag?C.gold:C.border}`,borderRadius:10,padding:'22px',textAlign:'center',cursor:'pointer',background:drag?`${C.gold}08`:C.input,transition:'all 0.2s'}}
      onClick={()=>ref.current.click()} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)}
      onDrop={e=>{e.preventDefault();setDrag(false);if(e.dataTransfer.files[0])onFile(e.dataTransfer.files[0])}}>
      <input ref={ref} type="file" accept={accept} style={{display:'none'}} onChange={e=>e.target.files[0]&&onFile(e.target.files[0])}/>
      {fileName?<><div style={{color:C.ok,marginBottom:3,fontSize:14}}><Check size={12} style={{display:'inline',marginRight:5}}/>{fileName}</div><div style={{fontSize:13,color:C.gray}}>Click to replace</div></>:<><Upload size={17} color={C.gray} style={{margin:'0 auto 7px',display:'block'}}/><div style={{fontSize:15,color:C.grayL}}>{hint||'Drop file or click to browse'}</div></>}
    </div>
  </div>
}
function OutPanel({text,onCopy,copied,expandLabel}){
  const[expanded,setExpanded]=useState(false)
  const marker='## QUICK TAKEAWAY'
  const idx=text?text.indexOf(marker):-1
  const hasTakeaway=idx!==-1
  let takeaway='',full=''
  if(hasTakeaway){
    const afterMarker=text.slice(idx+marker.length)
    const nextH=afterMarker.search(/\n#{1,3} [^Q\n]/)
    const nextHr=afterMarker.indexOf('\n---')
    const splitAt=nextHr!==-1&&(nextH===-1||nextHr<nextH)?nextHr:nextH
    if(splitAt!==-1){takeaway=afterMarker.slice(0,splitAt).trim();full=afterMarker.slice(splitAt).replace(/^[\n-]+/,'')}
    else{takeaway=afterMarker.trim();full=''}
  }
  return <div style={S.out}>
    <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}><Btn small onClick={()=>onCopy(text)}>{copied?<><CheckCheck size={11}/>Copied</>:<><Copy size={11}/>Copy All</>}</Btn></div>
    {hasTakeaway&&full?<>
      <MD text={`## QUICK TAKEAWAY\n${takeaway}`}/>
      <button data-expand="true" onClick={()=>setExpanded(e=>!e)} style={{display:'flex',alignItems:'center',gap:8,margin:'20px 0 8px',padding:'12px 20px',background:expanded?`${C.gold}10`:'#F7F8FA',border:`1.5px solid ${expanded?C.gold:C.border}`,borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:15,fontWeight:600,color:expanded?C.goldL:C.gray,transition:'all 0.2s',width:'100%'}}>
        <ChevronRight size={16} style={{transform:expanded?'rotate(90deg)':'none',transition:'transform 0.2s'}}/>
        {expanded?'Hide full analysis':(expandLabel||'Click here for a deeper understanding')}
      </button>
      {expanded&&<div style={{marginTop:12,paddingTop:16,borderTop:`1px solid ${C.border}`}}><MD text={full}/></div>}
    </>:<MD text={text}/>}
  </div>
}

function RefineBox({value,onChange,onRegenerate}){
  const[open,setOpen]=useState(false)
  return <div style={{marginTop:16,border:`2px solid ${C.border}`,borderRadius:12,overflow:'hidden',background:'#F7F8FA'}}>
    <button onClick={()=>setOpen(o=>!o)} style={{width:'100%',background:'transparent',border:'none',padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:8,height:8,borderRadius:'50%',background:C.gold,flexShrink:0}}/>
        <span style={{fontSize:18,fontWeight:600,color:'#1A2540'}}>Want to make changes?</span>
        <span style={{fontSize:16,color:C.gray}}>Did we miss something? Add it here.</span>
      </div>
      <span style={{fontSize:12,color:C.gray,display:'inline-block',transform:open?'rotate(180deg)':'none',transition:'transform 0.2s',flexShrink:0}}>▼</span>
    </button>
    {open&&<div style={{background:'#FFFFFF',padding:'16px 20px',borderTop:`1px solid ${C.border}`}}>
      <div style={{fontSize:16,color:C.gray,marginBottom:12,lineHeight:1.65}}>If anything feels off — wrong tone, missing context, something we misread — describe it here and we'll adjust.</div>
      <textarea style={{...S.ta,minHeight:80}} value={value} onChange={e=>onChange(e.target.value)} placeholder="e.g. The seniority level feels too junior… you missed that I ran a P&L… the environment description doesn't match how I actually work…"/>
      <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
        <Btn onClick={()=>{setOpen(false);onRegenerate(value)}}><RotateCcw size={13}/>Regenerate with this context</Btn>
        <Btn secondary onClick={()=>{onChange('');setOpen(false);onRegenerate('')}}><RotateCcw size={13}/>Regenerate from scratch</Btn>
      </div>
    </div>}
  </div>
}
function Sidebar({step,done,onNav,isDemo}){return <div style={{width:260,background:'#1A2540',borderRight:`1px solid #0F1A30`,padding:'16px 0',overflowY:'auto',flexShrink:0}}>{PHASES.map(ph=><div key={ph.id} style={{marginBottom:6}}><div style={{fontSize:16,fontWeight:800,letterSpacing:'1.5px',textTransform:'uppercase',color:'#FFFFFF',padding:'14px 14px 8px',display:'flex',alignItems:'center',gap:8,borderBottom:`2px solid ${ph.color}`}}><div style={{width:8,height:8,borderRadius:'50%',background:ph.color}}/>{ph.label}</div>{ph.steps.map(sid=>{const active=step===sid,isDone=done.includes(sid),can=isDone||active||(sid==='income'&&done.includes('complete')),isComplete=sid==='complete'&&isDone;return <div key={sid} onClick={()=>can&&onNav(sid)} style={{padding:'9px 14px 9px 28px',display:'flex',alignItems:'center',gap:7,cursor:can?'pointer':'default',background:isComplete?'rgba(74,158,114,0.15)':active?(isDemo?`${C.gold}30`:`${ph.color}25`):'transparent',borderLeft:`2px solid ${isComplete?C.ok:active?(isDemo?C.gold:ph.color):'transparent'}`,fontSize:18,color:isComplete?'#6FCF97':active?'#FFFFFF':isDone?'#CBD5E0':'#718096',transition:'all 0.15s'}}><div style={{width:15,height:15,borderRadius:'50%',border:`1.5px solid ${isComplete?C.ok:active?(isDemo?C.gold:ph.color):isDone?'#4A9E72':'#4A5568'}`,background:isDone?'#4A9E72':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{isDone&&<Check size={8} color='#fff' strokeWidth={3}/>}</div><span style={{flex:1}}>{META[sid]}</span>{isDemo&&active&&<span style={{fontSize:10,fontWeight:800,letterSpacing:'0.5px',color:'#1A2540',background:C.gold,padding:'2px 8px',borderRadius:4,marginLeft:4,whiteSpace:'nowrap'}}>YOU ARE HERE</span>}</div>})}</div>)}</div>}

const DEMO_TOUR=[
  {step:'welcome',title:'Meet Sarah Chen',desc:''},
  {step:'p1',title:'Step 1: Know Your Value',desc:'Your experience has created more value than most resumes show. This step finds it and puts it in language any industry understands.'},
  {step:'p2',title:'Step 2: Wiring & Compass',desc:'Most people take assessments and file them away. This step connects how you\'re wired to the work you do best and the environment where you thrive.'},
  {step:'p3',title:'Step 3: Brand Synthesis',desc:'When someone asks "what do you do," most people default to a job title. This step gives you a better answer: what you do, why you are good at it, and how they produce meaningful outcomes.'},
  {step:'p4',title:'Step 4: The Wide View',desc:'Most people see one or two obvious next steps. This step maps out a wider landscape of options for you to consider.'},
  {step:'p5',title:'Step 5: The Deep Dive',desc:'It\'s easy to get excited about an option on paper. This step shows what the role actually looks like and how your background maps to it.'},
  {step:'decision',title:'Step 6: Sarah\'s Decision',desc:'Having multiple strong options is a good problem to have. This is the moment you choose a direction and everything starts pointing the same way.'},
  {step:'p6',title:'Step 7: Bridge Story',desc:'"Tell me about yourself" is the first question in every interview, and a great 30-second answer sets the tone for the entire conversation.'},
  {step:'p7',title:'Step 8: Go-to-Market',desc:'Most people start their search on job boards, waiting for the right posting to appear. The best opportunities are filled through relationships before a posting ever goes live.'},
  {step:'p8',title:'Step 9: LinkedIn Remix',desc:'Your LinkedIn profile is how companies and recruiters find you. If it still describes your last role, the right people can\'t find you for the next one.'},
  {step:'p_res',title:'Step 10: Resume Refresh',desc:'The people reading your resume now are looking for different signals than the ones who hired you last time.'},
  {step:'p9',title:'Step 11: Your Playbook',desc:'Walking into a conversation in a new space without knowing the vocabulary or the current landscape costs credibility fast.'},
  {step:'income',title:'Bonus: Income Now',desc:'A job search takes time. Having income flowing while you search changes everything: you make better decisions when you\'re choosing, not settling.'},
]

export default function PivotEngine(){
  const isDemo=new URLSearchParams(window.location.search).get('demo')==='true'
  const IP={loc:{country:'',city:'',work:''},resume:'',resumeFile:'',assess:'',assessFile:'',assessType:'',values:'',passions:'',rep:{memory:'',emergency:'',twoWords:'',other:''}}
  const IO={p1:'',p2:'',p3:'',p4:'',p5:'',p6:'',p7:'',p8:'',p_res:'',p9:'',p10:'',income:''}
  const[step,setStep]=useState(isDemo?'welcome':'welcome')
  const[profile,setProfile]=useState(isDemo?demoProfile:IP)
  const[outputs,setOutputs]=useState(isDemo?demoOutputs:IO)
  const[done,setDone]=useState(isDemo?[...demoDone]:[])
  const[deepOpts,setDeepOpts]=useState(isDemo?[...demoDeepOpts]:['','',''])
  const[chosen,setChosen]=useState(isDemo?demoChosen:'')
  const[demoIdx,setDemoIdx]=useState(0)
  const[activeTab,setActiveTab]=useState(0)
  const[feedback,setFeedback]=useState({p1:'',p2:'',p3:'',p4:'',p5:''})
  const setFb=(k,v)=>setFeedback(f=>({...f,[k]:v}))
  const[loading,setLoading]=useState(false)
  const[loadMsg,setLoadMsg]=useState('')
  const[err,setErr]=useState(null)
  const[copied,setCopied]=useState(false)
  const[csvCopied,setCsvCopied]=useState(false)
  const[deepExpanded,setDeepExpanded]=useState(false)
  const[fileLoading,setFileLoading]=useState(false)
  const[surveyDone,setSurveyDone]=useState(isDemo)
  const[survey,setSurvey]=useState({nps:null,valuable:'',confidence:null,accuracy:null,open:''})
  const[surveySubmitted,setSurveySubmitted]=useState(false)
  const[surveySubmitting,setSurveySubmitting]=useState(false)
  const setSv=(k,v)=>setSurvey(s=>({...s,[k]:v}))
  const importFileRef=useRef()

  useEffect(()=>{if(isDemo)return;const load=async()=>{try{const r=localStorage.getItem('pe_v3');if(r){const d=JSON.parse(r);if(d.step)setStep(d.step);if(d.profile)setProfile(d.profile);if(d.outputs)setOutputs(d.outputs);if(d.done)setDone(d.done);if(d.deepOpts)setDeepOpts(d.deepOpts);if(d.chosen)setChosen(d.chosen)}}catch{}};load()},[])
  useEffect(()=>{if(isDemo)return;const save=async()=>{try{localStorage.setItem('pe_v3',JSON.stringify({step,profile,outputs,done,deepOpts,chosen}))}catch{}};const t=setTimeout(save,800);return()=>clearTimeout(t)},[step,profile,outputs,done,deepOpts,chosen])

  const pr=(f,v)=>setProfile(p=>({...p,[f]:v}))
  const loc=(f,v)=>setProfile(p=>({...p,loc:{...p.loc,[f]:v}}))
  const rep=(f,v)=>setProfile(p=>({...p,rep:{...p.rep,[f]:v}}))
  const out=(k,v)=>setOutputs(o=>({...o,[k]:v}))
  const markDone=(sid)=>setDone(d=>d.includes(sid)?d:[...d,sid])
  const advance=(from,to)=>{markDone(from);setStep(to);setErr(null);window.scrollTo(0,0)}
  const nav=(to)=>{if(isDemo){const idx=DEMO_TOUR.findIndex(t=>t.step===to);if(idx>=0){setDemoIdx(idx);setStep(to)}return}setStep(to);setErr(null);window.scrollTo(0,0)}
  const demoNext=()=>{if(demoIdx<DEMO_TOUR.length-1){const next=demoIdx+1;setDemoIdx(next);setStep(DEMO_TOUR[next].step);window.scrollTo(0,0)}}
  const demoPrev=()=>{if(demoIdx>0){const prev=demoIdx-1;setDemoIdx(prev);setStep(DEMO_TOUR[prev].step);window.scrollTo(0,0)}}
  const generate=async(key,fn,opts={})=>{setLoading(true);setErr(null);setLoadMsg(opts.msg||'Generating your analysis…');try{const r=await callClaude(fn(),opts);out(key,r)}catch(e){setErr(e.message)}finally{setLoading(false)}}
  const copy=(text)=>{navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000)}
  const reset=async()=>{if(confirm('Reset all progress and start over?')){try{localStorage.removeItem('pe_v3')}catch{};setStep('welcome');setProfile(IP);setOutputs(IO);setDone([]);setDeepOpts(['','','']);setChosen('');setFeedback({p1:'',p2:'',p3:'',p4:'',p5:''})}}
  const exportProfile=()=>{const data={profile,outputs,done,deepOpts,chosen};const json=JSON.stringify(data,null,2);const blob=new Blob([json],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');const date=new Date().toISOString().split('T')[0];a.href=url;a.download=`reimagine-profile-${date}.json`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url)};
  const importProfile=(file)=>{const reader=new FileReader();reader.onload=e=>{try{const data=JSON.parse(e.target.result);if(data.profile)setProfile(data.profile);if(data.outputs)setOutputs(data.outputs);if(data.done)setDone(data.done);if(data.deepOpts)setDeepOpts(data.deepOpts);if(data.chosen)setChosen(data.chosen);const lastStep=data.done&&data.done.length>0?data.done[data.done.length-1]:'welcome';setStep(lastStep);setErr(null)}catch(err){setErr('Failed to import profile. Please check the file format.')}};reader.onerror=()=>setErr('Failed to read file.');reader.readAsText(file)}
  const prog=Math.round((ALL.indexOf(step)/(ALL.length-1))*100)
  const pc={loc:profile.loc,resume:profile.resume,assess:profile.assess,assessType:profile.assessType,values:profile.values,passions:profile.passions,rep:profile.rep}

  const rStep=()=>{switch(step){
    case'welcome':return isDemo?<div>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 180" width="380" height="132" fontFamily="Inter,-apple-system,Segoe UI,Roboto,sans-serif" style={{display:'block',marginBottom:16}}>
        <circle cx="44" cy="60" r="28" fill="#e4572e" opacity="0.18"/>
        <circle cx="44" cy="60" r="18" fill="#e4572e"/>
        <text x="92" y="80" fontSize="72" fontWeight="900" letterSpacing="-2.5" fill="#0e1a2b">Re<tspan fill="#e4572e">imagine</tspan></text>
        <text x="92" y="132" fontSize="26" fontWeight="700" letterSpacing="-0.3" fill="#55617a">Your <tspan fontWeight="800" fill="#0e1a2b">Career</tspan>. Your <tspan fontWeight="900" fill="#e4572e">Future</tspan>.</text>
      </svg>

      <div style={{...S.card,marginBottom:24,background:'#FAFBFC',borderLeft:`3px solid ${C.gold}`,padding:'36px 40px'}}>
        <div style={{display:'flex',gap:28,alignItems:'flex-start'}}>
          <img src="/sarah-chen.jpg" alt="Sarah Chen" style={{width:110,height:110,borderRadius:'50%',objectFit:'cover',flexShrink:0,border:`3px solid ${C.gold}40`}} onError={e=>{e.target.style.display='none'}}/>
          <div style={{flex:1}}>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:28,fontWeight:700,color:'#1A2540',margin:'0 0 14px'}}>Meet Sarah Chen</h2>
            <p style={{fontSize:18,color:'#2D3748',lineHeight:1.75,marginBottom:16}}>Sarah is a VP of Talent Acquisition in healthcare with 15 years of experience. She came to Reimagine with her resume, a CliftonStrengths assessment, and a sense that her next chapter should look different.</p>
            <p style={{fontSize:18,color:'#2D3748',lineHeight:1.75,marginBottom:0}}>What follows is what Reimagine built for her: a complete career strategy from personal brand through go-to-market plan. Every section is real output. Use <strong>Next</strong> to walk through each step.</p>
          </div>
        </div>
      </div>
    </div>:<div>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 180" width="380" height="132" fontFamily="Inter,-apple-system,Segoe UI,Roboto,sans-serif" style={{display:'block',marginBottom:8}}>
        <circle cx="44" cy="60" r="28" fill="#e4572e" opacity="0.18"/>
        <circle cx="44" cy="60" r="18" fill="#e4572e"/>
        <text x="92" y="80" fontSize="72" fontWeight="900" letterSpacing="-2.5" fill="#0e1a2b">Re<tspan fill="#e4572e">imagine</tspan></text>
        <text x="92" y="132" fontSize="26" fontWeight="700" letterSpacing="-0.3" fill="#55617a">Your <tspan fontWeight="800" fill="#0e1a2b">Career</tspan>. Your <tspan fontWeight="900" fill="#e4572e">Future</tspan>.</text>
      </svg>
      <div style={{display:'flex',gap:32,alignItems:'flex-start',marginBottom:28}}>
        <p style={{fontSize:20,fontWeight:500,color:'#1A2540',lineHeight:1.75,flex:1,margin:0}}>If your search feels stuck, <span style={{fontWeight:700,color:'#e4572e'}}>you are not the problem.</span> It's that you can't see all the places your experience could take you. <span style={{fontWeight:700,color:'#e4572e'}}>Reimagine</span> takes what you've done, how you're wired, and what you care about to help you land a rewarding role faster than you imagined. Reimagine your career now.</p>
        <a href="/?demo=true" style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,padding:'24px 32px',background:`linear-gradient(135deg, ${C.gold}, #D4A55A)`,borderRadius:12,textDecoration:'none',flexShrink:0,boxShadow:'0 4px 12px rgba(200,146,74,0.3)',minWidth:200,textAlign:'center'}}>
          <span style={{fontSize:28,lineHeight:1}}>&#9654;</span>
          <span style={{fontSize:18,fontWeight:700,color:'#fff',lineHeight:1.3}}>See a completed<br/>example first</span>
          <span style={{fontSize:14,color:'#fff',opacity:0.85}}>Walk through Sarah's results</span>
        </a>
      </div>

      <div style={{...S.card,marginBottom:20}}>
        <div style={{fontSize:20,fontWeight:800,color:'#1A2540',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:18,paddingBottom:12,borderBottom:`2px solid ${C.gold}`}}>Before You Begin</div>
        {[
          ['Your resume','Any format. It doesn\'t need to be polished. We\'ll help you get the most out of it.'],
          ['An assessment (recommended)','If you have CliftonStrengths, Myers-Briggs, DiSC, Hogan, or any other assessment from the last three years, bring it. If yours is older or you haven\'t taken one, Affintus is free and takes 15 minutes.'],
          ['About 20–30 minutes','That covers the intake questions and your first set of results. You can save and return at any point. Your progress is stored automatically in this browser on this device, so come back the same way you started.'],
        ].map(([t,d])=><div key={t} style={{display:'flex',gap:14,marginBottom:16,alignItems:'flex-start'}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:C.gold,flexShrink:0,marginTop:9}}/>
          <div><span style={{fontWeight:700,fontSize:18,color:'#1A2540'}}>{t}. </span><span style={{fontSize:18,color:'#2D3748',lineHeight:1.7}}>{d}</span></div>
        </div>)}
        <div style={{marginTop:8,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
          <a href="https://affintus.com/job-seekers/" target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',gap:8,padding:'12px 20px',background:'#C8924A10',border:`1px solid #C8924A40`,borderRadius:8,color:C.goldL,fontSize:16,fontWeight:600,textDecoration:'none'}}>Don't have an assessment already? Take the free Affintus assessment →</a>
        </div>
      </div>

      <div style={{...S.card,marginBottom:20}}>
        <div style={{fontSize:20,fontWeight:800,color:'#1A2540',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:18,paddingBottom:12,borderBottom:`2px solid ${C.gold}`}}>How It Works</div>
        {[
          ['1','Know Your Value','Your experience has created more value than most resumes show. We find it and put it in language any industry understands.','#8A7AB8'],
          ['2','Explore Options','After years in one role, it\'s easy to see only the obvious next step. We map three paths and go deep on the ones that resonate.','#6AB88A'],
          ['3','Tell Your Story','A great answer to "tell me about yourself" sets the tone for every conversation. We write your bridge story and prepare you for the questions that will come up.','#C8924A'],
          ['4','Find Your Market','The best opportunities are filled through relationships before a posting goes live. We search in real time for companies that fit and draft your outreach.','#B86A6A'],
          ['5','Get Ready','Your LinkedIn, your resume, your playbook for the new space, and interview prep for the questions that will come up. You walk in ready.','#6A8AB8'],
        ].map(([num,phase,desc,color])=><div key={num} style={{display:'flex',gap:16,marginBottom:20,alignItems:'flex-start'}}>
          <div style={{width:34,height:34,borderRadius:'50%',background:`${color}25`,border:`2px solid ${color}60`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:17,fontWeight:700,color}}>
            {num}
          </div>
          <div style={{flex:1}}>
            <span style={{fontWeight:700,fontSize:19,color:'#1A2540'}}>{phase}</span>
            <div style={{fontSize:17,color:'#2D3748',lineHeight:1.7,marginTop:4}}>{desc}</div>
          </div>
        </div>)}
      </div>

      <div style={{...S.card,marginBottom:20}}>
        <div style={{fontSize:20,fontWeight:800,color:'#1A2540',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:18,paddingBottom:12,borderBottom:`2px solid ${C.gold}`}}>The Framework</div>
        <p style={{fontSize:18,color:'#2D3748',lineHeight:1.7,marginBottom:18}}>Everything in Reimagine is built on a framework called the 4 C's. It goes in order, and each step builds on the one before it.</p>
        {[
          ['Convictions','What is actually, demonstrably true about you: your values, your wiring, your track record, and what people consistently say about you.'],
          ['Clarity','When your convictions are solid, the right opportunities become visible, and you can make better choices about where to focus.'],
          ['Confidence','Evidence-based self-belief. When you can point to real evidence of who you are and what you\'ve done, you carry that into every conversation.'],
          ['Contagious','When you believe, others believe too. That\'s the natural result of Convictions, Clarity, and Confidence.'],
        ].map(([t,d])=><div key={t} style={{display:'flex',gap:14,marginBottom:16,alignItems:'flex-start'}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:C.gold,flexShrink:0,marginTop:10}}/>
          <div><span style={{fontWeight:700,fontSize:18,color:'#1A2540'}}>{t}. </span><span style={{fontSize:18,color:'#2D3748',lineHeight:1.7}}>{d}</span></div>
        </div>)}
        <p style={{fontSize:18,color:'#2D3748',lineHeight:1.7,marginTop:16,paddingTop:14,borderTop:`1px solid ${C.border}`,fontWeight:500}}>Everything that follows is building that foundation with you.</p>
      </div>

      <div style={{...S.card,marginBottom:24}}>
        <div style={{fontSize:20,fontWeight:800,color:'#1A2540',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:18,paddingBottom:12,borderBottom:`2px solid ${C.gold}`}}>A Few Things Worth Knowing</div>
        {[
          ['This is iterative, not linear.','Every output has a "Does this feel right?" option. If something is off, tell us and we\'ll adjust before moving on.'],
          ['There are no wrong answers in the intake.','The questions about your passions and values are not trick questions. Answer them honestly, not strategically.'],
          ['You only need one new job.','Reimagine is designed to open more doors than you might have imagined, so you can find the right one with confidence.'],
        ].map(([t,d])=><div key={t} style={{display:'flex',gap:14,marginBottom:16,alignItems:'flex-start'}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:C.gold,flexShrink:0,marginTop:9}}/>
          <div><span style={{fontWeight:700,fontSize:18,color:'#1A2540'}}>{t} </span><span style={{fontSize:18,color:'#2D3748',lineHeight:1.7}}>{d}</span></div>
        </div>)}
      </div>

      <div style={S.row}>
        {!isDemo&&<>
          <Btn onClick={()=>advance('welcome','location')}>Let's get started <ChevronRight size={14}/></Btn>
          <input ref={importFileRef} type="file" accept=".json" style={{display:'none'}} onChange={e=>e.target.files[0]&&importProfile(e.target.files[0])}/>
          <Btn secondary onClick={()=>importFileRef.current?.click()}><Upload size={14}/>Load saved profile</Btn>
        </>}
      </div>
    </div>

    case'location':return <div>
      <div style={S.tag('#8A9BB8')}>Phase 0 · Orientation</div>
      <h1 style={S.title}>Location & Work Preferences</h1>
      <p style={S.sub}>This shapes every opportunity we generate and every company we identify.</p>
      <div style={S.card}>
        <div style={S.field}><label style={S.label}>Country / Region</label><input style={S.inp} value={profile.loc.country} onChange={e=>loc('country',e.target.value)} placeholder="e.g. United States, United Kingdom, Germany"/></div>
        <div style={S.field}><label style={S.label}>City or Metro <span style={{color:C.gray,fontWeight:400,textTransform:'none',letterSpacing:0}}>(optional)</span></label><input style={S.inp} value={profile.loc.city} onChange={e=>loc('city',e.target.value)} placeholder="e.g. Chicago, Greater London, Munich metro"/></div>
        <div style={S.field}><label style={S.label}>Work Arrangement</label>
          <select style={S.sel} value={profile.loc.work} onChange={e=>loc('work',e.target.value)}>
            <option value="">Select…</option>
            <option>Fully remote — location is no constraint</option>
            <option>Hybrid — within commuting distance of home base</option>
            <option>On-site — open to commuting daily</option>
            <option>Open to relocation — willing to move for the right opportunity</option>
            <option>Open to relocation with conditions</option>
          </select>
        </div>
      </div>
      {err&&<ErrBox msg={err}/>}
      <div style={S.row}><Btn secondary onClick={()=>nav('welcome')}><ArrowLeft size={13}/>Back</Btn><Btn onClick={()=>profile.loc.country&&profile.loc.work?advance('location','resume'):setErr('Please complete your country and work preference.')}>Continue <ChevronRight size={14}/></Btn></div>
    </div>

    case'resume':return <div>
      <div style={S.tag('#8A9BB8')}>Phase 0 · Orientation</div>
      <h1 style={S.title}>Your Resume</h1>
      <p style={S.sub}>Upload your most recent resume. It doesn't need to be perfect — finding the value you may have undersold is part of what we do here.</p>
      <div style={S.card}>
        <FileUpload label="Upload Resume" hint="PDF, Word (.docx), or text file" fileName={profile.resumeFile} onFile={async f=>{pr('resumeFile',f.name);setFileLoading(true);try{const t=await extractText(f);pr('resume',t);setErr(null)}catch(e){setErr(e.message)}finally{setFileLoading(false)}}}/>
        {fileLoading&&<Loading msg="Reading your file…"/>}
        <div style={S.field}><label style={S.label}>Or paste resume text</label><textarea style={{...S.ta,minHeight:160}} value={profile.resume} onChange={e=>pr('resume',e.target.value)} placeholder="Paste your resume text here…"/></div>
        {profile.resume&&<div style={{fontSize:14,color:C.ok}}><Check size={11} style={{display:'inline',marginRight:4}}/>{profile.resume.length.toLocaleString()} characters loaded</div>}
      </div>
      {err&&<ErrBox msg={err}/>}
      <div style={S.row}><Btn secondary onClick={()=>nav('location')}><ArrowLeft size={13}/>Back</Btn><Btn onClick={()=>profile.resume?advance('resume','assessment'):setErr('Please provide your resume.')}>Continue <ChevronRight size={14}/></Btn></div>
    </div>

    case'assessment':return <div>
      <div style={S.tag('#8A9BB8')}>Phase 0 · Orientation</div>
      <h1 style={S.title}>Assessment Data</h1>
      <p style={S.sub}>Most people either don't know how they're naturally wired, or can't connect it to the work they do best. This closes that gap.</p>
      <div style={S.card}>
        <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
          {[['Affintus (Free)','affintus.com/job-seekers'],['CliftonStrengths','~$25 · gallup.com'],['DiSC','discprofile.com']].map(([n,l])=><div key={n} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px'}}><div style={{fontWeight:600,color:C.cream,fontSize:12,marginBottom:1}}>{n}</div><div style={{fontSize:11,color:C.gray}}>{l}</div></div>)}
        </div>
        <div style={S.note}><strong style={{color:C.gold}}>Strongly recommended:</strong> Take Affintus before continuing — free, ~15 minutes, the most important investment you'll make before we start. <a href="https://affintus.com/job-seekers/" target="_blank" rel="noopener" style={{color:C.goldL}}>Open Affintus →</a></div>
        <FileUpload label="Upload Assessment (any format)" hint="Hogan, PI, MBTI, Enneagram — anything works" fileName={profile.assessFile} onFile={async f=>{pr('assessFile',f.name);setFileLoading(true);try{const t=await extractText(f);pr('assess',t)}catch(e){setErr(e.message)}finally{setFileLoading(false)}}}/>
        {fileLoading&&<Loading msg="Reading file…"/>}
        <div style={S.field}><label style={S.label}>Assessment Type</label><select style={S.sel} value={profile.assessType} onChange={e=>pr('assessType',e.target.value)}><option value="">Select…</option><option>Affintus</option><option>CliftonStrengths</option><option>DiSC</option><option>Myers-Briggs (MBTI)</option><option>Hogan</option><option>Predictive Index</option><option>Enneagram</option><option>Other</option></select></div>
        <div style={S.field}><label style={S.label}>Or paste results here</label><textarea style={{...S.ta,minHeight:130}} value={profile.assess} onChange={e=>pr('assess',e.target.value)} placeholder="Paste assessment results — any format works. More detail = more personalized output."/></div>
      </div>
      {err&&<ErrBox msg={err}/>}
      <div style={S.row}><Btn secondary onClick={()=>nav('resume')}><ArrowLeft size={13}/>Back</Btn><Btn onClick={()=>profile.assess?advance('assessment','values'):setErr('Assessment data is required to continue.')}>Continue <ChevronRight size={14}/></Btn></div>
    </div>

    case'values':return <div>
      <div style={S.tag('#8A9BB8')}>Phase 0 · Orientation</div>
      <h1 style={S.title}>Values, Passions & Causes</h1>
      <p style={S.sub}>These two inputs separate a list of plausible options from a list of right options. Don't filter for professional relevance — that's our job.</p>
      <div style={S.card}>
        <div style={S.field}><label style={S.label}>Core Values — 3 to 5 non-negotiables</label><div style={{fontSize:15,color:C.gray,marginBottom:7,lineHeight:1.6}}>The conditions under which you do your best work and feel most like yourself.</div><textarea style={{...S.ta,minHeight:70}} value={profile.values} onChange={e=>pr('values',e.target.value)} placeholder="e.g. Independence, Family, Justice, Stability, Wealth creation, Cooperation, Service, Faith, Intellectual challenge…"/></div>
        <div style={S.field}><label style={S.label}>Passions, Interests & Causes — 3 to 5 things you care about</label><div style={{fontSize:15,color:C.gray,marginBottom:7,lineHeight:1.6}}>What do you read about for fun, volunteer your time for, or could talk about for 30 minutes with zero preparation? Include hobbies, industries that fascinate you, communities you belong to, and causes close to your heart.</div><textarea style={{...S.ta,minHeight:70}} value={profile.passions} onChange={e=>pr('passions',e.target.value)} placeholder="e.g. Youth mentoring, Formula 1, Fintech, Sustainability, Veterans' employment, Youth sports, Faith-based service, Addiction recovery, Women in leadership, Gaming, Geopolitics…"/></div>
      </div>
      {err&&<ErrBox msg={err}/>}
      <div style={S.row}><Btn secondary onClick={()=>nav('assessment')}><ArrowLeft size={13}/>Back</Btn><Btn onClick={()=>profile.values&&profile.passions?advance('values','reputation'):setErr('Please fill in both fields.')}>Continue <ChevronRight size={14}/></Btn></div>
    </div>

    case'reputation':return <div>
      <div style={S.tag('#8A9BB8')}>Phase 0 · Orientation</div>
      <h1 style={S.title}>Your Reputation</h1>
      <p style={S.sub}>The hardest input to gather — and the most valuable. We're looking for external data: what others actually see in you.</p>
      <div style={S.card}>
        {[['memory','The Memory',"Think of a specific moment at work when someone thanked you or praised you. What was the situation and what did they say?"],['emergency','The Emergency Call','If your former team had a critical problem right now, what type of situation would they call you to handle?'],['twoWords','The Two Words','If your best former manager described your professional superpower in exactly two words, what would they be?'],['other','Additional Feedback','Performance reviews, LinkedIn recommendations, 360 feedback — paste anything here.']].map(([f,lbl,hint])=><div key={f} style={S.field}><label style={S.label}>{lbl}</label><div style={{fontSize:15,color:C.gray,marginBottom:7,lineHeight:1.6}}>{hint}</div><textarea style={{...S.ta,minHeight:f==='other'?90:62}} value={profile.rep[f]} onChange={e=>rep(f,e.target.value)}/></div>)}
        <div style={{fontSize:14,color:C.gray,fontStyle:'italic'}}>If you leave all blank, we'll generate a reputation hypothesis from your other data and ask you to validate it.</div>
      </div>
      <div style={S.row}><Btn secondary onClick={()=>nav('values')}><ArrowLeft size={13}/>Back</Btn><Btn onClick={()=>advance('reputation','p1')}>Begin Phase 1 <ChevronRight size={14}/></Btn></div>
    </div>

    case'p1':return <div>
      {!isDemo&&<div style={S.tag('#C8924A')}>Phase 1 · Know Your Value</div>}
      <h1 style={S.title}>Resume Analysis</h1>
      {!isDemo&&<p style={S.sub}>Your experience has created more value than most resumes show. This step finds it and puts it in language any industry understands.</p>}
      {!isDemo&&!outputs.p1&&!loading&&<Btn onClick={()=>generate('p1',()=>P.p1(pc))}><Sparkles size={14}/>Analyze My Resume</Btn>}
      {loading&&<Loading msg={loadMsg||'Analyzing your career and translating accomplishments…'}/>}
      {outputs.p1&&<>
        <OutPanel text={outputs.p1} onCopy={copy} copied={copied}/>
        {!isDemo&&<RefineBox value={feedback.p1} onChange={v=>setFb('p1',v)} onRegenerate={v=>{out('p1','');generate('p1',()=>P.p1(pc)+(v?`\n\nUSER CONTEXT: ${v}`:''))}}/>}
        {!isDemo&&<div style={S.row}><Btn secondary onClick={()=>out('p1','')}><RotateCcw size={13}/>Regenerate</Btn><Btn onClick={()=>advance('p1','p2')}>Continue <ChevronRight size={14}/></Btn></div>}
      </>}
      {err&&<ErrBox msg={err}/>}
    </div>

    case'p2':return <div>
      {!isDemo&&<div style={S.tag('#C8924A')}>Phase 1 · Know Your Value</div>}
      <h1 style={S.title}>Wiring & Compass</h1>
      {!isDemo&&<p style={S.sub}>Most people take assessments and file them away. This step connects how you're wired to the work you do best and the environment where you thrive.</p>}
      {!isDemo&&!outputs.p2&&!loading&&<Btn onClick={()=>generate('p2',()=>P.p2(pc,outputs.p1))}><Sparkles size={14}/>Analyze My Wiring</Btn>}
      {loading&&<Loading msg="Cross-referencing assessment, values, and accomplishments…"/>}
      {outputs.p2&&<>
        <OutPanel text={outputs.p2} onCopy={copy} copied={copied}/>
        {!isDemo&&<RefineBox value={feedback.p2} onChange={v=>setFb('p2',v)} onRegenerate={v=>{out('p2','');generate('p2',()=>P.p2(pc,outputs.p1)+(v?`\n\nUSER CONTEXT: ${v}`:''))}}/>}
        {!isDemo&&<div style={S.row}><Btn secondary onClick={()=>out('p2','')}><RotateCcw size={13}/>Regenerate</Btn><Btn onClick={()=>advance('p2','p3')}>Continue <ChevronRight size={14}/></Btn></div>}
      </>}
      {err&&<ErrBox msg={err}/>}
    </div>

    case'p3':return <div>
      {done.includes('complete')&&<div style={{marginBottom:16}}><Btn secondary onClick={()=>nav('complete')}><ArrowLeft size={13}/>Back to My Results</Btn></div>}

      {!isDemo&&<div style={S.tag('#C8924A')}>Phase 1 · Know Your Value</div>}
      <h1 style={S.title}>Brand Synthesis</h1>
      {!isDemo&&<p style={S.sub}>When someone asks "what do you do," most people default to a job title. This step gives you a better answer: a clear statement of what you do, why you are good at it, and how they work together to produce meaningful outcomes.</p>}
      {!isDemo&&!outputs.p3&&!loading&&<Btn onClick={()=>generate('p3',()=>P.p3(pc,outputs.p1,outputs.p2))}><Sparkles size={14}/>Synthesize My Brand</Btn>}
      {loading&&<Loading msg="Finding the pattern across all your data…"/>}
      {outputs.p3&&<>
        <OutPanel text={outputs.p3} onCopy={copy} copied={copied}/>
        {!isDemo&&<RefineBox value={feedback.p3} onChange={v=>setFb('p3',v)} onRegenerate={v=>{out('p3','');generate('p3',()=>P.p3(pc,outputs.p1,outputs.p2)+(v?`\n\nUSER CONTEXT: ${v}`:''))}}/>}
        {!isDemo&&<div style={S.row}><Btn secondary onClick={()=>out('p3','')}><RotateCcw size={13}/>Regenerate</Btn><Btn onClick={()=>advance('p3','p4')}>Begin Phase 2 <ChevronRight size={14}/></Btn></div>}
      </>}
      {err&&<ErrBox msg={err}/>}
    </div>

    case'p4':return <div>
      {!isDemo&&<div style={S.tag('#C8924A')}>Phase 2 · Explore Options</div>}
      <h1 style={S.title}>The Wide View</h1>
      {!isDemo&&<p style={S.sub}>You have told us your story: your resume, how you are wired, what you value, and what lights you up. We have been listening. Now we take everything we know about you and map out the full landscape of what is possible. Let's see what we can reimagine together.</p>}
      {!isDemo&&!outputs.p4&&!loading&&<Btn onClick={()=>generate('p4',()=>P.p4(pc,outputs.p1,outputs.p2,outputs.p3),{highTemp:true,maxTokens:5000,msg:'Mapping your opportunity landscape — this takes a moment…'})}><Sparkles size={14}/>Generate My Options</Btn>}
      {loading&&<Loading msg={loadMsg||'Mapping your full opportunity landscape across all three paths…'}/>}
      {outputs.p4&&<>
        <OutPanel text={outputs.p4} onCopy={copy} copied={copied} expandLabel="Click here to see all your options"/>
        {!isDemo&&<RefineBox value={feedback.p4} onChange={v=>setFb('p4',v)} onRegenerate={v=>{out('p4','');generate('p4',()=>P.p4(pc,outputs.p1,outputs.p2,outputs.p3)+(v?`\n\nUSER CONTEXT: ${v}`:''),{highTemp:true,maxTokens:5000,msg:'Refining your opportunity landscape…'})}}/>}
        {!isDemo&&(()=>{
          const extractOptions=(text)=>{
            if(!text)return[]
            const opts=[]
            const lines=text.split('\n')
            let currentLane=''
            for(const line of lines){
              const trimLine=line.trim()
              if(/WORK THAT MATTERS|IKIGAI/i.test(trimLine)&&(trimLine.startsWith('**')||trimLine.startsWith('#')||/^WORK|^IKIGAI/i.test(trimLine)))currentLane='Work That Matters'
              else if(/THE INDUSTRY INSIDER|INDUSTRY INSIDER/i.test(trimLine)&&(trimLine.startsWith('**')||trimLine.startsWith('#')||/^THE INDUSTRY|^INDUSTRY/i.test(trimLine)))currentLane='Industry Insider'
              else if(/FAMILIAR GROUND/i.test(trimLine)&&(trimLine.startsWith('**')||trimLine.startsWith('#')||/^FAMILIAR/i.test(trimLine)))currentLane='Familiar Ground'
              if(!currentLane)continue
              const titleMatch=
                trimLine.match(/^#{1,3}\s*\d+[\.\)]\s*(.+)/) ||
                trimLine.match(/^\d+[\.\)]\s*\*\*(.+?)\*\*/) ||
                trimLine.match(/^\*\*\d+[\.\)]\s*(.+?)\*\*/) ||
                trimLine.match(/^#{1,3}\s*\*\*(.+?)\*\*/) ||
                trimLine.match(/^\*\*([A-Z][^*]{4,80})\*\*/) ||
                trimLine.match(/^\d+[\.\)]\s+([A-Z][^\n]{4,80})(?:\s*[-—:]|$)/)
              if(titleMatch){
                let title=titleMatch[1].replace(/\*\*/g,'').replace(/^\d+[\.\)]\s*/,'').replace(/\s*[-—:].*/,'').trim()
                if(title.length>4&&title.length<100&&!/^(Vehicle|Title|For each|Start with|The intersection|Builds directly)/i.test(title))
                  opts.push({title,lane:currentLane})
              }
            }
            return opts
          }
          const available=extractOptions(outputs.p4)
          const selected=deepOpts.filter(v=>v&&v!=='?')
          const toggleOpt=(title)=>{
            const idx=deepOpts.indexOf(title)
            if(idx>=0){setDeepOpts(d=>d.map((v,j)=>j===idx?'':v))}
            else{
              const emptyIdx=deepOpts.findIndex(v=>!v||v==='?')
              if(emptyIdx>=0)setDeepOpts(d=>d.map((v,j)=>j===emptyIdx?title:v))
            }
          }
          return <div style={{...S.card,marginTop:8}}>
            <div style={{fontWeight:600,color:'#1A2540',fontSize:19,marginBottom:6}}>Select up to 3 options to explore further.</div>
            <div style={{fontSize:17,color:C.gray,marginBottom:18,lineHeight:1.65}}>Click the roles that made you lean in, not just the ones that feel safe.</div>
            {available.length>0?<>
              {['Work That Matters','Industry Insider','Familiar Ground'].map(lane=>{
                const laneOpts=available.filter(o=>o.lane===lane)
                if(!laneOpts.length)return null
                return <div key={lane} style={{marginBottom:16}}>
                  <div style={{fontSize:14,fontWeight:700,letterSpacing:'0.5px',textTransform:'uppercase',color:C.goldL,marginBottom:8}}>{lane}</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                    {laneOpts.map(o=>{const sel=deepOpts.includes(o.title);return <button key={o.title} onClick={()=>toggleOpt(o.title)} style={{padding:'10px 18px',borderRadius:8,border:`2px solid ${sel?C.gold:C.border}`,background:sel?`${C.gold}15`:'white',color:sel?C.goldL:'#374258',fontSize:15,fontWeight:sel?600:400,cursor:selected.length>=3&&!sel?'not-allowed':'pointer',opacity:selected.length>=3&&!sel?0.5:1,fontFamily:'inherit',transition:'all 0.15s',textAlign:'left'}}>{sel&&<Check size={12} color={C.gold} strokeWidth={3} style={{marginRight:6,display:'inline'}}/>}{o.title}</button>})}
                  </div>
                </div>
              })}
            </>:<div style={{fontSize:15,color:C.gray,marginBottom:12}}>Or type your choices below:</div>}
            {selected.length>0&&<div style={{marginTop:16,padding:'12px 16px',background:'#F7F8FA',borderRadius:8,fontSize:15,color:C.gray}}>Selected ({selected.length}/3): {selected.map((s,i)=><strong key={i} style={{color:'#1A2540',marginRight:8}}>{s}</strong>)}</div>}
            {selected.length>0&&<div style={S.row}><Btn onClick={()=>advance('p4','p5')}>Go Deeper <ChevronRight size={14}/></Btn></div>}
            {selected.length===0&&<div style={{fontSize:15,color:C.gray,marginTop:8}}>Click at least one option above to continue.</div>}
          </div>
        })()}
      </>}
      {err&&<ErrBox msg={err}/>}
    </div>

    case'p5':{
      const filledOpts=deepOpts.filter(v=>v&&v!=='?')

      const parseOptions=(text)=>{
        if(!text)return{takeaway:'',options:[]}
        const takeawayMarker='## QUICK TAKEAWAY'
        let takeaway=''
        const tkIdx=text.indexOf(takeawayMarker)
        if(tkIdx!==-1){
          const afterTk=text.slice(tkIdx+takeawayMarker.length)
          const nextH2=afterTk.search(/\n## /)
          takeaway=nextH2!==-1?afterTk.slice(0,nextH2).trim():afterTk.trim()
        }
        const trimmed=text.replace(/^[\s\S]*?(?=## OPTION [ABC])/m,'')
        const parts=trimmed.split(/^## OPTION [ABC]/m).filter(Boolean)
        const options=parts.map(part=>{
          const sections={title:'',reality:'',fit:'',brief:''}
          const realityMatch=part.match(/### (?:REALITY CHECK|THE ROLE)([\s\S]*?)(?=### WHY YOU FIT|### (?:THE HONEST BRIEF|WORTH CONSIDERING)|$)/)
          const fitMatch=part.match(/### WHY YOU FIT([\s\S]*?)(?=### (?:THE HONEST BRIEF|WORTH CONSIDERING)|$)/)
          const briefMatch=part.match(/### (?:THE HONEST BRIEF|WORTH CONSIDERING)([\s\S]*?)$/)
          sections.reality=realityMatch?realityMatch[1].trim():''
          sections.fit=fitMatch?fitMatch[1].trim():''
          sections.brief=briefMatch?briefMatch[1].trim():''
          return sections
        })
        return{takeaway,options}
      }

      const{takeaway:p5Takeaway,options:parsed}=parseOptions(outputs.p5)
      const sectionStyle={background:'#FFFFFF',border:`1px solid ${C.border}`,borderRadius:10,padding:'24px 28px',marginBottom:14,boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}
      const sectionLabel={fontSize:17,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:C.gold,marginBottom:14,display:'block'}

      return <div>
        {!isDemo&&<div style={S.tag('#C8924A')}>Phase 2 · Explore Options</div>}
        <h1 style={S.title}>The Deep Dive</h1>
        {!isDemo&&<p style={S.sub}>It's easy to get excited about an option on paper. This step shows what the role actually looks like and how your background maps to it.</p>}
        {deepOpts.filter(v=>v&&v!=='?').length>0&&<div style={{...S.note,marginBottom:16}}>Exploring: {filledOpts.map((o,i)=><strong key={i} style={{color:'#1A2540',marginRight:12,cursor:'default'}}>{o}</strong>)}</div>}
        {!isDemo&&!outputs.p5&&!loading&&filledOpts.length>0&&<Btn onClick={()=>generate('p5',()=>P.p5(pc,outputs,deepOpts),{maxTokens:6000,msg:'Building your deep dive…'})}><Sparkles size={14}/>Explore These Options</Btn>}
        {!isDemo&&filledOpts.length===0&&!outputs.p5&&<div style={{...S.err,marginTop:0}}><AlertCircle size={13} color={C.err} style={{flexShrink:0}}/><span>Go back to The Wide View and select at least one option to explore.</span></div>}
        {loading&&<Loading msg={loadMsg||'Building your deep dive…'}/>}
        {outputs.p5&&<>
          {p5Takeaway&&<div style={S.out}>
            <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}><Btn small onClick={()=>copy(outputs.p5)}>{copied?<><CheckCheck size={11}/>Copied</>:<><Copy size={11}/>Copy All</>}</Btn></div>
            <MD text={`## QUICK TAKEAWAY\n${p5Takeaway}`}/>
            <button data-expand="true" onClick={()=>setDeepExpanded(e=>!e)} style={{display:'flex',alignItems:'center',gap:8,margin:'20px 0 8px',padding:'12px 20px',background:deepExpanded?`${C.gold}10`:'#F7F8FA',border:`1.5px solid ${deepExpanded?C.gold:C.border}`,borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:15,fontWeight:600,color:deepExpanded?C.goldL:C.gray,transition:'all 0.2s',width:'100%'}}>
              <ChevronRight size={16} style={{transform:deepExpanded?'rotate(90deg)':'none',transition:'transform 0.2s'}}/>
              {deepExpanded?'Hide full analysis':'Click here for a deeper understanding'}
            </button>
          </div>}
          {(deepExpanded||!p5Takeaway)&&<>
            <div style={{display:'flex',gap:8,marginBottom:20,marginTop:p5Takeaway?16:0,flexWrap:'wrap'}}>
              {filledOpts.map((opt,i)=><button key={i} onClick={()=>setActiveTab(i)} style={{padding:'12px 22px',borderRadius:8,border:`2px solid ${activeTab===i?C.gold:C.border}`,background:activeTab===i?`${C.gold}15`:'white',color:activeTab===i?C.goldL:'#4A5568',fontSize:17,fontWeight:activeTab===i?600:400,cursor:'pointer',fontFamily:'inherit',transition:'all 0.15s'}}>{opt}</button>)}
            </div>
            {parsed[activeTab]&&<>
              <div style={sectionStyle}>
                <span style={sectionLabel}>The Role</span>
                <MD text={parsed[activeTab].reality}/>
              </div>
              <div style={sectionStyle}>
                <span style={sectionLabel}>Why You Fit</span>
                <MD text={parsed[activeTab].fit}/>
              </div>
              <div style={sectionStyle}>
                <span style={sectionLabel}>Worth Considering</span>
                <MD text={parsed[activeTab].brief}/>
              </div>
            </>}
            {!parsed[activeTab]&&<div style={S.out}><MD text={outputs.p5}/></div>}
          </>}
          {!isDemo&&<RefineBox value={feedback.p5} onChange={v=>setFb('p5',v)} onRegenerate={v=>{out('p5','');generate('p5',()=>P.p5(pc,outputs,deepOpts)+(v?`\n\nUSER CONTEXT: ${v}`:''),{maxTokens:6000,msg:'Rebuilding your deep dive…'})}}/>}
          {!isDemo&&<>
            <div style={{margin:'24px 0 12px',padding:'16px 20px',background:'#FFF8F0',border:`2px solid ${C.gold}40`,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
              <span style={{fontSize:16,color:C.goldL,fontWeight:500}}>Not what you expected? Go back and explore different options.</span>
              <Btn secondary onClick={()=>{out('p5','');setDeepOpts(['','','']);nav('p4')}}><ArrowLeft size={13}/>Choose Different Options</Btn>
            </div>
            <div style={S.row}>
              <Btn secondary onClick={()=>out('p5','')}><RotateCcw size={13}/>Regenerate</Btn>
              <Btn onClick={()=>advance('p5','decision')}>Make My Decision <ChevronRight size={14}/></Btn>
            </div>
          </>}
        </>}
        {err&&<ErrBox msg={err}/>}
      </div>
    }

    case'decision':return <div>
      {!isDemo&&<div style={S.tag('#C8924A')}>Phase 2 · Explore Options</div>}
      <h1 style={S.title}>Your Decision</h1>
      {!isDemo&&<p style={S.sub}>Having multiple strong options is a good problem to have. This is the moment you choose a direction and everything starts pointing the same way.</p>}
      {isDemo?<div style={S.card}>
        <label style={S.label}>Pursuing</label>
        <div style={{fontSize:19,color:C.cream,fontWeight:600,lineHeight:1.6}}>{chosen}</div>
      </div>:<>
        <div style={S.card}>
          <label style={S.label}>I've decided to pursue…</label>
          <div style={{fontSize:17,color:C.gray,marginBottom:14,lineHeight:1.6}}>Click the option you're committing to. This becomes the foundation for everything that follows.</div>
          {deepOpts.filter(v=>v&&v!=='?').length>0&&<div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
            {deepOpts.filter(v=>v&&v!=='?').map(opt=><button key={opt} onClick={()=>setChosen(opt)} style={{padding:'14px 20px',borderRadius:8,border:`2px solid ${chosen===opt?C.gold:C.border}`,background:chosen===opt?`${C.gold}15`:'white',color:chosen===opt?C.goldL:'#374258',fontSize:17,fontWeight:chosen===opt?600:400,cursor:'pointer',fontFamily:'inherit',textAlign:'left',transition:'all 0.15s',display:'flex',alignItems:'center',gap:10}}>{chosen===opt&&<Check size={14} color={C.gold} strokeWidth={3}/>}{opt}</button>)}
          </div>}
          <div style={{fontSize:14,color:C.gray,marginTop:8}}>Or describe a different path:</div>
          <textarea style={{...S.ta,minHeight:60,marginTop:6}} value={deepOpts.filter(v=>v&&v!=='?').includes(chosen)?'':chosen} onChange={e=>setChosen(e.target.value)} placeholder="e.g. Fractional CMO in the B2B SaaS ecosystem…"/>
        </div>
        <div style={S.card}>
          <div style={{fontWeight:600,color:C.cream,fontSize:13,marginBottom:9}}>Not ready yet?</div>
          <Btn secondary onClick={()=>{out('p5','');setDeepOpts(['','','']);nav('p5')}}>Explore different options →</Btn>
          <div style={{fontSize:15,color:C.gray,marginTop:9}}>Or close the tool and come back — your progress is saved automatically.</div>
        </div>
        {err&&<ErrBox msg={err}/>}
        <div style={S.row}><Btn onClick={()=>chosen?advance('decision','p6'):setErr('Please enter your decision to continue.')}>Build My Bridge Story <ChevronRight size={14}/></Btn></div>
      </>}
    </div>

    case'p6':return <div>
      {done.includes('complete')&&<div style={{marginBottom:16}}><Btn secondary onClick={()=>nav('complete')}><ArrowLeft size={13}/>Back to My Results</Btn></div>}

      {!isDemo&&<div style={S.tag('#C8924A')}>Phase 3 · Tell Your Story</div>}
      <h1 style={S.title}>Your Bridge Story</h1>
      {!isDemo&&<p style={S.sub}>"Tell me about yourself" is the first question in every interview, and most people struggle with it. Three versions that connect where you've been to where you're heading.</p>}
      <div style={S.note}>Pursuing: <strong style={{color:C.cream}}>{chosen}</strong></div>
      {!isDemo&&!outputs.p6&&!loading&&<Btn onClick={()=>generate('p6',()=>P.p6(pc,outputs,chosen),{maxTokens:4000})}><Sparkles size={14}/>Write My Bridge Story</Btn>}
      {loading&&<Loading msg="Crafting your bridge story in three lengths…"/>}
      {outputs.p6&&<><OutPanel text={outputs.p6} onCopy={copy} copied={copied}/>{!isDemo&&<div style={S.row}><Btn secondary onClick={()=>out('p6','')}><RotateCcw size={13}/>Regenerate</Btn><Btn onClick={()=>advance('p6','p7')}>Build My Go-to-Market <ChevronRight size={14}/></Btn></div>}</>}
      {err&&<ErrBox msg={err}/>}
    </div>

    case'p7':return <div>
      {done.includes('complete')&&<div style={{marginBottom:16}}><Btn secondary onClick={()=>nav('complete')}><ArrowLeft size={13}/>Back to My Results</Btn></div>}

      {!isDemo&&<div style={S.tag('#C8924A')}>Phase 4 · Find Your Market</div>}
      <h1 style={S.title}>Go-to-Market Strategy</h1>
      {!isDemo&&<p style={S.sub}>The best opportunities are filled through relationships before a posting ever goes live. We search in real time for companies that fit your background and draft personalized outreach to the people you'd want to reach.</p>}
      {!isDemo&&<div style={S.note}><strong style={{color:C.gold}}>Live research enabled.</strong> We search for companies that are growing, investing, and most likely to be hiring — and flag ones showing signs of contraction.</div>}
      {!isDemo&&!outputs.p7&&!loading&&<Btn onClick={()=>generate('p7',()=>P.p7(pc,outputs,chosen),{webSearch:true,maxTokens:6000,msg:'Researching target companies and building your strategy…'})}><Sparkles size={14}/>Build My Strategy</Btn>}
      {loading&&<Loading msg={loadMsg||'Researching companies and building your outreach strategy…'}/>}
      {outputs.p7&&(()=>{
        const downloadCSV=()=>{
          const lines=outputs.p7.split('\n').filter(l=>l.includes('|')&&!l.match(/^[\s|:-]+$/))
          const csv='Company,Why it fits,Growth signal,Contact title,Website\n'+lines.map(l=>{const p=l.split('|').map(s=>s.trim());return p.map(s=>`"${s.replace(/"/g,'""')}"`).join(',')}).join('\n')
          const nameSlug=(profile.resume||'').split(/\n/)[0]?.replace(/[^a-zA-Z ]/g,'').trim().split(' ').slice(0,2).join('-')||'companies'
          const roleSlug=(chosen||'target').replace(/[^a-zA-Z0-9 ]/g,'').trim().split(' ').slice(0,4).join('-')
          const dateStr=new Date().toISOString().slice(0,10)
          const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download=`${nameSlug}_${roleSlug}_${dateStr}.csv`;a.click()
        }
        const splitPoint=outputs.p7.search(/##?\s*PART 3|##?\s*Outreach Template/i)
        const part12=splitPoint>0?outputs.p7.slice(0,splitPoint):outputs.p7
        const part34=splitPoint>0?outputs.p7.slice(splitPoint):''
        return <>
          <div style={S.out}><div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}><Btn small onClick={()=>copy(outputs.p7)}>{copied?<><CheckCheck size={11}/>Copied</>:<><Copy size={11}/>Copy All</>}</Btn></div><MD text={part12}/></div>
          <div style={{margin:'16px 0',padding:'16px 20px',background:`${C.gold}14`,border:`2px solid ${C.gold}60`,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'space-between',gap:16}}>
            <div>
              <div style={{fontWeight:700,fontSize:17,color:'#1A2540',marginBottom:4}}>Download your company list</div>
              <div style={{fontSize:16,color:C.goldL}}>Save as a spreadsheet to track outreach, add notes, and share with your network.</div>
            </div>
            <Btn onClick={()=>{
              const lines=outputs.p7.split('\n').filter(l=>l.includes('|')&&l.trim().length>10&&!l.match(/^[\s|:-]+$/))
              const csv=lines.length>2
                ?'Company,Why it fits,Growth signal,Contact name & LinkedIn,Email convention,Website\n'+lines.map(l=>{const p=l.split('|').map(s=>s.trim());return p.map(s=>`"${s.replace(/"/g,'""')}"`).join(',')}).join('\n')
                :outputs.p7
              const blob=new Blob([csv],{type:'text/csv'})
              const url=URL.createObjectURL(blob)
              const a=document.createElement('a')
              a.href=url
              const nameSlug=(profile.resume||'').split(/\n/)[0]?.replace(/[^a-zA-Z ]/g,'').trim().split(' ').slice(0,2).join('-')||'companies'
              const roleSlug=(chosen||'target').replace(/[^a-zA-Z0-9 ]/g,'').trim().split(' ').slice(0,4).join('-')
              const dateStr=new Date().toISOString().slice(0,10)
              a.download=`${nameSlug}_${roleSlug}_${dateStr}.csv`
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              URL.revokeObjectURL(url)
            }} style={{flexShrink:0}}>Download CSV</Btn>
          </div>
          {part34&&<div style={S.out}><MD text={part34}/></div>}
          {!isDemo&&<div style={S.row}>
            <Btn secondary onClick={()=>out('p7','')}><RotateCcw size={13}/>Regenerate</Btn>
            <Btn onClick={()=>advance('p7','p8')}>Begin Preparation <ChevronRight size={14}/></Btn>
          </div>}
        </>
      })()}
      {err&&<ErrBox msg={err}/>}
    </div>

    case'p8':return <div>
      {done.includes('complete')&&<div style={{marginBottom:16}}><Btn secondary onClick={()=>nav('complete')}><ArrowLeft size={13}/>Back to My Results</Btn></div>}

      {!isDemo&&<div style={S.tag('#C8924A')}>Phase 5 · Get Ready</div>}
      <h1 style={S.title}>LinkedIn Remix</h1>
      {!isDemo&&<p style={S.sub}>Your LinkedIn profile is how companies and recruiters find you. If it still describes your last role, the right people can't find you for the next one.</p>}
      {!isDemo&&!outputs.p8&&!loading&&<Btn onClick={()=>generate('p8',()=>P.p8(pc,outputs,chosen),{maxTokens:3000})}><Sparkles size={14}/>Remix My LinkedIn</Btn>}
      {loading&&<Loading msg="Rewriting your LinkedIn for your new direction…"/>}
      {outputs.p8&&<><OutPanel text={outputs.p8} onCopy={copy} copied={copied}/>{!isDemo&&<div style={S.row}><Btn secondary onClick={()=>out('p8','')}><RotateCcw size={13}/>Regenerate</Btn><Btn onClick={()=>advance('p8','p_res')}>Continue <ChevronRight size={14}/></Btn></div>}</>}
      {err&&<ErrBox msg={err}/>}
    </div>

    case'p_res':return <div>
      {done.includes('complete')&&<div style={{marginBottom:16}}><Btn secondary onClick={()=>nav('complete')}><ArrowLeft size={13}/>Back to My Results</Btn></div>}

      {!isDemo&&<div style={S.tag('#C8924A')}>Phase 5 · Get Ready</div>}
      <h1 style={S.title}>Resume Refresh</h1>
      {!isDemo&&<p style={S.sub}>The people reading your resume now are looking for different signals than the ones who hired you last time. We use a hybrid format that puts your Greatest Hits above the fold so the strongest evidence lands in the first 7 seconds.</p>}
      <div style={S.note}>Targeting: <strong style={{color:C.cream}}>{chosen}</strong></div>
      {!isDemo&&!outputs.p_res&&!loading&&<Btn onClick={()=>generate('p_res',()=>P.p_res(pc,outputs,chosen),{maxTokens:4000})}><Sparkles size={14}/>Refresh My Resume</Btn>}
      {loading&&<Loading msg="Rewriting your resume for your new direction…"/>}
      {outputs.p_res&&<><OutPanel text={outputs.p_res} onCopy={copy} copied={copied}/>{!isDemo&&<div style={S.row}><Btn secondary onClick={()=>out('p_res','')}><RotateCcw size={13}/>Regenerate</Btn><Btn onClick={()=>advance('p_res','p9')}>Continue <ChevronRight size={14}/></Btn></div>}</>}
      {err&&<ErrBox msg={err}/>}
    </div>

    case'p9':return <div>
      {done.includes('complete')&&<div style={{marginBottom:16}}><Btn secondary onClick={()=>nav('complete')}><ArrowLeft size={13}/>Back to My Results</Btn></div>}

      {!isDemo&&<div style={S.tag('#C8924A')}>Phase 5 · Get Ready</div>}
      <h1 style={S.title}>Your Playbook</h1>
      {!isDemo&&<p style={S.sub}>Walking into a conversation in a new space without knowing the vocabulary or the current landscape costs credibility fast. This is everything you need to walk in confident and prepared.</p>}
      {!isDemo&&!outputs.p9&&!loading&&<Btn onClick={async()=>{setLoading(true);setErr(null);setLoadMsg('Building your playbook...');try{const[r1,r2]=await Promise.all([callClaude(P.p9(pc,outputs,chosen),{maxTokens:3000}),callClaude(P.p10(pc,outputs,chosen),{maxTokens:2000})]);out('p9',r1);out('p10',r2)}catch(e){setErr(e.message)}finally{setLoading(false)}}}><Sparkles size={14}/>Build My Playbook</Btn>}
      {loading&&<Loading msg={loadMsg||'Building your playbook — industry landscape and interview preparation…'}/>}
      {outputs.p9&&<>
        <OutPanel text={outputs.p9} onCopy={copy} copied={copied}/>
        {outputs.p10&&<><div style={{marginTop:24,marginBottom:10}}><h2 style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:600,color:C.gold,margin:0}}>Interview Prep</h2><p style={{fontSize:16,color:C.gray,marginTop:6}}>The questions that will come up and how to talk about each one with confidence.</p></div><OutPanel text={outputs.p10} onCopy={copy} copied={copied}/></>}
        {!isDemo&&<div style={S.row}><Btn secondary onClick={()=>{out('p9','');out('p10','')}}><RotateCcw size={13}/>Regenerate</Btn><Btn onClick={()=>{markDone('p9');markDone('p10');advance('p9','complete')}}>Complete My Reimagine <ChevronRight size={14}/></Btn></div>}
      </>}
      {err&&<ErrBox msg={err}/>}
    </div>

    case'p10':return <div>{nav('p9')}</div>

    case'complete':{if(!done.includes('complete'))markDone('complete');return <div>
      <div style={{background:`linear-gradient(135deg,${C.panel} 0%,${C.card} 100%)`,border:`1px solid ${C.gold}35`,borderRadius:16,padding:'36px',textAlign:'center',marginBottom:22}}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 120" width="260" height="60" fontFamily="Inter,-apple-system,Segoe UI,Roboto,sans-serif" style={{display:'block',margin:'0 auto 16px'}}>
          <circle cx="44" cy="60" r="28" fill="#e4572e" opacity="0.18"/>
          <circle cx="44" cy="60" r="18" fill="#e4572e"/>
          <text x="92" y="80" fontSize="72" fontWeight="900" letterSpacing="-2.5" fill="#0e1a2b">Re<tspan fill="#e4572e">imagine</tspan></text>
        </svg>
        <h1 style={{...S.title,fontSize:26,textAlign:'center',marginBottom:8}}>You've done the work.</h1>
        <p style={{fontSize:20,color:C.gray,lineHeight:1.7,maxWidth:500,margin:'0 auto'}}>Everything below is yours — your identity, your target, your story, your strategy. Come back anytime to review or refine.</p>
      </div>

      {!surveyDone&&<div style={{...S.card,marginBottom:22,border:`1px solid ${C.gold}40`}}>
        {!surveySubmitted?<>
          <div style={{fontFamily:'Georgia,serif',fontSize:17,fontWeight:600,color:C.cream,marginBottom:4}}>Before you go — 60 seconds of feedback</div>
          <div style={{fontSize:16,color:C.gray,marginBottom:20,lineHeight:1.6}}>You're helping us make this better for everyone who comes after you. All questions are optional.</div>

          <div style={S.field}>
            <label style={S.label}>How likely are you to recommend Reimagine to someone in career transition?</label>
            <div style={{fontSize:11,color:C.gray,marginBottom:8,display:'flex',justifyContent:'space-between'}}><span>Not at all likely</span><span>Extremely likely</span></div>
            <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
              {[0,1,2,3,4,5,6,7,8,9,10].map(n=><button key={n} onClick={()=>setSv('nps',n)} style={{width:36,height:36,borderRadius:6,border:`1.5px solid ${survey.nps===n?C.gold:C.border}`,background:survey.nps===n?C.gold:'transparent',color:survey.nps===n?C.bg:C.grayL,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{n}</button>)}
            </div>
          </div>

          <div style={S.field}>
            <label style={S.label}>Which part of the process was most valuable to you?</label>
            <div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:4}}>
              {['Know Your Value','Explore Options','Tell Your Story','Find Your Market','Get Ready','It all came together'].map(o=><button key={o} onClick={()=>setSv('valuable',o)} style={{padding:'6px 12px',borderRadius:20,border:`1.5px solid ${survey.valuable===o?C.gold:C.border}`,background:survey.valuable===o?`${C.gold}20`:'transparent',color:survey.valuable===o?C.goldL:C.grayL,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>{o}</button>)}
            </div>
          </div>

          <div style={S.field}>
            <label style={S.label}>How has your confidence about your next move changed?</label>
            <div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:4}}>
              {[['Much less confident'],['Less confident'],['About the same'],['More confident'],['Much more confident']].map(([label])=><button key={label} onClick={()=>setSv('confidence',label)} style={{padding:'6px 12px',borderRadius:20,border:`1.5px solid ${survey.confidence===label?C.gold:C.border}`,background:survey.confidence===label?`${C.gold}20`:'transparent',color:survey.confidence===label?C.goldL:C.grayL,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>{label}</button>)}
            </div>
          </div>

          <div style={S.field}>
            <label style={S.label}>How well did Reimagine capture who you are and what you bring?</label>
            <div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:4}}>
              {[['Missed the mark'],['Partially'],['Mostly right'],['Very well'],['Nailed it']].map(([label])=><button key={label} onClick={()=>setSv('accuracy',label)} style={{padding:'6px 12px',borderRadius:20,border:`1.5px solid ${survey.accuracy===label?C.gold:C.border}`,background:survey.accuracy===label?`${C.gold}20`:'transparent',color:survey.accuracy===label?C.goldL:C.grayL,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>{label}</button>)}
            </div>
          </div>

          <div style={S.field}>
            <label style={S.label}>Anything we should know? What would make this better? <span style={{color:C.gray,fontWeight:400,textTransform:'none',letterSpacing:0}}>(optional)</span></label>
            <textarea style={{...S.ta,minHeight:80}} value={survey.open} onChange={e=>setSv('open',e.target.value)} placeholder="Share anything on your mind…"/>
          </div>

          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <Btn onClick={async()=>{
              setSurveySubmitting(true)
              try{
                await fetch('https://script.google.com/macros/s/AKfycbz5RgmQgmqM4qhar3YviuoPMbDvdSKSOJlRX6-qmbQKOI7t6IbnETxkc-NfG3m4LitAtg/exec',{method:'POST',body:JSON.stringify({...survey,chosen,timestamp:new Date().toISOString()})})
              }catch{}
              setSurveySubmitting(false)
              setSurveySubmitted(true)
            }}>Submit Feedback</Btn>
            <Btn secondary onClick={()=>setSurveyDone(true)}>No thanks</Btn>
          </div>
          {surveySubmitting&&<div style={{marginTop:20,padding:'20px',background:'#F7F8FA',borderRadius:10,textAlign:'center'}}>
            <Loader2 size={22} style={{color:C.gold,animation:'spin 0.9s linear infinite',margin:'0 auto 12px',display:'block'}}/>
            <div style={{fontSize:15,color:C.grayL,marginBottom:16}}>Sending your feedback…</div>
            <div style={{borderLeft:`3px solid ${C.gold}`,paddingLeft:16,textAlign:'left'}}>
              <div style={{fontSize:15,color:'#1A2540',lineHeight:1.7,fontStyle:'italic',marginBottom:6}}>"{SHUFFLED_QUOTES[0].text}"</div>
              <div style={{fontSize:13,color:C.gold,fontWeight:600}}>{SHUFFLED_QUOTES[0].author}</div>
            </div>
          </div>}
        </>:<div style={{textAlign:'center',padding:'20px 0'}}>
          <div style={{fontSize:22,marginBottom:10}}>🙏</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:16,color:C.cream,marginBottom:6}}>Thank you — this means a lot.</div>
          <div style={{fontSize:16,color:C.gray,marginBottom:16,lineHeight:1.6}}>Your feedback goes directly to the team building Reimagine. We read every response.</div>
          <Btn onClick={()=>setSurveyDone(true)}>See my results <ChevronRight size={13}/></Btn>
        </div>}
      </div>}

      {surveyDone&&<>
        <div style={{background:`${C.ok}12`,border:`1px solid ${C.ok}40`,borderRadius:10,padding:'14px 18px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
          <Check size={16} color={C.ok} strokeWidth={2.5}/>
          <div style={{fontSize:15,color:C.ok,lineHeight:1.6}}>Your work is saved. Use the sidebar on the left to revisit any section, or click View below to open a specific output.</div>
        </div>
        {[['Your Personal Brand','p3',outputs.p3],['Your Bridge Story','p6',outputs.p6],['Go-to-Market Strategy','p7',outputs.p7],['LinkedIn Remix','p8',outputs.p8],['Resume Refresh','p_res',outputs.p_res],['Your Playbook','p9',(outputs.p9||'')+(outputs.p10?'\n\n---\n\n'+outputs.p10:'')],['Income Now','income',outputs.income]].filter(([,,c])=>c).map(([title,key,content])=><div key={key} style={{...S.card,marginBottom:12}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div style={{fontFamily:'Georgia,serif',fontSize:16,fontWeight:600,color:'#1A2540'}}>{title}</div><div style={{display:'flex',gap:7}}><Btn small onClick={()=>copy(content)}>{copied?<><CheckCheck size={10}/>Copied</>:<><Copy size={10}/>Copy</>}</Btn><Btn small onClick={()=>nav(key)}>View →</Btn></div></div><div style={{fontSize:15,color:C.gray,lineHeight:1.6}}>{content.substring(0,260)}…</div></div>)}

        <div style={{marginTop:16,padding:'16px',background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,fontSize:15,color:C.gray,lineHeight:1.7}}><strong style={{color:'#1A2540'}}>Your progress is saved.</strong> To return, open the same browser on the same device and go to this URL. If you switch browsers or devices, you'll need to start a new session.</div>
        <div style={{marginTop:16,background:'linear-gradient(135deg,#1A2540 0%,#2A3F60 100%)',borderRadius:12,padding:'24px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:20,flexWrap:'wrap'}}>
          <div>
            <div style={{fontSize:11,fontWeight:800,letterSpacing:'2px',textTransform:'uppercase',color:'#7AB87A',marginBottom:6}}>Bonus module</div>
            <div style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:700,color:'#FFFFFF',marginBottom:6}}>Income Now</div>
            <div style={{fontSize:18,color:'#CBD5E0',lineHeight:1.65,maxWidth:420}}>A job search takes time. Having income flowing while you search changes everything. Consulting, fractional leadership, and advisory opportunities matched to your seniority and expertise.</div>
          </div>
          <Btn onClick={()=>nav('income')} style={{background:'#7AB87A',flexShrink:0}}>Generate My Income Plan <ChevronRight size={14}/></Btn>
        </div>
        {!isDemo&&<div style={{marginTop:10,display:'flex',gap:8,justifyContent:'flex-end'}}><Btn small onClick={exportProfile}><Download size={11}/>Export Profile</Btn><Btn small onClick={reset}><RotateCcw size={11}/>Start a New Session</Btn></div>}
      </>}
    </div>}

    case'income':return <div>
      {!isDemo&&<div style={S.tag('#C8924A')}>Bonus Module</div>}
      <h1 style={S.title}>Income Now</h1>
      {!isDemo&&<p style={S.sub}>A job search takes time. Having income flowing while you search changes everything: you make better decisions when you're choosing, not settling.</p>}
      <div style={{...S.note,background:'#7AB87A12',border:'1px solid #7AB87A30',color:'#2D6A2D'}}>Targeting: <strong>{chosen||'your chosen direction'}</strong></div>
      {!isDemo&&!outputs.income&&!loading&&<Btn onClick={()=>generate('income',()=>P.income(pc,outputs,chosen),{maxTokens:6000,msg:'Building your Income Now plan…'})} style={{background:'#7AB87A'}}><Sparkles size={14}/>Build My Income Plan</Btn>}
      {loading&&<Loading msg="Building your Income Now plan — this one is thorough…"/>}
      {outputs.income&&<>
        <OutPanel text={outputs.income} onCopy={copy} copied={copied}/>
        {!isDemo&&<RefineBox value={feedback.p1} onChange={v=>setFb('p1',v)} onRegenerate={v=>{out('income','');generate('income',()=>P.income(pc,outputs,chosen)+(v?`\n\nUSER CONTEXT: ${v}`:''),{maxTokens:6000})}}/>}
        {!isDemo&&<div style={S.row}><Btn secondary onClick={()=>out('income','')}><RotateCcw size={13}/>Regenerate</Btn><Btn onClick={()=>nav('complete')}><ArrowLeft size={13}/>Back to Results</Btn></div>}
      </>}
      {err&&<ErrBox msg={err}/>}
    </div>

    default:return null
  }}

  const demoGuide=isDemo&&DEMO_TOUR[demoIdx]?DEMO_TOUR[demoIdx]:null

  return <>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap" rel="stylesheet"/>
    {isDemo&&<style>{`.demo-content { pointer-events: none; } .demo-content button[data-expand], .demo-content [data-demo-click] { pointer-events: auto; cursor: pointer; }`}</style>}
    <div style={{minHeight:'100vh',background:C.bg,color:C.cream,fontFamily:'Outfit,sans-serif',display:'flex',flexDirection:'column'}}>
      <div style={{background:'#1A2540',borderBottom:`1px solid #0F1A30`,padding:'12px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 120" width="148" height="34" fontFamily="Inter,-apple-system,Segoe UI,Roboto,sans-serif" style={{display:'block'}}>
            <circle cx="44" cy="60" r="28" fill="#e4572e" opacity="0.25"/>
            <circle cx="44" cy="60" r="18" fill="#e4572e"/>
            <text x="92" y="80" fontSize="72" fontWeight="900" letterSpacing="-2.5" fill="#FFFFFF">Re<tspan fill="#e4572e">imagine</tspan></text>
          </svg>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          {isDemo?<>
            <div style={{fontSize:11,color:C.gray}}>Step {demoIdx+1} of {DEMO_TOUR.length}</div>
            <div style={{width:80,height:3,background:C.border,borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',width:`${((demoIdx+1)/DEMO_TOUR.length)*100}%`,background:C.gold,borderRadius:2,transition:'width 0.5s'}}/></div>
          </>:<>
            <div style={{fontSize:11,color:C.gray}}>{prog}% complete</div>
            <div style={{width:80,height:3,background:C.border,borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',width:`${prog}%`,background:C.gold,borderRadius:2,transition:'width 0.5s'}}/></div>
          </>}
        </div>
      </div>
      <div style={{display:'flex',flex:1,minHeight:0}}>
        <div style={{width:260,background:'#1A2540',borderRight:'1px solid #0F1A30',padding:'16px 0',overflowY:'auto',flexShrink:0,position:'relative'}}>
          {isDemo&&<div style={{pointerEvents:'none'}}>
            <Sidebar step={step} done={done} onNav={()=>{}} isDemo={true}/>
          </div>}
          {!isDemo&&<Sidebar step={step} done={done} onNav={nav}/>}
        </div>
        <div style={{flex:1,padding:'40px 56px 60px',overflowY:'auto'}}>
          {isDemo&&step!=='welcome'&&demoGuide?.desc&&<div style={{...S.card,marginBottom:24,background:'#FAFBFC',padding:'32px 38px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:14}}>
              <h2 style={{fontFamily:'Georgia,serif',fontSize:26,fontWeight:700,color:'#1A2540',margin:0}}>{demoGuide.title}</h2>
              <div style={{fontSize:13,color:C.gray,flexShrink:0,marginLeft:16}}>{demoIdx+1} of {DEMO_TOUR.length}</div>
            </div>
            <p style={{fontSize:18,color:'#2D3748',lineHeight:1.75,margin:0}}>{demoGuide.desc}</p>
          </div>}
          {isDemo&&step!=='welcome'?<div className="demo-content">{rStep()}</div>:rStep()}
          {isDemo&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:32,paddingTop:24,borderTop:`1px solid ${C.border}`}}>
            <div>{demoIdx>0&&<button onClick={demoPrev} style={{display:'inline-flex',alignItems:'center',gap:8,padding:'12px 24px',background:'transparent',color:C.gray,border:`1px solid ${C.border}`,borderRadius:8,fontSize:16,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>← Previous</button>}</div>
            <div style={{display:'flex',alignItems:'center',gap:16}}>
              {demoIdx<DEMO_TOUR.length-1?<button onClick={demoNext} style={{display:'inline-flex',alignItems:'center',gap:8,padding:'12px 24px',background:C.gold,color:'#fff',border:'none',borderRadius:8,fontSize:16,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Next →</button>:<a href="/" style={{display:'inline-flex',alignItems:'center',gap:8,padding:'12px 24px',background:C.gold,color:'#fff',border:'none',borderRadius:8,fontSize:16,fontWeight:600,cursor:'pointer',fontFamily:'inherit',textDecoration:'none'}}>Start My Reimagine Session →</a>}
            </div>
          </div>}
        </div>
      </div>
    </div>
  </>
}
