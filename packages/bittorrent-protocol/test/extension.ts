import test from 'tape'
import Protocol from 'bittorrent-protocol'

test('Extension.prototype.name', (t) => {
  t.plan(2)

  const wire = new Protocol()

  function NoNameExtension() {}
  t.throws(() => {
    wire.use(NoNameExtension as any)
  }, 'throws when Extension.prototype.name is undefined')

  function NamedExtension() {}
  ;(NamedExtension as any).prototype.name = 'named_extension'
  t.doesNotThrow(() => {
    wire.use(NamedExtension as any)
  }, 'does not throw when Extension.prototype.name is defined')
})

test('Extension.onHandshake', (t) => {
  t.plan(4)

  function TestExtension() {}
  ;(TestExtension as any).prototype.name = 'test_extension'
  ;(TestExtension as any).prototype.onHandshake = (
    infoHash: string,
    peerId: string,
    extensions: Record<string, unknown>
  ) => {
    t.equal(Buffer.from(infoHash, 'hex').length, 20)
    t.equal(Buffer.from(infoHash, 'hex').toString(), '01234567890123456789')
    t.equal(Buffer.from(peerId, 'hex').length, 20)
    t.equal(Buffer.from(peerId, 'hex').toString(), '12345678901234567890')
  }

  const wire = new Protocol()
  wire.on('error', (err: Error) => {
    t.fail(err.message)
  })
  wire.pipe(wire)

  wire.use(TestExtension as any)

  wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'))
})

test('Extension.onExtendedHandshake', (t) => {
  t.plan(3)

  class TestExtension {
    constructor(wire: any) {
      wire.extendedHandshake = {
        hello: 'world!',
      }
    }

    onExtendedHandshake(handshake: any) {
      t.ok(handshake.m.test_extension, 'peer extended handshake includes extension name')
      t.equal(
        Buffer.from(handshake.hello).toString(),
        'world!',
        'peer extended handshake includes extension-defined parameters'
      )
    }
  }

  ;(TestExtension as any).prototype.name = 'test_extension'

  const wire = new Protocol() // incoming
  wire.on('error', (err: Error) => {
    t.fail(err.message)
  })
  wire.pipe(wire)

  wire.once('handshake', (infoHash: Buffer, peerId: Buffer, extensions: any) => {
    t.equal(extensions.extended, true)
  })

  wire.use(TestExtension as any)

  wire.handshake(
    '3031323334353637383930313233343536373839',
    '3132333435363738393031323334353637383930'
  )
})

test('Extension.onMessage', (t) => {
  t.plan(1)

  class TestExtension {
    wire: any
    constructor(wire: any) {
      this.wire = wire
    }

    onMessage(message: Buffer) {
      t.equal(
        Buffer.from(message).toString(),
        'hello world!',
        'receives message sent with wire.extended()'
      )
    }
  }

  ;(TestExtension as any).prototype.name = 'test_extension'

  const wire = new Protocol() // outgoing
  wire.on('error', (err: Error) => {
    t.fail(err.message)
  })
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
