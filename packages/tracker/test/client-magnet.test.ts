import { magnet } from '@z-torrent/magnet'
import { Client } from '../src/index.js'
import common from './common.js'
import { fixtures } from '@z-torrent/fixtures'

import { testWrtc } from './helpers.js'

const peerId = Buffer.from('01234567890123456789')

function testMagnet(serverType: 'http' | 'udp' | 'ws'): Promise<void> {
  const parsedTorrent = magnet.decode(fixtures.leaves.magnetURI!)

  return new Promise((resolve, reject) => {
    common.createServer(serverType, (server, announceUrl) => {
      const client = new Client({
        infoHash: parsedTorrent.infoHash!,
        announce: announceUrl,
        peerId,
        port: 6881,
        wrtc: testWrtc,
      })

      client.on('error', (err) => {
        throw err
      })
      client.on('warning', (err) => {
        throw err
      })

      client.once('update', (data) => {
        expect(data.announce).toBe(announceUrl)
        expect(typeof data.complete).toBe('number')
        expect(typeof data.incomplete).toBe('number')

        client.update()

        client.once('update', (data) => {
          expect(data.announce).toBe(announceUrl)
          expect(typeof data.complete).toBe('number')
          expect(typeof data.incomplete).toBe('number')

          client.stop()

          client.once('update', (data) => {
            expect(data.announce).toBe(announceUrl)
            expect(typeof data.complete).toBe('number')
            expect(typeof data.incomplete).toBe('number')

            server.close()
            client.destroy()
            resolve()
          })
        })
      })

      client.start()
    })
  })
}

test('http: magnet: client.start/update/stop()', () => testMagnet('http'))
test('udp: magnet: client.start/update/stop()', () => testMagnet('udp'))
test('ws: magnet: client.start/update/stop()', () => testMagnet('ws'))
