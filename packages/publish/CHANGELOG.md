# @z-torrent/publish

## 0.0.16

### Patch Changes

- [#28](https://github.com/skrylnikov/z-torrent/pull/28) [`3748a93`](https://github.com/skrylnikov/z-torrent/commit/3748a930b8c875494c3d901cf2ae4bec51929757) Thanks [@skrylnikov](https://github.com/skrylnikov)! - Add the `z-torrent-publish` package: a Node-oriented CLI (`z-torrent-publish`) and a small programmatic API to turn a static or SPA build directory into a `.torrent` plus an adjacent `zt-manifest.json` describing routing, fallbacks, and site metadata for the web portal.

  Supports config via `z-torrent.config` modules or flags, dry-run mode, and integration with existing `@z-torrent/create` / `@z-torrent/parse` / `@z-torrent/utils` pieces so manifests stay consistent with how the rest of the monorepo thinks about hosting.

- Updated dependencies [[`a5c4547`](https://github.com/skrylnikov/z-torrent/commit/a5c45475dc9fa0f0019390a020008039e3f86c4c), [`3748a93`](https://github.com/skrylnikov/z-torrent/commit/3748a930b8c875494c3d901cf2ae4bec51929757), [`3748a93`](https://github.com/skrylnikov/z-torrent/commit/3748a930b8c875494c3d901cf2ae4bec51929757), [`3748a93`](https://github.com/skrylnikov/z-torrent/commit/3748a930b8c875494c3d901cf2ae4bec51929757)]:
  - @z-torrent/utils@0.0.16
  - @z-torrent/core@0.0.16
  - @z-torrent/create@0.0.16
  - @z-torrent/parse@0.0.16
