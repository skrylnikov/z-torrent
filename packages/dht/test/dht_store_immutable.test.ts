import { test, expect } from 'bun:test'
import DHT from '../src/index.js'
import * as common from './common.js'

test('local immutable put/get', () => {
  return new Promise<void>((resolve) => {
    const dht = new DHT({ bootstrap: false })
    common.failOnWarningOrError(dht)

    const cleanup = () => {
      dht.destroy()
    }

    dht.on('ready', () => {
      const value = common.fill(500, 'abc')
      dht.put({ v: value }, (_, hash) => {
        expect(hash!.toString('hex')).toBe(
          '3a34a097641348623d123acfba3aa589028f241e' // sha1 of the value
        )
        dht.get(hash!, (err, res) => {
          if (err) throw err
          expect(res!.v.toString('utf8')).toBe(value.toString('utf8'))
          cleanup()
          resolve()
        })
      })
    })
  })
})

test('delegated put', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false })
    const dht2 = new DHT({ bootstrap: false })
    const dht3 = new DHT({ bootstrap: false })
    const dht4 = new DHT({ bootstrap: false })

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

test('multi-party immutable put/get', () => {
  return new Promise<void>((resolve) => {
    const dht1 = new DHT({ bootstrap: false })
    const dht2 = new DHT({ bootstrap: false })

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
      dht1.put({ v: value }, (err, hash) => {
        if (err) throw err

        expect(hash!.toString('hex')).toBe(
          '3a34a097641348623d123acfba3aa589028f241e' // sha1 of the value
        )

        dht2.get(hash!, (err, res) => {
          if (err) throw err
          expect(res!.v.toString('utf8')).toBe(
            value.toString('utf8')
          )
          cleanup()
          resolve()
        })
      })
    }
  })
})
