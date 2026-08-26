// What changed in your Personal Brand, shown after a rebuild.
//
// Rebuilds amend rather than rewrite now (#515-#523), but amending still sheds
// the occasional phrase, and because each rebuild anchors on the one before it,
// an absence is preserved as faithfully as the text. "Trusted advisor" left one
// sentence on 2026-08-26 and never came back. Nobody re-reads five pages
// against a version they no longer have, so the app says what moved.
//
// Order is deliberate and is Bob's (2026-08-26): the person just asked for
// something, so the first thing they get is confirmation it landed. Only then
// what else moved, and then the way to act on it. Leading with what was lost
// answers a question they did not ask while theirs is still open, and frames a
// rebuild as damage.
//
// This is not a proofreading chore. The Personal Brand is the one document a
// person has to actually believe about themselves, and every playbook, bridge
// story and resume line downstream inherits from it. Time spent here is the
// product working. The risk is not that they linger — it is that they linger
// over something that does not matter, which is why the diff is prose-only.
// Self-contained, like ResearchDesk: the palette lives at module scope in
// App.jsx and is not exported, and importing it would make a cycle.
const GOLD = '#C8924A'
const GOLDL = '#A06828'
const INK = '#1A2540'
const GRAY = '#5A6478'
const BORDER = '#E2E6ED'

const Quote = ({ children, muted }) => (
  <div style={{
    fontSize: 16, lineHeight: 1.6, color: muted ? GRAY : INK,
    background: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 8,
    padding: '10px 14px', margin: '8px 0 0',
  }}>{children}</div>
)

const Head = ({ children }) => (
  <div style={{ fontSize: 15, fontWeight: 700, color: GOLDL, textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 8px' }}>
    {children}
  </div>
)

function RestoreBtn({ onClick, children }) {
  return <button type="button" onClick={onClick} style={{
    marginTop: 10, fontSize: 16, fontFamily: 'inherit', cursor: 'pointer',
    background: 'transparent', color: GOLDL, border: `1px solid ${GOLD}`,
    borderRadius: 8, padding: '7px 14px', fontWeight: 600,
  }}>{children}</button>
}

export default function BrandChangeNote({ change, askedFor, onRestore, onDismiss }) {
  if (!change) return null
  const added = change.added || []
  const removed = change.removed || []
  const reworded = change.reworded || []
  const nothing = !added.length && !removed.length && !reworded.length

  const shell = {
    background: `${GOLD}10`, borderLeft: `3px solid ${GOLD}`, borderRadius: 8,
    padding: '16px 20px', margin: '0 0 22px',
  }

  // A rebuild that changed nothing is worth saying out loud. It is the honest
  // answer, and it stops someone hunting for a difference that is not there.
  if (nothing) {
    return <div data-print="hide" style={shell}>
      <Head>Nothing changed</Head>
      <div style={{ fontSize: 17, color: INK, lineHeight: 1.65 }}>
        Your Personal Brand came back word for word as it was. What you changed
        did not shift the read, and nothing was quietly lost in the rebuild.
      </div>
      {onDismiss && <RestoreBtn onClick={onDismiss}>Got it</RestoreBtn>}
    </div>
  }

  return <div data-print="hide" style={shell}>
    <Head>{added.length ? 'Your update is in' : 'What changed'}</Head>

    {askedFor && <div style={{ fontSize: 17, color: INK, lineHeight: 1.65, marginBottom: added.length ? 10 : 0 }}>
      {askedFor}
    </div>}

    {added.length > 0 && <>
      <div style={{ fontSize: 16, color: GRAY, lineHeight: 1.6 }}>
        {added.length === 1 ? 'Here is the new line:' : `Here are the ${added.length} new lines:`}
      </div>
      {added.map((s, i) => <Quote key={i}>{s}</Quote>)}
    </>}

    {(reworded.length > 0 || removed.length > 0) && <div style={{ marginTop: added.length ? 20 : 0 }}>
      <Head>Also worth a look</Head>

      {reworded.map((p, i) => <div key={'r' + i} style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, color: INK, lineHeight: 1.6 }}>
          This line no longer says <strong>{p.dropped.map(d => `“${d}”`).join(', ')}</strong>:
        </div>
        <Quote muted>{p.after}</Quote>
        {onRestore && <RestoreBtn onClick={() => onRestore(p.before)}>Put that back</RestoreBtn>}
      </div>)}

      {removed.map((s, i) => <div key={'g' + i} style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, color: INK, lineHeight: 1.6 }}>This line is gone:</div>
        <Quote muted>{s}</Quote>
        {onRestore && <RestoreBtn onClick={() => onRestore(s)}>Put it back</RestoreBtn>}
      </div>)}
    </div>}

    <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${GOLD}33`, fontSize: 16, color: GRAY, lineHeight: 1.6 }}>
      Read it through before you move on. Anything else you would change — a line
      that is not you, a claim you would not make out loud — say so in{' '}
      <strong style={{ color: GOLDL }}>Does this feel right?</strong> below.
      {onDismiss && <> <button type="button" onClick={onDismiss} style={{
        background: 'transparent', border: 'none', color: GRAY, fontSize: 16,
        fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'underline', padding: 0,
      }}>Hide this</button></>}
    </div>
  </div>
}
