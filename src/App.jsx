import { useState, useEffect, useRef } from "react"
import * as mammoth from "mammoth"
import { Check, Upload, Loader2, AlertCircle, Copy, CheckCheck, ChevronRight, RotateCcw, ArrowLeft, Sparkles, Trophy } from "lucide-react"

const SYS = `You are an expert Career Transition Strategist within the Reimagine, a career strategy tool by Career Club, based on Making Your Own Weather by Bob Goodwin.

Your role: help professionals discover their highest-value next move: evolution, ecosystem repositioning, or reinvention.

THREE LANES:
LANE 1 - THE UPGRADE: Modernize the user's existing function. What does the top 1% of this professional look like today vs five years ago?

LANE 2 - THE ECOSYSTEM PIVOT: Industry expertise is the primary asset. Map the full ecosystem with genuine depth: clients, vendors, consultants, upstream/downstream players, trade associations, educators, regulators, adjacent industries. Surface the empathy advantage: the vendor wants the person who was the client. Depth earns trust.

LANE 3 - THE REINVENTION: Apply Ikigai logic. Genuine intersection of: demonstrable skills + personal passion + real market need + compensation viable at their seniority. Push beyond the obvious.

RULES:
- Frame ALL accomplishments as: made money, saved money, or mitigated risk. Strip jargon.
- Consider W-2, consulting, fractional leadership, entrepreneurship, franchising as vehicles.
- Any assessment format (Affintus, CliftonStrengths, DiSC, MBTI, Hogan, PI, Enneagram): extract work style, people orientation, ideal environment, decision-making signals.
- Tone: trusted, direct, warm coach. Name gaps plainly and constructively. Not a cheerleader.
- Never suggest roles identical to past titles.
- Frame environment fit positively: describe where the person thrives, not what to avoid.
- Never use the word "nightmare." Keep language polished and professional throughout.
- Avoid logic-flip constructions like "it's not X, it's Y." State the positive directly.
- Write in a natural, human voice. Avoid words that read as AI-generated: "exactly," "straightforward," "unlock," "leverage," "utilize," "robust," "seamless," "game-changer," "architecting," "ecosystem," "synergy," "talent intelligence," "platform" (when used metaphorically), "space" (when used to mean industry).
- Never use em dashes. Use commas, periods, or colons instead.`

const C = {
  bg:'#F7F8FA',panel:'#FFFFFF',card:'#FFFFFF',input:'#F3F4F6',
  border:'#E2E5EA',gold:'#C8924A',goldL:'#A06828',
  cream:'#1A2540',creamD:'#374258',gray:'#6B7A99',grayL:'#4A5568',
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
    if(line.startsWith('### '))return <h3 key={i} style={{fontFamily:'Georgia,serif',fontSize:17,fontWeight:600,color:"#A06828",margin:'16px 0 6px'}}>{line.slice(4)}</h3>
    if(line.startsWith('## '))return <h2 key={i} style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:600,color:"#C8924A",margin:'18px 0 8px',borderBottom:`1px solid ${C.border}`,paddingBottom:7}}>{line.slice(3)}</h2>
    if(line.startsWith('# '))return <h1 key={i} style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:700,color:"#1A2540",margin:'20px 0 8px'}}>{line.slice(2)}</h1>
    if(line.trim()==='---')return <hr key={i} style={{border:'none',borderTop:`1px solid ${C.border}`,margin:'16px 0'}}/>
    if(line.startsWith('- ')||line.startsWith('* '))return <div key={i} style={{display:'flex',gap:10,margin:'4px 0',paddingLeft:8,alignItems:'flex-start'}}><span style={{color:C.gold,flexShrink:0,marginTop:2}}>◆</span><span style={{color:"#374258",lineHeight:1.65,fontSize:20}}><Inline text={line.slice(2)}/></span></div>
    const nm=line.match(/^(\d+)\. (.*)/)
    if(nm)return <div key={i} style={{display:'flex',gap:10,margin:'4px 0',paddingLeft:8}}><span style={{color:C.gold,flexShrink:0,fontWeight:600,minWidth:20,fontSize:14}}>{nm[1]}.</span><span style={{color:"#374258",lineHeight:1.65,fontSize:20}}><Inline text={nm[2]}/></span></div>
    if(line.trim()==='')return <div key={i} style={{height:9}}/>
    return <p key={i} style={{margin:'3px 0',color:"#374258",lineHeight:1.7,fontSize:20}}><Inline text={line}/></p>
  })}</div>
}

