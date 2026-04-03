# Z-Torrent Web Hosting — Implementation Roadmap

## Overview

Phased implementation plan for decentralized web hosting on z-torrent. Each phase produces a working, testable increment. Estimated total: **~3000 lines of new code**, 2–4 weeks for a single developer.

Prerequisites: existing z-torrent monorepo with working browser client, Service Worker, torrent creation, Node.js seeder, Docker infrastructure, and WSS tracker.

---

## Phase 1: Core Infrastructure

**Goal:** Make the existing server/SW stack capable of serving websites, not just downloading files.

### Tasks

| #    | Task                                        | File(s)                                                             | Description                                                                                                         |
| ---- | ------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1.1  | Add `hostingMode` option to `ServerOptions` | `packages/core/src/interfaces.ts`                                   | New `hostingMode?: boolean` and `manifest?: ZTManifest` fields                                                      |
| 1.2  | Remove forced download for documents        | `packages/core/src/lib/server-base.ts:166-170`                      | Skip `Content-Disposition: attachment` and `application/octet-stream` when `hostingMode` is true                    |
| 1.3  | Configurable cache headers                  | `packages/core/src/lib/server-base.ts:158-159`                      | Return `Cache-Control: public, max-age=31536000, immutable` in hosting mode                                         |
| 1.4  | Relax CSP in hosting mode                   | `packages/core/src/lib/server-base.ts:210`                          | Skip restrictive CSP (`frame-ancestors 'none'`, `form-action 'none'`) in hosting mode                               |
| 1.5  | Remove hardcoded favicon 404                | `packages/core/src/lib/server-base.ts:221-223`                      | Let favicon.ico resolve through normal file lookup                                                                  |
| 1.6  | Directory index resolution                  | `packages/core/src/lib/server-base.ts:260`                          | `/path/` resolves to `/path/index.html`, `/path` tries `path.html`                                                  |
| 1.7  | SPA fallback routing                        | `packages/core/src/lib/server-base.ts`                              | If manifest `type === 'spa'` and no file matches, serve `routing.fallback` (default: `index.html`)                  |
| 1.8  | Increase SW stream timeout                  | `packages/browser/src/lib/worker-server.ts:104-109`                 | Change from 5s to 30s for non-document requests                                                                     |
| 1.9  | Verify MIME coverage in SW                  | `packages/browser/src/lib/worker-server.ts:79`                      | Confirm `BrowserServer` returns correct Content-Type for `.css`, `.js`, `.woff2`, `.svg`, `.wasm`, `.avif`, `.webp` |
| 1.10 | Define `ZTManifest` type                    | `packages/core/src/types.ts` or new `packages/publish/src/types.ts` | TypeScript interface for `zt-manifest.json` (see `docs/manifest.md`)                                                |

### Verification

- Unit test: `server-base` with `hostingMode: true` serves HTML inline (no download prompt)
- Unit test: directory index resolution (`/` → `index.html`)
- Unit test: SPA fallback for unknown paths
- Manual test: load a multi-file torrent in the browser, navigate to `/z-torrent/{hash}/` and see the HTML rendered

### Dependencies

None — purely modifying existing packages.

---

## Phase 2: Publish CLI

**Goal:** A working CLI that creates a torrent from a static site directory, generates a manifest, and outputs a `.torrent` file.

### Tasks

