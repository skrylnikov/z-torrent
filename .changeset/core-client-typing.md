---
'@z-torrent/core': patch
---

Stricter typing for `ZTorrentCore` and related APIs: add `client-types.ts` with `TorrentDestroyOpts`, `TrackerOpts` (aligned with `@z-torrent/tracker` client options), `TrackerAnnounceOpts`, and `TrackerProxyOpts`. Add `TorrentId` for `get` / `add` / `remove`. Replace `unknown` on `tracker`, `blocklist`, `blocked`, `createServer` return type, and destroy/remove options. Type `PlatformAdapter.loadIPSet` with `IPSet` / `IPInput`; add `DHTInstance.once('error')` overload and typed `removeTorrentRoutingTable`; extend `ZTorrentClient` with `blocked`, `dht`, and `tracker`. `Torrent.destroy` accepts `TorrentDestroyOpts`, `Error`, or a callback; discovery startup uses typed `TrackerOpts` without `as any`. Export the new types from `@z-torrent/core`.
