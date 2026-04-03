# @z-torrent/publish — Site Publishing CLI

## Overview

`@z-torrent/publish` is a CLI tool and library for deploying static websites as torrents. It reads a config file, creates a torrent from the build output, generates a manifest, pushes to seed servers, and outputs the deployment URL.

Location: `packages/publish/`

## Usage

### CLI

```bash
# Install globally
npm install -g @z-torrent/publish

# Or use via npx
npx @z-torrent/publish

# Publish current project (reads z-torrent.config.json)
z-torrent-publish

# Publish specific directory
z-torrent-publish --dir dist

# Publish with custom config
z-torrent-publish --config my-config.json

# Dry run — create torrent but don't push to server
z-torrent-publish --dry-run

# Output .torrent file
z-torrent-publish --output site.torrent
```

### Programmatic API

```typescript
import { publish } from '@z-torrent/publish'

const result = await publish({
  dir: './dist',
  site: {
    name: 'My App',
    type: 'spa',
  },
  server: 'https://seed.z-torrent.xyz',
  apiKey: process.env.ZT_API_KEY,
})

console.log(result.url) // https://z-torrent.xyz/08ada5a...
console.log(result.infoHash) // 08ada5a7a6183aae1e09d831df6748d566095a10
console.log(result.magnetURI) // magnet:?xt=urn:btih:08ada5a...
```

## Project Structure

```
packages/publish/
  package.json
  tsconfig.json
  tsdown.config.ts
  src/
    index.ts              # Library entry — exports publish()
    cli.ts                # CLI entry — bin command
    config.ts             # Config file loading + validation
    manifest.ts           # Manifest generation
    torrent.ts            # Torrent creation wrapper
    server.ts             # Seed server API client
    types.ts              # TypeScript types
```

## Config File — `z-torrent.config.json`

Lives in the project root. Can also be `.js`, `.ts`, or `.mjs` for dynamic configs.

```json
{
  "site": {
    "name": "My App",
    "description": "A modern web application",
    "icon": "favicon.svg",
    "lang": "en"
  },
  "type": "spa",
  "routing": {
    "fallback": "index.html",
    "errors": {
      "404": "404.html"
    }
  },
  "priority": ["index.html", "assets/*.css", "assets/*.js"],
  "publish": {
    "dir": "dist",
    "server": "https://seed.z-torrent.xyz",
    "apiKey": "$ZT_API_KEY",
    "trackers": [
      "wss://tracker.z-torrent.xyz",
      "wss://tracker.openwebtorrent.com",
      "wss://tracker.webtorrent.dev"
    ],
    "pieceLength": 32768,
    "servers": [
      {
        "url": "https://seed.z-torrent.xyz",
        "apiKey": "$ZT_API_KEY"
      },
      {
        "url": "https://seed2.z-torrent.xyz",
        "apiKey": "$ZT_API_KEY_2"
      }
    ]
  }
}
```

### Config Resolution

1. CLI `--config` flag (highest priority)
2. `z-torrent.config.ts`
3. `z-torrent.config.js`
4. `z-torrent.config.mjs`
5. `z-torrent.config.json`
6. `package.json` `"z-torrent"` field

### Environment Variable Expansion

Values starting with `$` are resolved from environment variables:

```json
{ "apiKey": "$ZT_API_KEY" }
```

Resolves to `process.env.ZT_API_KEY`. Throws if the variable is not set.

## Publish Flow

```
z-torrent-publish
      |
      v
  1. Load config
      |  - Read z-torrent.config.json
      |  - Resolve env vars ($ZT_API_KEY)
      |  - Validate config schema
      |
      v
  2. Scan directory
      |  - Read all files in publish.dir (default: "dist")
      |  - Filter junk files (DS_Store, etc.)
      |  - Calculate total size
      |  - Validate: entry file exists, size within limits
      |
      v
  3. Generate manifest
      |  - Build zt-manifest.json from config
      |  - Strip publish-specific fields
      |  - Add _meta (timestamp, size, file count)
      |  - Write zt-manifest.json into the dir
      |
      v
  4. Create torrent
      |  - createTorrent(dir, {
      |      name: site.name || dir basename,
      |      pieceLength: config.pieceLength || auto,
      |      announce: config.trackers,
      |      createdBy: '@z-torrent/publish',
      |    })
      |  - Returns .torrent buffer
      |
      v
   5. Push to seed server(s)
      |  - POST /api/publish
      |    Body: multipart/form-data
      |      - torrent: .torrent file
      |      - manifest: zt-manifest.json
      |    Headers:
      |      - Authorization: Bearer {apiKey}
      |  - Parallel push to all configured servers
      |
      v
  6. Wait for readiness
      |  - Poll GET /api/status/{infoHash}
      |    Headers: Authorization: Bearer {apiKey}
      |  - Wait until at least one server reports ready
      |  - Timeout after 5 minutes
      |
      v
  7. Output result
      |  - Print deployment URL
      |  - Print magnet URI
      |  - Print info hash
      |  - Print file list with sizes
      |  - Optionally save .torrent file (--output)
```

