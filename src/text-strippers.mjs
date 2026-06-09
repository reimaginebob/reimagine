// src/text-strippers.mjs
// Re-export shim. The canonical implementations moved to src/text-strippers.js
// (My Coach PoC, 2026-06-09) so the Vercel api/* function bundler can import
// them across the api/src boundary, which it cannot do for `.mjs` (the
// 2026-05-27 FUNCTION_INVOCATION_FAILED outage, PR #76). This shim preserves
// the existing `.mjs` import path used by src/App.jsx and the Node test
// scripts (scripts/test-text-strippers.mjs, scripts/test-p3-prompt.mjs) so
// no caller had to change its specifier.
export * from './text-strippers.js'
