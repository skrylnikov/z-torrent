// @ts-expect-error - no types available
import fixtures from 'webtorrent-fixtures'
import test from 'tape'
import type { Test } from 'tape'
import WebTorrent from '../dist/index.js'
import type { default as Torrent } from '../src/lib/torrent.js'

test('torrent.destroy: destroy and remove torrent', (t: Test) => {
  t.plan(5)

  const client = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })

  client.on('error', (err: Error) => {
    t.fail(err.message)
  })
  client.on('warning', (err: Error) => {
    t.fail(err.message)
  })

  const torrent: Torrent = client.add(fixtures.leaves.parsedTorrent.infoHash)
  t.equal((client as any).torrents.length, 1)

  torrent.on('infoHash', () => {
    t.equal(torrent.infoHash, fixtures.leaves.parsedTorrent.infoHash)

    torrent.destroy((err?: Error) => {
      t.error(err, 'torrent destroyed')
    })
    t.equal((client as any).torrents.length, 0)

    client.destroy((err?: Error) => {
      t.error(err, 'client destroyed')
    })
  })
})
