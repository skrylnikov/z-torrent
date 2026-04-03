# Seed Server — API & Design

## Overview

The seed server is an extension of the existing `examples/seed-server/` application. It adds a REST API for accepting published sites, managing API keys with quotas, and tracking torrent lifecycle (TTL, storage limits). The server downloads torrents, seeds them indefinitely (or until TTL expires), and acts as a reliable always-on seed so browser peers always have at least one source.

Location: `examples/seed-server/` (extended)

## Architecture

```
examples/seed-server/
  src/
    index.ts                 # Main entry — unchanged startup logic
    api/
      server.ts              # HTTP API server (Hono or native)
      routes/
        publish.ts           # POST /api/publish
        status.ts            # GET  /api/status/:hash
        stats.ts             # GET  /api/stats
        health.ts            # GET  /api/health
      middleware/
        auth.ts              # API key validation
        rate-limit.ts        # Rate limiting
    storage/
      db.ts                  # SQLite/JSON storage for deployments
      cleanup.ts             # TTL expiration job
    config.ts                # Environment variable parsing
  .env.example
  Dockerfile
  docker-compose.yml
```

## Environment Variables

### Existing (unchanged)

| Variable                | Default                        | Description                           |
| ----------------------- | ------------------------------ | ------------------------------------- |
| `TORRENT_MAGNETS`       | —                              | Comma-separated magnet links (legacy) |
| `TORRENT_TRACKERS`      | WSS public trackers            | Tracker URLs                          |
| `TORRENT_DOWNLOAD_PATH` | `./downloads`                  | Download directory                    |
| `TORRENT_HTTP_PORT`     | `0` (disabled)                 | HTTP streaming port                   |
| `STUN_URL`              | `stun:turn.z-torrent.xyz:3478` | STUN server                           |
| `TURN_URL`              | `turn:turn.z-torrent.xyz:3478` | TURN server                           |
| `TURN_USERNAME`         | `z-torrent`                    | TURN username                         |
| `TURN_CREDENTIAL`       | —                              | TURN credential                       |

### New — API & Hosting

| Variable            | Default                 | Description                                  |
| ------------------- | ----------------------- | -------------------------------------------- |
| `API_PORT`          | `3000`                  | REST API port                                |
| `API_KEYS`          | —                       | JSON array of API key configs (see below)    |
| `DB_PATH`           | `./data/deployments.db` | SQLite database path                         |
| `MAX_TOTAL_STORAGE` | `10GB`                  | Maximum total storage across all deployments |
| `DEFAULT_TTL`       | `14d`                   | Default TTL for deployments                  |
| `CLEANUP_INTERVAL`  | `1h`                    | How often to run TTL cleanup                 |
| `PORTAL_URL`        | `https://z-torrent.xyz` | Portal URL for generating links              |

### API Keys Configuration

`API_KEYS` is a JSON array:

```json
[
  {
    "key": "zt_live_abc123...",
    "name": "production",
    "public": false,
    "limits": {
      "maxDeploySize": "10MB",
      "maxTotalStorage": "1GB",
      "maxDeployments": 100,
      "ttl": "30d",
      "rateLimit": "10/min"
    }
  },
  {
    "key": "zt_pub_demo456...",
    "name": "demo",
    "public": true,
    "limits": {
      "maxDeploySize": "5MB",
      "maxTotalStorage": "100MB",
      "maxDeployments": 10,
      "ttl": "7d",
      "rateLimit": "3/min"
    }
  },
  {
    "key": "zt_live_premium...",
    "name": "premium",
    "public": false,
    "limits": {
      "maxDeploySize": "50MB",
      "maxTotalStorage": "10GB",
      "maxDeployments": -1,
      "ttl": "infinite",
      "rateLimit": "60/min"
    }
  }
]
```

**Key types:**

- **Private keys** (`public: false`): Full access to stats, can manage their deployments. Used by developers.
- **Public keys** (`public: true`): Limited access, stats are anonymized. Used for demos or shared access.

**TTL behavior:**

