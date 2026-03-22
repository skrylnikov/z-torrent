import { test, expect } from 'bun:test'
import { ZTorrentCore } from '../src/client.js'
import type { ChunkStore, PlatformAdapter } from '../src/interfaces.js'

class MinimalChunkStore implements ChunkStore {
  constructor(_pieceLength: number, _opts: Record<string, unknown>) {}
  get(
    _index: number,
    _opts: { offset?: number; length?: number },
    cb: (err: Error | null, chunk?: Uint8Array) => void
  ): void {
    cb(null, undefined)
  }
  put(
    _index: number,
    _chunk: Uint8Array,
    _opts: Record<string, unknown>,
    cb: (err?: Error) => void
  ): void {
    cb()
  }
  close(cb: () => void): void {
    cb()
  }
}

function minimalPlatform(): PlatformAdapter {
  return {
    defaultStore: MinimalChunkStore as unknown as PlatformAdapter['defaultStore'],
    tmpDir: '/tmp',
    fsConcurrency: 1,
    utpSupport: false,
    idleCallback: null,
    createServer() {
      return { destroy: (cb: () => void) => cb() }
    },
    createDiscovery() {
      return {
        on() {},
        removeListener() {},
        destroy() {},
        complete() {},
      }
    },
  }
}

test('ZTorrentCore requires platform', () => {
  expect(() => new ZTorrentCore({} as never)).toThrow('platform adapter is required')
})

test('ZTorrentCore constructs with platform', () => {
  const client = new ZTorrentCore({ platform: minimalPlatform() })
  expect(client.peerId.length).toBeGreaterThan(0)
  expect(client.nodeId.length).toBeGreaterThan(0)
  expect(client.debugId.length).toBeGreaterThan(0)
  client.destroy()
})
