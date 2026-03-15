import DHT from 'bittorrent-dht'
import Discovery from '../dist/index.js'
import { randomBytes } from 'uint8-util'
import { expect, test } from 'bun:test'

test('initialize with dht', () => {
  return new Promise<void>((resolve) => {
    const dht = new DHT({ bootstrap: false })
    const discovery = new Discovery({
      infoHash: randomBytes(20),
      peerId: randomBytes(20),
      port: 6000,
      dht,
      intervalMs: 1000,
    })

    const _dhtAnnounce = discovery._dhtAnnounce
    let num = 0
    ;(discovery as any)._dhtAnnounce = () => {
      num += 1
      _dhtAnnounce.call(discovery)
      if (num === 4) {
        discovery.destroy(() => {
          dht.destroy(() => resolve())
        })
      }
    }
  })
})
