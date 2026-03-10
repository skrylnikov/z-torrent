import { test, expect } from 'bun:test'
import DHT from '../src/index.js'
import * as common from './common.js'

test('explicitly set nodeId', () => {
  const nodeId = common.randomId()

  const dht = new DHT({
    nodeId,
    bootstrap: false,
  })

  common.failOnWarningOrError(dht)

  expect(dht.nodeId).toEqual(nodeId)
  dht.destroy()
})

test('call `addNode` with nodeId argument', () => {
  return new Promise<void>((resolve) => {
    const dht = new DHT({ bootstrap: false })
    common.failOnWarningOrError(dht)

    const nodeId = common.randomId()

    dht.on('node', (node) => {
      expect(node.host).toBe('127.0.0.1')
      expect(node.port).toBe(9999)
      expect(node.id).toEqual(nodeId)
      dht.destroy()
      resolve()
    })

    dht.addNode({ host: '127.0.0.1', port: 9999, id: nodeId })
  })
})

test('call `addNode` without nodeId argument', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false })
    const dht2 = new DHT({ bootstrap: false })

    common.failOnWarningOrError(dht1)
    common.failOnWarningOrError(dht2)

    dht1.listen(() => {
      const port = (dht1.address() as any).port

      // If `nodeId` is undefined, then the peer will be pinged to learn their node id.
      dht2.addNode({ host: '127.0.0.1', port })

      dht2.on('node', (node) => {
        expect(node.host).toBe('127.0.0.1')
        expect(node.port).toBe(port)
        expect(node.id).toEqual(dht1.nodeId)
        dht1.destroy()
        dht2.destroy()
        resolve()
      })
    })
  })
})

test('call `addNode` without nodeId argument, and invalid addr', () => {
  return new Promise<void>((resolve) => {
    const dht = new DHT({ bootstrap: false })
    common.failOnWarningOrError(dht)

    // If `nodeId` is undefined, then the peer will be pinged to learn their node id.
    // If the peer DOES NOT RESPOND, the will not be added to the routing table.
    dht.addNode({ host: '127.0.0.1', port: 9999 })

    dht.on('node', () => {
      throw new Error('somehow found a node, even though no node actually responded')
    })

    setTimeout(() => {
      dht.destroy()
      resolve()
    }, 2000)
  })
})

test('`addNode` only emits events for new nodes', () => {
  return new Promise<void>((resolve) => {
    let togo = 1

    const dht = new DHT({ bootstrap: false })
    common.failOnWarningOrError(dht)

    dht.on('node', () => {
      if (--togo < 0) throw new Error('should not emit for duplicate nodes')
    })

    const nodeId = common.randomId()
    dht.addNode({ host: '127.0.0.1', port: 9999, id: nodeId })
    dht.addNode({ host: '127.0.0.1', port: 9999, id: nodeId })
    dht.addNode({ host: '127.0.0.1', port: 9999, id: nodeId })

    setTimeout(() => {
      dht.destroy()
      resolve()
    }, 100)
  })
})

test('send message while binding (listen)', () => {
  return new Promise<void>((resolve) => {
    const a = new DHT({ bootstrap: false })
    a.listen(() => {
      const port = (a.address() as any).port
      const b = new DHT({ bootstrap: false })
      b.listen()
      b._sendPing({ host: '127.0.0.1', port }, (err) => {
        if (err) throw err
        a.destroy()
        b.destroy()
        resolve()
      })
    })
  })
})
