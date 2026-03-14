# Sintel Landing — Z-Torrent Demo

Landing page with video player and P2P graph, inspired by [webtorrent.io](https://webtorrent.io). Streams the Sintel torrent in the browser via WebRTC.

**Note:** The demo uses a magnet link (not the local `public/sintel.torrent`). The local file is a different torrent (4K mkv, no WebSocket trackers) and would not find peers in the browser. The magnet points to the WebTorrent demo torrent with Sintel.mp4 and wss:// trackers.

## Local Development

From the repository root:

```bash
bun run build --filter=z-torrent-browser
cd examples/sintel-landing
bun run dev
```

Or run `bun run build` to build everything, then `bun run dev` in sintel-landing.

## Build

```bash
bun run build
```

The build script ensures the z-torrent-browser bundle exists, copies the service worker to `public/`, and runs the Astro build.

## Deploy

1. Download docker-compose:

```bash
wget https://raw.githubusercontent.com/skrylnikov/z-torrent/main/examples/sintel-landing/docker-compose.yml
```

2. Run (uses pre-built image from registry):

```bash
docker compose up -d
```

The app will be available at http://localhost:3000

## Docker (Local Build)

To build the image locally from the repository root:

```bash
docker build -f examples/sintel-landing/Dockerfile -t z-torrent-sintel-landing .
docker run -p 3000:80 z-torrent-sintel-landing
```