const P={
  p1:(pr)=>`Analyze this resume for career pivot strategy. Location: ${pr.loc.country}${pr.loc.city?', '+pr.loc.city:''}. Work preference: ${pr.loc.work}.\n\nRESUME:\n${pr.resume}\n\n**1. ALTITUDE & CONTEXT** — Highest responsibility held, complexity/pace of environments, industries, seniority baseline.\n\n**2. TRANSLATED ACCOMPLISHMENTS** — Extract 5–7 strongest. For each: strip jargon, restate as made money / saved money / mitigated risk, preserve quantification, flag missing numbers with specific suggestion.`,
  p2:(pr,o1)=>`Building on resume analysis, sharing three additional data layers.\n\nPRIOR ANALYSIS: ${o1}\n\nASSESSMENT (${pr.assessType||'provided'}): ${pr.assess||'None'}\nVALUES: ${pr.values}\nPASSIONS: ${pr.passions}\n\n**1. THE HOW ANALYSIS** — Cross-reference assessment signals with Translated Accomplishments specifically.\n**2. THE ENVIRONMENT FILTER** — Culture, pace, structure where this person thrives. Be specific.\n**3. PASSION LOG** — Confirm passions registered, note immediate patterns.`,
  p3:(pr,o1,o2)=>{const rep=[pr.rep.memory&&`Praise: ${pr.rep.memory}`,pr.rep.emergency&&`Emergency: ${pr.rep.emergency}`,pr.rep.twoWords&&`Superpower: "${pr.rep.twoWords}"`,pr.rep.other&&`Other: ${pr.rep.other}`].filter(Boolean).join('\n');return rep?`PRIOR ANALYSIS: ${o1}\n${o2}\nREPUTATION:\n${rep}\n\n**1. THE GOLDEN THREAD** — Consistent theme across accomplishments, wiring, and what others say.\n**2. THE FUNCTIONAL IDENTITY** — 2-sentence value proposition: no industry names, no job titles, no past employers.`:`PRIOR ANALYSIS: ${o1}\n${o2}\n\nNo reputation data. Generate a REPUTATION HYPOTHESIS from the other data — label it as inference. Then write a preliminary FUNCTIONAL IDENTITY — 2-sentence value proposition, no titles or industry names.`},
  p4:(pr,o1,o2,o3)=>`Generate the complete opportunity landscape. EXACT ORDER: Lane 3 first, Lane 2 second, Lane 1 last.\n\nLOCATION: ${pr.loc.country}${pr.loc.city?', '+pr.loc.city:''} | WORK: ${pr.loc.work}\nPROFILE: ${o1}\n${o2}\n${o3}\n\nApply location/work filter. If geography limits options, say so clearly and offer three paths. Do NOT pad lists.\n\n**LANE 3 — THE REINVENTION** (first, up to 8): Ikigai intersection — skills + passion + market need + compensation at seniority. For each: Title/Role, Vehicle, 3–4 sentence rationale. Push beyond the obvious.\n\n**LANE 2 — THE ECOSYSTEM PIVOT** (second, up to 10): Start with a thorough ecosystem map naming: clients, vendors, consultants, upstream/downstream players, trade associations, educators, regulators, adjacent industries. Be genuinely thorough. For each option: Title, Organization Type, Vehicle, EMPATHY ADVANTAGE in one specific sentence.\n\n**LANE 1 — THE UPGRADE** (last, up to 6): Modernized version of core function. For each: what changed in this role in 3 years, then PRIORITIZED credential list ranked (1) highest impact, (2) achievable 30–90 days, (3) achievable this week.`,
  p5:(pr,outs,opts)=>`Deep dive on selected options.\nA: ${opts[0]||''}  B: ${opts[1]||''}  C: ${opts[2]||''}\n\nPROFILE: ${outs.p1}\n${outs.p2}\n${outs.p3}\n\nFor EACH option:\n**1. WHY THIS FITS** — Evidence-grounded, specific. Reference all supporting Translated Accomplishments. Goal: convince the user themselves.\n**2. THE DAY IN THE LIFE** — What do they solve Tuesday at 10am? Concrete enough to feel it.\n**3. THE PIVOT EXPLANATION** — 4–6 sentences as logical evolution. Then distilled 2-sentence version.\n**4. THE HONEST CHALLENGE** — One legitimate obstacle, named plainly. Most direct path to close it.`,
  p6:(pr,outs,sel)=>`User pursues: **${sel}**\n\nWrite three "Tell Me About Yourself" versions — 30, 60, 90 seconds. Same person, different depths. Natural, conversational, spoken-word. No corporate language.\n\nStructure: (1) THE PERSON — Functional Identity, who they are and how wired. (2) THE PROOF — Translated Accomplishments supporting the pattern, framed as make/save/mitigate. (3) THE PIVOT — Connect to ${sel} as natural evolution.\n\nPROFILE: ${outs.p1}\n${outs.p3}\n\nLabel: **[30 SECONDS]** / **[60 SECONDS]** / **[90 SECONDS]**`,
  p7:(pr,outs,sel)=>`Complete Go-to-Market Strategy for: **${sel}** — no job boards.\n\nLOCATION: ${pr.loc.country}${pr.loc.city?', '+pr.loc.city:''} | WORK: ${pr.loc.work}\nPROFILE: ${outs.p1}\n${outs.p2}\n${outs.p3}\n\n**PART 1 — THE HIRING EXECUTIVE**: Describe the most likely hiring executive for this role: their title(s), the type and size of organization they work in, the core business challenge they are accountable for solving, and why this person's background gives them a credible perspective. Be concrete and specific.\n\n**PART 2 — TARGET COMPANY LIST**: Search the web. Generate 20-30 companies organized by lane.\nPRIORITIZE companies showing signs of growth and investment: recent VC/PE funding, acquisitions, geographic or product expansion, headcount growth on LinkedIn, Best Companies lists.\nFLAG/REMOVE companies showing contraction: layoffs past 12 months, hiring freezes, major leadership departures, restructuring.\nMixed signals: include with a warning note. Geography restricts below 20? Say so clearly.\nFormat each line: Name | Why it fits | Growth signal | Best contact title\nInclude the company website URL for each entry.\n\n**PART 3 — OUTREACH TEMPLATE**: Using the strongest company as an example, write one 4-6 sentence message.\nCRITICAL TONE RULES FOR THE MESSAGE: Write like a real person, not a consultant. Short sentences. Plain words. No jargon. No buzzwords like "architecting," "ecosystem," "leverage," "talent intelligence," "platform," "synergy," or "space." If a word would look at home on a LinkedIn thought-leader post, cut it. The observation in sentence 1 must be a plain factual statement — something the reader already knows is true about their company, stated simply. Sentences 2-3 connect one specific accomplishment to one specific problem they likely have. Sentence 4 asks for 15 minutes as a peer-to-peer conversation, not a job inquiry. The whole message should sound like it came from a thoughtful human being, not a marketing tool.\nThen: a personalization guide with 3 elements to tailor per company.\n\n**PART 4 — LINKEDIN SIGNAL TWEAK**: One specific headline change. Explain why this phrasing works better.`,
  p8:(pr,outs,sel)=>`Reposition LinkedIn for: **${sel}**\nPROFILE: ${outs.p1}\n${outs.p3}\nRESUME: ${pr.resume}\n\n1. THREE HEADLINE OPTIONS — each optimizing something different (search visibility, human resonance, authority signaling). Give a reason to choose.\n2. THE ABOUT SECTION — ~200 words, first person, natural voice. Pivot as feature. Accomplishments as make/save/mitigate.\n3. EXPERIENCE REFRAME — Most recent role, top 3–4 bullets rewritten for transferable skills relevant to ${sel}. Each passes the "so what?" test.`,
  p9:(pr,outs,sel)=>`${sel} — credible outsider needs to sound like a native in one session.\nLearning signals: ${pr.assess?pr.assess.substring(0,300):'Balanced learner.'}\n\n1. THE LINGO — 10 essential terms/acronyms. For each: plain-language definition + example sentence.\n2. THE TECH STACK — Top 3 tools practitioners rely on. What each does, why it matters, what knowing it signals.\n3. THE THOUGHT LEADERS — 3 people to follow on LinkedIn now. Who, what they post, what following teaches.\n4. THE FASTEST CREDIBILITY MOVE — One specific action in 7 days. Specific and achievable.`,
  p10:(pr,outs,sel)=>`You are now a skeptical hiring manager evaluating this person for: **${sel}**\nBACKGROUND: ${outs.p1.substring(0,500)}\nFUNCTIONAL IDENTITY: ${outs.p3.substring(0,350)}\n\n1. THE HARD QUESTION — The single most legitimate concern a decision-maker would have about this candidate. State it plainly.\n2. THE RESPONSE — A confident, specific answer grounded in their Functional Identity, Translated Accomplishments, and wiring. No deflection. Show how the background is actually a strength.\n3. THE PRACTICE NOTE — One specific thing to practice saying aloud before the first real conversation. Explain what to say and why it works.`,
  p_res:(pr,outs,sel)=>`Rewrite this resume to target: **${sel}**\nPROFILE: ${outs.p1}\n${outs.p3}\nORIGINAL RESUME:\n${pr.resume}\n\n1. REPOSITIONED SUMMARY: 3-4 sentences at the top. First person, natural voice. Positions this career arc as a logical path toward ${sel}. No titles or company names. Frame the pivot as an asset.\n2. EXPERIENCE REWRITE: For each role in the last 10 years, rewrite the top 3-4 bullets. Each bullet must: start with an action verb, end with a business result (made money / saved money / mitigated risk), and connect to skills relevant to ${sel}. Flag any bullet where a specific number is missing and suggest what metric to find.\n3. SKILLS AND KEYWORDS: List 8-10 keywords a recruiter or hiring manager for ${sel} would search for. Note which are already in the resume and which to add.`
}

const PHASES=[
  {id:0,label:'Orientation',color:'#6A9BB8',steps:['welcome','location','resume','assessment','values','reputation']},
  {id:1,label:'Know Your Value',color:'#8A7AB8',steps:['p1','p2','p3']},
  {id:2,label:'Explore Options',color:'#6AB88A',steps:['p4','p5','decision']},
  {id:3,label:'Tell Your Story',color:'#C8924A',steps:['p6']},
  {id:4,label:'Find Your Market',color:'#B86A6A',steps:['p7']},
  {id:5,label:'Get Ready',color:'#6A8AB8',steps:['p8','p_res','p9','p10','complete']},
]
const META={welcome:'Welcome',location:'Location & Work',resume:'Your Resume',assessment:'Assessments',values:'Values & Passions',reputation:'Reputation',p1:'Resume Analysis',p2:'Wiring & Compass',p3:'Brand Synthesis',p4:'The Wide View',p5:'The Deep Dive',decision:'Your Decision',p6:'Your Bridge Story',p7:'Go-to-Market',p8:'LinkedIn Remix',p_res:'Resume Refresh',p9:'Crash Course',p10:"Devil's Advocate",complete:'Complete'}
const ALL=['welcome','location','resume','assessment','values','reputation','p1','p2','p3','p4','p5','decision','p6','p7','p8','p_res','p9','p10','complete']

