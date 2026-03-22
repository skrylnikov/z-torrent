import fs from 'node:fs'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse } from '@z-torrent/parse'
import { expect, test } from 'bun:test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const leavesDuplicateTracker = fs.readFileSync(
  path.join(__dirname, 'torrents/leaves-duplicate-tracker.torrent')
)

const expectedAnnounce = ['http://tracker.example.com/announce']

test('dedupe announce list', async () => {
  expect((await parse.decode(leavesDuplicateTracker)).announce).toEqual(expectedAnnounce)
})
