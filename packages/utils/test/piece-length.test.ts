import { expect, test } from 'bun:test'

import { calcPieceLength } from '../src/piece-length'

test('calcPieceLength is power of two and >= 16 KiB', () => {
  expect(calcPieceLength(0)).toBe(16384)
  expect(calcPieceLength(1024)).toBe(16384)
  const mid = calcPieceLength(50 * 1024 * 1024)
  expect(mid & (mid - 1)).toBe(0)
  expect(mid).toBeGreaterThanOrEqual(16384)
})

test('calcPieceLength does not wrap for very large torrents (not 32-bit shift)', () => {
  const huge = calcPieceLength(Number.MAX_SAFE_INTEGER)
  expect(huge & (huge - 1)).toBe(0)
  expect(huge).toBeGreaterThan(16384)
  expect(huge).not.toBe(0)
})
