# Seed Server

Node.js application for downloading and seeding torrents, with a REST API for accepting published sites. Supports legacy magnet link seeding and a deployment API for the z-torrent web hosting system.

## Features

- Download and seed torrents from magnet links
- REST API for publishing and managing site deployments
- SQLite-backed deployment storage with TTL expiration
- Per-API-key quotas (storage, deployments, rate limits)
- Automatic deployment restoration on restart
- WebRTC peer support via WSS trackers

## Environment Variables

### Torrent Seeding (legacy)

| Variable                | Description                                                                      | Default             |
| ----------------------- | -------------------------------------------------------------------------------- | ------------------- |
| `TORRENT_MAGNETS`       | Magnet links (comma or newline separated). Optional — server works with API only | —                   |
| `TORRENT_TRACKERS`      | Tracker URLs for announce                                                        | WSS public trackers |
| `TORRENT_DOWNLOAD_PATH` | Directory for downloaded files                                                   | `./downloads`       |
| `TORRENT_HTTP_PORT`     | HTTP streaming port (0 = disabled)                                               | `8080`              |

### WebRTC

| Variable          | Description     | Default                        |
| ----------------- | --------------- | ------------------------------ |
| `STUN_URL`        | STUN server     | `stun:turn.z-torrent.xyz:3478` |
| `TURN_URL`        | TURN server     | `turn:turn.z-torrent.xyz:3478` |
| `TURN_USERNAME`   | TURN username   | `z-torrent`                    |
| `TURN_CREDENTIAL` | TURN credential | —                              |

### API & Hosting

| Variable            | Description                                  | Default                 |
| ------------------- | -------------------------------------------- | ----------------------- |
| `API_PORT`          | REST API port                                | `3000`                  |
| `DB_PATH`           | SQLite database path                         | `./data/deployments.db` |
| `MAX_TOTAL_STORAGE` | Maximum total storage across all deployments | `10GB`                  |
| `DEFAULT_TTL`       | Default TTL for deployments                  | `14d`                   |
| `CLEANUP_INTERVAL`  | TTL cleanup job interval                     | `1h`                    |
| `PORTAL_URL`        | Portal URL for generating links              | `https://z-torrent.xyz` |
| `API_KEYS`          | JSON array of API key configs (see below)    | —                       |

### API Keys Configuration

`API_KEYS` is a JSON array of key objects:

```json
[
  {
    "key": "zt_live_abc123",
    "name": "production",
    "public": false,
    "limits": {
      "maxDeploySize": "10MB",
      "maxTotalStorage": "1GB",
      "maxDeployments": 100,
      "ttl": "30d",
      "rateLimit": "10/min"
    }
  }
]
```

## Running

From the monorepo root:

```bash
bun install
cd examples/seed-server
cp .env.example .env
# Edit .env with your settings
bun run start
```

## REST API

All endpoints except `/api/health` require `Authorization: Bearer <key>`.

### `GET /api/health`

Health check (no auth required).

### `POST /api/publish`

Upload a site deployment (multipart form: `torrent` file + `manifest` JSON string).

### `GET /api/status/:infoHash`

Check deployment status, progress, peers, upload stats.

### `GET /api/stats`

Get statistics for the API key (deployments, usage, totals).

### `DELETE /api/deployments/:infoHash`

Remove a deployment (only the key that created it can delete). Responds with `{ deleted: true, infoHash }`.

## HTTP Streaming Server

When `TORRENT_HTTP_PORT > 0`, files are available at:

- `http://localhost:PORT/z-torrent` — torrent list
- `http://localhost:PORT/z-torrent/INFO_HASH/` — torrent page
- `http://localhost:PORT/z-torrent/INFO_HASH/path/to/file` — file download

## Docker (Local Build)

Build the image from the repository root:

```bash
docker build -f examples/seed-server/Dockerfile -t z-torrent-seed-server .
```

Run with Docker Compose:

```bash
cd examples/seed-server
cp .env.example .env
docker compose up -d
```

## Deploy (Pre-built Image)

GitHub Actions (`.github/workflows/docker-seed-server.yml`) builds and pushes:

`ghcr.io/<your-github-username>/z-torrent-seed-server`

(`<your-github-username>` is the repository owner: user or org.)

```bash
docker pull ghcr.io/<your-github-username>/z-torrent-seed-server:latest
```

For `docker compose`, set `SEED_IMAGE_OWNER` to that owner if it is not `skrylnikov` (see `docker-compose.yml`).
