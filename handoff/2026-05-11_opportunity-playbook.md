# Reimagine "Upload a Live Opportunity": Handoff Brief

**Status:** Ready to execute. Drafted in parallel with magic-link accounts and in-app help. Ship after magic-link accounts has landed (which it has, as of 2026-05-11). Free for beta users in v1; paywall integration is a separate later brief. **Repo:** github.com/reimaginebob/reimagine **Working directory:** `C:\Users\bobgo\Documents\reimagine` **File:** `src/App.jsx` and `src/demoData.js` **Branch:** `main` (Vercel auto-deploys on push) **Estimated effort:** 4 to 6 days of focused Code work (paste \+ PDF upload \+ 13-section playbook \+ Complete handoff \+ demo content).

---

## Goal

Add a new post-Complete module that takes a job description the user has found in the wild, weaves it together with their foundation work (Resume Analysis, Wiring, Brand Synthesis, chosen path, Bridge Story, Go-to-Market), and produces a tailored playbook for that specific opportunity.

The user-facing framing: **"Upload a Live Opportunity Now."** This naming distinguishes the feature from the rest of the app, which has been showing the user possible directions and target lists. The new module reverses the direction: the user brings something specific from outside Reimagine's suggestions and gets a playbook customized to it.

The point: the existing tool sets strategy once. This module gets used repeatedly across a search, every time a real role catches the user's eye. It is the most natural reason for a user to come back to Reimagine during their search instead of using it once and leaving.

This brief ships v1: paste OR PDF upload, single playbook slot, regenerable, no paywall, and a Complete-screen handoff that points users to the new module after they finish the main flow. The paywall integration that the V2 launch plan specifies (gating this module behind Stripe with the $5 / $20 / $30 / $50 pricing ladder) is a separate brief.

---

## Locked decisions

- **Sidebar label: "Upload a Live Opportunity."** Verb-forward, three words, signals the user brings something to the system. Distinguishes from the noun-forward strategy phases above it.  
- **PDF upload AND paste both supported.** v1 accepts either input. Reuse the existing pdf.js text-extraction primitive that the resume upload step already uses.  
- **No rename of the existing Playbook (p9).** It stays "Playbook." The new module avoids the word entirely in its sidebar label, which sidesteps the two-Playbooks problem.  
- **Placement:** new phase at the end of the sidebar, below Income Now. Not interleaved with the main spine. Gated on `done.includes('complete')`.  
- **Single output slot, single JD at a time.** If a new JD is uploaded or pasted, the previous playbook gets overwritten. Multi-JD library is out of scope for v1.  
- **Thirteen output sections** (one more than the original scoping, to add an explicit "Getting Past the Screening Interview" section).  
- **No paywall, no entitlements, no gating beyond `done.includes('complete')`.** v1 is free for the entire beta.  
- **Complete-screen handoff:** the existing Complete page explicitly points to this feature so the post-flow "what now?" feeling becomes a clear next move.  
- **Demo data: Sarah Chen gets a pre-baked JD and a pre-baked playbook output.** Otherwise the demo flow breaks once this module ships.

---

## Files

- `src/App.jsx`: state, PHASES entry, ALL and META updates, prompt template, sidebar gating, paste \+ PDF upload UI, render UI, RefineBox integration, Complete-screen handoff.  
- `src/demoData.js`: pre-baked Sarah Chen JD plus playbook output.

No new package dependencies. The pdf.js primitive used here is the same one the existing resume upload step uses, so no new imports.

---

## Pre-step

```shell
cd C:\Users\bobgo\Documents\reimagine
git pull origin main
wc -l src/App.jsx          # baseline line count
```

If the working tree is dirty, stop and tell Bob.

If the magic-link accounts brief has NOT yet shipped, stop and tell Bob. (It has, as of 2026-05-11 commit a6eae23.)

---

## Changes

### Change 1: State additions

**Where:** the App component state declarations (near `const IO = ...` and the `outputs` state).

**What to add:**

Extend `IO` and `feedback` to include the new output key `op`:

```javascript
const IO = {p1:'',p2:'',p3:'',p4:'',p5:'',p6:'',p7:'',p8:'',p_res:'',p9:'',p10:'',p11:'',income:'',op:''}

const [feedback, setFeedback] = useState({p1:'',p2:'',p3:'',p4:'',p5:'',p6:'',p7:'',p8:'',p_res:'',p9:'',p10:'',p11:'',income:'',op:''})
```

Extend `IP` (initial profile) to include the JD text field:

```javascript
const IP = {
  // ... existing fields ...
  jd: '',  // pasted or extracted-from-PDF job description for the current playbook
}
```

The existing autosave already serializes the whole `profile` object, so adding `jd` to IP is enough. The magic-link profile sync from the previous brief also picks it up automatically (it persists the same blob to Neon's profile\_state JSONB).

### Change 2: PHASES, ALL, META updates

**Where:** the constants block in App.jsx.

**Add a new phase entry** to the `PHASES` array as phase 7 (after Income Now):

```javascript
{id:7, label:'Upload a Live Opportunity', color:'#C8924A', steps:['op']}
```

**Extend `META`**:

```javascript
op: 'Upload a Live Opportunity',
```

**Extend `ALL`** to include the new step, placed after `income`:

```javascript
const ALL = ['welcome','location','resume','assessment','values','reputation','p1','p2','p3','p4','p5','decision','p6','p7','p8','p_res','p9','complete','income','op']
```

**Update the progress bar logic** to treat `op` like `income` (post-completion, doesn't gate the main progress bar). Find the existing handling that caps at 100% at `complete` and extend:

```javascript
const PROGRESS_END = ALL.indexOf('complete')  // 17
const prog = (step === 'income' || step === 'op')
  ? 100
  : Math.round((ALL.indexOf(step) / PROGRESS_END) * 100)
```

### Change 3: Sidebar gating

**Where:** the Sidebar component's click guard.

Extend the existing gate so the new step is reachable once `complete` is done:

```javascript
const can = isDone || active
  || (sid === 'income' && done.includes('complete'))
  || (sid === 'op' && done.includes('complete'))
```

The sidebar entry appears for all users but renders dimmed until `done.includes('complete')`.

### Change 4: Prompt template (thirteen sections)

**Where:** the `P` object in App.jsx.

**Add the new prompt template** at the end of the `P` object:

```javascript
P.op = (pr, outs, sel, jd) => `Build a playbook for this specific opportunity, weaving in the user's foundation work. The user has completed their full Reimagine journey and chose this path: **${sel || 'their target direction'}**.

JOB DESCRIPTION (uploaded or pasted by the user):
${jd}

USER'S FOUNDATION WORK:
RESUME ANALYSIS: ${outs.p1 || ''}
WIRING & COMPASS: ${outs.p2 || ''}
BRAND SYNTHESIS: ${outs.p3 || ''}
BRIDGE STORY: ${outs.p6 ? outs.p6.substring(0, 2000) : ''}
GO-TO-MARKET (excerpt): ${outs.p7 ? outs.p7.substring(0, 1500) : ''}

START your response with:
## QUICK TAKEAWAY
4 to 5 sentences: how well this opportunity aligns with the user's chosen path, the strongest reason to pursue it, the single biggest watch-out, and the one action to take this week if they decide to move on it. Plain language, no headers inside this section.

Then produce the full playbook in this exact order, with the exact section headers shown:

## 1. ALIGNMENT TO YOUR PATH
Lead with the on-thesis or off-thesis read. If this role does not match the path the user chose, say so plainly and explain why. Do not block or warn them away. Coach, do not gatekeep. They decide whether to pursue.

## 2. WHY THIS COULD BE A FIT
2 to 3 paragraphs grounded in specific evidence from their Wiring, Brand Synthesis, and prior wins. Name the capabilities and the proof points. Concrete, not abstract.

## 3. WHAT TO WATCH OUT FOR
Where the role stretches the user past their proven track record. Where the JD might be overselling. Be direct. The user is going to read this and use it to prepare; they need the watch-outs more than the cheerleading.

## 4. THE MOST IMPORTANT SIGNALS IN THIS JD
Identify 4 to 6 things in the posting that carry real weight. Everything else is secondary. State each in one sentence and explain why it matters.

## 5. WHAT THE HIRING MANAGER IS SOLVING FOR
Read the JD as evidence of an underlying problem. Infer from industry, company size, title altitude, and what the posting emphasizes and omits. The user reading this should know what conversation the hiring manager actually wants to have.

## 6. TAILORED FRAMING OF YOUR BRAND SYNTHESIS
Foreground the proof points and angles from the user's Brand Synthesis that carry the most weight for THIS role. Do not rewrite the synthesis. Pick what to emphasize. 3 to 5 specific framing moves with one-line rationale each.

## 7. REMIXED STAR STORIES
Build exactly 3 STAR stories remixed for this specific opportunity. T stands for Thinking, not Tasks. The remixing concept: the user already has core stories from their experience; this section selects three and re-emphasizes them for the questions this role's interview cycle is most likely to ask. Use this exact structure for each:

### STORY [NUMBER]: [Short descriptive title]
**Best for answering:** [2 to 3 specific interview questions this story handles well]

**Situation:** 2 to 3 sentences setting the scene.

**Thinking:** 3 to 4 sentences on how the user diagnosed the situation, what options they weighed, and why they chose the path they chose. Reference a named framework if applicable. This is the most important section because it shows how the user thinks, which is what transfers.

**Action:** 2 to 3 sentences. What they actually did. Specific verbs, no "led the initiative" filler.

**Result:** 1 to 2 sentences. The quantifiable outcome. Bold the key metric.

**Strengthen This Story:** 2 to 3 specific questions that would make this story stronger if answered.

## 8. GETTING PAST THE SCREENING INTERVIEW
The first conversation in most hiring processes is a 30-minute screening with a recruiter, HR partner, or initial point of contact. The bar is "do not get screened out" rather than "demonstrate depth." The recruiter is filtering for clear fit, clean fundamentals, and reasons to advance the candidate to the hiring manager.

Identify the 4 to 5 things this person should land cleanly in that conversation:

- The 1 to 2 accomplishments that translate immediately when stated simply with numbers. Pick ones a recruiter without domain expertise can grasp in one sentence.
- A clear, one-line answer to "why this role" grounded in the user's actual capability and interest, not in flattery toward the company.
- A clear, one-line answer to "why now" that connects to their current chapter without over-explaining.
- One signal of culture fit specific to this company without over-pitching.
- One question they should ask the recruiter that signals seriousness and gives the recruiter ammunition to advocate for them with the hiring manager.

Note: in many processes the screening interview is also a low-key culture screen. Generic energy gets discounted. Specific curiosity about the company's work and an authentic version of the user's working style land better.

## 9. LIKELY OBJECTIONS AND REBUTTALS
What resistance the user's profile creates against this specific role, and how to handle it grounded in their actual experience. 3 to 5 objections, each with a rebuttal that does not over-promise or under-acknowledge.

## 10. DRAFT 90-DAY PLAN
A defensible starting position the user can refine through the interview process. Three phases (first 30, 31-60, 61-90 days), each with 3 to 4 specific actions tied to the responsibilities in the JD. Not the final answer. Framed as a starting position, not a deliverable.

## 11. HIGH-VALUE QUESTIONS TO ASK
5 to 7 questions specific to this JD's stated and implied scope. Questions that signal seniority and engagement, not generic interview questions. Each question should connect to something in the JD or in what was inferred about the company.

## 12. BRIDGE STORY VARIANT
The user's 30-second TMAY answer, tuned to this opportunity. Keep the same three-part structure from p6 (human truth, professional proof, next chapter), but emphasize the elements most relevant to this JD. No labels in the spoken version. Write it as it should be spoken.

## 13. COVER LETTER DRAFT
A written counterpart to the bridge story. Same voice rules as the cold outreach in p7 (direct, peer-to-peer, no HR-formula). 3 paragraphs. Senior outreach posture: this is positioning work, not form-filling.

CRITICAL VOICE AND METHODOLOGY RULES:
- All standard Reimagine voice rules apply: second person, no em dashes, no AI words, no intensifiers, no logic-flips, no staccato drama, no "nightmare," no exposed framework names for KEEL, the 4 C's, the three paths, or balcony/basement.
- STAR is the exception to "no framework names." Name it openly with T = Thinking framing. The remixing concept (DJ has core tracks, every interview is a different set) is also named openly because it is the methodology.
- Mirror enforcement: surface misfit actively. Especially in sections 1, 3, and 9. Cheerleading defeats the purpose.
- Coach, do not gatekeep. When the role is off-thesis, say so plainly and explain why, then let the user decide.
- Tailored framing means foregrounding existing material. It does not mean regenerating the Brand Synthesis or Wiring. Those stay stable across all opportunities the user evaluates.
- Refuse confident claims about anything not in the JD or supportable from general knowledge of the industry, company size, and altitude. Sparse JDs produce sparser output, not invented detail.`
```

Note: max\_tokens for this generation is 7500 (slightly higher than the previous draft's 7000 to accommodate the additional Section 8 and the existing 12 sections). Set it accordingly in the generate call site.

### Change 5: Step UI (paste box \+ PDF upload \+ generate button)

**Where:** the step-routing switch statement. Add a new case for `case 'op':`.

**State A: no JD entered yet, OR user is replacing the JD.**

Render:

- A heading: **"Upload a Live Opportunity Now"**  
- An intro paragraph (this is the exact copy):

When you find a role worth pursuing, bring it here. Paste the job description or upload the PDF. Reimagine combines it with everything you've already built and produces a complete playbook for that specific opportunity.

You'll know whether the role fits the path you chose and where it stretches you. You'll have STAR stories remixed for this specific opportunity, ways to get past the screening interview, questions you can ask them, and ways to show your value immediately. You'll know what the hiring manager is solving for and how to write a cover letter that sounds like you.

- A file upload affordance: "Upload a PDF of the job description." Reuse the existing pdf.js text-extraction pattern from the resume upload step. On successful PDF upload, populate `profile.jd` with the extracted text AND display that text in the textarea below so the user can verify or edit it.  
- A divider: "or"  
- A textarea, bound to `profile.jd`, placeholder: "Paste the full job description here..."  
- A coaching line above the inputs: "The richer the input, the sharper the output."  
- A "Build My Playbook" button (matches existing Btn pattern), disabled if `(profile.jd || '').trim().length < 100`.  
- If `outputs.op` exists from a prior generation, show a small note above the button: "You have an existing playbook below. Building a new one will replace it."

**State B: playbook generated.**

Render:

- The standard output rendering with markdown styling (use the existing renderer used for p9, p11, etc.).  
- A "Copy All" button at the top right.  
- A "Download as Markdown" button next to it (use the same pattern as the orientation polish "Download all outputs as markdown" change but for just this output).  
- The standard RefineBox at the bottom, hint and placeholder tuned for this context:

```
<RefineBox
  value={feedback.op}
  onChange={v => setFb('op', v)}
  hint="Did we read the JD or your background right? Tell us what to adjust."
  placeholder="e.g. 'You missed that the role explicitly requires P&L experience.' Or: 'My time at [Company] was internal strategy, not consulting.' Or: 'Lean harder into the operating depth angle, less on strategic vision.'"
  onRegenerate={v => recordCorrection('op', v) || (out('op',''), generate('op', () => correctionsBlock(profile.corrections) + P.op(pc, outputs, chosen, profile.jd) + (v ? `\n\nNEW CORRECTION FROM THIS SECTION: ${v}` : ''), {maxTokens: 7500, msg: 'Building your Opportunity Playbook...'}))}
/>
```

**Generation call.** When "Build My Playbook" is clicked:

```
generate('op',
  () => correctionsBlock(profile.corrections) + P.op(pc, outputs, chosen, profile.jd),
  {maxTokens: 7500, msg: 'Building your Opportunity Playbook...'}
)
```

### Change 6: Loading previews entry

**Where:** the `LOADING_PREVIEWS` map.

**Add:**

```javascript
op: [
  'How this opportunity aligns with your chosen path',
  'Tailored framing of your Brand Synthesis for this specific role',
  '3 STAR stories remixed for the questions this role will ask',
  'Getting past the screening interview, objections, questions to ask, and a cover letter draft',
],
```

### Change 7: Complete-screen handoff

**Where:** the existing Complete step UI. Find the rendering for `case 'complete':` (or however the step is structured).

**What to add:** a callout block that points to the new module. Place it after the existing "all outputs are yours" copy but before any download or share affordances. Use the existing gold-tinted callout pattern.

```
{done.includes('complete') && (
  <div style={{
    background: `${C.gold}15`,
    border: `1px solid ${C.gold}40`,
    padding: '20px 24px',
    borderRadius: 10,
    margin: '24px 0',
    fontSize: 16,
    color: '#1A2540',
    lineHeight: 1.65,
  }}>
    <div style={{fontWeight: 700, fontSize: 17, marginBottom: 8}}>Found a specific role?</div>
    When a real job posting catches your eye, head to <strong>Upload a Live Opportunity</strong> in the sidebar. Reimagine will combine the posting with everything you have built and produce a playbook tailored to that role.
    <div style={{marginTop: 14}}>
      <Btn small onClick={() => nav('op')}>Upload a Live Opportunity →</Btn>
    </div>
  </div>
)}
```

The button uses the existing `nav` function to jump straight to the new step. Wrap in the `done.includes('complete')` guard so it only renders for users who have actually finished the main flow.

### Change 8: PDF upload helper (reuse existing primitive)

**Where:** find the existing resume upload code (search for `pdfjs` or `pdf.js` references; the resume step uses this pattern already).

**What to do:** extract the PDF-to-text logic into a small helper if it isn't already, then call the helper from the new `op` step's file upload handler. On successful extraction, set `profile.jd` to the extracted text AND populate the textarea so the user sees what was extracted.

```
const handleJdFileUpload = async (file) => {
  if (!file) return
  if (file.type !== 'application/pdf') {
    setErr('Please upload a PDF. For other formats, paste the text into the box below.')
    return
  }
  try {
    const text = await extractPdfText(file)  // reuse existing helper
    pr('jd', text)  // updates profile.jd via the existing pr helper
  } catch (e) {
    setErr('Could not read this PDF. Try pasting the text instead.')
  }
}
```

If the existing pdf.js wrapper has a different shape, adapt accordingly. The key is: reuse, do not reimplement.

### Change 9: Reset handling

**Where:** the `reset()` function.

Extend the reset to clear the new state:

```javascript
const reset = async () => {
  if (confirm('Reset all progress and start over?')) {
    try { localStorage.removeItem('pe_v3') } catch {}
    setStep('welcome')
    setProfile(IP)  // IP now includes jd: ''
    setOutputs(IO)  // IO now includes op: ''
    setDone([])
    setDeepOpts(['','',''])
    setChosen('')
    setFeedback({p1:'',p2:'',p3:'',p4:'',p5:'',p6:'',p7:'',p8:'',p_res:'',p9:'',p10:'',p11:'',income:'',op:''})
  }
}
```

### Change 10: Download all outputs as markdown

**Where:** the `downloadAllMarkdown` function from the orientation polish bundle.

**Add `op` to the STEP\_NAMES map:**

```javascript
const STEP_NAMES = {
  // ... existing entries ...
  op: 'Live Opportunity Playbook',
}
```

The new playbook gets included in the all-outputs download.

### Change 11: Demo data

**Where:** `src/demoData.js`. Sarah Chen's demo profile and outputs.

**Add a JD** (paste into `profile.jd`):

```
VP of People & Culture | Series B Healthtech | New York or Remote

Company:
We are a Series B healthtech company building patient-facing software that helps people navigate complex chronic conditions. We have grown from 40 to 180 people in the last 18 months and are on track to double again by end of next year. Our People function is currently led by a Director who reports into the CEO. We are looking for a VP-level leader to build the function for scale.

What you'll do:
- Own the full People & Culture function: talent acquisition, performance, compensation, learning, DEI, employee experience.
- Build the team. The current Director becomes one of your direct reports. You hire 2 to 3 more managers across the function in your first year.
- Partner with the leadership team on org design. We are growing fast and our structure is straining; you set the operating model.
- Lead compensation strategy. Equity refresh, leveling, market benchmarking, total rewards philosophy.
- Lead the next phase of culture work. We have strong values but they need to scale. You design the systems that keep culture intentional as we grow.
- Report directly to the CEO and serve on the executive team.

What we are looking for:
- 12+ years of progressive People & Culture experience, including at least 4 years at a VP or Head-of-People level.
- Experience scaling a People function from ~150 to ~500 people, ideally in a high-growth tech context.
- Track record building and leading multi-disciplinary teams (talent, comp, learning, DEI).
- Deep experience with executive-team partnership and board-level reporting.
- Healthcare or healthtech experience strongly preferred but not required if you have scaled People in a comparably regulated environment.
- Comfort with operating in ambiguity. We are not a place for someone who needs the operating model handed to them.

Comp: competitive base + equity refresh. We are happy to discuss specifics with finalists.
```

**Add a playbook output** for `outputs.op`. Generate placeholder content matching the 13-section structure (Quick Takeaway \+ 13 sections). Use Sarah Chen's actual demo profile to make the content specifically about her fit for this role. Roughly 3,500 to 4,500 words across all sections. Follow all voice rules (no em dashes, no AI words, no logic-flips, no intensifier filler).

If writing the full demo content from scratch is too much for this brief, **stop after wiring up the empty `outputs.op` field and tell Bob.** Bob can generate the demo content via a one-shot Reimagine session against the demo profile and copy the output in. Do not ship a placeholder like "Sarah Chen demo playbook to be added" as the visible demo content; that breaks the demo experience.

---

## Voice rules

Every copy block in this brief follows the existing voice rules:

- No em dashes anywhere. Use commas, periods, colons, or parentheses instead.  
- No AI words from the banned list.  
- No logic-flip cadence.  
- No intensifier filler.  
- Second person.

STAR and remixed-stories are exceptions to "no framework names." Name both openly.

Scan every copy block before pushing. Especially the demo playbook output (Change 11\) since that is the largest body of new text.

---

## Verification

1. `npm run build` must succeed.  
     
2. **Schema migration test.** Reload the app with stale localStorage (a `pe_v3` blob from before this brief). Confirm no errors. The new `jd` and `op` fields default to empty string.  
     
3. **Sidebar gating.** Walk through Orientation in a fresh session. Confirm the "Upload a Live Opportunity" entry appears in the sidebar but is dimmed and not clickable. Jump to `step='complete'` (or walk all the way through). Confirm the entry becomes clickable.  
     
4. **Complete-screen handoff.** Reach the Complete page. Confirm the gold callout appears with the "Found a specific role?" heading and the button that jumps to the new step.  
     
5. **Paste-only generation.** From the new step, paste a real job description. Click Build My Playbook. Confirm:  
     
   - Loading screen shows the LOADING\_PREVIEWS.op bullets.  
   - Generation completes within 2 minutes.  
   - Output renders Quick Takeaway and 13 sections with the exact headers from the prompt.  
   - Section 7 is titled "Remixed STAR Stories" (not "STAR Stories Tuned to...").  
   - Section 8 "Getting Past the Screening Interview" exists with substantive content.  
   - Output ends cleanly, not mid-sentence. Bump maxTokens by 1000 if truncating.

   

6. **PDF upload generation.** Save a job description to a PDF. From the new step, upload the PDF. Confirm:  
     
   - The textarea populates with the extracted text within a few seconds.  
   - The user can edit the extracted text before clicking Build My Playbook.  
   - Build My Playbook produces the same kind of output as paste-only.

   

7. **Regeneration with correction.** Submit a correction via the RefineBox. Click Update with my correction. Confirm regeneration starts and the correction is honored in the new output.  
     
8. **JD replacement.** Generate a playbook. Paste or upload a different JD. Confirm the "You have an existing playbook below. Building a new one will replace it." note appears. Build. Confirm the new playbook replaces the old one cleanly.  
     
9. **Persistence.** Generate a playbook. Hard-reload. Confirm the JD text and the playbook output both restore from localStorage AND sync to Neon (if signed in via magic-link).  
     
10. **Demo flow.** Open the app with `?demo=true`. Navigate to "Upload a Live Opportunity." Confirm the pre-baked JD and playbook output appear without needing to generate.  
      
11. **Reset.** Click Reset. Confirm the JD field and the playbook output both clear along with everything else.  
      
12. **Progress bar.** Walk to the new step. Confirm progress shows 100%.  
      
13. **Voice and copy audit.** Read every new string. Confirm zero em dashes, zero AI words, zero logic-flips, zero intensifier filler.  
      
14. `git diff` and `wc -l src/App.jsx`. Confirm changes are localized, file ends cleanly.

---

## Report-back conditions

Surface before pushing if you hit any of:

- The pdf.js wrapper used by the resume step has a structure that does not lend itself to reuse for the JD upload. Flag and propose how to handle.  
- The Complete-screen layout has been refactored such that the handoff callout does not fit cleanly in the existing structure.  
- The demo playbook content for Change 11 turns out to be too much to write inline with the rest of the work. Ship the empty hook, leave the content for Bob.  
- A voice rule violation slipped into your demo output that you cannot cleanly rewrite. Flag in the commit message.

---

## What this brief explicitly does NOT cover

- **Paywall, Stripe, entitlements.** This module ships free for the entire beta. The launch plan specifies the future paywall ladder ($5 single / $20 5-pack / $30 10-pack / $50 unlimited). Separate brief.  
- **Multi-JD library or pipeline.** Single output slot. Multi-JD with history is a follow-up.  
- **URL fetch ingestion.** Paste or PDF upload only. URL fetch is a follow-up if user demand surfaces.  
- **"Have you considered..." adjacent-opportunity recommendations.** Not in v1.  
- **Per-JD resume rewrite.** Out of scope. p\_res owns the Resume Refresh.

---

## Commit message

```
Add "Upload a Live Opportunity": post-Complete per-JD playbook generator

A new module that takes a job description the user has found in the
wild (pasted or uploaded as PDF), weaves it with their foundation work
(Resume Analysis, Wiring, Brand Synthesis, chosen path, Bridge Story,
Go-to-Market), and produces a 13-section playbook tailored to that
specific opportunity.

Sidebar phase 7 below Income Now, labeled "Upload a Live Opportunity,"
gated on done.includes('complete'). Both paste and PDF upload accepted
(reuses existing pdf.js primitive from the resume step). Single
output slot, regenerable via the standard RefineBox + correction-loop
pattern.

Playbook sections include alignment to path, why-this-fits, watch-outs,
key JD signals, what the hiring manager is solving for, tailored Brand
Synthesis framing, remixed STAR stories, getting past the screening
interview, objections and rebuttals, draft 90-day plan, high-value
questions, Bridge Story variant, and cover letter draft.

src/App.jsx:
- Extend IO/feedback/IP with op and jd fields.
- Add PHASES phase 7, extend ALL and META.
- Extend sidebar gating to include op when complete is done.
- Add P.op prompt template (13 sections, max_tokens 7500).
- Add op step UI: paste textarea + PDF upload + Build button + output
  renderer + RefineBox.
- Add LOADING_PREVIEWS.op.
- Add Complete-screen handoff callout that points to the new step.
- Reuse existing pdf.js wrapper for PDF text extraction.
- Extend reset() and downloadAllMarkdown() for the new step.
- Cap progress bar at 100% for op.

src/demoData.js:
- Sarah Chen demo JD (VP People & Culture, Series B healthtech).
- Sarah Chen demo playbook output (13 sections).

Out of scope for v1: paywall, multi-JD library, URL upload, adjacent-
opportunity recommendations, per-JD resume rewrite.

Source: 2026-04-28 feature brief + 2026-05-09 beta synthesis (Mike,
Dylan, Linda asked for JD-tailored output) + 2026-05-11 naming and
copy refinement with Bob.
```

---

## Push

Direct push to `main`. Vercel auto-deploys. Walk through a full real-user session (not demo) end-to-end after deploy, including the Complete-screen handoff click-through into the new step. The Sarah Chen demo is a separate verification path; both should be clean before declaring this brief shipped.  