## CLI Implementation (`src/cli.ts`)

```typescript
#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { publish } from './index.js'
import { loadConfig } from './config.js'

const { values } = parseArgs({
  options: {
    config: { type: 'string', short: 'c' },
    dir: { type: 'string', short: 'd' },
    output: { type: 'string', short: 'o' },
    'dry-run': { type: 'boolean' },
    server: { type: 'string', short: 's' },
    'api-key': { type: 'string', short: 'k' },
    help: { type: 'boolean', short: 'h' },
    verbose: { type: 'boolean', short: 'v' },
  },
})

if (values.help) {
  printHelp()
  process.exit(0)
}

async function main() {
  const config = await loadConfig(values.config)

  // CLI flags override config
  if (values.dir) config.publish.dir = values.dir
  if (values.server) config.publish.server = values.server
  if (values['api-key']) config.publish.apiKey = values['api-key']

  console.log(`Publishing ${config.site?.name ?? config.publish.dir}...`)
  console.log()

  const result = await publish({
    ...config,
    dryRun: values['dry-run'],
    output: values.output,
    verbose: values.verbose,
    onProgress: (phase, detail) => {
      switch (phase) {
        case 'scanning':
          console.log(`  Scanning ${detail.fileCount} files (${formatBytes(detail.totalSize)})`)
          break
        case 'hashing':
          console.log(`  Creating torrent... ${Math.round(detail.progress * 100)}%`)
          break
        case 'pushing':
          console.log(`  Pushing to ${detail.serverUrl}...`)
          break
        case 'waiting':
          console.log(`  Waiting for server to seed...`)
          break
        case 'ready':
          break
      }
    },
  })

  console.log()
  console.log('Published successfully!')
  console.log()
  console.log(`  URL:      https://z-torrent.xyz/${result.infoHash}`)
  console.log(`  Hash:     ${result.infoHash}`)
  console.log(`  Magnet:   ${result.magnetURI}`)
  console.log(`  Size:     ${formatBytes(result.totalSize)}`)
  console.log(`  Files:    ${result.fileCount}`)
  console.log(`  Pieces:   ${result.pieceCount} x ${formatBytes(result.pieceLength)}`)

  if (values.output) {
    console.log(`  Torrent:  ${values.output}`)
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  process.exit(1)
})
```

## Core Library (`src/index.ts`)

```typescript
import { createTorrent } from '@z-torrent/create'
import { parseTorrent } from '@z-torrent/parse'
import { generateManifest } from './manifest.js'
import { pushToServer, waitForReady } from './server.js'
import type { PublishConfig, PublishResult } from './types.js'

