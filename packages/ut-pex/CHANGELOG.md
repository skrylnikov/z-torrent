## [4.0.4](https://github.com/webtorrent/ut_pex/compare/v4.0.3...v4.0.4) (2023-08-10)

## 0.0.3

### Patch Changes

- [#3](https://github.com/skrylnikov/z-torrent/pull/3) [`9ac5074`](https://github.com/skrylnikov/z-torrent/commit/9ac5074d5623ee527225f0ec96cd1f4a20d32d9c) Thanks [@skrylnikov](https://github.com/skrylnikov)! - fix deploy to npm

- Updated dependencies [[`9ac5074`](https://github.com/skrylnikov/z-torrent/commit/9ac5074d5623ee527225f0ec96cd1f4a20d32d9c)]:
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
  - @z-torrent/utils@0.0.2

### Bug Fixes

- **deps:** update dependency bencode to v4 ([#82](https://github.com/webtorrent/ut_pex/issues/82)) ([cccbb72](https://github.com/webtorrent/ut_pex/commit/cccbb720b59952acb82356d6b4ec7c9f22c53f5e))

## [4.0.3](https://github.com/webtorrent/ut_pex/compare/v4.0.2...v4.0.3) (2023-01-25)

### Bug Fixes

- **deps:** update dependency string2compact to ^2.0.1 ([#66](https://github.com/webtorrent/ut_pex/issues/66)) ([cdd1665](https://github.com/webtorrent/ut_pex/commit/cdd16652a8b2ebd022bc41ef975eb87e70bdeb8f))

## [4.0.2](https://github.com/webtorrent/ut_pex/compare/v4.0.1...v4.0.2) (2023-01-25)

### Bug Fixes

- **deps:** update dependency string2compact to v2 ([#61](https://github.com/webtorrent/ut_pex/issues/61)) ([b94ea86](https://github.com/webtorrent/ut_pex/commit/b94ea868003789dee065e8095baa209207d35798))

## [4.0.1](https://github.com/webtorrent/ut_pex/compare/v4.0.0...v4.0.1) (2023-01-25)

### Bug Fixes

- **deps:** update dependency bencode to v3 ([#60](https://github.com/webtorrent/ut_pex/issues/60)) ([5e03940](https://github.com/webtorrent/ut_pex/commit/5e03940f1b38189763b9fd25259f47147ba772fa))

# [4.0.0](https://github.com/webtorrent/ut_pex/compare/v3.0.2...v4.0.0) (2022-11-16)

### Features

- esm ([#57](https://github.com/webtorrent/ut_pex/issues/57)) ([bbdeae1](https://github.com/webtorrent/ut_pex/commit/bbdeae13298617bd0a503f189ae23d4c26f80d96))

### BREAKING CHANGES

- ESM only

## [3.0.2](https://github.com/webtorrent/ut_pex/compare/v3.0.1...v3.0.2) (2021-08-04)

### Bug Fixes

- **deps:** update dependency bencode to ^2.0.2 ([#37](https://github.com/webtorrent/ut_pex/issues/37)) ([382ed1b](https://github.com/webtorrent/ut_pex/commit/382ed1befb55d909e06b0e67ab2a056f23fcfd6e))
- **deps:** update dependency string2compact to ^1.3.2 ([#38](https://github.com/webtorrent/ut_pex/issues/38)) ([3198373](https://github.com/webtorrent/ut_pex/commit/319837341fc4b9efd1675daddaed9f6e31b55b69))

## [3.0.1](https://github.com/webtorrent/ut_pex/compare/v3.0.0...v3.0.1) (2021-06-15)

### Bug Fixes

- modernize, semantic release, ignore files ([79ecf6b](https://github.com/webtorrent/ut_pex/commit/79ecf6bf76dad78b893ee3ea80a91efc1fd1cd1f))
