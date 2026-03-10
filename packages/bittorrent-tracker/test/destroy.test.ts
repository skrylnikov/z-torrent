import Client from '../index.js'
import common from './common.js'
import fixtures from 'webtorrent-fixtures'

const peerId = Buffer.from('01234567890123456789')
const port = 6881

function testNoEventsAfterDestroy(serverType: 'http' | 'udp' | 'ws'): Promise<void> {
  return new Promise((resolve, reject) => {
    common.createServer(serverType, (server, announceUrl) => {
      const client = new Client({
        infoHash: fixtures.leaves.parsedTorrent.infoHash,
        announce: announceUrl,
        peerId,
        port,
        wrtc: {},
      })

      if (serverType === 'ws') common.mockWebsocketTracker(client)
      client.on('error', (err) => {
        throw err
      })
      client.on('warning', (err) => {
        throw err
      })

      client.once('update', () => {
        expect().fail('no "update" event should fire, since client is destroyed')
      })

      client.update()
      client.destroy()

      setTimeout(() => {
        server.close()
        resolve()
      }, 1000)
    })
  })
}

test('http: no "update" events after destroy()', () => testNoEventsAfterDestroy('http'))
test('udp: no "update" events after destroy()', () => testNoEventsAfterDestroy('udp'))
test('ws: no "update" events after destroy()', () => testNoEventsAfterDestroy('ws'))
