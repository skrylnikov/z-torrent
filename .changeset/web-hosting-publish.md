---
'@z-torrent/publish': patch
---

Add the `z-torrent-publish` package: a Node-oriented CLI (`z-torrent-publish`) and a small programmatic API to turn a static or SPA build directory into a `.torrent` plus an adjacent `zt-manifest.json` describing routing, fallbacks, and site metadata for the web portal.

Supports config via `z-torrent.config` modules or flags, dry-run mode, and integration with existing `@z-torrent/create` / `@z-torrent/parse` / `@z-torrent/utils` pieces so manifests stay consistent with how the rest of the monorepo thinks about hosting.
