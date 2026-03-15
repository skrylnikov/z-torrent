# z-torrent-browser

Browser build of Z-Torrent — WebRTC, Service Worker, Web API bindings.

Use this package for browser/SPA projects. For Node.js, use `z-torrent` instead.

## Installation

```bash
bun add z-torrent-browser webrtc-polyfill
```

## Usage

```javascript
import WebTorrent from 'z-torrent-browser'

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

Ensure `sw.min.js` is served from your app's public directory (copy from `node_modules/z-torrent-browser/dist/sw.min.js`).
