# @z-torrent/host-sdk

Lightweight `postMessage` SDK: sites running inside the Z-Torrent portal iframe can ask the parent window to add a torrent to the shared client and receive file URLs for streaming (e.g. `<video src>`).

## Requirements

- **Browser only** (the constructor throws if `window` is undefined).
- `add()` must run inside a **nested iframe** (`window.parent !== window`). If the page is top-level, `isEmbedded` is `false` and `add()` rejects.

## Installation

```bash
npm install @z-torrent/host-sdk
# or
bun add @z-torrent/host-sdk
```

In the Z-Torrent monorepo: `"@z-torrent/host-sdk": "workspace:*"`.

The package is built as browser **ESM**; consume it through your bundler (Vite, Astro, etc.), like [`examples/sintel-web`](../../examples/sintel-web).

## Quick example

```typescript
import { ZTorrentHost } from '@z-torrent/host-sdk'

const host = new ZTorrentHost()

if (!host.isEmbedded) {
  console.warn('Not in portal iframe — add() is unavailable')
} else {
  try {
    const { infoHash, files } = await host.add(magnetURI, {
      timeout: 120_000,
      onProgress(p) {
        console.log(p.phase, p.progress, p.peers)
      },
    })

    const video = document.querySelector('video')
    if (video && files['Sintel.mp4']) {
      video.src = files['Sintel.mp4']
      void video.play()
    }
  } catch (e) {
    console.error(e)
  }
}

// On teardown / component unmount:
host.destroy()
```

`files` maps torrent file names to paths like `/z-torrent/<infoHash>/<path-in-torrent>` relative to the portal origin. The portal Service Worker intercepts those requests and serves bytes from the client.

## API

### `ZTorrentHost`

| Member                                                                        | Description                                                     |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Constructor                                                                   | Registers a `message` listener.                                 |
| `isEmbedded: boolean`                                                         | `true` when embedded (`window.parent !== window`).              |
| `add(magnetURI: string, opts?: AddTorrentOptions): Promise<AddTorrentResult>` | Sends a request to the parent; default timeout **120 seconds**. |
| `destroy(): void`                                                             | Removes the listener and rejects pending requests.              |

### `AddTorrentOptions`

- `timeout?: number` — response timeout in ms (default `120_000`).
- `onProgress?: (p: TorrentProgress) => void` — progress callback from the portal.

### `TorrentProgress`

- `phase`: `'connecting' | 'metadata' | 'downloading' | 'ready'`
- `progress`: **0–1**
- `downloadSpeed`: bytes per second
- `peers`: peer count
- `downloaded`, `totalSize`: bytes

### `AddTorrentResult`

- `infoHash: string`
- `files: Record<string, string>` — torrent file name → path URL usable in the iframe document

## PostMessage protocol

Message types use the `z-torrent:` prefix. Useful if you implement a custom portal compatible with this SDK.

| Direction       | `type`                       | Payload (key fields)                   |
| --------------- | ---------------------------- | -------------------------------------- |
| iframe → parent | `z-torrent:add-torrent`      | `id`, `magnetURI`                      |
| parent → iframe | `z-torrent:torrent-added`    | `id`, `infoHash`, `files`              |
| parent → iframe | `z-torrent:torrent-progress` | `id`, same fields as `TorrentProgress` |
| parent → iframe | `z-torrent:torrent-error`    | `id`, `error`                          |

The SDK uses `postMessage(..., '*')`. The parent portal should **validate `event.origin`** and, when replying, prefer a concrete `targetOrigin` instead of `*`.

Reference handler: [`examples/web-portal/src/components/Viewer.svelte`](../../examples/web-portal/src/components/Viewer.svelte).

## Further reading

- Portal design and hosting flow: [`docs/portal.md`](../../docs/portal.md) (Host SDK Integration).
- Video streaming demo: [`examples/sintel-web`](../../examples/sintel-web).

## License

MIT
