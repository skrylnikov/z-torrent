import { test, expect } from 'bun:test'
import { DHT } from '../src/index.js'
import * as common from './common.js'

test('`announce` with {host: false}', () => {
  return new Promise<void>((resolve) => {
    const dht = new DHT({ bootstrap: false, host: false })
    common.failOnWarningOrError(dht)

    const infoHash = common.randomId()
    dht.announce(infoHash, 6969, (err) => {
      expect(err instanceof Error).toBeTruthy()
      dht.lookup(infoHash, (err) => {
        if (err) throw err
        dht.destroy()
        resolve()
      })
    })
  })
})

test('`announce` with {host: "127.0.0.1"}', () => {
  return new Promise<void>((resolve) => {
    const dht = new DHT({ bootstrap: false, host: '127.0.0.1' })
    common.failOnWarningOrError(dht)

    const infoHash = common.randomId()
    dht.announce(infoHash, 6969, (err) => {
      expect(err instanceof Error).toBeTruthy()
      dht.lookup(infoHash, (err) => {
        if (err) throw err
        dht.destroy()
        resolve()
      })

      dht.on('peer', (peer) => {
        expect(peer).toEqual({ host: '127.0.0.1', port: 6969 })
      })
    })
  })
})

test('announce/lookup accept 32-byte BEP 52 info_hash (truncated to 20)', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false })
    const id20 = common.randomId()
    const infoHash = Buffer.concat([id20, Buffer.alloc(12, 0xfe)])

    dht1.listen(() => {
      const dht2 = new DHT({
        bootstrap: `127.0.0.1:${(dht1.address() as any).port}`,
      })

      dht1.on('announce', (peer) => {
        expect(peer).toEqual({
          host: '127.0.0.1',
          port: (dht2.address() as any).port,
        })
      })

      dht2.announce(infoHash, () => {
        dht2.once('peer', (peer) => {
          expect(peer).toEqual({
            host: '127.0.0.1',
            port: (dht2.address() as any).port,
          })
          dht1.destroy()
          dht2.destroy()
          resolve()
        })

        dht2.lookup(infoHash)
      })
    })
  })
})

test('announce with implied port', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false })
    const infoHash = common.randomId()

    dht1.listen(() => {
      const dht2 = new DHT({
        bootstrap: `127.0.0.1:${(dht1.address() as any).port}`,
      })

      dht1.on('announce', (peer) => {
        expect(peer).toEqual({
          host: '127.0.0.1',
          port: (dht2.address() as any).port,
        })
      })

      dht2.announce(infoHash, () => {
        dht2.once('peer', (peer) => {
          expect(peer).toEqual({
            host: '127.0.0.1',
            port: (dht2.address() as any).port,
          })
          dht1.destroy()
          dht2.destroy()
          resolve()
        })

        dht2.lookup(infoHash)
      })
    })
  })
})

test('`announce` and no cache timeout', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false, maxAge: Infinity } as any)
    const infoHash = common.randomId()

    dht1.listen(() => {
      const dht2 = new DHT({
        bootstrap: `127.0.0.1:${(dht1.address() as any).port}`,
        maxAge: Infinity,
      } as any)
      let cnt = 0

      dht1.on('peer', () => {
        cnt++
      })

      dht1.once('announce', (peer) => {
        expect(peer).toEqual({ host: '127.0.0.1', port: 1337 })

        dht1.lookup(infoHash, () => {
          setTimeout(() => {
            dht1.lookup(infoHash, () => {
              expect(cnt).toBe(2)
              dht1.destroy()
              dht2.destroy()
              resolve()
            })
          }, 100)
        })
      })

      dht2.announce(infoHash, 1337)
    })
  })
})

test('`announce` and cache timeout', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false, maxAge: 50 } as any)
    const infoHash = common.randomId()

    dht1.listen(() => {
      const dht2 = new DHT({
        bootstrap: `127.0.0.1:${(dht1.address() as any).port}`,
        maxAge: 50,
      } as any)
      let cnt = 0

      dht1.on('peer', () => {
        cnt++
      })

      dht1.once('announce', (peer) => {
        expect(peer).toEqual({ host: '127.0.0.1', port: 1337 })

        dht1.lookup(infoHash, () => {
          setTimeout(() => {
            dht1.lookup(infoHash, () => {
              expect(cnt).toBe(1)
              dht1.destroy()
              dht2.destroy()
              resolve()
            })
          }, 100)
        })
      })

      dht2.announce(infoHash, 1337)
    })
  })
})

test('`announce` twice and cache timeout for one announce', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false, maxAge: 50 } as any)
    const infoHash = common.randomId()

    dht1.listen(() => {
      const dht2 = new DHT({
        bootstrap: `127.0.0.1:${(dht1.address() as any).port}`,
        maxAge: 50,
      } as any)

      dht2.announce(infoHash, 1337, () => {
        dht2.announce(infoHash, 1338, () => {
          const found: Record<string, boolean> = {}
          const interval = setInterval(() => {
            dht2.announce(infoHash, 1338)
          }, 10)

          dht2.on('peer', (peer) => {
            found[`${peer.host}:${peer.port}`] = true
          })

          dht2.lookup(infoHash, () => {
            expect(found).toEqual({ '127.0.0.1:1337': true, '127.0.0.1:1338': true })
            Object.keys(found).forEach((k) => delete found[k])
            setTimeout(() => {
              dht2.lookup(infoHash, () => {
                expect(found).toEqual({ '127.0.0.1:1338': true })
                clearInterval(interval)
                dht1.destroy()
                dht2.destroy()
                resolve()
              })
            }, 100)
          })
        })
      })
    })
  })
})
