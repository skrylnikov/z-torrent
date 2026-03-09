import fs from 'fs'
import path from 'path'
import http from 'http'
// @ts-expect-error - no types available
import fixtures from 'webtorrent-fixtures'
import test from 'tape'
import type { Test } from 'tape'
import WebTorrent from '../../dist/index.js'
import type { default as Torrent } from '../../src/lib/torrent.js'

test('WebTorrent.WEBRTC_SUPPORT', (t: Test) => {
  t.plan(2)

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

  t.equal((WebTorrent as any).WEBRTC_SUPPORT, true)

  client.destroy((err?: Error) => {
    t.error(err, 'client destroyed')
  })
})

test('client.add: http url to a torrent file, string', (t: Test) => {
  t.plan(8)

  const server = http.createServer((req, res) => {
    t.ok(req.headers['user-agent']?.includes('Z-Torrent'))
    res.end(fixtures.leaves.torrent)
  })

  server.listen(0, () => {
    const address = server.address() as { port: number }
    const port = address.port
    const url = `http://127.0.0.1:${port}`
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

    client.add(url, async (torrent: Torrent) => {
      t.equal((client as any).torrents.length, 1)
      t.equal(torrent.infoHash, fixtures.leaves.parsedTorrent.infoHash)
      t.equal(torrent.magnetURI, fixtures.leaves.magnetURI)

      await (client as any).remove(torrent, null, (err?: Error) => {
        t.error(err, 'torrent destroyed')
      })
      t.equal((client as any).torrents.length, 0)

      server.close(() => {
        t.pass('http server closed')
      })
      client.destroy((err?: Error) => {
        t.error(err, 'client destroyed')
      })
    })
  })
})

test('client.add: filesystem path to a torrent file, string', (t: Test) => {
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

  client.add(fixtures.leaves.torrentPath, async (torrent: Torrent) => {
    t.equal((client as any).torrents.length, 1)
    t.equal(torrent.infoHash, fixtures.leaves.parsedTorrent.infoHash)
    t.equal(torrent.magnetURI, fixtures.leaves.magnetURI)

    await (client as any).remove(torrent, null, (err?: Error) => {
      t.error(err, 'torrent destroyed')
    })
    t.equal((client as any).torrents.length, 0)

    client.destroy((err?: Error) => {
      t.error(err, 'client destroyed')
    })
  })
})

test('client.seed: filesystem path to file, string', (t: Test) => {
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
    fixtures.leaves.contentPath,
    {
      name: 'Leaves of Grass by Walt Whitman.epub',
      announce: [],
    },
    async (torrent: Torrent) => {
      t.equal((client as any).torrents.length, 1)
      t.equal(torrent.infoHash, fixtures.leaves.parsedTorrent.infoHash)
      t.equal(torrent.magnetURI, fixtures.leaves.magnetURI)

      await (client as any).remove(torrent, null, (err?: Error) => {
        t.error(err, 'torrent destroyed')
      })
      t.equal((client as any).torrents.length, 0)

      client.destroy((err?: Error) => {
        t.error(err, 'client destroyed')
      })
    }
  )
})

test('client.seed: filesystem path to folder with one file, string', (t: Test) => {
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

  client.seed(fixtures.folder.contentPath, { announce: [] }, async (torrent: Torrent) => {
    t.equal((client as any).torrents.length, 1)
    t.equal(torrent.infoHash, fixtures.folder.parsedTorrent.infoHash)
    t.equal(torrent.magnetURI, fixtures.folder.magnetURI)

    await (client as any).remove(torrent, null, (err?: Error) => {
      t.error(err, 'torrent destroyed')
    })
    t.equal((client as any).torrents.length, 0)

    client.destroy((err?: Error) => {
      t.error(err, 'client destroyed')
    })
  })
})

test('client.seed: filesystem path to folder with multiple files, string', (t: Test) => {
  t.plan(7)

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

  client.seed(fixtures.numbers.contentPath, { announce: [] }, async (torrent: Torrent) => {
    t.equal((client as any).torrents.length, 1)
    t.equal(torrent.infoHash, fixtures.numbers.parsedTorrent.infoHash)
    t.equal(torrent.magnetURI, fixtures.numbers.magnetURI)

    const downloaded = torrent.files.map((file) => ({
      length: file.length,
      downloaded: file.downloaded,
    }))

    t.deepEqual(
      downloaded,
      [
        { length: 1, downloaded: 1 },
        { length: 2, downloaded: 2 },
        { length: 3, downloaded: 3 },
      ],
      'expected downloaded to be calculated correctly'
    )

    await (client as any).remove(torrent, null, (err?: Error) => {
      t.error(err, 'torrent destroyed')
    })
    t.equal((client as any).torrents.length, 0)

    client.destroy((err?: Error) => {
      t.error(err, 'client destroyed')
    })
  })
})

test('client.add: invalid torrent id: invalid filesystem path', (t: Test) => {
  t.plan(3)

  const client = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })

  client.on('error', (err: Error) => {
    t.ok(err instanceof Error)
    t.ok(err.message.includes('Invalid torrent identifier'))

    client.destroy((err?: Error) => {
      t.error(err, 'client destroyed')
    })
  })
  client.on('warning', (err: Error) => {
    t.fail(err.message)
  })

  client.add('/invalid/filesystem/path/123')
})

test('client.remove: opts.destroyStore', (t: Test) => {
  t.plan(2)

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

  client.seed(fixtures.alice.content, { name: 'alice.txt', announce: [] }, (torrent: Torrent) => {
    const torrentPath = torrent.path
    ;(client as any).remove(torrent, { destroyStore: true }, (err?: Error) => {
      if (err) t.fail(err.message)

      fs.stat(path.join(torrentPath as string, 'alice.txt'), (err) => {
        if (err && (err as NodeJS.ErrnoException).code === 'ENOENT') t.pass('file deleted')
        else t.fail('file still exists')

        client.destroy((err?: Error) => {
          t.error(err, 'client destroyed')
        })
      })
    })
  })
})

test('torrent.destroy: opts.destroyStore', (t: Test) => {
  t.plan(2)

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

  client.seed(fixtures.alice.content, { name: 'alice.txt', announce: [] }, (torrent: Torrent) => {
    const torrentPath = torrent.path
    ;(torrent as any).destroy({ destroyStore: true }, (err?: Error) => {
      if (err) t.fail(err.message)

      fs.stat(path.join(torrentPath as string, 'alice.txt'), (err) => {
        if (err && (err as NodeJS.ErrnoException).code === 'ENOENT') t.pass('file deleted')
        else t.fail('file still exists')

        client.destroy((err?: Error) => {
          t.error(err, 'client destroyed')
        })
      })
    })
  })
})