export async function publish(config: PublishConfig): Promise<PublishResult> {
  const { dir, site, type, routing, priority, publish: pubConfig } = config

  // 1. Generate manifest
  const manifest = generateManifest({ site, type, routing, priority })
  const manifestPath = path.join(dir, 'zt-manifest.json')
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))

  try {
    // 2. Create torrent
    const torrentBuf = await new Promise<Uint8Array>((resolve, reject) => {
      createTorrent(
        dir,
        {
          name: site?.name ?? path.basename(dir),
          pieceLength: pubConfig?.pieceLength,
          announce: pubConfig?.trackers ?? DEFAULT_TRACKERS,
          createdBy: `@z-torrent/publish ${VERSION}`,
          onProgress: (hashed, total) => {
            config.onProgress?.('hashing', { progress: hashed / total })
          },
        },
        (err, buf) => {
          if (err) reject(err)
          else resolve(buf)
        }
      )
    })

    const parsed = await parseTorrent(torrentBuf)
    const infoHash = parsed.infoHash!

    if (config.output) {
      await fs.writeFile(config.output, torrentBuf)
    }

    if (config.dryRun) {
      return {
        infoHash,
        magnetURI: parsed.magnetURI!,
        totalSize: parsed.length!,
        fileCount: parsed.files?.length ?? 0,
        pieceCount: parsed.pieces?.length ?? 0,
        pieceLength: parsed.pieceLength!,
        url: `https://z-torrent.xyz/${infoHash}`,
      }
    }

    // 3. Push to seed server(s)
    const servers = pubConfig?.servers ?? [{ url: pubConfig?.server!, apiKey: pubConfig?.apiKey! }]

    await Promise.all(
      servers.map(async (server) => {
        config.onProgress?.('pushing', { serverUrl: server.url })
        await pushToServer(server.url, server.apiKey, torrentBuf, manifest)
      })
    )

    // 4. Wait for at least one server to be ready
    config.onProgress?.('waiting', {})
    await waitForReady(
      servers.map((s) => ({ url: s.url, apiKey: s.apiKey })),
      infoHash,
      { timeout: 300_000 } // 5 min
    )

    config.onProgress?.('ready', {})

    return {
      infoHash,
      magnetURI: parsed.magnetURI!,
      totalSize: parsed.length!,
      fileCount: parsed.files?.length ?? 0,
      pieceCount: parsed.pieces?.length ?? 0,
      pieceLength: parsed.pieceLength!,
      url: `https://z-torrent.xyz/${infoHash}`,
    }
  } finally {
    // Clean up injected manifest
    await fs.unlink(manifestPath).catch(() => {})
  }
}
```

## Server API Client (`src/server.ts`)

```typescript
export async function pushToServer(
  serverUrl: string,
  apiKey: string,
  torrent: Uint8Array,
  manifest: ZTManifest
): Promise<{ infoHash: string }> {
  const formData = new FormData()
  formData.append('torrent', new Blob([torrent]), 'site.torrent')
  formData.append('manifest', JSON.stringify(manifest))

  const res = await fetch(`${serverUrl}/api/publish`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Publish failed (${res.status}): ${body}`)
  }

  return res.json()
}

export async function waitForReady(
  servers: Array<{ url: string; apiKey: string }>,
  infoHash: string,
  opts: { timeout: number }
): Promise<void> {
  const deadline = Date.now() + opts.timeout

  while (Date.now() < deadline) {
    const results = await Promise.allSettled(
      servers.map(async (s) => {
        const res = await fetch(`${s.url}/api/status/${infoHash}`, {
          headers: { Authorization: `Bearer ${s.apiKey}` },
        })
        if (!res.ok) return { ready: false }
        return res.json() as Promise<{ ready: boolean }>
      })
    )

    const anyReady = results.some((r) => r.status === 'fulfilled' && r.value.ready)
    if (anyReady) return

    await new Promise((r) => setTimeout(r, 2000))
  }

  throw new Error('Timeout waiting for seed server to seed')
}
```

## Piece Length Strategy

Piece length affects download granularity and torrent overhead. For websites:

| Site Size | Recommended Piece Length | Pieces | Overhead |
| --------- | ------------------------ | ------ | -------- |
| < 256 KB  | 16 KB (16384)            | ~16    | Minimal  |
| < 1 MB    | 32 KB (32768)            | ~32    | Low      |
| 1-10 MB   | 64 KB (65536)            | ~156   | Low      |
| 10-100 MB | 256 KB (262144)          | ~390   | Medium   |
| > 100 MB  | 512 KB (524288)          | ~200+  | Medium   |

Auto-calculation:

```typescript
function autoPieceLength(totalSize: number): number {
  if (totalSize < 256 * 1024) return 16 * 1024
  if (totalSize < 1024 * 1024) return 32 * 1024
  if (totalSize < 10 * 1024 * 1024) return 64 * 1024
  if (totalSize < 100 * 1024 * 1024) return 256 * 1024
  return 512 * 1024
}
```

Small pieces are critical for web hosting — they allow the browser to start rendering before the entire site is downloaded.

## Package Configuration

### `package.json`

```json
{
  "name": "@z-torrent/publish",
  "version": "0.0.1",
  "description": "Publish static sites to z-torrent",
  "type": "module",
  "bin": {
    "z-torrent-publish": "dist/cli.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch"
  },
  "dependencies": {
    "@z-torrent/create": "workspace:*",
    "@z-torrent/parse": "workspace:*"
  },
  "devDependencies": {
    "tsdown": "^0.21.0",
    "typescript": "^5.9.0"
  }
}
```

### `tsdown.config.ts`

```typescript
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node20',
  dts: true,
  clean: true,
  sourcemap: true,
})
```

## Example: Publishing Sintel Demo

```bash
# In examples/sintel-web/
cat z-torrent.config.json
{
  "site": {
    "name": "Sintel — Z-Torrent Demo",
    "description": "Sintel short film streaming demo",
    "icon": "favicon.ico"
  },
  "type": "static",
  "publish": {
    "dir": "dist",
    "server": "https://seed.z-torrent.xyz",
    "apiKey": "$ZT_API_KEY"
  }
}

# Build the site
bun run build

# Publish
npx @z-torrent/publish

# Output:
# Publishing Sintel — Z-Torrent Demo...
#
#   Scanning 12 files (2.3 MB)
#   Creating torrent... 100%
#   Pushing to https://seed.z-torrent.xyz...
#   Waiting for server to seed...
#
# Published successfully!
#
#   URL:      https://z-torrent.xyz/08ada5a7a6183aae1e09d831df6748d566095a10
#   Hash:     08ada5a7a6183aae1e09d831df6748d566095a10
#   Magnet:   magnet:?xt=urn:btih:08ada5a...
#   Size:     2.3 MB
#   Files:    12
#   Pieces:   72 x 32 KB
```

## CI/CD Integration

Publish can run in CI pipelines:

```yaml
# GitHub Actions
- name: Deploy to z-torrent
  env:
    ZT_API_KEY: ${{ secrets.ZT_API_KEY }}
  run: |
    bun run build
    npx @z-torrent/publish
```

The `--output` flag allows saving the `.torrent` file as a build artifact for backup or manual distribution.
