---
'@z-torrent/utils': patch
---

Ship `IDBChunkStore` under the `@z-torrent/utils/idb-chunk-store` entry point: an IndexedDB-backed store for piece data, with clearer quota and error behaviour suited to long-lived browser clients.

Export `calcPieceLength` from the main util surface so torrent creation and publish tooling can agree on piece sizing (including BEP-52 style constraints where applicable). Add unit tests for the chunk store and piece-length helpers to lock in behaviour.
