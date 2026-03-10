import fixtures from './fixtures/index.ts'
import parseTorrent, { toTorrentFile } from '../dist/index.js'
import { expect, test } from 'bun:test'

test('parseTorrent.toTorrentFile', async () => {
  const parsedTorrent = await parseTorrent(fixtures.leaves.torrent)
  const buf = toTorrentFile(parsedTorrent)
  const doubleParsedTorrent = await parseTorrent(buf)

  expect(doubleParsedTorrent).toEqual(parsedTorrent)
})

test('parseTorrent.toTorrentFile w/ comment field', async () => {
  const parsedTorrent = await parseTorrent(fixtures.leaves.torrent)
  parsedTorrent.comment = 'hi there!'
  const buf = toTorrentFile(parsedTorrent)
  const doubleParsedTorrent = await parseTorrent(buf)

  expect(doubleParsedTorrent).toEqual(parsedTorrent)
})
