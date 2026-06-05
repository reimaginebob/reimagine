// Smoke-test a Vercel preview deployment for api/* import-topology failures.
//
// Per CLAUDE.md Section 8, every PR that touches api/* (or its import surface)
// needs a smoke test against the Vercel preview before merge to confirm the
// function bundler can load the route. api/health.js exists specifically to
// mirror the import topology of api/claude.js, so a 5xx on either of these
// proxies "the api/ bundle failed to load" and blocks the merge.
//
// 4xx is fine: it proves the function loaded and the route's own validation
// (or auth) rejected the request. Only 5xx (FUNCTION_INVOCATION_FAILED, etc.)
// is the merge-blocking condition.
//
// Auth: Vercel preview deployments are protected. This script attaches the
// VERCEL_PROTECTION_BYPASS env var as the `x-vercel-protection-bypass` header
// on every request. The token is generated in Vercel project settings →
// Deployment Protection → Protection Bypass for Automation. See
// .env.local.example for the variable name; rotate via Vercel if leaked.
//
// Usage:
//   node scripts/smoke-preview.mjs <preview-url>
//   node scripts/smoke-preview.mjs --url <preview-url>
//   node scripts/smoke-preview.mjs --help

const USAGE = `Usage: node scripts/smoke-preview.mjs <preview-url>

Smokes /api/health (GET) and /api/claude (POST {}) against a Vercel preview
deployment, exits 0 if both return non-5xx, exits 1 otherwise.

Requires VERCEL_PROTECTION_BYPASS in the environment.

Examples:
  node scripts/smoke-preview.mjs https://reimagine-git-foo-career-club.vercel.app
  node scripts/smoke-preview.mjs reimagine-git-foo-career-club.vercel.app
  npm run smoke:preview -- https://reimagine-git-foo-career-club.vercel.app
`

function parseArgs(argv) {
  const args = argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) return { help: true }
  const urlFlag = args.indexOf('--url')
  if (urlFlag !== -1) return { url: args[urlFlag + 1] }
  if (args.length === 1 && !args[0].startsWith('--')) return { url: args[0] }
  return {}
}

function normalizeUrl(raw) {
  if (!raw) return null
  let u = raw.trim()
  if (!u.startsWith('http://') && !u.startsWith('https://')) u = 'https://' + u
  return u.replace(/\/+$/, '')
}

function snippet(s, max = 200) {
  if (typeof s !== 'string') return String(s)
  const oneLine = s.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? oneLine.slice(0, max) + '…' : oneLine
}

async function probe(label, url, init, token) {
  const headers = {
    ...(init.headers || {}),
    'x-vercel-protection-bypass': token,
  }
  const started = Date.now()
  let res
  try {
    res = await fetch(url, { ...init, headers, redirect: 'manual' })
  } catch (err) {
    return { label, url, ok: false, status: 0, ms: Date.now() - started, error: err.message }
  }
  const ms = Date.now() - started
  // Treat 5xx as failure; 2xx/3xx/4xx all prove the function loaded.
  const ok = res.status < 500
  let body = ''
  try { body = await res.text() } catch { /* ignore */ }
  return { label, url, ok, status: res.status, ms, body: snippet(body) }
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) {
    process.stdout.write(USAGE)
    process.exit(0)
  }

  const url = normalizeUrl(args.url)
  if (!url) {
    process.stderr.write('Error: preview URL required.\n\n' + USAGE)
    process.exit(2)
  }

  const token = process.env.VERCEL_PROTECTION_BYPASS
  if (!token) {
    process.stderr.write(
      'Error: VERCEL_PROTECTION_BYPASS is not set in the environment.\n' +
      'Generate a token at Vercel project settings → Deployment Protection →\n' +
      'Protection Bypass for Automation, then add it to your local env.\n' +
      'See .env.local.example.\n'
    )
    process.exit(2)
  }

  console.log(`Smoking ${url} (token redacted, length=${token.length})`)

  const probes = [
    probe('GET /api/health', `${url}/api/health`, { method: 'GET' }, token),
    probe(
      'POST /api/claude',
      `${url}/api/claude`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      },
      token
    ),
  ]

  const results = await Promise.all(probes)

  let failed = 0
  for (const r of results) {
    const tag = r.ok ? 'OK ' : 'FAIL'
    console.log(`[${tag}] ${r.label} → HTTP ${r.status} in ${r.ms}ms`)
    if (!r.ok) {
      failed++
      if (r.error) console.log(`       error: ${r.error}`)
      if (r.body) console.log(`       body: ${r.body}`)
    }
  }

  if (failed > 0) {
    console.error(`\nsmoke-preview: ${failed} of ${results.length} routes returned 5xx. Do not merge.`)
    process.exit(1)
  }
  console.log(`\nsmoke-preview: OK (${results.length} routes loaded)`)
}

main().catch((err) => {
  console.error('smoke-preview: unexpected error')
  console.error(err)
  process.exit(1)
})
