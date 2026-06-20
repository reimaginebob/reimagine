// Pure profile helpers, extracted from App.jsx for testability and for the
// prompt-caching canonical profile block (2026-06-06). buildUserProfileBlock
// MUST be deterministic: identical input -> byte-identical output, or the
// Anthropic prompt cache silently misses. Gated by scripts/test-profile-block.mjs.
// No JSX, no React imports: importable by both App.jsx (Vite) and Node tests.

export const asText = v => (typeof v === 'string' && v.trim() && !v.includes('[object Object]')) ? v : ''

export function formatSkills(s){
  if(!s) return 'not provided'
  const lines=[]
  if(s.technical&&s.technical.length) lines.push(`Technical: ${s.technical.join(', ')}`)
  if(s.systems&&s.systems.length) lines.push(`Systems and platforms: ${s.systems.join(', ')}`)
  if(s.certifications&&s.certifications.length) lines.push(`Certifications: ${s.certifications.join(', ')}`)
  if(s.languages&&s.languages.length) lines.push(`Languages: ${s.languages.join(', ')}`)
  if(s.methodologies&&s.methodologies.length) lines.push(`Methodologies: ${s.methodologies.join(', ')}`)
  return lines.length?lines.join('\n'):'not provided'
}

export const buildSynthesisContext = (s) => {
  if (!s || typeof s !== 'object') return ''
  const tl = String(s.throughLine || '').trim()
  if (!tl) return ''
  const parts = [`\n\nPERSONAL BRAND SYNTHESIS (structured, from the Personal Brand step). Use these as the canonical inputs for the synthesis below; do not re-derive them from the prose above.`]
  parts.push(`\n\nTHROUGH-LINE: ${tl}`)
  const dim = s.dimensionalFit
  if (dim && typeof dim === 'object') {
    const dims = ['function','industry','position','scale','pace','mission']
    const reads = dims
      .map(d => dim[d] && dim[d].status && dim[d].read
        ? `- ${d}: ${dim[d].status}: ${dim[d].read}`
        : null)
      .filter(Boolean)
    if (reads.length >= 4) {
      parts.push(`\n\nDIMENSIONAL FIT:\n${reads.join('\n')}`)
    }
  }
  const anchors = Array.isArray(s.topAnchors) ? s.topAnchors : []
  if (anchors.length > 0) {
    const anchorLines = anchors
      .filter(a => a && typeof a === 'object' && a.type && a.text)
      .map(a => `- ${a.type}: ${String(a.text).trim()}`)
    if (anchorLines.length >= 4) {
      parts.push(`\n\nTOP ANCHORS (strongest specific evidence pieces from career, reputation, and life-shaping experience):\n${anchorLines.join('\n')}`)
    }
  }
  parts.push(`\n`)
  return parts.join('')
}

// Canonical user-profile block. Sent as the first user-message content block
// with cache_control so every migrated surface (p5/p7/p8/p11/p_res/income/op)
// shares one cached prefix within a 5-minute TTL. Field labels and 'not provided'
// fallbacks are stable so the cached prefix stays byte-identical across surfaces.
// Carries the raw résumé (user-stable source material, identical across surfaces,
// so it does not fork the cached prefix) plus the Personal Brand prose, its
// structured emit, and the raw orientation signals. The raw résumé replaced the
// retired Resume Analysis (p1) and Wiring & Compass (p2) analyses on 2026-06-19;
// downstream surfaces digest the résumé directly, the way the brand's own
// stage-one analysis does.
export function buildUserProfileBlock(pr, outs) {
  return `PROFILE:
RESUME:
${asText(pr.resume)||'not provided'}

PERSONAL BRAND:
${asText(outs.p3)}
${buildSynthesisContext(outs.p3_structured)}
RAW SIGNALS (this person's own words from orientation, do not paraphrase back to them):
VALUES: ${pr.values||'not provided'}
PASSIONS AND CAUSES: ${pr.passions||'not provided'}
PRAISE THEY RECEIVE: ${pr.rep.memory||'not provided'}
WHO CALLS THEM IN EMERGENCY: ${pr.rep.emergency||'not provided'}
HOW PEOPLE DESCRIBE THEIR SUPERPOWER: ${pr.rep.twoWords||'not provided'}
OTHER REPUTATION DATA: ${pr.rep.other||'not provided'}
LIFE-SHAPING EXPERIENCES: ${pr.lifeEvents||'not provided'}
VALIDATED HARD SKILLS:
${formatSkills(pr.skills)}
ASSESSMENT TYPE: ${pr.assessType||'not provided'}
ASSESSMENT NOTES: ${pr.assess||'not provided'}`
}
