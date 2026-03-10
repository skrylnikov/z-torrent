import Protocol from 'bittorrent-protocol'
import utPex from 'ut_pex'
import { expect, test } from 'bun:test'
import string2compact from 'string2compact'
import bencode from 'bencode'

test('wire.use(ut_pex())', () => {
  const wire = new Protocol()
  wire.pipe(wire)

  wire.use(utPex())

  expect(wire.ut_pex).toBeTruthy()
  expect(wire.ut_pex!.start).toBeTruthy()
  expect(wire.ut_pex!.stop).toBeTruthy()
  expect(wire.ut_pex!.reset).toBeTruthy()
  expect((wire.ut_pex as unknown as { addPeer: unknown }).addPeer).toBeTruthy()
  expect((wire.ut_pex as unknown as { dropPeer: unknown }).dropPeer).toBeTruthy()
  expect(wire.ut_pex!.on).toBeTruthy()
  expect((wire.ut_pex as unknown as { peers: unknown }).peers).toBeFalsy()
})

test('should ignore when addPeer receives an invalid peer', () => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  const peer = '?'
  pex.addPeer(peer)

  expect((pex as unknown as { _localAddedPeers: Record<string, unknown> })._localAddedPeers[peer]).toBeFalsy()
})

test('should ignore when addPeer receives a peer that remote wire already sent us', () => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  const peer = '127.0.0.1:6889'
  ;(pex as unknown as { _remoteAddedPeers: Record<string, unknown> })._remoteAddedPeers[peer] = {
    ip: 4,
  }
  pex.addPeer(peer)

  expect((pex as unknown as { _localAddedPeers: Record<string, unknown> })._localAddedPeers[peer]).toBeFalsy()
})

test('should add to localAddedPeers when addPeer', () => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  const peer = '127.0.0.1:6889'
  pex.addPeer(peer)

  expect((pex as unknown as { _localAddedPeers: Record<string, unknown> })._localAddedPeers[peer]).toBeTruthy()
  expect(
    (pex as unknown as { _localAddedPeers: Record<string, { flags: number }> })._localAddedPeers[
      peer
    ].flags
  ).toBe(0x00)
})

test('should add to localAddedPeers when addPeer with flags', () => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  const peer = '127.0.0.1:6889'
  const encodedFlags = 0x06
  const decodedFlags = {
    prefersEncryption: false,
    isSender: true,
    supportsUtp: true,
    supportsUtHolepunch: false,
    isReachable: false,
  }

  pex.addPeer(peer, decodedFlags)

  expect((pex as unknown as { _localAddedPeers: Record<string, unknown> })._localAddedPeers[peer]).toBeTruthy()
  expect(
    (pex as unknown as { _localAddedPeers: Record<string, { flags: number }> })._localAddedPeers[
      peer
    ].flags
  ).toBe(encodedFlags)
})

test('should add to localAddedPeers when addPeer6', () => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  const peer = '[::1]:6889'
  pex.addPeer6(peer)

  expect((pex as unknown as { _localAddedPeers: Record<string, unknown> })._localAddedPeers[peer]).toBeTruthy()
  expect(
    (pex as unknown as { _localAddedPeers: Record<string, { flags: number }> })._localAddedPeers[
      peer
    ].flags
  ).toBe(0x00)
})

test('should add to localAddedPeers when addPeer6 with flags', () => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  const peer = '[::1]:6889'
  const encodedFlags = 0x06
  const decodedFlags = {
    prefersEncryption: false,
    isSender: true,
    supportsUtp: true,
    supportsUtHolepunch: false,
    isReachable: false,
  }

  pex.addPeer6(peer, decodedFlags)

  expect((pex as unknown as { _localAddedPeers: Record<string, unknown> })._localAddedPeers[peer]).toBeTruthy()
  expect(
    (pex as unknown as { _localAddedPeers: Record<string, { flags: number }> })._localAddedPeers[
      peer
    ].flags
  ).toBe(encodedFlags)
})

