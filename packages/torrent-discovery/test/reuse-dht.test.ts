import Discovery from '../dist/index.js'
import DHT from 'bittorrent-dht'
import { randomBytes } from 'uint8-util'
import { expect, test } from 'bun:test'

test('re-use dht, verify that peers are filtered', () => {
  return new Promise<void>((resolve) => {
    const infoHash1 = randomBytes(20)
    const infoHash2 = randomBytes(20)

    const dht = new DHT()
    const discovery = new Discovery({
      infoHash: infoHash1,
      peerId: randomBytes(20),
      port: 6000,
      dht,
    })

    discovery.once('peer', (addr, source) => {
      expect(addr).toBe('1.2.3.4:8000')
      expect(source).toBe('dht')
    })
    dht.emit('peer', { host: '1.2.3.4', port: '8000' }, infoHash1)

    discovery.once('peer', (addr, source) => {
      expect(addr).toBe('4.5.6.7:8000')
      expect(source).toBe('dht')

      discovery.destroy(() => {
        dht.destroy(() => resolve())
      })
    })
    dht.emit('peer', { host: '2.3.4.5', port: '8000' }, infoHash2)
    dht.emit('peer', { host: '3.4.5.6', port: '8000' }, infoHash2)
    dht.emit('peer', { host: '4.5.6.7', port: '8000' }, infoHash1)
  })
})
