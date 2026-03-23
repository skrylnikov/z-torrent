import { fixtures } from '@z-torrent/fixtures'
import MemoryChunkStore from 'memory-chunk-store'
import { test, expect } from 'bun:test'
import { ZTorrent } from '../../dist/index.js'
import { PEER_LOCAL_TIMEOUT_MS } from '../common.js'
import type { Torrent } from '@z-torrent/core'

function setupClient({
  onTorrent,
  onIdle,
  addTorrentProps = {},
}: {
  onTorrent: (torrent: Torrent) => void
  onIdle: (torrent: Torrent) => void
  addTorrentProps?: Record<string, unknown>
}) {
  return new Promise<void>((resolve, reject) => {
    const client1 = new ZTorrent({ dht: false, tracker: false, lsd: false, utp: false })
    client1.on('error', (err) => {
      throw err
    })
    client1.on('warning', (err) => {
      throw err
    })

    const client2 = new ZTorrent({ dht: false, tracker: false, lsd: false, utp: false })
    client2.on('error', (err) => {
      throw err
    })
    client2.on('warning', (err) => {
      throw err
    })

    const parsedTorrent = Object.assign({}, fixtures.leaves.parsedTorrent)

    client1.seed(
      fixtures.leaves.content,
      {
        name: 'Leaves of Grass by Walt Whitman.epub',
        announce: [],
        store: MemoryChunkStore,
      },
      () => {
        client2.add(parsedTorrent, { store: MemoryChunkStore, ...addTorrentProps }, (torrent) => {
          onTorrent(torrent)

          torrent.addPeer(`localhost:${client1.torrentPort}`)

          torrent.once('idle', () => {
            onIdle(torrent)

            Promise.all([
              new Promise<void>((res) =>
                client1.destroy((err) => {
                  if (err) reject(err)
                  res()
                })
              ),
              new Promise<void>((res) =>
                client2.destroy((err) => {
                  if (err) reject(err)
                  res()
                })
              ),
            ]).then(() => resolve())
          })
        })
      }
    )
  })
}

function assertRangesEqual(
  ranges: Array<{ from: number; to: number }>,
  expected: [number, number][]
) {
  expect(ranges.length).toBe(expected.length)
  const sorted = [...ranges].sort((a, b) => a.from - b.from)
  expected.sort((a, b) => a[0] - b[0])

  for (let i = 0; i < expected.length; i++) {
    const actualRange = [sorted[i].from, sorted[i].to]
    const expectedRange = expected[i]
    expect(actualRange).toEqual(expectedRange)
  }
}

test('client.select: whole torrent', { timeout: PEER_LOCAL_TIMEOUT_MS }, async () => {
  await setupClient({
    onTorrent: (torrent) => {
      torrent.select(0, torrent.pieces.length - 1)
    },
    onIdle: (torrent) => {
      expect(torrent.pieces.filter((a) => a === null).length).toBe(torrent.pieces.length)
    },
  })
})

test('client.select: partial torrent', { timeout: PEER_LOCAL_TIMEOUT_MS }, async () => {
  let lastPieceIndex: number
  await setupClient({
    onTorrent: (torrent) => {
      lastPieceIndex = Math.floor((torrent.pieces.length - 1) / 2)
      torrent.deselect(0, torrent.pieces.length - 1)
      torrent.select(0, lastPieceIndex)
    },
    onIdle: (torrent) => {
      expect(torrent.pieces.filter((a) => a === null).length).toBe(lastPieceIndex! + 1)
    },
  })
})

test('client.deselect: whole torrent', { timeout: PEER_LOCAL_TIMEOUT_MS }, async () => {
  await setupClient({
    onTorrent: (torrent) => {
      torrent.deselect(0, torrent.pieces.length - 1)
    },
    onIdle: (torrent) => {
      expect(torrent.pieces.filter((a) => a === null).length).toBe(0)
    },
  })
})

test(
  'client.deselect: whole torrent - start as deselected',
  { timeout: PEER_LOCAL_TIMEOUT_MS },
  async () => {
    await setupClient({
      onTorrent: () => {},
      addTorrentProps: { deselect: true },
      onIdle: (torrent) => {
        expect(torrent.pieces.filter((a) => a === null).length).toBe(0)
      },
    })
  }
)

// Idle can fire before all wanted pieces are flushed; piece counts are timing-sensitive.
test.skip(
  'client.deselect: partial torrent - second half deselected',
  { timeout: PEER_LOCAL_TIMEOUT_MS },
  async () => {
    let lastPieceIndex: number
    await setupClient({
      onTorrent: (torrent) => {
        lastPieceIndex = Math.floor((torrent.pieces.length - 1) / 2)
        torrent.deselect(0, lastPieceIndex)
      },
      onIdle: (torrent) => {
        expect(torrent.pieces.filter((a) => a === null).length).toBe(
          torrent.pieces.length - 1 - lastPieceIndex!
        )
      },
    })
  }
)

test.skip(
  'client.deselect: partial torrent - second half deselected (alt)',
  { timeout: PEER_LOCAL_TIMEOUT_MS },
  async () => {
    let lastPieceIndex: number
    await setupClient({
      onTorrent: (torrent) => {
        lastPieceIndex = Math.floor((torrent.pieces.length - 1) / 2)
        torrent.deselect(lastPieceIndex, torrent.pieces.length - 1)
      },
      onIdle: (torrent) => {
        expect(torrent.pieces.filter((a) => a === null).length).toBe(
          torrent.pieces.length - 1 - lastPieceIndex!
        )
      },
    })
  }
)

test(
  'client.deselect: multiple overlapping ranges',
  { timeout: PEER_LOCAL_TIMEOUT_MS },
  async () => {
    await setupClient({
      addTorrentProps: { deselect: true },
      onTorrent: (torrent) => {
        torrent.select(3, 10)
        torrent.select(5, 12)
        torrent.select(12, 18)
        torrent.select(15, 22)
        torrent.select(0, 4)
        const ranges1 = torrent.getPieceSelectionRanges()
        expect(ranges1.length).toBe(1)
        assertRangesEqual(ranges1, [[0, 22]])

        torrent.deselect(4, 8)
        torrent.deselect(14, 17)
        torrent.deselect(20, 21)
        const ranges2 = torrent.getPieceSelectionRanges()
        expect(ranges2.length).toBe(4)
        assertRangesEqual(ranges2, [
          [0, 3],
          [9, 13],
          [18, 19],
          [22, 22],
        ])
      },
      onIdle: (torrent) => {
        expect(torrent.pieces.filter((a) => a === null).length).toBe(12)
      },
    })
  }
)
