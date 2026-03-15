import { concat } from 'uint8-util'

const BLOCK_LENGTH = 1 << 14

export class Piece {
  static BLOCK_LENGTH = BLOCK_LENGTH

  length: number
  missing: number
  sources: unknown[] | null

  private _chunks: number
  private _remainder: number
  private _buffered: number
  private _buffer: Uint8Array[] | null
  private _cancellations: number[] | null
  private _reservations: number
  private _flushed: boolean

  constructor(length: number) {
    this.length = length
    this.missing = length
    this.sources = null

    this._chunks = Math.ceil(length / BLOCK_LENGTH)
    this._remainder = length % BLOCK_LENGTH || BLOCK_LENGTH
    this._buffered = 0
    this._buffer = null
    this._cancellations = null
    this._reservations = 0
    this._flushed = false
  }

  chunkLength(i: number): number {
    return i === this._chunks - 1 ? this._remainder : BLOCK_LENGTH
  }

  chunkLengthRemaining(i: number): number {
    return this.length - i * BLOCK_LENGTH
  }

  chunkOffset(i: number): number {
    return i * BLOCK_LENGTH
  }

  reserve(): number {
    if (!this.init()) return -1
    if (this._cancellations!.length) return this._cancellations!.pop()!
    if (this._reservations < this._chunks) return this._reservations++
    return -1
  }

  reserveRemaining(): number {
    if (!this.init()) return -1
    if (this._cancellations!.length || this._reservations < this._chunks) {
      let min = this._reservations
      while (this._cancellations!.length) {
        min = Math.min(min, this._cancellations!.pop()!)
      }
      this._reservations = this._chunks
      return min
    }
    return -1
  }

  cancel(i: number): void {
    if (!this.init()) return
    this._cancellations!.push(i)
  }

  cancelRemaining(i: number): void {
    if (!this.init()) return
    this._reservations = i
  }

  get(i: number): Uint8Array | null {
    if (!this.init()) return null
    return this._buffer![i] ?? null
  }

  set(i: number, data: Uint8Array, source: unknown): boolean {
    if (!this.init()) return false
    const len = data.length
    const blocks = Math.ceil(len / BLOCK_LENGTH)
    for (let j = 0; j < blocks; j++) {
      if (!this._buffer![i + j]) {
        const offset = j * BLOCK_LENGTH
        const splitData = data.subarray(offset, offset + BLOCK_LENGTH)
        this._buffered++
        this._buffer![i + j] = splitData
        this.missing -= splitData.length
        if (!this.sources!.includes(source)) {
          this.sources!.push(source)
        }
      }
    }
    return this._buffered === this._chunks
  }

  flush(): Uint8Array | null {
    if (!this._buffer || this._chunks !== this._buffered) return null
    const buffer = concat(this._buffer, this.length)
    this._buffer = null
    this._cancellations = null
    this.sources = null
    this._flushed = true
    return buffer
  }

  init(): boolean {
    if (this._flushed) return false
    if (this._buffer) return true
    this._buffer = new Array(this._chunks)
    this._cancellations = []
    this.sources = []
    return true
  }
}
