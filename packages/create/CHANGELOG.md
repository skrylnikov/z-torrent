# [6.1.0](https://github.com/webtorrent/create-torrent/compare/v6.0.18...v6.1.0) (2025-01-04)

## 0.0.7

### Patch Changes

- [#14](https://github.com/skrylnikov/z-torrent/pull/14) [`8f99be2`](https://github.com/skrylnikov/z-torrent/commit/8f99be201a66830089f502ef2746bbd160d6907b) Thanks [@skrylnikov](https://github.com/skrylnikov)! - Build hybrid and v2 torrent metadata (BEP 52). Update README.

- Updated dependencies [[`8f99be2`](https://github.com/skrylnikov/z-torrent/commit/8f99be201a66830089f502ef2746bbd160d6907b)]:
  - @z-torrent/merkle-tree@0.0.7
  - @z-torrent/utils@0.0.7

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

- Updated dependencies []:
  - @z-torrent/utils@0.0.6

## 0.0.5

### Patch Changes

- [#7](https://github.com/skrylnikov/z-torrent/pull/7) [`2973e65`](https://github.com/skrylnikov/z-torrent/commit/2973e650b85b72725386a83ac5331f8d429e4117) Thanks [@skrylnikov](https://github.com/skrylnikov)! - fix release workflow

- Updated dependencies [[`2973e65`](https://github.com/skrylnikov/z-torrent/commit/2973e650b85b72725386a83ac5331f8d429e4117)]:
  - @z-torrent/utils@0.0.5

## 0.0.4

### Patch Changes

- [#5](https://github.com/skrylnikov/z-torrent/pull/5) [`e0e83e3`](https://github.com/skrylnikov/z-torrent/commit/e0e83e3eb2155e440a12ae9cf80b350c08a5a231) Thanks [@skrylnikov](https://github.com/skrylnikov)! - fix release workflow

- Updated dependencies [[`e0e83e3`](https://github.com/skrylnikov/z-torrent/commit/e0e83e3eb2155e440a12ae9cf80b350c08a5a231)]:
  - @z-torrent/utils@0.0.4

## 0.0.3

### Patch Changes

- [#3](https://github.com/skrylnikov/z-torrent/pull/3) [`9ac5074`](https://github.com/skrylnikov/z-torrent/commit/9ac5074d5623ee527225f0ec96cd1f4a20d32d9c) Thanks [@skrylnikov](https://github.com/skrylnikov)! - fix deploy to npm

- Updated dependencies [[`9ac5074`](https://github.com/skrylnikov/z-torrent/commit/9ac5074d5623ee527225f0ec96cd1f4a20d32d9c)]:
  - @z-torrent/utils@0.0.3

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
  - @z-torrent/utils@0.0.2

### Features

- add maxPieceLength option ([#267](https://github.com/webtorrent/create-torrent/issues/267)) ([1264106](https://github.com/webtorrent/create-torrent/commit/1264106b627fad90faedddb4daec27feb52c138d)), closes [#266](https://github.com/webtorrent/create-torrent/issues/266)

## [6.0.18](https://github.com/webtorrent/create-torrent/compare/v6.0.17...v6.0.18) (2024-07-08)

### Bug Fixes

- **deps:** update dependency uint8-util to ^2.2.5 ([#259](https://github.com/webtorrent/create-torrent/issues/259)) ([6167075](https://github.com/webtorrent/create-torrent/commit/61670751367a9cbd4fd8f013cac22391e2dc2337))

## [6.0.17](https://github.com/webtorrent/create-torrent/compare/v6.0.16...v6.0.17) (2024-02-09)

### Bug Fixes

- **deps:** update dependency uint8-util to ^2.2.4 ([#257](https://github.com/webtorrent/create-torrent/issues/257)) ([87c3a33](https://github.com/webtorrent/create-torrent/commit/87c3a337d7d31e51c99c27d3d1bcf22558f24f82))

## [6.0.16](https://github.com/webtorrent/create-torrent/compare/v6.0.15...v6.0.16) (2023-12-12)

### Bug Fixes

- **deps:** update dependency fast-readable-async-iterator to v2 ([#251](https://github.com/webtorrent/create-torrent/issues/251)) ([a566cfb](https://github.com/webtorrent/create-torrent/commit/a566cfb8cf3222d5204ec033c9dbf581aa0e96e4))

## [6.0.15](https://github.com/webtorrent/create-torrent/compare/v6.0.14...v6.0.15) (2023-08-11)

### Bug Fixes

- **deps:** update dependency uint8-util to ^2.2.2 ([#233](https://github.com/webtorrent/create-torrent/issues/233)) ([1c15ac5](https://github.com/webtorrent/create-torrent/commit/1c15ac5da79ba368616259c54ee27e82419b7b61))

## [6.0.14](https://github.com/webtorrent/create-torrent/compare/v6.0.13...v6.0.14) (2023-08-10)

### Bug Fixes

- **deps:** update dependency bencode to v4 ([#236](https://github.com/webtorrent/create-torrent/issues/236)) ([edef6b9](https://github.com/webtorrent/create-torrent/commit/edef6b9c39afbb56dc5f7905af59514d70e7087c))

## [6.0.13](https://github.com/webtorrent/create-torrent/compare/v6.0.12...v6.0.13) (2023-07-31)

### Bug Fixes

- **deps:** update dependency bencode to ^3.1.1 ([b7b1bab](https://github.com/webtorrent/create-torrent/commit/b7b1bab47b0b550a5c320ac2f2374bb85f215aee))

## [6.0.12](https://github.com/webtorrent/create-torrent/compare/v6.0.11...v6.0.12) (2023-07-23)

### Bug Fixes

- **deps:** update dependency junk to v4 ([#231](https://github.com/webtorrent/create-torrent/issues/231)) ([6a89a3a](https://github.com/webtorrent/create-torrent/commit/6a89a3ad68374c865772dbc22ea4b8c5557ba94e))

## [6.0.11](https://github.com/webtorrent/create-torrent/compare/v6.0.10...v6.0.11) (2023-04-02)

### Bug Fixes

- **deps:** update dependency minimist to ^1.2.8 ([#212](https://github.com/webtorrent/create-torrent/issues/212)) ([7721d1e](https://github.com/webtorrent/create-torrent/commit/7721d1e466818cfed75b4d9e155a71fa9f33bb11))
- **deps:** update dependency uint8-util to ^2.1.9 ([#211](https://github.com/webtorrent/create-torrent/issues/211)) ([9bf6749](https://github.com/webtorrent/create-torrent/commit/9bf674978b01000287cd5206bf633b2700461bae))

## [6.0.10](https://github.com/webtorrent/create-torrent/compare/v6.0.9...v6.0.10) (2023-02-22)

### Bug Fixes

- add once dependency ([#214](https://github.com/webtorrent/create-torrent/issues/214)) ([75822e9](https://github.com/webtorrent/create-torrent/commit/75822e9a94a0977acca4699b4ff71545d959e26f))

## [6.0.9](https://github.com/webtorrent/create-torrent/compare/v6.0.8...v6.0.9) (2023-01-31)

### Bug Fixes

- **deps:** update webtorrent ([#208](https://github.com/webtorrent/create-torrent/issues/208)) ([4cf1295](https://github.com/webtorrent/create-torrent/commit/4cf1295e0465234a0117a4a3bc78b75c3f36c5ec)), closes [#209](https://github.com/webtorrent/create-torrent/issues/209)

## [6.0.8](https://github.com/webtorrent/create-torrent/compare/v6.0.7...v6.0.8) (2023-01-31)

### Bug Fixes

- **deps:** update dependency uint8-util to ^2.1.7 ([#205](https://github.com/webtorrent/create-torrent/issues/205)) ([29996f4](https://github.com/webtorrent/create-torrent/commit/29996f4acb10a92f0c91d5fefdf873c9f1aa3bc3))

## [6.0.7](https://github.com/webtorrent/create-torrent/compare/v6.0.6...v6.0.7) (2023-01-31)

### Bug Fixes

- **deps:** update webtorrent ([db3e86f](https://github.com/webtorrent/create-torrent/commit/db3e86f29fe6cbc2ce18c3d7e14e974c35a2826c))

## [6.0.6](https://github.com/webtorrent/create-torrent/compare/v6.0.5...v6.0.6) (2023-01-26)

### Performance Improvements

- drop buffer ([#201](https://github.com/webtorrent/create-torrent/issues/201)) ([2e030c7](https://github.com/webtorrent/create-torrent/commit/2e030c7358d17fd679d427f39b55152a2c7f826f))

## [6.0.5](https://github.com/webtorrent/create-torrent/compare/v6.0.4...v6.0.5) (2023-01-26)

### Bug Fixes

- **deps:** update dependency uint8-util to ^2.1.5 ([#198](https://github.com/webtorrent/create-torrent/issues/198)) ([e710d84](https://github.com/webtorrent/create-torrent/commit/e710d84a1fc887ff50e4be949f0ca528c7bf01c2))

## [6.0.4](https://github.com/webtorrent/create-torrent/compare/v6.0.3...v6.0.4) (2023-01-25)

### Bug Fixes

- **deps:** update dependency uint8-util to v2 ([#192](https://github.com/webtorrent/create-torrent/issues/192)) ([a88e7d1](https://github.com/webtorrent/create-torrent/commit/a88e7d131c8fbbf43b04420594022b0055fd275e)), closes [#197](https://github.com/webtorrent/create-torrent/issues/197)

## [6.0.3](https://github.com/webtorrent/create-torrent/compare/v6.0.2...v6.0.3) (2023-01-25)

### Bug Fixes

- **deps:** update dependency bencode to v3 ([#189](https://github.com/webtorrent/create-torrent/issues/189)) ([cdddf06](https://github.com/webtorrent/create-torrent/commit/cdddf0648afb12ad6ace11b16924c3b6400e21fc))

## [6.0.2](https://github.com/webtorrent/create-torrent/compare/v6.0.1...v6.0.2) (2022-12-03)

### Bug Fixes

- drop rusha ([#184](https://github.com/webtorrent/create-torrent/issues/184)) ([9fcc2e9](https://github.com/webtorrent/create-torrent/commit/9fcc2e97c99bcd5f23e857f855630a759802bcf6))

## [6.0.1](https://github.com/webtorrent/create-torrent/compare/v6.0.0...v6.0.1) (2022-11-28)

### Bug Fixes

- **deps:** update dependency block-iterator to ^1.1.1 ([#188](https://github.com/webtorrent/create-torrent/issues/188)) ([a51b07c](https://github.com/webtorrent/create-torrent/commit/a51b07cc10b2bac96b985a0d5aee7bceae6505d4))

# [6.0.0](https://github.com/webtorrent/create-torrent/compare/v5.0.9...v6.0.0) (2022-11-25)

### Features

- esm ([#187](https://github.com/webtorrent/create-torrent/issues/187)) ([0a3cb58](https://github.com/webtorrent/create-torrent/commit/0a3cb5886ff4403e8b1c27ede6932a2b21b8ac36))

### BREAKING CHANGES

- ESM only

- feat: esm

- fix: regex artifacts

## [5.0.9](https://github.com/webtorrent/create-torrent/compare/v5.0.8...v5.0.9) (2022-11-10)

### Bug Fixes

- hash faster than callback ([#186](https://github.com/webtorrent/create-torrent/issues/186)) ([298f356](https://github.com/webtorrent/create-torrent/commit/298f356c9ba7832c22eee954025ab50bf29dc922))

## [5.0.8](https://github.com/webtorrent/create-torrent/compare/v5.0.7...v5.0.8) (2022-11-10)

### Bug Fixes

- **deps:** update dependency minimist to ^1.2.7 ([#162](https://github.com/webtorrent/create-torrent/issues/162)) ([b81eb98](https://github.com/webtorrent/create-torrent/commit/b81eb98b3a0b0358c40cac387a3a324ae0b4616a))

## [5.0.7](https://github.com/webtorrent/create-torrent/compare/v5.0.6...v5.0.7) (2022-11-10)

### Bug Fixes

- drop block-stream, drop streamx ([#185](https://github.com/webtorrent/create-torrent/issues/185)) ([4e0669c](https://github.com/webtorrent/create-torrent/commit/4e0669c3b2f92a4c0d115bcb6b01c26a21f9dbd6))

## [5.0.6](https://github.com/webtorrent/create-torrent/compare/v5.0.5...v5.0.6) (2022-09-02)

### Bug Fixes

- drop multi-stream ([#174](https://github.com/webtorrent/create-torrent/issues/174)) ([284f260](https://github.com/webtorrent/create-torrent/commit/284f2601e26f35c910e33de7c666bf5010b8dae3))

## [5.0.5](https://github.com/webtorrent/create-torrent/compare/v5.0.4...v5.0.5) (2022-09-02)

### Bug Fixes

- **deps:** update dependency fast-blob-stream to ^1.1.1 ([#175](https://github.com/webtorrent/create-torrent/issues/175)) ([d5cb6f3](https://github.com/webtorrent/create-torrent/commit/d5cb6f3cda1ef94f29583ad1a44280339d7fb15f))
- migrate to streamx ([#173](https://github.com/webtorrent/create-torrent/issues/173)) ([40a0f50](https://github.com/webtorrent/create-torrent/commit/40a0f50ec4829a7d047b36f79c79ccf3885b511e))

## [5.0.4](https://github.com/webtorrent/create-torrent/compare/v5.0.3...v5.0.4) (2022-07-03)

### Bug Fixes

- replace filestream with fast-blob-stream ([#171](https://github.com/webtorrent/create-torrent/issues/171)) ([d93a718](https://github.com/webtorrent/create-torrent/commit/d93a7181add5a8ac3fbd4b6bec92ad61f6b235cc))

## [5.0.3](https://github.com/webtorrent/create-torrent/compare/v5.0.2...v5.0.3) (2022-07-03)

### Bug Fixes

- **deps:** update webtorrent ([#163](https://github.com/webtorrent/create-torrent/issues/163)) ([7f1fb98](https://github.com/webtorrent/create-torrent/commit/7f1fb980feddc9005bd5983ae893f47ebc12ede8))

## [5.0.2](https://github.com/webtorrent/create-torrent/compare/v5.0.1...v5.0.2) (2022-03-10)

### Bug Fixes

- exception on folder depth > 1 ([#160](https://github.com/webtorrent/create-torrent/issues/160)) ([4afcea2](https://github.com/webtorrent/create-torrent/commit/4afcea2360284ce9d0762ed66507ae22b1b32b04))

## [5.0.1](https://github.com/webtorrent/create-torrent/compare/v5.0.0...v5.0.1) (2021-08-06)

### Bug Fixes

- remove flat pollyfill in get-files ([2dbd091](https://github.com/webtorrent/create-torrent/commit/2dbd09164d6df6170edcd0afb2f1921f29d5536f))

# [5.0.0](https://github.com/webtorrent/create-torrent/compare/v4.7.2...v5.0.0) (2021-08-05)

### Bug Fixes

- Remove flat util fn ([#136](https://github.com/webtorrent/create-torrent/issues/136)) ([de7e8a9](https://github.com/webtorrent/create-torrent/commit/de7e8a9d69d367444d815b7c9aae3491e7a1392e))

### BREAKING CHANGES

- Node 12+ supported

## [4.7.2](https://github.com/webtorrent/create-torrent/compare/v4.7.1...v4.7.2) (2021-08-04)

### Bug Fixes

- **deps:** update dependency bencode to ^2.0.2 ([#143](https://github.com/webtorrent/create-torrent/issues/143)) ([654a814](https://github.com/webtorrent/create-torrent/commit/654a8145a0ff31e200d6f6cb04d3c620faaacfc8))

## [4.7.1](https://github.com/webtorrent/create-torrent/compare/v4.7.0...v4.7.1) (2021-07-22)

### Bug Fixes

- **deps:** update dependency multistream to ^4.1.0 ([cbdc633](https://github.com/webtorrent/create-torrent/commit/cbdc633cd4cfc8a2389ccea884765fc3e219ad72))
- **deps:** update dependency run-parallel to ^1.2.0 ([ad58e7f](https://github.com/webtorrent/create-torrent/commit/ad58e7f67803fbeafdd433eac9be40fc31920347))
