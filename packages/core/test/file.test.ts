import { test, expect } from 'bun:test'

import { File } from '../src/lib/file.js'
import type { TorrentForFile } from '../src/lib/types.js'

function createStore() {
  const data = new Uint8Array([1, 2, 3, 4])

  return {
    chunkLength: data.byteLength,
    get(
      _index: number,
      opts: { offset?: number; length?: number },
      cb: (err: Error | null, chunk?: Uint8Array) => void
    ): void {
      const offset = opts.offset ?? 0
      const length = opts.length ?? data.byteLength - offset
      cb(null, data.subarray(offset, offset + length))
    },
    put(
      _index: number,
      _chunk: Uint8Array,
      _opts: Record<string, unknown>,
      cb: (err?: Error) => void
    ): void {
      cb()
    },
    close(cb: () => void): void {
      cb()
    },
  }
}

function createTorrent() {
  return {
    pieceLength: 4,
    lastPieceLength: 4,
    length: 4,
    bitfield: null,
    store: createStore(),
    destroyed: false,
    wires: [],
    client: { peerId: 'peer-id', httpServer: null },
    select() {},
    deselect() {},
    selectStreamPieces() {},
    deselectStreamPieces() {},
    critical() {},
    on() {},
    removeListener() {},
    emit() {
      return false
    },
  } as unknown as TorrentForFile
}

test('done files return an async iterable directly', () => {
  const file = new File(createTorrent(), {
    name: 'done.bin',
    path: 'done.bin',
    length: 4,
    offset: 0,
  })
  file.done = true

  const iterable = file[Symbol.asyncIterator]()

  expect(typeof (iterable as any).then).toBe('undefined')
  expect(typeof (iterable as any)[Symbol.asyncIterator]).toBe('function')
})

test('done files still create a stream', () => {
  const file = new File(createTorrent(), {
    name: 'done.bin',
    path: 'done.bin',
    length: 4,
    offset: 0,
  })
  file.done = true

  expect(file.stream()).toBeInstanceOf(ReadableStream)
})
