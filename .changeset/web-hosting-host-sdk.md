---
'@z-torrent/host-sdk': patch
---

Add `@z-torrent/host-sdk`: a browser-only `ZTorrentHost` class that talks to the parent Z-Torrent portal over `postMessage`. Embedded sites (nested iframe) can hand the host a magnet URI or equivalent, wait for metadata/download progress callbacks, and receive per-file object URLs suitable for `<video>`, `<audio>`, or fetch-based playback.

Exposes `isEmbedded` so pages can no-op when opened outside the portal. Aim is a minimal, typed bridge without pulling the full client into every hosted app bundle.
