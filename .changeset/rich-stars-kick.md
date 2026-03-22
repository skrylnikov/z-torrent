---
'@z-torrent/ut-metadata': patch
'@z-torrent/discovery': patch
'@z-torrent/protocol': patch
'@z-torrent/browser': patch
'@z-torrent/tracker': patch
'@z-torrent/create': patch
'@z-torrent/parse': patch
'@z-torrent/core': patch
'@z-torrent/node': patch
'@z-torrent/dht': patch
'@z-torrent/lsd': patch
---

Cross-cutting refactor of the z-torrent stack: platform-agnostic core updates, Node and browser entrypoints, tracker/DHT packaging, parse coverage, and repo tooling.

### Core (`@z-torrent/core`)

- Add torrent identity helpers and align client, torrent, selections, file iterators, peer, rarity map, server base, and web connection plumbing with the shared interfaces and types.
- Extend tests for client behavior and selections; add shims for untyped dependencies.

### Node client (`@z-torrent/node`)

- **API:** drop the default export; use `import { WebTorrent } from '@z-torrent/node'`.
- Trim direct `package.json` dependencies to what this package imports; keep the protocol stack on core.
- Remove legacy root `index.js` and `tsconfig.worker.json`.
- Use ECMAScript private fields where appropriate on `ConnPool`, server, and selections-related code; implement `address()` on `ConnPool` for the core `ConnectionPool` contract.
- Add `typecheck` (`tsc --noEmit`) and dependency shims.
- Tests: named `WebTorrent` import; magnet helpers (`stripMagnetV2Xt`, `expectSameMagnet`) for optional v2 `xt=urn:btmh:…`.
- Fix `Selections.remove` for overlapping intervals that could yield invalid ranges.

### Create torrent (`@z-torrent/create`)

- **Behavior:** when no name can be inferred, use the fixed string `Unnamed Torrent` instead of appending `Date.now()`, so identical inputs yield stable info hashes and predictable duplicate detection.

### Browser (`@z-torrent/browser`)

- Rework worker/server/discovery wiring and platform surface; separate TypeScript configs for the worker bundle.
- Add public API coverage and service-worker / shim typings where needed.

### DHT (`@z-torrent/dht`)

- Remove the package-level `server` entry; consolidate around the client-focused API.
- Refresh and slim the test suite; update typings (e.g. SHA1/sync helpers).

### Tracker (`@z-torrent/tracker`)

- Replace legacy `.js` entrypoints with TypeScript modules for HTTP, UDP, and WebSocket clients and servers.
- Add browser-oriented build entry and stubs where the full stack is unavailable; extend tsdown configuration.

### Parse (`@z-torrent/parse`)

- Improve BitTorrent v2 coverage (fixtures and tests) and related type definitions.

### Discovery, protocol, LSD, ut-metadata

- Align packages with the updated core, tracker, and DHT surfaces (READMEs, manifests, tests, and small API tweaks).

### Repository and examples

- Update root ESLint, Turbo, and workspace `package.json` scripts/deps as needed.
- Refresh `examples/sintel-landing` and `examples/torrent-backup` (Docker, README, Astro config, service worker, torrent demo).
