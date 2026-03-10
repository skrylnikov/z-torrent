import http from 'http'
import path from 'path'
import finalhandler from 'finalhandler'
import fixtures from 'webtorrent-fixtures'
import MemoryChunkStore from 'memory-chunk-store'
import series from 'run-series'
import serveStatic from 'serve-static'
import { test, expect } from 'bun:test'
import WebTorrent from '../../dist/index.js'

test('Download using webseed (via magnet uri)', async () => {
  const serve = serveStatic(path.dirname(fixtures.leaves.contentPath))
  const httpServer = http.createServer((req, res) => {
    const done = finalhandler(req, res)
    serve(req, res, done)
  })
  let client1: any
  let client2: any

  httpServer.on('error', (err) => {
    throw err
  })

  await new Promise<void>((resolve, reject) => {
    series(
      [
        (cb) => {
          httpServer.listen(cb)
        },

        (cb) => {
          client1 = new WebTorrent({
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

          let gotTorrent = false
          let gotListening = false
          function maybeDone() {
            if (gotTorrent && gotListening) cb(null)
          }

          client1.on('torrent', (torrent: any) => {
            expect(torrent.name).toBe('Leaves of Grass by Walt Whitman.epub')
            expect(torrent.files.map((f: any) => f.name)).toEqual([
              'Leaves of Grass by Walt Whitman.epub',
            ])
            gotTorrent = true
            maybeDone()
          })

          const torrent = client1.add(fixtures.leaves.parsedTorrent, {
            store: MemoryChunkStore,
          })

          torrent.on('infoHash', () => {
            gotListening = true
            maybeDone()
          })
        },

        (cb) => {
          client2 = new WebTorrent({
            dht: false,
            tracker: false,
            lsd: false,
            natUpnp: false,
            natPmp: false,
          })

          client2.on('error', (err) => {
            throw err
          })
          client2.on('warning', (err) => {
            throw err
          })

          const webSeedUrl = `http://localhost:${(httpServer.address() as any).port}/${fixtures.leaves.parsedTorrent.name}`
          const magnetURI = `${fixtures.leaves.magnetURI}&ws=${encodeURIComponent(webSeedUrl)}`

          client2.on('torrent', async (torrent: any) => {
            let gotBuffer = false
            let torrentDone = false
            function maybeDone() {
              if (gotBuffer && torrentDone) cb(null)
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

          const torrent = client2.add(magnetURI, { store: MemoryChunkStore })
          torrent.on('infoHash', () => {
            torrent.addPeer(`127.0.0.1:${client1.address().port}`)
          })
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
        httpServer.close(() => {
          resolve()
        })
      }
    )
  })
})
