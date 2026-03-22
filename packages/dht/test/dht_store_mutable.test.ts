import sha1 from 'sync-sha1/rawSha1.js'
import ed from 'bittorrent-dht-sodium'
import { test, expect } from 'bun:test'
import { DHT } from '../src/index.js'
import * as common from './common.js'

test('local mutable put/get', () => {
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

    let pending = 2
    dht1.listen(() => {
      dht2.addNode({ host: '127.0.0.1', port: (dht1.address() as any).port })
      dht2.once('node', ready)
    })

    dht2.listen(() => {
      dht1.addNode({ host: '127.0.0.1', port: (dht2.address() as any).port })
      dht1.once('node', ready)
    })

    function ready() {
      if (--pending !== 0) return
      const value = common.fill(500, 'abc')
      const opts = {
        k: keypair.pk,
        sign: common.sign(keypair),
        seq: 0,
        v: value,
      }

      const expectedHash = Buffer.from(sha1(opts.k))

      dht1.put(opts, (_, hash) => {
        expect(hash!.toString('hex')).toBe(expectedHash.toString('hex'))
        dht2.get(hash!, (err, res) => {
          if (err) throw err
          expect(res!.v.toString('utf8')).toBe(opts.v.toString('utf8'))
          expect(res!.seq).toBe(0)
          cleanup()
          resolve()
        })
      })
    }
  })
})

test('multiparty mutable put/get', () => {
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

    let pending = 2
    dht1.listen(() => {
      dht2.addNode({ host: '127.0.0.1', port: (dht1.address() as any).port })
      dht2.once('node', ready)
    })

    dht2.listen(() => {
      dht1.addNode({ host: '127.0.0.1', port: (dht2.address() as any).port })
      dht1.once('node', ready)
    })

    function ready() {
      if (--pending !== 0) return
      const value = common.fill(500, 'abc')
      const opts = {
        k: keypair.pk,
        seq: 0,
        sign: common.sign(keypair),
        v: value,
      }

      const expectedHash = Buffer.from(sha1(opts.k))

      dht1.put(opts, (err, hash) => {
        if (err) throw err

        expect(hash).toEqual(expectedHash)
        dht2.get(hash!, (err, res) => {
          if (err) throw err
          expect(res!.v.toString('utf8')).toBe(opts.v.toString('utf8'))
          cleanup()
          resolve()
        })
      })
    }
  })
})

test('delegated put', () => {
  return new Promise<void>((resolve) => {
    const keypair = ed.keygen()

    const dht1 = new DHT({ bootstrap: false, verify: ed.verify } as any)
    const dht2 = new DHT({ bootstrap: false, verify: ed.verify } as any)
    const dht3 = new DHT({ bootstrap: false, verify: ed.verify } as any)
    const dht4 = new DHT({ bootstrap: false, verify: ed.verify } as any)

    const cleanup = () => {
      dht1.destroy()
      dht2.destroy()
      dht3.destroy()
      dht4.destroy()
    }
    common.failOnWarningOrError(dht1)
    common.failOnWarningOrError(dht2)
    common.failOnWarningOrError(dht3)
    common.failOnWarningOrError(dht4)

    let pending = 4
    dht1.listen(() => {
      dht2.addNode({ host: '127.0.0.1', port: (dht1.address() as any).port })
      dht2.once('node', ready)
    })

    dht2.listen(() => {
      dht1.addNode({ host: '127.0.0.1', port: (dht2.address() as any).port })
      dht1.once('node', ready)
    })

    dht3.listen(() => {
      dht4.addNode({ host: '127.0.0.1', port: (dht3.address() as any).port })
      dht4.once('node', ready)
    })

    dht4.listen(() => {
      dht3.addNode({ host: '127.0.0.1', port: (dht4.address() as any).port })
      dht3.once('node', ready)
    })

    function ready() {
      if (--pending !== 0) return
      const value = common.fill(500, 'abc')
      const opts = {
        k: keypair.pk,
        seq: 0,
        sign: common.sign(keypair),
        v: value,
      }

      dht1.put(opts, (err, hash) => {
        if (err) throw err

        dht2.get(hash!, (err, res) => {
          if (err) throw err

          dht3.put(res!, (err) => {
            if (err) throw err

            dht4.get(hash!, (err, res) => {
              if (err) throw err
              expect(res!.v.toString('utf8')).toBe(opts.v.toString('utf8'))
              cleanup()
              resolve()
            })
          })
        })
      })
    }
  })
})

