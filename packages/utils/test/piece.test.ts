import { expect, test } from 'bun:test'

import { Piece } from '../src/piece'

function makeChunk(value: string, length?: number): Uint8Array {
  const len = length || Piece.BLOCK_LENGTH
  const buf = new Uint8Array(len)
  buf.fill(value.charCodeAt(0))
  return buf
}

test('initial state', () => {
  const length = Piece.BLOCK_LENGTH * 4
  const piece = new Piece(length)

  expect(piece.length).toBe(length)
  expect(piece.missing).toBe(length)

  expect(piece.chunkLength(0)).toBe(Piece.BLOCK_LENGTH)
  expect(piece.chunkLength(1)).toBe(Piece.BLOCK_LENGTH)
  expect(piece.chunkLength(2)).toBe(Piece.BLOCK_LENGTH)
  expect(piece.chunkLength(3)).toBe(Piece.BLOCK_LENGTH)

  expect(piece.chunkOffset(0)).toBe(0)
  expect(piece.chunkOffset(1)).toBe(1 * Piece.BLOCK_LENGTH)
  expect(piece.chunkOffset(2)).toBe(2 * Piece.BLOCK_LENGTH)
  expect(piece.chunkOffset(3)).toBe(3 * Piece.BLOCK_LENGTH)

  expect(piece.get(0)).toBeFalsy()
  expect(piece.get(1)).toBeFalsy()
  expect(piece.get(2)).toBeFalsy()
  expect(piece.get(3)).toBeFalsy()
})

test('initial state - last chunk is different size', () => {
  const length = Piece.BLOCK_LENGTH * 3 + 999
  const piece = new Piece(length)

  expect(piece.length).toBe(length)
  expect(piece.missing).toBe(length)

  expect(piece.chunkLength(0)).toBe(Piece.BLOCK_LENGTH)
  expect(piece.chunkLength(1)).toBe(Piece.BLOCK_LENGTH)
  expect(piece.chunkLength(2)).toBe(Piece.BLOCK_LENGTH)
  expect(piece.chunkLength(3)).toBe(999)

  expect(piece.chunkOffset(0)).toBe(0)
  expect(piece.chunkOffset(1)).toBe(1 * Piece.BLOCK_LENGTH)
  expect(piece.chunkOffset(2)).toBe(2 * Piece.BLOCK_LENGTH)
  expect(piece.chunkOffset(3)).toBe(3 * Piece.BLOCK_LENGTH)

  expect(piece.get(0)).toBeFalsy()
  expect(piece.get(1)).toBeFalsy()
  expect(piece.get(2)).toBeFalsy()
  expect(piece.get(3)).toBeFalsy()
})

test('basic usage', () => {
  const length = Piece.BLOCK_LENGTH * 4
  const piece = new Piece(length)

  expect(piece.get(0)).toBeFalsy()
  expect(piece.reserve()).toBe(0)
  piece.set(0, makeChunk('first chunk'), null)
  expect(piece.get(0)).toEqual(makeChunk('first chunk'))

  expect(piece.get(1)).toBeFalsy()
  expect(piece.reserve()).toBe(1)
  piece.set(1, makeChunk('second chunk'), null)
  expect(piece.get(1)).toEqual(makeChunk('second chunk'))

  expect(piece.get(2)).toBeFalsy()
  expect(piece.reserve()).toBe(2)
  piece.set(2, makeChunk('third chunk'), null)
  expect(piece.get(2)).toEqual(makeChunk('third chunk'))

  expect(piece.get(3)).toBeFalsy()
  piece.set(3, makeChunk('fourth chunk'), null)
  expect(piece.reserve()).toBe(3)
  expect(piece.get(3)).toEqual(makeChunk('fourth chunk'))

  expect(piece.reserve()).toBe(-1)

  const completeBuf = Buffer.concat([
    Buffer.from(makeChunk('first chunk')),
    Buffer.from(makeChunk('second chunk')),
    Buffer.from(makeChunk('third chunk')),
    Buffer.from(makeChunk('fourth chunk')),
  ])
  const flushedBuf = piece.flush()
  expect(Buffer.from(flushedBuf!)).toEqual(completeBuf)
  expect(flushedBuf!.length).toBe(Piece.BLOCK_LENGTH * 4)
})

test('basic usage - last chunk is different size', () => {
  const length = Piece.BLOCK_LENGTH * 3 + 999
  const piece = new Piece(length)

  expect(piece.get(0)).toBeFalsy()
  expect(piece.reserve()).toBe(0)
  piece.set(0, makeChunk('first chunk'), null)
  expect(piece.get(0)).toEqual(makeChunk('first chunk'))

  expect(piece.get(1)).toBeFalsy()
  expect(piece.reserve()).toBe(1)
  piece.set(1, makeChunk('second chunk'), null)
  expect(piece.get(1)).toEqual(makeChunk('second chunk'))

  expect(piece.get(2)).toBeFalsy()
  expect(piece.reserve()).toBe(2)
  piece.set(2, makeChunk('third chunk'), null)
  expect(piece.get(2)).toEqual(makeChunk('third chunk'))

  expect(piece.get(3)).toBeFalsy()
  piece.set(3, makeChunk('fourth chunk', 999), null)
  expect(piece.reserve()).toBe(3)
  expect(piece.get(3)).toEqual(makeChunk('fourth chunk', 999))

  expect(piece.reserve()).toBe(-1)

  const completeBuf = Buffer.concat([
    Buffer.from(makeChunk('first chunk')),
    Buffer.from(makeChunk('second chunk')),
    Buffer.from(makeChunk('third chunk')),
    Buffer.from(makeChunk('fourth chunk', 999)),
  ])
  const flushedBuf = piece.flush()
  expect(Buffer.from(flushedBuf!)).toEqual(completeBuf)
  expect(flushedBuf!.length).toBe(Piece.BLOCK_LENGTH * 3 + 999)
})

test('cancel', () => {
  const length = Piece.BLOCK_LENGTH * 4
  const piece = new Piece(length)

  expect(piece.reserve()).toBe(0)
  expect(piece.reserve()).toBe(1)
  piece.cancel(0)
  expect(piece.reserve()).toBe(0)
  piece.cancel(0)
  expect(piece.reserve()).toBe(0)
  piece.cancel(1)
  expect(piece.reserve()).toBe(1)
  expect(piece.reserve()).toBe(2)
  expect(piece.reserve()).toBe(3)
  piece.cancel(3)
  expect(piece.reserve()).toBe(3)
  expect(piece.reserve()).toBe(-1)
  expect(piece.reserve()).toBe(-1)
  expect(piece.reserve()).toBe(-1)
})
