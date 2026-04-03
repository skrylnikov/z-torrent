---
'@z-torrent/browser': patch
---

Refresh the browser platform adapter and the main-thread / worker torrent server so they match the core hosting model (range requests, manifest-driven behaviour, and integration with the shared client).

Narrow `ZTorrent.createServer` to the browser-specific server options while still delegating to core. Re-export `ZTManifest` so browser bundles and portal UIs can depend on a single type without reaching into `@z-torrent/core` directly where a thinner public surface is preferred.
