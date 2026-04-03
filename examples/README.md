# Examples

Usage examples for Z-Torrent.

## sintel-landing

Landing page with video player and P2P graph. Demonstrates direct browser-based torrent streaming with `@z-torrent/browser`. See [sintel-landing/README.md](sintel-landing/README.md).

## sintel-web

Demo site for the Sintel short film, designed to be published via `@z-torrent/publish` and served through the web portal. Uses `@z-torrent/host-sdk` to stream Sintel.mp4 from a BitTorrent swarm directly in the browser via the portal's Service Worker. See `sintel-web/`.

## web-portal

Svelte 5 SPA portal at `z-torrent.xyz` that loads torrent-hosted sites and renders them in an iframe. Includes torrent lifecycle management, loading UX, status indicator, and Host SDK message handler. See [portal.md](../docs/portal.md).

## seed-server

Seed server with REST API for accepting published sites, managing deployments, and seeding torrents. See [seed-server/README.md](seed-server/README.md).