- TTL countdown resets on every access (any browser loads the torrent via the seed server)
- `"infinite"` means never expires
- `"7d"`, `"14d"`, `"30d"` — duration since last access
- If no access for the TTL duration, the deployment is removed (torrent deleted, stop seeding)

## REST API

### `POST /api/publish`

Upload a new site deployment.

**Headers:**

```
Authorization: Bearer zt_live_abc123...
Content-Type: multipart/form-data
```

**Body (multipart):**

- `torrent` — `.torrent` file (binary)
- `manifest` — `zt-manifest.json` content (JSON string)

**Response (200):**

```json
{
  "infoHash": "08ada5a7a6183aae1e09d831df6748d566095a10",
  "url": "https://z-torrent.xyz/08ada5a7a6183aae1e09d831df6748d566095a10",
  "magnetURI": "magnet:?xt=urn:btih:08ada5a...",
  "status": "downloading",
  "size": 2400000,
  "files": 12,
  "expiresAt": "2026-04-14T12:00:00Z"
}
```

**Errors:**

| Status | Reason                                     |
| ------ | ------------------------------------------ |
| 401    | Invalid or missing API key                 |
| 403    | Key limits exceeded (storage, deployments) |
| 413    | Deployment exceeds `maxDeploySize`         |
| 422    | Invalid torrent file or manifest           |
| 429    | Rate limit exceeded                        |

**Server-side flow:**

1. Validate API key, check limits
2. Parse `.torrent` file, extract infoHash
3. Parse and validate manifest
4. Check if torrent already exists (idempotent — return existing)
5. Save `.torrent` to `{TORRENT_DOWNLOAD_PATH}/{infoHash}/`
6. Add torrent to ZTorrent client: `client.add(torrentBuf, { path: downloadPath })`
7. Store deployment record in DB
8. Return immediately — download happens async

### `GET /api/status/:infoHash`

Check deployment status.

**Headers:**

```
Authorization: Bearer zt_live_abc123...
```

**Response (200):**

```json
{
  "infoHash": "08ada5a7a6183aae1e09d831df6748d566095a10",
  "status": "seeding",
  "ready": true,
  "progress": 1,
  "peers": 3,
  "uploaded": 15000000,
  "downloaded": 2400000,
  "ratio": 6.25,
  "createdAt": "2026-03-31T12:00:00Z",
  "lastAccessedAt": "2026-03-31T14:30:00Z",
  "expiresAt": "2026-04-14T14:30:00Z",
  "manifest": {
    "site": { "name": "Sintel Demo" },
    "type": "static"
  }
}
```

**Status values:**

- `downloading` — torrent is being downloaded
- `seeding` — fully downloaded, actively seeding
- `paused` — seeding paused (e.g., server overloaded)
- `expired` — TTL exceeded, scheduled for deletion
- `not_found` — unknown infoHash

### `GET /api/stats`

Get statistics for the API key.

**Headers:**

```
Authorization: Bearer zt_live_abc123...
```

**Response (200):**

```json
{
  "key": {
    "name": "production",
    "public": false
  },
  "usage": {
    "deployments": 5,
    "totalSize": 12000000,
    "limits": {
      "maxDeployments": 100,
      "maxTotalStorage": 1073741824,
      "maxDeploySize": 10485760
    }
  },
  "deployments": [
    {
      "infoHash": "08ada5a...",
      "name": "Sintel Demo",
      "size": 2400000,
      "status": "seeding",
      "peers": 3,
      "uploaded": 15000000,
      "ratio": 6.25,
      "createdAt": "2026-03-31T12:00:00Z",
      "lastAccessedAt": "2026-03-31T14:30:00Z",
      "expiresAt": "2026-04-14T14:30:00Z"
    }
  ],
  "totals": {
    "uploaded": 150000000,
    "downloaded": 24000000,
    "peers": 12
  }
}
```

For **public keys** (`public: true`), the `deployments` array is omitted (privacy).

### `DELETE /api/deployments/:infoHash`

Remove a deployment.

**Headers:**

