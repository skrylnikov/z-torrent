import bencode from 'bencode'
import ed from 'bittorrent-dht-sodium'
import { test, expect } from 'bun:test'
import DHT from '../src/index.js'
import * as common from './common.js'

test('dht store with salt', () => {
  return new Promise<void>((resolve) => {
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
      const keys = ed.keygen()
      const publicKey = keys.pk
      const secretKey = keys.sk

      const opts: any = {
        seq: 1,
        v: Buffer.from('hello world'),
        salt: Buffer.from('mysalt'),
      }

      opts.k = publicKey

      const toEncode = { salt: opts.salt, seq: opts.seq, v: opts.v }

      const encoded = Buffer.from(bencode.encode(toEncode).slice(1, -1)).toString()

      opts.sig = ed.sign(Buffer.from(encoded), secretKey)

      dht1.put(opts, (_, hash) => {
        dht2.get(hash!, (err, res) => {
          if (err) throw err

          expect(res!.v.toString('utf8')).toBe(opts.v.toString('utf8'))

          expect(res!.seq).toBe(1)
          cleanup()
          resolve()
        })
      })
    }
  })
})
