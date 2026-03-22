import { test, expect } from 'bun:test'
import { parse } from '@z-torrent/parse'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { buildV2ExpectedPieceRoots, v2NumPieces } from '../src/lib/v2-piece-roots.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const v2TorrentPath = path.join(__dirname, '../../parse/test/fixtures/bittorrent-v2-test.torrent')

test('v2 fixture: expected merkle piece roots count matches layout', async () => {
  const buf = readFileSync(v2TorrentPath)
  const decoded = await parse.decode(buf)
  expect(decoded.version).toBe('v2')
  expect(decoded.v2FileLayout).toBeDefined()
  expect(decoded.pieceLayersByRootHex).toBeDefined()
  expect(decoded.pieceLength).toBeGreaterThan(0)

  const n = v2NumPieces(decoded.v2FileLayout!, decoded.pieceLength)
  const roots = buildV2ExpectedPieceRoots(
    decoded.v2FileLayout!,
    decoded.pieceLength,
    decoded.pieceLayersByRootHex!
  )
  expect(roots.length).toBe(n)
  for (const r of roots) {
    expect(r.length).toBe(32)
  }
})
