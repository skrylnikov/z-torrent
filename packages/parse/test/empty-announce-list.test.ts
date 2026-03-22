import fs from 'node:fs'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse } from '@z-torrent/parse'
import { expect, test } from 'bun:test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const leavesAnnounceList = fs.readFileSync(
  path.join(__dirname, 'torrents/leaves-empty-announce-list.torrent')
)

test('parse torrent with empty announce-list', async () => {
  expect((await parse.decode(leavesAnnounceList)).announce).toEqual([
    'udp://tracker.publicbt.com:80/announce',
  ])
})
