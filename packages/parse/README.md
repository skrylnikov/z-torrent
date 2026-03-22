# @z-torrent/parse

Parse torrent identifiers: magnet URIs, `.torrent` buffers, v1/v2 info hashes, and related helpers. Used by [Z-Torrent](https://github.com/skrylnikov/z-torrent).

## Install

```bash
npm install @z-torrent/parse
```

## API

### `parse.decode(torrentId)`

Resolves a torrent id to a structured object. `torrentId` may be:

- A **40-character hex** v1 info hash or **32-character base32** hash
- A **64-character hex** v2 info hash
- A **magnet** or **stream-magnet** URI
- A **Uint8Array** / Buffer of a `.torrent` file or of a 20- or 32-byte raw hash
- An **object** already shaped like a parsed torrent (must include `infoHash` and/or `infoHashV2`)

Returns a `Promise<Instance>`. For **BitTorrent v2** ([BEP 52](https://www.bittorrent.org/beps/bep_0052.html)) files, the result includes `version`: `'v1' | 'v2' | 'hybrid'`, and may include root `piece layers`. Pure v2 torrents expose `infoHashV2` and usually no v1 `pieces` array; hybrid torrents include both.

```js
import { parse } from '@z-torrent/parse'

const fromHash = await parse.decode('d2474e86c95b19b8bcfdb92bc12c9d44667cfa36')
const fromMagnet = await parse.decode(
  'magnet:?xt=urn:btih:d2474e86c95b19b8bcfdb92bc12c9d44667cfa36'
)
```

### `parseTorrentSync(torrentId)` (Node)

Synchronous decode with the same inputs as `parse.decode`. Uses `crypto.createHash` for v2 info hashes.

```js
import { parseTorrentSync } from '@z-torrent/parse'

const parsed = parseTorrentSync(torrentFileBuffer)
```

### `parse.encode(parsed)`

Builds a `.torrent` buffer from a parsed `Instance` (round-trip with `parse.decode` where supported).

### `parse.toMagnetURI` / `toMagnetURI`

Encode a minimal object (e.g. `{ infoHash }`) to a magnet URI (from `@z-torrent/magnet`).

### `toTorrentFile`

Alias for `parse.encode`.

### `remote(torrentId, [opts], callback)`

Callback-style API for ids that need async I/O: **Blob**, `http(s):` URL, or **filesystem path** (Node). The first decode attempt is synchronous for strings/buffers that already parse as magnets or hashes.

```js
import { remote } from '@z-torrent/parse'

remote('/path/to/file.torrent', (err, parsed) => {
  if (err) throw err
  console.log(parsed.infoHash)
})
```

For HTTP(S), optional `fetch`-style options can be passed as the second argument (when the third is the callback).

### Deprecated aliases

- `parseTorrent` — same as `decode`
- `decode` / `encode` — same as `parse.decode` / `parse.encode`

## CLI

The package exposes the `parse-torrent` binary:

```text
parse-torrent /path/to/file.torrent
parse-torrent "magnet:?xt=urn:btih:..."
parse-torrent --stdin
parse-torrent --raw /path/to/file.torrent
```

Install globally or run via `npx` / `bunx` from the package that depends on `@z-torrent/parse`.

## Types

```ts
import type { Instance } from '@z-torrent/parse'
```

## Requirements

Node.js **24+** (aligned with other Z-Torrent packages).

## License

MIT. Portions derive from [parse-torrent](https://github.com/webtorrent/parse-torrent) / WebTorrent LLC.
