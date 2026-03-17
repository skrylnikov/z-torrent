import Protocol from '@z-torrent/protocol'
import { expect, test } from 'bun:test'
import { string2compact } from '@z-torrent/utils/string-compact'
import bencode from 'bencode'

import { UtPex, type Wire, type PEXMessage } from '../src'

function createMockWire(extended: (name: string, data: PEXMessage) => void): Wire {
  return { extended: (name, data) => extended(name, data as PEXMessage), destroy: () => {} }
}

test('wire.use(UtPex)', () => {
  const wire = new Protocol()

  wire.use(UtPex)

  const pex = wire.ut_pex as UtPex
  expect(pex).toBeTruthy()
  expect(pex.start).toBeTruthy()
  expect(pex.stop).toBeTruthy()
  expect(pex.reset).toBeTruthy()
  expect(pex.addPeer).toBeTruthy()
  expect(pex.dropPeer).toBeTruthy()
  expect(pex.on).toBeTruthy()
  expect('peers' in pex).toBeFalsy()
})

test('should ignore when addPeer receives an invalid peer', () => {
  const wire = createMockWire(() => {})
  const pex = new UtPex(wire)

  const peer = '?'
  pex.addPeer(peer)

  pex.sendMessage()
})

test('should ignore when addPeer receives a peer that remote wire already sent us', () => {
  let called = false
  const peer = '127.0.0.1:6889'

  const wire = createMockWire((_name, data) => {
    called = true
    expect(data.added!.length).toBe(0)
  })

  const pex = new UtPex(wire)
  pex.onMessage(bencode.encode({ added: string2compact(peer) }))

  pex.addPeer(peer)
  pex.sendMessage()

  expect(called).toBe(true)
})

test('should add peer via sendMessage when addPeer called', () => {
  const peer = '127.0.0.1:6889'

  const wire = createMockWire((_name, data) => {
    expect(data.added).toEqual(new Uint8Array(string2compact(peer)))
  })

  const pex = new UtPex(wire)
  pex.addPeer(peer)
  pex.sendMessage()
})

test('should add peer with flags via sendMessage when addPeer called with flags', () => {
  const peer = '127.0.0.1:6889'
  const encodedFlags = 0x06
  const decodedFlags = {
    prefersEncryption: false,
    isSender: true,
    supportsUtp: true,
    supportsUtHolepunch: false,
    isReachable: false,
  }

  const wire = createMockWire((_name, data) => {
    expect(data.added).toEqual(new Uint8Array(string2compact(peer)))
    expect(data['added.f']).toEqual(new Uint8Array([encodedFlags]))
  })

  const pex = new UtPex(wire)
  pex.addPeer(peer, decodedFlags)
  pex.sendMessage()
})

test('should add IPv6 peer via sendMessage when addPeer6 called', () => {
  const peer = '[::1]:6889'

  const wire = createMockWire((_name, data) => {
    expect(data.added6).toEqual(new Uint8Array(string2compact(peer)))
  })

  const pex = new UtPex(wire)
  pex.addPeer6(peer)
  pex.sendMessage()
})

test('should add IPv6 peer with flags via sendMessage when addPeer6 called with flags', () => {
  const peer = '[::1]:6889'
  const encodedFlags = 0x06
  const decodedFlags = {
    prefersEncryption: false,
    isSender: true,
    supportsUtp: true,
    supportsUtHolepunch: false,
    isReachable: false,
  }

  const wire = createMockWire((_name, data) => {
    expect(data.added6).toEqual(new Uint8Array(string2compact(peer)))
    expect(data['added6.f']).toEqual(new Uint8Array([encodedFlags]))
  })

  const pex = new UtPex(wire)
  pex.addPeer6(peer, decodedFlags)
  pex.sendMessage()
})

test('should remove from dropped when addPeer called for same peer', () => {
  const peer = '127.0.0.1:6889'

  const wire = createMockWire((_name, data) => {
    expect(data.added).toEqual(new Uint8Array(string2compact(peer)))
    expect(data.dropped!.length).toBe(0)
  })

  const pex = new UtPex(wire)
  pex.dropPeer(peer)
  pex.addPeer(peer)
  pex.sendMessage()
})

