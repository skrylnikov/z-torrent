# @z-torrent/create

Create BitTorrent `.torrent` files from files, folders, buffers, blobs, or readable streams. Used by [Z-Torrent](https://github.com/skrylnikov/z-torrent). Works in Node.js; browser usage is supported for non-filesystem inputs (paths require Node).

## Install

```bash
npm install @z-torrent/create
```

## Usage

```js
import fs from 'fs'
import { createTorrent } from '@z-torrent/create'

createTorrent('/path/to/folder', (err, torrent) => {
  if (!err) {
    // torrent is a Uint8Array with the .torrent payload
    fs.writeFileSync('my.torrent', torrent)
  }
})
```

A reasonable piece length (roughly ~1024 pieces) is chosen automatically unless you override it (see options below).

## API

### `createTorrent(input, [opts], callback)`

- **`input`**: string path, `File` / `Blob`, `Uint8Array`, Node.js `Readable`, or an array mixing those types. `FileList` is accepted. Paths only work in Node (not in the browser bundle).
- **`opts`**: optional. Shapes include:
  - `name`, `comment`, `createdBy`, `creationDate`
  - `private`, `pieceLength`, `maxPieceLength`
  - `announce`, `announceList`, `urlList`
  - `info` — extra keys merged into the info dictionary (e.g. `source` for cross-seeding)
  - `filterJunkFiles` — default `true`
  - `sslCert` — optional `ssl-cert` in info
  - `onProgress(hashedLength, totalLength)`
- **`callback`**: `(err, torrent?: Uint8Array) => void`

If `announce` / `announceList` are omitted, default trackers are added (including WebRTC `wss://` trackers for browser-oriented swarms).

### `parseInput(input, [opts], callback)`

Low-level helper: parses/normalizes input and returns the internal file list and whether the torrent is treated as single-file. The main consumer in this repo is the Node client when seeding.

### `announceList`

Exported default tracker tier list (array of single-URL arrays), same as used when no custom announce options are passed.

### Types

`CreateTorrentOptions`, `FileItem`, and `CreateTorrentOptions`-related shapes are exported for TypeScript.

### BitTorrent v2 / hybrid ([BEP 52](http://www.bittorrent.org/beps/bep_0052.html))

Pass `protocolVersion` in options:

- `'v1'` (default) — classic SHA1 piece layer
- `'v2'` — metadata v2 only (SHA-256 merkle piece layer via [@z-torrent/merkle-tree](https://www.npmjs.com/package/@z-torrent/merkle-tree))
- `'hybrid'` — v1 and v2 in one `.torrent` for compatibility

`pieceLength` for `v2` / `hybrid` is normalized to BEP 52 rules (power of two, ≥ 16 KiB leaf blocks). Hybrid torrents require each file to have a path.

**Memory:** for `v2` / `hybrid`, each source file is read fully into memory to build per-file merkle metadata (unlike the streaming SHA-1 path for plain `v1`). Very large inputs may need more RAM; consider raising Node memory limits or using `v1` for huge seeds until streaming merkle creation exists.

### Global: `WEBTORRENT_ANNOUNCE`

If set on `globalThis` to a string or `string[]`, those URLs are appended to the announce list. (Legacy name from WebTorrent; behaviour is the same for Z-Torrent.)

## CLI

The `create-torrent` binary is published with this package:

```text
create-torrent <file-or-directory> [-o out.torrent] [options]
```

Use `-o` to write a file; otherwise the torrent is written to stdout.

## License

MIT
