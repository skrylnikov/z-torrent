import Discovery from '../dist/index.js'
import DHT from 'bittorrent-dht'
import randombytes from 'randombytes'
import test from 'tape'

test('re-use dht, verify that peers are filtered', (t) => {
  t.plan(5)
  const infoHash1 = randombytes(20)
  const infoHash2 = randombytes(20)

  const dht = new DHT()
  const discovery = new Discovery({
    infoHash: infoHash1,
    peerId: randombytes(20),
    port: 6000,
    dht,
  })

  discovery.once('peer', (addr, source) => {
    t.equal(addr, '1.2.3.4:8000')
    t.equal(source, 'dht')
  })
  dht.emit('peer', { host: '1.2.3.4', port: '8000' }, infoHash1)

  discovery.once('peer', (addr, source) => {
    t.equal(addr, '4.5.6.7:8000')
    t.equal(source, 'dht')

    discovery.destroy(() => {
      dht.destroy(() => {
        t.pass()
      })
    })
  })
  dht.emit('peer', { host: '2.3.4.5', port: '8000' }, infoHash2)
  dht.emit('peer', { host: '3.4.5.6', port: '8000' }, infoHash2)
  dht.emit('peer', { host: '4.5.6.7', port: '8000' }, infoHash1)
})
