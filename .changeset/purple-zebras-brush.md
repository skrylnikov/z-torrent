---
'@z-torrent/browser': patch
---

### Fixed

- **Service worker (`sw.min.js`)**: bundle `@z-torrent/utils` subpath imports (e.g. `streaming-mime`) via `deps.alwaysBundle: [/^@z-torrent\//]` so the worker is a single file without bare `import` specifiers the browser cannot resolve.

### Added

- **Bundler-friendly default entry**: `"."` → `dist/index.js` — unminified ESM with dependencies left external for Vite/Webpack tree-shaking and deduplication.
- **`@z-torrent/browser/standalone`**: pre-bundled `z-torrent.min.js` (previous default behavior) for CDN or use without a bundler.
- **`@z-torrent/browser/vite`**: `zTorrentSW()` plugin to serve and emit `sw.min.js` during Vite/Astro dev and build (no manual copy script).

### Changed

- **`main` / default `exports["."]`**: now point at `dist/index.js` instead of `z-torrent.min.js`. Apps that relied on a single pre-built file from the package root should import `@z-torrent/browser/standalone` or keep bundling `@z-torrent/browser` as before.

### Internal

- Split `tsdown` configs: `tsdown.config.main.ts`, `tsdown.config.standalone.ts`, `tsdown.config.worker.ts`, `tsdown.config.node.ts` (Vite plugin build).
- Standalone config: drop duplicate `aliasPlugin`; keep `resolve.alias` for `dgram` / `stream` / tracker browser client.
