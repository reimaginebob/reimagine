// Shared markdown renderer used by App.jsx (prompt outputs, lo.context,
// lo.takeaway, p3 takeaway, p7 outreach templates, the pe-print-playbook
// section bodies) and by Chat.jsx (chat helper assistant messages). The
// markdown surface this renderer supports:
//   # / ## / ### headings
//   - and * list items
//   1. / 2. / N. ordered list items
//   --- horizontal rule
//   **bold** and *italic*
//   _italic_ (normalized to *italic* via ITALIC_UNDERSCORE when both
//     underscores are flanked by non-alphanumeric characters)
// The two GOLD / BORDER hex constants below are inlined copies of C.gold /
// C.border from App.jsx. Inlining avoids exporting C just for this module
// while preserving the single source of color truth in App.jsx for app-wide
// styles.
const GOLD = '#C8924A'
const BORDER = '#E2E5EA'

// Italic underscore pattern: matches `_text_` only when both underscores are
// flanked by non-alphanumeric characters (or string boundaries). This avoids
// false-positive matches inside identifiers like `snake_case_word` or
// `outputs.p3_version`. Min 2 chars between underscores; mockup always wraps
// a phrase or paragraph, so single-char italic is intentionally not supported.
// Tested in scripts/test-md-italic.mjs.
const ITALIC_UNDERSCORE = /(?<![A-Za-z0-9_])_([^_\s][^_]*?[^_\s])_(?![A-Za-z0-9_])/g
export const normalizeItalicUnderscores = (s) => s.replace(ITALIC_UNDERSCORE, '*$1*')

function Inline({text}){
  // Normalize `_italic_` to `*italic*` first so the existing splitter handles
  // both styles uniformly.
  const parts=normalizeItalicUnderscores(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)
  return <>{parts.map((p,i)=>{
    if(p.startsWith('**')&&p.endsWith('**'))return <strong key={i} style={{color:"#1A2540",fontWeight:600}}>{p.slice(2,-2)}</strong>
    if(p.startsWith('*')&&p.endsWith('*'))return <em key={i} style={{color:GOLD}}>{p.slice(1,-1)}</em>
    return <span key={i}>{p}</span>
  })}</>
}

export default function MD({text}){
  if(!text)return null
  return <div>{text.split('\n').map((line,i)=>{
    if(line.startsWith('### '))return <h3 key={i} style={{fontFamily:'Georgia,serif',fontSize:19,fontWeight:600,color:"#A06828",margin:'18px 0 8px'}}>{line.slice(4).replace(/^OPTION:\s*/i,'')}</h3>
    if(line.startsWith('## '))return <h2 key={i} style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:600,color:"#C8924A",margin:'22px 0 10px',borderBottom:`1px solid ${BORDER}`,paddingBottom:8}}>{line.slice(3).replace(/^OPTION:\s*/i,'')}</h2>
    if(line.startsWith('# '))return <h1 key={i} style={{fontFamily:'Georgia,serif',fontSize:26,fontWeight:700,color:"#1A2540",margin:'24px 0 10px'}}>{line.slice(2).replace(/^OPTION:\s*/i,'')}</h1>
    if(line.trim()==='---')return <hr key={i} style={{border:'none',borderTop:`1px solid ${BORDER}`,margin:'16px 0'}}/>
    if(line.startsWith('- ')||line.startsWith('* '))return <div key={i} style={{display:'flex',gap:10,margin:'4px 0',paddingLeft:8,alignItems:'flex-start'}}><span style={{color:GOLD,flexShrink:0,marginTop:2}}>◆</span><span style={{color:"#374258",lineHeight:1.65,fontSize:20}}><Inline text={line.slice(2)}/></span></div>
    const nm=line.match(/^(\d+)\. (.*)/)
    if(nm)return <div key={i} style={{display:'flex',gap:10,margin:'4px 0',paddingLeft:8}}><span style={{color:GOLD,flexShrink:0,fontWeight:600,minWidth:20,fontSize:14}}>{nm[1]}.</span><span style={{color:"#374258",lineHeight:1.65,fontSize:20}}><Inline text={nm[2]}/></span></div>
    if(line.trim()==='')return <div key={i} style={{height:9}}/>
    return <p key={i} style={{margin:'3px 0',color:"#374258",lineHeight:1.7,fontSize:20}}><Inline text={line}/></p>
  })}</div>
}
