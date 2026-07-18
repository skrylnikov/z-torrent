---
'@z-torrent/utils': patch
---

Fix `IDBChunkStore.put` to accept the 3-argument form `put(index, chunk, cb)` that `@z-torrent/core` uses when persisting pieces. Previously the callback was treated as options, which broke the browser default chunk store during downloads.
