# @z-torrent/core

## 0.0.6

### Patch Changes

- [#9](https://github.com/skrylnikov/z-torrent/pull/9) [`1cd075b`](https://github.com/skrylnikov/z-torrent/commit/1cd075b90b4019113a7264ef39e7122fc7b730f7) Thanks [@skrylnikov](https://github.com/skrylnikov)! - Refactor ut-pex package:
  - Switch from default export to named export (`UtPex`)
  - Use ECMAScript private fields (`#field`) instead of `private _field`
  - Use `Uint8Array` instead of `Buffer` for cross-platform compatibility
  - Extract types to separate `types.ts` file
  - Export type definitions (`PEXFlags`, `DecodedPEXFlags`, `PEXMessage`, `Wire`, `PeerEntry`)
  - Update README documentation

- [#11](https://github.com/skrylnikov/z-torrent/pull/11) [`5187a98`](https://github.com/skrylnikov/z-torrent/commit/5187a98f4e6c26828340ff8b0fb82e1ecb1698f5) Thanks [@skrylnikov](https://github.com/skrylnikov)! - Refactor ut-metadata package:
  - Upgrade bitfield from v4 to v5
  - Use ECMAScript private fields (`#field`) instead of `private _field`
  - Switch from default export to named exports (`UtMetadata`, `createUtMetadata`)
  - Fix TypeScript type errors, use `Uint8Array` instead of `Buffer`
  - Update tests to use named imports and correct event types (handshake emits hex strings)
  - Update README documentation to clarify that `createUtMetadata` is a factory function
  - Update import in `@z-torrent/core` to use named export `createUtMetadata`

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

- Updated dependencies [[`1cd075b`](https://github.com/skrylnikov/z-torrent/commit/1cd075b90b4019113a7264ef39e7122fc7b730f7), [`5187a98`](https://github.com/skrylnikov/z-torrent/commit/5187a98f4e6c26828340ff8b0fb82e1ecb1698f5), [`e4f99ec`](https://github.com/skrylnikov/z-torrent/commit/e4f99ec801589e1186c0b33fe57432666d9d938c), [`e84ff59`](https://github.com/skrylnikov/z-torrent/commit/e84ff596f40550a02e7b3fdf5bb3445bdbe1c066)]:
  - @z-torrent/ut-pex@0.0.6
  - @z-torrent/ut-metadata@0.0.6
  - @z-torrent/protocol@0.0.6
  - @z-torrent/parse@0.0.6
  - @z-torrent/utils@0.0.6

## 0.0.5

### Patch Changes

- [#7](https://github.com/skrylnikov/z-torrent/pull/7) [`2973e65`](https://github.com/skrylnikov/z-torrent/commit/2973e650b85b72725386a83ac5331f8d429e4117) Thanks [@skrylnikov](https://github.com/skrylnikov)! - fix release workflow

- Updated dependencies [[`2973e65`](https://github.com/skrylnikov/z-torrent/commit/2973e650b85b72725386a83ac5331f8d429e4117)]:
  - @z-torrent/parse@0.0.5
  - @z-torrent/protocol@0.0.5
  - @z-torrent/ut-metadata@0.0.5
  - @z-torrent/ut-pex@0.0.5
  - @z-torrent/utils@0.0.5

## 0.0.4

### Patch Changes

- [#5](https://github.com/skrylnikov/z-torrent/pull/5) [`e0e83e3`](https://github.com/skrylnikov/z-torrent/commit/e0e83e3eb2155e440a12ae9cf80b350c08a5a231) Thanks [@skrylnikov](https://github.com/skrylnikov)! - fix release workflow

- Updated dependencies [[`e0e83e3`](https://github.com/skrylnikov/z-torrent/commit/e0e83e3eb2155e440a12ae9cf80b350c08a5a231)]:
  - @z-torrent/parse@0.0.4
  - @z-torrent/protocol@0.0.4
  - @z-torrent/ut-metadata@0.0.4
  - @z-torrent/ut-pex@0.0.4
  - @z-torrent/utils@0.0.4

## 0.0.3

### Patch Changes

- [#3](https://github.com/skrylnikov/z-torrent/pull/3) [`9ac5074`](https://github.com/skrylnikov/z-torrent/commit/9ac5074d5623ee527225f0ec96cd1f4a20d32d9c) Thanks [@skrylnikov](https://github.com/skrylnikov)! - fix deploy to npm

- Updated dependencies [[`9ac5074`](https://github.com/skrylnikov/z-torrent/commit/9ac5074d5623ee527225f0ec96cd1f4a20d32d9c)]:
  - @z-torrent/parse@0.0.3
  - @z-torrent/protocol@0.0.3
  - @z-torrent/ut-metadata@0.0.3
  - @z-torrent/ut-pex@0.0.3
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
  - @z-torrent/ut-metadata@0.0.2
  - @z-torrent/protocol@0.0.2
  - @z-torrent/ut-pex@0.0.2
  - @z-torrent/parse@0.0.2
  - @z-torrent/utils@0.0.2
