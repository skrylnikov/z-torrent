---
'@z-torrent/ut-metadata': patch
'@z-torrent/discovery': patch
'@z-torrent/protocol': patch
'@z-torrent/browser': patch
'@z-torrent/tracker': patch
'@z-torrent/create': patch
'@z-torrent/magnet': patch
'@z-torrent/ut-pex': patch
'@z-torrent/parse': patch
'@z-torrent/utils': patch
'@z-torrent/core': patch
'@z-torrent/node': patch
'@z-torrent/dht': patch
'@z-torrent/lsd': patch
---

Added

- LICENSE (MIT) and README.md files to @z-torrent/core package
- LICENSE (MIT) file to @z-torrent/browser package
  Changed
- Added files field to all package.json files to explicitly define npm publish contents:
  - All packages now include: dist, README.md, LICENSE, CHANGELOG.md
  - @z-torrent/node and @z-torrent/dht: also include AUTHORS.md
  - @z-torrent/tracker: also includes AUTHORS.md and CONTRIBUTING.md
  - @z-torrent/fixtures: also includes fixtures directory
    Removed
- Deleted 12 .npmignore files (redundant when using files field in package.json)