```
Authorization: Bearer zt_live_abc123...
```

**Response (200):**

```json
{
  "deleted": true,
  "infoHash": "08ada5a..."
}
```

Only the key that created the deployment can delete it.

### `GET /api/health`

Health check (no auth required).

**Response (200):**

```json
{
  "status": "ok",
  "uptime": 86400,
  "torrents": 5,
  "peers": 12,
  "storage": {
    "used": 12000000,
    "total": 10737418240
  }
}
```

## Storage — Deployment Database

Use SQLite (via `bun:sqlite`) for deployment records. Lightweight, no external dependencies, works well with Docker volumes.

### Schema

```sql
CREATE TABLE deployments (
  info_hash TEXT PRIMARY KEY,
  api_key TEXT NOT NULL,
  manifest TEXT NOT NULL,        -- JSON
  torrent BLOB NOT NULL,         -- .torrent file
  size INTEGER NOT NULL,         -- bytes
  file_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'downloading',
  created_at TEXT NOT NULL,      -- ISO 8601
  last_accessed_at TEXT NOT NULL, -- ISO 8601
  ttl_seconds INTEGER,           -- NULL = infinite
  uploaded INTEGER DEFAULT 0,
  downloaded INTEGER DEFAULT 0
);

CREATE INDEX idx_deployments_api_key ON deployments(api_key);
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_deployments_last_accessed ON deployments(last_accessed_at);
```

### TTL Cleanup Job

Runs on `CLEANUP_INTERVAL`:

```typescript
async function cleanupExpired(client: ZTorrent, db: Database): Promise<void> {
  const now = new Date()

  const expired = db
    .query(
      `
      SELECT info_hash, ttl_seconds, last_accessed_at
      FROM deployments
      WHERE status = 'seeding'
        AND ttl_seconds IS NOT NULL
    `
    )
    .all()

  for (const row of expired) {
    const lastAccess = new Date(row.last_accessed_at)
    const expiresAt = new Date(lastAccess.getTime() + row.ttl_seconds * 1000)

    if (now > expiresAt) {
      console.log(`[cleanup] Expiring ${row.info_hash}`)

      // Remove from torrent client
      await client.remove(row.info_hash)

      // Update DB
      db.run(`UPDATE deployments SET status = 'expired' WHERE info_hash = ?`, [row.info_hash])

      // Delete files from disk
      await fs.rm(path.join(downloadPath, row.info_hash), { recursive: true, force: true })
    }
  }
}
```

### Access Tracking

When a browser peer connects to the seed server and downloads pieces of a deployment's torrent, update `last_accessed_at`:

```typescript
torrent.on(
  'upload',
  throttle(() => {
    db.run(`UPDATE deployments SET last_accessed_at = ?, uploaded = ? WHERE info_hash = ?`, [
      new Date().toISOString(),
      torrent.uploaded,
      torrent.infoHash,
    ])
  }, 60_000)
) // Update at most once per minute
```

## Server Startup Flow

Extended `src/index.ts`:

```typescript
// 1. Load env, parse API keys
const apiKeys = parseApiKeys(process.env.API_KEYS)

// 2. Initialize SQLite DB
const db = initDatabase(process.env.DB_PATH)

// 3. Create ZTorrent client (existing logic)
const client = new ZTorrent({ ... })

// 4. Restore deployments from DB
const deployments = db.query(
  `SELECT * FROM deployments WHERE status IN ('seeding', 'downloading')`
).all()

for (const dep of deployments) {
  client.add(dep.torrent, {
    path: path.join(downloadPath, dep.info_hash),
  }, (torrent) => {
    // Attach upload tracking
    // ...
  })
}

// 5. Also add legacy TORRENT_MAGNETS (if any)
for (const magnet of magnets) {
  client.add(magnet, { path: downloadPath }, ...)
}

// 6. Start API server
const apiServer = createApiServer(client, db, apiKeys)
apiServer.listen(apiPort)

// 7. Start cleanup job
setInterval(() => cleanupExpired(client, db), cleanupInterval)

// 8. Start HTTP streaming server (if configured)
if (httpPort > 0) {
  const streamServer = client.createServer()
  streamServer.listen(httpPort)
}
```

