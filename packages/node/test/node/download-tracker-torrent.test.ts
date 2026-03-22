import fs from 'fs'
import { fixtures } from '@z-torrent/fixtures'
import MemoryChunkStore from 'memory-chunk-store'
import series from 'run-series'
import { test, expect } from 'bun:test'
import { Server as TrackerServer } from '@z-torrent/tracker'
import { ZTorrent } from '../../dist/index.js'
import { LIVE_NETWORK, LIVE_TEST_TIMEOUT_MS } from '../common.js'

test.skipIf(!LIVE_NETWORK)('Download using UDP tracker (via .torrent file)', { timeout: LIVE_TEST_TIMEOUT_MS }, () =>
  torrentDownloadTest('udp'))
test.skipIf(!LIVE_NETWORK)('Download using HTTP tracker (via .torrent file)', { timeout: LIVE_TEST_TIMEOUT_MS }, () =>
  torrentDownloadTest('http'))
test.skipIf(!LIVE_NETWORK)('Download using WS tracker (via .torrent file)', { timeout: LIVE_TEST_TIMEOUT_MS }, () =>
  torrentDownloadTest('ws'))

const TRACKER_CONFIG_MAP: Record<string, { http?: boolean; ws?: boolean; udp?: boolean }> = {
  udp: { http: false, ws: false },
  http: { udp: false, ws: false },
  ws: { udp: false, http: false, ws: true },
}

function torrentDownloadTest(serverType: 'udp' | 'http' | 'ws') {
  return new Promise<void>((resolve, reject) => {
    let trackerStartCount = 0
    const parsedTorrent = Object.assign({}, fixtures.leaves.parsedTorrent)

    const tracker = new TrackerServer(TRACKER_CONFIG_MAP[serverType])

    tracker.on('error', (err) => {
      throw err
    })
    tracker.on('warning', (err) => {
      throw err
    })

    tracker.on('start', () => {
      trackerStartCount += 1
    })

    let client1: any
    let client2: any

    series(
      [
        (cb) => {
          tracker.listen(cb)
        },

        (cb) => {
          client1 = new ZTorrent({ dht: false, lsd: false })
          client1.on('error', (err) => {
            throw err
          })
          client1.on('warning', (err) => {
            throw err
          })

          const port = (tracker as any)[serverType].address().port
          const announceUrl = `${serverType}://127.0.0.1:${port}/announce`
          parsedTorrent.announce = [announceUrl]

          client1.on('torrent', (torrent: any) => {
            expect(torrent.name).toBe('Leaves of Grass by Walt Whitman.epub')
            expect(torrent.files.map((f: any) => f.name)).toEqual([
              'Leaves of Grass by Walt Whitman.epub',
            ])
            torrent.load(fs.createReadStream(fixtures.leaves.contentPath), cb)
          })

          client1.add(parsedTorrent, { store: MemoryChunkStore })
        },

        (cb) => {
          client2 = new ZTorrent({ dht: false, lsd: false })
          client2.on('error', (err) => {
            throw err
          })
          client2.on('warning', (err) => {
            throw err
          })

          client2.add(parsedTorrent, { store: MemoryChunkStore })

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