test('should add to localAddedPeers and remove from localDroppedPeers when addPeer', () => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  const peer = '127.0.0.1:6889'
  ;(pex as unknown as { _localDroppedPeers: Record<string, unknown> })._localDroppedPeers[peer] = {
    ip: 4,
  }
  pex.addPeer(peer)

  expect(
    (pex as unknown as { _localDroppedPeers: Record<string, unknown> })._localDroppedPeers[peer]
  ).toBeFalsy()
  expect((pex as unknown as { _localAddedPeers: Record<string, unknown> })._localAddedPeers[peer]).toBeTruthy()
})

test('should ignore when dropPeer receives an invalid peer', () => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  const peer = '?'
  pex.dropPeer(peer)

  expect(
    (pex as unknown as { _localDroppedPeers: Record<string, unknown> })._localDroppedPeers[peer]
  ).toBeFalsy()
})

test('should ignore when dropPeer receives a peer that remote wire already sent us', () => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  const peer = '127.0.0.1:6889'
  ;(pex as unknown as { _remoteDroppedPeers: Record<string, unknown> })._remoteDroppedPeers[peer] =
    { ip: 4 }
  pex.dropPeer(peer)

  expect(
    (pex as unknown as { _localDroppedPeers: Record<string, unknown> })._localDroppedPeers[peer]
  ).toBeFalsy()
})

test('should add to localDroppedPeers when dropPeer', () => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  const peer = '127.0.0.1:6889'
  pex.dropPeer(peer)

  expect((pex as unknown as { _localDroppedPeers: Record<string, unknown> })._localDroppedPeers[peer]).toBeTruthy()
})

test('should add to localDroppedPeers when dropPeer6', () => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  const peer = '[::1]:6889'
  pex.dropPeer6(peer)

  expect((pex as unknown as { _localDroppedPeers: Record<string, unknown> })._localDroppedPeers[peer]).toBeTruthy()
})

test('should add to localDroppedPeers and remove from localAddedPeers when dropPeer', () => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  const peer = '127.0.0.1:6889'
  ;(pex as unknown as { _localAddedPeers: Record<string, unknown> })._localAddedPeers[peer] = {
    ip: 4,
  }
  pex.dropPeer(peer)

  expect((pex as unknown as { _localAddedPeers: Record<string, unknown> })._localAddedPeers[peer]).toBeFalsy()
  expect((pex as unknown as { _localDroppedPeers: Record<string, unknown> })._localDroppedPeers[peer]).toBeTruthy()
})

test('should emit warning when onExtendedHandshake receives an invalid handshake', (done) => {
  expect.assertions(1)
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  pex.on('warning', (err) => {
    expect(err).toBeTruthy()
    done()
  })

  const handshake = {}
  pex.onExtendedHandshake(handshake as Parameters<typeof pex.onExtendedHandshake>[0])
})

test('should pass when onExtendedHandshake receives a valid handshake', () => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  pex.on('warning', (err) => {
    throw err
  })

  const handshake = { m: { ut_pex: 1 } }
  pex.onExtendedHandshake(handshake as Parameters<typeof pex.onExtendedHandshake>[0])
})

test('should ignore when onMessage invalid message', () => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  pex.on('peer', () => {
    throw new Error('unexpected peer event')
  })

  pex.on('dropped', () => {
    throw new Error('unexpected dropped event')
  })

  const buf = Buffer.from([0x00])
  pex.onMessage(buf)
})

test('should ignore when onMessage added and address already in remoteAddedPeers', () => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  const peer = '127.0.0.1:6889'
  const flags = 0x06
  ;(pex as unknown as { _remoteAddedPeers: Record<string, unknown> })._remoteAddedPeers[peer] = {
    ip: 4,
    flags,
  }

  pex.on('peer', () => {
    throw new Error('unexpected peer event')
  })

  const message = bencode.encode({
    added: string2compact(peer),
    'added.f': [flags],
  })
  const buf = Buffer.from(message)
  pex.onMessage(buf)
})

