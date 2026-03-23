## [4.1.21](https://github.com/webtorrent/bittorrent-protocol/compare/v4.1.20...v4.1.21) (2025-09-14)

## 0.0.13

## 0.0.12

## 0.0.11

## 0.0.10

### Patch Changes

- [`f50e9c1`](https://github.com/skrylnikov/z-torrent/commit/f50e9c1961d06ff0cbf1ab9d9a6d6b4809e7d75d) Thanks [@skrylnikov](https://github.com/skrylnikov)! - fix publish

## 0.0.9

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

- [#16](https://github.com/skrylnikov/z-torrent/pull/16) [`26ef5a0`](https://github.com/skrylnikov/z-torrent/commit/26ef5a081869b1130406a730db5ec088841aa06c) Thanks [@skrylnikov](https://github.com/skrylnikov)! - **Debug namespaces**
  - All `debug` logger namespaces now use `@z-torrent/<package>:<scope>` (aligned with workspace package names).
  - **Breaking for debugging only:** previous `DEBUG` values (`webtorrent*`, `bittorrent-*`, `torrent-discovery`, `ut_metadata`, etc.) no longer match. Use e.g. `DEBUG=@z-torrent/core:*`, `DEBUG=@z-torrent/protocol:wire`, or `DEBUG=@z-torrent/*`.

  **Docs**
  - Root [README.md](README.md) and [AGENTS.md](AGENTS.md) updated with the new convention and examples.

## 0.0.7

### Patch Changes

- [#14](https://github.com/skrylnikov/z-torrent/pull/14) [`8f99be2`](https://github.com/skrylnikov/z-torrent/commit/8f99be201a66830089f502ef2746bbd160d6907b) Thanks [@skrylnikov](https://github.com/skrylnikov)! - Add BitTorrent v2 (BEP 52) on the wire: handshake reserved-byte v2 bit (`0x10`), hash request / hashes messages and payloads. Update README.

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

## 0.0.5

### Patch Changes

- [#7](https://github.com/skrylnikov/z-torrent/pull/7) [`2973e65`](https://github.com/skrylnikov/z-torrent/commit/2973e650b85b72725386a83ac5331f8d429e4117) Thanks [@skrylnikov](https://github.com/skrylnikov)! - fix release workflow

## 0.0.4

### Patch Changes

- [#5](https://github.com/skrylnikov/z-torrent/pull/5) [`e0e83e3`](https://github.com/skrylnikov/z-torrent/commit/e0e83e3eb2155e440a12ae9cf80b350c08a5a231) Thanks [@skrylnikov](https://github.com/skrylnikov)! - fix release workflow

## 0.0.3

### Patch Changes

- [#3](https://github.com/skrylnikov/z-torrent/pull/3) [`9ac5074`](https://github.com/skrylnikov/z-torrent/commit/9ac5074d5623ee527225f0ec96cd1f4a20d32d9c) Thanks [@skrylnikov](https://github.com/skrylnikov)! - fix deploy to npm

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

### Bug Fixes

- **deps:** update dependency debug to ^4.4.3 ([#163](https://github.com/webtorrent/bittorrent-protocol/issues/163)) ([be2f398](https://github.com/webtorrent/bittorrent-protocol/commit/be2f39875d43bd39476ca69834c8f49e9b749cb1))

## [4.1.20](https://github.com/webtorrent/bittorrent-protocol/compare/v4.1.19...v4.1.20) (2025-08-05)

### Bug Fixes

- **deps:** update dependency throughput to ^1.0.2 ([#157](https://github.com/webtorrent/bittorrent-protocol/issues/157)) ([f4a89cd](https://github.com/webtorrent/bittorrent-protocol/commit/f4a89cd1b4113f61c25ae15a91f9b52e17b9c633))

## [4.1.19](https://github.com/webtorrent/bittorrent-protocol/compare/v4.1.18...v4.1.19) (2025-08-03)

### Bug Fixes

- **perf:** dont use dataview, dont use slice ([#156](https://github.com/webtorrent/bittorrent-protocol/issues/156)) ([caa19f2](https://github.com/webtorrent/bittorrent-protocol/commit/caa19f20a3de3f7e72641fba40c6e660afc2eedc))

## [4.1.18](https://github.com/webtorrent/bittorrent-protocol/compare/v4.1.17...v4.1.18) (2025-06-28)

### Bug Fixes

- **deps:** update dependency streamx to ^2.22.1 ([#140](https://github.com/webtorrent/bittorrent-protocol/issues/140)) ([8d8e233](https://github.com/webtorrent/bittorrent-protocol/commit/8d8e23332ba627844c691c3934f11a9cb91c0637))

## [4.1.17](https://github.com/webtorrent/bittorrent-protocol/compare/v4.1.16...v4.1.17) (2025-06-28)

### Bug Fixes

- **deps:** update dependency bitfield to ^4.2.0 ([#141](https://github.com/webtorrent/bittorrent-protocol/issues/141)) ([e0c4051](https://github.com/webtorrent/bittorrent-protocol/commit/e0c4051d4eca7b606d136d9ed1a177e04f3dd428))
- **deps:** update dependency debug to ^4.4.1 ([#154](https://github.com/webtorrent/bittorrent-protocol/issues/154)) ([230c240](https://github.com/webtorrent/bittorrent-protocol/commit/230c2401823847fca26d89fe2394039d552a2c8b))
- PE/MSE encryption ([#155](https://github.com/webtorrent/bittorrent-protocol/issues/155)) ([4c252dc](https://github.com/webtorrent/bittorrent-protocol/commit/4c252dc39ef8355e478f32b59b51d999cfb1e2b9))

## [4.1.16](https://github.com/webtorrent/bittorrent-protocol/compare/v4.1.15...v4.1.16) (2024-12-07)

### Bug Fixes

- **deps:** update dependency debug to ^4.4.0 ([#153](https://github.com/webtorrent/bittorrent-protocol/issues/153)) ([efd2b2a](https://github.com/webtorrent/bittorrent-protocol/commit/efd2b2ab5abeaf694f4ffee763eb5be8c1cd8183))

## [4.1.15](https://github.com/webtorrent/bittorrent-protocol/compare/v4.1.14...v4.1.15) (2024-09-07)

### Bug Fixes

- **deps:** update dependency debug to ^4.3.7 ([f89b4f0](https://github.com/webtorrent/bittorrent-protocol/commit/f89b4f0daca13fe1e1d714a17a0c783902c6974d))

## [4.1.14](https://github.com/webtorrent/bittorrent-protocol/compare/v4.1.13...v4.1.14) (2024-07-28)

### Bug Fixes

- **deps:** update dependency debug to ^4.3.6 ([2649fd8](https://github.com/webtorrent/bittorrent-protocol/commit/2649fd86024f59faed8d6b15b68e13adb2f3028b))

## [4.1.13](https://github.com/webtorrent/bittorrent-protocol/compare/v4.1.12...v4.1.13) (2024-06-28)

### Bug Fixes

- **deps:** update dependency uint8-util to ^2.2.5 ([#130](https://github.com/webtorrent/bittorrent-protocol/issues/130)) ([f92477c](https://github.com/webtorrent/bittorrent-protocol/commit/f92477c94dbaa3566e15d7eca7728f5062017031))

## [4.1.12](https://github.com/webtorrent/bittorrent-protocol/compare/v4.1.11...v4.1.12) (2024-06-01)

### Bug Fixes

- **deps:** update dependency debug to ^4.3.5 ([38c6c8a](https://github.com/webtorrent/bittorrent-protocol/commit/38c6c8a7b7c1a37a38f57e7f6a0915b58cdb204b))

## [4.1.11](https://github.com/webtorrent/bittorrent-protocol/compare/v4.1.10...v4.1.11) (2023-08-11)

### Bug Fixes

- **deps:** update dependency streamx to ^2.15.1 ([#126](https://github.com/webtorrent/bittorrent-protocol/issues/126)) ([b138d12](https://github.com/webtorrent/bittorrent-protocol/commit/b138d1248f861ca88e812201e261a2ba744f98af))
- **deps:** update dependency uint8-util to ^2.2.2 ([#124](https://github.com/webtorrent/bittorrent-protocol/issues/124)) ([3ff2481](https://github.com/webtorrent/bittorrent-protocol/commit/3ff24811f9063da9a47cccbd06c3e013804025a9))

## [4.1.10](https://github.com/webtorrent/bittorrent-protocol/compare/v4.1.9...v4.1.10) (2023-08-10)

### Bug Fixes

- **deps:** update dependency bencode to v4 ([#127](https://github.com/webtorrent/bittorrent-protocol/issues/127)) ([66aecc3](https://github.com/webtorrent/bittorrent-protocol/commit/66aecc36daff3783ad0ce2c3faed8cfe79a58482))

## [4.1.9](https://github.com/webtorrent/bittorrent-protocol/compare/v4.1.8...v4.1.9) (2023-07-31)

### Bug Fixes

- **deps:** update dependency bencode to ^3.1.1 ([d53dc2f](https://github.com/webtorrent/bittorrent-protocol/commit/d53dc2fc335d47838aa9e432667f7c0b0f53d62d))

## [4.1.8](https://github.com/webtorrent/bittorrent-protocol/compare/v4.1.7...v4.1.8) (2023-07-23)

### Bug Fixes

- **deps:** update dependency streamx to ^2.15.0 ([#118](https://github.com/webtorrent/bittorrent-protocol/issues/118)) ([e23925c](https://github.com/webtorrent/bittorrent-protocol/commit/e23925c9b615724c3db816aee6effb626ea01bf6))

## [4.1.7](https://github.com/webtorrent/bittorrent-protocol/compare/v4.1.6...v4.1.7) (2023-05-30)

### Bug Fixes

- **deps:** update dependency streamx to ^2.13.2 ([#117](https://github.com/webtorrent/bittorrent-protocol/issues/117)) ([c09a7f6](https://github.com/webtorrent/bittorrent-protocol/commit/c09a7f6b6a61cc979f09934712eafdb4f4019edd))
- **deps:** update dependency uint8-util to ^2.1.9 ([#110](https://github.com/webtorrent/bittorrent-protocol/issues/110)) ([9d3733c](https://github.com/webtorrent/bittorrent-protocol/commit/9d3733c329f3d3bbf3e957335bae0c24ae88b49f))
- migrate to streamx ([#96](https://github.com/webtorrent/bittorrent-protocol/issues/96)) ([9b77f6c](https://github.com/webtorrent/bittorrent-protocol/commit/9b77f6c1f5c27092e4e656fc448e79f295b9cb30))

## [4.1.6](https://github.com/webtorrent/bittorrent-protocol/compare/v4.1.5...v4.1.6) (2023-01-31)

### Bug Fixes

- **deps:** update dependency uint8-util to ^2.1.7 ([#106](https://github.com/webtorrent/bittorrent-protocol/issues/106)) ([78b0f4a](https://github.com/webtorrent/bittorrent-protocol/commit/78b0f4af8753bba4bb46cf812c96f2c2bd013365))

## [4.1.5](https://github.com/webtorrent/bittorrent-protocol/compare/v4.1.4...v4.1.5) (2023-01-31)

### Bug Fixes

- **deps:** update dependency bencode to ^3.0.3 ([#108](https://github.com/webtorrent/bittorrent-protocol/issues/108)) ([580a15c](https://github.com/webtorrent/bittorrent-protocol/commit/580a15c1a53f9f7b3e8f9a04e3e176072d549323)), closes [#109](https://github.com/webtorrent/bittorrent-protocol/issues/109)

## [4.1.4](https://github.com/webtorrent/bittorrent-protocol/compare/v4.1.3...v4.1.4) (2023-01-31)

### Bug Fixes

- **deps:** update dependency bencode to ^3.0.2 ([f1582e5](https://github.com/webtorrent/bittorrent-protocol/commit/f1582e56c342e4a75c9ba134b3ecd53affaab77b))

## [4.1.3](https://github.com/webtorrent/bittorrent-protocol/compare/v4.1.2...v4.1.3) (2023-01-26)

### Bug Fixes

- **deps:** update dependency uint8-util to ^2.1.5 ([#105](https://github.com/webtorrent/bittorrent-protocol/issues/105)) ([d16dbdd](https://github.com/webtorrent/bittorrent-protocol/commit/d16dbdd5536e61e5d2cd045286e44fbcdd9064e2))

## [4.1.2](https://github.com/webtorrent/bittorrent-protocol/compare/v4.1.1...v4.1.2) (2023-01-25)

### Bug Fixes

- **deps:** update dependency uint8-util to ^2.1.4 ([#100](https://github.com/webtorrent/bittorrent-protocol/issues/100)) ([b77b355](https://github.com/webtorrent/bittorrent-protocol/commit/b77b3555a4dc98dc41025d35420a0f0661cf574c))

## [4.1.1](https://github.com/webtorrent/bittorrent-protocol/compare/v4.1.0...v4.1.1) (2023-01-25)

### Bug Fixes

- **deps:** update dependency bencode to v3 ([#101](https://github.com/webtorrent/bittorrent-protocol/issues/101)) ([32e02d1](https://github.com/webtorrent/bittorrent-protocol/commit/32e02d14b533c77891b429a1d52135ade47dada8))

# [4.1.0](https://github.com/webtorrent/bittorrent-protocol/compare/v4.0.1...v4.1.0) (2022-12-15)

### Features

- use uint8 instead of buffer ([#99](https://github.com/webtorrent/bittorrent-protocol/issues/99)) ([ad7de65](https://github.com/webtorrent/bittorrent-protocol/commit/ad7de65366fb5c89813a18356422f365bec0da50))

## [4.0.1](https://github.com/webtorrent/bittorrent-protocol/compare/v4.0.0...v4.0.1) (2022-05-14)

### Bug Fixes

- replace speedometer with throughput ([#92](https://github.com/webtorrent/bittorrent-protocol/issues/92)) ([642ac8e](https://github.com/webtorrent/bittorrent-protocol/commit/642ac8e5e2823a7bf3be740246f9f15cf13f17d2))

# [4.0.0](https://github.com/webtorrent/bittorrent-protocol/compare/v3.5.4...v4.0.0) (2022-04-28)

### chore

- release 4 ([08f56ec](https://github.com/webtorrent/bittorrent-protocol/commit/08f56ec8323a4a51922192b98da2c76bb041f0c8))

### BREAKING CHANGES

- ESM only

## [3.5.4](https://github.com/webtorrent/bittorrent-protocol/compare/v3.5.3...v3.5.4) (2022-04-28)

### Code Refactoring

- switch to ESM ([#90](https://github.com/webtorrent/bittorrent-protocol/issues/90)) ([fce2548](https://github.com/webtorrent/bittorrent-protocol/commit/fce254818590b307afb45a3fdaa8e4dc904305ce))

### BREAKING CHANGES

- ESM only

- chore: update imports and export index.js

esm import/export syntax
Signed-off-by: Lakshya Singh <lakshay.singh1108@gmail.com>

- chore: update imports in tests

esm import syntax with path
Signed-off-by: Lakshya Singh <lakshay.singh1108@gmail.com>

- chore: bump bitfield for esm

  4.1.0 is esm based while 4.0.0 was commonjs
  Signed-off-by: Lakshya Singh <lakshay.singh1108@gmail.com>

- chore: update package.json for esm

specify minimum nodejs version for esm support
exports defined
type change to module
Signed-off-by: Lakshya Singh <lakshay.singh1108@gmail.com>

- chore: update readme with esm syntax

Signed-off-by: Lakshya Singh <lakshay.singh1108@gmail.com>

## [3.5.3](https://github.com/webtorrent/bittorrent-protocol/compare/v3.5.2...v3.5.3) (2022-04-22)

### Bug Fixes

- infinite loop when an allowed-fast request is pending on choke ([#88](https://github.com/webtorrent/bittorrent-protocol/issues/88)) ([a3d28da](https://github.com/webtorrent/bittorrent-protocol/commit/a3d28dac8bcf05af5dd12fe82dfbc7abeed4c55a))

## [3.5.2](https://github.com/webtorrent/bittorrent-protocol/compare/v3.5.1...v3.5.2) (2022-03-27)

### Bug Fixes

- **deps:** update dependency debug to ^4.3.4 ([#85](https://github.com/webtorrent/bittorrent-protocol/issues/85)) ([117ecf3](https://github.com/webtorrent/bittorrent-protocol/commit/117ecf325714142f7643d8cedf434bc58faabb96))

## [3.5.1](https://github.com/webtorrent/bittorrent-protocol/compare/v3.5.0...v3.5.1) (2022-01-20)

### Bug Fixes

- reject on error and activation guards for Fast Extension ([#79](https://github.com/webtorrent/bittorrent-protocol/issues/79)) ([d59075b](https://github.com/webtorrent/bittorrent-protocol/commit/d59075bbb13a3c1ef6baaa64601bf8d2f950bbc2))

# [3.5.0](https://github.com/webtorrent/bittorrent-protocol/compare/v3.4.5...v3.5.0) (2022-01-17)

### Features

- add BEP6 Fast Extension messages ([#75](https://github.com/webtorrent/bittorrent-protocol/issues/75)) ([319136d](https://github.com/webtorrent/bittorrent-protocol/commit/319136d7146135abfb25deade4ae5693d309e79f))

## [3.4.5](https://github.com/webtorrent/bittorrent-protocol/compare/v3.4.4...v3.4.5) (2022-01-17)

### Bug Fixes

- return `this` from `destroy` and `end` ([#74](https://github.com/webtorrent/bittorrent-protocol/issues/74)) ([cba86e5](https://github.com/webtorrent/bittorrent-protocol/commit/cba86e5aff9492b45279cd6ded77e1af3db2c6b5))

## [3.4.4](https://github.com/webtorrent/bittorrent-protocol/compare/v3.4.3...v3.4.4) (2022-01-17)

### Bug Fixes

- **deps:** update dependency bencode to ^2.0.2 ([#63](https://github.com/webtorrent/bittorrent-protocol/issues/63)) ([c022e17](https://github.com/webtorrent/bittorrent-protocol/commit/c022e17efe9d28aaf0c25a087abe75fe27549742))
- **deps:** update dependency debug to ^4.3.3 ([#64](https://github.com/webtorrent/bittorrent-protocol/issues/64)) ([2f2d84c](https://github.com/webtorrent/bittorrent-protocol/commit/2f2d84c7d88b296c98b784da9dca570045630d55))

## [3.4.3](https://github.com/webtorrent/bittorrent-protocol/compare/v3.4.2...v3.4.3) (2021-08-04)

### Bug Fixes

- **deps:** update dependency simple-sha1 to ^3.1.0 ([f3083f6](https://github.com/webtorrent/bittorrent-protocol/commit/f3083f687bf15d351654b2b4a44b3eab6b47188c))

## [3.4.2](https://github.com/webtorrent/bittorrent-protocol/compare/v3.4.1...v3.4.2) (2021-07-08)

## [3.4.1](https://github.com/webtorrent/bittorrent-protocol/compare/v3.4.0...v3.4.1) (2021-06-15)

### Bug Fixes

- modernize ([3d3e244](https://github.com/webtorrent/bittorrent-protocol/commit/3d3e244319036583230d64824ce1388287233e02))

# [3.4.0](https://github.com/webtorrent/bittorrent-protocol/compare/v3.3.2...v3.4.0) (2021-06-15)

### Features

- PE/MSE Implementation for WebTorrent - update for new version ([#48](https://github.com/webtorrent/bittorrent-protocol/issues/48)) ([14f9d81](https://github.com/webtorrent/bittorrent-protocol/commit/14f9d81d07a0d49e4b9460c5392b88bdf0f7bf00))

## [3.3.2](https://github.com/webtorrent/bittorrent-protocol/compare/v3.3.1...v3.3.2) (2021-06-15)

### Bug Fixes

- package.json ([87609ab](https://github.com/webtorrent/bittorrent-protocol/commit/87609abdf8223d4957d9f8c4dd5f06978092a68c))
