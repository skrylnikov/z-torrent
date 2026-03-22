# @z-torrent/discovery

Combines DHT, tracker, and LSD (Local Service Discovery) clients behind one API for finding BitTorrent peers (including WebRTC-capable swarms). Used by [Z-Torrent](https://z-torrent.xyz).

## Install

```bash
npm install @z-torrent/discovery
```

## Usage

```js
import { Discovery } from '@z-torrent/discovery'
import { randomBytes } from 'uint8-util'

const discovery = new Discovery({
  infoHash: randomBytes(20), // or 40-char hex string
  peerId: randomBytes(20),
  port: 6881,
  announce: ['udp://tracker.example.com:80'],
})

discovery.on('peer', (peer, source) => {
  // source is 'tracker', 'dht', or 'lsd'
})

discovery.on('dhtAnnounce', () => {
  // DHT announce round finished
})

await new Promise((resolve) => discovery.destroy(resolve))
```

## Constructor options

Required:

- `infoHash` — hex string or `Uint8Array` (20 bytes)
- `peerId` — hex string or `Uint8Array` (20 bytes)
- `port` — client listening port (required in Node.js; omitted when `process.browser` is set)

Optional:

- `announce` — tracker URLs (as in a magnet link)
- `intervalMs` — announce interval (default 15 minutes)
- `tracker` — `false`, `true`, or tracker client options object
- `dht` — `false`, `true`, DHT options object, or an existing `DHT` instance
- `dhtPort` — listen port for a DHT instance created by this module
- `lsd` — `false` or `true` (default on when the LSD package is available)
- `userAgent` — HTTP user-agent for tracker requests

The module schedules periodic announces to the DHT and trackers automatically.

## Methods

### `updatePort(port)`

When the client port changes, re-announce to the DHT and recreate the tracker client.

### `complete(opts?)`

Tell trackers the download completed (seeding). No-op when trackers are disabled.

### `destroy(cb?)`

Stop tracker, DHT (if owned), LSD, and clear timers.

## Events

- `peer` — `(peer, source)`; `source` is `'tracker'`, `'dht'`, or `'lsd'`. In Node, `peer` is usually a `host:port` string.
- `dhtAnnounce` — a DHT announce round completed.
- `trackerAnnounce` — tracker scrape/announce update.
- `warning` — non-fatal tracker, DHT, or LSD issue.
- `error` — fatal subsystem error.

## License

MIT
