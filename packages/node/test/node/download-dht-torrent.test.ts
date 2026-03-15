import fs from 'fs'
import { Server as DHT } from 'bittorrent-dht'
import fixtures from 'webtorrent-fixtures'
import MemoryChunkStore from 'memory-chunk-store'
import series from 'run-series'
import { test, expect } from 'bun:test'
import WebTorrent from '../../dist/index.js'

test('Download using DHT (via .torrent file)', { timeout: 15000 }, async () => {
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
          let noPeersFound = false

          client1 = new WebTorrent({
            tracker: false,
            lsd: false,
            dht: { bootstrap: `127.0.0.1:${dhtServer.address().port}` },
            utPex: false,
          })

          client1.on('error', (err) => {
            throw err
          })
          client1.on('warning', (err) => {
            throw err
          })

          const torrent = client1.add(fixtures.leaves.parsedTorrent, {
            store: MemoryChunkStore,
          })

          torrent.on('ready', () => {
            expect(torrent.name).toBe('Leaves of Grass by Walt Whitman.epub')
            expect(torrent.files.map((f: any) => f.name)).toEqual([
              'Leaves of Grass by Walt Whitman.epub',
            ])
          })

          torrent.load(fs.createReadStream(fixtures.leaves.contentPath), (err) => {
            loaded = true
            maybeDone(err)
          })

          torrent.on('dhtAnnounce', () => {
            announced = true
            maybeDone(null)
          })

          torrent.on('noPeers', (announceType: string) => {
            expect(announceType).toBe('dht')
            noPeersFound = true
            maybeDone(null)
          })

          function maybeDone(err: Error | null) {
            if ((announced && loaded && noPeersFound) || err) cb(err)
          }
        },

        (cb) => {
          client2 = new WebTorrent({
            tracker: false,
            lsd: false,
            dht: { bootstrap: `127.0.0.1:${dhtServer.address().port}` },
            utPex: false,
          })

          client2.on('error', (err) => {
            throw err
          })
          client2.on('warning', (err) => {
            throw err
          })

          client2.on('torrent', async (torrent: any) => {
            let torrentDone = false
            let gotBuffer = false
            function maybeDone() {
              if (torrentDone && gotBuffer) cb(null)
            }

            torrent.once('done', () => {
              torrentDone = true
              maybeDone()
            })

            for (const file of torrent.files) {
              try {
                const ab = await file.arrayBuffer()
                expect(new Uint8Array(ab)).toEqual(new Uint8Array(fixtures.leaves.content))
              } catch (err) {
                if (err) throw err
              }
              gotBuffer = true
              maybeDone()
            }
          })

          client2.add(fixtures.leaves.parsedTorrent, { store: MemoryChunkStore })
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
