# Z-Torrent Web Portal — Technical Design

## Overview

The web portal at `z-torrent.xyz` is the user-facing entry point. It's a Vite + Svelte SPA that loads torrents containing websites and renders them in a fullscreen iframe. The portal manages the ZTorrent instance, Service Worker, and status indicator.

Location: `examples/web-portal/`

## Tech Stack

| Layer          | Choice                    | Reason                                                              |
| -------------- | ------------------------- | ------------------------------------------------------------------- |
| Build          | Vite 6                    | Already used in monorepo (sintel-landing), zTorrentSW plugin exists |
| UI             | Svelte 5                  | Lightweight, reactive, compiles away runtime                        |
| Styling        | CSS (vanilla or Tailwind) | Simple, no overhead                                                 |
| Torrent client | `@z-torrent/browser`      | Existing package                                                    |
| Service Worker | `@z-torrent/browser/sw`   | Existing SW, needs extensions for hosting mode                      |
| SW integration | `@z-torrent/browser/vite` | Existing Vite plugin to serve SW file                               |

## Project Structure

```
examples/web-portal/
  package.json
  vite.config.ts
  tsconfig.json
  index.html                 # Vite entry point
  public/
    favicon.svg
    og-image.png
  src/
    main.ts                  # App entry — mounts Svelte
    App.svelte               # Root component — router
    lib/
      torrent-loader.ts      # ZTorrent initialization + torrent loading logic
      manifest.ts            # Manifest parsing + validation
      url.ts                 # URL handling (hash extraction, history API)
    components/
      Landing.svelte         # Landing page — address bar, example links
      Viewer.svelte          # iframe container + loading screen
      StatusIndicator.svelte # Floating status indicator (bottom-left)
      StatusPanel.svelte     # Expanded panel (files, peers, speeds)
      LoadingScreen.svelte   # Progress bar, peer count, ETA
    stores/
      torrent.ts             # Svelte store for torrent state
```

## Routing

The portal uses simple hash-based routing (no library needed):

```
z-torrent.xyz/                     -> Landing page
z-torrent.xyz/{infoHash}           -> Load torrent, show viewer
z-torrent.xyz/{infoHash}/page/path -> Load torrent, navigate iframe to /page/path
```

URL handling in `src/lib/url.ts`:

```typescript
const INFO_HASH_REGEX = /^[a-f0-9]{40}$/i

export function parseRoute(pathname: string): {
  hash: string | null
  subpath: string
} {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return { hash: null, subpath: '' }

  const first = segments[0]
  if (INFO_HASH_REGEX.test(first)) {
    return {
      hash: first,
      subpath: segments.slice(1).join('/'),
    }
  }

  return { hash: null, subpath: '' }
}
```

Navigation updates the URL via `history.pushState` — no page reloads.

## Component Design

### `App.svelte`

Root component. Determines whether to show Landing or Viewer based on URL.

```svelte
<script lang="ts">
  import { parseRoute } from './lib/url'
  import Landing from './components/Landing.svelte'
  import Viewer from './components/Viewer.svelte'
  import StatusIndicator from './components/StatusIndicator.svelte'
  import { torrentState } from './stores/torrent'

  let currentHash = $state<string | null>(null)
  let subpath = $state('')

  function handleNavigation() {
    const route = parseRoute(window.location.pathname)
    currentHash = route.hash
    subpath = route.subpath
  }

  // Listen for browser back/forward
  $effect(() => {
    handleNavigation()
    window.addEventListener('popstate', handleNavigation)
    return () => window.removeEventListener('popstate', handleNavigation)
  })

  function onNavigate(hash: string) {
    history.pushState(null, '', `/${hash}`)
    currentHash = hash
  }
</script>

{#if currentHash}
  <Viewer hash={currentHash} {subpath} />
  <StatusIndicator />
{:else}
  <Landing {onNavigate} />
{/if}
```

### `Landing.svelte`

Main landing page with:

- Logo / branding
- Address input field (accepts infoHash, magnet URI, or z-torrent.xyz URL)
- Example links (Sintel demo, etc.)
- Brief explanation of how it works

