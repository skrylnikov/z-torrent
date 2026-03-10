import { expect, test } from 'bun:test'
import Protocol from 'bittorrent-protocol'

test('Timeout and destroy when peer does not respond', () => {
  return new Promise<void>((resolve, reject) => {
    let timeouts = 0

    const wire = new Protocol()
    wire.on('error', (err: Error) => reject(err))
    wire.pipe(wire)
    wire.setTimeout(1000)
    wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'))

    wire.on('unchoke', () => {
      wire.request(0, 0, 0, (err: Error | null) => {
        expect(err).toBeTruthy()
      })

      wire.request(0, 0, 0, (err: Error | null) => {
        expect(err).toBeTruthy()
      })

      wire.request(0, 0, 0, (err: Error | null) => {
        expect(err).toBeTruthy()
        resolve()
      })
    })

    wire.on('timeout', () => {
      expect(++timeouts).toBe(1)
      wire.end()
    })

    wire.unchoke()
  })
})