test('should ignore when dropPeer receives an invalid peer', () => {
  const wire = createMockWire(() => {})
  const pex = new UtPex(wire)

  const peer = '?'
  pex.dropPeer(peer)
  pex.sendMessage()
})

test('should ignore when dropPeer receives a peer that remote wire already sent us', () => {
  let called = false
  const peer = '127.0.0.1:6889'

  const wire = createMockWire((_name, data) => {
    called = true
    expect(data.dropped!.length).toBe(0)
  })

  const pex = new UtPex(wire)
  pex.onMessage(bencode.encode({ dropped: string2compact(peer) }))

  pex.dropPeer(peer)
  pex.sendMessage()

  expect(called).toBe(true)
})

test('should drop peer via sendMessage when dropPeer called', () => {
  const peer = '127.0.0.1:6889'

  const wire = createMockWire((_name, data) => {
    expect(data.dropped).toEqual(new Uint8Array(string2compact(peer)))
  })

  const pex = new UtPex(wire)
  pex.dropPeer(peer)
  pex.sendMessage()
})

test('should drop IPv6 peer via sendMessage when dropPeer6 called', () => {
  const peer = '[::1]:6889'

  const wire = createMockWire((_name, data) => {
    expect(data.dropped6).toEqual(new Uint8Array(string2compact(peer)))
  })

  const pex = new UtPex(wire)
  pex.dropPeer6(peer)
  pex.sendMessage()
})

test('should remove from added when dropPeer called for same peer', () => {
  const peer = '127.0.0.1:6889'

  const wire = createMockWire((_name, data) => {
    expect(data.dropped).toEqual(new Uint8Array(string2compact(peer)))
    expect(data.added!.length).toBe(0)
  })

  const pex = new UtPex(wire)
  pex.addPeer(peer)
  pex.dropPeer(peer)
  pex.sendMessage()
})

test('should emit warning when onExtendedHandshake receives an invalid handshake', (done) => {
  expect.assertions(1)
  const wire = new Protocol()
  const pex = new UtPex(wire)

  pex.on('warning', (err) => {
    expect(err).toBeTruthy()
    done()
  })

  const handshake = {}
  pex.onExtendedHandshake(handshake)
})

test('should pass when onExtendedHandshake receives a valid handshake', () => {
  const wire = new Protocol()
  const pex = new UtPex(wire)

  pex.on('warning', (err) => {
    throw err
  })

  const handshake = { m: { ut_pex: 1 } }
  pex.onExtendedHandshake(handshake)
})

test('should ignore when onMessage invalid message', () => {
  const wire = new Protocol()
  const pex = new UtPex(wire)

  pex.on('peer', () => {
    throw new Error('unexpected peer event')
  })

  pex.on('dropped', () => {
    throw new Error('unexpected dropped event')
  })

  const buf = Buffer.from([0x00])
  pex.onMessage(buf)
})

test('should ignore when onMessage added and address already received', () => {
  const wire = new Protocol()
  const pex = new UtPex(wire)

  const peer = '127.0.0.1:6889'
  const flags = 0x06

  pex.on('peer', () => {
    throw new Error('unexpected peer event')
  })

  const message = bencode.encode({
    added: string2compact(peer),
    'added.f': [flags],
  })
  pex.onMessage(Buffer.from(message))

  pex.onMessage(Buffer.from(message))
})

test('should emit peer event when onMessage added', (done) => {
  expect.assertions(2)
  const wire = new Protocol()
  const pex = new UtPex(wire)

  const peer = '127.0.0.1:6889'
  const encodedFlags = 0x06
  const decodedFlags = {
    prefersEncryption: false,
    isSender: true,
    supportsUtp: true,
    supportsUtHolepunch: false,
    isReachable: false,
  }

  pex.on('peer', (_peer, _flags) => {
    expect(_peer).toBe(peer)
    expect(_flags).toEqual(decodedFlags)
    done()
  })

  const message = bencode.encode({
    added: string2compact(peer),
    'added.f': [encodedFlags],
  })
  const buf = Buffer.from(message)
  pex.onMessage(buf)
})

