import Client from '../index.js'
import common from './common.js'
import fixtures from 'webtorrent-fixtures'

const peerId = Buffer.from('01234567890123456789')

function testLargeTorrent(serverType: 'http' | 'udp' | 'ws'): Promise<void> {
  return new Promise((resolve, reject) => {
    common.createServer(serverType, (server, announceUrl) => {
      const client = new Client({
        infoHash: fixtures.sintel.parsedTorrent.infoHash,
        peerId,
        port: 6881,
        announce: announceUrl,
        wrtc: {},
      })

      if (serverType === 'ws') common.mockWebsocketTracker(client)
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

test('http: large torrent: client.start()', () => testLargeTorrent('http'))
test('udp: large torrent: client.start()', () => testLargeTorrent('udp'))
test('ws: large torrent: client.start()', () => testLargeTorrent('ws'))
