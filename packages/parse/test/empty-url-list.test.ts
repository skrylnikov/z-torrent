import fs from 'node:fs'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse } from '@z-torrent/parse'
import { expect, test } from 'bun:test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const leavesUrlList = fs.readFileSync(
  path.join(__dirname, 'torrents/leaves-empty-url-list.torrent')
)

test('parse empty url-list', async () => {
  const torrent = await parse.decode(leavesUrlList)
  expect(torrent.urlList).toEqual([])
})
