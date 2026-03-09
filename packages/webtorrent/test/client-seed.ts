// @ts-expect-error - no types available
import fixtures from 'webtorrent-fixtures'
import test from 'tape'
import type { Test } from 'tape'
import WebTorrent from '../dist/index.js'
import type { default as Torrent } from '../src/lib/torrent.js'

test('client.seed: torrent file (Buffer)', (t: Test) => {
  t.plan(6)

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

  client.seed(
    fixtures.leaves.content,
    {
      name: 'Leaves of Grass by Walt Whitman.epub',
      announce: [],
    },
    async (torrent: Torrent) => {
      t.equal((client as any).torrents.length, 1)
      t.equal(torrent.infoHash, fixtures.leaves.parsedTorrent.infoHash)
      t.equal(torrent.magnetURI, fixtures.leaves.magnetURI)

      await (client as any).remove(torrent, null, (err?: Error) => {
        t.error(err, 'torrent removed')
      })
      t.equal((client as any).torrents.length, 0)

      client.destroy((err?: Error) => {
        t.error(err, 'client destroyed')
      })
    }
  )
})

test('client.seed: torrent file (Buffer), set name on buffer', (t: Test) => {
  t.plan(6)

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

  const buf = Buffer.from(fixtures.leaves.content) as Buffer & { name: string }
  buf.name = 'Leaves of Grass by Walt Whitman.epub'

  client.seed(buf, { announce: [] }, async (torrent: Torrent) => {
    t.equal((client as any).torrents.length, 1)
    t.equal(torrent.infoHash, fixtures.leaves.parsedTorrent.infoHash)
    t.equal(torrent.magnetURI, fixtures.leaves.magnetURI)

    await (client as any).remove(torrent, null, (err?: Error) => {
      t.error(err, 'torrent removed')
    })
    t.equal((client as any).torrents.length, 0)

    client.destroy((err?: Error) => {
      t.error(err, 'client destroyed')
    })
  })
})

test('client.seed: torrent file (Blob)', (t: Test) => {
  if (typeof Blob === 'undefined') return t.end()

  t.plan(6)

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

  client.seed(
    new Blob([fixtures.leaves.content]),
    {
      name: 'Leaves of Grass by Walt Whitman.epub',
      announce: [],
    },
    async (torrent: Torrent) => {
      t.equal((client as any).torrents.length, 1)
      t.equal(torrent.infoHash, fixtures.leaves.parsedTorrent.infoHash)
      t.equal(torrent.magnetURI, fixtures.leaves.magnetURI)

      await (client as any).remove(torrent, null, (err?: Error) => {
        t.error(err, 'torrent removed')
      })
      t.equal((client as any).torrents.length, 0)

      client.destroy((err?: Error) => {
        t.error(err, 'client destroyed')
      })
    }
  )
})

test('client.seed: duplicate seed', (t: Test) => {
  t.plan(4)

  const client = new WebTorrent()

  client.on('error', (err: Error) => {
    t.fail(err.message)
  })
  client.on('warning', (err: Error) => {
    t.fail(err.message)
  })
  ;(client as any).seed(fixtures.leaves.content, function (torrent1: Torrent) {
    ;(client as any).seed(fixtures.leaves.content, function (torrent2: Torrent) {
      t.equal(torrent1, torrent2)
      t.equal((client as any).torrents.length, 1)

      client.destroy((err?: Error) => {
        t.error(err, 'client destroyed')
      })
      t.equal((client as any).torrents.length, 0)
    })
  })
})
