# @z-torrent/core

Platform-agnostic torrent client logic shared by Node.js and browser builds. Adapters implement `PlatformAdapter` (chunk store, discovery, optional TCP pool, HTTP server, DHT, etc.).

## Install

```bash
npm install @z-torrent/core
```

## Usage

```js
import { ZTorrentCore, FileIterator, VERSION } from '@z-torrent/core'

const client = new ZTorrentCore({
  platform: myPlatformAdapter,
})

const torrent = client.add('magnet:?xt=urn:btih:...', {}, (t) => {
  console.log('ready', t.infoHash)
})

const file = torrent.files[0]
const stream = await file.stream()
```

## Public API (high level)

| Export | Role |
|--------|------|
| `ZTorrentCore` | Client; requires `platform` in constructor options |
| `Torrent` | Single swarm / transfer |
| `File`, `FileIterator` | File view and async byte iteration |
| `Peer`, `WebConn`, `RarityMap` | Wire / peer helpers |
| `ServerBase` | Shared HTTP index/file serving logic |
| `Selections` | Piece interval selection utilities |
| `VERSION` | Package version string |
| Types | `PlatformAdapter`, `ZTorrentClient`, `TorrentOpts`, server types, etc. |

### Platform hooks on `ZTorrentCore`

Used by the Node connection pool and similar integrations:

- `notifyListening()` — TCP/uTP listeners are up
- `shutdownWithError(err, cb?)` — tear down client after a fatal error
- `getTorrentByPe3Hash(hash)` — lookup by PE3 handshake hash
- `detachTorrent(torrent, opts?, cb?)` — remove torrent from client list and destroy it
- `removeTorrentFromClient` — alias of `detachTorrent` for the `ZTorrentClient` interface

### Torrent helpers

- `applyTorrentInput(id)` — apply magnet / buffer / parsed torrent (used when extending the client)
- `acceptIncomingPeer(peer)` — attach an incoming `Peer`
- `handleWire(wire, addr?)` — register a connected wire
- `destroyWithError(err, cb?)` — destroy torrent and surface an error
- `getPieceSelectionRanges()` — `{ from, to }[]` snapshot of piece selections (e.g. tests)
- `selectStreamPieces` / `deselectStreamPieces` — stream-scoped selection (used by `FileIterator`)

## Scripts

```bash
bun run build      # tsdown → dist/
bun run typecheck  # tsc --noEmit
bun test           # bun:test in test/
```

## License

MIT
