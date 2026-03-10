import fs from 'fs'
import parseTorrent from '../dist/index.js'
import path, { dirname } from 'path'
import { expect, test } from 'bun:test'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const leavesDuplicateTracker = fs.readFileSync(
  path.join(__dirname, 'torrents/leaves-duplicate-tracker.torrent')
)

const expectedAnnounce = ['http://tracker.example.com/announce']

test('dedupe announce list', async () => {
  expect((await parseTorrent(leavesDuplicateTracker)).announce).toEqual(expectedAnnounce)
})
