import fixtures from 'webtorrent-fixtures'
import MemoryChunkStore from 'memory-chunk-store'
import { randomBytes } from 'uint8-util'
import { test, expect } from 'bun:test'
import WebTorrent from '../../dist/index.js'

test('client.add: emit torrent events in order', async () => {
  const client1 = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })
  const client2 = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })

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

test('client.seed: emit torrent events in order', async () => {
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

  const torrent = client.seed(fixtures.leaves.content)

  let order = 0

  await new Promise<void>((resolve, reject) => {
    torrent.on('infoHash', () => {
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
    })
    torrent.on('seed', () => {
      expect(++order).toBe(5)
      client.destroy((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
})

test('file.select: check multiple idle events', { timeout: 15000 }, async () => {
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

  const fileA = Buffer.from(randomBytes(16 * 1024))
  const fileB = Buffer.from(randomBytes(16 * 1024))

  await new Promise<void>((resolve, reject) => {
    client2.seed([fileA, fileB], { announce: [] }, (seedTorrent: any) => {
      const magnet = seedTorrent.magnetURI + '&so=0'

      const torrent = client1.add(magnet, { store: MemoryChunkStore })

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

      torrent.on('idle', () => {
        ++order

        if (order === 4) {
          torrent.files[1].select(0)
        } else if (order === 5) {
          client1.destroy((err) => {
            if (err) reject(err)
          })
          client2.destroy((err) => {
            if (err) reject(err)
            else resolve()
          })
        }
      })
    })
  })
})
