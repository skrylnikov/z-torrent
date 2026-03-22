# @z-torrent/node

Node.js entry for [Z-Torrent](https://github.com/skrylnikov/z-torrent): streaming BitTorrent client built on [`@z-torrent/core`](https://www.npmjs.com/package/@z-torrent/core) with TCP/µTP, DHT, trackers, LSD, and optional WebRTC (via `@thaunknown/simple-peer`).

## Install

```bash
npm install @z-torrent/node
```

## Usage

Use the **named** export `ZTorrent` (there is no default export).

```js
import { ZTorrent } from '@z-torrent/node'

const client = new ZTorrent({
  dht: true,
  tracker: true,
  lsd: true,
})

client.on('error', (err) => {
  console.error(err)
})

const torrent = client.add('magnet:?xt=urn:btih:…')

torrent.on('ready', () => {
  console.log('Torrent metadata ready', torrent.name)
})

// …

client.destroy(() => {
  console.log('Client destroyed')
})
```

Static fields on the class:

- `ZTorrent.VERSION` — package version string
- `ZTorrent.WEBRTC_SUPPORT` — whether WebRTC data channels are available
- `ZTorrent.UTP_SUPPORT` — whether µTP listener support is available (native `utp-native`)

## Scripts (package development)

```bash
bun run build      # tsdown → dist/
bun run typecheck  # tsc --noEmit (src only)
bun test           # fast suite (skips flaky localhost tracker/DHT integration)
bun run test-live  # sets Z_TORRENT_LIVE=1; needs working local UDP/TCP sockets
```

## License

MIT
