# @z-torrent/ut-pex

### BitTorrent Extension for Peer Discovery (PEX) (BEP11)

Node.js implementation of the [ut_pex protocol (BEP11)](http://bittorrent.org/beps/bep_0011.html), which is the most popular PEX (peer exchange) protocol used by bittorrent clients.

The purpose of this extension is to allow peers to exchange known peers directly with each other, thereby facilitating more efficient peer discovery and healthier swarms.

The best description of the (nonstandardized) ut_pex protocol I could find is in section 2.1.4.3 of this [paper](http://www.di.unipi.it/~ricci/XR-EE-LCN_2010_010.pdf).

Works in the browser. This module is used by [Z-Torrent](https://z-torrent.xyz).

## install

```
npm install @z-torrent/ut-pex
```

## usage

This package should be used with [@z-torrent/protocol](https://www.npmjs.com/package/@z-torrent/protocol), which supports a plugin-like system for extending the protocol with additional functionality.

Say you're already using `@z-torrent/protocol`. Your code might look something like this:

```js
import Protocol from '@z-torrent/protocol'
import net from 'net'

net
  .createServer((socket) => {
    const wire = new Protocol()
    socket.pipe(wire).pipe(socket)

    // handle handshake
    wire.on('handshake', (infoHash, peerId) => {
      wire.handshake(
        new TextEncoder().encode('my info hash'),
        new TextEncoder().encode('my peer id')
      )
    })
  })
  .listen(6881)
```

To add support for PEX, simply modify your code like this:

```js
import Protocol from '@z-torrent/protocol'
import net from 'net'
import { UtPex } from '@z-torrent/ut-pex'

net
  .createServer((socket) => {
    const wire = new Protocol()
    socket.pipe(wire).pipe(socket)

    // initialize the extension
    wire.use(UtPex)

    // all `ut_pex` functionality can now be accessed at wire.ut_pex

    // (optional) start sending peer information to remote peer
    wire.ut_pex.start()

    // 'peer' event will fire for every new peer sent by the remote peer
    wire.ut_pex.on('peer', (peer, flags) => {
      // got a peer
      // probably add it to peer connections queue
    })

    // handle handshake
    wire.on('handshake', (infoHash, peerId) => {
      wire.handshake(
        new TextEncoder().encode('my info hash'),
        new TextEncoder().encode('my peer id')
      )
    })
  })
  .listen(6881)
```

## methods

### start

Start sending regular PEX updates to the remote peer. Use `addPeer` and `dropPeer` to control the
content of PEX messages. PEX messages will be sent once every ~65 seconds.

```js
wire.ut_pex.start()
```

Note that ut_pex may be used for one-way peer discovery without sending PEX updates to the remote peer,
but this use case is discouraged because PEX, like bittorrent is more efficient through altruism.

### stop

Stop sending PEX updates to the remote peer.

```js
wire.ut_pex.stop()
```

### reset

Stops sending updates to the remote peer and resets internal state of peers seen.

```js
wire.ut_pex.reset()
```

### addPeer

Adds an IPv4 peer to the locally discovered peer list to send with the next PEX message.

```js
const peer = '127.0.0.1:6889'
const flags = {
  prefersEncryption: false,
  isSender: true,
  supportsUtp: true,
  supportsUtHolepunch: false,
  isReachable: false,
}

wire.ut_pex.addPeer(peer, flags)
```

### addPeer6

Adds an IPv6 peer to the locally discovered peer list to send with the next PEX message.

```js
const peer = '[::1]:6889'
const flags = {
  prefersEncryption: false,
  isSender: true,
  supportsUtp: true,
  supportsUtHolepunch: false,
  isReachable: false,
}

wire.ut_pex.addPeer6(peer, flags)
```

### dropPeer

Adds an IPv4 peer to the locally dropped peer list to send with the next PEX message.

```js
wire.ut_pex.dropPeer('127.0.0.1:6889')
```

### dropPeer6

Adds an IPv6 peer to the locally dropped peer list to send with the next PEX message.

```js
wire.ut_pex.dropPeer6('[::1]:6889')
```

## events

### event: 'peer'

Fired for every new peer received from PEX.

```js
wire.ut_pex.on('peer', (peer, flags) => {
  const parts = peer.split(':')
  const ip = parts[0]
  const port = parts[1]
  // ...
})
```

Note: the event will not fire if the peer does not support ut_pex or if they don't respond.

### event: 'dropped'

Fired for every peer dropped from the swarm notified via PEX.

```js
wire.ut_pex.on('dropped', (peer) => {
  const parts = peer.split(':')
  const ip = parts[0]
  const port = parts[1]
  // ...
})
```

Note: the event will not fire if the peer does not support ut_pex or if they don't respond.

## flags

In order to handle [ut_pex protocol (BEP11)](http://bittorrent.org/beps/bep_0011.html) bit-flags in a more humand friendly format, the given boolean based Object has been defined.

```js
const flags = {
  prefersEncryption: Boolean,
  isSender: Boolean,
  supportsUtp: Boolean,
  supportsUtHolepunch: Boolean,
  isReachable: Boolean,
}
```

## license

MIT. Copyright (c) [Dmitriy Skrylnikov](https://github.com/skrylnikov).
