import ed from 'bittorrent-dht-sodium'
import { test, expect } from 'bun:test'
import { DHT } from '../src/index.js'
import * as common from './common.js'

test('dht.toJSON: re-use dht nodes by calling dht.addNode', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false })
    common.failOnWarningOrError(dht1)

    common.addRandomNodes(dht1, 20)

    dht1.on('ready', () => {
      const dht2 = new DHT({ bootstrap: false })

      dht1.nodes.toArray().forEach((node) => {
        if (node.id && node.host)
          dht2.addNode({ host: node.host, port: node.port, id: node.id })
      })

      dht2.on('ready', () => {
        expect(dht2.toJSON().nodes).toEqual(dht1.toJSON().nodes)
        dht1.destroy()
        dht2.destroy()
        resolve()
      })
    })
  })
})

test('dht.toJSON: BEP44 immutable value', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false })
    const dht2 = new DHT({ bootstrap: false })

    const cleanup = () => {
      dht1.destroy()
      dht2.destroy()
    }
    common.failOnWarningOrError(dht1)
    common.failOnWarningOrError(dht2)

    dht1.listen(() => {
      dht2.addNode({ host: '127.0.0.1', port: (dht1.address() as any).port })
      dht2.once('node', ready)
    })

    function ready() {
      const value = common.fill(500, 'abc')
      dht1.put(value, (_, hash) => {
        const json1 = dht1.toJSON()
        expect(json1.values[hash!.toString('hex')].v).toBe(value.toString('hex'))
        expect(json1.values[hash!.toString('hex')].id).toBe(dht1.nodeId.toString('hex'))
        expect(json1.values[hash!.toString('hex')].seq).toBe(undefined)
        expect(json1.values[hash!.toString('hex')].sig).toBe(undefined)
        expect(json1.values[hash!.toString('hex')].k).toBe(undefined)

        const json2 = dht2.toJSON()
        expect(json2.values[hash!.toString('hex')].v).toBe(value.toString('hex'))
        expect(json2.values[hash!.toString('hex')].id).toBe(dht1.nodeId.toString('hex'))
        expect(json2.values[hash!.toString('hex')].seq).toBe(undefined)
        expect(json2.values[hash!.toString('hex')].sig).toBe(undefined)
        expect(json2.values[hash!.toString('hex')].k).toBe(undefined)
        cleanup()
        resolve()
      })
    }
  })
})

test('dht.toJSON: BEP44 mutable value', () => {
  return new Promise<void>((resolve) => {
    const keypair = ed.keygen()
    const dht1 = new DHT({ bootstrap: false, verify: ed.verify } as any)
    const dht2 = new DHT({ bootstrap: false, verify: ed.verify } as any)

    const cleanup = () => {
      dht1.destroy()
      dht2.destroy()
    }
    common.failOnWarningOrError(dht1)
    common.failOnWarningOrError(dht2)

    dht1.listen(() => {
      dht2.addNode({ host: '127.0.0.1', port: (dht1.address() as any).port })
      dht2.once('node', ready)
    })

    function ready() {
      const value = common.fill(500, 'abc')
      const opts = {
        k: keypair.pk,
        sign: common.sign(keypair),
        seq: 0,
        v: value,
      }

      dht1.put(opts, (_, hash) => {
        const json2 = dht2.toJSON()
        expect(json2.values[hash!.toString('hex')].v).toBe(value.toString('hex'))
        expect(json2.values[hash!.toString('hex')].id).toBe(dht1.nodeId.toString('hex'))
        expect(json2.values[hash!.toString('hex')].seq).toBe(0)
        expect(typeof json2.values[hash!.toString('hex')].sig).toBe('string')
        expect(typeof json2.values[hash!.toString('hex')].k).toBe('string')
        cleanup()
        resolve()
      })
    }
  })
})
