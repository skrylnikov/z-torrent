import { expect, test } from 'bun:test'
import Protocol from '@z-torrent/protocol'

test('Extension.prototype.name', () => {
  const wire = new Protocol()

  function NoNameExtension() {}
  expect(() => {
    wire.use(NoNameExtension as any)
  }).toThrow()

  function NamedExtension() {}
  ;(NamedExtension as any).prototype.name = 'named_extension'
  expect(() => {
    wire.use(NamedExtension as any)
  }).not.toThrow()
})

test('Extension.onHandshake', () => {
  return new Promise<void>((resolve, reject) => {
    function TestExtension() {}
    ;(TestExtension as any).prototype.name = 'test_extension'
    ;(TestExtension as any).prototype.onHandshake = (
      infoHash: string,
      peerId: string,
      extensions: Record<string, unknown>
    ) => {
      expect(Buffer.from(infoHash, 'hex').length).toBe(20)
      expect(Buffer.from(infoHash, 'hex').toString()).toBe('01234567890123456789')
      expect(Buffer.from(peerId, 'hex').length).toBe(20)
      expect(Buffer.from(peerId, 'hex').toString()).toBe('12345678901234567890')
      resolve()
    }

    const wire = new Protocol()
    wire.on('error', (err: Error) => reject(err))
    wire.pipe(wire)

    wire.use(TestExtension as any)

    wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'))
  })
})

test('Extension.onExtendedHandshake', () => {
  return new Promise<void>((resolve, reject) => {
    class TestExtension {
      constructor(wire: any) {
        wire.extendedHandshake = {
          hello: 'world!',
        }
      }

      onExtendedHandshake(handshake: any) {
        expect(handshake.m.test_extension).toBeTruthy()
        expect(Buffer.from(handshake.hello).toString()).toBe('world!')
        resolve()
      }
    }

    ;(TestExtension as any).prototype.name = 'test_extension'

    const wire = new Protocol()
    wire.on('error', (err: Error) => reject(err))
    wire.pipe(wire)

    wire.once('handshake', (infoHash: Buffer, peerId: Buffer, extensions: any) => {
      expect(extensions.extended).toBe(true)
    })

    wire.use(TestExtension as any)

    wire.handshake(
      '3031323334353637383930313233343536373839',
      '3132333435363738393031323334353637383930'
    )
  })
})

test('Extension.onMessage', () => {
  return new Promise<void>((resolve, reject) => {
    class TestExtension {
      wire: any
      constructor(wire: any) {
        this.wire = wire
      }

      onMessage(message: Buffer) {
        expect(Buffer.from(message).toString()).toBe('hello world!')
        resolve()
      }
    }

    ;(TestExtension as any).prototype.name = 'test_extension'

    const wire = new Protocol()
    wire.on('error', (err: Error) => reject(err))
    wire.pipe(wire)

    wire.use(TestExtension as any)

    wire.handshake(
      '3031323334353637383930313233343536373839',
      '3132333435363738393031323334353637383930'
    )

    wire.once('extended', () => {
      wire.extended('test_extension', Buffer.from('hello world!'))
    })
  })
})
