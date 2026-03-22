import { Client } from '../src/index.js'
import common from './common.js'
import { fixtures } from '@z-torrent/fixtures'

import { testWrtc } from './helpers.js'

const peerId = Buffer.from('01234567890123456789')
const port = 6681

test('ensure client.destroy() callback is called with re-used websockets in socketPool', () => {
  return new Promise((resolve, reject) => {
    common.createServer('ws', (server, announceUrl) => {
      const client1 = new Client({
        infoHash: fixtures.leaves.parsedTorrent.infoHash,
        announce: announceUrl,
        peerId,
        port,
        wrtc: testWrtc,
      })

      client1.on('error', (err) => {
        throw err
      })
      client1.on('warning', (err) => {
        throw err
      })

      client1.start()

      client1.once('update', () => {
        const client2 = new Client({
          infoHash: fixtures.alice.parsedTorrent.infoHash,
          announce: announceUrl,
          peerId,
          port,
          wrtc: testWrtc,
        })

        client2.on('error', (err) => {
          throw err
        })
        client2.on('warning', (err) => {
          throw err
        })

        client2.start()

        client2.once('update', () => {
          client1.destroy(() => {
            client2.destroy(() => {
              server.close()
              resolve()
            })
          })
        })
      })
    })
  })
})
