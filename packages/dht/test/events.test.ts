import { test, expect } from 'bun:test'
import DHT from '../src/index.js'
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

test('`node` event fires for each added node (10000x)', () => {
  return new Promise<void>((resolve) => {
    const dht = new DHT({ bootstrap: false })
    common.failOnWarningOrError(dht)

    let numNodes = 0
    dht.on('node', () => {
      numNodes += 1
      if (numNodes === 10000) {
        dht.destroy()
        resolve()
      }
    })

    common.addRandomNodes(dht, 10000)
  })
})

test('`announce` event fires for each added peer (100x)', () => {
  return new Promise<void>((resolve) => {
    const dht = new DHT({ bootstrap: false })
    common.failOnWarningOrError(dht)

    let numPeers = 0
    dht.on('announce', () => {
      numPeers += 1
      if (numPeers === 100) {
        dht.destroy()
        resolve()
      }
    })

    common.addRandomPeers(dht, 100)
  })
})

test('`announce` event fires for each added peer (10000x)', () => {
  return new Promise<void>((resolve) => {
    const dht = new DHT({ bootstrap: false })
    common.failOnWarningOrError(dht)

    let numPeers = 0
    dht.on('announce', () => {
      numPeers += 1
      if (numPeers === 10000) {
        dht.destroy()
        resolve()
      }
    })

    common.addRandomPeers(dht, 10000)
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
    // dht1 will simulate an existing node (with a populated routing table)
    const dht1 = new DHT({ bootstrap: false })
    common.failOnWarningOrError(dht1)

    dht1.on('ready', () => {
      expect(dht1.ready).toBe(true)

      common.addRandomNodes(dht1, 3)
      expect((dht1.nodes as any).count()).toBe(3)

      dht1.listen(() => {
        const port = (dht1.address() as any).port

        // dht2 will get all 3 nodes from dht1 and should also emit a `ready` event
        const dht2 = new DHT({ bootstrap: `127.0.0.1:${port}` } as any)
        common.failOnWarningOrError(dht2)

        dht2.on('ready', () => {
          // 5 nodes because dht1 also optimistically captured dht2's addr and included it
          expect((dht1.nodes as any).count()).toBe(4)
          expect(dht2.ready).toBe(true)

          dht1.destroy()
          dht2.destroy()
          resolve()
        })
      })
    })
  })
})
