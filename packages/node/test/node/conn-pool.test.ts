import fixtures from 'webtorrent-fixtures'
import MemoryChunkStore from 'memory-chunk-store'
import dgram from 'dgram'
import { test, expect } from 'bun:test'
import WebTorrent from '../../dist/index.js'

test('client.conn-pool: use TCP when uTP disabled', async () => {
  const client1 = new WebTorrent({ dht: false, tracker: false, lsd: false, utp: false })
  const client2 = new WebTorrent({ dht: false, tracker: false, lsd: false, utp: false })

  client1.on('error', (err) => {
    throw err
  })
  client1.on('warning', (err) => {
    throw err
  })

  client2.on('error', (err) => {
    throw err
  })
  client2.on('warning', (err) => {
    throw err
  })

  client2.seed(fixtures.leaves.content, {
    name: 'Leaves of Grass by Walt Whitman.epub',
    announce: [],
  })

  await new Promise<void>((resolve, reject) => {
    client2.on('listening', () => {
      const torrent = client1.add(fixtures.leaves.parsedTorrent.infoHash, {
        store: MemoryChunkStore,
      })

      let order = 0

      torrent.on('infoHash', () => {
        torrent.addPeer(`127.0.0.1:${client2.address().port}`)
        expect(++order).toBe(1)
      })

      torrent.on('metadata', () => {
        expect(++order).toBe(2)
      })

      torrent.on('ready', () => {
        expect(++order).toBe(3)
      })

      torrent.on('done', () => {
        expect(++order).toBe(4)

        client1.destroy((err) => {
          if (err) reject(err)
        })
        client2.destroy((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    })
  })
})

test('client.conn-pool: use uTP when uTP enabled', async () => {
  const client1 = new WebTorrent({ dht: false, tracker: false, lsd: false, utp: true })
  const client2 = new WebTorrent({ dht: false, tracker: false, lsd: false, utp: true })

  client1.on('error', (err) => {
    throw err
  })
  client1.on('warning', (err) => {
    throw err
  })

  client2.on('error', (err) => {
    throw err
  })
  client2.on('warning', (err) => {
    throw err
  })

  client2.seed(fixtures.leaves.content, {
    name: 'Leaves of Grass by Walt Whitman.epub',
    announce: [],
  })

  await new Promise<void>((resolve, reject) => {
    client2.on('listening', () => {
      const torrent = client1.add(fixtures.leaves.parsedTorrent.infoHash, {
        store: MemoryChunkStore,
      })

      let order = 0

      torrent.on('infoHash', () => {
        torrent.addPeer(`127.0.0.1:${client2.address().port}`)
        expect(++order).toBe(1)
      })

      torrent.on('metadata', () => {
        expect(++order).toBe(2)
      })

      torrent.on('ready', () => {
        expect(++order).toBe(3)
      })

      torrent.on('done', () => {
        expect(++order).toBe(4)

        client1.destroy((err) => {
          if (err) reject(err)
        })
        client2.destroy((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    })
  })
})

test('client.conn-pool: adding IPv6 peer when uTP enabled should fallback to TCP', async () => {
  const client1 = new WebTorrent({ dht: false, tracker: false, lsd: false, utp: true })
  const client2 = new WebTorrent({ dht: false, tracker: false, lsd: false, utp: true })

  client1.on('error', (err) => {
    throw err
  })
  client1.on('warning', (err) => {
    throw err
  })

  client2.on('error', (err) => {
    throw err
  })
  client2.on('warning', (err) => {
    throw err
  })

  client2.seed(fixtures.leaves.content, {
    name: 'Leaves of Grass by Walt Whitman.epub',
    announce: [],
  })

  await new Promise<void>((resolve, reject) => {
    client2.on('listening', () => {
      const torrent = client1.add(fixtures.leaves.parsedTorrent.infoHash, {
        store: MemoryChunkStore,
      })

      let order = 0

      torrent.on('infoHash', () => {
        torrent.addPeer(`[::1]:${client2.address().port}`)
        expect(++order).toBe(1)
      })

      torrent.on('metadata', () => {
        expect(++order).toBe(2)
      })

      torrent.on('ready', () => {
        expect(++order).toBe(3)
      })

      torrent.on('done', () => {
        expect(++order).toBe(4)

        client1.destroy((err) => {
          if (err) reject(err)
        })
        client2.destroy((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    })
  })
})

test('client.conn-pool: fallback to TCP when uTP server failed', async () => {
  const server = dgram.createSocket('udp4')
  server.bind(63000)

  const client1 = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    utp: true,
    torrentPort: 63000,
  })
  const client2 = new WebTorrent({ dht: false, tracker: false, lsd: false, utp: false })

  client1.on('error', (err) => {
    expect(err.toString()).toMatch(/address already in use|Failed to listen/)
  })
  client1.on('warning', (err) => {
    throw err
  })

  client2.on('error', (err) => {
    throw err
  })
  client2.on('warning', (err) => {
    throw err
  })

  client2.seed(fixtures.leaves.content, {
    name: 'Leaves of Grass by Walt Whitman.epub',
    announce: [],
  })

  await new Promise<void>((resolve, reject) => {
    client2.on('listening', () => {
      const torrent = client1.add(fixtures.leaves.parsedTorrent.infoHash, {
        store: MemoryChunkStore,
      })

      let order = 0

      torrent.on('infoHash', () => {
        torrent.addPeer(`127.0.0.1:${client2.address().port}`)
        expect(++order).toBe(1)
      })

      torrent.on('metadata', () => {
        expect(++order).toBe(2)
      })

      torrent.on('ready', () => {
        expect(++order).toBe(3)
      })

      torrent.on('done', () => {
        expect(++order).toBe(4)

        client1.destroy((err) => {
          if (err) reject(err)
        })
        client2.destroy((err) => {
          if (err) reject(err)
          else resolve()
        })

        server.close()
      })
    })
  })
})

test('client.conn-pool: fallback to TCP when remote client has uTP disabled', async () => {
  const client1 = new WebTorrent({ dht: false, tracker: false, lsd: false, utp: true })
  const client2 = new WebTorrent({ dht: false, tracker: false, lsd: false, utp: false })

  client1.on('error', (err) => {
    throw err
  })
  client1.on('warning', (err) => {
    throw err
  })

  client2.on('error', (err) => {
    throw err
  })
  client2.on('warning', (err) => {
    throw err
  })

  client2.seed(fixtures.leaves.content, {
    name: 'Leaves of Grass by Walt Whitman.epub',
    announce: [],
  })

  await new Promise<void>((resolve, reject) => {
    client2.on('listening', () => {
      const torrent = client1.add(fixtures.leaves.parsedTorrent.infoHash, {
        store: MemoryChunkStore,
      })

      let order = 0

      torrent.on('infoHash', () => {
        torrent.addPeer(`127.0.0.1:${client2.address().port}`)
        expect(++order).toBe(1)
      })

      torrent.on('metadata', () => {
        expect(++order).toBe(2)
      })

      torrent.on('ready', () => {
        expect(++order).toBe(3)
      })

      torrent.on('done', () => {
        expect(++order).toBe(4)

        client1.destroy((err) => {
          if (err) reject(err)
        })
        client2.destroy((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    })
  })
})
