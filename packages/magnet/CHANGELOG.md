## [7.0.7](https://github.com/webtorrent/magnet-uri/compare/v7.0.6...v7.0.7) (2025-01-04)

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

- **deps:** update dependency uint8-util to ^2.2.5 ([#78](https://github.com/webtorrent/magnet-uri/issues/78)) ([eac2d64](https://github.com/webtorrent/magnet-uri/commit/eac2d64f50e622574ca4bd91dcd059ed3e768e33))

## [7.0.6](https://github.com/webtorrent/magnet-uri/compare/v7.0.5...v7.0.6) (2025-01-04)

### Bug Fixes

- **deps:** update dependency @thaunknown/thirty-two to ^1.0.5 ([#96](https://github.com/webtorrent/magnet-uri/issues/96)) ([55ae2a8](https://github.com/webtorrent/magnet-uri/commit/55ae2a84c7e62fc933168301837f513fd606331c))

## [7.0.5](https://github.com/webtorrent/magnet-uri/compare/v7.0.4...v7.0.5) (2023-05-30)

### Bug Fixes

- replace 32 with maintained version ([#73](https://github.com/webtorrent/magnet-uri/issues/73)) ([2c041f4](https://github.com/webtorrent/magnet-uri/commit/2c041f40f77f5f7ca928faa1d919366ee1a4c53c))

## [7.0.4](https://github.com/webtorrent/magnet-uri/compare/v7.0.3...v7.0.4) (2023-05-27)

### Bug Fixes

- base32 in browser ([#72](https://github.com/webtorrent/magnet-uri/issues/72)) ([287c063](https://github.com/webtorrent/magnet-uri/commit/287c06310775917491d4d9a6a018d0368d7f8125))

## [7.0.3](https://github.com/webtorrent/magnet-uri/compare/v7.0.2...v7.0.3) (2023-04-02)

### Bug Fixes

- **deps:** update dependency uint8-util to ^2.1.9 ([#67](https://github.com/webtorrent/magnet-uri/issues/67)) ([eae46c1](https://github.com/webtorrent/magnet-uri/commit/eae46c1366848a2abc543a1c618f6853ef9e878b))

## [7.0.2](https://github.com/webtorrent/magnet-uri/compare/v7.0.1...v7.0.2) (2023-01-31)

### Bug Fixes

- **deps:** update dependency uint8-util to ^2.1.7 ([#66](https://github.com/webtorrent/magnet-uri/issues/66)) ([b7f1a95](https://github.com/webtorrent/magnet-uri/commit/b7f1a95c4e7a54ccc26e01a6bb212fc476623ad3))

## [7.0.1](https://github.com/webtorrent/magnet-uri/compare/v7.0.0...v7.0.1) (2023-01-26)

### Performance Improvements

- drop buffer ([#64](https://github.com/webtorrent/magnet-uri/issues/64)) ([cf98664](https://github.com/webtorrent/magnet-uri/commit/cf98664336bfe813c4d1d55a54229667c01f0962))

# [7.0.0](https://github.com/webtorrent/magnet-uri/compare/v6.2.0...v7.0.0) (2023-01-26)

### Bug Fixes

- **deps:** update dependency bep53-range to ^1.1.1 ([#52](https://github.com/webtorrent/magnet-uri/issues/52)) ([a0b5645](https://github.com/webtorrent/magnet-uri/commit/a0b5645e12367a7b714c9ad875d6fd862cbacbb8))
- **deps:** update dependency bep53-range to v2 ([#61](https://github.com/webtorrent/magnet-uri/issues/61)) ([e414270](https://github.com/webtorrent/magnet-uri/commit/e414270069c74796a48b83f53276372012ba3d7a)), closes [#63](https://github.com/webtorrent/magnet-uri/issues/63)

### Features

- esm ([#60](https://github.com/webtorrent/magnet-uri/issues/60)) ([385ae9d](https://github.com/webtorrent/magnet-uri/commit/385ae9d29b436f2b7c6e4c5769012ad4223e6ab8))

### BREAKING CHANGES

- ESM only
