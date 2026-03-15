import { test, expect } from 'bun:test'
import DHT from '../src/index.js'
import * as common from './common.js'

test('adding a node updates the lastChange property', () => {
  return new Promise<void>((resolve) => {
    const now = Date.now()
    const dht = new DHT({ bootstrap: false })

    expect((dht._rpc.nodes as any).metadata.lastChange).toBeFalsy()

    setTimeout(() => {
      dht.addNode({ host: '127.0.0.1', port: 9999, id: common.randomId() })
      expect(typeof (dht._rpc.nodes as any).metadata.lastChange).toBe('number')
      expect((dht._rpc.nodes as any).metadata.lastChange > now).toBeTruthy()
      dht.destroy()
      resolve()
    }, 50)
  })
})

test('same node doesn´t change the lastChange property', () => {
  return new Promise<void>((resolve) => {
    const dht = new DHT({ bootstrap: false })

    expect((dht._rpc.nodes as any).metadata.lastChange).toBeFalsy()

    const nodeId = common.randomId()
    let lastChanged: number
    setTimeout(() => {
      dht.addNode({ host: '127.0.0.1', port: 9999, id: nodeId })

      expect(typeof (dht._rpc.nodes as any).metadata.lastChange).toBe('number')
      lastChanged = (dht._rpc.nodes as any).metadata.lastChange

      setTimeout(() => {
        dht.addNode({ host: '127.0.0.1', port: 9999, id: nodeId })
        expect((dht._rpc.nodes as any).metadata.lastChange).toBe(lastChanged)
        dht.destroy()
        resolve()
      }, 1)
    }, 1)
  })
})

test('_checkNodes: skips good nodes', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false })
    common.failOnWarningOrError(dht1)

    dht1.on('ready', () => {
      expect(dht1.ready).toBe(true)

      dht1.listen(() => {
        const port = (dht1.address() as any).port

        const dht2 = new DHT({ bootstrap: `127.0.0.1:${port}` } as any)
        common.failOnWarningOrError(dht2)

        dht2.on('ready', () => {
          const nodes = dht1.nodes.toArray()

          dht1._checkNodes(nodes, true, (err, data) => {
            if (err) throw err
            expect(data).toBeFalsy()
            dht1.destroy()
            dht2.destroy()
            resolve()
          })
        })
      })
    })
  })
})

test(
  '_checkNodes: returns the bad one',
  () => {
    return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false })
    common.failOnWarningOrError(dht1)

    dht1.on('ready', () => {
      expect(dht1.ready).toBe(true)

      const nodeId = common.randomId()
      const badNode = { host: '127.0.0.1', port: 9999, id: nodeId }
      dht1.addNode(badNode)

      dht1.listen(() => {
        const port = (dht1.address() as any).port

        const dht2 = new DHT({ bootstrap: `127.0.0.1:${port}` } as any)
        common.failOnWarningOrError(dht2)
        dht2.listen()

        dht2.on('ready', () => {
          const goodNodes = dht1.nodes.toArray().filter((n) => n.port !== 9999)
          const goodNode = goodNodes[0]
          const nodes = [goodNode, goodNode, badNode, goodNode]

          dht1._checkNodes(nodes, true, (err, data) => {
            if (err) throw err
            expect(data!.id).toEqual(badNode.id)
            dht1.destroy()
            dht2.destroy()
            resolve()
          })
        })
      })
    })
  })
  },
  { timeout: 15000 }
)

test('_checkAndRemoveNodes: removes bad nodes', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false })
    common.failOnWarningOrError(dht1)

    dht1.on('ready', () => {
      expect(dht1.ready).toBe(true)

      const nodeId = common.randomId()

      dht1.listen(() => {
        const port = (dht1.address() as any).port

        const dht2 = new DHT({ bootstrap: `127.0.0.1:${port}` } as any)
        common.failOnWarningOrError(dht2)

        dht2.on('ready', () => {
          expect(dht1.nodes.toArray().length).toBe(1)
          const goodNodes = dht1.nodes.toArray()
          const goodNode = goodNodes[0]
          const badNode = { host: '127.0.0.1', port: 9999, id: nodeId }
          dht1.addNode(badNode)

          expect(dht1.nodes.toArray().length).toBe(2)

          const nodes = [goodNode, goodNode, badNode, goodNode]
          dht1._checkAndRemoveNodes(nodes, () => {
            expect(dht1.nodes.toArray().length).toBe(1)
            dht1.destroy()
            dht2.destroy()
            resolve()
          })
        })
      })
    })
  })
})
