# Reimagine Next Batch — Handoff Brief

**Status:** DRAFT — Bob still adding to it. Do not execute yet.

**Repo:** github.com/reimaginebob/reimagine
**File:** `src/App.jsx`
**Branch:** `main` (Vercel auto-deploys on push)

---

## Goal

Bundle two queued enhancements from the beta-feedback window into a single batch deploy:

1. **STEP_QUOTES restoration** — restore the step-scoped quote pool drawn from Making Your Own Weather, lost in the prior truncation incident. Loading screens currently rotate generic inspiration; this restores Bob's voice from his book, contextual to whichever phase the user is on.
2. **p7 company blocks expanded into a dossier** — add four fields per company (industry, size band, HQ, one-sentence "what they do") so the output doubles as research material, not just an outreach list. Update the CSV download to capture the new fields.

---

## Files

- `src/App.jsx` — all changes land here

---

## Changes

### Change 1: STEP_QUOTES restoration

**Where:** insert after the existing `const QUOTES = [...]` block (currently ends ~line 300 with `const SHUFFLED_QUOTES = ...`). The existing 95-quote `QUOTES` array becomes `ATTITUDE_QUOTES` (rename) and serves as the fallback pool.

**Step 1 — rename the existing pool:**
```
const QUOTES = [...]   →   const ATTITUDE_QUOTES = [...]
const SHUFFLED_QUOTES = (() => {...})()   →   delete (replaced by SHUFFLED_POOLS below)
```

