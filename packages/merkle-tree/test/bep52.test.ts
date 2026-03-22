import { describe, expect, test } from 'bun:test'
import {
  BEP52_BLOCK_SIZE,
  buildFileV2Merkle,
  buildMerkleLayers,
  padPieceBlockHashes,
  rootHashLayer,
  sha256Concat,
  sha256Data,
  unclesForLeafIndex,
  verifyLeafToRoot,
} from '../src/bep52.js'

describe('rootHashLayer', () => {
  test('single hash', () => {
    const h = sha256Data(new Uint8Array([1, 2, 3]))
    expect(rootHashLayer([h])).toEqual(h)
  })

  test('two leaves', () => {
    const a = sha256Data(new Uint8Array([1]))
    const b = sha256Data(new Uint8Array([2]))
    const r = rootHashLayer([a, b])
    expect(r).toEqual(sha256Concat(a, b))
  })
})

describe('buildMerkleLayers + verify', () => {
  test('proof for leaf 0', () => {
    const l0 = sha256Data(new Uint8Array([0]))
    const l1 = sha256Data(new Uint8Array([1]))
    const layers = buildMerkleLayers([l0, l1])
    const root = layers[layers.length - 1]![0]!
    const uncles = unclesForLeafIndex(layers, 0, layers.length - 1)
    expect(verifyLeafToRoot(l0, 0, uncles, root)).toBe(true)
  })
})

describe('buildFileV2Merkle', () => {
  test('empty file', () => {
    const r = buildFileV2Merkle(new Uint8Array(0), 65536)
    expect(r.length).toBe(0)
    expect(r.piecesRoot).toBeUndefined()
    expect(r.pieceSubtreeRoots).toEqual([])
  })

  test('small file one piece', () => {
    const data = new Uint8Array([1, 2, 3, 4])
    const pieceLength = 65536
    const r = buildFileV2Merkle(data, pieceLength)
    expect(r.length).toBe(4)
    expect(r.piecesRoot).toBeDefined()
    expect(r.pieceSubtreeRoots.length).toBe(1)
    expect(r.pieceLayerConcat).toBeUndefined()
  })

  test('piece length must be power of two', () => {
    expect(() => buildFileV2Merkle(new Uint8Array([1]), 1000)).toThrow()
  })

  test('multi-piece produces pieceLayerConcat when longer than piece', () => {
    const pieceLength = BEP52_BLOCK_SIZE * 2 // 32 KiB, 2 blocks per piece
    const data = new Uint8Array(pieceLength + 100)
    data.fill(7)
    const r = buildFileV2Merkle(data, pieceLength)
    expect(r.length).toBe(data.length)
    expect(r.pieceSubtreeRoots.length).toBeGreaterThan(1)
    expect(r.pieceLayerConcat).toBeDefined()
    expect(r.pieceLayerConcat!.length).toBe(r.pieceSubtreeRoots.length * 32)
  })
})

describe('padPieceBlockHashes', () => {
  test('first piece pads to next pow2 of block count', () => {
    const h = [sha256Data(new Uint8Array([1])), sha256Data(new Uint8Array([2])), sha256Data(new Uint8Array([3]))]
    const p = padPieceBlockHashes(h, 4, true)
    expect(p.length).toBe(4)
    expect(p[3]!.every((b) => b === 0)).toBe(true)
  })
})