| #   | Task                          | File(s)                                             | Description                                                                                            |
| --- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 2.1 | Scaffold `packages/publish/`  | `package.json`, `tsconfig.json`, `tsdown.config.ts` | New workspace package with `@z-torrent/create` and `@z-torrent/parse` deps                             |
| 2.2 | Config loader                 | `src/config.ts`                                     | Load `z-torrent.config.json` (or `.ts`/`.js`/`.mjs`), resolve `$ENV_VAR` placeholders, validate schema |
| 2.3 | Manifest generator            | `src/manifest.ts`                                   | Build `zt-manifest.json` from config, add `_meta` (timestamp, version, size, file count)               |
| 2.4 | Torrent creation wrapper      | `src/torrent.ts`                                    | Wrap `@z-torrent/create` with auto piece-length calculation, tracker list, `createdBy` tag             |
| 2.5 | Core `publish()` function     | `src/index.ts`                                      | Orchestrate: scan dir → generate manifest → write manifest to dir → create torrent → clean up manifest |
| 2.6 | CLI entry point               | `src/cli.ts`                                        | `parseArgs` for `--dir`, `--config`, `--output`, `--dry-run`, `--verbose`, `--help`                    |
| 2.7 | Type definitions              | `src/types.ts`                                      | `PublishConfig`, `PublishResult`, `PublishProgress` types                                              |
| 2.8 | Seed server API client (stub) | `src/server.ts`                                     | `pushToServer()` and `waitForReady()` — functional but only used when `--server` is provided           |
| 2.9 | Add to root workspace         | `package.json` (root)                               | Add `packages/publish` to workspace globs if needed                                                    |

### Verification

- Run `bun run build` in `packages/publish/` — compiles without errors
- `z-torrent-publish --dry-run --dir examples/sintel-landing/dist` produces a valid `.torrent` file
- Output `.torrent` contains `zt-manifest.json` in file list
- `parseTorrent()` on the output returns expected infoHash, file list, tracker list

### Dependencies

Phase 1 (for `ZTManifest` type definition) — but can be developed in parallel if types are duplicated temporarily.

---

## Phase 3: Seed Server API

**Goal:** Extend the existing `examples/torrent-backup/` seeder with a REST API for accepting published sites.

### Tasks

| #    | Task                                                        | File(s)                            | Description                                                                                                                         |
| ---- | ----------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 3.1  | Rename `examples/torrent-backup/` → `examples/seed-server/` | Directory rename                   | Update all references in `package.json`, Docker files, root workspace config                                                        |
| 3.2  | Add SQLite database                                         | `src/storage/db.ts`                | Initialize `bun:sqlite`, create `deployments` table (see `docs/seed-server.md` schema)                                              |
| 3.3  | Config parsing for API keys                                 | `src/config.ts`                    | Parse `API_KEYS` env var (JSON array), new env vars (`API_PORT`, `DB_PATH`, `MAX_TOTAL_STORAGE`, `DEFAULT_TTL`, `CLEANUP_INTERVAL`) |
| 3.4  | Auth middleware                                             | `src/api/middleware/auth.ts`       | Extract `Bearer` token from `Authorization` header, look up in API keys config                                                      |
| 3.5  | Rate limiting middleware                                    | `src/api/middleware/rate-limit.ts` | In-memory sliding window counter per API key                                                                                        |
| 3.6  | `POST /api/publish` handler                                 | `src/api/routes/publish.ts`        | Accept multipart (torrent + manifest), validate limits, store in DB, add to ZTorrent client                                         |
| 3.7  | `GET /api/status/:infoHash` handler                         | `src/api/routes/status.ts`         | Return deployment status, progress, peer count, upload stats                                                                        |
| 3.8  | `GET /api/stats` handler                                    | `src/api/routes/stats.ts`          | Return per-key usage, deployment list, totals                                                                                       |
| 3.9  | `DELETE /api/deployments/:infoHash` handler                 | `src/api/routes/publish.ts`        | Remove torrent, delete files, update DB                                                                                             |
| 3.10 | `GET /api/health` handler                                   | `src/api/routes/health.ts`         | No-auth health check with uptime, torrent count, storage usage                                                                      |
| 3.11 | TTL cleanup job                                             | `src/storage/cleanup.ts`           | Periodic job to expire deployments where `last_accessed_at + ttl < now`                                                             |
| 3.12 | Access tracking                                             | `src/index.ts`                     | Update `last_accessed_at` on torrent `upload` events (throttled to 1/min)                                                           |
| 3.13 | Deployment restoration on startup                           | `src/index.ts`                     | Load active deployments from DB, re-add to ZTorrent client                                                                          |
| 3.14 | API server setup                                            | `src/api/server.ts`                | Bun.serve with CORS, routing, error handling                                                                                        |
| 3.15 | Update Docker config                                        | `Dockerfile`, `docker-compose.yml` | Expose API port, add data volume for SQLite                                                                                         |
| 3.16 | Update `.env.example`                                       | `.env.example`                     | Document all new env vars                                                                                                           |

