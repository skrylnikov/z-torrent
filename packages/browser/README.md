# @z-torrent/browser

Browser build of Z-Torrent — WebRTC, Service Worker, Web API bindings.

Use this package for browser/SPA projects. For Node.js, use [`@z-torrent/node`](https://www.npmjs.com/package/@z-torrent/node).

## Install

```bash
npm install @z-torrent/browser
# optional, for WebRTC in environments that need it:
npm install webrtc-polyfill
```

Some setups alias this package as `z-torrent-browser` (see example below).

## Usage

```javascript
import { WebTorrent } from '@z-torrent/browser'

const client = new WebTorrent()

// Register service worker for streaming
const reg = await navigator.serviceWorker.register('/sw.min.js', { scope: '/' })
await navigator.serviceWorker.ready
client.createServer({ controller: reg })

client.add(magnetUri, (torrent) => {
  const file = torrent.files.find((f) => f.name.endsWith('.mp4'))
  file?.streamTo(videoElement)
})
```

Copy `node_modules/@z-torrent/browser/dist/sw.min.js` into your public directory (or serve it at a stable URL). The package also exposes the subpath `@z-torrent/browser/sw` → `./dist/sw.min.js` for bundlers that copy dependencies from `exports`.

## TypeScript

Types for the entry bundle are published as `dist/z-torrent.min.d.ts`. For full client/torrent typings, depend on `@z-torrent/core` as well.

## Scripts

- `bun run build` — browser client bundle + service worker
- `bun run typecheck` — `tsc --noEmit`
- `bun test` — public API tests (run after build)
