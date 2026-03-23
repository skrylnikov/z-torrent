# @z-torrent/dht

BitTorrent **mainline DHT** ([BEP 5](http://www.bittorrent.org/beps/bep_0005.html)) and **BEP 44** mutable/immutable store for JavaScript/TypeScript (Node.js).

Used by [Z-Torrent](https://z-torrent.xyz).

## Install

```bash
npm install @z-torrent/dht
```

## Usage

```js
import { DHT } from '@z-torrent/dht'
import { magnet } from '@z-torrent/magnet'

const uri = 'magnet:?xt=urn:btih:e3811b9539cacff680e418124272177c47477157'
const parsed = magnet.decode(uri)

const dht = new DHT()

dht.listen(20000, () => {
  console.log('listening')
})

dht.on('peer', (peer, infoHash, from) => {
  console.log('peer', peer.host, peer.port)
})

dht.lookup(parsed.infoHash)
```

## API

### `new DHT([opts])`

Create a DHT client instance. Options include `bootstrap`, `nodeId`, `host`, `maxTables`, `maxValues`, `verify` (for BEP44), and are forwarded to the underlying `k-rpc` stack where applicable.

### Methods

- `listen([port], [address], [cb])` — bind UDP socket
- `address()` — `{ port, address, family }`
- `destroy([cb])`
- `addNode({ host, port, id? })` / `removeNode(id)`
- `lookup(infoHash, [cb])` — returns abort function
- `announce(infoHash, port, [cb])`
- `put(opts, [cb])` / `get(key, [opts], cb)` — BEP 44
- `toJSON()` — routing snapshot (nodes + cached values)

### Events

`ready`, `listening`, `peer`, `node`, `announce`, `warning`, `error`, `close`, and protocol hooks (`get_peers`, `find_node`, etc.).

## Scripts

- `bun run build` — bundle to `dist/`
- `bun run test` — offline tests under `test/*.test.ts`
- `bun run test-live` — network-dependent tests in `test/live/`
- `bun run typecheck` — `tsc --noEmit`

## License

MIT. See [LICENSE](LICENSE).
