import { parse } from '@z-torrent/parse'
import { expect, test } from 'bun:test'

import { torrentFixtures } from './fixtures/index.ts'

test('parse.encode', async () => {
  const parsedTorrent = await parse.decode(torrentFixtures.leaves.torrent)
  const buf = parse.encode(parsedTorrent)
  const doubleParsedTorrent = await parse.decode(buf)

  expect(doubleParsedTorrent).toEqual(parsedTorrent)
})

test('parse.encode w/ comment field', async () => {
  const parsedTorrent = await parse.decode(torrentFixtures.leaves.torrent)
  parsedTorrent.comment = 'hi there!'
  const buf = parse.encode(parsedTorrent)
  const doubleParsedTorrent = await parse.decode(buf)

  expect(doubleParsedTorrent).toEqual(parsedTorrent)
})

test('parse.encode round-trip BitTorrent v2-only', async () => {
  const a = await parse.decode(torrentFixtures['bittorrent-v2-test'].torrent)
  const buf = parse.encode(a)
  const b = await parse.decode(buf)
  expect(b.infoHashV2).toBe(a.infoHashV2)
  expect(b.version).toBe('v2')
  expect(b.infoHash).toBeUndefined()
  expect(b.name).toBe(a.name)
  expect(b.length).toBe(a.length)
  expect(b.files).toEqual(a.files)
  expect(b.pieces).toBeUndefined()
  expect(b.pieceLength).toBe(a.pieceLength)
  expect(b['piece layers']).toEqual(a['piece layers'])
})

test('parse.encode round-trip BitTorrent hybrid', async () => {
  const a = await parse.decode(torrentFixtures['bittorrent-v2-hybrid-test'].torrent)
  const buf = parse.encode(a)
  const b = await parse.decode(buf)
  expect(b.infoHash).toBe(a.infoHash)
  expect(b.infoHashV2).toBe(a.infoHashV2)
  expect(b.version).toBe('hybrid')
  expect(b.name).toBe(a.name)
  expect(b.length).toBe(a.length)
  expect(b.files).toEqual(a.files)
  expect(b.pieceLength).toBe(a.pieceLength)
  expect(b['piece layers']).toEqual(a['piece layers'])
})
