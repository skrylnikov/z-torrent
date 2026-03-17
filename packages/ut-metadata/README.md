# @z-torrent/ut-metadata

### BitTorrent Extension for Peers to Send Metadata Files (BEP 9)

JavaScript implementation of the [Extension for Peers to Send Metadata Files (BEP 9)](http://www.bittorrent.org/beps/bep_0009.html). Use with [@z-torrent/protocol](https://www.npmjs.com/package/@z-torrent/protocol).

The purpose of this extension is to allow clients to join a swarm and complete a download without the need of downloading a .torrent file first. This extension instead allows clients to download the metadata from peers. It makes it possible to support magnet links, a link on a web page only containing enough information to join the swarm (the info hash).

### install

```
npm install @z-torrent/ut-metadata
```

### usage

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

To add support for BEP 9, simply modify your code like this:

```js
import Protocol from '@z-torrent/protocol'
import net from 'net'
import { createUtMetadata } from '@z-torrent/ut-metadata'

net
  .createServer((socket) => {
    const wire = new Protocol()
    socket.pipe(wire).pipe(socket)

    // initialize the extension
    wire.use(createUtMetadata())

    // all `ut_metadata` functionality can now be accessed at wire.ut_metadata

    // ask the peer to send us metadata
    wire.ut_metadata.fetch()

    // 'metadata' event will fire when the metadata arrives and is verified to be correct!
    wire.ut_metadata.on('metadata', (metadata) => {
      // got metadata!
      // Note: the event will not fire if the peer does not support ut_metadata, if they
      // don't have metadata yet either, if they repeatedly send invalid data, or if they
      // simply don't respond.
    })

    // optionally, listen to the 'warning' event if you want to know that metadata is
    // probably not going to arrive for one of the above reasons.
    wire.ut_metadata.on('warning', (err) => {
      console.log(err.message)
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

### api

#### `createUtMetadata([metadata])`

Factory function that creates an extension class for use with `wire.use()`. If you have the torrent metadata (Uint8Array), pass it as an argument so it's made available to the peer.

```js
import { readFileSync } from 'fs'
import { createUtMetadata } from '@z-torrent/ut-metadata'

const metadata = readFileSync(__dirname + '/file.torrent')
wire.use(createUtMetadata(metadata))
```

**Note:** `createUtMetadata` is a factory function, not a constructor. Do not use `new` with it.

#### `ut_metadata.fetch()`

Ask the peer to send metadata.

#### `ut_metadata.cancel()`

Stop asking the peer to send metadata.

#### `ut_metadata.setMetadata(metadata)`

Set the metadata. If you didn't have the metadata at the time `ut_metadata` was
initialized, but you end up getting it from another peer (or somewhere else), you should
call `setMetadata` so the metadata will be available to the peer.

#### `ut_metadata.on('metadata', function (metadata) {})`

Fired when metadata is available and verified to be correct. Called with a single
parameter of type Uint8Array.

```js
wire.ut_metadata.on('metadata', (metadata) => {
  console.log(metadata instanceof Uint8Array) // true
})
```

Note: the event will not fire if the peer does not support ut_metadata, if they
don't have metadata yet either, if they repeatedly send invalid data, or if they
simply don't respond.

#### `ut_metadata.on('warning', function (err) {})`

Fired if:

- the peer does not support ut_metadata
- the peer doesn't have metadata yet
- the peer repeatedly sent invalid data

```js
wire.ut_metadata.on('warning', (err) => {
  console.log(err.message)
})
```

### license

MIT. Copyright (c) [Dmitriy Skrylnikov](https://github.com/skrylnikov).
