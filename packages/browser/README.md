# @z-torrent/browser

Browser build of Z-Torrent — WebRTC, Service Worker, Web API bindings.

Use this package for browser/SPA projects. For Node.js, use [`@z-torrent/node`](https://www.npmjs.com/package/@z-torrent/node).

## Install

```bash
npm install @z-torrent/browser
# optional, for WebRTC in environments that need it:
npm install webrtc-polyfill
```

## Bundler-friendly entry (default)

The main export (`@z-torrent/browser`) is **unbundled ESM**: dependencies such as `@z-torrent/core`, `@z-torrent/tracker`, and `@thaunknown/simple-peer` stay external so your bundler (Vite, Webpack, etc.) can tree-shake and dedupe. Configure Node polyfills in your bundler where needed (e.g. `vite-plugin-node-polyfills`).

```javascript
import { ZTorrent } from '@z-torrent/browser'

const client = new ZTorrent()
```

Types: `dist/index.d.ts`. For full client/torrent typings, depend on `@z-torrent/core` as well.

## Standalone pre-bundled build

For CDN, a plain `<script type="module">`, or any setup **without** a bundler, use the standalone subpath (self-contained, minified):

```javascript
import { ZTorrent } from '@z-torrent/browser/standalone'
```

This maps to `dist/z-torrent.min.js` and includes browser polyfills for transitive Node APIs.

## Service worker

Streaming and `createServer` require a service worker registered at a URL under your site origin (browsers do not load workers from bare `node_modules` URLs).

### Vite / Astro

Use the helper plugin from `@z-torrent/browser/vite`:

```javascript
import { zTorrentSW } from '@z-torrent/browser/vite'

export default defineConfig({
  vite: {
    plugins: [zTorrentSW()],
  },
})
```

By default it serves and emits `sw.min.js` at the site root. Register it with:

```javascript
const reg = await navigator.serviceWorker.register('/sw.min.js', { scope: '/' })
await navigator.serviceWorker.ready
client.createServer({ controller: reg })
```

Optional: `zTorrentSW({ fileName: 'z-torrent-sw.js' })` if you need a different filename.

### Without Vite

Copy `node_modules/@z-torrent/browser/dist/sw.min.js` into your static/public directory, or resolve the file via the package export `@z-torrent/browser/sw` and copy it in your build script.

### MIME and `<video>`

Playback in `<video>` needs a correct `Content-Type` on the service worker response. Built-in overrides include Matroska (e.g. `.mkv` → `video/x-matroska`); see `@z-torrent/utils/streaming-mime`.

## Example (full flow)

```javascript
import { ZTorrent } from '@z-torrent/browser'

const client = new ZTorrent()

const reg = await navigator.serviceWorker.register('/sw.min.js', { scope: '/' })
await navigator.serviceWorker.ready
client.createServer({ controller: reg })

client.add(magnetUri, (torrent) => {
  const file = torrent.files.find((f) => f.name.endsWith('.mp4'))
  file?.streamTo(videoElement)
})
```

## Scripts

- `bun run build` — bundler entry (`index.js`), standalone (`z-torrent.min.js`), service worker (`sw.min.js`), Vite plugin (`vite-plugin.js`)
- `bun run typecheck` — `tsc --noEmit`
- `bun test` — public API tests (run after build)
