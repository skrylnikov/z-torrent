---
'@z-torrent/core': patch
---

Introduce the `ZTManifest` shape (site metadata, static vs SPA mode, routing, redirects, headers, optional framework hints) and export it from the package entry so tooling and hosts can share one schema.

Extend `ServerBase` and related types (`ServerOptions`, `ClientWithTorrents`, file metadata) so torrent HTTP serving can treat portal-hosted payloads consistently across runtimes. Adjust `File` / peer-facing pieces where needed for the hosting path. Add coverage in tests for the server hosting flow.
