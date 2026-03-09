import test from 'tape'
import type { Test } from 'tape'
import WebTorrent from '../../dist/index.js'

test('WebTorrent.WEBRTC_SUPPORT', (t: Test) => {
  t.plan(2)

  const client = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })

  client.on('error', (err: Error) => {
    t.fail(err.message)
  })
  client.on('warning', (err: Error) => {
    t.fail(err.message)
  })

  t.equal((WebTorrent as any).WEBRTC_SUPPORT, true)

  client.destroy((err?: Error) => {
    t.error(err, 'client destroyed')
  })
})
