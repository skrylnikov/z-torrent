---
'@z-torrent/node': patch
---

Update the Node `Server` implementation to follow the same `ServerBase` contract and behaviour as the browser adapter: consistent URL/path handling for torrent-backed HTTP responses in tooling, tests, and any Node-based portal or seed workflows.

This keeps parity with the web-hosting changes in core and avoids subtle differences between Node and browser when serving the same manifest or file layout.
