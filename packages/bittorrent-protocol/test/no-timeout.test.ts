import { expect, test } from 'bun:test'
import Protocol from 'bittorrent-protocol'

test('No timeout when peer is good', () => {
  return new Promise<void>((resolve, reject) => {
    const wire = new Protocol()
    wire.on('error', (err: Error) => reject(err))
    wire.pipe(wire)
    wire.setTimeout(1000)
    wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'))

    wire.on('unchoke', () => {
      let completed = 0
      const checkDone = () => {
        if (++completed === 3) resolve()
      }

      wire.request(0, 0, 11, (err: Error | null) => {
        expect(err).toBeFalsy()
        checkDone()
      })

      wire.request(0, 0, 11, (err: Error | null) => {
        expect(err).toBeFalsy()
        checkDone()
      })

      wire.request(0, 0, 11, (err: Error | null) => {
        expect(err).toBeFalsy()
        checkDone()
      })
    })

    wire.on(
      'request',
      (
        i: number,
        offset: number,
        length: number,
        callback: (err: Error | null, buffer?: Buffer) => void
      ) => {
        callback(null, Buffer.from('hello world'))
      }
    )

    wire.on('timeout', () => {
      reject(new Error('Timed out'))
    })

    wire.unchoke()
  })
})
