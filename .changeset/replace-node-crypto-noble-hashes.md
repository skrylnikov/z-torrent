---
'@z-torrent/parse': patch
'@z-torrent/merkle-tree': patch
'@z-torrent/dht': patch
---

Replace `node:crypto` and `sync-sha1` with `@noble/hashes` in `@z-torrent/parse`, `@z-torrent/merkle-tree`, and `@z-torrent/dht` for SHA-1 and SHA-256. Improves browser bundling (avoids `crypto-browserify` / broken CJS `exports` in production Vite/Rollup builds).
