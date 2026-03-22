# @z-torrent/browser

## 0.0.12

### Patch Changes

- [`524498f`](https://github.com/skrylnikov/z-torrent/commit/524498ff7dd37ae04ed16a73d6d38edd76efc1c8) Thanks [@skrylnikov](https://github.com/skrylnikov)! - Type `ZTorrent` constructor options with `ZTorrentBrowserOpts` (`Omit<ZTorrentCoreOpts, 'platform'>`) and export the type. Replaces `Record<string, unknown>`.

- Updated dependencies [[`524498f`](https://github.com/skrylnikov/z-torrent/commit/524498ff7dd37ae04ed16a73d6d38edd76efc1c8)]:
  - @z-torrent/core@0.0.12
  - @z-torrent/tracker@0.0.12
  - @z-torrent/utils@0.0.12

## 0.0.11

### Patch Changes

- [`bf1c05c`](https://github.com/skrylnikov/z-torrent/commit/bf1c05cd85251efd1f9d4ca2245d889844163b9e) Thanks [@skrylnikov](https://github.com/skrylnikov)! - ### Fixed
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

- Updated dependencies []:
  - @z-torrent/core@0.0.11
  - @z-torrent/tracker@0.0.11
  - @z-torrent/utils@0.0.11

## 0.0.10

### Patch Changes

- [`f50e9c1`](https://github.com/skrylnikov/z-torrent/commit/f50e9c1961d06ff0cbf1ab9d9a6d6b4809e7d75d) Thanks [@skrylnikov](https://github.com/skrylnikov)! - fix publish

- Updated dependencies [[`f50e9c1`](https://github.com/skrylnikov/z-torrent/commit/f50e9c1961d06ff0cbf1ab9d9a6d6b4809e7d75d)]:
  - @z-torrent/core@0.0.10
  - @z-torrent/tracker@0.0.10
  - @z-torrent/utils@0.0.10

## 0.0.9

### Patch Changes

- [#18](https://github.com/skrylnikov/z-torrent/pull/18) [`a37dc01`](https://github.com/skrylnikov/z-torrent/commit/a37dc0188fca05a0c4ed9c9006a904cb6c166628) Thanks [@skrylnikov](https://github.com/skrylnikov)! - Fix incorrect `Content-Type` for media in the browser (e.g. Matroska `.mkv`) when `mime/lite` omits `video/x-*` types, which previously fell through to `application/octet-stream` and broke `<video>` with `X-Content-Type-Options: nosniff`.
  - **@z-torrent/utils:** Add `@z-torrent/utils/streaming-mime` (`resolveTorrentFileMime`, `normalizeSwResponseContentType`, `streamingMimeFromFileName`) with tests.
  - **@z-torrent/core:** Set `File.type` via `resolveTorrentFileMime` on top of `mime/lite`.
  - **@z-torrent/browser:** Service worker normalizes `Content-Type` from the request URL path when the header is missing, empty, or `application/octet-stream`, including for streaming responses; bundle the utils module in `sw.min.js`; README note on MIME and `<video>`.

- Updated dependencies [[`a37dc01`](https://github.com/skrylnikov/z-torrent/commit/a37dc0188fca05a0c4ed9c9006a904cb6c166628)]:
  - @z-torrent/utils@0.0.9
  - @z-torrent/core@0.0.9
  - @z-torrent/tracker@0.0.9

## 0.0.8

### Patch Changes

- [#16](https://github.com/skrylnikov/z-torrent/pull/16) [`26ef5a0`](https://github.com/skrylnikov/z-torrent/commit/26ef5a081869b1130406a730db5ec088841aa06c) Thanks [@skrylnikov](https://github.com/skrylnikov)! - **Breaking (client API)**
  - Rename exports: `WebTorrent` → `ZTorrent` (`@z-torrent/node`, `@z-torrent/browser`), `WebTorrentCore` → `ZTorrentCore`, `WebTorrentCoreOpts` → `ZTorrentCoreOpts`, `WebTorrentClient` → `ZTorrentClient` (`@z-torrent/core`). No `WebTorrent` compatibility alias.
  - Migration: `import { ZTorrent } from '@z-torrent/node'` / `'@z-torrent/browser'`; from core, `ZTorrentCore` and type `ZTorrentClient`.

  **Behaviour notes**
  - Default BitTorrent peer-id prefix remains `-WW…`; `bittorrent-peerid` may still label peers as **WebTorrent** in tracker stats until the prefix is changed deliberately.

  **Housekeeping**
  - Removed per-file `/*! … MIT … */` (and similar) banners from package sources; full license text remains in each package `LICENSE`.
  - CLI `createdBy` default in `@z-torrent/create`, npm descriptions for tracker/discovery, docs/README examples, tests, and `@z-torrent/node` uTP warning string updated for Z-Torrent branding where they referred to the client class or product UA.

- Updated dependencies [[`26ef5a0`](https://github.com/skrylnikov/z-torrent/commit/26ef5a081869b1130406a730db5ec088841aa06c), [`26ef5a0`](https://github.com/skrylnikov/z-torrent/commit/26ef5a081869b1130406a730db5ec088841aa06c), [`26ef5a0`](https://github.com/skrylnikov/z-torrent/commit/26ef5a081869b1130406a730db5ec088841aa06c)]:
  - @z-torrent/core@0.0.8
  - @z-torrent/tracker@0.0.8

## 0.0.7

### Patch Changes

- Updated dependencies [[`8f99be2`](https://github.com/skrylnikov/z-torrent/commit/8f99be201a66830089f502ef2746bbd160d6907b), [`8f99be2`](https://github.com/skrylnikov/z-torrent/commit/8f99be201a66830089f502ef2746bbd160d6907b)]:
  - @z-torrent/core@0.0.7
  - @z-torrent/tracker@0.0.7

## 0.0.6

### Patch Changes

- [#13](https://github.com/skrylnikov/z-torrent/pull/13) [`e4f99ec`](https://github.com/skrylnikov/z-torrent/commit/e4f99ec801589e1186c0b33fe57432666d9d938c) Thanks [@skrylnikov](https://github.com/skrylnikov)! - Cross-cutting refactor of the z-torrent stack: platform-agnostic core updates, Node and browser entrypoints, tracker/DHT packaging, parse coverage, and repo tooling.

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

- Updated dependencies [[`1cd075b`](https://github.com/skrylnikov/z-torrent/commit/1cd075b90b4019113a7264ef39e7122fc7b730f7), [`5187a98`](https://github.com/skrylnikov/z-torrent/commit/5187a98f4e6c26828340ff8b0fb82e1ecb1698f5), [`e4f99ec`](https://github.com/skrylnikov/z-torrent/commit/e4f99ec801589e1186c0b33fe57432666d9d938c)]:
  - @z-torrent/core@0.0.6
  - @z-torrent/tracker@0.0.6

## 0.0.5

### Patch Changes

- [#7](https://github.com/skrylnikov/z-torrent/pull/7) [`2973e65`](https://github.com/skrylnikov/z-torrent/commit/2973e650b85b72725386a83ac5331f8d429e4117) Thanks [@skrylnikov](https://github.com/skrylnikov)! - fix release workflow

- Updated dependencies [[`2973e65`](https://github.com/skrylnikov/z-torrent/commit/2973e650b85b72725386a83ac5331f8d429e4117)]:
  - @z-torrent/core@0.0.5
  - @z-torrent/tracker@0.0.5

## 0.0.4

### Patch Changes

- [#5](https://github.com/skrylnikov/z-torrent/pull/5) [`e0e83e3`](https://github.com/skrylnikov/z-torrent/commit/e0e83e3eb2155e440a12ae9cf80b350c08a5a231) Thanks [@skrylnikov](https://github.com/skrylnikov)! - fix release workflow

- Updated dependencies [[`e0e83e3`](https://github.com/skrylnikov/z-torrent/commit/e0e83e3eb2155e440a12ae9cf80b350c08a5a231)]:
  - @z-torrent/core@0.0.4
  - @z-torrent/tracker@0.0.4

## 0.0.3

### Patch Changes

- [#3](https://github.com/skrylnikov/z-torrent/pull/3) [`9ac5074`](https://github.com/skrylnikov/z-torrent/commit/9ac5074d5623ee527225f0ec96cd1f4a20d32d9c) Thanks [@skrylnikov](https://github.com/skrylnikov)! - fix deploy to npm

- Updated dependencies [[`9ac5074`](https://github.com/skrylnikov/z-torrent/commit/9ac5074d5623ee527225f0ec96cd1f4a20d32d9c)]:
  - @z-torrent/core@0.0.3
  - @z-torrent/tracker@0.0.3

## 0.0.2

### Patch Changes

- [#1](https://github.com/skrylnikov/z-torrent/pull/1) [`2955737`](https://github.com/skrylnikov/z-torrent/commit/2955737ff54a17984d6a1e96f2f69dceef3909d8) Thanks [@skrylnikov](https://github.com/skrylnikov)! - Added
  - LICENSE (MIT) and README.md files to @z-torrent/core package
  - LICENSE (MIT) file to @z-torrent/browser package

  Changed
  - Added files field to all package.json files to explicitly define npm publish contents:
    - All updated packages now include: dist, README.md, and LICENSE
    - Packages that have a CHANGELOG.md file also include it in the published contents
    - @z-torrent/node and @z-torrent/dht: also include AUTHORS.md
    - @z-torrent/tracker: also includes AUTHORS.md and CONTRIBUTING.md
    - @z-torrent/fixtures: also includes fixtures directory

  Removed
  - Deleted 12 .npmignore files (redundant when using files field in package.json)

- Updated dependencies [[`2955737`](https://github.com/skrylnikov/z-torrent/commit/2955737ff54a17984d6a1e96f2f69dceef3909d8)]:
  - @z-torrent/tracker@0.0.2
  - @z-torrent/core@0.0.2
