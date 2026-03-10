import fixtures from './fixtures/index.ts'
import parseTorrent from '../dist/index.js'
import { expect, test } from 'bun:test'

test('exception thrown when torrent file is missing `name` field', async () => {
  await expect(parseTorrent(fixtures.corrupt.torrent)).rejects.toBeInstanceOf(Error)
})
