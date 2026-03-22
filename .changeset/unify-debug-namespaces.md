---
'@z-torrent/core': patch
'@z-torrent/node': patch
'@z-torrent/tracker': patch
'@z-torrent/protocol': patch
'@z-torrent/dht': patch
'@z-torrent/discovery': patch
'@z-torrent/lsd': patch
'@z-torrent/ut-metadata': patch
---

**Debug namespaces**

- All `debug` logger namespaces now use `@z-torrent/<package>:<scope>` (aligned with workspace package names).
- **Breaking for debugging only:** previous `DEBUG` values (`webtorrent*`, `bittorrent-*`, `torrent-discovery`, `ut_metadata`, etc.) no longer match. Use e.g. `DEBUG=@z-torrent/core:*`, `DEBUG=@z-torrent/protocol:wire`, or `DEBUG=@z-torrent/*`.

**Docs**

- Root [README.md](README.md) and [AGENTS.md](AGENTS.md) updated with the new convention and examples.
