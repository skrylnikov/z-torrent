## [11.0.19](https://github.com/webtorrent/parse-torrent/compare/v11.0.18...v11.0.19) (2025-10-07)

## 0.0.9

### Patch Changes

- Updated dependencies []:
  - @z-torrent/magnet@0.0.9

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

- Updated dependencies [[`26ef5a0`](https://github.com/skrylnikov/z-torrent/commit/26ef5a081869b1130406a730db5ec088841aa06c)]:
  - @z-torrent/magnet@0.0.8

## 0.0.7

### Patch Changes

- [#14](https://github.com/skrylnikov/z-torrent/pull/14) [`8f99be2`](https://github.com/skrylnikov/z-torrent/commit/8f99be201a66830089f502ef2746bbd160d6907b) Thanks [@skrylnikov](https://github.com/skrylnikov)! - Add v2 torrent metadata types and parsing (file layout, piece layers, and related fields).

- Updated dependencies []:
  - @z-torrent/magnet@0.0.7

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

- [#12](https://github.com/skrylnikov/z-torrent/pull/12) [`e84ff59`](https://github.com/skrylnikov/z-torrent/commit/e84ff596f40550a02e7b3fdf5bb3445bdbe1c066) Thanks [@skrylnikov](https://github.com/skrylnikov)! - Refactor @z-torrent/magnet package
  - Remove default export, export `magnet` object with `decode` and `encode` methods instead
  - Fix TypeScript type errors throughout the codebase
  - Fix import of `@thaunknown/thirty-two` (use default import)
  - Add `xl` property to `MagnetURI` and `MagnetURIEncodeInput` types
  - Update README with new API usage examples
  - Update `@z-torrent/parse` to use new magnet API

  Breaking change: Default export removed. Use `import { magnet } from '@z-torrent/magnet'` instead of `import magnet from '@z-torrent/magnet'`.

- Updated dependencies [[`e84ff59`](https://github.com/skrylnikov/z-torrent/commit/e84ff596f40550a02e7b3fdf5bb3445bdbe1c066)]:
  - @z-torrent/magnet@0.0.6

## 0.0.5

### Patch Changes

- [#7](https://github.com/skrylnikov/z-torrent/pull/7) [`2973e65`](https://github.com/skrylnikov/z-torrent/commit/2973e650b85b72725386a83ac5331f8d429e4117) Thanks [@skrylnikov](https://github.com/skrylnikov)! - fix release workflow

- Updated dependencies [[`2973e65`](https://github.com/skrylnikov/z-torrent/commit/2973e650b85b72725386a83ac5331f8d429e4117)]:
  - @z-torrent/magnet@0.0.5

## 0.0.4

### Patch Changes

- [#5](https://github.com/skrylnikov/z-torrent/pull/5) [`e0e83e3`](https://github.com/skrylnikov/z-torrent/commit/e0e83e3eb2155e440a12ae9cf80b350c08a5a231) Thanks [@skrylnikov](https://github.com/skrylnikov)! - fix release workflow

- Updated dependencies [[`e0e83e3`](https://github.com/skrylnikov/z-torrent/commit/e0e83e3eb2155e440a12ae9cf80b350c08a5a231)]:
  - @z-torrent/magnet@0.0.4

## 0.0.3

### Patch Changes

- [#3](https://github.com/skrylnikov/z-torrent/pull/3) [`9ac5074`](https://github.com/skrylnikov/z-torrent/commit/9ac5074d5623ee527225f0ec96cd1f4a20d32d9c) Thanks [@skrylnikov](https://github.com/skrylnikov)! - fix deploy to npm

- Updated dependencies [[`9ac5074`](https://github.com/skrylnikov/z-torrent/commit/9ac5074d5623ee527225f0ec96cd1f4a20d32d9c)]:
  - @z-torrent/magnet@0.0.3

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
  - @z-torrent/magnet@0.0.2

### Bug Fixes

- Greatly improve efficiency with torrents with a large number of files ([#198](https://github.com/webtorrent/parse-torrent/issues/198)) ([964e080](https://github.com/webtorrent/parse-torrent/commit/964e0805e1ddb0561b626fab21fda5dd3f82fa3c))

## [11.0.18](https://github.com/webtorrent/parse-torrent/compare/v11.0.17...v11.0.18) (2025-01-04)

### Bug Fixes

- **deps:** update dependency magnet-uri to ^7.0.7 ([#192](https://github.com/webtorrent/parse-torrent/issues/192)) ([aaeb8d5](https://github.com/webtorrent/parse-torrent/commit/aaeb8d59be09c29ed740a679e4f14c54a4bfbd28))

## [11.0.17](https://github.com/webtorrent/parse-torrent/compare/v11.0.16...v11.0.17) (2024-06-29)

### Bug Fixes

- **deps:** update dependency uint8-util to ^2.2.5 ([#185](https://github.com/webtorrent/parse-torrent/issues/185)) ([c0c72ce](https://github.com/webtorrent/parse-torrent/commit/c0c72ceb2ca7484434cf4c25563191697febf12a))

## [11.0.16](https://github.com/webtorrent/parse-torrent/compare/v11.0.15...v11.0.16) (2024-01-16)

### Bug Fixes

- **deps:** update dependency uint8-util to ^2.2.4 ([#167](https://github.com/webtorrent/parse-torrent/issues/167)) ([8983eac](https://github.com/webtorrent/parse-torrent/commit/8983eaccd2d0e94cb953fb4c37d54ed6d9c8dba6))

## [11.0.15](https://github.com/webtorrent/parse-torrent/compare/v11.0.14...v11.0.15) (2024-01-16)

### Bug Fixes

- build badges url ([#180](https://github.com/webtorrent/parse-torrent/issues/180)) ([15134f5](https://github.com/webtorrent/parse-torrent/commit/15134f5d753f96fdbc643ebb72d298f80be94d37))

## [11.0.14](https://github.com/webtorrent/parse-torrent/compare/v11.0.13...v11.0.14) (2023-08-11)

### Bug Fixes

- **deps:** update dependency uint8-util to ^2.2.2 ([#162](https://github.com/webtorrent/parse-torrent/issues/162)) ([15ba6e0](https://github.com/webtorrent/parse-torrent/commit/15ba6e022c53d17d8a15deebbac887736638af4e))

## [11.0.13](https://github.com/webtorrent/parse-torrent/compare/v11.0.12...v11.0.13) (2023-08-10)

### Bug Fixes

- **deps:** update dependency bencode to v4 ([#164](https://github.com/webtorrent/parse-torrent/issues/164)) ([89b0b2b](https://github.com/webtorrent/parse-torrent/commit/89b0b2b76414a6773b9ce0c31ce8cc004ed7e3b8))

## [11.0.12](https://github.com/webtorrent/parse-torrent/compare/v11.0.11...v11.0.12) (2023-05-31)

### Bug Fixes

- **deps:** update dependency magnet-uri to ^7.0.5 ([#156](https://github.com/webtorrent/parse-torrent/issues/156)) ([0784624](https://github.com/webtorrent/parse-torrent/commit/0784624754efeeeb6c2360822231bbd908572dfc))

## [11.0.11](https://github.com/webtorrent/parse-torrent/compare/v11.0.10...v11.0.11) (2023-05-30)

### Bug Fixes

- remove unused hack ([#155](https://github.com/webtorrent/parse-torrent/issues/155)) ([ea0cc5e](https://github.com/webtorrent/parse-torrent/commit/ea0cc5eb589375d97698426b11963acacc5345b8))

## [11.0.10](https://github.com/webtorrent/parse-torrent/compare/v11.0.9...v11.0.10) (2023-05-27)

### Bug Fixes

- **deps:** update dependency magnet-uri to ^7.0.4 ([#154](https://github.com/webtorrent/parse-torrent/issues/154)) ([446a0ba](https://github.com/webtorrent/parse-torrent/commit/446a0ba598b20bef7d7fa4e4d475754144801f54))

## [11.0.9](https://github.com/webtorrent/parse-torrent/compare/v11.0.8...v11.0.9) (2023-05-27)

### Bug Fixes

- **deps:** update dependency uint8-util to ^2.1.9 ([#146](https://github.com/webtorrent/parse-torrent/issues/146)) ([e0c1db2](https://github.com/webtorrent/parse-torrent/commit/e0c1db2f089e1bb02ee8d89fc8348fc5582506a7))

## [11.0.8](https://github.com/webtorrent/parse-torrent/compare/v11.0.7...v11.0.8) (2023-04-03)

### Bug Fixes

- **deps:** update dependency magnet-uri to ^7.0.3 ([#150](https://github.com/webtorrent/parse-torrent/issues/150)) ([6406b7b](https://github.com/webtorrent/parse-torrent/commit/6406b7ba31631718aad0aa5a918045804ddf4cf7))

## [11.0.7](https://github.com/webtorrent/parse-torrent/compare/v11.0.6...v11.0.7) (2023-01-31)

### Bug Fixes

- **deps:** update dependency cross-fetch-ponyfill to ^1.0.3 ([#144](https://github.com/webtorrent/parse-torrent/issues/144)) ([6df9d6e](https://github.com/webtorrent/parse-torrent/commit/6df9d6ec56fc3e82c87aa3690ee5fccc8d79c3d8))
- **deps:** update webtorrent ([#142](https://github.com/webtorrent/parse-torrent/issues/142)) ([6f865fe](https://github.com/webtorrent/parse-torrent/commit/6f865fe41386c9870fdaad57880d4bb82b4bc779)), closes [#145](https://github.com/webtorrent/parse-torrent/issues/145)

## [11.0.6](https://github.com/webtorrent/parse-torrent/compare/v11.0.5...v11.0.6) (2023-01-31)

### Bug Fixes

- **deps:** update dependency uint8-util to ^2.1.7 ([#143](https://github.com/webtorrent/parse-torrent/issues/143)) ([bfa0190](https://github.com/webtorrent/parse-torrent/commit/bfa019012a5c294de2760564f10e4407eebf5bcc))

## [11.0.5](https://github.com/webtorrent/parse-torrent/compare/v11.0.4...v11.0.5) (2023-01-31)

### Bug Fixes

- fs polyfill ([#140](https://github.com/webtorrent/parse-torrent/issues/140)) ([a39ed02](https://github.com/webtorrent/parse-torrent/commit/a39ed029c087a40be44c0de2b92e8dcca07cadf7))

## [11.0.4](https://github.com/webtorrent/parse-torrent/compare/v11.0.3...v11.0.4) (2023-01-27)

### Bug Fixes

- ESM imports ([#139](https://github.com/webtorrent/parse-torrent/issues/139)) ([fc29cd8](https://github.com/webtorrent/parse-torrent/commit/fc29cd8099f051753c503d90e3abc7ceed91150a))

## [11.0.3](https://github.com/webtorrent/parse-torrent/compare/v11.0.2...v11.0.3) (2023-01-26)

### Bug Fixes

- move global to package.json ([#138](https://github.com/webtorrent/parse-torrent/issues/138)) ([1112d2a](https://github.com/webtorrent/parse-torrent/commit/1112d2a8423972f727dac91e0dfe7806c8ac8a1c))

## [11.0.2](https://github.com/webtorrent/parse-torrent/compare/v11.0.1...v11.0.2) (2023-01-26)

### Bug Fixes

- **deps:** update dependency uint8-util to ^2.1.5 ([#135](https://github.com/webtorrent/parse-torrent/issues/135)) ([a2d03c5](https://github.com/webtorrent/parse-torrent/commit/a2d03c553e1ff332574a8b938988b597fab32ad9))

## [11.0.1](https://github.com/webtorrent/parse-torrent/compare/v11.0.0...v11.0.1) (2023-01-25)

### Performance Improvements

- drop simple-get ([#131](https://github.com/webtorrent/parse-torrent/issues/131)) ([0176518](https://github.com/webtorrent/parse-torrent/commit/01765183c3a032d503c5258467f0ff09587df9fc))

# [11.0.0](https://github.com/webtorrent/parse-torrent/compare/v10.0.2...v11.0.0) (2023-01-25)

### Bug Fixes

- **deps:** update dependency bencode to v3 ([#122](https://github.com/webtorrent/parse-torrent/issues/122)) ([2bfae53](https://github.com/webtorrent/parse-torrent/commit/2bfae532e57f83c3babd80d0564f48af8d28292f))
- **deps:** update dependency get-stdin to v9 ([#93](https://github.com/webtorrent/parse-torrent/issues/93)) ([e36a99e](https://github.com/webtorrent/parse-torrent/commit/e36a99e3d4176a37956f41c873c701f4fd0cc570))
- **deps:** update dependency uint8-util to ^2.1.4 ([#129](https://github.com/webtorrent/parse-torrent/issues/129)) ([35ede29](https://github.com/webtorrent/parse-torrent/commit/35ede29dc83651fd59d8d752106938d19874e295))
- drop rusha ([#117](https://github.com/webtorrent/parse-torrent/issues/117)) ([0d3be61](https://github.com/webtorrent/parse-torrent/commit/0d3be61f453d79ab5ba7751bd30e460ccea2f69b))
- release config ([#134](https://github.com/webtorrent/parse-torrent/issues/134)) ([ec9bf75](https://github.com/webtorrent/parse-torrent/commit/ec9bf750b4a44bd20d5fcb1fec3218c54fa57f7c))

### BREAKING CHANGES

- perf: drop rusha, buffer

- fix: error throw tests

## [10.0.2](https://github.com/webtorrent/parse-torrent/compare/v10.0.1...v10.0.2) (2023-01-11)

## [10.0.1](https://github.com/webtorrent/parse-torrent/compare/v10.0.0...v10.0.1) (2022-12-04)

### Bug Fixes

- cli ([#124](https://github.com/webtorrent/parse-torrent/issues/124)) ([b67d213](https://github.com/webtorrent/parse-torrent/commit/b67d213a66fbd526bc961488af8b2bf65d08a108))

# [10.0.0](https://github.com/webtorrent/parse-torrent/compare/v9.1.5...v10.0.0) (2022-11-28)

### Features

- esm ([#118](https://github.com/webtorrent/parse-torrent/issues/118)) ([51551a5](https://github.com/webtorrent/parse-torrent/commit/51551a5d7d464df7d8c81cc70c97648d5d2ddefb))

### BREAKING CHANGES

- ESM only

## [9.1.5](https://github.com/webtorrent/parse-torrent/compare/v9.1.4...v9.1.5) (2022-03-26)

### Bug Fixes

- **deps:** update dependency simple-get to ^4.0.1 ([7860eda](https://github.com/webtorrent/parse-torrent/commit/7860edad8bb5dd9ba2cc7135452aea173f70ccc1))

## [9.1.4](https://github.com/webtorrent/parse-torrent/compare/v9.1.3...v9.1.4) (2021-08-04)

### Bug Fixes

- **deps:** update dependency bencode to ^2.0.2 ([#98](https://github.com/webtorrent/parse-torrent/issues/98)) ([38d9dc3](https://github.com/webtorrent/parse-torrent/commit/38d9dc33b74f9f320e01ea52cb4a2796625617cc))
- **deps:** update webtorrent ([f5e7992](https://github.com/webtorrent/parse-torrent/commit/f5e79929eb0b5f397fe4a4e5e3ee5b54285211fb))