```svelte
<script lang="ts">
  let { onNavigate } = $props<{ onNavigate: (hash: string) => void }>()
  let address = $state('')

  const EXAMPLES = [
    {
      name: 'Sintel Demo',
      hash: '08ada5a7a6183aae1e09d831df6748d566095a10',
      description: 'Short film landing page hosted on z-torrent',
    },
  ]

  function handleSubmit(e: Event) {
    e.preventDefault()
    const hash = extractHash(address)
    if (hash) onNavigate(hash)
  }

  function extractHash(input: string): string | null {
    // Accept: raw hash, magnet URI, z-torrent URL
    const trimmed = input.trim()
    if (/^[a-f0-9]{40}$/i.test(trimmed)) return trimmed
    const magnetMatch = trimmed.match(/btih:([a-f0-9]{40})/i)
    if (magnetMatch) return magnetMatch[1]
    const urlMatch = trimmed.match(/z-torrent\.xyz\/([a-f0-9]{40})/i)
    if (urlMatch) return urlMatch[1]
    return null
  }
</script>

<main class="landing">
  <h1>Z-Torrent</h1>
  <p>Decentralized web hosting powered by BitTorrent</p>

  <form onsubmit={handleSubmit}>
    <input
      type="text"
      bind:value={address}
      placeholder="Enter info hash, magnet URI, or URL..."
    />
    <button type="submit">Load</button>
  </form>

  <section class="examples">
    <h2>Examples</h2>
    {#each EXAMPLES as example}
      <a href="/{example.hash}" onclick|preventDefault={() => onNavigate(example.hash)}>
        <strong>{example.name}</strong>
        <span>{example.description}</span>
      </a>
    {/each}
  </section>
</main>
```

### `Viewer.svelte`

Manages the torrent lifecycle and renders the iframe:

```svelte
<script lang="ts">
  import { loadTorrent, type TorrentState } from '../lib/torrent-loader'
  import LoadingScreen from './LoadingScreen.svelte'

  let { hash, subpath } = $props<{ hash: string; subpath: string }>()

  let state = $state<TorrentState>({ phase: 'connecting' })
  let iframeSrc = $state<string | null>(null)

  $effect(() => {
    const controller = new AbortController()

    loadTorrent(hash, {
      signal: controller.signal,
      onProgress: (s) => { state = s },
    }).then((torrent) => {
      // Entry is ready — set iframe src
      const entry = state.manifest?.routing?.entry ?? 'index.html'
      const path = subpath || entry
      iframeSrc = `/z-torrent/${hash}/${path}`
      state = { ...state, phase: 'ready' }
    })

    return () => controller.abort()
  })
</script>

{#if state.phase !== 'ready' || !iframeSrc}
  <LoadingScreen {state} />
{/if}

{#if iframeSrc}
  <iframe
    src={iframeSrc}
    class="viewer-frame"
    class:visible={state.phase === 'ready'}
    title={state.manifest?.site?.name ?? 'Z-Torrent Site'}
    allowfullscreen
  ></iframe>
{/if}

<style>
  .viewer-frame {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    border: none;
    z-index: 1;
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  .viewer-frame.visible {
    opacity: 1;
  }
</style>
```

### `StatusIndicator.svelte`

Small floating indicator in the bottom-left corner:

```svelte
<script lang="ts">
  import { torrentState } from '../stores/torrent'
  import StatusPanel from './StatusPanel.svelte'

  let expanded = $state(false)
</script>

<!-- Indicator dot / mini bar -->
<button
  class="status-indicator"
  onclick={() => expanded = !expanded}
  aria-label="Torrent status"
>
  <span class="dot" class:seeding={$torrentState.phase === 'seeding'}></span>
  <span class="speed">
    {#if $torrentState.downloadSpeed}
      ↓ {formatSpeed($torrentState.downloadSpeed)}
    {/if}
    {#if $torrentState.uploadSpeed}
      ↑ {formatSpeed($torrentState.uploadSpeed)}
    {/if}
  </span>
  <span class="peers">{$torrentState.peerCount} peers</span>
</button>

{#if expanded}
  <StatusPanel onclose={() => expanded = false} />
{/if}

<style>
  .status-indicator {
    position: fixed;
    bottom: 12px;
    left: 12px;
    z-index: 10000;  /* above iframe */
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    font-size: 12px;
    cursor: pointer;
    font-family: monospace;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #f59e0b; /* amber — downloading */
  }
  .dot.seeding {
    background: #22c55e; /* green — seeding */
  }
</style>
```

