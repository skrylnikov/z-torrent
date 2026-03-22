# Torrent Backup

Node.js application for downloading torrents via magnet links, announcing to trackers, and seeding — including browser peers over WSS trackers.

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TORRENT_MAGNETS` | Magnet links (comma or newline separated) | `magnet:?xt=urn:btih:...` |
| `TORRENT_TRACKERS` | Tracker URLs for announce | `wss://tracker.openwebtorrent.com,udp://...` |
| `TORRENT_DOWNLOAD_PATH` | Directory for downloaded files | `./downloads` |
| `TORRENT_HTTP_PORT` | (Optional) HTTP server port for streaming (0 = disabled) | `8080` |

For browser/WebRTC seeding, include WSS trackers in `TORRENT_TRACKERS`. If not set, default WSS trackers are used.

## Running

From the monorepo root:

```bash
bun install
cd examples/torrent-backup
bun run start
```

Or with environment variables:

```bash
cd examples/torrent-backup
TORRENT_MAGNETS="magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel" \
TORRENT_TRACKERS="wss://tracker.openwebtorrent.com,wss://tracker.webtorrent.dev" \
TORRENT_DOWNLOAD_PATH=./downloads \
TORRENT_HTTP_PORT=8080 \
bun run start
```

With `.env`:

```bash
cp .env.example .env
# Edit .env with your magnet links and settings
bun run start
```

## HTTP Server

When `TORRENT_HTTP_PORT > 0`, an HTTP server is started. Files are available at:

- `http://localhost:PORT/z-torrent` — torrent list
- `http://localhost:PORT/z-torrent/INFO_HASH/` — torrent page
- `http://localhost:PORT/z-torrent/INFO_HASH/path/to/file` — file download

## Docker (Local Build)

Build the image from the repository root:

```bash
docker build -f examples/torrent-backup/Dockerfile -t z-torrent-torrent-backup .
```

Run with a volume for downloads and environment variables:

```bash
docker run -p 8080:8080 \
  -v $(pwd)/downloads:/app/examples/torrent-backup/downloads \
  -e TORRENT_MAGNETS="magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel" \
  -e TORRENT_TRACKERS="wss://tracker.openwebtorrent.com,wss://tracker.webtorrent.dev" \
  -e TORRENT_HTTP_PORT=8080 \
  z-torrent-torrent-backup
```

## Deploy (Pre-built Image)

The image `ghcr.io/skrylnikov/z-torrent-torrent-backup` is automatically built and pushed to GitHub Container Registry on push to `main`/`master` and on version tags.

1. From `examples/torrent-backup`, create `.env` from `.env.example`:

```bash
cd examples/torrent-backup
cp .env.example .env
# Edit .env with your magnet links and settings
```

2. Run with Docker Compose:

```bash
docker compose up -d
```

The app will be available at http://localhost:8080/z-torrent (when `TORRENT_HTTP_PORT=8080`).

To pull the image without compose:

```bash
docker pull ghcr.io/skrylnikov/z-torrent-torrent-backup:latest
```
