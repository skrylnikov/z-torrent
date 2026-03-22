# @z-torrent/protocol

[![npm](https://img.shields.io/npm/v/@z-torrent/protocol.svg)](https://www.npmjs.com/package/@z-torrent/protocol)

Simple, robust [BitTorrent peer wire protocol](https://wiki.theory.org/BitTorrentSpecification#Peer_wire_protocol_.28TCP.29) implementation (TypeScript, ESM). Used by [Z-Torrent](https://github.com/skrylnikov/z-torrent).

Works in Node.js and in the browser when bundled (e.g. Vite, esbuild, Webpack).

## Install

```bash
npm install @z-torrent/protocol
```

## Usage

The protocol is implemented as a **duplex stream**, so you pipe to and from it.

| duplex streams                                                                                           | a.pipe(b).pipe(a)                                                                                            |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| ![duplex streams](https://raw.github.com/substack/lxjs-stream-examples/master/images/duplex_streams.png) | ![a.pipe(b).pipe(a)](https://raw.github.com/substack/lxjs-stream-examples/master/images/a_pipe_b_pipe_a.png) |

(Images from the ["harnessing streams"](https://github.com/substack/lxjs-stream-examples/blob/master/slides.markdown) talk by substack.)

```js
import Wire from '@z-torrent/protocol'
import net from 'node:net'

net
  .createServer((socket) => {
    const wire = new Wire()

    socket.pipe(wire).pipe(socket)

    wire.on('handshake', (infoHash, peerId) => {
      // infoHash and peerId are hex strings from the peer
      wire.handshake(infoHash, peerId)
    })

    wire.on('unchoke', () => {
      console.log('peer is no longer choking us: ' + wire.peerChoking)
    })
  })
  .listen(6881)
```

## Methods

### Handshaking

Send and receive a handshake from the peer. This is the first message.

```js
wire.handshake(infoHash, peerId, { dht: true })
wire.on('handshake', (infoHash, peerId, extensions) => {
  console.log(extensions.dht) // supports DHT (BEP-0005)
  console.log(extensions.extended) // supports extension protocol (BEP-0010)
})
```

For `wire.handshake()`, `infoHash` and `peerId` must be **20 bytes** each, as a hex `string`, `Uint8Array`, or Node `Buffer`.

### Choking

```js
wire.peerChoking
wire.amChoking

wire.on('choke', () => {})
wire.on('unchoke', () => {})
```

### Interested

```js
wire.peerInterested
wire.amInterested

wire.on('interested', () => {})
wire.on('uninterested', () => {})
```

### Bitfield

```js
wire.bitfield(buffer)
wire.on('bitfield', (bitfield) => {})

wire.have(pieceIndex)
wire.on('have', (pieceIndex) => {})

wire.peerPieces.get(i) // true if peer has piece i
```

`wire.peerPieces` is a `BitField`, see [bitfield](https://www.npmjs.org/package/bitfield).

### Requests

```js
wire.request(pieceIndex, offset, length, (err, block) => {
  if (err) return
})

wire.cancel(pieceIndex, offset, length)

wire.on('request', (pieceIndex, offset, length, callback) => {
  callback(null, block)
})

wire.requests
wire.peerRequests
```

```js
wire.setTimeout(5000)
```

### DHT and port

```js
wire.port(dhtPort)
wire.on('port', (dhtPort) => {})

wire.peerExtensions.dht
wire.peerExtensions.extended
```

### Keep-alive

```js
wire.setKeepAlive(true)
wire.on('keep-alive', () => {})
```

### Fast extension (BEP 6)

[BitTorrent Fast Extension (BEP 6)](http://www.bittorrent.org/beps/bep_0006.html).

```js
wire.handshake(infoHash, peerId, { fast: true })

wire.hasFast

wire.haveNone()
wire.on('have-none', () => {})

wire.haveAll()
wire.on('have-all', () => {})

wire.suggest(pieceIndex)
wire.on('suggest', (pieceIndex) => {})

wire.on('allowed-fast', (pieceIndex) => {})

wire.peerAllowedFastSet

wire.reject(pieceIndex, offset, length)
wire.on('reject', (pieceIndex, offset, length) => {})
```

### Extension protocol (BEP 10)

[BitTorrent Extension Protocol (BEP 10)](http://www.bittorrent.org/beps/bep_0010.html).

```js
wire.extended(code, buffer)
```

**@z-torrent/protocol** exposes an extension API (`wire.use()`) for BEP 10 extensions such as [BEP 9 (ut_metadata)](http://www.bittorrent.org/beps/bep_0009.html).

### Transfer stats

```js
wire.uploaded
wire.downloaded
wire.uploadSpeed()
wire.downloadSpeed()

wire.on('download', (numberOfBytes) => {})
wire.on('upload', (numberOfBytes) => {})
```

## Extension API

Common extensions in this monorepo:

- [@z-torrent/ut-metadata](https://www.npmjs.com/package/@z-torrent/ut-metadata) — BEP 9 (metadata over the wire)
- [@z-torrent/ut-pex](https://www.npmjs.com/package/@z-torrent/ut-pex) — BEP 11 (PEX)

Register an extension with `wire.use()`. Extensions can hook `handshake`, `extended`, etc.

Example with **@z-torrent/ut-metadata**:

```js
import Wire from '@z-torrent/protocol'
import { createUtMetadata } from '@z-torrent/ut-metadata'
import net from 'node:net'

net
  .createServer((socket) => {
    const wire = new Wire()
    socket.pipe(wire).pipe(socket)

    wire.use(createUtMetadata())

    wire.ut_metadata.fetch()

    wire.ut_metadata.on('metadata', (metadata) => {
      // Uint8Array .torrent info payload
    })

    wire.ut_metadata.on('warning', (err) => {
      console.log(err.message)
    })

    wire.on('handshake', (infoHash, peerId) => {
      wire.handshake(infoHash, peerId)
    })
  })
  .listen(6881)
```

See [@z-torrent/ut-metadata](https://github.com/skrylnikov/z-torrent/tree/main/packages/ut-metadata) for implementation details.

## License

MIT. Based on [bittorrent-protocol](https://github.com/webtorrent/bittorrent-protocol) by [Feross Aboukhadijeh](https://feross.org), Mathias Buus, and [WebTorrent, LLC](https://webtorrent.io). Maintained as **@z-torrent/protocol** in [z-torrent](https://github.com/skrylnikov/z-torrent).
