import { expect, test } from 'bun:test'
import Protocol from '@z-torrent/protocol'

test('hashRequest throws if v2 not negotiated on handshake', () => {
  const wire = new Protocol()
  wire.handshake(
    Buffer.from('01234567890123456789'),
    Buffer.from('12345678901234567890')
  )
  const root = new Uint8Array(32)
  expect(() => wire.hashRequest(root, 0, 0, 1, 0)).toThrow(/v2 support/)
})

test('hash_request round-trip over piped wires', () => {
  return new Promise<void>((resolve, reject) => {
    const a = new Protocol()
    const b = new Protocol()
    a.pipe(b).pipe(a)

    a.on('error', reject)
    b.on('error', reject)

    const root = new Uint8Array(32)
    root.fill(7)

    b.on('hash_request', (p) => {
      expect(p.piecesRoot).toEqual(root)
      expect(p.baseLayer).toBe(2)
      expect(p.index).toBe(3)
      expect(p.length).toBe(4)
      expect(p.proofLayers).toBe(5)
      resolve()
    })

    a.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'), {
      v2: true,
    })
    b.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'), {
      v2: true,
    })

    queueMicrotask(() => {
      a.hashRequest(root, 2, 3, 4, 5)
    })
  })
})

test('hashes message carries hash payload', () => {
  return new Promise<void>((resolve, reject) => {
    const a = new Protocol()
    const b = new Protocol()
    a.pipe(b).pipe(a)

    a.on('error', reject)
    b.on('error', reject)

    const root = new Uint8Array(32)
    root.fill(9)
    const payload = new Uint8Array([1, 2, 3, 4])

    b.on('hashes', (p, hashes) => {
      expect(p.piecesRoot).toEqual(root)
      expect(p.baseLayer).toBe(0)
      expect(p.index).toBe(1)
      expect(p.length).toBe(2)
      expect(p.proofLayers).toBe(3)
      expect(hashes).toEqual(payload)
      resolve()
    })

    a.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'), {
      v2: true,
    })
    b.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'), {
      v2: true,
    })

    queueMicrotask(() => {
      a.hashes(root, 0, 1, 2, 3, payload)
    })
  })
})

test('hashReject round-trip', () => {
  return new Promise<void>((resolve, reject) => {
    const a = new Protocol()
    const b = new Protocol()
    a.pipe(b).pipe(a)

    a.on('error', reject)
    b.on('error', reject)

    const root = new Uint8Array(32)
    root.fill(3)

    b.on('hash_reject', (p) => {
      expect(p.piecesRoot).toEqual(root)
      expect(p.baseLayer).toBe(8)
      expect(p.index).toBe(7)
      expect(p.length).toBe(6)
      expect(p.proofLayers).toBe(1)
      resolve()
    })

    a.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'), {
      v2: true,
    })
    b.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'), {
      v2: true,
    })

    queueMicrotask(() => {
      a.hashReject(root, 8, 7, 6, 1)
    })
  })
})
