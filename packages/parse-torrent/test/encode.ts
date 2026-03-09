import fixtures from './fixtures/index.ts'
import parseTorrent, { toTorrentFile } from '../dist/index.js'
import test from 'tape'

test('parseTorrent.toTorrentFile', async (t) => {
  const parsedTorrent = await parseTorrent(fixtures.leaves.torrent)
  const buf = toTorrentFile(parsedTorrent)
  const doubleParsedTorrent = await parseTorrent(buf)

  t.deepEqual(doubleParsedTorrent, parsedTorrent)
  t.end()
})

test('parseTorrent.toTorrentFile w/ comment field', async (t) => {
  const parsedTorrent = await parseTorrent(fixtures.leaves.torrent)
  parsedTorrent.comment = 'hi there!'
  const buf = toTorrentFile(parsedTorrent)
  const doubleParsedTorrent = await parseTorrent(buf)

  t.deepEqual(doubleParsedTorrent, parsedTorrent)
  t.end()
})