### Verification

- Start server, `POST /api/publish` with a `.torrent` and manifest → returns 200 with infoHash
- `GET /api/status/{hash}` → returns `downloading` then `seeding` after download completes
- `GET /api/stats` → shows deployment in list
- `DELETE /api/deployments/{hash}` → removes torrent
- `GET /api/health` → returns status
- Restart server → deployments restored from DB
- Wait for TTL → deployment auto-expires

### Dependencies

Phase 2 (publish CLI produces the `.torrent` + manifest that the API consumes). Can be developed in parallel using manually created test fixtures.

---

## Phase 4: Web Portal

**Goal:** A user-facing SPA at `z-torrent.xyz` that loads torrent-hosted sites and renders them in an iframe.

### Tasks

| #    | Task                            | File(s)                                                         | Description                                                                         |
| ---- | ------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 4.1  | Scaffold `examples/web-portal/` | `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html` | Vite + Svelte 5, `@z-torrent/browser` dep, `zTorrentSW()` plugin                    |
| 4.2  | URL parser                      | `src/lib/url.ts`                                                | Extract infoHash + subpath from URL pathname                                        |
| 4.3  | Torrent loader                  | `src/lib/torrent-loader.ts`                                     | Singleton ZTorrent client, SW registration, `loadTorrent()` with progress callbacks |
| 4.4  | Manifest parser                 | `src/lib/manifest.ts`                                           | Parse and validate `zt-manifest.json` from torrent files                            |
| 4.5  | Svelte store                    | `src/stores/torrent.ts`                                         | Reactive store for `TorrentState` (phase, progress, speeds, peers)                  |
| 4.6  | `App.svelte`                    | `src/App.svelte`                                                | Root component — route to Landing or Viewer based on URL                            |
| 4.7  | `Landing.svelte`                | `src/components/Landing.svelte`                                 | Address input (accepts hash, magnet, URL), example links                            |
| 4.8  | `Viewer.svelte`                 | `src/components/Viewer.svelte`                                  | iframe container, torrent lifecycle management                                      |
| 4.9  | `LoadingScreen.svelte`          | `src/components/LoadingScreen.svelte`                           | Progress bar, peer count, speed, ETA, site name (from manifest)                     |
| 4.10 | `StatusIndicator.svelte`        | `src/components/StatusIndicator.svelte`                         | Floating bottom-left pill: seeding dot, speeds, peer count                          |
| 4.11 | `StatusPanel.svelte`            | `src/components/StatusPanel.svelte`                             | Expanded panel: file list, peer list, torrent info, manifest info                   |
| 4.12 | Styles                          | `src/app.css`                                                   | Minimal global styles, dark theme, responsive                                       |
| 4.13 | iframe address sync             | `src/lib/url.ts`                                                | Update browser URL bar as user navigates within the iframe site                     |
| 4.14 | Error handling                  | `Viewer.svelte`                                                 | Error states: no peers, invalid hash, network errors, with retry button             |

### Verification

- `bun run dev` — portal loads at `localhost:5173`
- Navigate to `localhost:5173/{infoHash}` — loading screen appears, torrent downloads, iframe renders site
- Status indicator shows speeds and peer count
- Click status indicator — panel expands with file/peer details
- Browser back button returns to landing page
- Direct URL with subpath loads correct page in iframe

