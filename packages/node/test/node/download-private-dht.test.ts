import { DHT } from '@z-torrent/dht'
import { fixtures } from '@z-torrent/fixtures'
import MemoryChunkStore from 'memory-chunk-store'
import series from 'run-series'
import { test, expect } from 'bun:test'
import { ZTorrent } from '../../dist/index.js'

test('private torrent should not use DHT', async () => {
  const dhtServer = new DHT({ bootstrap: false })

  dhtServer.on('error', (err) => {
    throw err
  })
  dhtServer.on('warning', (err) => {
    throw err
  })

  let client: any

  await new Promise<void>((resolve, reject) => {
    series(
      [
        (cb) => {
          dhtServer.listen(cb)
        },

        (cb) => {
          client = new ZTorrent({
            tracker: false,
            lsd: false,
            dht: { bootstrap: `127.0.0.1:${dhtServer.address().port}` },
          })

          client.on('error', (err) => {
            throw err
          })
          client.on('warning', (err) => {
            throw err
          })

          const torrent = client.add(fixtures.bunny.parsedTorrent, {
            store: MemoryChunkStore,
          })

          torrent.on('dhtAnnounce', () => {
            throw new Error('client announced to dht')
          })

          client.on('torrent', (t: any) => {
            if (!t.discovery.dht) {
              cb(null)
            }
          })
        },
      ],
      (err) => {
        if (err) {
          reject(err)
          return
        }
        dhtServer.destroy((err) => {
          if (err) reject(err)
        })
        client.destroy((err) => {
          if (err) reject(err)
          else resolve()
        })
      }
    )
  })
})

test('public torrent should use DHT', async () => {
  const dhtServer = new DHT({ bootstrap: false })

  dhtServer.on('error', (err) => {
    throw err
  })
  dhtServer.on('warning', (err) => {
    throw err
  })

  let client: any

  await new Promise<void>((resolve, reject) => {
    series(
      [
        (cb) => {
          dhtServer.listen(cb)
        },

        (cb) => {
          client = new ZTorrent({
            tracker: false,
            lsd: false,
            dht: { bootstrap: `127.0.0.1:${dhtServer.address().port}` },
          })

          client.on('error', (err) => {
            throw err
          })
          client.on('warning', (err) => {
            throw err
          })

          const torrent = client.add(fixtures.leaves.parsedTorrent, {
            store: MemoryChunkStore,
          })

          torrent.on('dhtAnnounce', () => {
            cb(null)
          })

          client.on('torrent', (t: any) => {
            if (!t.client.dht) {
              throw new Error('dht server is null')
            }
          })
        },
      ],
      (err) => {
        if (err) {
          reject(err)
          return
        }
        dhtServer.destroy((err) => {
          if (err) reject(err)
        })
        client.destroy((err) => {
          if (err) reject(err)
          else resolve()
        })
      }
    )
  })
})

test('public torrent with forced private option should not use DHT', async () => {
  const dhtServer = new DHT({ bootstrap: false })

  dhtServer.on('error', (err) => {
    throw err
  })
  dhtServer.on('warning', (err) => {
    throw err
  })

  let client: any

  await new Promise<void>((resolve, reject) => {
    series(
      [
        (cb) => {
          dhtServer.listen(cb)
        },

        (cb) => {
          client = new ZTorrent({
            tracker: false,
            lsd: false,
            dht: { bootstrap: `127.0.0.1:${dhtServer.address().port}` },
          })

          client.on('error', (err) => {
            throw err
          })
          client.on('warning', (err) => {
            throw err
          })

          const torrent = client.add(fixtures.leaves.parsedTorrent, {
            private: true,
            store: MemoryChunkStore,
          })

          torrent.on('dhtAnnounce', () => {
            throw new Error('client announced to dht')
          })

          client.on('torrent', (t: any) => {
            if (!t.discovery.dht) {
              cb(null)
            }
          })
        },
      ],
      (err) => {
        if (err) {
          reject(err)
          return
        }
        dhtServer.destroy((err) => {
          if (err) reject(err)
        })
        client.destroy((err) => {
          if (err) reject(err)
          else resolve()
        })
      }
    )
  })
})

test('private torrent with forced public option should use DHT', async () => {
  const dhtServer = new DHT({ bootstrap: false })

  dhtServer.on('error', (err) => {
    throw err
  })
  dhtServer.on('warning', (err) => {
    throw err
  })

  let client: any

  await new Promise<void>((resolve, reject) => {
    series(
      [
        (cb) => {
          dhtServer.listen(cb)
        },

        (cb) => {
          client = new ZTorrent({
            tracker: false,
            lsd: false,
            dht: { bootstrap: `127.0.0.1:${dhtServer.address().port}` },
          })

          client.on('error', (err) => {
            throw err
          })
          client.on('warning', (err) => {
            throw err
          })

          const torrent = client.add(fixtures.bunny.parsedTorrent, {
            private: false,
            store: MemoryChunkStore,
          })

          torrent.on('dhtAnnounce', () => {
            cb(null)
          })

          client.on('torrent', (t: any) => {
            if (!t.client.dht) {
              throw new Error('dht server is null')
            }
          })
        },
      ],
      (err) => {
        if (err) {
          reject(err)
          return
        }
        dhtServer.destroy((err) => {
          if (err) reject(err)
        })
        client.destroy((err) => {
          if (err) reject(err)
          else resolve()
        })
      }
    )
  })
})