test('should emit peer event when onMessage includes added without flags', (done) => {
  expect.assertions(2)
  const wire = new Protocol()
  const pex = new UtPex(wire)

  const peer = '127.0.0.1:6889'
  const decodedFlags = {
    prefersEncryption: false,
    isSender: false,
    supportsUtp: false,
    supportsUtHolepunch: false,
    isReachable: false,
  }

  pex.on('peer', (_peer, _flags) => {
    expect(_peer).toBe(peer)
    expect(_flags).toEqual(decodedFlags)
    done()
  })

  const message = bencode.encode({ added: string2compact(peer) })
  const buf = Buffer.from(message)
  pex.onMessage(buf)
})

test('should emit peer event when onMessage added6', (done) => {
  expect.assertions(2)

  const wire = new Protocol()
  const pex = new UtPex(wire)

  const peer = '[::1]:6889'
  const encodedFlags = 0x06
  const decodedFlags = {
    prefersEncryption: false,
    isSender: true,
    supportsUtp: true,
    supportsUtHolepunch: false,
    isReachable: false,
  }

  pex.on('peer', (_peer, _flags) => {
    expect(_peer).toBe(peer)
    expect(_flags).toEqual(decodedFlags)
    done()
  })

  const message = bencode.encode({
    added6: string2compact(peer),
    'added6.f': [encodedFlags],
  })
  const buf = Buffer.from(message)
  pex.onMessage(buf)
})

test('should emit peer event when onMessage includes added6 without flags', (done) => {
  expect.assertions(2)

  const wire = new Protocol()
  const pex = new UtPex(wire)

  const peer = '[::1]:6889'
  const decodedFlags = {
    prefersEncryption: false,
    isSender: false,
    supportsUtp: false,
    supportsUtHolepunch: false,
    isReachable: false,
  }

  pex.on('peer', (_peer, _flags) => {
    expect(_peer).toBe(peer)
    expect(_flags).toEqual(decodedFlags)
    done()
  })

  const message = bencode.encode({ added6: string2compact(peer) })
  const buf = Buffer.from(message)
  pex.onMessage(buf)
})

test('should ignore when onMessage dropped and address already received', () => {
  const wire = new Protocol()
  const pex = new UtPex(wire)

  const peer = '127.0.0.1:6889'

  pex.on('dropped', () => {
    throw new Error('unexpected dropped event')
  })

  const message = bencode.encode({ dropped: string2compact(peer) })
  pex.onMessage(Buffer.from(message))

  pex.onMessage(Buffer.from(message))
})

test('should emit dropped event when onMessage dropped', (done) => {
  expect.assertions(1)

  const wire = new Protocol()
  const pex = new UtPex(wire)

  const peer = '127.0.0.1:6889'

  pex.on('dropped', (_peer) => {
    expect(_peer).toBe(peer)
    done()
  })

  const message = bencode.encode({ dropped: string2compact(peer) })
  const buf = Buffer.from(message)
  pex.onMessage(buf)
})

test('should emit dropped event when onMessage dropped6', (done) => {
  expect.assertions(1)

  const wire = new Protocol()
  const pex = new UtPex(wire)

  const peer = '[::1]:6889'

  pex.on('dropped', (_peer) => {
    expect(_peer).toBe(peer)
    done()
  })

  const message = bencode.encode({ dropped6: string2compact(peer) })
  const buf = Buffer.from(message)
  pex.onMessage(buf)
})

test('should sendMessage with empty added and empty dropped', () => {
  expect.assertions(2)

  const wire = createMockWire((ext, obj) => {
    expect(ext).toBe('ut_pex')
    expect(obj).toEqual({
      added: new Uint8Array(0),
      'added.f': new Uint8Array(0),
      dropped: new Uint8Array(0),
      added6: new Uint8Array(0),
      'added6.f': new Uint8Array(0),
      dropped6: new Uint8Array(0),
    })
  })

  const pex = new UtPex(wire)

  pex.sendMessage()
})

