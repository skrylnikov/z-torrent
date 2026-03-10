import { expect, test } from 'bun:test'
import Protocol from 'bittorrent-protocol'

test('Timeout when peer does not respond', () => {
  return new Promise<void>((resolve, reject) => {
    let timeouts = 0

    const wire = new Protocol()
    wire.on('error', (err: Error) => reject(err))
    wire.pipe(wire)
    wire.setTimeout(1000)
    wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'))

    wire.on('unchoke', () => {
      let requests = 0

      wire.request(0, 0, 0, (err: Error | null) => {
        expect(err).toBeTruthy()
        expect(++requests).toBe(1)
      })

      wire.request(0, 0, 0, (err: Error | null) => {
        expect(err).toBeTruthy()
        expect(++requests).toBe(2)
      })

      wire.request(0, 0, 0, (err: Error | null) => {
        expect(err).toBeTruthy()
        expect(++requests).toBe(3)
        resolve()
      })
    })

    wire.on('timeout', () => {
      expect(++timeouts <= 3).toBe(true)
    })

    wire.unchoke()
  })
})
