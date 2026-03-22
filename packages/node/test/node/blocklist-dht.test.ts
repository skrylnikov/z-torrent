import { DHT } from '@z-torrent/dht'
import { fixtures } from '@z-torrent/fixtures'
import series from 'run-series'
import { test, expect } from 'bun:test'
import { ZTorrent } from '../../dist/index.js'
import { getDownloadPath, LIVE_NETWORK, LIVE_TEST_TIMEOUT_MS } from '../common.js'

test.skipIf(!LIVE_NETWORK)('blocklist blocks peers discovered via DHT', async () => {
  let dhtServer: DHT
  let client1: any
  let client2: any

  await new Promise<void>((resolve, reject) => {
    series(
      [
        (cb) => {
          dhtServer = new DHT({ bootstrap: false })
          dhtServer.on('error', (err) => {
            throw err
          })
          dhtServer.on('warning', (err) => {
            throw err
          })
          dhtServer.listen(cb)
        },

        (cb) => {
          let torrentReady = false
          let announced = false

          client1 = new ZTorrent({
            tracker: false,
            lsd: false,
            dht: { bootstrap: `127.0.0.1:${dhtServer!.address().port}` },
          })
          client1.on('error', (err) => {
            throw err
          })
          client1.on('warning', (err) => {
            throw err
          })

          const torrent1 = client1.add(fixtures.leaves.parsedTorrent, {
            path: getDownloadPath('client_1', fixtures.leaves.parsedTorrent.infoHash),
          })

          torrent1.on('peer', () => {
            throw new Error('client1 should not find any peers')
          })

          torrent1.on('blockedPeer', () => {
            throw new Error('client1 should not block any peers')
          })

          torrent1.on('ready', () => {
            torrentReady = true
            maybeDone()
          })

          torrent1.on('dhtAnnounce', () => {
            announced = true
            maybeDone()
          })

          function maybeDone() {
            if (torrentReady && announced) cb(null)
          }
        },

        (cb) => {
          let blockedPeer = false
          let announced = false

          client2 = new ZTorrent({
            tracker: false,
            lsd: false,
            dht: { bootstrap: `127.0.0.1:${dhtServer!.address().port}` },
            blocklist: ['127.0.0.1'],
          })
          client2.on('error', (err) => {
            throw err
          })
          client2.on('warning', (err) => {
            throw err
          })

          const torrent2 = client2.add(fixtures.leaves.parsedTorrent, {
            path: getDownloadPath('client_2', fixtures.leaves.parsedTorrent.infoHash),
          })

          torrent2.on('blockedPeer', () => {
            blockedPeer = true
            maybeDone()
          })

          torrent2.on('dhtAnnounce', () => {
            announced = true
            maybeDone()
          })

          torrent2.on('peer', () => {
            throw new Error('client2 should not find any peers')
          })

          function maybeDone() {
            if (blockedPeer && announced) cb(null)
          }
        },
      ],
      (err) => {
        if (err) {
          reject(err)
          return
        }
        dhtServer!.destroy((err) => {
          if (err) reject(err)
        })
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
}, { timeout: LIVE_TEST_TIMEOUT_MS })
