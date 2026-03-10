import { expect, test } from 'bun:test'
import Protocol from 'bittorrent-protocol'

test("State changes correctly on wire 'end'", () => {
  return new Promise<void>((resolve, reject) => {
    const wire = new Protocol()
    wire.on('error', (err: Error) => reject(err))
    wire.pipe(wire)

    wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'))

    expect(wire.amChoking).toBeTruthy()
    expect(wire.peerChoking).toBeTruthy()

    wire.on('unchoke', () => {
      expect(wire.amChoking).toBeFalsy()
      expect(wire.peerChoking).toBeFalsy()
      wire.interested()
    })

    wire.on('interested', () => {
      expect(wire.peerInterested).toBeTruthy()
      destroy()
    })

    function destroy() {
      wire.on('choke', () => {})
      wire.on('uninterested', () => {})

      wire.on('end', () => {
        expect(wire.peerChoking).toBeTruthy()
        expect(wire.peerInterested).toBeFalsy()
      })

      wire.on('finish', () => {
        expect(wire.peerChoking).toBeTruthy()
        expect(wire.peerInterested).toBeFalsy()
        resolve()
      })

      wire.destroy()
    }

    wire.unchoke()
  })
})
