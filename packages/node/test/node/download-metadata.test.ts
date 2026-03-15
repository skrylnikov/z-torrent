import http from 'http'
import fixtures from 'webtorrent-fixtures'
import MemoryChunkStore from 'memory-chunk-store'
import { test, expect } from 'bun:test'
import WebTorrent from '../../dist/index.js'

function createServer(data: Buffer, cb: (url: string, server: http.Server) => void) {
  const server = http.createServer((req, res) => {
    if (req.url !== '/') {
      res.statusCode = 404
      res.end()
    } else {
      res.end(data)
    }
  })

  server.on('listening', () => {
    const address = server.address() as { port: number }
    const url = `http://127.0.0.1:${address.port}/`
    cb(url, server)
  })

  server.listen()
}

test('Download metadata for magnet URI with xs parameter', async () => {
  const client = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })

  client.on('error', (err) => {
    throw err
  })
  client.on('warning', (err) => {
    throw err
  })

  await new Promise<void>((resolve, reject) => {
    createServer(fixtures.leaves.torrent, (url, server) => {
      const encodedUrl = encodeURIComponent(url)
      client.add(
        `${fixtures.leaves.magnetURI}&xs=${encodedUrl}`,
        { store: MemoryChunkStore },
        (torrent) => {
          expect(torrent.files[0].name).toBe('Leaves of Grass by Walt Whitman.epub')
          client.destroy((err) => {
            if (err) reject(err)
          })
          server.close(() => {
            resolve()
          })
        }
      )
    })
  })
})

test('Download metadata for magnet URI with 2 xs parameters', async () => {
  const client = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })

  client.on('error', (err) => {
    throw err
  })
  client.on('warning', (err) => {
    throw err
  })

  await new Promise<void>((resolve, reject) => {
    createServer(fixtures.leaves.torrent, (url1, server1) => {
      const encodedUrl1 = encodeURIComponent(url1)

      createServer(fixtures.leaves.torrent, (url2, server2) => {
        const encodedUrl2 = encodeURIComponent(url2)
        const uri = `${fixtures.leaves.magnetURI}&xs=${encodedUrl1}&xs=${encodedUrl2}`

        client.add(uri, { store: MemoryChunkStore }, (torrent) => {
          expect(torrent.files[0].name).toBe('Leaves of Grass by Walt Whitman.epub')
          client.destroy((err) => {
            if (err) reject(err)
          })
          server1.close(() => {})
          server2.close(() => {
            resolve()
          })
        })
      })
    })
  })
})

test('Download metadata for magnet URI with 2 xs parameters, with 1 invalid protocol', async () => {
  const client = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })

  client.on('error', (err) => {
    throw err
  })
  client.on('warning', (err) => {
    throw err
  })

  await new Promise<void>((resolve, reject) => {
    createServer(fixtures.leaves.torrent, (url, server) => {
      const encodedUrl1 = encodeURIComponent('invalidurl:example')
      const encodedUrl2 = encodeURIComponent(url)
      const uri = `${fixtures.leaves.magnetURI}&xs=${encodedUrl1}&xs=${encodedUrl2}`

      client.add(uri, { store: MemoryChunkStore }, (torrent) => {
        expect(torrent.files[0].name).toBe('Leaves of Grass by Walt Whitman.epub')
        client.destroy((err) => {
          if (err) reject(err)
        })
        server.close(() => {
          resolve()
        })
      })
    })
  })
})

test('Download metadata for magnet URI with 2 xs parameters, with 1 404 URL', async () => {
  const client = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })

  client.on('error', (err) => {
    throw err
  })
  client.on('warning', (err) => {
    throw err
  })

  await new Promise<void>((resolve, reject) => {
    createServer(fixtures.leaves.torrent, (url, server) => {
      const encodedUrl1 = encodeURIComponent(`${url}blah_404`)
      const encodedUrl2 = encodeURIComponent(url)
      const uri = `${fixtures.leaves.magnetURI}&xs=${encodedUrl1}&xs=${encodedUrl2}`

      client.add(uri, { store: MemoryChunkStore }, (torrent) => {
        expect(torrent.files[0].name).toBe('Leaves of Grass by Walt Whitman.epub')
        client.destroy((err) => {
          if (err) reject(err)
        })
        server.close(() => {
          resolve()
        })
      })
    })
  })
})

test('Download metadata magnet URI with unsupported protocol in xs parameter', async () => {
  const client = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })

  client.on('error', (err) => {
    throw err
  })
  client.on('warning', (err) => {
    throw err
  })

  client.add(
    `${fixtures.leaves.magnetURI}&xs=${encodeURIComponent('invalidurl:example')}`,
    { store: MemoryChunkStore }
  )

  await new Promise<void>((resolve) => {
    setTimeout(() => {
      client.destroy((err) => {
        if (err) throw err
        resolve()
      })
    }, 100)
  })
})
