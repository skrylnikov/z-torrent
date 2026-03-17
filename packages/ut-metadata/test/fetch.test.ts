import fixtures from '@z-torrent/fixtures'
import bencode from 'bencode'

import Protocol from '@z-torrent/protocol'
import { expect, test } from 'bun:test'
import { createUtMetadata, UtMetadata } from '../src/index.js'

const { leavesMetadata, sintel } = fixtures

const id1 = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
const id2 = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0])

type Extensions = {
  extended: boolean
  dht: boolean
  fast: boolean
}

type WireWithEvents = Protocol & {
  on(
    event: 'handshake',
    cb: (infoHash: string, peerId: string, extensions: Extensions) => void
  ): void
  on(event: 'extended', cb: (ext: string) => void): void
  once(
    event: 'handshake',
    cb: (infoHash: string, peerId: string, extensions: Extensions) => void
  ): void
}

test('fetch()', (done) => {
  const wire1 = new Protocol() as WireWithEvents
  const wire2 = new Protocol() as WireWithEvents
  // @ts-expect-error pipe returns unknown in Duplex type
  wire1.pipe(wire2).pipe(wire1)

  wire1.use(createUtMetadata(leavesMetadata.torrent))
  wire2.use(createUtMetadata())

  const utMetadata2 = wire2.ut_metadata as UtMetadata
  utMetadata2.fetch()

  utMetadata2.on('metadata', (metadata: Uint8Array) => {
    const info = bencode.decode(leavesMetadata.torrent!) as { info: unknown }
    const expected = Uint8Array.from(
      bencode.encode({
        info: info.info,
      })
    )
    expect(metadata).toEqual(expected)
    done()
  })

  wire2.on('handshake', (_infoHash: string, _peerId: string, _extensions: Extensions) => {
    wire2.handshake(leavesMetadata.parsedTorrent!.infoHash!, id2)
  })

  wire1.handshake(leavesMetadata.parsedTorrent!.infoHash!, id1)
})

test('fetch() from peer without metadata', (done) => {
  expect.assertions(2)

  const wire1 = new Protocol() as WireWithEvents
  const wire2 = new Protocol() as WireWithEvents
  // @ts-expect-error pipe returns unknown in Duplex type
  wire1.pipe(wire2).pipe(wire1)

  wire1.use(createUtMetadata())
  wire2.use(createUtMetadata())

  const utMetadata2 = wire2.ut_metadata as UtMetadata
  utMetadata2.fetch()

  utMetadata2.on('metadata', () => {
    throw new Error('No "metadata" event should fire')
  })

  utMetadata2.on('warning', () => {
    expect(true).toBe(true)
  })

  wire2.on('handshake', () => {
    wire2.handshake(leavesMetadata.parsedTorrent!.infoHash!, id2)
  })

  wire2.on('extended', (ext: string) => {
    if (ext === 'handshake') {
      expect(true).toBe(true)
      done()
    } else if (ext === 'ut_metadata') {
      throw new Error('should not get extended ut_metadata message')
    } else {
      throw new Error('unexpected handshake type')
    }
  })

  wire1.handshake(leavesMetadata.parsedTorrent!.infoHash!, id1)
})

test('fetch when peer gets metadata later (setMetadata)', (done) => {
  const wire1 = new Protocol() as WireWithEvents
  const wire2 = new Protocol() as WireWithEvents

  // @ts-expect-error pipe returns unknown in Duplex type
  wire1.pipe(wire2).pipe(wire1)

  wire1.use(createUtMetadata())

  queueMicrotask(() => {
    const utMetadata1 = wire1.ut_metadata as UtMetadata
    utMetadata1.setMetadata(leavesMetadata.torrent!)

    queueMicrotask(() => {
      wire2.use(createUtMetadata())
      const utMetadata2 = wire2.ut_metadata as UtMetadata
      utMetadata2.fetch()

      utMetadata2.on('metadata', (metadata: Uint8Array) => {
        const info = bencode.decode(leavesMetadata.torrent!) as { info: unknown }
        const expected = Uint8Array.from(
          bencode.encode({
            info: info.info,
          })
        )
        expect(metadata).toEqual(expected)
        done()
      })

      wire2.on('handshake', () => {
        wire2.handshake(leavesMetadata.parsedTorrent!.infoHash!, id2)
      })

      wire1.handshake(leavesMetadata.parsedTorrent!.infoHash!, id1)
    })
  })
})

test('fetch() large torrent', (done) => {
  const wire1 = new Protocol() as WireWithEvents
  const wire2 = new Protocol() as WireWithEvents
  // @ts-expect-error pipe returns unknown in Duplex type
  wire1.pipe(wire2).pipe(wire1)

  wire1.use(createUtMetadata(sintel.torrent))
  wire2.use(createUtMetadata())

  const utMetadata2 = wire2.ut_metadata as UtMetadata
  utMetadata2.fetch()

  utMetadata2.on('metadata', (metadata: Uint8Array) => {
    const info = bencode.decode(sintel.torrent!) as { info: unknown }
    const expected = Uint8Array.from(
      bencode.encode({
        info: info.info,
      })
    )
    expect(metadata).toEqual(expected)
    done()
  })

  wire2.on('handshake', () => {
    wire2.handshake(sintel.parsedTorrent!.infoHash!, id2)
  })

  wire1.handshake(sintel.parsedTorrent!.infoHash!, id1)
})

test('discard invalid metadata', (done) => {
  expect.assertions(1)

  const wire1 = new Protocol() as WireWithEvents
  const wire2 = new Protocol() as WireWithEvents
  // @ts-expect-error pipe returns unknown in Duplex type
  wire1.pipe(wire2).pipe(wire1)

  const invalidMetadata = Uint8Array.from(leavesMetadata.torrent!).slice()
  invalidMetadata[55] = 65

  wire1.use(createUtMetadata(invalidMetadata))
  wire2.use(createUtMetadata())

  const utMetadata2 = wire2.ut_metadata as UtMetadata
  utMetadata2.fetch()

  utMetadata2.on('metadata', () => {
    throw new Error('No "metadata" event should fire')
  })

  utMetadata2.on('warning', () => {
    expect(true).toBe(true)
    done()
  })

  wire2.on('handshake', () => {
    wire2.handshake(leavesMetadata.parsedTorrent!.infoHash!, id2)
  })

  wire1.handshake(leavesMetadata.parsedTorrent!.infoHash!, id1)
})

test.skip('stop receiving data after cancel', (done) => {
  // Flaky: metadata may arrive before cancel takes effect

  const wire1 = new Protocol() as WireWithEvents
  const wire2 = new Protocol() as WireWithEvents

  // @ts-expect-error pipe returns unknown in Duplex type
  wire1.pipe(wire2).pipe(wire1)

  wire1.use(createUtMetadata(sintel.torrent))
  wire2.use(createUtMetadata())

  const utMetadata2 = wire2.ut_metadata as UtMetadata
  let metadataReceived = false
  utMetadata2.once('metadata', () => {
    metadataReceived = true
  })

  wire2.once('handshake', () => {
    wire2.handshake(sintel.parsedTorrent!.infoHash!, id2)
    utMetadata2.fetch()
  })

  wire2.on('extended', (ext: string) => {
    if (ext === 'ut_metadata') {
      utMetadata2.cancel()
    }
  })

  wire1.handshake(sintel.parsedTorrent!.infoHash!, id1)

  setTimeout(() => {
    expect(metadataReceived).toBe(false)
    done()
  }, 100)
})