### `StatusPanel.svelte`

Expanded panel with detailed info:

- Files list with download progress per file
- Peer list with connection type (WebRTC/TCP) and speeds
- Total download/upload speeds and ratios
- Torrent info (hash, piece count, piece size)
- Manifest info (site name, type, framework)
- Button to go back to portal landing

## Torrent Loader (`src/lib/torrent-loader.ts`)

Core logic for initializing ZTorrent and loading site torrents:

```typescript
import type { ZTManifest } from './manifest'

export interface TorrentState {
  phase: 'connecting' | 'metadata' | 'downloading' | 'ready' | 'seeding' | 'error'
  progress?: number // 0-1
  downloadSpeed?: number // bytes/sec
  uploadSpeed?: number // bytes/sec
  peerCount?: number
  downloaded?: number // bytes
  totalSize?: number // bytes
  timeRemaining?: number // ms
  manifest?: ZTManifest | null
  error?: string
}

interface LoadOptions {
  signal?: AbortSignal
  onProgress?: (state: TorrentState) => void
}

let clientPromise: Promise<ZTorrent> | null = null

/** Singleton ZTorrent instance */
async function getClient(): Promise<ZTorrent> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const [{ ZTorrent }, reg] = await Promise.all([
        import('@z-torrent/browser'),
        navigator.serviceWorker
          .register('/sw.min.js', { scope: '/' })
          .then(() => navigator.serviceWorker.ready),
      ])

      const client = new ZTorrent({
        tracker: {
          announce: [
            'wss://tracker.z-torrent.xyz',
            'wss://tracker.openwebtorrent.com',
            'wss://tracker.webtorrent.dev',
          ],
          rtcConfig: {
            iceServers: [
              {
                urls: [
                  'stun:turn.z-torrent.xyz:3478',
                  'stun:stun.l.google.com:19302',
                  'stun:stun.cloudflare.com:3478',
                ],
              },
              // TURN credentials loaded from portal config
            ],
            bundlePolicy: 'max-bundle' as RTCBundlePolicy,
          },
        },
      })

      client.createServer({
        controller: reg as unknown as ServiceWorkerRegistration,
      })

      return client
    })()
  }
  return clientPromise
}

export async function loadTorrent(infoHash: string, opts: LoadOptions = {}): Promise<Torrent> {
  const client = await getClient()

  // Check if already loaded
  const existing = await client.get(infoHash)
  if (existing) return existing

  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) {
      reject(new Error('Aborted'))
      return
    }

    const torrent = client.add(infoHash, (torrent) => {
      // Metadata received — read manifest
      const manifestFile = torrent.files.find((f) => f.name === 'zt-manifest.json')

      if (manifestFile) {
        // Prioritize manifest download
        manifestFile.select(7)
      }

      // Prioritize entry file
      const entryFile = torrent.files.find(
        (f) => f.name === 'index.html' || f.path.endsWith('/index.html')
      )
      if (entryFile) entryFile.select(6)

      // Progress updates
      const updateInterval = setInterval(() => {
        opts.onProgress?.({
          phase: torrent.done ? 'seeding' : 'downloading',
          progress: torrent.progress,
          downloadSpeed: torrent.downloadSpeed,
          uploadSpeed: torrent.uploadSpeed,
          peerCount: torrent.numPeers,
          downloaded: torrent.downloaded,
          totalSize: torrent.length,
          timeRemaining: torrent.timeRemaining,
        })
      }, 250)

      torrent.on('done', () => {
        clearInterval(updateInterval)
        resolve(torrent)
      })

      // If entry file is ready before full download
      if (entryFile) {
        // Check readiness periodically or on piece events
        torrent.on('download', () => {
          if (entryFile.done) {
            resolve(torrent)
          }
        })
      }

      opts.signal?.addEventListener('abort', () => {
        clearInterval(updateInterval)
        client.remove(infoHash)
        reject(new Error('Aborted'))
      })
    })

    torrent.on('error', (err: Error) => reject(err))
  })
}
```

