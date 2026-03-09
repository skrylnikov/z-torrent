import Client from '../index.js'
import common from './common.js'
import fixtures from 'webtorrent-fixtures'
import test from 'tape'
import type { Test } from 'tape'

const peerId = Buffer.from('01234567890123456789')
const port = 6881

function testNoEventsAfterDestroy(t: Test, serverType: 'http' | 'udp' | 'ws'): void {
  t.plan(1)

  common.createServer(t, serverType, (server, announceUrl) => {
    const client = new Client({
      infoHash: fixtures.leaves.parsedTorrent.infoHash,
      announce: announceUrl,
      peerId,
      port,
      wrtc: {},
    })

    if (serverType === 'ws') common.mockWebsocketTracker(client)
    client.on('error', (err) => {
      t.error(err)
    })
    client.on('warning', (err) => {
      t.error(err)
    })

    client.once('update', () => {
      t.fail('no "update" event should fire, since client is destroyed')
    })

    client.update()
    client.destroy()

    setTimeout(() => {
      t.pass('wait to see if any events are fired')
      server.close()
    }, 1000)
  })
}

test('http: no "update" events after destroy()', (t: Test) => {
  testNoEventsAfterDestroy(t, 'http')
})

test('udp: no "update" events after destroy()', (t: Test) => {
  testNoEventsAfterDestroy(t, 'udp')
})

test('ws: no "update" events after destroy()', (t: Test) => {
  testNoEventsAfterDestroy(t, 'ws')
})