### Dependencies

Phase 1 (hosting mode in server-base), Phase 3 (seed server must be running to seed content for testing).

---

## Phase 5: Integration & Demo

**Goal:** End-to-end working demo — publish a site, seed it, view it in the portal.

### Tasks

| #   | Task                                       | File(s)                                             | Description                                                                                         |
| --- | ------------------------------------------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 5.1 | Create Sintel demo site                    | `examples/sintel-web/`                              | Simple static HTML page: Sintel poster image, title, description, link to video. Build output < 1MB |
| 5.2 | Add `z-torrent.config.json` to Sintel demo | `examples/sintel-web/z-torrent.config.json`         | Config for publish CLI                                                                              |
| 5.3 | Publish Sintel demo to seed server         | Manual / CI                                         | Run `z-torrent-publish` against a running seed server, capture the output URL                       |
| 5.4 | Wire publish CLI to seed server            | `packages/publish/src/server.ts`                    | Complete `pushToServer()` and `waitForReady()` with actual HTTP calls                               |
| 5.5 | Add web seed URL to torrent                | `packages/publish/src/torrent.ts`                   | Include seed server HTTP URL in torrent `urlList` for fast first load                               |
| 5.6 | Add example links to portal landing        | `examples/web-portal/src/components/Landing.svelte` | Sintel demo link with real infoHash                                                                 |
| 5.7 | End-to-end test script                     | `scripts/e2e-test.sh` or `test/e2e/`                | Start seed server → publish site → start portal → verify loading via headless browser or HTTP check |
| 5.8 | Docker compose for full stack              | `docker-compose.yml` (root or `examples/`)          | Seed server + portal + tracker in a single compose file                                             |
| 5.9 | Update seed server Docker image            | `examples/seed-server/Dockerfile`                   | Ensure API port exposed, data volume mounted                                                        |

### Verification

- Full flow works: `z-torrent-publish` → seed server seeds → portal at `z-torrent.xyz/{hash}` renders the Sintel demo page
- Portal loads site in < 10 seconds (with web seed fallback)
- Status indicator shows peers and speeds
- Site is accessible by a second browser (P2P works between two visitors)

### Dependencies

Phases 1–4 completed.

---

## Phase 6: Polish & Hardening

**Goal:** Production readiness — caching, performance, security, error recovery.

### Tasks

| #    | Task                               | File(s)                                          | Description                                                                                                   |
| ---- | ---------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 6.1  | SW Cache API integration           | `packages/browser/src/lib/worker-server.ts`      | Cache successful responses in `caches.open()`. Torrent content is immutable — cache never invalidates         |
| 6.2  | Offline support                    | (automatic)                                      | With SW caching, previously visited sites work offline for free                                               |
| 6.3  | Root-relative path rewriting in SW | `packages/browser/src/lib/worker-server.ts`      | Intercept requests from iframe, rewrite `/path` to `/z-torrent/{hash}/path`                                   |
| 6.4  | `<base>` tag injection             | `packages/core/src/lib/server-base.ts`           | Inject `<base href="/z-torrent/{hash}/">` in HTML responses (hosting mode only)                               |
| 6.5  | Piece prioritization from manifest | `packages/core/` or portal                       | Use manifest `priority` patterns to prioritize downloading critical files first (HTML, CSS, JS before images) |
| 6.6  | Mobile optimizations               | Portal + core                                    | Limit `maxConns` on mobile, prefer web seed over P2P, detect `navigator.connection`                           |
| 6.7  | Error recovery and retry           | Portal + SW                                      | Retry on piece failure, "no peers" notification with retry, SW crash recovery                                 |
| 6.8  | Publish-time validation            | `packages/publish/src/index.ts`                  | Validate entry file exists, check for forbidden file types, warn on root-relative paths                       |
| 6.9  | Content validation on seed server  | `examples/seed-server/src/api/routes/publish.ts` | Basic checks: entry file exists in torrent, manifest valid, no suspicious patterns                            |
| 6.10 | IndexedDB chunk store              | `packages/browser/` or portal                    | Replace `MemoryChunkStore` with IndexedDB-backed store for large sites (reduces RAM)                          |
| 6.11 | Loading UX polish                  | Portal components                                | Skeleton states, smooth transitions, error illustrations                                                      |
| 6.12 | Security documentation             | `docs/security.md`                               | Document same-origin XSS risk, mitigation strategies, future SharedWorker plan                                |

