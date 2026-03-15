import fixtures from 'webtorrent-fixtures'
import MemoryChunkStore from 'memory-chunk-store'
import { test, expect } from 'bun:test'
import WebTorrent from '../../dist/index.js'
import type { default as Torrent } from '../../src/lib/torrent.js'

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
    const client1 = new WebTorrent({ dht: false, tracker: false, lsd: false, utp: false })
    client1.on('error', (err) => {
      throw err
    })
    client1.on('warning', (err) => {
      throw err
    })

    const client2 = new WebTorrent({ dht: false, tracker: false, lsd: false, utp: false })
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

function assertSelectionsEquals(selections: any, expected: [number, number][]) {
  expect(selections.length).toBe(expected.length)
  const selectionItems = [...selections._items]
  selectionItems.sort((a: any, b: any) => a.from - b.from)
  expected.sort((a, b) => a[0] - b[0])

  for (let i = 0; i < expected.length; i++) {
    const actualRange = [selectionItems[i].from, selectionItems[i].to]
    const expectedRange = expected[i]
    expect(actualRange).toEqual(expectedRange)
  }
}

test('client.select: whole torrent', { timeout: 15000 }, async () => {
  await setupClient({
    onTorrent: (torrent) => {
      torrent.select(0, torrent.pieces.length - 1)
    },
    onIdle: (torrent) => {
      expect(torrent.pieces.filter((a) => a === null).length).toBe(torrent.pieces.length)
    },
  })
})

test('client.select: partial torrent', { timeout: 15000 }, async () => {
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

test('client.deselect: whole torrent', { timeout: 15000 }, async () => {
  await setupClient({
    onTorrent: (torrent) => {
      torrent.deselect(0, torrent.pieces.length - 1)
    },
    onIdle: (torrent) => {
      expect(torrent.pieces.filter((a) => a === null).length).toBe(0)
    },
  })
})

test('client.deselect: whole torrent - start as deselected', { timeout: 15000 }, async () => {
  await setupClient({
    onTorrent: () => {},
    addTorrentProps: { deselect: true },
    onIdle: (torrent) => {
      expect(torrent.pieces.filter((a) => a === null).length).toBe(0)
    },
  })
})

test('client.deselect: partial torrent - second half deselected', { timeout: 15000 }, async () => {
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
})

test('client.deselect: partial torrent - second half deselected (alt)', { timeout: 15000 }, async () => {
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
})

test('client.deselect: multiple overlapping ranges', { timeout: 15000 }, async () => {
  await setupClient({
    addTorrentProps: { deselect: true },
    onTorrent: (torrent) => {
      torrent.select(3, 10)
      torrent.select(5, 12)
      torrent.select(12, 18)
      torrent.select(15, 22)
      torrent.select(0, 4)
      expect(torrent._selections.length).toBe(1)
      assertSelectionsEquals(torrent._selections, [[0, 22]])

      torrent.deselect(4, 8)
      torrent.deselect(14, 17)
      torrent.deselect(20, 21)
      expect(torrent._selections.length).toBe(4)
      assertSelectionsEquals(torrent._selections, [
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
})
