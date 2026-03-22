import { expect, test } from 'bun:test'
import { parseTorrent } from '@z-torrent/parse'
import { createTorrentPromise } from './helpers.js'

test('create ssl cert torrent', async () => {
  const sslCert = new Uint8Array(Buffer.from('content cert X.509'))

  const torrent = await createTorrentPromise(Buffer.from('abc'), {
    name: 'abc.txt',
    sslCert,
  })
  const parsedTorrent = await parseTorrent(torrent)
  expect((parsedTorrent.info as Record<string, unknown>)['ssl-cert']).toEqual(sslCert)
})