const S={
  title:{fontFamily:'Georgia,serif',fontSize:34,fontWeight:700,color:"#1A2540",margin:'0 0 10px',lineHeight:1.2},
  sub:{fontSize:16,color:C.gray,margin:'0 0 24px',lineHeight:1.65,maxWidth:540},
  card:{background:'#FFFFFF',border:`1px solid #E2E5EA`,borderRadius:12,padding:'20px 24px',marginBottom:16,boxShadow:'0 1px 3px rgba(0,0,0,0.06)'},
  label:{display:'block',fontSize:11,fontWeight:700,color:C.grayL,margin:'0 0 7px',letterSpacing:'1px',textTransform:'uppercase'},
  inp:{width:'100%',background:C.input,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 13px',color:C.cream,fontSize:14,fontFamily:'inherit',outline:'none',boxSizing:'border-box'},
  ta:{width:'100%',background:C.input,border:`1px solid ${C.border}`,borderRadius:8,padding:'11px 13px',color:C.cream,fontSize:14,fontFamily:'inherit',outline:'none',resize:'vertical',boxSizing:'border-box',lineHeight:1.6,minHeight:90},
  sel:{width:'100%',background:C.input,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 13px',color:C.cream,fontSize:14,fontFamily:'inherit',outline:'none',cursor:'pointer'},
  btn:{background:C.gold,color:C.bg,border:'none',borderRadius:8,padding:'11px 22px',fontSize:16,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'inline-flex',alignItems:'center',gap:8},
  sec:{background:'transparent',color:C.grayL,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 18px',fontSize:15,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'inline-flex',alignItems:'center',gap:8},
  sm:{background:'transparent',color:C.gray,border:`1px solid ${C.border}`,borderRadius:6,padding:'5px 11px',fontSize:12,cursor:'pointer',fontFamily:'inherit',display:'inline-flex',alignItems:'center',gap:5},
  out:{background:'#FFFFFF',border:`1px solid #E2E5EA`,borderRadius:10,padding:'20px 24px',marginTop:14,boxShadow:'0 1px 3px rgba(0,0,0,0.06)'},
  err:{background:`${C.err}15`,border:`1px solid ${C.err}40`,borderRadius:8,padding:'11px 15px',color:C.err,fontSize:13,marginTop:12,display:'flex',gap:8,alignItems:'flex-start'},
  note:{background:`${C.gold}12`,border:`1px solid ${C.gold}30`,borderRadius:8,padding:'11px 15px',color:C.goldL,fontSize:13,marginBottom:14,lineHeight:1.6},
  row:{display:'flex',gap:10,marginTop:20,flexWrap:'wrap'},
  field:{marginBottom:16},
  tag:(color)=>({display:'inline-block',background:`${color}18`,color,border:`1px solid ${color}35`,borderRadius:20,padding:'3px 11px',fontSize:11,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',marginBottom:12}),
  quote:{borderLeft:`3px solid ${C.gold}`,paddingLeft:16,color:C.gray,fontStyle:'italic',fontSize:14,lineHeight:1.75,margin:'18px 0'},
}

function Btn({onClick,disabled,secondary,small,children,style={}}){const base=small?S.sm:secondary?S.sec:S.btn;return <button style={{...base,opacity:disabled?0.5:1,...style}} onClick={onClick} disabled={disabled}>{children}</button>}
const QUOTES=[
  {text:"Everything can be taken from a person but one thing: the last of the human freedoms — to choose one's attitude in any given set of circumstances.",author:"Viktor Frankl"},
  {text:"Begin with the end in mind.",author:"Stephen Covey"},
  {text:"The key is not to prioritize what's on your schedule, but to schedule your priorities.",author:"Stephen Covey"},
  {text:"Seek first to understand, then to be understood.",author:"Stephen Covey"},
  {text:"Proactive people carry their own weather with them.",author:"Stephen Covey"},
  {text:"Success is peace of mind which is a direct result of self-satisfaction in knowing you made the effort to become the best you are capable of becoming.",author:"John Wooden"},
  {text:"Don't let what you cannot do interfere with what you can do.",author:"John Wooden"},
  {text:"It's not what you know, it's what you use that makes a difference.",author:"John Wooden"},
  {text:"Leaders must be close enough to relate to others, but far enough ahead to motivate them.",author:"John Maxwell"},
  {text:"The pessimist complains about the wind. The optimist expects it to change. The leader adjusts the sails.",author:"John Maxwell"},
  {text:"Talent is a gift, but character is a choice.",author:"John Maxwell"},
  {text:"He who has a why to live can bear almost any how.",author:"Viktor Frankl"},
  {text:"Between stimulus and response there is a space. In that space is our power to choose our response.",author:"Viktor Frankl"},
]

function Loading({msg='Generating your analysis…'}){
  const[qi,setQi]=useState(Math.floor(Math.random()*QUOTES.length))
  useEffect(()=>{const t=setInterval(()=>setQi(i=>(i+1)%QUOTES.length),6000);return()=>clearInterval(t)},[])
  const q=QUOTES[qi]
  return <div style={{textAlign:'center',padding:'48px 24px',maxWidth:560,margin:'0 auto'}}>
    <Loader2 size={28} style={{color:C.gold,animation:'spin 0.9s linear infinite',margin:'0 auto 20px',display:'block'}}/>
    <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>
    <div style={{fontSize:16,color:C.grayL,marginBottom:28}}>{msg}</div>
    <div style={{borderLeft:`3px solid ${C.gold}`,paddingLeft:20,textAlign:'left',marginBottom:8}}>
      <div style={{fontSize:17,color:'#1A2540',lineHeight:1.7,fontStyle:'italic',marginBottom:8}}>"{q.text}"</div>
      <div style={{fontSize:14,color:C.gold,fontWeight:600}}>{q.author}</div>
    </div>
    <div style={{fontSize:13,color:C.gray,marginTop:20,opacity:.7}}>This may take 1–2 minutes</div>
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
function OutPanel({text,onCopy,copied}){return <div style={S.out}><div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}><Btn small onClick={()=>onCopy(text)}>{copied?<><CheckCheck size={11}/>Copied</>:<><Copy size={11}/>Copy All</>}</Btn></div><MD text={text}/></div>}

function RefineBox({value,onChange,onRegenerate}){
  const[open,setOpen]=useState(false)
  return <div style={{marginTop:16,border:`2px solid ${C.border}`,borderRadius:12,overflow:'hidden',background:'#F7F8FA'}}>
    <button onClick={()=>setOpen(o=>!o)} style={{width:'100%',background:'transparent',border:'none',padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:8,height:8,borderRadius:'50%',background:C.gold,flexShrink:0}}/>
        <span style={{fontSize:17,fontWeight:600,color:'#1A2540'}}>Does this feel right?</span>
        <span style={{fontSize:15,color:C.gray}}>Add context to refine.</span>
      </div>
      <span style={{fontSize:12,color:C.gray,display:'inline-block',transform:open?'rotate(180deg)':'none',transition:'transform 0.2s',flexShrink:0}}>▼</span>
    </button>
    {open&&<div style={{background:'#FFFFFF',padding:'16px 20px',borderTop:`1px solid ${C.border}`}}>
      <div style={{fontSize:15,color:C.gray,marginBottom:12,lineHeight:1.65}}>If anything feels off — wrong tone, missing context, something we misread — describe it here and we'll adjust.</div>
      <textarea style={{...S.ta,minHeight:80}} value={value} onChange={e=>onChange(e.target.value)} placeholder="e.g. The seniority level feels too junior… you missed that I ran a P&L… the environment description doesn't match how I actually work…"/>
      <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
        <Btn onClick={()=>{setOpen(false);onRegenerate(value)}}><RotateCcw size={13}/>Regenerate with this context</Btn>
        <Btn secondary onClick={()=>{onChange('');setOpen(false);onRegenerate('')}}><RotateCcw size={13}/>Regenerate from scratch</Btn>
      </div>
    </div>}
  </div>
}
function Sidebar({step,done,onNav}){return <div style={{width:260,background:'#1A2540',borderRight:`1px solid #0F1A30`,padding:'16px 0',overflowY:'auto',flexShrink:0}}>{PHASES.map(ph=><div key={ph.id} style={{marginBottom:3}}><div style={{fontSize:11,fontWeight:800,letterSpacing:'1.5px',textTransform:'uppercase',color:ph.color,padding:'5px 14px 3px',display:'flex',alignItems:'center',gap:5}}><div style={{width:5,height:5,borderRadius:'50%',background:ph.color}}/>{ph.label}</div>{ph.steps.map(sid=>{const active=step===sid,isDone=done.includes(sid),can=isDone||active,isComplete=sid==='complete'&&isDone;return <div key={sid} onClick={()=>can&&onNav(sid)} style={{padding:'9px 14px 9px 28px',display:'flex',alignItems:'center',gap:7,cursor:can?'pointer':'default',background:isComplete?'rgba(74,158,114,0.15)':active?`${ph.color}25`:'transparent',borderLeft:`2px solid ${isComplete?C.ok:active?ph.color:'transparent'}`,fontSize:18,color:isComplete?'#6FCF97':active?'#FFFFFF':isDone?'#CBD5E0':'#718096',transition:'all 0.15s'}}><div style={{width:15,height:15,borderRadius:'50%',border:`1.5px solid ${isComplete?C.ok:active?ph.color:isDone?'#4A9E72':'#4A5568'}`,background:isDone?'#4A9E72':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{isDone&&<Check size={8} color='#fff' strokeWidth={3}/>}</div>{META[sid]}</div>})}</div>)}</div>}

export default function PivotEngine(){
  const IP={loc:{country:'',city:'',work:''},resume:'',resumeFile:'',assess:'',assessFile:'',assessType:'',values:'',passions:'',rep:{memory:'',emergency:'',twoWords:'',other:''}}
  const IO={p1:'',p2:'',p3:'',p4:'',p5:'',p6:'',p7:'',p8:'',p_res:'',p9:'',p10:''}
  const[step,setStep]=useState('welcome')
  const[profile,setProfile]=useState(IP)
  const[outputs,setOutputs]=useState(IO)
  const[done,setDone]=useState([])
  const[deepOpts,setDeepOpts]=useState(['','',''])
  const[chosen,setChosen]=useState('')
  const[feedback,setFeedback]=useState({p1:'',p2:'',p3:'',p4:'',p5:''})
  const setFb=(k,v)=>setFeedback(f=>({...f,[k]:v}))
  const[loading,setLoading]=useState(false)
  const[loadMsg,setLoadMsg]=useState('')
  const[err,setErr]=useState(null)
  const[copied,setCopied]=useState(false)
  const[csvCopied,setCsvCopied]=useState(false)
  const[fileLoading,setFileLoading]=useState(false)
  const[surveyDone,setSurveyDone]=useState(false)
  const[survey,setSurvey]=useState({nps:null,valuable:'',confidence:null,accuracy:null,open:''})
  const[surveySubmitted,setSurveySubmitted]=useState(false)
  const setSv=(k,v)=>setSurvey(s=>({...s,[k]:v}))

  useEffect(()=>{const load=async()=>{try{const r=localStorage.getItem('pe_v3');if(r){const d=JSON.parse(r);if(d.step)setStep(d.step);if(d.profile)setProfile(d.profile);if(d.outputs)setOutputs(d.outputs);if(d.done)setDone(d.done);if(d.deepOpts)setDeepOpts(d.deepOpts);if(d.chosen)setChosen(d.chosen)}}catch{}};load()},[])
  useEffect(()=>{const save=async()=>{try{localStorage.setItem('pe_v3',JSON.stringify({step,profile,outputs,done,deepOpts,chosen}))}catch{}};const t=setTimeout(save,800);return()=>clearTimeout(t)},[step,profile,outputs,done,deepOpts,chosen])

  const pr=(f,v)=>setProfile(p=>({...p,[f]:v}))
  const loc=(f,v)=>setProfile(p=>({...p,loc:{...p.loc,[f]:v}}))
  const rep=(f,v)=>setProfile(p=>({...p,rep:{...p.rep,[f]:v}}))
  const out=(k,v)=>setOutputs(o=>({...o,[k]:v}))
  const markDone=(sid)=>setDone(d=>d.includes(sid)?d:[...d,sid])
  const advance=(from,to)=>{markDone(from);setStep(to);setErr(null)}
  const nav=(to)=>{setStep(to);setErr(null)}
  const generate=async(key,fn,opts={})=>{setLoading(true);setErr(null);setLoadMsg(opts.msg||'Generating your analysis…');try{const r=await callClaude(fn(),opts);out(key,r)}catch(e){setErr(e.message)}finally{setLoading(false)}}
  const copy=(text)=>{navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000)}
  const reset=async()=>{if(confirm('Reset all progress and start over?')){try{localStorage.removeItem('pe_v3')}catch{};setStep('welcome');setProfile(IP);setOutputs(IO);setDone([]);setDeepOpts(['','','']);setChosen('');setFeedback({p1:'',p2:'',p3:'',p4:'',p5:''})}}
  const prog=Math.round((ALL.indexOf(step)/(ALL.length-1))*100)
  const pc={loc:profile.loc,resume:profile.resume,assess:profile.assess,assessType:profile.assessType,values:profile.values,passions:profile.passions,rep:profile.rep}

  const loadDemo=(jumpTo)=>{
    const demoProfile={
      loc:{country:'United States',city:'Atlanta, GA',work:'Hybrid — within commuting distance of home base'},
      resume:`SARAH CHEN | Atlanta, GA | sarah.chen@email.com | linkedin.com/in/sarahchen

PROFESSIONAL EXPERIENCE

VP, Talent Acquisition — Meridian Health System | 2019–Present
- Led recruiting function for 14,000-employee health system across 6 markets
- Reduced time-to-fill for clinical roles from 67 to 41 days, saving $4.2M annually in agency spend
- Built and scaled team from 8 to 22 recruiters during COVID-era hiring surge
- Implemented ATS migration (Taleo to Workday) across all business units; trained 300+ hiring managers
- Partnered with CFO to model workforce demand for $280M capital expansion project

Senior Talent Partner — PulteGroup | 2015–2019
- Supported full-cycle recruiting for construction, finance, and corporate functions
- Sourced and closed 180+ hires annually with 91% hiring manager satisfaction score
- Launched employee referral program that generated 34% of hires within 18 months
- Reduced offer decline rate from 22% to 9% through compensation benchmarking project

Talent Acquisition Specialist — NCR Corporation | 2012–2015
- Recruited for software engineering, sales, and operations roles globally
- Managed relationships with 12 universities for campus recruiting program
- Supported HRIS implementation project as functional lead for recruiting module

EDUCATION
MBA, Human Resources — Georgia State University, 2014
BA, Psychology — University of Georgia, 2010

CERTIFICATIONS
SHRM-SCP | LinkedIn Recruiter Certified | Workday HCM Certified`,
      resumeFile:'sarah_chen_resume.pdf',
      assess:`Affintus Results — Sarah Chen

Work Style: Systematic and people-oriented. Builds trust through consistency and follow-through. Energized by complex coordination challenges where relationships and process intersect.

Strengths: Relationship building, project management, persuasion, analytical thinking, organizational awareness.

Ideal Environment: Collaborative culture with clear accountability. Appreciates autonomy within structure. Works best when she can see how her work connects to larger organizational outcomes.

Decision-Making: Gathers input broadly before deciding. Reluctant to move without sufficient data but adapts well once committed.

Caution Areas: Can over-invest in consensus; may delay difficult decisions when interpersonal stakes are high.`,
      assessType:'Affintus',
      values:'Family, Financial security, Meaningful work, Continuous growth, Fairness',
      passions:'Healthcare innovation, Youth mentoring, Real estate investing, Travel, Organizational psychology',
      rep:{
        memory:`My CHRO stopped me in the hall after we hit our Q3 hiring targets during the worst labor market in decades and said "I don't know how you did that, but you just saved this organization." That stuck with me.`,
        emergency:`If the system had a critical retention crisis or a high-profile failed search, they'd call me. I'm the person who can diagnose what went wrong and rebuild confidence with the hiring team quickly.`,
        twoWords:`Trusted architect`,
        other:`360 feedback theme: "Sarah makes everyone feel like their hiring problem is her top priority — and somehow it actually is." LinkedIn recommendation from former CPO: "Sarah is the rare talent leader who speaks the language of the business as fluently as she speaks HR. She made us better at hiring, and better at thinking about people as a strategic asset."`
      }
    }
    const demoOutputs={
      p1:`## Altitude & Context

Sarah Chen has operated at the VP level within a large, complex health system — 14,000 employees, multi-market, high-stakes hiring environment. She has led teams, managed vendor relationships, driven technology transformations, and partnered at the executive level. The environments she has navigated are fast-moving, politically complex, and resource-constrained. Her seniority baseline is senior director to VP.

## Translated Accomplishments

**1. Cut clinical hiring costs by $4.2M annually**
Reduced time-to-fill from 67 to 41 days, eliminating reliance on agency staffing. Translated: saved money at meaningful scale by building internal capability.

**2. Scaled a team 175% during a demand surge**
Grew recruiting function from 8 to 22 during COVID hiring pressures without a drop in quality. Translated: mitigated organizational risk during a period when talent scarcity could have shut down clinical operations.

**3. Delivered a system-wide ATS migration**
Moved 14,000-person organization from Taleo to Workday and trained 300+ hiring managers. Translated: saved money long-term through better tooling and mitigated the operational risk of a failed technology transition.

**4. Built a referral program generating 34% of hires**
Launched from scratch at PulteGroup; referral hires typically cost 50–60% less than external searches. Translated: made money by reducing cost-per-hire at scale.

**5. Compressed offer decline rate from 22% to 9%**
Data-driven compensation benchmarking project. Translated: saved money and mitigated risk of losing finalists after significant recruiting investment.

**6. Supported a $280M workforce planning project**
Partnered with the CFO to model headcount demand tied to capital expansion. Translated: mitigated financial risk by ensuring the right workforce was in place before major capital deployment.

*Missing numbers to find: headcount impact of referral program at NCR, dollar value of agency spend reduction at PulteGroup, specifics of HRIS project scope and timeline.*`,
      p2:`## The How Analysis

Sarah's Affintus profile — systematic, relationship-oriented, persuasion-capable, analytically grounded — maps closely onto her strongest accomplishments. The ATS migration required both the analytical rigor to manage a complex technical project and the relational skill to bring 300 skeptical hiring managers along. The referral program required designing a system and then selling it internally. The offer decline work required data analysis and then a difficult conversation with compensation leadership.

Her pattern is consistent: she solves problems that sit at the intersection of process and people. She doesn't just build systems — she brings people with her.

## The Environment Filter

Sarah does her best work in organizations where she has real access to leadership and can connect her function to business outcomes. She needs to see the "why" behind her work. Pure transactional recruiting environments — high volume, low strategy — would underutilize her. She thrives with a degree of autonomy, collaborative peers, and problems complex enough to require genuine judgment.

She is well-suited for organizations that take talent seriously at the executive level: where the CHRO has a seat at the table and recruiting is seen as a business function, not a cost center.

## Passion Log

Healthcare innovation and organizational psychology registered strongly and connect directly to her current work. Real estate investing signals financial acumen and an entrepreneurial instinct worth exploring. Youth mentoring suggests a service orientation and comfort in coaching and development roles — which may be underutilized in her current function.`,
      p3:`## The Golden Thread

Across every role and every piece of external feedback, one pattern holds: Sarah makes complicated people-and-process problems look manageable. She earns trust from both senior leaders and frontline teams by combining analytical credibility with genuine relationship investment. She does not just recommend solutions — she builds them, teaches others to use them, and stays accountable to the outcome.

The two-word superpower — "trusted architect" — captures it well. She is not a transactional operator. She designs systems and then makes sure they work in the hands of real people.

## Functional Identity

A senior people-strategy leader who turns workforce challenges into measurable business outcomes, with a track record of building the internal capabilities organizations need to grow through complexity. She works at the intersection of data, process, and relationships — and consistently earns the trust of executives and teams who need both results and confidence.`,
      p4:'',p5:'',p6:'',p7:'',p8:'',p_res:'',p9:'',p10:''
    }
    const demoDone=jumpTo==='complete'?[...ALL.filter(s=>s!=='complete')]:['welcome','location','resume','assessment','values','reputation','p1','p2','p3']
    setProfile(demoProfile)
    setOutputs(demoOutputs)
    setDone(demoDone)
    setChosen('')
    setDeepOpts(['','',''])
    setStep(jumpTo)
    setErr(null)
  }

  const rStep=()=>{switch(step){
    case'welcome':return <div>
      <div style={{fontFamily:'Georgia,serif',fontSize:32,fontWeight:700,color:C.cream,lineHeight:1.15,marginBottom:6,maxWidth:500}}>Reimagine</div>
      <div style={{fontFamily:'Georgia,serif',fontSize:18,fontWeight:400,color:C.goldL,marginBottom:16}}>Your career. Your future.</div>
      <p style={{...S.sub,fontSize:14,maxWidth:560}}>Reimagine is a step-by-step career strategy tool built on the framework from Making Your Own Weather by Bob Goodwin. It takes what you've done, how you're wired, and what you care about — and turns that into a concrete plan for what comes next.</p>

      <div style={{...S.card,marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:C.gold,letterSpacing:'1.5px',textTransform:'uppercase',marginBottom:14}}>Before you begin</div>
        {[
          ['Your resume','Any format. It doesn\'t need to be polished — we\'ll help you get the most out of it.'],
          ['An assessment (recommended)','Affintus is free and takes 15 minutes. If you already have StrengthsFinder, Hogan, DiSC, MBTI, or any other assessment, those work just as well. Bring whatever you have.'],
          ['About 20–30 minutes','You can save and return at any point. Your progress is stored automatically.'],
        ].map(([t,d])=><div key={t} style={{display:'flex',gap:12,marginBottom:12,alignItems:'flex-start'}}>
          <div style={{width:6,height:6,borderRadius:'50%',background:C.gold,flexShrink:0,marginTop:6}}/>
          <div><span style={{fontWeight:600,fontSize:20,color:C.cream}}>{t}. </span><span style={{fontSize:20,color:C.gray,lineHeight:1.6}}>{d}</span></div>
        </div>)}
        <div style={{marginTop:4,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
          <a href="https://affintus.com/job-seekers/" target="_blank" rel="noopener" style={{color:C.goldL,fontSize:13}}>Take the free Affintus assessment before you start →</a>
        </div>
      </div>

      <div style={{...S.card,marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:C.gold,letterSpacing:'1.5px',textTransform:'uppercase',marginBottom:14}}>How it works</div>
        {[
          ['1','Know Your Value','We translate your career history into language that travels across industries. Job titles and jargon stripped out. Business impact in.','~10 min','#8A7AB8'],
          ['2','Explore Options','We map three lanes of possibility — from a modernized version of what you do today, to paths you may never have considered. Then we go deep on the ones that resonate.','~15 min','#6AB88A'],
          ['3','Tell Your Story','We write three versions of your "Tell me about yourself" — 30, 60, and 90 seconds — as a confident, natural bridge from where you\'ve been to where you\'re going.','~5 min','#C8924A'],
          ['4','Find Your Market','We research real companies that are growing and likely hiring, build your target list, and write your opening outreach message.','~10 min','#B86A6A'],
          ['5','Get Ready','We rewrite your LinkedIn and resume for your new direction, teach you the language of your new field, and prepare you for the hardest question you\'ll face in a room.','~15 min','#6A8AB8'],
        ].map(([num,phase,desc,time,color])=><div key={num} style={{display:'flex',gap:14,marginBottom:16,alignItems:'flex-start'}}>
          <div style={{width:28,height:28,borderRadius:'50%',background:`${color}25`,border:`1.5px solid ${color}60`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:15,fontWeight:700,color}}>
            {num}
          </div>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:3,flexWrap:'wrap'}}>
              <span style={{fontWeight:600,fontSize:20,color:C.cream}}>{phase}</span>
              <span style={{fontSize:15,color:C.gray}}>{time}</span>
            </div>
            <div style={{fontSize:20,color:C.gray,lineHeight:1.65}}>{desc}</div>
          </div>
        </div>)}
      </div>

      <div style={{...S.card,marginBottom:20}}>
        <div style={{fontSize:13,fontWeight:700,color:C.gold,letterSpacing:'1.5px',textTransform:'uppercase',marginBottom:12}}>A few things worth knowing</div>
        {[
          ['This is iterative, not linear.','Every output has a "Does this feel right?" option. If something is off, tell us and we\'ll adjust before moving on.'],
          ['There are no wrong answers in the intake.','The questions about your passions and values are not trick questions. Answer them honestly, not strategically.'],
          ['You only need one yes.','The goal is not to generate a list of plausible options. It\'s to find the one path worth committing to.'],
        ].map(([t,d])=><div key={t} style={{display:'flex',gap:12,marginBottom:12,alignItems:'flex-start'}}>
          <div style={{width:6,height:6,borderRadius:'50%',background:C.gold,flexShrink:0,marginTop:6}}/>
          <div><span style={{fontWeight:600,fontSize:20,color:C.cream}}>{t} </span><span style={{fontSize:20,color:C.gray,lineHeight:1.6}}>{d}</span></div>
        </div>)}
      </div>

      <div style={S.row}><Btn onClick={()=>advance('welcome','location')}>Let's get started <ChevronRight size={14}/></Btn></div>
    </div>

    case'location':return <div>
      <div style={S.tag('#6A9BB8')}>Phase 0 · Orientation</div>
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
      <div style={S.tag('#6A9BB8')}>Phase 0 · Orientation</div>
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
      <div style={S.tag('#6A9BB8')}>Phase 0 · Orientation</div>
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
      <div style={S.tag('#6A9BB8')}>Phase 0 · Orientation</div>
      <h1 style={S.title}>Values & Passions</h1>
      <p style={S.sub}>These two inputs separate a list of plausible options from a list of right options. Don't filter for professional relevance — that's our job.</p>
      <div style={S.card}>
        <div style={S.field}><label style={S.label}>Core Values — 3 to 5 non-negotiables</label><div style={{fontSize:15,color:C.gray,marginBottom:7,lineHeight:1.6}}>The conditions under which you do your best work and feel most like yourself.</div><textarea style={{...S.ta,minHeight:70}} value={profile.values} onChange={e=>pr('values',e.target.value)} placeholder="e.g. Independence, Family, Justice, Stability, Wealth creation, Cooperation, Service, Faith, Intellectual challenge…"/></div>
        <div style={S.field}><label style={S.label}>Passions & Interests — 3 to 5 topics</label><div style={{fontSize:15,color:C.gray,marginBottom:7,lineHeight:1.6}}>Topics you read about for fun or could talk about for 30 minutes with zero preparation.</div><textarea style={{...S.ta,minHeight:70}} value={profile.passions} onChange={e=>pr('passions',e.target.value)} placeholder="e.g. Formula 1, Fintech, Sustainability, Youth sports, Horses, Gaming, Geopolitics, Fashion, Addiction recovery…"/></div>
      </div>
      {err&&<ErrBox msg={err}/>}
      <div style={S.row}><Btn secondary onClick={()=>nav('assessment')}><ArrowLeft size={13}/>Back</Btn><Btn onClick={()=>profile.values&&profile.passions?advance('values','reputation'):setErr('Please fill in both fields.')}>Continue <ChevronRight size={14}/></Btn></div>
    </div>

    case'reputation':return <div>
      <div style={S.tag('#6A9BB8')}>Phase 0 · Orientation</div>
      <h1 style={S.title}>Your Reputation</h1>
      <p style={S.sub}>The hardest input to gather — and the most valuable. We're looking for external data: what others actually see in you.</p>
      <div style={S.card}>
        {[['memory','The Memory',"Think of a specific moment at work when someone thanked you or praised you. What was the situation and what did they say?"],['emergency','The Emergency Call','If your former team had a critical problem right now, what type of situation would they call you to handle?'],['twoWords','The Two Words','If your best former manager described your professional superpower in exactly two words, what would they be?'],['other','Additional Feedback','Performance reviews, LinkedIn recommendations, 360 feedback — paste anything here.']].map(([f,lbl,hint])=><div key={f} style={S.field}><label style={S.label}>{lbl}</label><div style={{fontSize:15,color:C.gray,marginBottom:7,lineHeight:1.6}}>{hint}</div><textarea style={{...S.ta,minHeight:f==='other'?90:62}} value={profile.rep[f]} onChange={e=>rep(f,e.target.value)}/></div>)}
        <div style={{fontSize:14,color:C.gray,fontStyle:'italic'}}>If you leave all blank, we'll generate a reputation hypothesis from your other data and ask you to validate it.</div>
      </div>
      <div style={S.row}><Btn secondary onClick={()=>nav('values')}><ArrowLeft size={13}/>Back</Btn><Btn onClick={()=>advance('reputation','p1')}>Begin Phase 1 <ChevronRight size={14}/></Btn></div>
    </div>

    case'p1':return <div>
      <div style={S.tag('#8A7AB8')}>Phase 1 · Know Your Value</div>
      <h1 style={S.title}>Resume Analysis</h1>
      <p style={S.sub}>We strip away job titles and industry jargon to find your universal value — what you've actually been doing for the businesses that employed you.</p>
      {!outputs.p1&&!loading&&<Btn onClick={()=>generate('p1',()=>P.p1(pc))}><Sparkles size={14}/>Analyze My Resume</Btn>}
      {loading&&<Loading msg={loadMsg||'Analyzing your career and translating accomplishments…'}/>}
      {outputs.p1&&<>
        <OutPanel text={outputs.p1} onCopy={copy} copied={copied}/>
        <RefineBox value={feedback.p1} onChange={v=>setFb('p1',v)} onRegenerate={v=>{out('p1','');generate('p1',()=>P.p1(pc)+(v?`\n\nUSER CONTEXT: ${v}`:''))}}/>
        <div style={S.row}><Btn secondary onClick={()=>out('p1','')}><RotateCcw size={13}/>Regenerate</Btn><Btn onClick={()=>advance('p1','p2')}>Continue <ChevronRight size={14}/></Btn></div>
      </>}
      {err&&<ErrBox msg={err}/>}
    </div>

    case'p2':return <div>
      <div style={S.tag('#8A7AB8')}>Phase 1 · Know Your Value</div>
      <h1 style={S.title}>Wiring & Compass</h1>
      <p style={S.sub}>We layer in how you're built — your assessment, values, and passions — to understand not just what you've done, but why you do it well and where you'll thrive.</p>
      {!outputs.p2&&!loading&&<Btn onClick={()=>generate('p2',()=>P.p2(pc,outputs.p1))}><Sparkles size={14}/>Analyze My Wiring</Btn>}
      {loading&&<Loading msg="Cross-referencing assessment, values, and accomplishments…"/>}
      {outputs.p2&&<>
        <OutPanel text={outputs.p2} onCopy={copy} copied={copied}/>
        <RefineBox value={feedback.p2} onChange={v=>setFb('p2',v)} onRegenerate={v=>{out('p2','');generate('p2',()=>P.p2(pc,outputs.p1)+(v?`\n\nUSER CONTEXT: ${v}`:''))}}/>
        <div style={S.row}><Btn secondary onClick={()=>out('p2','')}><RotateCcw size={13}/>Regenerate</Btn><Btn onClick={()=>advance('p2','p3')}>Continue <ChevronRight size={14}/></Btn></div>
      </>}
      {err&&<ErrBox msg={err}/>}
    </div>

    case'p3':return <div>
      <div style={S.tag('#8A7AB8')}>Phase 1 · Know Your Value</div>
      <h1 style={S.title}>Brand Synthesis</h1>
      <p style={S.sub}>The final data layer. We synthesize everything into your Golden Thread and Functional Identity: a crisp, title-free statement of what you bring to any organization.</p>
      {!outputs.p3&&!loading&&<Btn onClick={()=>generate('p3',()=>P.p3(pc,outputs.p1,outputs.p2))}><Sparkles size={14}/>Synthesize My Brand</Btn>}
      {loading&&<Loading msg="Finding the pattern across all your data…"/>}
      {outputs.p3&&<>
        <OutPanel text={outputs.p3} onCopy={copy} copied={copied}/>
        <RefineBox value={feedback.p3} onChange={v=>setFb('p3',v)} onRegenerate={v=>{out('p3','');generate('p3',()=>P.p3(pc,outputs.p1,outputs.p2)+(v?`\n\nUSER CONTEXT: ${v}`:''))}}/>
        <div style={S.row}><Btn secondary onClick={()=>out('p3','')}><RotateCcw size={13}/>Regenerate</Btn><Btn onClick={()=>advance('p3','p4')}>Begin Phase 2 <ChevronRight size={14}/></Btn></div>
      </>}
      {err&&<ErrBox msg={err}/>}
    </div>

    case'p4':return <div>
      <div style={S.tag('#6AB88A')}>Phase 2 · Explore Options</div>
      <h1 style={S.title}>The Wide View</h1>
      <p style={S.sub}>Before choosing, see the full picture. Three lanes of possibilities — starting with the ones furthest from where you've been, so you can consider what's genuinely possible before defaulting to the familiar.</p>
      {!outputs.p4&&!loading&&<Btn onClick={()=>generate('p4',()=>P.p4(pc,outputs.p1,outputs.p2,outputs.p3),{highTemp:true,maxTokens:5000,msg:'Mapping your opportunity landscape — this takes a moment…'})}><Sparkles size={14}/>Generate My Options</Btn>}
      {loading&&<Loading msg={loadMsg||'Mapping your full opportunity landscape across all three lanes…'}/>}
      {outputs.p4&&<>
        <OutPanel text={outputs.p4} onCopy={copy} copied={copied}/>
        <RefineBox value={feedback.p4} onChange={v=>setFb('p4',v)} onRegenerate={v=>{out('p4','');generate('p4',()=>P.p4(pc,outputs.p1,outputs.p2,outputs.p3)+(v?`\n\nUSER CONTEXT: ${v}`:''),{highTemp:true,maxTokens:5000,msg:'Refining your opportunity landscape…'})}}/>
        <div style={{...S.card,marginTop:8}}>
          <div style={{fontWeight:600,color:'#1A2540',fontSize:17,marginBottom:4}}>Select up to 3 options to explore further.</div>
          <div style={{fontSize:15,color:C.gray,marginBottom:16,lineHeight:1.6}}>Type the role or path that caught your attention. Pick what made you lean in, not just what feels safe.</div>
          {['A','B','C'].map((l,i)=><div key={l} style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
            <div onClick={()=>setDeepOpts(d=>d.map((v,j)=>j===i?(v?'':'?'):''))} style={{width:22,height:22,borderRadius:6,border:`2px solid ${deepOpts[i]&&deepOpts[i]!=='?'?C.gold:C.border}`,background:deepOpts[i]&&deepOpts[i]!=='?'?`${C.gold}20`:'white',flexShrink:0,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              {deepOpts[i]&&deepOpts[i]!=='?'&&<Check size={13} color={C.gold} strokeWidth={3}/>}
            </div>
            <input style={{...S.inp,flex:1}} value={deepOpts[i]==='?'?'':deepOpts[i]} onChange={e=>setDeepOpts(d=>d.map((v,j)=>j===i?e.target.value:v))} placeholder={`Type or paste option ${l} from the list above…`}/>
          </div>)}
          {deepOpts.filter(v=>v&&v!=='?').length>0&&<div style={S.row}><Btn onClick={()=>advance('p4','p5')}>Go Deeper <ChevronRight size={14}/></Btn></div>}
          {deepOpts.filter(v=>v&&v!=='?').length===0&&<div style={{fontSize:15,color:C.gray}}>Enter at least one option above to continue.</div>}
        </div>
      </>}
      {err&&<ErrBox msg={err}/>}
    </div>

    case'p5':return <div>
      <div style={S.tag('#6AB88A')}>Phase 2 · Explore Options</div>
      <h1 style={S.title}>The Deep Dive</h1>
      <p style={S.sub}>We'll make the full case for each option you selected: why it fits, what the day-to-day looks like, how to explain the transition, and the one real challenge to prepare for.</p>
      {deepOpts.filter(Boolean).length>0&&<div style={{...S.note,marginBottom:16}}>Exploring: {deepOpts.filter(Boolean).map((o,i)=><strong key={i} style={{color:C.cream,marginRight:12}}>{o}</strong>)}</div>}
      {!outputs.p5&&!loading&&deepOpts.filter(Boolean).length>0&&<Btn onClick={()=>generate('p5',()=>P.p5(pc,outputs,deepOpts),{maxTokens:5000,msg:'Building your deep dive…'})}><Sparkles size={14}/>Explore These Options</Btn>}
      {deepOpts.filter(Boolean).length===0&&!outputs.p5&&<div style={{...S.err,marginTop:0}}><AlertCircle size={13} color={C.err} style={{flexShrink:0}}/><span>Go back to The Wide View and select at least one option to explore.</span></div>}
      {loading&&<Loading msg={loadMsg||'Building your deep dive on each option…'}/>}
      {outputs.p5&&<>
        <OutPanel text={outputs.p5} onCopy={copy} copied={copied}/>
        <RefineBox value={feedback.p5} onChange={v=>setFb('p5',v)} onRegenerate={v=>{out('p5','');generate('p5',()=>P.p5(pc,outputs,deepOpts)+(v?`\n\nUSER CONTEXT: ${v}`:''),{maxTokens:5000,msg:'Rebuilding your deep dive…'})}}/>
        <div style={S.row}><Btn secondary onClick={()=>{out('p5','');setDeepOpts(['','','']);nav('p4')}}><RotateCcw size={13}/>Try Different Options</Btn><Btn onClick={()=>advance('p5','decision')}>Make My Decision <ChevronRight size={14}/></Btn></div>
      </>}
      {err&&<ErrBox msg={err}/>}
    </div>

    case'decision':return <div>
      <div style={S.tag('#6AB88A')}>Phase 2 · Explore Options</div>
      <h1 style={S.title}>Your Decision</h1>
      <p style={S.sub}>Read through the deep dive. There is no wrong answer — the goal is a choice you can commit to, not a perfect choice. You only need one yes.</p>
      <div style={S.card}>
        <label style={S.label}>I've decided to pursue…</label>
        <div style={{fontSize:15,color:C.gray,marginBottom:10,lineHeight:1.6}}>Type the role or path you're committing to. This becomes the foundation for Phases 3–5.</div>
        <textarea style={{...S.ta,minHeight:75}} value={chosen} onChange={e=>setChosen(e.target.value)} placeholder="e.g. Fractional CMO in the B2B SaaS ecosystem, Vendor-side consultant in healthcare, Independent financial planner focused on sustainable investing…"/>
      </div>
      <div style={S.card}>
        <div style={{fontWeight:600,color:C.cream,fontSize:13,marginBottom:9}}>Not ready yet?</div>
        <Btn secondary onClick={()=>{out('p5','');setDeepOpts(['','','']);nav('p5')}}>Explore different options →</Btn>
        <div style={{fontSize:15,color:C.gray,marginTop:9}}>Or close the tool and come back — your progress is saved automatically.</div>
      </div>
      {err&&<ErrBox msg={err}/>}
      <div style={S.row}><Btn onClick={()=>chosen?advance('decision','p6'):setErr('Please enter your decision to continue.')}>Build My Bridge Story <ChevronRight size={14}/></Btn></div>
    </div>

    case'p6':return <div>
      <div style={S.tag('#C8924A')}>Phase 3 · Tell Your Story</div>
      <h1 style={S.title}>Your Bridge Story</h1>
      <p style={S.sub}>Three versions of your "Tell Me About Yourself" — 30, 60, and 90 seconds. Written to be said aloud.</p>
      <div style={S.note}>Pursuing: <strong style={{color:C.cream}}>{chosen}</strong></div>
      {!outputs.p6&&!loading&&<Btn onClick={()=>generate('p6',()=>P.p6(pc,outputs,chosen),{maxTokens:4000})}><Sparkles size={14}/>Write My Bridge Story</Btn>}
      {loading&&<Loading msg="Crafting your bridge story in three lengths…"/>}
      {outputs.p6&&<><OutPanel text={outputs.p6} onCopy={copy} copied={copied}/><div style={S.row}><Btn secondary onClick={()=>out('p6','')}><RotateCcw size={13}/>Regenerate</Btn><Btn onClick={()=>advance('p6','p7')}>Build My Go-to-Market <ChevronRight size={14}/></Btn></div></>}
      {err&&<ErrBox msg={err}/>}
    </div>

    case'p7':return <div>
      <div style={S.tag('#B86A6A')}>Phase 4 · Find Your Market</div>
      <h1 style={S.title}>Go-to-Market Strategy</h1>
      <p style={S.sub}>Most hiring happens before a posting goes live — or without one ever going live. Your target company list and outreach strategy. No job boards.</p>
      <div style={S.note}><strong style={{color:C.gold}}>Live research enabled.</strong> We search for companies that are growing, investing, and most likely to be hiring — and flag ones showing signs of contraction.</div>
      {!outputs.p7&&!loading&&<Btn onClick={()=>generate('p7',()=>P.p7(pc,outputs,chosen),{webSearch:true,maxTokens:6000,msg:'Researching target companies and building your strategy…'})}><Sparkles size={14}/>Build My Strategy</Btn>}
      {loading&&<Loading msg={loadMsg||'Researching companies and building your outreach strategy…'}/>}
      {outputs.p7&&(()=>{
        const downloadCSV=()=>{
          const lines=outputs.p7.split('\n').filter(l=>l.includes('|')&&!l.match(/^[\s|:-]+$/))
          const csv='Company,Why it fits,Growth signal,Contact title,Website\n'+lines.map(l=>{const p=l.split('|').map(s=>s.trim());return p.map(s=>`"${s.replace(/"/g,'""')}"`).join(',')}).join('\n')
          const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='target_companies.csv';a.click()
        }
        const splitPoint=outputs.p7.search(/##?\s*PART 3|##?\s*Outreach Template/i)
        const part12=splitPoint>0?outputs.p7.slice(0,splitPoint):outputs.p7
        const part34=splitPoint>0?outputs.p7.slice(splitPoint):''
        return <>
          <div style={S.out}><div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}><Btn small onClick={()=>copy(outputs.p7)}>{copied?<><CheckCheck size={11}/>Copied</>:<><Copy size={11}/>Copy All</>}</Btn></div><MD text={part12}/></div>
          <div style={{margin:'16px 0',padding:'16px 20px',background:`${C.gold}14`,border:`2px solid ${C.gold}60`,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'space-between',gap:16}}>
            <div>
              <div style={{fontWeight:700,fontSize:15,color:'#1A2540',marginBottom:3}}>Download your company list</div>
              <div style={{fontSize:14,color:C.goldL}}>Save as a spreadsheet to track outreach, add notes, and share with your network.</div>
            </div>
            <Btn onClick={()=>{
              const lines=outputs.p7.split('\n').filter(l=>l.includes('|')&&l.trim().length>10&&!l.match(/^[\s|:-]+$/))
              const csv=lines.length>2
                ?'Company,Why it fits,Growth signal,Contact title,Website\n'+lines.map(l=>{const p=l.split('|').map(s=>s.trim());return p.map(s=>`"${s.replace(/"/g,'""')}"`).join(',')}).join('\n')
                :outputs.p7
              const blob=new Blob([csv],{type:'text/csv'})
              const url=URL.createObjectURL(blob)
              const a=document.createElement('a')
              a.href=url
              a.download='target_companies.csv'
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              URL.revokeObjectURL(url)
            }} style={{flexShrink:0}}>Download CSV</Btn>
          </div>
          {part34&&<div style={S.out}><MD text={part34}/></div>}
          <div style={S.row}>
            <Btn secondary onClick={()=>out('p7','')}><RotateCcw size={13}/>Regenerate</Btn>
            <Btn onClick={()=>advance('p7','p8')}>Begin Preparation <ChevronRight size={14}/></Btn>
          </div>
        </>
      })()}
      {err&&<ErrBox msg={err}/>}
    </div>

    case'p8':return <div>
      <div style={S.tag('#6A8AB8')}>Phase 5 · Get Ready</div>
      <h1 style={S.title}>LinkedIn Remix</h1>
      <p style={S.sub}>Your LinkedIn profile is the first thing target buyers see after you reach out. We'll rewrite your headline, About section, and experience bullets.</p>
      {!outputs.p8&&!loading&&<Btn onClick={()=>generate('p8',()=>P.p8(pc,outputs,chosen),{maxTokens:3000})}><Sparkles size={14}/>Remix My LinkedIn</Btn>}
      {loading&&<Loading msg="Rewriting your LinkedIn for your new direction…"/>}
      {outputs.p8&&<><OutPanel text={outputs.p8} onCopy={copy} copied={copied}/><div style={S.row}><Btn secondary onClick={()=>out('p8','')}><RotateCcw size={13}/>Regenerate</Btn><Btn onClick={()=>advance('p8','p_res')}>Continue <ChevronRight size={14}/></Btn></div></>}
      {err&&<ErrBox msg={err}/>}
    </div>

    case'p_res':return <div>
      <div style={S.tag('#6A8AB8')}>Phase 5 · Get Ready</div>
      <h1 style={S.title}>Resume Refresh</h1>
      <p style={S.sub}>Your resume, rewritten to speak directly to your new direction. Same career, new framing — every bullet tied to a business result relevant to where you're headed.</p>
      <div style={S.note}>Targeting: <strong style={{color:C.cream}}>{chosen}</strong></div>
      {!outputs.p_res&&!loading&&<Btn onClick={()=>generate('p_res',()=>P.p_res(pc,outputs,chosen),{maxTokens:4000})}><Sparkles size={14}/>Refresh My Resume</Btn>}
      {loading&&<Loading msg="Rewriting your resume for your new direction…"/>}
      {outputs.p_res&&<><OutPanel text={outputs.p_res} onCopy={copy} copied={copied}/><div style={S.row}><Btn secondary onClick={()=>out('p_res','')}><RotateCcw size={13}/>Regenerate</Btn><Btn onClick={()=>advance('p_res','p9')}>Continue <ChevronRight size={14}/></Btn></div></>}
      {err&&<ErrBox msg={err}/>}
    </div>

    case'p9':return <div>
      <div style={S.tag('#6A8AB8')}>Phase 5 · Get Ready</div>
      <h1 style={S.title}>The Crash Course</h1>
      <p style={S.sub}>You're entering this field as a credible outsider. This gives you what you need to sound like a native in one focused study session.</p>
      {!outputs.p9&&!loading&&<Btn onClick={()=>generate('p9',()=>P.p9(pc,outputs,chosen),{maxTokens:3000})}><Sparkles size={14}/>Build My Crash Course</Btn>}
      {loading&&<Loading msg="Building your industry crash course…"/>}
      {outputs.p9&&<><OutPanel text={outputs.p9} onCopy={copy} copied={copied}/><div style={S.row}><Btn secondary onClick={()=>out('p9','')}><RotateCcw size={13}/>Regenerate</Btn><Btn onClick={()=>advance('p9','p10')}>Final Step <ChevronRight size={14}/></Btn></div></>}
      {err&&<ErrBox msg={err}/>}
    </div>

    case'p10':return <div>
      <div style={S.tag('#6A8AB8')}>Phase 5 · Get Ready</div>
      <h1 style={S.title}>The Devil's Advocate</h1>
      <p style={S.sub}>The best defense is preparation. We surface the hardest question you'll face in a real room — then give you the answer. You'll hear it here before you hear it there.</p>
      {!outputs.p10&&!loading&&<Btn onClick={()=>generate('p10',()=>P.p10(pc,outputs,chosen),{maxTokens:2000})}><Sparkles size={14}/>Face the Hardest Question</Btn>}
      {loading&&<Loading msg="Preparing your toughest challenge and best defense…"/>}
      {outputs.p10&&<><OutPanel text={outputs.p10} onCopy={copy} copied={copied}/><div style={S.row}><Btn secondary onClick={()=>out('p10','')}><RotateCcw size={13}/>Regenerate</Btn><Btn onClick={()=>advance('p10','complete')}>Complete My Reimagine <ChevronRight size={14}/></Btn></div></>}
      {err&&<ErrBox msg={err}/>}
    </div>

    case'complete':return <div>
      <div style={{background:`linear-gradient(135deg,${C.panel} 0%,${C.card} 100%)`,border:`1px solid ${C.gold}35`,borderRadius:16,padding:'36px',textAlign:'center',marginBottom:22}}>
        <Trophy size={32} color={C.gold} style={{margin:'0 auto 14px',display:'block'}}/>
        <h1 style={{...S.title,fontSize:26,textAlign:'center',marginBottom:8}}>You've done the work.</h1>
        <p style={{fontSize:17,color:C.goldL,lineHeight:1.5,fontFamily:'Georgia,serif',fontStyle:'italic',marginBottom:6}}>Your career. Your future.</p>
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
              try{
                await fetch('https://script.google.com/macros/s/AKfycbz5RgmQgmqM4qhar3YviuoPMbDvdSKSOJlRX6-qmbQKOI7t6IbnETxkc-NfG3m4LitAtg/exec',{method:'POST',body:JSON.stringify({...survey,chosen,timestamp:new Date().toISOString()})})
              }catch{}
              setSurveySubmitted(true)
            }}>Submit Feedback</Btn>
            <Btn secondary onClick={()=>setSurveyDone(true)}>No thanks</Btn>
          </div>
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
        {[['Your Functional Identity','p3',outputs.p3],['Your Bridge Story','p6',outputs.p6],['Go-to-Market Strategy','p7',outputs.p7],['LinkedIn Remix','p8',outputs.p8],['Resume Refresh','p_res',outputs.p_res],['Crash Course','p9',outputs.p9],["Devil's Advocate",'p10',outputs.p10]].filter(([,,c])=>c).map(([title,key,content])=><div key={key} style={{...S.card,marginBottom:12}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div style={{fontFamily:'Georgia,serif',fontSize:16,fontWeight:600,color:'#1A2540'}}>{title}</div><div style={{display:'flex',gap:7}}><Btn small onClick={()=>copy(content)}>{copied?<><CheckCheck size={10}/>Copied</>:<><Copy size={10}/>Copy</>}</Btn><Btn small onClick={()=>nav(key)}>View →</Btn></div></div><div style={{fontSize:15,color:C.gray,lineHeight:1.6}}>{content.substring(0,260)}…</div></div>)}
        <div style={{marginTop:16,padding:'16px',background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,fontSize:15,color:C.gray,lineHeight:1.7}}><strong style={{color:'#1A2540'}}>Your progress is saved.</strong> Close this and return at any time — everything will be here.</div>
        <div style={{marginTop:10,textAlign:'right'}}><Btn small onClick={reset}><RotateCcw size={11}/>Start a New Session</Btn></div>
      </>}
    </div>

    default:return null
  }}

  return <>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap" rel="stylesheet"/>
    <div style={{minHeight:'100vh',background:C.bg,color:C.cream,fontFamily:'Outfit,sans-serif',display:'flex',flexDirection:'column'}}>
      <div style={{background:'#1A2540',borderBottom:`1px solid #0F1A30`,padding:'12px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div>
          <div style={{fontFamily:'Georgia,serif',fontSize:17,fontWeight:700,color:C.gold}}>Reimagine</div>
          <div style={{fontSize:11,color:C.gray,letterSpacing:'1.5px',textTransform:'uppercase',marginTop:1}}>Your career. Your future. · Career Club</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{fontSize:11,color:C.gray}}>{prog}% complete</div>
          <div style={{width:80,height:3,background:C.border,borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',width:`${prog}%`,background:C.gold,borderRadius:2,transition:'width 0.5s'}}/></div>
        </div>
      </div>
      <div style={{display:'flex',flex:1,minHeight:0}}>
        <Sidebar step={step} done={done} onNav={nav}/>
        <div style={{flex:1,padding:'30px 38px 60px',overflowY:'auto',maxWidth:800}}>{rStep()}</div>
      </div>
    </div>
  </>
}