### Verification

- Revisit a previously loaded site with network disabled — loads from SW cache
- Load a site that uses root-relative paths (e.g., Vite default output) — renders correctly
- Load a 10MB+ site on mobile — doesn't crash, memory stays reasonable
- Publish a broken site (no index.html) — CLI rejects with clear error
- Site with 20+ assets loads without timeout errors

### Dependencies

Phase 5 completed, working end-to-end flow.

---

## Phase 7: Host SDK & Interactive Demos

**Goal:** Enable hosted sites to request additional torrents (e.g., video streaming) from the web portal via a lightweight SDK, and migrate the Sintel demo to Astro with actual torrent-based video playback.

### Background

The Sintel demo site (`examples/sintel-web/`) is currently a static HTML page where the "Watch" button links externally to Blender.org. The goal is to make it stream Sintel.mp4 directly from a BitTorrent swarm — the same way `examples/sintel-landing/` does, but from within a site that is itself loaded via z-torrent.

The key challenge is that `sintel-web` runs inside an iframe served by the web portal. It needs to communicate with the portal's ZTorrent client to add a new torrent and get file URLs. The solution is a PostMessage-based SDK (`@z-torrent/host-sdk`) that hosted sites can use to request torrent content from the parent portal.

The existing SW + ServerBase infrastructure already supports range requests and streaming (used by `sintel-landing`), so video playback works out of the box once the torrent is added and file URLs are returned.

### Architecture

```
sintel-web (iframe)                  web-portal (parent)
───────────────────                  ──────────────────
SDK.add(magnetURI) ──postMessage──► Viewer message handler
                                     │
                                     ▼
                                    client.add(magnetURI)
                                     │ (wait for metadata)
                                     ▼
                   ◄──postMessage── { files: { name: url } }

video.src = url    ──HTTP request──► Service Worker
                   ◄── stream ───── SW streams from torrent
```

### Tasks

| #   | Task                          | File(s)                                                             | Description                                                                                                                                                                                                           |
| --- | ----------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1 | Scaffold `packages/host-sdk/` | `package.json`, `tsconfig.json`, `tsdown.config.ts`, `src/index.ts` | New workspace package `@z-torrent/host-sdk`. Standalone IIFE bundle (`z-torrent-host-sdk.min.js`) that sets `window.ZTorrentHost`. ~50 lines of source.                                                               |
| 7.2 | PostMessage protocol          | `packages/host-sdk/src/index.ts`                                    | Implement `ZTorrentHost.add(magnetURI, opts?)` → `Promise<{ files: Record<string, string> }>`. Messages: `z-torrent:add-torrent`, `z-torrent:torrent-added`, `z-torrent:torrent-progress`, `z-torrent:torrent-error`. |
| 7.3 | Export portal client accessor | `examples/web-portal/src/lib/torrent-loader.ts`                     | Export `getClient()` so `Viewer.svelte` can use it for SDK message handling.                                                                                                                                          |
| 7.4 | Web-portal message handler    | `examples/web-portal/src/components/Viewer.svelte`                  | Listen for `message` events. On `z-torrent:add-torrent`: call `client.add()`, wait for metadata, collect file URLs (`/z-torrent/<hash>/<path>`), post back. Send progress updates periodically.                       |
| 7.5 | Migrate sintel-web to Astro   | `examples/sintel-web/`                                              | Rewrite as Astro app (like `sintel-landing`). Keep current dark-theme card design. Add `z-torrent.config.json` for Astro framework type.                                                                              |
| 7.6 | Sintel video streaming        | `examples/sintel-web/src/pages/index.astro`                         | Include `@z-torrent/host-sdk` in the page. On "Watch" click: `host.add(SINTEL_MAGNET)` → get file URL → set `<video src>` → play. Native HTML5 video player.                                                          |
| 7.7 | Update e2e-demo script        | `scripts/e2e-demo.ts`                                               | Build sintel-web (Astro), copy SDK bundle into sintel-web output before publish, update publish flow.                                                                                                                 |