**Step 2 — add `STEP_QUOTES` block:**
```js
const STEP_QUOTES = {
  // Phase 1: Know Your Value — self-knowledge, convictions, clarity
  p1: [
    "The self-knowledge you build here is the foundation everything else rests on.",
    "When you try to be all things to all potential employers, you end up in the junk drawer of their mind. A junk drawer is full of perfectly useful objects. None of it has a designated place, so none of it gets found when someone goes looking for something specific.",
    "What is actually, genuinely, demonstrably true about you — the things that would still be true if you stripped away your title, your company, your income, and your job description. This is the DNA of your personal brand. It has to be discovered from the inside.",
    "Clarity is the wisdom of knowing what to say yes to and knowing what to say no to.",
    "Your track record is your receipts. Your documented history of doing the work and getting results.",
    "The language of business is numbers. Financial statements are numbers. Board presentations are numbers. When companies make decisions, they reach for data.",
    "What you find on the other side of that struggle, if you go through it with intention, is not just a job. It is a sharper sense of who you are, what you want, and what you are worth.",
    "Your personal brand cannot be designed from the outside. It has to be discovered from the inside.",
    "The goal is to walk into any room, hear Tell Me About Yourself, and feel clarity where there used to be anxiety. You know who you are. You know your story. Now you are just telling the truth.",
    "Convictions lead to Clarity. Clarity leads to Confidence. Confidence is Contagious.",
    "You cannot manufacture confidence without the convictions underneath it.",
    "Having a strong background and being able to communicate it effectively are two different skills, and the gap between them is where most searches quietly stall.",
  ],
  // Phase 1 continued: p2 — assessment cross-reference
  p2: [
    "When you know your natural wiring specifically enough to name it, something shifts in how you talk about your work. You can explain not just what you accomplished but why you were the person who accomplished it.",
    "Your reputation is the external reflection of your convictions. It is some of the most powerful evidence you have, because it did not come from you.",
    "You need to be able to answer two questions clearly, specifically, and without hesitation. What are you looking for? And why you?",
  ],
  // Phase 1 continued: p3 — pattern synthesis
  p3: [
    "When you believe, you make me believe. That is the whole thing.",
    "You are not the problem. Getting the message right, directing it at the right companies, generating enough activity — these are the variables.",
  ],
  // Phase 2: Explore Options — opportunity landscape
  p4: [
    "There is not one perfect job out there for you. There are many good jobs for you — roles where your values, your strengths, your track record, and your genuine curiosity would combine into something that works.",
    "The worst outcome in a job search is taking the wrong job.",
    "What feels like risk — bringing a real piece of yourself into the conversation — is what creates the differentiation that actually gets the offer.",
    "You cannot build a pipeline by waiting for Requests for Proposals. A job posting is an RFP. Your resume is your RFP response. You submit it and then you hope and pray.",
    "Change creates need. Need creates opportunity. When you find those signals and connect them to your value proposition, you are no longer a cold outreach. You are a well-timed conversation.",
    "Choices equal leverage. Build the pipeline and keep it full.",
    "Proactive action produces results, and results encourage more proactive action. The cycle builds on itself in a way that reactive searching simply cannot replicate.",
    "A job posting is an RFP. Your resume is your RFP response. You have no visibility into the process, no access to the people making the decision, no way to stand out from the pile.",
    "They do not ultimately care what you did at your last company for its own sake. They care about whether what you did there is relevant to what they are trying to accomplish here. Your job is to build that bridge.",
    "Julie sent it to the general info inbox on the Contact Us page. They did not have a role for what Julie did. They created one for her.",
  ],
  // Phase 2 continued: p5 — deep dive
  p5: [
    "Specificity is what makes an answer feel real rather than rehearsed.",
    "Sometimes we have to slow down to hurry up.",
    "The Thought Process element of your STAR story shows strategic thinking in action. Rather than claiming you are a creative problem solver, you demonstrate it. Show, don't tell.",
    "When a resume is built well, it functions as the discussion guide for the conversation you want to have. Your bullets are not just a record of what you did. They are engineered to generate the specific questions you want to answer.",
    "The sole purpose of a resume is to get you past the first screen. That is its job. Not to get you the offer. Not to tell your whole story. Its one job is to get you the interview.",
  ],
  // Phase 3: Tell Your Story — bridge story, TMAY
  p6: [
    "They are hiring your brain. Not your resume. Not your list of previous employers. Your brain. They want to understand how you approach problems, what you notice that other people overlook, and why the choices you make are the choices you make.",
    "Practice does not make perfect. Practice makes habits. If you rehearse the wrong version of your story, you become very good at telling it wrong. What you need is perfect practice.",
    "Preparation becomes poise. Poise becomes composure. And composure is that quality of grounded confidence that people feel before they can articulate why.",
    "The goal is not a performance. Not a memorized script. A depth of preparation that lets you be present in the room and respond naturally.",
  ],
  // Phase 4: Find Your Market — networking, outreach, companies
  p7: [
    "Your job search is a team sport. The people around you — if you let them in — will help carry you.",
    "You are entering not with your hand out but with your hand up, volunteering to help. That shift in posture changes everything.",
    "A networking conversation is an exchange, not a charity transaction. Walk in like it.",
    "The worst that can happen is nothing. You are already not working at that company. You cannot be rejected from a job that was never posted.",
    "You are not asking the company to spend money on you. You are asking them to invest in a return.",
    "Do not do this alone. The camaraderie, shared ideas, networking access, and accountability that come from being in community will fuel your search in ways that going it solo simply cannot.",
    "The outreach IS the interview. When you reach out with a researched, personalized, thoughtful note, you are demonstrating in real time that you are a proactive, self-starting, initiative-taking person.",
  ],
  // Phase 5: Get Ready — LinkedIn refresh
  p8: [
    "Your personal brand cannot be designed from the outside. It has to be discovered from the inside.",
    "Your reputation is the external reflection of your convictions. It is some of the most powerful evidence you have, because it did not come from you.",
  ],
  // Phase 5: Get Ready — resume refresh
  p_res: [
    "The sole purpose of a resume is to get you past the first screen. That is its job. Not to get you the offer. Not to tell your whole story. Its one job is to get you the interview.",
    "When a resume is built well, it functions as the discussion guide for the conversation you want to have. Your bullets are engineered to generate the specific questions you want to answer.",
  ],
  // Phase 5: Get Ready — playbook + interview prep + negotiation (HEAVIEST — 3 parallel API calls)
  p9: [
    "Preparation becomes poise. Poise becomes composure. And composure is that quality of grounded confidence that people feel before they can articulate why.",
    "The goal is not a performance. Not a memorized script. A depth of preparation that lets you be present in the room and respond naturally.",
    "A great salesperson does not discount their product at the finish line. They know what it is worth, they have the data to support it, and they ask for it with confidence and warmth.",
    "The single best phrase in a negotiation is: would that be fair?",
    "State your number. And then be quiet.",
    "The ten thousand dollars you did not ask for this year becomes the basis for next year's raise, and the raise after that. Over a career, the compound effect of that one conversation is staggering.",
    "They are hiring your brain. Not your resume. Not your list of previous employers. Your brain. They want to understand how you approach problems and why the choices you make are the choices you make.",
    "Specificity is what makes an answer feel real rather than rehearsed.",
    "The Thought Process element of your STAR story shows strategic thinking in action. Rather than claiming you are a creative problem solver, you demonstrate it.",
    "Practice does not make perfect. Practice makes habits. What you need is perfect practice.",
    "When you know your natural wiring specifically enough to name it, something shifts in how you talk about your work.",
    "Choices equal leverage. Build the pipeline and keep it full.",
  ],
  // Bonus: Income Now
  income: [
    "Proactive action produces results, and results encourage more proactive action. The cycle builds on itself in a way that reactive searching simply cannot replicate.",
    "Change creates need. Need creates opportunity.",
    "You cannot build a pipeline by waiting for Requests for Proposals.",
    "What you find on the other side of that struggle, if you go through it with intention, is not just a job. It is a sharper sense of who you are, what you want, and what you are worth.",
  ],
}

const MYOW_ATTR = '— Making Your Own Weather (available on Amazon)'

const shuffleArr = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }

const SHUFFLED_POOLS = (() => {
  const pools = {}
  Object.keys(STEP_QUOTES).forEach(k => { pools[k] = shuffleArr(STEP_QUOTES[k]) })
  pools._attitude = shuffleArr(ATTITUDE_QUOTES)
  return pools
})()
```

