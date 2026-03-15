import fs from 'fs'
import { Server as DHT } from 'bittorrent-dht'
import fixtures from 'webtorrent-fixtures'
import MemoryChunkStore from 'memory-chunk-store'
import series from 'run-series'
import { test, expect } from 'bun:test'
import WebTorrent from '../../dist/index.js'

test('Seed and download a file at the same time', async () => {
  const dhtServer = new DHT({ bootstrap: false })

  dhtServer.on('error', (err) => {
    throw err
  })
  dhtServer.on('warning', (err) => {
    throw err
  })

  let client1: any
  let client2: any

  await new Promise<void>((resolve, reject) => {
    series(
      [
        (cb) => {
          dhtServer.listen(cb)
        },

        (cb) => {
          let announced = false
          let loaded = false

          client1 = new WebTorrent({
            tracker: false,
            lsd: false,
            dht: { bootstrap: `127.0.0.1:${dhtServer.address().port}` },
          })

          client1.on('error', (err) => {
            throw err
          })
          client1.on('warning', (err) => {
            throw err
          })

          const torrent = client1.add(fixtures.leaves.torrent, {
            store: MemoryChunkStore,
          })

          torrent.on('dhtAnnounce', () => {
            announced = true
            maybeDone()
          })

          torrent.load(fs.createReadStream(fixtures.leaves.contentPath), (err) => {
            if (err) throw err
            loaded = true
            maybeDone()
          })

          function maybeDone() {
            if (announced && loaded) cb(null)
          }
        },

        (cb) => {
          let announced = false
          let loaded = false

          client2 = new WebTorrent({
            tracker: false,
            lsd: false,
            dht: { bootstrap: `127.0.0.1:${dhtServer.address().port}` },
          })

          client2.on('error', (err) => {
            throw err
          })
          client2.on('warning', (err) => {
            throw err
          })

          const torrent = client2.add(fixtures.alice.torrent, {
            store: MemoryChunkStore,
          })

          torrent.on('dhtAnnounce', () => {
            announced = true
            maybeDone()
          })

          torrent.load(fs.createReadStream(fixtures.alice.contentPath), (err) => {
            if (err) throw err
            loaded = true
            maybeDone()
          })

          function maybeDone() {
            if (announced && loaded) cb(null)
          }
        },

        (cb) => {
          let gotBuffer1 = false
          let gotBuffer2 = false
          let gotDone1 = false
          let gotDone2 = false

          client1.add(fixtures.alice.magnetURI, { store: MemoryChunkStore })

          client1.on('torrent', async (torrent: any) => {
            torrent.once('done', () => {
              gotDone1 = true
              maybeDone()
            })

            try {
              const ab = await torrent.files[0].arrayBuffer()
              expect(new Uint8Array(ab)).toEqual(new Uint8Array(fixtures.alice.content))
            } catch (err) {
              if (err) throw err
            }

            gotBuffer1 = true
            maybeDone()
          })

          client2.add(fixtures.leaves.magnetURI, { store: MemoryChunkStore })

          client2.on('torrent', async (torrent: any) => {
            torrent.once('done', () => {
              gotDone2 = true
              maybeDone()
            })

            try {
              const ab = await torrent.files[0].arrayBuffer()
              expect(new Uint8Array(ab)).toEqual(new Uint8Array(fixtures.leaves.content))
            } catch (err) {
              if (err) throw err
            }

            gotBuffer2 = true
            maybeDone()
          })

          function maybeDone() {
            if (gotBuffer1 && gotBuffer2 && gotDone1 && gotDone2) cb(null)
          }
        },
      ],
      (err) => {
        if (err) {
          reject(err)
          return
        }
        client1.destroy((err) => {
          if (err) reject(err)
        })
        client2.destroy((err) => {
          if (err) reject(err)
        })
        dhtServer.destroy((err) => {
          if (err) reject(err)
          else resolve()
        })
      }
    )
  })
})