## API Server Implementation

Using native Bun HTTP (no framework dependency):

```typescript
export function createApiServer(
  client: ZTorrent,
  db: Database,
  apiKeys: ApiKeyConfig[]
): Bun.Server {
  return Bun.serve({
    port: apiPort,

    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url)
      const path = url.pathname

      // CORS
      if (req.method === 'OPTIONS') {
        return new Response(null, {
          headers: corsHeaders(),
        })
      }

      // Health — no auth
      if (path === '/api/health' && req.method === 'GET') {
        return handleHealth(client, db)
      }

      // Auth required for all other routes
      const key = authenticateRequest(req, apiKeys)
      if (!key) {
        return json({ error: 'Unauthorized' }, 401)
      }

      // Rate limiting
      if (isRateLimited(key)) {
        return json({ error: 'Rate limit exceeded' }, 429)
      }

      // Routes
      if (path === '/api/publish' && req.method === 'POST') {
        return handlePublish(req, client, db, key)
      }

      const statusMatch = path.match(/^\/api\/status\/([a-f0-9]{40})$/i)
      if (statusMatch && req.method === 'GET') {
        return handleStatus(statusMatch[1], client, db, key)
      }

      if (path === '/api/stats' && req.method === 'GET') {
        return handleStats(client, db, key)
      }

      const deleteMatch = path.match(/^\/api\/deployments\/([a-f0-9]{40})$/i)
      if (deleteMatch && req.method === 'DELETE') {
        return handleDelete(deleteMatch[1], client, db, key)
      }

      return json({ error: 'Not found' }, 404)
    },
  })
}
```

## Docker Changes

### Updated `docker-compose.yml`

```yaml
services:
  seed-server:
  image: ghcr.io/skrylnikov/z-torrent-seed-server:latest
  ports:
    - '8080:8080' # HTTP streaming
    - '3000:3000' # API
  volumes:
    - torrent-downloads:/app/examples/seed-server/downloads
    - torrent-data:/app/examples/seed-server/data
  env_file:
    - .env
  restart: unless-stopped

volumes:
  torrent-downloads:
  torrent-data: # SQLite DB persistence
```

### Updated `.env.example`

```env
# Torrent seeding (legacy)
TORRENT_MAGNETS=
TORRENT_TRACKERS=wss://tracker.z-torrent.xyz,wss://tracker.openwebtorrent.com,wss://tracker.webtorrent.dev
TORRENT_DOWNLOAD_PATH=./downloads
TORRENT_HTTP_PORT=8080

# WebRTC
STUN_URL=stun:turn.z-torrent.xyz:3478
TURN_URL=turn:turn.z-torrent.xyz:3478
TURN_USERNAME=z-torrent
TURN_CREDENTIAL=

# API
API_PORT=3000
DB_PATH=./data/deployments.db
MAX_TOTAL_STORAGE=10GB
DEFAULT_TTL=14d
CLEANUP_INTERVAL=1h
PORTAL_URL=https://z-torrent.xyz

# API Keys (JSON array)
API_KEYS=[{"key":"zt_live_changeme","name":"default","public":false,"limits":{"maxDeploySize":"10MB","maxTotalStorage":"1GB","maxDeployments":100,"ttl":"14d","rateLimit":"10/min"}}]
```

## Publish Handler — Detailed