test('should add to remoteAddedPeers when onMessage added', (done) => {
  expect.assertions(6)
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

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
  })

  const message = bencode.encode({
    added: string2compact(peer),
    'added.f': [encodedFlags],
  })
  const buf = Buffer.from(message)
  pex.onMessage(buf)

  expect(
    (pex as unknown as { _remoteDroppedPeers: Record<string, unknown> })._remoteDroppedPeers[peer]
  ).toBeFalsy()
  expect((pex as unknown as { _remoteAddedPeers: Record<string, unknown> })._remoteAddedPeers[peer]).toBeTruthy()
  expect(
    (pex as unknown as { _remoteAddedPeers: Record<string, { ip: number }> })._remoteAddedPeers[
      peer
    ].ip
  ).toBe(4)
  expect(
    (pex as unknown as { _remoteAddedPeers: Record<string, { flags: number }> })._remoteAddedPeers[
      peer
    ].flags
  ).toBe(encodedFlags)
  done()
})

test('should add to remoteAddedPeers when onMessage includes added without flags', (done) => {
  expect.assertions(6)
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

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
  })

  const message = bencode.encode({ added: string2compact(peer) })
  const buf = Buffer.from(message)
  pex.onMessage(buf)

  expect(
    (pex as unknown as { _remoteDroppedPeers: Record<string, unknown> })._remoteDroppedPeers[peer]
  ).toBeFalsy()
  expect((pex as unknown as { _remoteAddedPeers: Record<string, unknown> })._remoteAddedPeers[peer]).toBeTruthy()
  expect(
    (pex as unknown as { _remoteAddedPeers: Record<string, { ip: number }> })._remoteAddedPeers[
      peer
    ].ip
  ).toBe(4)
  expect(
    (pex as unknown as { _remoteAddedPeers: Record<string, { flags: number }> })._remoteAddedPeers[
      peer
    ].flags
  ).toBeUndefined()
  done()
})

test('should add to remoteAddedPeers when onMessage added6', (done) => {
  expect.assertions(6)

  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

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
  })

  const message = bencode.encode({
    added6: string2compact(peer),
    'added6.f': [encodedFlags],
  })
  const buf = Buffer.from(message)
  pex.onMessage(buf)

  expect(
    (pex as unknown as { _remoteDroppedPeers: Record<string, unknown> })._remoteDroppedPeers[peer]
  ).toBeFalsy()
  expect((pex as unknown as { _remoteAddedPeers: Record<string, unknown> })._remoteAddedPeers[peer]).toBeTruthy()
  expect(
    (pex as unknown as { _remoteAddedPeers: Record<string, { ip: number }> })._remoteAddedPeers[
      peer
    ].ip
  ).toBe(6)
  expect(
    (pex as unknown as { _remoteAddedPeers: Record<string, { flags: number }> })._remoteAddedPeers[
      peer
    ].flags
  ).toBe(encodedFlags)
  done()
})

test('should add to removeAddedPeers when onMessage includes added6 without flags', (done) => {
  expect.assertions(6)

  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

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
  })

  const message = bencode.encode({ added6: string2compact(peer) })
  const buf = Buffer.from(message)
  pex.onMessage(buf)

  expect(
    (pex as unknown as { _remoteDroppedPeers: Record<string, unknown> })._remoteDroppedPeers[peer]
  ).toBeFalsy()
  expect((pex as unknown as { _remoteAddedPeers: Record<string, unknown> })._remoteAddedPeers[peer]).toBeTruthy()
  expect(
    (pex as unknown as { _remoteAddedPeers: Record<string, { ip: number }> })._remoteAddedPeers[
      peer
    ].ip
  ).toBe(6)
  expect(
    (pex as unknown as { _remoteAddedPeers: Record<string, { flags: number }> })._remoteAddedPeers[
      peer
    ].flags
  ).toBeUndefined()
  done()
})

test('should ignore when onMessage dropped and address already in remoteDroppedPeers', () => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  const peer = '127.0.0.1:6889'
  ;(pex as unknown as { _remoteDroppedPeers: Record<string, unknown> })._remoteDroppedPeers[peer] =
    { ip: 4 }

  pex.on('dropped', () => {
    throw new Error('unexpected dropped event')
  })

  const message = bencode.encode({ dropped: string2compact(peer) })
  const buf = Buffer.from(message)
  pex.onMessage(buf)
})

