---
'@z-torrent/node': patch
---

Type `ZTorrent` constructor options with `ZTorrentNodeOpts` (`Omit<ZTorrentCoreOpts, 'platform'>`). Type `seed` options with `SeedOpts` (`TorrentOpts & CreateTorrentOptions` plus optional `streams`) and add overloads for `(input, onseed?)` vs `(input, opts, onseed?)`. Export `ZTorrentNodeOpts` and `SeedOpts`. Replaces `Record<string, unknown>`.
