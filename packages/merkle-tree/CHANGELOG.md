# @z-torrent/merkle-tree

## 0.0.15

## 0.0.14

## 0.0.13

## 0.0.12

### Patch Changes

- [`524498f`](https://github.com/skrylnikov/z-torrent/commit/524498ff7dd37ae04ed16a73d6d38edd76efc1c8) Thanks [@skrylnikov](https://github.com/skrylnikov)! - Replace `node:crypto` and `sync-sha1` with `@noble/hashes` in `@z-torrent/parse`, `@z-torrent/merkle-tree`, and `@z-torrent/dht` for SHA-1 and SHA-256. Improves browser bundling (avoids `crypto-browserify` / broken CJS `exports` in production Vite/Rollup builds).

## 0.0.11

## 0.0.10

### Patch Changes

- [`f50e9c1`](https://github.com/skrylnikov/z-torrent/commit/f50e9c1961d06ff0cbf1ab9d9a6d6b4809e7d75d) Thanks [@skrylnikov](https://github.com/skrylnikov)! - fix publish

## 0.0.9

## 0.0.8

### Patch Changes

- [#16](https://github.com/skrylnikov/z-torrent/pull/16) [`26ef5a0`](https://github.com/skrylnikov/z-torrent/commit/26ef5a081869b1130406a730db5ec088841aa06c) Thanks [@skrylnikov](https://github.com/skrylnikov)! - Fix TypeScript typing in `verifyLeafToRoot` (`acc` vs `sha256Concat` return type).

- [#16](https://github.com/skrylnikov/z-torrent/pull/16) [`26ef5a0`](https://github.com/skrylnikov/z-torrent/commit/26ef5a081869b1130406a730db5ec088841aa06c) Thanks [@skrylnikov](https://github.com/skrylnikov)! - **Breaking (client API)**
  - Rename exports: `WebTorrent` → `ZTorrent` (`@z-torrent/node`, `@z-torrent/browser`), `WebTorrentCore` → `ZTorrentCore`, `WebTorrentCoreOpts` → `ZTorrentCoreOpts`, `WebTorrentClient` → `ZTorrentClient` (`@z-torrent/core`). No `WebTorrent` compatibility alias.
  - Migration: `import { ZTorrent } from '@z-torrent/node'` / `'@z-torrent/browser'`; from core, `ZTorrentCore` and type `ZTorrentClient`.

  **Behaviour notes**
  - Default BitTorrent peer-id prefix remains `-WW…`; `bittorrent-peerid` may still label peers as **WebTorrent** in tracker stats until the prefix is changed deliberately.

  **Housekeeping**
  - Removed per-file `/*! … MIT … */` (and similar) banners from package sources; full license text remains in each package `LICENSE`.
  - CLI `createdBy` default in `@z-torrent/create`, npm descriptions for tracker/discovery, docs/README examples, tests, and `@z-torrent/node` uTP warning string updated for Z-Torrent branding where they referred to the client class or product UA.

## 0.0.7

### Patch Changes

- [#14](https://github.com/skrylnikov/z-torrent/pull/14) [`8f99be2`](https://github.com/skrylnikov/z-torrent/commit/8f99be201a66830089f502ef2746bbd160d6907b) Thanks [@skrylnikov](https://github.com/skrylnikov)! - Initial publish of `@z-torrent/merkle-tree`: BEP 52 (BitTorrent v2) SHA-256 merkle trees — per-file trees, piece layers, subtree roots for piece verification.
