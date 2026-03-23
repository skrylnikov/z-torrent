import { DHT } from '@z-torrent/dht'
import { test } from 'bun:test'
import { randomBytes } from 'uint8-util'

import { Discovery } from '../src/index.js'

test('periodic dht announce emits dhtAnnounce', () => {
  return new Promise<void>((resolve, reject) => {
    const dht = new DHT({ bootstrap: false })
    const discovery = new Discovery({
      infoHash: randomBytes(20),
      peerId: randomBytes(20),
      port: 6000,
      dht,
      intervalMs: 80,
    })

    let count = 0
    const failTimer = setTimeout(() => {
      discovery.destroy(() => {
        dht.destroy(() => reject(new Error(`expected at least 4 dhtAnnounce events, got ${count}`)))
      })
    }, 12_000)

    discovery.on('dhtAnnounce', () => {
      count += 1
      if (count >= 4) {
        clearTimeout(failTimer)
        discovery.destroy(() => {
          dht.destroy(() => resolve())
        })
      }
    })
  })
})
