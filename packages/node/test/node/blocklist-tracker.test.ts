import fixtures from 'webtorrent-fixtures'
import series from 'run-series'
import { test, expect } from 'bun:test'
import { Server as TrackerServer } from 'bittorrent-tracker'
import WebTorrent from '../../dist/index.js'
import common from '../common.js'

test('blocklist blocks peers discovered via tracker', { timeout: 15000 }, async () => {
  const parsedTorrent = Object.assign({}, fixtures.leaves.parsedTorrent)
  let tracker: any
  let client1: any
  let client2: any

  await new Promise<void>((resolve, reject) => {
    series(
      [
        (cb) => {
          tracker = new TrackerServer({ udp: false, ws: false })

          tracker.listen(() => {
            const port = tracker.http.address().port
            const announceUrl = `http://127.0.0.1:${port}/announce`
            parsedTorrent.announce = announceUrl
            cb(null)
          })

          tracker.once('start', () => {
            tracker.once('start', () => {})
          })
        },

        (cb) => {
          client1 = new WebTorrent({ dht: false, lsd: false })
          client1.on('error', (err) => {
            throw err
          })
          client1.on('warning', (err) => {
            throw err
          })

          const torrent1 = client1.add(parsedTorrent, {
            path: common.getDownloadPath('client_1', parsedTorrent.infoHash),
          })

          torrent1.on('invalidPeer', () => {
            cb(null)
          })

          torrent1.on('blockedPeer', () => {
            throw new Error('client1 should not block any peers')
          })
        },

        (cb) => {
          client2 = new WebTorrent({
            dht: false,
            lsd: false,
            blocklist: ['127.0.0.1'],
          })
          client2.on('error', (err) => {
            throw err
          })
          client2.on('warning', (err) => {
            throw err
          })

          const torrent2 = client2.add(parsedTorrent, {
            path: common.getDownloadPath('client_2', parsedTorrent.infoHash),
          })

          torrent2.once('blockedPeer', () => {
            torrent2.once('blockedPeer', () => {
              cb(null)
            })
          })

          torrent2.on('peer', () => {
            throw new Error('client2 should not find any peers')
          })
        },
      ],
      (err) => {
        if (err) {
          reject(err)
          return
        }
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
})