test('multiparty mutable put/get sequence', () => {
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

    let pending = 2
    dht1.listen(() => {
      dht2.addNode({ host: '127.0.0.1', port: (dht1.address() as any).port })
      dht2.once('node', ready)
    })

    dht2.listen(() => {
      dht1.addNode({ host: '127.0.0.1', port: (dht2.address() as any).port })
      dht1.once('node', ready)
    })

    function ready() {
      if (--pending !== 0) return
      const value = common.fill(500, 'abc')
      const opts = {
        k: keypair.pk,
        sign: common.sign(keypair),
        seq: 0,
        v: value,
      }

      const expectedHash = Buffer.from(sha1(opts.k))

      dht1.put(opts, (err, hash) => {
        if (err) throw err

        expect(hash).toEqual(expectedHash)
        dht2.get(hash!, (err, res) => {
          if (err) throw err
          expect(res!.v.toString('utf8')).toBe(opts.v.toString('utf8'))
          putSomethingElse()
        })
      })

      function putSomethingElse() {
        opts.seq++
        opts.v = common.fill(32, 'whatever')

        dht1.put(opts, (err, hash) => {
          if (err) throw err

          expect(hash).toEqual(expectedHash)
          dht2.get(hash!, (err, res) => {
            if (err) throw err
            expect(res!.v.toString('utf8')).toBe(opts.v.toString('utf8'))
            yetStillMore()
          })
        })
      }

      function yetStillMore() {
        opts.seq++
        opts.v = common.fill(999, 'cool')

        dht1.put(opts, (err, hash) => {
          if (err) throw err

          expect(hash).toEqual(expectedHash)
          dht2.get(hash!, (err, res) => {
            if (err) throw err
            expect(res!.v.toString('utf8')).toBe(opts.v.toString('utf8'))
            cleanup()
            resolve()
          })
        })
      }
    }
  })
})

test('salted multikey multiparty mutable put/get sequence', () => {
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

    let pending = 2
    dht1.listen(() => {
      dht2.addNode({ host: '127.0.0.1', port: (dht1.address() as any).port })
      dht2.once('node', ready)
    })

    dht2.listen(() => {
      dht1.addNode({ host: '127.0.0.1', port: (dht2.address() as any).port })
      dht1.once('node', ready)
    })

    function ready() {
      if (--pending !== 0) return
      const fvalue = common.fill(500, 'abc')
      const fopts = {
        k: keypair.pk,
        seq: 0,
        salt: Buffer.from('first'),
        sign: common.sign(keypair),
        v: fvalue,
      }
      const svalue = common.fill(20, 'z')
      const sopts = {
        k: fopts.k,
        seq: 0,
        salt: Buffer.from('second'),
        sign: common.sign(keypair),
        v: svalue,
      }

      const first = Buffer.from(sha1(Buffer.concat([fopts.k, Buffer.from('first')])))
      const second = Buffer.from(sha1(Buffer.concat([sopts.k, Buffer.from('second')])))

      dht1.put(fopts, (err, hash) => {
        if (err) throw err

        expect(hash).toEqual(first)
        dht2.get(hash!, (err, res) => {
          if (err) throw err
          expect(res!.v.toString('utf8')).toBe(fopts.v.toString('utf8'))
          putSecondKey()
        })
      })

      function putSecondKey() {
        dht1.put(sopts, (err, hash) => {
          if (err) throw err

          expect(hash).toEqual(second)
          dht2.get(hash!, (err, res) => {
            if (err) throw err
            expect(res!.v.toString('utf8')).toBe(sopts.v.toString('utf8'))
            yetStillMore()
          })
        })
      }

      function yetStillMore() {
        fopts.seq++
        fopts.v = common.fill(999, 'cool')

        dht1.put(fopts, (err, hash) => {
          if (err) throw err

          expect(hash).toEqual(first)
          dht2.get(hash!, (err, res) => {
            if (err) throw err
            expect(res!.v.toString('utf8')).toBe(fopts.v.toString('utf8'))
            cleanup()
            resolve()
          })
        })
      }
    }
  })
})

