# @z-torrent/fixtures

Test torrent files and related content for the [Z-Torrent](https://github.com/skrylnikov/z-torrent) monorepo. Files are Public Domain or Creative Commons where applicable.

This package is primarily for internal tests; it is marked `private` in the workspace.

## Install

In the monorepo, depend on the workspace package:

```json
{
  "devDependencies": {
    "@z-torrent/fixtures": "workspace:*"
  }
}
```

## Usage

The module exports a single object `fixtures` and TypeScript types `Fixture` and `Fixtures`.

```js
import { fixtures } from '@z-torrent/fixtures'

console.log(fixtures.leaves.torrentPath)
console.log(fixtures.alice.magnetURI)
```

### `Fixture`

Each named fixture may include:

- `contentPath` — path to raw content on disk (when bundled with the package)
- `torrentPath` — path to the `.torrent` file
- `content` / `torrent` — `Buffer` with file contents (read at load time in Node)
- `parsedTorrent` — lazy getter: parsed torrent via `@z-torrent/parse`
- `magnetURI` — lazy getter: magnet link string
- `blocklist` — `{ path, gzipPath }` for blocklist samples only

### Keys on `fixtures`

`leaves`, `alice`, `folder`, `numbers`, `lotsOfNumbers`, `bunny`, `sintel`, `leavesMetadata`, `corrupt`, and `blocklist`.

## License

MIT. See [LICENSE](LICENSE). Original WebTorrent fixtures copyright remains with prior authors where noted in history.