**Step 3 — update the `Loading` component (currently around line 303):**
```js
function Loading({ msg = 'Generating your analysis…', step = '' }) {
  const [qi, setQi] = useState(0)
  const [fade, setFade] = useState(true)
  const pool = SHUFFLED_POOLS[step] || SHUFFLED_POOLS._attitude
  const isStepPool = !!SHUFFLED_POOLS[step]
  useEffect(() => {
    const t = setInterval(() => {
      setFade(false)
      setTimeout(() => { setQi(i => (i + 1) % pool.length); setFade(true) }, 600)
    }, 12000)
    return () => clearInterval(t)
  }, [pool.length])
  const q = pool[qi % pool.length]
  return <div style={{textAlign:'center',padding:'48px 24px',maxWidth:560,margin:'0 auto'}}>
    <Loader2 size={28} style={{color:C.gold,animation:'spin 0.9s linear infinite',margin:'0 auto 20px',display:'block'}}/>
    <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>
    <div style={{fontSize:18,color:C.grayL,marginBottom:28}}>{msg}</div>
    <div style={{borderLeft:`3px solid ${C.gold}`,paddingLeft:20,textAlign:'left',marginBottom:8,opacity:fade?1:0,transition:'opacity 0.6s'}}>
      <div style={{fontSize:17,color:'#1A2540',lineHeight:1.7,fontStyle:'italic',marginBottom:8}}>"{isStepPool ? q : q.text}"</div>
      <div style={{fontSize:14,color:C.gold,fontWeight:600}}>{isStepPool ? MYOW_ATTR : q.author}</div>
    </div>
    <div style={{fontSize:13,color:C.gray,marginTop:20}}>This may take 1–2 minutes</div>
  </div>
}
```

**Step 4 — thread the `step` prop through every `<Loading>` callsite.** Search for `<Loading` in the file. Each callsite is inside a step's case (e.g. `case 'p1':`) or a generic site (file upload, survey). Add `step="p1"` (or the matching step id) to each step-scoped callsite. Generic loaders (file reading, survey submit) get no `step` prop and fall back to `_attitude`.

Specifically (verify line numbers against the current file before editing):
- `case'p1'`'s Loading → `step="p1"`
- `case'p2'`'s Loading → `step="p2"`
- `case'p3'`'s Loading → `step="p3"`
- `case'p4'`'s Loading → `step="p4"`
- `case'p5'`'s Loading → `step="p5"`
- `case'p6'`'s Loading → `step="p6"`
- `case'p7'`'s Loading → `step="p7"`
- `case'p8'`'s Loading → `step="p8"`
- `case'p_res'`'s Loading → `step="p_res"`
- `case'p9'`'s Loading → `step="p9"`
- `case'income'`'s Loading → `step="income"`
- File-reading Loading sites (resume upload, assessment upload) → no step prop
- Survey submission spinner (uses `SHUFFLED_QUOTES[0]` directly, see ~line 1505) → update to use `SHUFFLED_POOLS._attitude[0]` since `SHUFFLED_QUOTES` is being deleted

**Step 5 — fix the survey-submitting fallback.** The complete-screen survey spinner currently does `SHUFFLED_QUOTES[0].text` and `.author`. Update to `SHUFFLED_POOLS._attitude[0].text` and `.author` since the `_attitude` pool is the renamed `ATTITUDE_QUOTES` (still has the `{text, author}` shape).

### Change 2: p7 dossier fields

**Where (prompt):** in `const P = { ... }`, the `p7` template literal, find the `**PART 2: TARGET COMPANY LIST.**` section and the `FORMAT: Each company MUST use this structured block format` block.

**Update the format spec to add four fields:**
```
**Company Name**
What they do: [one sentence describing the business in plain language]
Industry: [primary industry / sub-industry]
Size: [revenue band or headcount band, e.g. "$50M-$100M revenue" or "200-500 employees"]
HQ: [city, state/region, country]
Why it fits: [one sentence]
Growth signal: [one sentence]
Contact: [name and title, or "Contact not identified"]
Email: [convention] | [website URL]
```

