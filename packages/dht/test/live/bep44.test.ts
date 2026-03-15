import ed from 'bittorrent-dht-sodium'
import { test, expect } from 'bun:test'
import DHT from '../../src/index.js'

function sign(k: { sk: Buffer; pk: Buffer }) {
  return (buf: Buffer) => {
    return ed.sign(buf, k.sk)
  }
}

function kp() {
  return ed.keygen()
}

test(
  'Set and get before ready is emitted',
  () => {
    return new Promise<void>((resolve) => {
      const dht1 = new DHT()
      const dht2 = new DHT()
      dht1.on('error', console.error)
      dht2.on('error', console.error)

      dht1.put({ v: 'myvalue' }, (err, hash, n) => {
        if (err) throw err
        expect(hash).toBeTruthy()
        dht2.get(hash!, (err, value) => {
          if (err) throw err
          expect(value!.v.toString()).toBe('myvalue')
          dht1.destroy()
          dht2.destroy()
          resolve()
        })
      })
    })
  },
  60000,
)

test(
  'put mutable',
  () => {
    return new Promise<void>((resolve) => {
      const dht1 = new DHT()
      const dht2 = new DHT({ verify: ed.verify } as any)
      dht1.on('error', console.error)
      dht2.on('error', console.error)
      const k = kp()

      dht1.put(
      {
        k: k.pk,
        v: 'myvalue',
        sign: sign(k),
        seq: 0,
      },
      (err, hash, n) => {
        if (err) throw err
        expect(hash).toBeTruthy()
        dht2.get(hash!, (err, value) => {
          if (err) throw err
          expect(value!.v.toString()).toBe('myvalue')
          dht1.destroy()
          dht2.destroy()
          resolve()
        })
      }
    )
  })
  },
  60000,
)

test(
  'put mutable (salted)',
  () => {
    return new Promise<void>((resolve) => {
      const dht1 = new DHT()
      const dht2 = new DHT({ verify: ed.verify } as any)
      dht1.on('error', console.error)
      dht2.on('error', console.error)
      const k = kp()
      const salt = ed.salt()

      dht1.put(
        {
          k: k.pk,
          v: 'myvalue',
          sign: sign(k),
          seq: 0,
          salt,
        },
        (err, hash, n) => {
          if (err) throw err
          expect(hash).toBeTruthy()
          dht2.get(hash!, (_, value) => {
            expect(value).toBeFalsy()
            dht2.get(hash!, { salt }, (err, value) => {
              if (err) throw err
              expect(value!.v.toString()).toBe('myvalue')
              dht1.destroy()
              dht2.destroy()
              resolve()
            })
          })
        }
      )
    })
  },
  60000,
)
