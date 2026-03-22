import Wire from '@z-torrent/protocol'
import type { TorrentWire } from './types.js'

/** Wire extends streamx Duplex but uses BitTorrent event names; avoid strict StreamEvents from @types/streamx. */
type WireEventTarget = {
  on(event: string, fn: (...args: unknown[]) => void): void
  once(event: string, fn: (...args: unknown[]) => void): void
  removeListener(event: string, fn: (...args: unknown[]) => void): void
}

export class RarityMap {
  #torrent: TorrentWire | null
  readonly #numPieces: number
  #pieces: number[] | null
  #onWireBound: ((wire: Wire) => void) | null
  #onWireHave: ((index: number) => void) | null
  #onWireBitfield: (() => void) | null

  constructor(torrent: TorrentWire) {
    this.#torrent = torrent
    this.#numPieces = torrent.pieces.length
    this.#pieces = new Array(this.#numPieces).fill(0)

    this.#onWireBound = (wire: Wire) => {
      this.recalculate()
      this.#initWire(wire)
    }
    this.#onWireHave = (index: number) => {
      if (this.#pieces && index >= 0 && index < this.#numPieces) {
        this.#pieces[index] = (this.#pieces[index] ?? 0) + 1
      }
    }
    this.#onWireBitfield = () => {
      this.recalculate()
    }

    this.#torrent.wires.forEach((w) => {
      this.#initWire(w as Wire)
    })
    this.#torrent.on('wire', this.#onWireBound as (...args: unknown[]) => void)
    this.recalculate()
  }

  getRarestPiece(pieceFilterFunc?: (index: number) => boolean): number {
    if (!this.#pieces) return -1

    let candidates: number[] = []
    let min = Infinity

    for (let i = 0; i < this.#numPieces; ++i) {
      if (pieceFilterFunc && !pieceFilterFunc(i)) continue

      const availability = this.#pieces[i] ?? 0
      if (availability === min) {
        candidates.push(i)
      } else if (availability < min) {
        candidates = [i]
        min = availability
      }
    }

    if (candidates.length) {
      return candidates[(Math.random() * candidates.length) | 0]
    }
    return -1
  }

  destroy(): void {
    if (!this.#torrent) return
    this.#torrent.removeListener('wire', this.#onWireBound as (...args: unknown[]) => void)
    this.#torrent.wires.forEach((wire) => {
      this.#cleanupWireEvents(wire as Wire)
    })
    this.#torrent = null
    this.#pieces = null

    this.#onWireBound = null
    this.#onWireHave = null
    this.#onWireBitfield = null
  }

  #initWire(wire: Wire): void {
    const w = wire as any
    w._onClose = () => {
      this.#cleanupWireEvents(wire)
      if (this.#pieces) {
        for (let i = 0; i < this.#numPieces; ++i) {
          const has = wire.peerPieces?.get(i) ? 1 : 0
          this.#pieces[i] = Math.max(0, (this.#pieces[i] ?? 0) - has)
        }
      }
    }

    const streamWire = wire as unknown as WireEventTarget
    streamWire.on('have', this.#onWireHave as (...args: unknown[]) => void)
    streamWire.on('bitfield', this.#onWireBitfield as (...args: unknown[]) => void)
    streamWire.once('close', w._onClose)
  }

  recalculate(): void {
    if (!this.#pieces || !this.#torrent) return
    this.#pieces.fill(0)

    for (const wire of this.#torrent.wires) {
      const w = wire as Wire
      for (let i = 0; i < this.#numPieces; ++i) {
        this.#pieces[i] += w.peerPieces?.get(i) ? 1 : 0
      }
    }
  }

  #cleanupWireEvents(wire: Wire): void {
    const streamWire = wire as unknown as WireEventTarget
    if (this.#onWireHave) streamWire.removeListener('have', this.#onWireHave as (...args: unknown[]) => void)
    if (this.#onWireBitfield)
      streamWire.removeListener('bitfield', this.#onWireBitfield as (...args: unknown[]) => void)
    const w = wire as any
    if (w._onClose) streamWire.removeListener('close', w._onClose)
    w._onClose = null
  }
}
