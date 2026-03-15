import { test, expect } from 'bun:test'
import DHT from '../src/index.js'
import * as common from './common.js'

test('`ping` query send and response', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false })
    const dht2 = new DHT({ bootstrap: false })

    common.failOnWarningOrError(dht1)
    common.failOnWarningOrError(dht2)

    dht1.listen(() => {
      dht2._rpc.query(
        {
          host: '127.0.0.1',
          port: (dht1.address() as any).port,
        },
        {
          q: 'ping',
        },
        (err, res) => {
          if (err) throw err
          expect(res!.r!.id).toEqual(dht1.nodeId)

          dht1.destroy()
          dht2.destroy()
          resolve()
        }
      )
    })
  })
})

test('`find_node` query for exact match (with one in table)', () => {
  return new Promise<void>((resolve) => {
    const targetNodeId = common.randomId()

    const dht1 = new DHT({ bootstrap: false })
    const dht2 = new DHT({ bootstrap: false })

    common.failOnWarningOrError(dht1)
    common.failOnWarningOrError(dht2)

    dht1.addNode({ host: '255.255.255.255', port: 6969, id: targetNodeId })

    dht1.listen(() => {
      dht2._rpc.query(
        {
          host: '127.0.0.1',
          port: (dht1.address() as any).port,
        },
        {
          q: 'find_node',
          a: { target: targetNodeId },
        },
        (err, res) => {
          if (err) throw err

          expect(res!.r!.id).toEqual(dht1.nodeId)
          expect(res!.r!.nodes.length).toEqual(2 * 26)

          dht1.destroy()
          dht2.destroy()
          resolve()
        }
      )
    })
  })
})

test('`find_node` query (with many in table)', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false })
    const dht2 = new DHT({ bootstrap: false })

    common.failOnWarningOrError(dht1)
    common.failOnWarningOrError(dht2)

    dht1.addNode({ host: '1.1.1.1', port: 6969, id: common.randomId() })
    dht1.addNode({ host: '10.10.10.10', port: 6969, id: common.randomId() })
    dht1.addNode({ host: '255.255.255.255', port: 6969, id: common.randomId() })

    dht1.listen(() => {
      const targetNodeId = common.randomId()
      dht2._rpc.query(
        {
          host: '127.0.0.1',
          port: (dht1.address() as any).port,
        },
        {
          q: 'find_node',
          a: { target: targetNodeId },
        },
        (err, res) => {
          if (err) throw err

          expect(res!.r!.id).toEqual(dht1.nodeId)
          expect(res!.r!.nodes.length).toEqual(26 * 4)

          dht1.destroy()
          dht2.destroy()
          resolve()
        }
      )
    })
  })
})

test('`get_peers` query to node with *no* peers in table', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false })
    const dht2 = new DHT({ bootstrap: false })

    common.failOnWarningOrError(dht1)
    common.failOnWarningOrError(dht2)

    dht1.addNode({ host: '1.1.1.1', port: 6969, id: common.randomId() })
    dht1.addNode({ host: '2.2.2.2', port: 6969, id: common.randomId() })

    dht1.listen(() => {
      const targetInfoHash = common.randomId()
      dht2._rpc.query(
        {
          host: '127.0.0.1',
          port: (dht1.address() as any).port,
        },
        {
          q: 'get_peers',
          a: {
            info_hash: targetInfoHash,
          },
        },
        (err, res) => {
          if (err) throw err
          expect(res!.r!.id).toEqual(dht1.nodeId)
          expect(Buffer.isBuffer(res!.r!.token)).toBeTruthy()
          expect(res!.r!.nodes.length).toEqual(3 * 26)

          dht1.destroy()
          dht2.destroy()
          resolve()
        }
      )
    })
  })
})

test('`get_peers` query to node with peers in table', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false })
    const dht2 = new DHT({ bootstrap: false })

    common.failOnWarningOrError(dht1)
    common.failOnWarningOrError(dht2)

    const targetInfoHash = common.randomId()

    ;(dht1 as any)._addPeer({ host: '1.1.1.1', port: 6969 }, targetInfoHash)
    ;(dht1 as any)._addPeer({ host: '10.10.10.10', port: 6969 }, targetInfoHash)
    ;(dht1 as any)._addPeer({ host: '255.255.255.255', port: 6969 }, targetInfoHash)

    dht1.listen(() => {
      dht2._rpc.query(
        {
          host: '127.0.0.1',
          port: (dht1.address() as any).port,
        },
        {
          q: 'get_peers',
          a: {
            info_hash: targetInfoHash,
          },
        },
        (err, res) => {
          if (err) throw err

          expect(res!.r!.id).toEqual(dht1.nodeId)
          expect(Buffer.isBuffer(res!.r!.token)).toBeTruthy()
          expect(res!.r!.values.length).toEqual(3)

          dht1.destroy()
          dht2.destroy()
          resolve()
        }
      )
    })
  })
})

test('`announce_peer` query with bad token', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false })
    const dht2 = new DHT({ bootstrap: false })

    common.failOnWarningOrError(dht1)
    common.failOnWarningOrError(dht2)

    const infoHash = common.randomId()

    dht1.listen(() => {
      const token = Buffer.from('bad token')
      dht2._rpc.query(
        {
          host: '127.0.0.1',
          port: (dht1.address() as any).port,
        },
        {
          q: 'announce_peer',
          a: {
            info_hash: infoHash,
            port: 9999,
            token,
          },
        },
        (err, res) => {
          expect(err).toBeTruthy()
          expect(err!.message.includes('bad token')).toBeTruthy()

          dht1.destroy()
          dht2.destroy()
          resolve()
        }
      )
    })
  })
})

test('`announce_peer` with bad port', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false })
    dht1.listen(() => {
      const dht2 = new DHT({
        bootstrap: `127.0.0.1:${(dht1.address() as any).port}`,
        timeout: 100,
      } as any)
      const infoHash = common.randomId()

      dht2.announce(infoHash, 99999, (err) => {
        dht1.destroy()
        dht2.destroy()
        expect(err).toBeTruthy()
        resolve()
      })
    })
  })
})

test('`announce_peer` query gets ack response', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false })
    const dht2 = new DHT({ bootstrap: false })

    common.failOnWarningOrError(dht1)
    common.failOnWarningOrError(dht2)

    const infoHash = common.randomId()

    dht1.listen(() => {
      const port = (dht1.address() as any).port
      dht2._rpc.query(
        {
          host: '127.0.0.1',
          port,
        },
        {
          q: 'get_peers',
          a: {
            info_hash: infoHash,
          },
        },
        (err, res1) => {
          if (err) throw err

          expect(res1!.r!.id).toEqual(dht1.nodeId)
          expect(Buffer.isBuffer(res1!.r!.token)).toBeTruthy()

          dht2._rpc.query(
            {
              host: '127.0.0.1',
              port,
            },
            {
              q: 'announce_peer',
              a: {
                info_hash: infoHash,
                port: 9999,
                token: res1!.r!.token,
              },
            },
            (err, res2) => {
              if (err) throw err
              expect(res2!.r!.id).toEqual(dht1.nodeId)

              dht1.destroy()
              dht2.destroy()
              resolve()
            }
          )
        }
      )
    })
  })
})
