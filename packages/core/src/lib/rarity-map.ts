import Wire from '@z-torrent/protocol'
import type { TorrentWire } from './types.js'

export default class RarityMap {
  private _torrent: TorrentWire | null
  private readonly _numPieces: number
  private _pieces: number[] | null
  private _onWire: ((wire: Wire) => void) | null
  private _onWireHave: ((index: number) => void) | null
  private _onWireBitfield: (() => void) | null

  constructor(torrent: TorrentWire) {
    this._torrent = torrent
    this._numPieces = torrent.pieces.length
    this._pieces = new Array(this._numPieces)

    this._onWire = (wire: Wire) => {
      this.recalculate()
      this._initWire(wire)
    }
    this._onWireHave = (index: number) => {
      if (this._pieces) {
        this._pieces[index] += 1
      }
    }
    this._onWireBitfield = () => {
      this.recalculate()
    }

    this._torrent.wires.forEach((wire) => {
      this._initWire(wire)
    })
    this._torrent.on('wire', this._onWire)
    this.recalculate()
  }

  getRarestPiece(pieceFilterFunc?: (index: number) => boolean): number {
    if (!this._pieces) return -1

    let candidates: number[] = []
    let min = Infinity

    for (let i = 0; i < this._numPieces; ++i) {
      if (pieceFilterFunc && !pieceFilterFunc(i)) continue

      const availability = this._pieces[i]
      if (availability === min) {
        candidates.push(i)
      } else if (availability < min) {
        candidates = [i]
        min = availability
      }
    }

    if (candidates.length) {
      return candidates[(Math.random() * candidates.length) | 0]
    } else {
      return -1
    }
  }

  destroy(): void {
    if (!this._torrent) return
    this._torrent.removeListener('wire', this._onWire!)
    this._torrent.wires.forEach((wire) => {
      this._cleanupWireEvents(wire)
    })
    this._torrent = null
    this._pieces = null

    this._onWire = null
    this._onWireHave = null
    this._onWireBitfield = null
  }

  private _initWire(wire: Wire): void {
    ;(wire as any)._onClose = () => {
      this._cleanupWireEvents(wire)
      if (this._pieces) {
        for (let i = 0; i < this._numPieces; ++i) {
          this._pieces[i] -= wire.peerPieces.get(i)
        }
      }
    }

    wire.on('have', this._onWireHave!)
    wire.on('bitfield', this._onWireBitfield!)
    wire.once('close', (wire as any)._onClose)
  }

  recalculate(): void {
    if (!this._pieces || !this._torrent) return
    this._pieces.fill(0)

    for (const wire of this._torrent.wires) {
      for (let i = 0; i < this._numPieces; ++i) {
        this._pieces[i] += wire.peerPieces.get(i)
      }
    }
  }

  private _cleanupWireEvents(wire: Wire): void {
    if (this._onWireHave) wire.removeListener('have', this._onWireHave)
    if (this._onWireBitfield) wire.removeListener('bitfield', this._onWireBitfield)
    if ((wire as any)._onClose) wire.removeListener('close', (wire as any)._onClose)
    ;(wire as any)._onClose = null
  }
}
