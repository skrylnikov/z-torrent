## [4.0.3](https://github.com/webtorrent/ut_metadata/compare/v4.0.2...v4.0.3) (2023-08-10)

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

- **deps:** update dependency bencode to v4 ([#103](https://github.com/webtorrent/ut_metadata/issues/103)) ([a5ddef3](https://github.com/webtorrent/ut_metadata/commit/a5ddef33b3147bbb2d27ab9c9d51aba93828bfc3))

## [4.0.2](https://github.com/webtorrent/ut_metadata/compare/v4.0.1...v4.0.2) (2022-12-18)

### Bug Fixes

- **deps:** update dependency bittorrent-protocol to v4.1.0 ([#85](https://github.com/webtorrent/ut_metadata/issues/85)) ([dcefd4e](https://github.com/webtorrent/ut_metadata/commit/dcefd4eb691324499743d418bf284e5b4c611d37))

### Performance Improvements

- drop rusha, buffer ([#79](https://github.com/webtorrent/ut_metadata/issues/79)) [skip ci] ([92ab67a](https://github.com/webtorrent/ut_metadata/commit/92ab67a715065716710aad59e3a9525589d1a426))

## [4.0.1](https://github.com/webtorrent/ut_metadata/compare/v4.0.0...v4.0.1) (2022-12-06)

### Bug Fixes

- **deps:** update dependency bencode to v3 ([#82](https://github.com/webtorrent/ut_metadata/issues/82)) ([7857d8e](https://github.com/webtorrent/ut_metadata/commit/7857d8ed9411f4de00291169fd6e291a380ece7a))

# [4.0.0](https://github.com/webtorrent/ut_metadata/compare/v3.5.2...v4.0.0) (2022-12-06)

### Features

- esm ([#80](https://github.com/webtorrent/ut_metadata/issues/80)) ([022307e](https://github.com/webtorrent/ut_metadata/commit/022307e09d6a9bc3d2f6b375a414dc0058443295))

### BREAKING CHANGES

- ESM only
