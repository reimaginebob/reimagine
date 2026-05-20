// ESLint flat config for Reimagine. Wired into the prebuild chain in
// package.json so every build runs the lint check before Vite touches
// anything.
//
// Two rules, both at 'error':
//   react/jsx-no-undef -- catches the failure class that took production
//     down for ~4 minutes on 2026-05-20: PR #17 referenced <MessageSquare>
//     in JSX but only MessageCircle was in the lucide-react import line,
//     Vite happily built it, the bundle shipped, and React threw at
//     render time. ESLint sees JSX component references that do not
//     resolve to an import, a local declaration, or a global.
//   no-undef -- broader coverage. Same family of bug for plain-JS
//     identifiers. Already passes on the current codebase given the
//     browser + node globals declared below.
//
// Flat config (eslint.config.js) is the v9 default; ESLint 9 was the
// version pulled in when the deps were installed. Legacy .eslintrc.cjs
// would also work but flat config is the supported forward path.

import babelParser from '@babel/eslint-parser'
import reactPlugin from 'eslint-plugin-react'
import globals from 'globals'

export default [
  {
    ignores: ['dist', 'node_modules', 'public', 'src/data/user-guide-content.js'],
  },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: { presets: ['@babel/preset-react'] },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: { react: reactPlugin },
    rules: {
      'react/jsx-no-undef': 'error',
      'no-undef': 'error',
    },
    settings: {
      react: { version: 'detect' },
    },
  },
  {
    // API routes run on Vercel's Node runtime; no JSX, no browser globals.
    files: ['api/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      'no-undef': 'error',
    },
  },
]
