import fs from 'fs'
import parseTorrent from '../dist/index.js'
import path, { dirname } from 'path'
import { expect, test } from 'bun:test'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const leavesAnnounceList = fs.readFileSync(
  path.join(__dirname, 'torrents/leaves-empty-announce-list.torrent')
)

test('parse torrent with empty announce-list', async () => {
  expect((await parseTorrent(leavesAnnounceList)).announce).toEqual([
    'udp://tracker.publicbt.com:80/announce',
  ])
})
