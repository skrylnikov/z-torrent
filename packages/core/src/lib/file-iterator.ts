import debugFactory from 'debug'
import { EventEmitter } from 'eventemitter3'
import type { FileWire, TorrentWire } from './types.js'

const debug = debugFactory('@z-torrent/core:file-iterator')

export interface FileIteratorOptions {
  start: number
  end: number
}

export class FileIterator extends EventEmitter implements AsyncIterator<Uint8Array> {
  #torrent: TorrentWire
  readonly #pieceLength: number
  readonly #startPiece: number
  readonly #endPiece: number
  #piece: number
  #offset: number
  #missing: number
  readonly #criticalLength: number
  destroyed: boolean

  constructor(file: FileWire, { start, end }: FileIteratorOptions) {
    super()

    this.#torrent = file._torrent

    this.#pieceLength = file._torrent.pieceLength

    this.#startPiece = ((start + file.offset) / this.#pieceLength) | 0
    this.#endPiece = ((end + file.offset) / this.#pieceLength) | 0

    this.#piece = this.#startPiece
    this.#offset = start + file.offset - this.#startPiece * this.#pieceLength

    this.#missing = end - start + 1
    this.#criticalLength = Math.min(((1024 * 1024) / this.#pieceLength) | 0, 2)

    this.#torrent.selectStreamPieces(this.#startPiece, this.#endPiece)
    this.destroyed = false
  }

  [Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
    return this
  }

  next(): Promise<IteratorResult<Uint8Array>> {
    return new Promise((resolve) => {
      if (this.#missing === 0 || this.destroyed) {
        resolve({ done: true, value: undefined })
        this.destroy()
        return
      }

      const pump = (index: number, opts: { length: number; offset: number }): void => {
        const bf = this.#torrent.bitfield
        if (!bf || !bf.get(index)) {
          const listener = (...args: unknown[]): void => {
            const i = args[0] as number
            if (i === index || this.destroyed) {
              this.#torrent.removeListener('verified', listener)
              if (i === index) {
                pump(index, opts)
              } else {
                resolve({ done: true, value: undefined })
              }
            }
          }

          this.#torrent.on('verified', listener)
          this.#torrent.critical(index, index + this.#criticalLength)
          return
        }

        if (this.destroyed) {
          resolve({ done: true, value: undefined })
          return
        }

        const store = this.#torrent.store
        if (!store) {
          resolve({ done: true, value: undefined })
          return
        }

        store.get(index, opts, (err: Error | null, buffer?: Uint8Array) => {
          if (this.destroyed) {
            resolve({ done: true, value: undefined })
            return
          }
          debug('read %s and yielding (length %s) (err %s)', index, buffer?.length, err?.message)

          if (err) {
            this.destroy(undefined, err)
            resolve({ done: true, value: undefined })
            return
          }

          resolve({ value: buffer!, done: false })
        })
      }

      const length = Math.min(this.#missing, this.#pieceLength - this.#offset)

      pump(this.#piece++, { length, offset: this.#offset })
      this.#missing -= length
      this.#offset = 0
    })
  }

  async return(): Promise<IteratorResult<Uint8Array>> {
    this.destroy()
    return { done: true, value: undefined }
  }

  async throw(err: Error): Promise<IteratorResult<Uint8Array>> {
    throw err
  }

  destroy(cb?: (err?: Error) => void, err?: Error): void {
    if (this.destroyed) return
    this.destroyed = true
    if (!this.#torrent.destroyed) {
      this.#torrent.deselectStreamPieces(this.#startPiece, this.#endPiece)
    }
    this.emit('return')
    cb?.(err)
  }
}
