# @z-torrent/lsd

### Local Service Discovery (BEP14)

Node.js implementation of [BEP 14](https://www.bittorrent.org/beps/bep_0014.html) — a SSDP-like mechanism (HTTP over UDP multicast) to announce participation in torrent swarms on the local network.

Used by [Z-Torrent](https://github.com/skrylnikov/z-torrent) discovery.

## Install

```bash
npm install @z-torrent/lsd
```

## Usage

```js
import { LSD } from '@z-torrent/lsd'
import crypto from 'crypto'

const opts = {
  peerId: crypto.randomBytes(20), // hex string or Uint8Array (e.g. Buffer)
  infoHash: crypto.randomBytes(20),
  port: 51413, // torrent client listen port
}

const lsd = new LSD(opts)

lsd.start()

lsd.on('peer', (peerAddress, infoHash) => {
  console.log('peer:', peerAddress, 'infoHash:', infoHash)
})

lsd.destroy()
```

## API

### `new LSD(opts)`

- `opts.peerId` — required, `string` or `Uint8Array` (20-byte id, hex string if string)
- `opts.infoHash` — required, `string` or `Uint8Array` (40-char hex or 20 raw bytes)
- `opts.port` — required, client port as `number` or `string`

### `lsd.start()`

Binds the multicast socket, joins the group, sends an announce, then repeats every 5 minutes.

### `lsd.destroy([callback])`

Closes the socket and clears the announce interval. Optional callback runs when the socket has closed.

### `lsd.destroyed`

Read-only: whether `destroy()` has been called.

## Events

### `peer`

`(peerAddress, infoHash)` — `peerAddress` is `host:port`; `infoHash` is the 40-character hex string from the announce.

### `warning`

Non-fatal issues (invalid remote message, multicast join failure, etc.). Payload may be a string or other value.

### `error`

Fatal socket errors.

## License

MIT