Plus, after the format block, add this instruction:
```
The "What they do," "Industry," "Size," and "HQ" fields exist so this list doubles as research material. Be concrete. If you cannot find a reliable size or HQ from public sources, write "Size not confirmed" or "HQ not confirmed" rather than guessing.
```

**Where (CSV download):** the `parseCompanies` function inside the Download CSV button's onClick (currently around line 1249). Update to capture the four new fields and include them in the CSV header and rows.

```js
const parseCompanies = (text) => {
  const companies = []
  let current = null
  const finalize = () => {
    if (current && (current.fit || current.growth || current.contact || current.email || current.what || current.industry || current.size || current.hq)) {
      companies.push(current)
    }
    current = null
  }
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    const nameMatch = trimmed.match(/^\*\*([^*]+?)\*\*\.?$/)
    if (nameMatch) {
      const name = nameMatch[1].trim().replace(/\.$/, '')
      if (/^PART\s|^Company Name$|^Why it fits|^Growth signal|^Contact|^Email|^What they do|^Industry|^Size|^HQ|^The Hook|^The Story|^The Close|^Paragraph\s|^What/i.test(name)) { finalize(); continue }
      finalize()
      current = { name, what: '', industry: '', size: '', hq: '', fit: '', growth: '', contact: '', email: '' }
      continue
    }
    if (!current) continue
    if (/^What they do:/i.test(trimmed)) current.what = trimmed.replace(/^What they do:\s*/i, '').trim()
    else if (/^Industry:/i.test(trimmed)) current.industry = trimmed.replace(/^Industry:\s*/i, '').trim()
    else if (/^Size:/i.test(trimmed)) current.size = trimmed.replace(/^Size:\s*/i, '').trim()
    else if (/^HQ:/i.test(trimmed)) current.hq = trimmed.replace(/^HQ:\s*/i, '').trim()
    else if (/^Why it fits:/i.test(trimmed)) current.fit = trimmed.replace(/^Why it fits:\s*/i, '').trim()
    else if (/^Growth signal:/i.test(trimmed)) current.growth = trimmed.replace(/^Growth signal:\s*/i, '').trim()
    else if (/^Contact:/i.test(trimmed)) current.contact = trimmed.replace(/^Contact:\s*/i, '').trim()
    else if (/^Email:/i.test(trimmed)) current.email = trimmed.replace(/^Email:\s*/i, '').trim()
  }
  finalize()
  return companies
}
const companies = parseCompanies(outputs.p7)
const esc = s => `"${(s || '').replace(/"/g, '""')}"`
const csv = companies.length > 0
  ? 'Company,What they do,Industry,Size,HQ,Why it fits,Growth signal,Contact,Email\n' + companies.map(c => [c.name, c.what, c.industry, c.size, c.hq, c.fit, c.growth, c.contact, c.email].map(esc).join(',')).join('\n')
  : outputs.p7
```

---

## Additional changes Bob is adding

_(Bob: append additional items below as you think of them. I'll integrate them into the brief structure once you say "ready to ship.")_

-
-
-

---

## Verification

Run before committing:
1. `npm run build` — must succeed without errors. The truncation incident on 2026-04-30 was a build failure that should have been caught here.
2. Visual smoke test — `npm run dev`, open the app:
   - Generate p1 in demo mode (or a test session). Loading screen should show a Making Your Own Weather quote attributed to "— Making Your Own Weather (available on Amazon)" with fade transition every 12 seconds.
   - Generate p7. Confirm output blocks now include "What they do," "Industry," "Size," and "HQ" lines.
   - Click Download CSV from p7. Open the file. Confirm 9 columns: Company, What they do, Industry, Size, HQ, Why it fits, Growth signal, Contact, Email. All cells populated where the source had data.

---

## Commit message

```
Restore STEP_QUOTES (MYOW step-scoped pool) + add p7 dossier fields

- STEP_QUOTES: per-step Making Your Own Weather quote pool drawn from
  Bob's book, contextual per phase. ATTITUDE_QUOTES (renamed from QUOTES)
  serves as the fallback pool. Loading component takes a step prop, picks
  the matching pool, falls back to attitude when no step pool exists.
  12-second rotation with 600ms fade.
- p7 prompt: add What they do / Industry / Size / HQ fields to per-company
  output blocks so the list doubles as research material, not just outreach.
- p7 CSV download: parse and export the four new fields. Header now: Company,
  What they do, Industry, Size, HQ, Why it fits, Growth signal, Contact, Email.
```

---

## Push

Direct push to `main`. Vercel auto-deploys.
