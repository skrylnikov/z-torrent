# @z-torrent/tracker

BitTorrent tracker **client** and **server** for Node.js and the browser: HTTP(S), UDP ([BEP 15](https://www.bittorrent.org/beps/bep_0015.html)), and WebSocket / WebRTC-style signaling.

## Install

```bash
npm install @z-torrent/tracker
```

Requires **Node.js ≥ 18** (for `fetch` in the HTTP tracker client).

## API

Use **named imports** from the package root:

```js
import { Client, Server } from '@z-torrent/tracker'
```

### Subpath exports

| Path                                   | Purpose                                                                                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `@z-torrent/tracker`                   | `Client` and `Server`                                                                                                                   |
| `@z-torrent/tracker/client`            | Tracker client only. In bundlers, the `browser` condition resolves to a build **without** Node-only HTTP/UDP (WebSocket trackers only). |
| `@z-torrent/tracker/server`            | Tracker server only                                                                                                                     |
| `@z-torrent/tracker/websocket-tracker` | WebSocket tracker implementation (advanced)                                                                                             |

### Client (Node)

```js
import { Client } from '@z-torrent/tracker'

const client = new Client({
  infoHash: '0123456789012345678901234567890123456789', // 40-char v1 info hash hex (or Uint8Array)
  peerId: Buffer.from('01234567890123456789'), // 20 bytes
  announce: ['http://tracker.example/announce'],
  port: 6881,
})

client.on('error', (err) => {
  console.error(err)
})
client.on('warning', (err) => {
  console.warn(err)
})

client.start()

client.on('update', (data) => {
  console.log(data.announce, data.complete, data.incomplete)
})

client.stop()
client.destroy()
```

For **WebSocket / WebRTC** trackers in Node, pass a WebRTC implementation (for example [`wrtc`](https://www.npmjs.com/package/wrtc)):

```js
import wrtc from 'wrtc'

const client = new Client({
  infoHash,
  peerId,
  announce: ['ws://tracker.example'],
  port: 6881,
  wrtc,
})
```

### Client (browser)

Import the browser client entry so the bundle does not pull in Node-only UDP/HTTP stack:

```js
import { Client } from '@z-torrent/tracker/client'

const client = new Client({
  infoHash,
  peerId,
  announce: ['wss://tracker.example'],
  rtcConfig: { iceServers: [] },
})
```

### Server

```js
import { Server } from '@z-torrent/tracker'

const server = new Server({
  http: true,
  udp: true,
  ws: true,
  stats: true,
})

server.on('error', (err) => console.error(err))
server.on('warning', (err) => console.warn(err))

server.listen(8000, () => {
  console.log('listening')
})
```

### Scrape

```js
import { Client } from '@z-torrent/tracker'

Client.scrape({ announce, infoHash: [hash1, hash2] }, (err, results) => {
  // ...
})
```

## CLI

The package exposes the `bittorrent-tracker` binary (see `package.json` `bin`).

```bash
npx bittorrent-tracker --help
```

## License

MIT. See [LICENSE](./LICENSE).
