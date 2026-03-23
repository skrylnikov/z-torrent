import { sha1 } from '@noble/hashes/sha1'
import ed from 'bittorrent-dht-sodium'
import { test, expect } from 'bun:test'
import { DHT } from '../src/index.js'
import * as common from './common.js'

// test vectors from http://bittorrent.org/beps/bep_0044.html
test('dht store test vectors - test 1 (mutable)', () => {
  return new Promise<void>((resolve) => {
    const pub = Buffer.from(
      '77ff84905a91936367c01360803104f92432fcd904a43511876df5cdf3e7e548',
      'hex'
    )
    const value = 'Hello World!'

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
      const opts = {
        k: pub,
        seq: 1,
        v: value,
        sign(buf: Buffer) {
          expect(Buffer.from(buf).toString()).toBe('3:seqi1e1:v12:Hello World!')
          const sig = Buffer.from(
            '305ac8aeb6c9c151fa120f120ea2cfb923564e11552d06a5d856091e5e853cff' +
              '1260d3f39e4999684aa92eb73ffd136e6f4f3ecbfda0ce53a1608ecd7ae21f01',
            'hex'
          )
          return sig
        },
      }

      const expectedHash = Buffer.from(sha1(new Uint8Array(opts.k)))

      dht1.put(opts, (_, hash) => {
        expect(hash!.toString('hex')).toBe(expectedHash.toString('hex'))

        dht2.get(hash!, (err, res) => {
          if (err) throw err
          expect(res!.v.toString('utf8')).toBe(opts.v as string)
          expect(res!.seq).toBe(1)
          cleanup()
          resolve()
        })
      })
    }
  })
})

test('dht store test vectors - test 2 (mutable with salt)', () => {
  return new Promise<void>((resolve) => {
    const pub = Buffer.from(
      '77ff84905a91936367c01360803104f92432fcd904a43511876df5cdf3e7e548',
      'hex'
    )
    const value = 'Hello World!'

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
      const opts = {
        k: pub,
        seq: 1,
        v: Buffer.from(value),
        salt: Buffer.from('foobar'),
        sign(buf: Buffer) {
          expect(Buffer.from(buf).toString()).toBe('4:salt6:foobar3:seqi1e1:v12:Hello World!')
          const sig = Buffer.from(
            '6834284b6b24c3204eb2fea824d82f88883a3d95e8b4a21b8c0ded553d17d17d' +
              'df9a8a7104b1258f30bed3787e6cb896fca78c58f8e03b5f18f14951a87d9a08',
            'hex'
          )
          return sig
        },
      }

      dht1.put(opts, (_, hash) => {
        expect(hash!.toString('hex')).toBe('411eba73b6f087ca51a3795d9c8c938d365e32c1')

        dht2.get(hash!, (err, res) => {
          if (err) throw err
          expect(res!.v.toString('utf8')).toBe(String(opts.v))
          expect(res!.seq).toBe(1)
          cleanup()
          resolve()
        })
      })
    }
  })
})
