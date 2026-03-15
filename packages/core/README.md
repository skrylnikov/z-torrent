# @z-torrent/core

Z-Torrent core logic — platform-agnostic torrent client implementation.

## Install

```bash
npm install @z-torrent/core
```

## Usage

This package contains the core torrent client logic that works in both Node.js and browser environments. It's designed to be used with platform-specific adapters.

```js
import { WebTorrentCore } from '@z-torrent/core'

// Create a torrent client with platform adapter
const client = new WebTorrentCore({
  // platform adapter configuration
})

// Add a torrent
const torrent = client.add('magnet:?xt=urn:btih:...')

// Stream files
torrent.files[0].createReadStream().pipe(destination)
```

## Features

- Platform-agnostic torrent client implementation
- Support for streaming downloads
- BitTorrent protocol extensions (ut_metadata, ut_pex, lt_donthave)
- File prioritization and selection
- Piece management with caching

## License

MIT