## Service Worker Changes

The existing SW at `packages/browser/src/lib/worker-server.ts` already handles the URL pattern `/z-torrent/{infoHash}/{filePath}`. For hosting, we need changes in `ServerBase`:

### `server-base.ts` Changes

1. **Remove forced download for documents** — lines 166-170 currently force `Content-Disposition: attachment` for navigation requests. Add a hosting mode flag:

```typescript
// In serveFile():
if (req.destination === 'document' && !this.hostingMode) {
  // Force download only in non-hosting mode
  headers['Content-Type'] = 'application/octet-stream'
  headers['Content-Disposition'] = `attachment; filename="${file.name}"`
}
```

2. **Caching headers** — torrent content is immutable (content-addressed):

```typescript
if (this.hostingMode) {
  headers['Cache-Control'] = 'public, max-age=31536000, immutable'
  headers['ETag'] = `"${torrent.infoHash}:${file.path}"`
} else {
  headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0'
}
```

3. **Relax CSP** — for hosting mode, remove restrictive CSP:

```typescript
if (!this.hostingMode) {
  headers['Content-Security-Policy'] =
    "base-uri 'none'; frame-ancestors 'none'; form-action 'none';"
}
```

4. **Directory index resolution** — add to `onRequest()`:

```typescript
// After exact file match fails:
if (!file) {
  // Try directory index
  file = torrent.files.find((f) => f.path.replace(/\\/g, '/') === `${filePath}/index.html`)
}
if (!file) {
  // Try .html extension
  file = torrent.files.find((f) => f.path.replace(/\\/g, '/') === `${filePath}.html`)
}
```

5. **SPA fallback** — if no file found and manifest has SPA type:

```typescript
if (!file && manifest?.type === 'spa') {
  const fallback = manifest.routing?.fallback ?? 'index.html'
  file = torrent.files.find((f) => f.path.replace(/\\/g, '/') === fallback)
}
```

6. **Remove favicon 404 hardcode** — let it pass through to file lookup.

### `worker-server.ts` Changes

1. **Full MIME coverage** — bundle `mime/lite` in the SW, or ensure BrowserServer always returns correct Content-Type (it already does via `file.type`).

2. **Increase stream timeout** — for asset loading from slow swarms:

```typescript
const portTimeoutDuration = 30_000 // was 5_000
```

## Svelte Store (`src/stores/torrent.ts`)

```typescript
import { writable } from 'svelte/store'
import type { TorrentState } from '../lib/torrent-loader'

export const torrentState = writable<TorrentState>({
  phase: 'connecting',
})
```

## Build Configuration

### `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { zTorrentSW } from '@z-torrent/browser/vite'

export default defineConfig({
  plugins: [svelte(), zTorrentSW()],
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
})
```

### `package.json`

```json
{
  "name": "@z-torrent/web-portal",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@z-torrent/browser": "workspace:*"
  },
  "devDependencies": {
    "svelte": "^5.0.0",
    "@sveltejs/vite-plugin-svelte": "^5.0.0",
    "vite": "^6.0.0",
    "typescript": "^5.9.0"
  }
}
```

## Deployment

The portal builds to static files (`dist/`). Deploy with:

- **Nginx** — serve `dist/`, all routes fallback to `index.html` (SPA)
- **Docker** — same as sintel-landing, Nginx container
- **CDN** — Cloudflare Pages, Vercel, etc.

SPA fallback in Nginx:

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets aggressively
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Host SDK Integration

### Overview

The Host SDK (`@z-torrent/host-sdk`) enables sites hosted inside the portal iframe to request additional torrents from the portal's ZTorrent client. The primary use case is video streaming — a hosted site can add a video torrent and get a URL to use as `<video src>`.

Location: `packages/host-sdk/`

### PostMessage Protocol

All messages use `window.parent.postMessage()` from the iframe and `window.addEventListener('message', ...)` in the portal.

#### Request: Add Torrent

```typescript
// iframe → parent
{
  type: 'z-torrent:add-torrent',
  id: string,          // unique request ID (for correlating responses)
  magnetURI: string    // magnet link or info hash
}
```

#### Response: Torrent Added

```typescript
// parent → iframe
{
  type: 'z-torrent:torrent-added',
  id: string,          // matches request id
  files: Record<string, string>  // { filename: '/z-torrent/<hash>/<filepath>' }
}
```

#### Progress Update

```typescript
// parent → iframe (periodic, while downloading)
{
  type: 'z-torrent:torrent-progress',
  id: string,
  progress: number,        // 0-1
  downloadSpeed: number,   // bytes/sec
  numPeers: number
}
```

#### Error

```typescript
// parent → iframe
{
  type: 'z-torrent:torrent-error',
  id: string,
  error: string
}
```

### SDK Public API

```typescript
const host = new ZTorrentHost()

