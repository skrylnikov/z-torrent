// @ts-expect-error - no types available
import { fixtures } from '@z-torrent/fixtures'
import crypto from 'crypto'
import MemoryChunkStore from 'memory-chunk-store'
import { test, expect } from 'bun:test'
import Wire from '@z-torrent/protocol'
import { Torrent, RarityMap } from '@z-torrent/core'

test('Rarity map usage', async () => {
  const numPieces = 4
  const torrentId = Object.assign({}, fixtures.numbers.parsedTorrent, {
    pieces: Array(numPieces),
  })
  const client = {
    listening: true,
    peerId: crypto.randomBytes(20).toString('hex'),
    torrentPort: 6889,
    dht: false,
    tracker: false,
    lsd: false,
    removeTorrentFromClient() {},
    platform: {
      tmpDir: '/tmp',
      defaultStore: MemoryChunkStore as any,
      fsConcurrency: 2,
      utpSupport: false,
      idleCallback: null,
      createServer: () => ({ destroy: (cb: () => void) => cb?.() }),
      createDiscovery: () => ({
        on() {},
        destroy() {},
      }),
    },
  } as any
  const opts = {}
  const torrent = new Torrent(torrentId, client, opts)

  await new Promise<void>((resolve, reject) => {
    torrent.on('error', reject)
    torrent.on('metadata', () => {
      const wire1 = new Wire()
      const wire2 = new Wire()
      torrent.wires.push(wire1, wire2)
      torrent.emit('wire', wire1)
      torrent.emit('wire', wire2)

      const rarityMap = new RarityMap(torrent)

      function validateInitial() {
        let piece = rarityMap.getRarestPiece()
        expect(piece >= 0 && piece < numPieces).toBeTruthy()

        piece = rarityMap.getRarestPiece()
        expect(piece >= 0 && piece < numPieces).toBeTruthy()

        piece = rarityMap.getRarestPiece()
        expect(piece >= 0 && piece < numPieces).toBeTruthy()

        piece = rarityMap.getRarestPiece()
        expect(piece >= 0 && piece < numPieces).toBeTruthy()
      }

      validateInitial()
      rarityMap.recalculate()
      validateInitial()

      function setPiece(wire: any, index: number) {
        wire.peerPieces.set(index)
        wire.emit('have', index)
      }

      function addWire() {
        const wire = new Wire()
        wire.peerPieces.set(1)
        wire.peerPieces.set(2)
        torrent.wires.push(wire)
        torrent.emit('wire', wire)
      }

      function removeWire(index: number) {
        const wire = torrent.wires.splice(index, 1)[0]
        wire.destroy()
      }

      setPiece(torrent.wires[0], 0)
      setPiece(torrent.wires[1], 0)

      setPiece(torrent.wires[0], 1)
      setPiece(torrent.wires[1], 3)

      let piece = rarityMap.getRarestPiece()
      expect(piece).toBe(2)

      rarityMap.recalculate()
      piece = rarityMap.getRarestPiece()
      expect(piece).toBe(2)

      addWire()
      addWire()

      piece = rarityMap.getRarestPiece()
      expect(piece).toBe(3)

      rarityMap.recalculate()
      piece = rarityMap.getRarestPiece()
      expect(piece).toBe(3)

      removeWire(3)
      removeWire(1)

      piece = rarityMap.getRarestPiece()
      expect(piece).toBe(3)

      rarityMap.recalculate()
      piece = rarityMap.getRarestPiece()
      expect(piece).toBe(3)

      piece = rarityMap.getRarestPiece((i) => i <= 1)
      expect(piece).toBe(0)

      piece = rarityMap.getRarestPiece((i) => i === 1 || i === 2)
      expect(piece).toBe(2)

      torrent.wires.forEach((wire) => {
        wire.destroy()
      })
      torrent.destroy()
      resolve()
    })
  })
})