### Verification

- `bun run build` in `packages/host-sdk/` produces `z-torrent-host-sdk.min.js` IIFE bundle
- e2e-demo: portal loads sintel-web in iframe → "Watch" button → SDK sends postMessage → portal adds Sintel torrent → file URLs returned → `<video>` streams from torrent via SW
- Video playback supports seeking (range requests via SW)
- SDK handles error cases: no peers, invalid magnet, torrent not found

### Dependencies

Phases 1–5 completed (web-portal with SW + seed-server working).

---

## Milestone Summary

| Phase | Milestone                         | Deliverable                                                            |
| ----- | --------------------------------- | ---------------------------------------------------------------------- |
| 1     | **Hosting mode works**            | Modified `server-base.ts` + `worker-server.ts` serve HTML sites inline |
| 2     | **CLI creates site torrents**     | `z-torrent-publish --dry-run` produces valid `.torrent` with manifest  |
| 3     | **Seed server accepts publishes** | REST API at `/api/publish` stores and seeds site torrents              |
| 4     | **Portal renders torrent sites**  | `z-torrent.xyz/{hash}` shows a torrent-hosted website in iframe        |
| 5     | **End-to-end demo works**         | Sintel demo published, seeded, and viewable in portal                  |
| 6     | **Production ready**              | Caching, offline support, error recovery, security docs                |
| 7     | **Interactive demo with SDK**     | Sintel demo streams video from torrent via Host SDK, Astro migration   |

## Estimated Lines of Code

| Component                     | New Lines | Modified Lines |
| ----------------------------- | --------- | -------------- |
| `server-base.ts` hosting mode | —         | ~100           |
| `worker-server.ts` changes    | —         | ~30            |
| `packages/publish/`           | ~500      | —              |
| `examples/seed-server/` API   | ~800      | ~50            |
| `examples/web-portal/`        | ~1500     | —              |
| `examples/sintel-web/`        | ~200      | —              |
| Phase 6 polish                | ~400      | ~100           |
| `packages/host-sdk/`          | ~50       | —              |
| sintel-web Astro migration    | ~150      | ~200           |
| Portal SDK message handler    | ~100      | ~30            |
| **Total**                     | **~3850** | **~510**       |

## Risk Register

| Risk                         | Likelihood   | Impact | Mitigation                                                |
| ---------------------------- | ------------ | ------ | --------------------------------------------------------- |
| Same-origin XSS in iframe    | Certain (v1) | High   | Accept for v1, document clearly, plan SharedWorker for v2 |
| Slow first load (>10s)       | Medium       | High   | Web seeds (HTTP fallback) from seed server                |
| Memory pressure on mobile    | Medium       | Medium | IndexedDB chunk store (Phase 6)                           |
| SW lifecycle edge cases      | Low          | Medium | `skipWaiting()` + `clients.claim()` already in place      |
| Root-relative path breakage  | High         | High   | SW path rewriting + `<base>` tag injection (Phase 6)      |
| WSS tracker downtime         | Low          | High   | Multiple trackers, PEX, seed server always connected      |
| SDK postMessage interception | Low          | Medium | Hosted site could spoof SDK messages — validate origin    |
