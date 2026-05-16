const COL = {
  bg: '#F7F8FA',
  header: '#1A2540',
  ink: '#1A2540',
  body: '#3D4A5C',
  gold: '#C8924A',
  border: '#E2E5EA',
}

const EMAIL = 'info@career.club'

function linkifyEmail(text, keyBase) {
  const parts = text.split(EMAIL)
  if (parts.length === 1) return text
  const out = []
  parts.forEach((p, i) => {
    if (p) out.push(p)
    if (i < parts.length - 1) {
      out.push(
        <a key={`${keyBase}-m${i}`} href={`mailto:${EMAIL}`} style={{ color: COL.gold }}>
          {EMAIL}
        </a>
      )
    }
  })
  return out
}

function renderInline(text, keyBase) {
  const segments = text.split('**')
  return segments.map((seg, i) =>
    i % 2 === 1 ? (
      <strong key={`${keyBase}-b${i}`} style={{ color: COL.ink }}>
        {linkifyEmail(seg, `${keyBase}-b${i}`)}
      </strong>
    ) : (
      <span key={`${keyBase}-s${i}`}>{linkifyEmail(seg, `${keyBase}-s${i}`)}</span>
    )
  )
}

function renderMarkdown(md) {
  const lines = md.split('\n')
  const blocks = []
  let list = null
  const flushList = () => {
    if (list) {
      blocks.push(
        <ul
          key={`ul-${blocks.length}`}
          style={{ margin: '0 0 18px', paddingLeft: 24, color: COL.body, fontSize: 18, lineHeight: 1.7 }}
        >
          {list.map((item, i) => (
            <li key={i} style={{ marginBottom: 8 }}>
              {renderInline(item, `li-${blocks.length}-${i}`)}
            </li>
          ))}
        </ul>
      )
      list = null
    }
  }

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd()
    if (line.trim() === '') {
      flushList()
      return
    }
    if (line.startsWith('## ')) {
      flushList()
      blocks.push(
        <h2
          key={`h2-${idx}`}
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: COL.ink,
            margin: '34px 0 12px',
            lineHeight: 1.35,
          }}
        >
          {renderInline(line.slice(3), `h2-${idx}`)}
        </h2>
      )
      return
    }
    if (line.startsWith('# ')) {
      flushList()
      blocks.push(
        <h1
          key={`h1-${idx}`}
          style={{
            fontFamily: 'Georgia,serif',
            fontSize: 34,
            fontWeight: 700,
            color: COL.ink,
            margin: '0 0 18px',
            lineHeight: 1.25,
          }}
        >
          {renderInline(line.slice(2), `h1-${idx}`)}
        </h1>
      )
      return
    }
    if (line.startsWith('- ')) {
      if (!list) list = []
      list.push(line.slice(2))
      return
    }
    flushList()
    blocks.push(
      <p
        key={`p-${idx}`}
        style={{ fontSize: 18, lineHeight: 1.7, color: COL.body, margin: '0 0 16px' }}
      >
        {renderInline(line, `p-${idx}`)}
      </p>
    )
  })
  flushList()
  return blocks
}

export default function MarkdownPage({ markdown, topBack = false, footerExtra = null }) {
  return (
    <div style={{ minHeight: '100vh', background: COL.bg, fontFamily: 'Outfit,sans-serif' }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap" rel="stylesheet" />
      <div
        style={{
          background: COL.header,
          borderBottom: '1px solid #0F1A30',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          ...(topBack ? { justifyContent: 'space-between' } : {}),
        }}
      >
        <a href="/" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 520 120"
            width="148"
            height="34"
            style={{ display: 'block' }}
          >
            <circle cx="44" cy="60" r="28" fill="#e4572e" opacity="0.25" />
            <circle cx="44" cy="60" r="18" fill="#e4572e" />
            <text x="92" y="80" fontSize="72" fontWeight="900" letterSpacing="-2.5" fill="#FFFFFF">
              Re<tspan fill="#e4572e">imagine</tspan>
            </text>
          </svg>
        </a>
        {topBack && (
          <a
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: 16,
              textDecoration: 'none',
            }}
          >
            ← Back to Reimagine
          </a>
        )}
      </div>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div style={{ maxWidth: '65ch' }}>{renderMarkdown(markdown)}</div>
        <div style={{ marginTop: 48, paddingTop: 20, borderTop: `1px solid ${COL.border}` }}>
          <a
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              background: '#FFFFFF',
              border: `1px solid ${COL.gold}`,
              borderRadius: 8,
              color: COL.gold,
              fontWeight: 600,
              fontSize: 17,
              textDecoration: 'none',
            }}
          >
            Back to Reimagine
          </a>
          {footerExtra && <div style={{ marginTop: 20 }}>{footerExtra}</div>}
        </div>
      </div>
    </div>
  )
}
