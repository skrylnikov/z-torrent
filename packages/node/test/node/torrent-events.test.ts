import { fixtures } from '@z-torrent/fixtures'
import MemoryChunkStore from 'memory-chunk-store'
import { randomBytes } from 'uint8-util'
import { test, expect } from 'bun:test'
import { ZTorrent } from '../../dist/index.js'
import { LIVE_NETWORK, LIVE_TEST_TIMEOUT_MS, SEED_HEAVY_TIMEOUT_MS } from '../common.js'

test('client.add: emit torrent events in order', async () => {
  const leavesContent = fixtures.leaves.content
  const leavesInfoHash = fixtures.leaves.parsedTorrent?.infoHash
  if (!leavesContent || !leavesInfoHash) throw new Error('leaves fixture incomplete')

  const client1 = new ZTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })
  const client2 = new ZTorrent({
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

  client2.seed(leavesContent, {
    name: 'Leaves of Grass by Walt Whitman.epub',
    announce: [],
  })

  await new Promise<void>((resolve, reject) => {
    client2.on('listening', () => {
      const torrent = client1.add(leavesInfoHash, {
        store: MemoryChunkStore,
      })

      let order = 0

      torrent.on('infoHash', () => {
        const addr = client2.address()
        if (!addr) {
          reject(new Error('client2 not listening'))
          return
        }
        torrent.addPeer(`127.0.0.1:${addr.port}`)
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

        client1.destroy(() => {
          client2.destroy(() => resolve())
        })
      })
    })
  })
}, { timeout: SEED_HEAVY_TIMEOUT_MS })

test('client.seed: emit torrent events in order', async () => {
  const leavesContent = fixtures.leaves.content
  if (!leavesContent) throw new Error('leaves fixture incomplete')

  const client = new ZTorrent({
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

  const torrent = client.seed(leavesContent)

  let order = 0

  await new Promise<void>((resolve) => {
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
      client.destroy(() => resolve())
    })
  })
}, { timeout: SEED_HEAVY_TIMEOUT_MS })

test.skipIf(!LIVE_NETWORK)('file.select: check multiple idle events', async () => {
  const client1 = new ZTorrent({ dht: false, tracker: false, lsd: false, utp: false })
  const client2 = new ZTorrent({ dht: false, tracker: false, lsd: false, utp: false })

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
        const addr = client2.address()
        if (!addr) {
          reject(new Error('client2 not listening'))
          return
        }
        torrent.addPeer(`127.0.0.1:${addr.port}`)
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
          client1.destroy(() => {
            client2.destroy(() => resolve())
          })
        }
      })
    })
  })
}, { timeout: LIVE_TEST_TIMEOUT_MS })