const { files } = await host.add(magnetURI, {
  onProgress: ({ progress, downloadSpeed, numPeers }) => {
    // optional progress callback
  },
})

// files: { 'Sintel.mp4': '/z-torrent/08ada5a7a6183aae1e09d831df6748d566095a10/Sintel.mp4' }

const video = document.querySelector('video')
video.src = files['Sintel.mp4']
video.play()
```

The SDK is built as a standalone IIFE bundle (`z-torrent-host-sdk.min.js`) that sets `window.ZTorrentHost`. Hosted sites include it via `<script>` and use it without any build tool dependency.

### How It Works

1. **SDK in iframe** calls `window.parent.postMessage({ type: 'z-torrent:add-torrent', ... })`
2. **Portal Viewer** receives the message, calls `getClient()` to get the singleton ZTorrent instance
3. **Portal adds the torrent** via `client.add(magnetURI, callback)`
4. **On metadata received**, the portal collects all file paths and builds URLs: `/z-torrent/<hash>/<filepath>`
5. **Portal posts back** `{ type: 'z-torrent:torrent-added', files }` to the iframe
6. **SDK resolves the promise** with the file URL map
7. **Hosted site sets** `<video src="/z-torrent/<hash>/Sintel.mp4">`
8. **Service Worker** intercepts the fetch, streams data from the torrent via the existing MessageChannel pipeline
9. **Range requests** (HTTP 206) are handled by `ServerBase.serveFile`, enabling video seeking

### Portal Implementation (Viewer.svelte)

The message handler in `Viewer.svelte`:

```typescript
window.addEventListener('message', (event) => {
  if (event.data?.type !== 'z-torrent:add-torrent') return

  const { id, magnetURI } = event.data

  const client = await getClient()

  client.add(magnetURI, (torrent) => {
    const files: Record<string, string> = {}
    for (const file of torrent.files) {
      files[file.name] = `/z-torrent/${torrent.infoHash}/${file.path}`
    }

    // Send file URLs back to iframe
    event.source.postMessage({ type: 'z-torrent:torrent-added', id, files }, '*')

    // Send progress updates
    const interval = setInterval(() => {
      event.source.postMessage(
        {
          type: 'z-torrent:torrent-progress',
          id,
          progress: torrent.progress,
          downloadSpeed: torrent.downloadSpeed,
          numPeers: torrent.numPeers,
        },
        '*'
      )
    }, 1000)

    torrent.on('done', () => clearInterval(interval))
  })
})
```

### Video Streaming

Video streaming works without any special handling beyond the standard SW file serving:

- The browser's `<video>` element sends range requests (`Range: bytes=0-`)
- `ServerBase.serveFile` handles range requests with HTTP 206 partial content
- The SW streams pieces from the torrent as they become available
- The ZTorrent client automatically prioritizes pieces needed for the current playback position
- DLNA-compatible headers are set by `ServerBase` for broad compatibility

This is the same mechanism used by `examples/sintel-landing/` for direct video streaming.

## UX States

```
1. CONNECTING
   "Connecting to peers..."
   Spinner, no progress bar

2. METADATA
   "Fetching torrent metadata..."
   Spinner, peer count

3. DOWNLOADING
   "Loading site... 45%"
   Progress bar, speed, peers, ETA
   (show site name from manifest if available)

4. READY
   iframe visible, loading screen fades out
   Status indicator in corner

5. SEEDING
   Same as READY but indicator dot turns green
   Shows upload speed

6. ERROR
   "Could not load site"
   Error message, retry button
   Possible reasons: no peers, invalid hash, network error
```
