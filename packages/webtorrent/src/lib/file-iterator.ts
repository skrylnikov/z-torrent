import debugFactory from 'debug'
import { EventEmitter } from 'events'
import type File from './file.js'
import type Torrent from './torrent.js'

const debug = debugFactory('webtorrent:file-iterator')

export interface FileIteratorOptions {
  start: number
  end: number
}

export default class FileIterator extends EventEmitter implements AsyncIterator<Uint8Array> {
  private _torrent: Torrent
  private readonly _pieceLength: number
  private readonly _startPiece: number
  private readonly _endPiece: number
  private _piece: number
  private _offset: number
  private _missing: number
  private readonly _criticalLength: number
  destroyed: boolean

  constructor(file: File, { start, end }: FileIteratorOptions) {
    super()

    this._torrent = file._torrent

    this._pieceLength = file._torrent.pieceLength

    this._startPiece = ((start + file.offset) / this._pieceLength) | 0
    this._endPiece = ((end + file.offset) / this._pieceLength) | 0

    this._piece = this._startPiece
    this._offset = start + file.offset - this._startPiece * this._pieceLength

    this._missing = end - start + 1
    this._criticalLength = Math.min(((1024 * 1024) / this._pieceLength) | 0, 2)

    this._torrent._select(this._startPiece, this._endPiece, 1, null, true)
    this.destroyed = false
  }

  [Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
    return this
  }

  next(): Promise<IteratorResult<Uint8Array>> {
    return new Promise((resolve) => {
      if (this._missing === 0 || this.destroyed) {
        resolve({ done: true, value: undefined })
        this.destroy()
        return
      }

      const pump = (index: number, opts: { length: number; offset: number }): void => {
        if (!this._torrent.bitfield.get(index)) {
          const listener = (i: number): void => {
            if (i === index || this.destroyed) {
              this._torrent.removeListener('verified', listener)
              if (i === index) {
                pump(index, opts)
              } else {
                resolve({ done: true, value: undefined })
              }
            }
          }

          this._torrent.on('verified', listener)
          this._torrent.critical(index, index + this._criticalLength)
          return
        }

        if (this.destroyed) {
          resolve({ done: true, value: undefined })
          return
        }

        this._torrent.store.get(index, opts, (err: Error | null, buffer?: Uint8Array) => {
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

      const length = Math.min(this._missing, this._pieceLength - this._offset)

      pump(this._piece++, { length, offset: this._offset })
      this._missing -= length
      this._offset = 0
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
    if (!this._torrent.destroyed) {
      this._torrent._deselect(this._startPiece, this._endPiece, true)
    }
    this.emit('return')
    cb?.(err)
  }
}