```typescript
async function handlePublish(
  req: Request,
  client: ZTorrent,
  db: Database,
  key: ApiKeyConfig
): Promise<Response> {
  // 1. Parse multipart form
  const formData = await req.formData()
  const torrentFile = formData.get('torrent') as File | null
  const manifestStr = formData.get('manifest') as string | null

  if (!torrentFile || !manifestStr) {
    return json({ error: 'Missing torrent or manifest' }, 422)
  }

  // 2. Parse and validate torrent
  const torrentBuf = new Uint8Array(await torrentFile.arrayBuffer())
  let parsed
  try {
    parsed = await parseTorrent(torrentBuf)
  } catch {
    return json({ error: 'Invalid torrent file' }, 422)
  }

  // 3. Parse and validate manifest
  let manifest: ZTManifest
  try {
    manifest = validateManifest(JSON.parse(manifestStr))
  } catch (e) {
    return json({ error: `Invalid manifest: ${e.message}` }, 422)
  }

  // 4. Check size limits
  const size = parsed.length ?? 0
  if (size > parseBytes(key.limits.maxDeploySize)) {
    return json(
      {
        error: `Deployment size ${formatBytes(size)} exceeds limit ${key.limits.maxDeploySize}`,
      },
      413
    )
  }

  // 5. Check total storage
  const currentUsage = db
    .query(
      `SELECT COALESCE(SUM(size), 0) as total FROM deployments
     WHERE api_key = ? AND status != 'expired'`
    )
    .get(key.key) as { total: number }

  if (currentUsage.total + size > parseBytes(key.limits.maxTotalStorage)) {
    return json({ error: 'Total storage limit exceeded' }, 403)
  }

  // 6. Check deployment count
  if (key.limits.maxDeployments > 0) {
    const count = db
      .query(
        `SELECT COUNT(*) as count FROM deployments
       WHERE api_key = ? AND status != 'expired'`
      )
      .get(key.key) as { count: number }

    if (count.count >= key.limits.maxDeployments) {
      return json({ error: 'Maximum deployment count reached' }, 403)
    }
  }

  const infoHash = parsed.infoHash!

  // 7. Check idempotency
  const existing = db.query(`SELECT * FROM deployments WHERE info_hash = ?`).get(infoHash)

  if (existing) {
    return json({
      infoHash,
      url: `${portalUrl}/${infoHash}`,
      magnetURI: parsed.magnetURI,
      status: existing.status,
      size,
      files: parsed.files?.length ?? 0,
    })
  }

  // 8. Store deployment record
  const now = new Date().toISOString()
  const ttlSeconds = parseTTL(key.limits.ttl)

  db.run(
    `INSERT INTO deployments
     (info_hash, api_key, manifest, torrent, size, file_count, status, created_at, last_accessed_at, ttl_seconds)
     VALUES (?, ?, ?, ?, ?, ?, 'downloading', ?, ?, ?)`,
    [
      infoHash,
      key.key,
      manifestStr,
      torrentBuf,
      size,
      parsed.files?.length ?? 0,
      now,
      now,
      ttlSeconds,
    ]
  )

  // 9. Add to torrent client
  const downloadPath = path.join(basePath, infoHash)
  client.add(torrentBuf, { path: downloadPath }, (torrent) => {
    torrent.on('done', () => {
      db.run(`UPDATE deployments SET status = 'seeding' WHERE info_hash = ?`, [infoHash])
    })

    // Track uploads for TTL
    torrent.on(
      'upload',
      throttle(() => {
        db.run(`UPDATE deployments SET last_accessed_at = ?, uploaded = ? WHERE info_hash = ?`, [
          new Date().toISOString(),
          torrent.uploaded,
          infoHash,
        ])
      }, 60_000)
    )
  })

  // 10. Return immediately
  const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null

  return json({
    infoHash,
    url: `${portalUrl}/${infoHash}`,
    magnetURI: parsed.magnetURI,
    status: 'downloading',
    size,
    files: parsed.files?.length ?? 0,
    expiresAt,
  })
}
```

## Security Considerations

1. **API key format**: Prefix with `zt_live_` (private) or `zt_pub_` (public) for easy identification
2. **Key storage**: Keys stored in env vars, not in DB. The DB only references the key string for association.
3. **Rate limiting**: Per-key, configurable. Uses in-memory sliding window counter.
4. **Input validation**: All torrent and manifest data validated before processing.
5. **File system isolation**: Each deployment gets its own directory under `downloads/{infoHash}/`.
6. **No arbitrary code execution**: The seed server only seeds files — it never executes content from torrents.
