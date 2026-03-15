import fs from 'fs'
import parseTorrent, { toTorrentFile } from '../dist/index.js'
import path, { dirname } from 'path'
import { expect, test } from 'bun:test'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const leavesUrlList = fs.readFileSync(path.join(__dirname, 'torrents/leaves-url-list.torrent'))

test('parse url-list for webseed support', async () => {
  const torrent = await parseTorrent(leavesUrlList)
  expect(torrent.urlList).toEqual([
    'http://www2.hn.psu.edu/faculty/jmanis/whitman/leaves-of-grass6x9.pdf',
  ])
})

test('parseTorrent.toTorrentFile url-list for webseed support', async () => {
  const parsedTorrent = await parseTorrent(leavesUrlList)
  const buf = toTorrentFile(parsedTorrent)
  const doubleParsedTorrent = await parseTorrent(buf)
  expect(doubleParsedTorrent.urlList).toEqual([
    'http://www2.hn.psu.edu/faculty/jmanis/whitman/leaves-of-grass6x9.pdf',
  ])
})
