import fs from 'fs'
import parseTorrent from '../dist/index.js'
import path, { dirname } from 'path'
import { expect, test } from 'bun:test'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const leavesUrlList = fs.readFileSync(
  path.join(__dirname, 'torrents/leaves-empty-url-list.torrent')
)

test('parse empty url-list', async () => {
  const torrent = await parseTorrent(leavesUrlList)
  expect(torrent.urlList).toEqual([])
})