test('should add to remoteDroppedPeers when onMessage dropped', (done) => {
  expect.assertions(3)

  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  const peer = '127.0.0.1:6889'
  ;(pex as unknown as { _remoteAddedPeers: Record<string, unknown> })._remoteAddedPeers[peer] = {
    ip: 4,
  }

  pex.on('dropped', (_peer) => {
    expect(_peer).toBe(peer)
  })

  const message = bencode.encode({ dropped: string2compact(peer) })
  const buf = Buffer.from(message)
  pex.onMessage(buf)

  expect(
    (pex as unknown as { _remoteAddedPeers: Record<string, unknown> })._remoteAddedPeers[peer]
  ).toBeFalsy()
  expect(
    (pex as unknown as { _remoteDroppedPeers: Record<string, unknown> })._remoteDroppedPeers[peer]
  ).toBeTruthy()
  done()
})

test('should add to remoteDroppedPeers when onMessage dropped6', (done) => {
  expect.assertions(3)

  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  const peer = '[::1]:6889'
  ;(pex as unknown as { _remoteAddedPeers: Record<string, unknown> })._remoteAddedPeers[peer] = {
    ip: 6,
  }

  pex.on('dropped', (_peer) => {
    expect(_peer).toBe(peer)
  })

  const message = bencode.encode({ dropped6: string2compact(peer) })
  const buf = Buffer.from(message)
  pex.onMessage(buf)

  expect(
    (pex as unknown as { _remoteAddedPeers: Record<string, unknown> })._remoteAddedPeers[peer]
  ).toBeFalsy()
  expect(
    (pex as unknown as { _remoteDroppedPeers: Record<string, unknown> })._remoteDroppedPeers[peer]
  ).toBeTruthy()
  done()
})

test('should _sendMessage with empty added and empty dropped', () => {
  expect.assertions(2)

  class ProtocolMock {
    extended(ext: string, obj: Record<string, unknown>) {
      expect(ext).toBe('ut_pex')
      expect(obj).toEqual({
        added: Buffer.alloc(0),
        'added.f': Buffer.alloc(0),
        dropped: Buffer.alloc(0),
        added6: Buffer.alloc(0),
        'added6.f': Buffer.alloc(0),
        dropped6: Buffer.alloc(0),
      })
    }
  }

  const Extension = utPex()
  const wire = new ProtocolMock()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  ;(pex as unknown as { _sendMessage: () => void })._sendMessage()
})

test('should _sendMessage when a localAdded has an IPv4 address', () => {
  expect.assertions(2)

  const peer = '127.0.0.1:6889'

  class ProtocolMock {
    extended(ext: string, obj: Record<string, unknown>) {
      expect(ext).toBe('ut_pex')
      expect(obj).toEqual({
        added: Buffer.from(string2compact(peer)),
        'added.f': Buffer.from([0x06]),
        dropped: Buffer.alloc(0),
        added6: Buffer.alloc(0),
        'added6.f': Buffer.alloc(0),
        dropped6: Buffer.alloc(0),
      })
    }
  }

  const Extension = utPex()
  const wire = new ProtocolMock()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  ;(pex as unknown as { _localAddedPeers: Record<string, unknown> })._localAddedPeers[peer] = {
    ip: 4,
    flags: 0x06,
  }
  ;(pex as unknown as { _sendMessage: () => void })._sendMessage()
})

test('should _sendMessage when multiple localAdded IPv4 addresses', () => {
  expect.assertions(2)

  const peerA = '127.0.0.1:6889'
  const peerB = '127.0.0.1:6890'

  class ProtocolMock {
    extended(ext: string, obj: Record<string, unknown>) {
      expect(ext).toBe('ut_pex')
      expect(obj).toEqual({
        added: Buffer.from(string2compact([peerA, peerB])),
        'added.f': Buffer.from([0x06, 0x06]),
        dropped: Buffer.alloc(0),
        added6: Buffer.alloc(0),
        'added6.f': Buffer.alloc(0),
        dropped6: Buffer.alloc(0),
      })
    }
  }

  const Extension = utPex()
  const wire = new ProtocolMock()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  ;(pex as unknown as { _localAddedPeers: Record<string, unknown> })._localAddedPeers[peerA] = {
    ip: 4,
    flags: 0x06,
  }
  ;(pex as unknown as { _localAddedPeers: Record<string, unknown> })._localAddedPeers[peerB] = {
    ip: 4,
    flags: 0x06,
  }
  ;(pex as unknown as { _sendMessage: () => void })._sendMessage()
})