test('should sendMessage when a localAdded has an IPv4 address', () => {
  expect.assertions(2)

  const peer = '127.0.0.1:6889'

  const wire = createMockWire((ext, obj) => {
    expect(ext).toBe('ut_pex')
    expect(obj).toEqual({
      added: new Uint8Array(string2compact(peer)),
      'added.f': new Uint8Array([0x06]),
      dropped: new Uint8Array(0),
      added6: new Uint8Array(0),
      'added6.f': new Uint8Array(0),
      dropped6: new Uint8Array(0),
    })
  })

  const pex = new UtPex(wire)

  pex.addPeer(peer, { isSender: true, supportsUtp: true })
  pex.sendMessage()
})

test('should sendMessage when multiple localAdded IPv4 addresses', () => {
  expect.assertions(2)

  const peerA = '127.0.0.1:6889'
  const peerB = '127.0.0.1:6890'

  const wire = createMockWire((ext, obj) => {
    expect(ext).toBe('ut_pex')
    expect(obj).toEqual({
      added: new Uint8Array(string2compact([peerA, peerB])),
      'added.f': new Uint8Array([0x06, 0x06]),
      dropped: new Uint8Array(0),
      added6: new Uint8Array(0),
      'added6.f': new Uint8Array(0),
      dropped6: new Uint8Array(0),
    })
  })

  const pex = new UtPex(wire)

  pex.addPeer(peerA, { isSender: true, supportsUtp: true })
  pex.addPeer(peerB, { isSender: true, supportsUtp: true })
  pex.sendMessage()
})

test('should sendMessage when a localAdded has an IPv6 address', () => {
  expect.assertions(2)

  const peer = '[::1]:6889'

  const wire = createMockWire((ext, obj) => {
    expect(ext).toBe('ut_pex')
    expect(obj).toEqual({
      added: new Uint8Array(0),
      'added.f': new Uint8Array(0),
      dropped: new Uint8Array(0),
      added6: new Uint8Array(string2compact(peer)),
      'added6.f': new Uint8Array([0x06]),
      dropped6: new Uint8Array(0),
    })
  })

  const pex = new UtPex(wire)

  pex.addPeer6(peer, { isSender: true, supportsUtp: true })
  pex.sendMessage()
})

test('should sendMessage when multiple localAdded IPv6 addresses', () => {
  expect.assertions(2)

  const peerA = '[::1]:6889'
  const peerB = '[::1]:6890'

  const wire = createMockWire((ext, obj) => {
    expect(ext).toBe('ut_pex')
    expect(obj).toEqual({
      added: new Uint8Array(0),
      'added.f': new Uint8Array(0),
      dropped: new Uint8Array(0),
      added6: new Uint8Array(string2compact([peerA, peerB])),
      'added6.f': new Uint8Array([0x06, 0x06]),
      dropped6: new Uint8Array(0),
    })
  })

  const pex = new UtPex(wire)

  pex.addPeer6(peerA, { isSender: true, supportsUtp: true })
  pex.addPeer6(peerB, { isSender: true, supportsUtp: true })
  pex.sendMessage()
})

test('should sendMessage when a localDropped has an IPv4 address', () => {
  expect.assertions(2)

  const peer = '127.0.0.1:6889'

  const wire = createMockWire((ext, obj) => {
    expect(ext).toBe('ut_pex')
    expect(obj).toEqual({
      added: new Uint8Array(0),
      'added.f': new Uint8Array(0),
      dropped: new Uint8Array(string2compact(peer)),
      added6: new Uint8Array(0),
      'added6.f': new Uint8Array(0),
      dropped6: new Uint8Array(0),
    })
  })

  const pex = new UtPex(wire)

  pex.dropPeer(peer)
  pex.sendMessage()
})

test('should sendMessage when a localDropped has an IPv6 address', () => {
  expect.assertions(2)

  const peer = '[::1]:6889'

  const wire = createMockWire((ext, obj) => {
    expect(ext).toBe('ut_pex')
    expect(obj).toEqual({
      added: new Uint8Array(0),
      'added.f': new Uint8Array(0),
      dropped: new Uint8Array(0),
      added6: new Uint8Array(0),
      'added6.f': new Uint8Array(0),
      dropped6: new Uint8Array(string2compact(peer)),
    })
  })

  const pex = new UtPex(wire)

  pex.dropPeer6(peer)
  pex.sendMessage()
})
