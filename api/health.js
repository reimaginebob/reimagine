// api/health.js
//
// Lightweight health-check endpoint. Its purpose is to mirror the import
// topology of api/claude.js so that if Vercel's serverless function bundler
// fails to load api/claude.js at runtime, this endpoint also fails. A
// single curl against the preview deploy catches the class of failure that
// took production down for 45 minutes on 2026-05-27 (PR #76: cross-
// directory .mjs import) in seconds instead of waiting for users to hit it.
//
// Today api/claude.js has zero imports beyond Node built-ins, so this
// endpoint also has zero imports. As api/claude.js evolves, mirror its
// import topology here. The shape of this file matters more than its
// content: any module-load failure that breaks api/claude.js should also
// break api/health.js. If you add an import to api/claude.js, add the same
// import to this file (or factor a shared dependencies module that both
// import).
//
// No external calls. No auth. No origin check. Safe to hit from anywhere.
// Returns 200 with a small JSON body that includes the Node version so a
// curl in the verification gate can confirm the function is actually
// running, not just routed to a cached error page.

export const config = {
  maxDuration: 10,
}

export default async function handler(req, res) {
  return res.status(200).json({
    ok: true,
    ts: Date.now(),
    node: process.version,
  })
}
