# @z-torrent/host-sdk

## 0.0.16

### Patch Changes

- [#28](https://github.com/skrylnikov/z-torrent/pull/28) [`3748a93`](https://github.com/skrylnikov/z-torrent/commit/3748a930b8c875494c3d901cf2ae4bec51929757) Thanks [@skrylnikov](https://github.com/skrylnikov)! - Add `@z-torrent/host-sdk`: a browser-only `ZTorrentHost` class that talks to the parent Z-Torrent portal over `postMessage`. Embedded sites (nested iframe) can hand the host a magnet URI or equivalent, wait for metadata/download progress callbacks, and receive per-file object URLs suitable for `<video>`, `<audio>`, or fetch-based playback.

  Exposes `isEmbedded` so pages can no-op when opened outside the portal. Aim is a minimal, typed bridge without pulling the full client into every hosted app bundle.
