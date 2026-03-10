import { test, expect } from 'bun:test'
import DHT from '../src/index.js'

test('ping should clear clones', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false })

    dht1.listen(10000, () => {
      let dht2 = new DHT({ bootstrap: ['127.0.0.1:10000'] })

      dht2.on('ready', () => {
        dht2.destroy(() => {
          dht2 = new DHT({ bootstrap: ['127.0.0.1:10000'] })
          dht2.on('ready', ping)
          dht2.listen(20000)
        })
      })

      dht2.listen(20000)

      function ping() {
        expect(dht1.nodes.toArray().length).toBe(2)
        dht1._pingAll(() => {
          expect(dht1.nodes.toArray().length).toBe(1)
          done()
        })
      }

      function done() {
        dht1.destroy(() => {
          dht2.destroy(() => {
            resolve()
          })
        })
      }
    })
  })
})

test('ping should clear with three nodes', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false })
    let dht3: DHT

    dht1.listen(10000, () => {
      const dht2 = new DHT({ bootstrap: ['127.0.0.1:10000'] })

      dht2.on('ready', () => {
        dht2.destroy(() => {
          dht3 = new DHT({ bootstrap: ['127.0.0.1:10000'] })
          dht3.on('ready', ping)
          dht3.listen(20000)
        })
      })

      dht2.listen(20000)

      function ping() {
        expect(dht3.nodes.toArray().length).toBe(1)
        expect(dht1.nodes.toArray().length).toBe(2)
        dht1._pingAll(() => {
          dht3._pingAll(() => {
            expect(dht3.nodes.toArray().length).toBe(1)
            expect(dht1.nodes.toArray().length).toBe(1)
            done()
          })
        })
      }

      function done() {
        dht1.destroy(() => {
          dht2.destroy(() => {
            dht3.destroy(() => {
              resolve()
            })
          })
        })
      }
    })
  })
})
