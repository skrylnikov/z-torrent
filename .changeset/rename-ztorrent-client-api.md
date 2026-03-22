---
'@z-torrent/core': patch
'@z-torrent/node': patch
'@z-torrent/browser': patch
'@z-torrent/create': patch
'@z-torrent/discovery': patch
'@z-torrent/merkle-tree': patch
'@z-torrent/magnet': patch
'@z-torrent/parse': patch
'@z-torrent/protocol': patch
'@z-torrent/tracker': patch
'@z-torrent/utils': patch
---

**Breaking (client API)**

- Rename exports: `WebTorrent` → `ZTorrent` (`@z-torrent/node`, `@z-torrent/browser`), `WebTorrentCore` → `ZTorrentCore`, `WebTorrentCoreOpts` → `ZTorrentCoreOpts`, `WebTorrentClient` → `ZTorrentClient` (`@z-torrent/core`). No `WebTorrent` compatibility alias.
- Migration: `import { ZTorrent } from '@z-torrent/node'` / `'@z-torrent/browser'`; from core, `ZTorrentCore` and type `ZTorrentClient`.

**Behaviour notes**

- Default BitTorrent peer-id prefix remains `-WW…`; `bittorrent-peerid` may still label peers as **WebTorrent** in tracker stats until the prefix is changed deliberately.

**Housekeeping**

- Removed per-file `/*! … MIT … */` (and similar) banners from package sources; full license text remains in each package `LICENSE`.
- CLI `createdBy` default in `@z-torrent/create`, npm descriptions for tracker/discovery, docs/README examples, tests, and `@z-torrent/node` uTP warning string updated for Z-Torrent branding where they referred to the client class or product UA.
