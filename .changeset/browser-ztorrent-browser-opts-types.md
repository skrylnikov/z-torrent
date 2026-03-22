---
'@z-torrent/browser': patch
---

Type `ZTorrent` constructor options with `ZTorrentBrowserOpts` (`Omit<ZTorrentCoreOpts, 'platform'>`) and export the type. Replaces `Record<string, unknown>`.
