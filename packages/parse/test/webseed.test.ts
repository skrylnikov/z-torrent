import fs from 'node:fs'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse } from '@z-torrent/parse'
import { expect, test } from 'bun:test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const leavesUrlList = fs.readFileSync(path.join(__dirname, 'torrents/leaves-url-list.torrent'))

test('parse url-list for webseed support', async () => {
  const torrent = await parse.decode(leavesUrlList)
  expect(torrent.urlList).toEqual([
    'http://www2.hn.psu.edu/faculty/jmanis/whitman/leaves-of-grass6x9.pdf',
  ])
})

test('parse.encode url-list for webseed support', async () => {
  const parsedTorrent = await parse.decode(leavesUrlList)
  const buf = parse.encode(parsedTorrent)
  const doubleParsedTorrent = await parse.decode(buf)
  expect(doubleParsedTorrent.urlList).toEqual([
    'http://www2.hn.psu.edu/faculty/jmanis/whitman/leaves-of-grass6x9.pdf',
  ])
})