test('transitive mutable update', () => {
  return new Promise<void>((resolve) => {
    const keypair = ed.keygen()

    // dht1 <-> dht2 <-> dht3
    const dht1 = new DHT({ bootstrap: false, verify: ed.verify } as any)
    const dht2 = new DHT({ bootstrap: false, verify: ed.verify } as any)
    const dht3 = new DHT({ bootstrap: false, verify: ed.verify } as any)

    const cleanup = () => {
      dht1.destroy()
      dht2.destroy()
      dht3.destroy()
    }
    common.failOnWarningOrError(dht1)
    common.failOnWarningOrError(dht2)
    common.failOnWarningOrError(dht3)

    let pending = 2
    dht1.listen(() => {
      dht2.addNode({ host: '127.0.0.1', port: (dht1.address() as any).port })
      dht2.once('node', ready)
    })

    dht2.listen(() => {
      dht3.addNode({ host: '127.0.0.1', port: (dht2.address() as any).port })
      dht3.once('node', ready)
    })

    function ready() {
      if (--pending !== 0) return
      const value = common.fill(500, 'abc')
      const opts = {
        k: keypair.pk,
        sign: common.sign(keypair),
        seq: 0,
        v: value,
      }

      const expectedHash = Buffer.from(sha1(opts.k))

      dht1.put(opts, (err, hash) => {
        if (err) throw err

        expect(hash).toEqual(expectedHash)

        dht3.get(expectedHash, (err, res) => {
          if (err) throw err
          expect(res!.v.toString('utf8')).toBe(opts.v.toString('utf8'))
          cleanup()
          resolve()
        })
      })
    }
  })
})

test('mutable update mesh', () => {
  return new Promise<void>((resolve) => {
    /*
    0 <-> 1 <-> 2
          ^     ^
          |     |
          v     v
          3 <-> 4 <-> 5
          ^           ^
          |           |
          v           v
          6 <-> 7 <-> 8

    tests: 0 to 8, 4 to 6, 1 to 5
    */
    const edges = [
      [0, 1],
      [1, 2],
      [1, 3],
      [2, 4],
      [3, 4],
      [3, 6],
      [4, 5],
      [5, 8],
      [6, 7],
      [7, 8],
    ]

    const dht: DHT[] = []
    let pending = 0
    for (let i = 0; i < 9; i++) {
      ;((i) => {
        const d = new DHT({ bootstrap: false, verify: ed.verify } as any)
        dht.push(d)
        common.failOnWarningOrError(d)
        pending++
        d.listen(() => {
          if (--pending === 0) addEdges()
        })
      })(i)
    }

    function addEdges() {
      let pending = edges.length
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i]!
        const from = e[0]!
        const to = e[1]!
        dht[to]!.addNode({ host: '127.0.0.1', port: (dht[from]!.address() as any).port })
        dht[to]!.once('node', () => {
          if (--pending === 0) ready()
        })
      }
    }

    const cleanup = () => {
      for (let i = 0; i < dht.length; i++) {
        dht[i]!.destroy()
      }
    }

    function ready() {
      let testsRemaining = 3
      const checkDone = () => {
        if (--testsRemaining === 0) {
          cleanup()
          resolve()
        }
      }

      send(0, 8, common.fill(100, 'abc'), checkDone)
      send(4, 6, common.fill(20, 'xyz'), checkDone)
      send(1, 5, common.fill(500, 'whatever'), checkDone)
    }

    function send(
      srci: number,
      dsti: number,
      value: Buffer,
      done: () => void
    ) {
      const src = dht[srci]!
      const dst = dht[dsti]!
      const keypair = ed.keygen()
      const opts = {
        k: keypair.pk,
        sign: common.sign(keypair),
        seq: 0,
        v: value,
      }

      const xhash = Buffer.from(sha1(new Uint8Array(opts.k)))
      src.put(opts, (err, hash) => {
        if (err) throw err
        expect(hash!.toString('hex')).toBe(xhash.toString('hex'))

        dst.get(xhash, (err, res) => {
          if (err) throw err
          expect(res!.v.toString('utf8')).toBe(opts.v.toString('utf8'))
          done()
        })
      })
    }
  })
})

