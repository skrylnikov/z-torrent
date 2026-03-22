import fs from 'fs'
import { fixtures } from '@z-torrent/fixtures'
import MemoryChunkStore from 'memory-chunk-store'
import series from 'run-series'
import { test, expect } from 'bun:test'
import { Server as TrackerServer } from '@z-torrent/tracker'
import { WebTorrent } from '../../dist/index.js'
import { LIVE_NETWORK, LIVE_TEST_TIMEOUT_MS } from '../common.js'

test.skipIf(!LIVE_NETWORK)('Download using UDP tracker (via magnet uri)', { timeout: LIVE_TEST_TIMEOUT_MS }, () =>
  magnetDownloadTest('udp'))
test.skipIf(!LIVE_NETWORK)('Download using HTTP tracker (via magnet uri)', { timeout: LIVE_TEST_TIMEOUT_MS }, () =>
  magnetDownloadTest('http'))
test.skipIf(!LIVE_NETWORK)('Download using WS tracker (via magnet uri)', { timeout: LIVE_TEST_TIMEOUT_MS }, () =>
  magnetDownloadTest('ws'))

const TRACKER_CONFIG_MAP: Record<string, { http?: boolean; ws?: boolean; udp?: boolean }> = {
  udp: { http: false, ws: false },
  http: { udp: false, ws: false },
  ws: { udp: false, http: false, ws: true },
}

function magnetDownloadTest(serverType: 'udp' | 'http' | 'ws') {
  return new Promise<void>((resolve, reject) => {
    const tracker = new TrackerServer(TRACKER_CONFIG_MAP[serverType])

    tracker.on('error', (err) => {
      throw err
    })
    tracker.on('warning', (err) => {
      throw err
    })

    let trackerStartCount = 0
    tracker.on('start', () => {
      trackerStartCount += 1
    })

    const parsedTorrent = Object.assign({}, fixtures.leaves.parsedTorrent)
    let magnetURI: string
    let client1: any
    let client2: any

    series(
      [
        (cb) => {
          tracker.listen(cb)
        },

        (cb) => {
          const port = (tracker as any)[serverType].address().port
          const announceUrl = `${serverType}://127.0.0.1:${port}/announce`
          parsedTorrent.announce = [announceUrl]
          magnetURI = `magnet:?xt=urn:btih:${parsedTorrent.infoHash}&tr=${encodeURIComponent(announceUrl)}`

          client1 = new WebTorrent({ dht: false, lsd: false })
          client1.on('error', (err) => {
            throw err
          })
          client1.on('warning', (err) => {
            throw err
          })

          client1.on('torrent', (torrent: any) => {
            let noPeersDone = false
            let torrentLoaded = false

            expect(torrent.name).toBe('Leaves of Grass by Walt Whitman.epub')
            expect(torrent.files.map((f: any) => f.name)).toEqual([
              'Leaves of Grass by Walt Whitman.epub',
            ])

            torrent.once('noPeers', (announceType: string) => {
              expect(announceType).toBe('tracker')
              noPeersDone = true
              maybeDone()
            })

            torrent.load(fs.createReadStream(fixtures.leaves.contentPath), () => {
              torrentLoaded = true
              maybeDone()
            })

            function maybeDone() {
              if (noPeersDone && torrentLoaded) cb(null)
            }
          })

          client1.add(parsedTorrent, { store: MemoryChunkStore })
        },

        (cb) => {
          client2 = new WebTorrent({ dht: false, lsd: false })
          client2.on('error', (err) => {
            throw err
          })
          client2.on('warning', (err) => {
            throw err
          })

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

          client2.add(magnetURI!, { store: MemoryChunkStore })
        },
      ],
      (err) => {
        if (err) {
          reject(err)
          return
        }
        expect(trackerStartCount).toBe(2)
        tracker.close(() => {})
        client1.destroy((err) => {
          if (err) reject(err)
        })
        client2.destroy((err) => {
          if (err) reject(err)
          else resolve()
        })
      }
    )
  })
}
