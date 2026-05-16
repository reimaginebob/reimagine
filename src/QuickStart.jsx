import MarkdownPage from './MarkdownPage'
import QUICK_START_MD from './data/user-guide/00-tldr.md?raw'

// TODO(reimagine-help-visual): the "Reimagine Help is on every screen" bullet in
// 00-tldr.md renders as plain bold text because MarkdownPage's renderer has no
// raw-HTML pass-through. When MarkdownPage gains HTML support, restore the
// inline gold round "?" button visual from the Quick Start brief next to that bullet.

export default function QuickStart() {
  return (
    <MarkdownPage
      markdown={QUICK_START_MD}
      topBack
      footerExtra={
        <a
          href="/reimagine-user-guide.pdf"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#C8924A', fontSize: 16, textDecoration: 'underline' }}
        >
          Read the full User Guide for more detail
        </a>
      }
    />
  )
}