test('invalid sequence', () => {
  return new Promise<void>((resolve) => {
    const keypair = ed.keygen()

    const dht0 = new DHT({ bootstrap: false, verify: ed.verify } as any)
    const dht1 = new DHT({ bootstrap: false, verify: ed.verify } as any)
    dht0.listen(0, () => {
      dht1.addNode({ host: '127.0.0.1', port: (dht0.address() as any).port })
    })
    dht1.listen(0, () => {
      dht0.addNode({ host: '127.0.0.1', port: (dht1.address() as any).port })
    })
    const cleanup = () => {
      dht0.destroy()
      dht1.destroy()
    }
    common.failOnWarningOrError(dht0)
    common.failOnWarningOrError(dht1)

    dht0.on('node', function () {
      const opts0 = {
        k: keypair.pk,
        sign: common.sign(keypair),
        seq: 5,
        v: common.fill(500, '5'),
      }
      const opts1 = {
        k: keypair.pk,
        sign: common.sign(keypair),
        seq: 4,
        v: common.fill(500, '4'),
      }
      let hash0: Buffer

      dht0.put(opts0, (err, hash) => {
        if (err) throw err
        hash0 = hash!
        dht0.put(opts1, (err, hash) => {
          expect(err).toBeTruthy()
          check()
        })
      })

      function check() {
        dht1.get(hash0!, (err, res) => {
          if (err) throw err
          expect(res!.v.toString('utf8')).toBe(
            common.fill(500, '5').toString('utf8')
          )
          expect(res!.seq).toBe(5)
          cleanup()
          resolve()
        })
      }
    })
  })
})

test('valid sequence', () => {
  return new Promise<void>((resolve) => {
    const keypair = ed.keygen()

    const dht0 = new DHT({ bootstrap: false, verify: ed.verify } as any)
    const dht1 = new DHT({ bootstrap: false, verify: ed.verify } as any)
    dht0.listen(0, () => {
      dht1.addNode({ host: '127.0.0.1', port: (dht0.address() as any).port })
    })
    dht1.listen(0, () => {
      dht0.addNode({ host: '127.0.0.1', port: (dht1.address() as any).port })
    })
    const cleanup = () => {
      dht0.destroy()
      dht1.destroy()
    }
    common.failOnWarningOrError(dht0)
    common.failOnWarningOrError(dht1)

    dht0.on('node', function () {
      const opts0 = {
        k: keypair.pk,
        sign: common.sign(keypair),
        seq: 4,
        v: common.fill(500, '4'),
      }
      const opts1 = {
        k: keypair.pk,
        sign: common.sign(keypair),
        seq: 5,
        v: common.fill(500, '5'),
      }
      let hash0: Buffer
      let hash1: Buffer

      dht0.put(opts0, (err, hash) => {
        if (err) throw err
        hash0 = hash!
        dht0.put(opts1, (err, hash) => {
          if (err) throw err
          hash1 = hash!
          expect(hash0).toEqual(hash1)
          check()
        })
      })

      function check() {
        dht1.get(hash0!, (err, res) => {
          if (err) throw err
          expect(res!.v.toString('utf8')).toBe(
            common.fill(500, '5').toString('utf8')
          )
          expect(res!.seq).toBe(5)
          cleanup()
          resolve()
        })
      }
    })
  })
})
