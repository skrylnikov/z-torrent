import { test, expect } from 'bun:test'
import { WebTorrentCore } from '../src/client.js'
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

test('WebTorrentCore requires platform', () => {
  expect(() => new WebTorrentCore({} as never)).toThrow('platform adapter is required')
})

test('WebTorrentCore constructs with platform', () => {
  const client = new WebTorrentCore({ platform: minimalPlatform() })
  expect(client.peerId.length).toBeGreaterThan(0)
  expect(client.nodeId.length).toBeGreaterThan(0)
  expect(client.debugId.length).toBeGreaterThan(0)
  client.destroy()
})
