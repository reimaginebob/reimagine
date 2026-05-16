import MarkdownPage from './MarkdownPage'
import QUICK_START_MD from './data/user-guide/00-tldr.md?raw'

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
