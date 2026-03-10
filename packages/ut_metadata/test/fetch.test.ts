import fixtures from 'webtorrent-fixtures'
import bencode from 'bencode'
import queueMicrotask from 'queue-microtask'
import Protocol from 'bittorrent-protocol'
import { expect, test } from 'bun:test'
import utMetadata from '../dist/index.js'

const { leavesMetadata, sintel } = fixtures

const id1 = Buffer.from('01234567890123456789')
const id2 = Buffer.from('12345678901234567890')

test('fetch()', (done) => {

  const wire1 = new Protocol()
  const wire2 = new Protocol()
  wire1.pipe(wire2).pipe(wire1)

  wire1.use(utMetadata(leavesMetadata.torrent))
  wire2.use(utMetadata())

  wire2.ut_metadata!.fetch()

  wire2.ut_metadata!.on('metadata', (_metadata: Buffer) => {
    expect(_metadata.toString('hex')).toBe(
      bencode
        .encode({
          info: bencode.decode(leavesMetadata.torrent).info,
        })
        .toString('hex')
    )
    done()
  })

  wire2.on('handshake', (infoHash: Buffer, peerId: Buffer, extensions: Record<string, number>) => {
    wire2.handshake(leavesMetadata.parsedTorrent!.infoHash, id2)
  })

  wire2.on('extended', (ext: string) => {
    if (ext === 'handshake') {
      expect(true).toBe(true)
    } else if (ext === 'ut_metadata') {
      expect(true).toBe(true)
    }
  })

  wire1.handshake(leavesMetadata.parsedTorrent!.infoHash, id1)
})

test('fetch() from peer without metadata', (done) => {
  expect.assertions(2)

  const wire1 = new Protocol()
  const wire2 = new Protocol()
  wire1.pipe(wire2).pipe(wire1)

  wire1.use(utMetadata())
  wire2.use(utMetadata())

  wire2.ut_metadata!.fetch()

  wire2.ut_metadata!.on('metadata', () => {
    throw new Error('No "metadata" event should fire')
  })
  ;(wire1.ut_metadata as any).onMessage = () => {
    throw new Error('No messages should be sent to wire1')
  }

  wire2.ut_metadata!.on('warning', () => {
    expect(true).toBe(true)
  })

  wire2.on('handshake', () => {
    wire2.handshake(leavesMetadata.parsedTorrent!.infoHash, id2)
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

  wire1.handshake(leavesMetadata.parsedTorrent!.infoHash, id1)
})

test('fetch when peer gets metadata later (setMetadata)', (done) => {

  const wire1 = new Protocol()
  const wire2 = new Protocol()

  wire1.pipe(wire2).pipe(wire1)

  wire1.use(utMetadata())

  queueMicrotask(() => {
    wire1.ut_metadata!.setMetadata(leavesMetadata.torrent)

    queueMicrotask(() => {
      wire2.use(utMetadata())
      wire2.ut_metadata!.fetch()

      wire2.ut_metadata!.on('metadata', (_metadata: Buffer) => {
        expect(_metadata.toString('hex')).toBe(
          bencode
            .encode({
              info: bencode.decode(leavesMetadata.torrent).info,
            })
            .toString('hex')
        )
        done()
      })

      wire2.on('handshake', () => {
        wire2.handshake(leavesMetadata.parsedTorrent!.infoHash, id2)
      })

      wire2.on('extended', (ext: string) => {
        if (ext === 'handshake') {
          expect(true).toBe(true)
        } else if (ext === 'ut_metadata') {
          expect(true).toBe(true)
        }
      })

      wire1.handshake(leavesMetadata.parsedTorrent!.infoHash, id1)
    })
  })
})

test('fetch() large torrent', (done) => {

  const wire1 = new Protocol()
  const wire2 = new Protocol()
  wire1.pipe(wire2).pipe(wire1)

  wire1.use(utMetadata(sintel.torrent))
  wire2.use(utMetadata())

  wire2.ut_metadata!.fetch()

  wire2.ut_metadata!.on('metadata', (_metadata: Buffer) => {
    expect(_metadata.toString('hex')).toBe(
      bencode
        .encode({
          info: bencode.decode(sintel.torrent).info,
        })
        .toString('hex')
    )
    done()
  })

  wire2.on('handshake', () => {
    wire2.handshake(sintel.parsedTorrent!.infoHash, id2)
  })

  wire2.on('extended', (ext: string) => {
    if (ext === 'handshake') {
      expect(true).toBe(true)
    } else if (ext === 'ut_metadata') {
      expect(true).toBe(true)
    }
  })

  wire1.handshake(sintel.parsedTorrent!.infoHash, id1)
})

test('discard invalid metadata', (done) => {
  expect.assertions(1)

  const wire1 = new Protocol()
  const wire2 = new Protocol()
  wire1.pipe(wire2).pipe(wire1)

  const invalidMetadata = leavesMetadata.torrent.slice(0)
  invalidMetadata[55] = 65

  wire1.use(utMetadata(invalidMetadata))
  wire2.use(utMetadata())

  wire2.ut_metadata!.fetch()

  wire2.ut_metadata!.on('metadata', () => {
    throw new Error('No "metadata" event should fire')
  })

  wire2.ut_metadata!.on('warning', () => {
    expect(true).toBe(true)
    done()
  })

  wire2.on('handshake', () => {
    wire2.handshake(leavesMetadata.parsedTorrent!.infoHash, id2)
  })

  wire1.handshake(leavesMetadata.parsedTorrent!.infoHash, id1)
})

test.skip('stop receiving data after cancel', (done) => {
  // Flaky: metadata may arrive before cancel takes effect

  const wire1 = new Protocol()
  const wire2 = new Protocol()

  wire1.pipe(wire2).pipe(wire1)

  wire1.use(utMetadata(sintel.torrent))
  wire2.use(utMetadata())

  let metadataReceived = false
  wire2.ut_metadata!.once('metadata', () => {
    metadataReceived = true
  })

  wire2.once('handshake', () => {
    wire2.handshake(sintel.parsedTorrent!.infoHash, id2)
    wire2.ut_metadata!.fetch()
  })

  wire2.on('extended', (ext: string) => {
    if (ext === 'ut_metadata') {
      wire2.ut_metadata!.cancel()
    }
  })

  wire1.handshake(sintel.parsedTorrent!.infoHash, id1)

  setTimeout(() => {
    expect(metadataReceived).toBe(false)
    done()
  }, 100)
})
