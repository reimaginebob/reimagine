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
  let body = ''
  try { body = await res.text() } catch { /* ignore */ }

  // Deployment Protection intercepts BEFORE the function runs, so an
  // SSO-walled response proves nothing about whether the function loaded --
  // and it looks exactly like a pass under the <500 rule below (a 302 to the
  // login page, or a 401 carrying the auth-callback JSON). That is not a
  // stricter-is-better tweak: on 2026-08-28 this script reported OK on a
  // preview where every single request, with and without the bypass token,
  // was being redirected to vercel.com/sso-api. The gate had quietly stopped
  // testing anything, which is worse than failing, because a green run was
  // being read as proof the functions loaded.
  //
  // Detect it explicitly and fail, with the fix in the message.
  const location = res.headers.get('location') || ''
  const intercepted =
    /vercel\.com\/sso-api/.test(location) ||
    /vercel\.com\/sso-api/.test(body) ||
    /"vercel_auth_callback"/.test(body)
  if (intercepted) {
    return {
      label, url, ok: false, status: res.status, ms, body: snippet(body),
      error:
        'Deployment Protection blocked this request before the function ran, so nothing was tested. ' +
        'The bypass token is missing, stale, or not matching. Fix: Vercel → project reimagine2 → ' +
        'Settings → Deployment Protection → Protection Bypass for Automation, copy or regenerate the ' +
        'secret, set the Windows user env var VERCEL_PROTECTION_BYPASS to it, then fully close and ' +
        'reopen Claude Code (env is inherited at process launch; /restart is not enough).',
    }
  }

  // Everything else: 5xx is a failure; 2xx/3xx/4xx prove the function loaded.
  const ok = res.status < 500
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
    // "returned 5xx" was the only failure mode when this was written; an
    // SSO-intercepted route now fails too and did not return 5xx, so say the
    // neutral thing and let the per-route error line carry the cause.
    console.error(`\nsmoke-preview: ${failed} of ${results.length} routes failed. Do not merge.`)
    process.exit(1)
  }
  console.log(`\nsmoke-preview: OK (${results.length} routes loaded)`)
}

main().catch((err) => {
  console.error('smoke-preview: unexpected error')
  console.error(err)
  process.exit(1)
})
