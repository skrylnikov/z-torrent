import { parse } from '@z-torrent/parse'
import { expect, test } from 'bun:test'

import { torrentFixtures } from './fixtures/index.ts'

test('exception thrown when torrent file is missing `name` field', async () => {
  await expect(parse.decode(torrentFixtures.corrupt.torrent)).rejects.toBeInstanceOf(Error)
})
