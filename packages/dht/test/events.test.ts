import { test, expect } from 'bun:test'
import { DHT } from '../src/index.js'
import * as common from './common.js'

test('`node` event fires for each added node (100x)', () => {
  return new Promise<void>((resolve) => {
    const dht = new DHT({ bootstrap: false })
    common.failOnWarningOrError(dht)

    let numNodes = 0
    dht.on('node', () => {
      numNodes += 1
      if (numNodes === 100) {
        dht.destroy()
        resolve()
      }
    })

    common.addRandomNodes(dht, 100)
  })
})

test('`node` event fires for each added node (1000x)', () => {
  return new Promise<void>((resolve) => {
    const dht = new DHT({ bootstrap: false })
    common.failOnWarningOrError(dht)

    let numNodes = 0
    dht.on('node', () => {
      numNodes += 1
      if (numNodes === 1000) {
        dht.destroy()
        resolve()
      }
    })

    common.addRandomNodes(dht, 1000)
  })
})

test('`announce` event after remote announce_peer', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false })
    const infoHash = common.randomId()

    dht1.listen(() => {
      const dht2 = new DHT({
        bootstrap: [`127.0.0.1:${(dht1.address() as { port: number }).port}`],
      })

      dht1.once('announce', (peer) => {
        expect(peer.host).toBe('127.0.0.1')
        expect(typeof peer.port).toBe('number')
        dht1.destroy()
        dht2.destroy()
        resolve()
      })

      dht2.listen(() => {
        dht2.announce(infoHash, () => {
          dht2.lookup(infoHash)
        })
      })
    })
  })
})

test('`listening` event fires', () => {
  return new Promise<void>((resolve) => {
    const dht = new DHT({ bootstrap: false })

    common.failOnWarningOrError(dht)

    dht.listen(() => {
      // listen() callback gets called
    })
    dht.on('listening', () => {
      dht.destroy()
      resolve()
    })
  })
})

test('`ready` event fires when bootstrap === false', () => {
  return new Promise<void>((resolve) => {
    const dht = new DHT({ bootstrap: false })

    common.failOnWarningOrError(dht)

    dht.on('ready', () => {
      expect(dht.ready).toBe(true)
      dht.destroy()
      resolve()
    })
  })
})

test('`ready` event fires when there are K nodes', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false })
    common.failOnWarningOrError(dht1)

    dht1.on('ready', () => {
      expect(dht1.ready).toBe(true)

      common.addRandomNodes(dht1, 3)
      expect(dht1.nodes.toArray().length).toBe(3)

      dht1.listen(() => {
        const port = (dht1.address() as { port: number }).port

        const dht2 = new DHT({ bootstrap: [`127.0.0.1:${port}`] })
        common.failOnWarningOrError(dht2)

        dht2.on('ready', () => {
          expect(dht1.nodes.toArray().length).toBe(4)
          expect(dht2.ready).toBe(true)

          dht1.destroy()
          dht2.destroy()
          resolve()
        })
      })
    })
  })
})
