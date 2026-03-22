import http from 'http'
import path from 'path'
import finalhandler from 'finalhandler'
import { fixtures } from '@z-torrent/fixtures'
import MemoryChunkStore from 'memory-chunk-store'
import series from 'run-series'
import serveStatic from 'serve-static'
import { test, expect } from 'bun:test'
import { WebTorrent } from '../../dist/index.js'

const WEB_SEED_TIMEOUT_MS = 500

test('Download using webseed (via .torrent file)', { timeout: WEB_SEED_TIMEOUT_MS }, async () => {
  const parsedTorrent = Object.assign({}, fixtures.leaves.parsedTorrent)

  const httpServer = http.createServer((req, res) => {
    const done = finalhandler(req, res)
    serveStatic(path.dirname(fixtures.leaves.contentPath))(req, res, done)
  })
  let client: any

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
          parsedTorrent.urlList = [
            `http://localhost:${(httpServer.address() as any).port}/${fixtures.leaves.parsedTorrent.name}`,
          ]

          client = new WebTorrent({
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

          client.on('torrent', async (torrent: any) => {
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

          client.add(parsedTorrent, { store: MemoryChunkStore })
        },
      ],
      (err) => {
        if (err) {
          reject(err)
          return
        }
        client.destroy((err) => {
          if (err) reject(err)
        })
        httpServer.close(() => {})
        resolve()
      }
    )
  })
})

test('Disable webseeds', async () => {
  const parsedTorrent = Object.assign({}, fixtures.leaves.parsedTorrent)

  const httpServer = http.createServer((req, res) => {
    throw new Error('webseed http server should not get any requests')
  })
  let client: any

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
          parsedTorrent.urlList = [
            `http://localhost:${(httpServer.address() as any).port}/${fixtures.leaves.parsedTorrent.name}`,
          ]

          client = new WebTorrent({
            dht: false,
            tracker: false,
            lsd: false,
            webSeeds: false,
          })

          client.on('error', (err) => {
            throw err
          })
          client.on('warning', (err) => {
            throw err
          })

          client.add(parsedTorrent, { store: MemoryChunkStore })

          setTimeout(cb, WEB_SEED_TIMEOUT_MS)
        },
      ],
      (err) => {
        if (err) {
          reject(err)
          return
        }
        client.destroy((err) => {
          if (err) reject(err)
        })
        httpServer.close(() => {
          resolve()
        })
      }
    )
  })
})
