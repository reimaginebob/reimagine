# Self-hosted pdf.js worker

`loadPDFJS()` in `src/App.jsx` loads the pdf.js **library** from cdnjs with a
Subresource Integrity (SRI) `integrity` hash + `crossorigin="anonymous"`. The
pdf.js **worker** is loaded via `pdfjsLib.GlobalWorkerOptions.workerSrc`, and
SRI does not apply to Worker URLs the same way it does to `<script>` tags, so
the worker is self-hosted here instead of pulled from the CDN.

## Layout

```
public/pdf-worker/<version>/pdf.worker.min.js
```

The version is a folder so upgrades can stage a new known-good copy without
overwriting the current one. Vite copies `public/` to `dist/` verbatim, so the
file is served at `/pdf-worker/<version>/pdf.worker.min.js` in production.

## Current version: 3.11.174

Source: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`

## Upgrade procedure (all three must move in lockstep)

1. Bump the version in the **library** `src.src` URL in `loadPDFJS()`.
2. Recompute the SRI hash for the new `pdf.min.js` and update `s.integrity`:
   ```sh
   curl -sL https://cdnjs.cloudflare.com/ajax/libs/pdf.js/<version>/pdf.min.js \
     | openssl dgst -sha384 -binary | openssl base64 -A
   ```
   (Prefix the output with `sha384-`.)
3. Download the matching worker into a new version folder and update the
   `workerSrc` path in `loadPDFJS()`:
   ```sh
   mkdir -p public/pdf-worker/<version>
   curl -sL https://cdnjs.cloudflare.com/ajax/libs/pdf.js/<version>/pdf.worker.min.js \
     -o public/pdf-worker/<version>/pdf.worker.min.js
   ```