test('should _sendMessage when a localAdded has an IPv6 address', () => {
  expect.assertions(2)

  const peer = '[::1]:6889'

  class ProtocolMock {
    extended(ext: string, obj: Record<string, unknown>) {
      expect(ext).toBe('ut_pex')
      expect(obj).toEqual({
        added: Buffer.alloc(0),
        'added.f': Buffer.alloc(0),
        dropped: Buffer.alloc(0),
        added6: Buffer.from(string2compact(peer)),
        'added6.f': Buffer.from([0x06]),
        dropped6: Buffer.alloc(0),
      })
    }
  }

  const Extension = utPex()
  const wire = new ProtocolMock()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  ;(pex as unknown as { _localAddedPeers: Record<string, unknown> })._localAddedPeers[peer] = {
    ip: 6,
    flags: 0x06,
  }
  ;(pex as unknown as { _sendMessage: () => void })._sendMessage()
})

test('should _sendMessage when multiple localAdded IPv6 addresses', () => {
  expect.assertions(2)

  const peerA = '[::1]:6889'
  const peerB = '[::1]:6890'

  class ProtocolMock {
    extended(ext: string, obj: Record<string, unknown>) {
      expect(ext).toBe('ut_pex')
      expect(obj).toEqual({
        added: Buffer.alloc(0),
        'added.f': Buffer.alloc(0),
        dropped: Buffer.alloc(0),
        added6: Buffer.from(string2compact([peerA, peerB])),
        'added6.f': Buffer.from([0x06, 0x06]),
        dropped6: Buffer.alloc(0),
      })
    }
  }

  const Extension = utPex()
  const wire = new ProtocolMock()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  ;(pex as unknown as { _localAddedPeers: Record<string, unknown> })._localAddedPeers[peerA] = {
    ip: 6,
    flags: 0x06,
  }
  ;(pex as unknown as { _localAddedPeers: Record<string, unknown> })._localAddedPeers[peerB] = {
    ip: 6,
    flags: 0x06,
  }
  ;(pex as unknown as { _sendMessage: () => void })._sendMessage()
})

test('should _sendMessage when a localDropped has an IPv4 address', () => {
  expect.assertions(2)

  const peer = '127.0.0.1:6889'

  class ProtocolMock {
    extended(ext: string, obj: Record<string, unknown>) {
      expect(ext).toBe('ut_pex')
      expect(obj).toEqual({
        added: Buffer.alloc(0),
        'added.f': Buffer.alloc(0),
        dropped: Buffer.from(string2compact(peer)),
        added6: Buffer.alloc(0),
        'added6.f': Buffer.alloc(0),
        dropped6: Buffer.alloc(0),
      })
    }
  }

  const Extension = utPex()
  const wire = new ProtocolMock()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  ;(pex as unknown as { _localDroppedPeers: Record<string, unknown> })._localDroppedPeers[peer] = {
    ip: 4,
  }
  ;(pex as unknown as { _sendMessage: () => void })._sendMessage()
})

test('should _sendMessage when a localDropped has an IPv6 address', () => {
  expect.assertions(2)

  const peer = '[::1]:6889'

  class ProtocolMock {
    extended(ext: string, obj: Record<string, unknown>) {
      expect(ext).toBe('ut_pex')
      expect(obj).toEqual({
        added: Buffer.alloc(0),
        'added.f': Buffer.alloc(0),
        dropped: Buffer.alloc(0),
        added6: Buffer.alloc(0),
        'added6.f': Buffer.alloc(0),
        dropped6: Buffer.from(string2compact(peer)),
      })
    }
  }

  const Extension = utPex()
  const wire = new ProtocolMock()
  const pex = new Extension(wire as unknown as Parameters<typeof Extension>[0])

  ;(pex as unknown as { _localDroppedPeers: Record<string, unknown> })._localDroppedPeers[peer] = {
    ip: 6,
  }
  ;(pex as unknown as { _sendMessage: () => void })._sendMessage()
})
