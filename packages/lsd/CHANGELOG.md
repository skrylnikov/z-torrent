# [2.0.0](https://github.com/webtorrent/bittorrent-lsd/compare/v1.1.1...v2.0.0) (2022-12-05)

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

### Features

- esm ([#30](https://github.com/webtorrent/bittorrent-lsd/issues/30)) ([4f45f6f](https://github.com/webtorrent/bittorrent-lsd/commit/4f45f6fcfc3757fa1cd4fcef750d8af48722d2dc))

### BREAKING CHANGES

- ESM only
- feat: esm

- Update index.js

Co-authored-by: Diego Rodríguez Baquero <github@diegorbaquero.com>

Co-authored-by: Diego Rodríguez Baquero <github@diegorbaquero.com>

- ESM only

## [1.1.1](https://github.com/webtorrent/bittorrent-lsd/compare/v1.1.0...v1.1.1) (2021-07-22)

### Bug Fixes

- regex redudant escape and test fix for multiple interfaces ([5027585](https://github.com/webtorrent/bittorrent-lsd/commit/5027585d16c642d13b63ec1633e6d13d71e26e42))
