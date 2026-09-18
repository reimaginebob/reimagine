// How long to wait for the pdf.js bundle before giving up. Generous: a slow
// phone on hotel wifi should still succeed. What it exists to prevent is the
// unbounded wait, not a slow one.
const PDFJS_LOAD_TIMEOUT_MS=20000
// Loads pdf.js from the CDN. REJECTS on failure — it used to have an onload
// handler and nothing else, so a script that never loaded left the promise
// pending forever: extractText awaited it, the caller's `finally` never ran,
// and the upload spinner stayed up for the rest of the session with no error
// and no way forward but a reload. Three ways that happens in the wild, none
// of them exotic: an ad blocker or corporate proxy blocking cdnjs, an offline
// moment, and an SRI hash mismatch — which fires `error`, not `load`, so the
// old code could not see it even in principle. Every failure now settles.
function loadPDFJS(){return new Promise((resolve,reject)=>{
  if(window.pdfjsLib){resolve(window.pdfjsLib);return}
  const s=document.createElement('script')
  s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
  // Subresource Integrity: pin the SHA-384 of the exact bytes we expect so a
  // compromised CDN or MITM cannot execute swapped code. crossOrigin is
  // required or the browser silently skips the integrity check on a
  // cross-origin script. The worker is self-hosted under /public (SRI does
  // not apply to Worker URLs the same way), removing third-party trust there.
  s.integrity='sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e'
  s.crossOrigin='anonymous'
  // One-shot settle guard: whichever of load / error / timeout arrives first
  // wins and the rest become no-ops.
  let settled=false
  const fail=(why)=>{if(settled)return;settled=true;clearTimeout(timer);const e=new Error(why);e.pdfLoaderFailed=true;reject(e)}
  const timer=setTimeout(()=>fail('pdf_reader_timeout'),PDFJS_LOAD_TIMEOUT_MS)
  s.onload=()=>{
    if(settled)return
    // `load` fires but the global is absent when the bundle was served as
    // something other than the script we expect — a captive-portal login page
    // or a proxy error page with a 200. Treat it as a failure, not a success
    // that crashes on the next line.
    if(!window.pdfjsLib){fail('pdf_reader_unavailable');return}
    settled=true;clearTimeout(timer)
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='/pdf-worker/3.11.174/pdf.worker.min.js'
    resolve(window.pdfjsLib)
  }
  s.onerror=()=>fail('pdf_reader_blocked')
  document.head.appendChild(s)
})}
// Strip U+0000 — Postgres jsonb rejects NUL bytes; mammoth/pdf.js sometimes
// emit them from malformed sources and contaminate profile state.
const stripNulText=s=>typeof s==='string'?s.replace(/\x00/g,''):s
export async function extractText(file){
  const ext=file.name.toLowerCase().split('.').pop()
  if(ext==='docx'||ext==='doc'){const mammoth=await import('mammoth');const ab=await file.arrayBuffer();const r=await mammoth.extractRawText({arrayBuffer:ab});return stripNulText(r.value)}
  if(ext==='pdf'){
    // The reader failing to LOAD and a PDF failing to PARSE are different
    // problems with different advice, and they are separated here.
    //
    // A parse failure degrades gracefully: the bracketed notice is returned as
    // the extracted text, lands in the field, and tells the user what to do.
    // That is deliberate: the file really cannot be read, and the user needs
    // the guidance in front of them.
    //
    // A loader failure THROWS instead. Nothing is wrong with the file, so
    // writing a notice into the user's assessment or resume would be wrong on
    // the facts and would sit in their profile (and in every prompt built from
    // it) forever. Every call site wraps this in try/catch + finally, so the
    // throw clears the busy flag and surfaces a real error.
    let lib
    try{lib=await loadPDFJS()}
    // Reads correctly both on its own (the resume upload shows e.message alone)
    // and after a prefix (the others show "Could not read <file>: <message>").
    catch{throw new Error("We could not load the PDF reader. An ad blocker or network filter may be blocking it. Paste the text into the box below instead, or try again on a different network.")}
    try{const ab=await file.arrayBuffer();const pdf=await lib.getDocument({data:ab}).promise;let t='';for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i);const c=await pg.getTextContent();t+=c.items.map(x=>x.str).join(' ')+'\n'}if(t.trim().length<100)return "[This PDF appears to be image-based or browser-printed and couldn't be read as text. Try opening it and using Save As to save as a standard PDF, or simply paste the text below.]";return stripNulText(t)}catch{return "[This PDF couldn't be read automatically. If it was saved from a browser (like Edge or Chrome), try opening it and printing to a standard PDF, or just paste the text directly below.]"}
  }
  return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(stripNulText(e.target.result));r.onerror=rej;r.readAsText(file)})
}
