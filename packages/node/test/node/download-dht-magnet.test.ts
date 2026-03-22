import fs from 'fs'
import { DHT } from '@z-torrent/dht'
import { fixtures } from '@z-torrent/fixtures'
import MemoryChunkStore from 'memory-chunk-store'
import networkAddress from 'network-address'
import series from 'run-series'
import { test, expect } from 'bun:test'
import { WebTorrent } from '../../dist/index.js'

test('Download using DHT (via magnet uri)', async () => {
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
            dht: {
              bootstrap: `127.0.0.1:${dhtServer.address().port}`,
              host: networkAddress.ipv4(),
            },
          })

          client1.dht.on('listening', () => {
            expect(client1.dhtPort).toBe(client1.dht.address().port)
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

          torrent.on('dhtAnnounce', () => {
            announced = true
            maybeDone()
          })

          torrent.on('ready', () => {
            expect(torrent.name).toBe('Leaves of Grass by Walt Whitman.epub')
            expect(torrent.files.map((f: any) => f.name)).toEqual([
              'Leaves of Grass by Walt Whitman.epub',
            ])
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
          let gotBuffer = false
          let gotDone = false

          client2 = new WebTorrent({
            tracker: false,
            lsd: false,
            dht: {
              bootstrap: `127.0.0.1:${dhtServer.address().port}`,
              host: networkAddress.ipv4(),
            },
          })

          client2.on('error', (err) => {
            throw err
          })
          client2.on('warning', (err) => {
            throw err
          })

          client2.on('torrent', async (torrent: any) => {
            torrent.once('done', () => {
              gotDone = true
              maybeDone()
            })

            try {
              const ab = await torrent.files[0].arrayBuffer()
              expect(new Uint8Array(ab)).toEqual(new Uint8Array(fixtures.leaves.content))
            } catch (err) {
              if (err) throw err
            }

            gotBuffer = true
            maybeDone()
          })

          client2.add(fixtures.leaves.magnetURI, { store: MemoryChunkStore })

          function maybeDone() {
            if (gotBuffer && gotDone) cb(null)
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
