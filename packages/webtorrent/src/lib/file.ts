import { EventEmitter } from 'events'
import { Readable } from 'streamx'
import { chunkStoreRead } from 'chunk-store-iterator'
import mime from 'mime/lite.js'
import FileIterator from './file-iterator.js'
import type Torrent from './torrent.js'

interface FileStreamOptions {
  start?: number
  end?: number
}

export interface FileMetadata {
  name: string
  path: string
  length: number
  offset: number
}

export default class File extends EventEmitter {
  _torrent: Torrent
  private _destroyed: boolean
  private _fileStreams: Set<Readable>
  private _iterators: Set<FileIterator>
  private readonly _startPiece: number
  private readonly _endPiece: number
  private readonly _client: any

  name: string
  path: string
  length: number
  size: number
  type: string
  offset: number
  done: boolean

  constructor(torrent: Torrent, file: FileMetadata) {
    super()

    this._torrent = torrent
    this._destroyed = false
    this._fileStreams = new Set()
    this._iterators = new Set()

    this.name = file.name
    this.path = file.path
    this.length = file.length
    this.size = file.length
    this.type = mime.getType(this.name) || 'application/octet-stream'
    this.offset = file.offset

    this.done = false

    const start = file.offset
    const end = start + file.length - 1

    this._startPiece = (start / this._torrent.pieceLength) | 0
    this._endPiece = (end / this._torrent.pieceLength) | 0

    if (this.length === 0) {
      this.done = true
      this.emit('done')
    }

    this._client = torrent.client
  }

  get downloaded(): number {
    if (this._destroyed || !this._torrent.bitfield) return 0

    const { pieces, bitfield, pieceLength, lastPieceLength } = this._torrent
    const { _startPiece: start, _endPiece: end } = this

    const getPieceLength = (pieceIndex: number): number =>
      pieceIndex === pieces.length - 1 ? lastPieceLength : pieceLength

    const getPieceDownloaded = (pieceIndex: number): number => {
      const len = pieceIndex === pieces.length - 1 ? lastPieceLength : pieceLength
      if (bitfield.get(pieceIndex)) {
        return len
      } else {
        return len - (pieces[pieceIndex] as any).missing
      }
    }

    let downloaded = 0
    for (let index = start; index <= end; index += 1) {
      const pieceDownloaded = getPieceDownloaded(index)
      downloaded += pieceDownloaded

      if (index === start) {
        const irrelevantFirstPieceBytes = this.offset % pieceLength
        downloaded -= Math.min(irrelevantFirstPieceBytes, pieceDownloaded)
      }

      if (index === end) {
        const irrelevantLastPieceBytes =
          getPieceLength(end) - ((this.offset + this.length) % pieceLength)
        downloaded -= Math.min(irrelevantLastPieceBytes, pieceDownloaded)
      }
    }

    return downloaded
  }

  get progress(): number {
    return this.length ? this.downloaded / this.length : 0
  }

  select(priority?: number): void {
    if (this.length === 0) return
    this._torrent.select(this._startPiece, this._endPiece, priority)
  }

  deselect(): void {
    if (this.length === 0) return
    this._torrent.deselect(this._startPiece, this._endPiece)
  }

  [Symbol.asyncIterator](opts?: FileStreamOptions): AsyncIterable<Uint8Array> {
    if (this.length === 0 || this._destroyed) {
      return (async function* empty(): AsyncGenerator<Uint8Array, void, unknown> {})()
    }

    const { start = 0 } = opts ?? {}
    const end = opts?.end && opts.end < this.length ? opts.end : this.length - 1

    if (this.done) {
      return chunkStoreRead(this._torrent.store, {
        offset: start + this.offset,
        length: end - start + 1,
      })
    }

    const iterator = new FileIterator(this, { start, end })
    this._iterators.add(iterator)
    iterator.once('return', () => {
      this._iterators.delete(iterator)
    })

    return iterator
  }

  createReadStream(opts?: FileStreamOptions): Readable {
    if (this._destroyed) throw new Error('File is destroyed')
    const iterator = this[Symbol.asyncIterator](opts)
    const fileStream = Readable.from(iterator)

    this._fileStreams.add(fileStream as any)
    fileStream.once('close', () => {
      this._fileStreams.delete(fileStream as any)
    })

    return fileStream
  }

  async arrayBuffer(opts: FileStreamOptions = {}): Promise<ArrayBuffer> {
    if (this._destroyed) throw new Error('File is destroyed')
    const { start = 0 } = opts
    const end = opts?.end && opts.end < this.length ? opts.end : this.length - 1

    const data = new Uint8Array(end - start + 1)
    let offset = 0
    for await (const chunk of this[Symbol.asyncIterator]({ start, end })) {
      data.set(chunk, offset)
      offset += chunk.length
    }
    return data.buffer
  }

  async blob(opts?: FileStreamOptions): Promise<Blob> {
    if (this._destroyed) throw new Error('File is destroyed')
    return new Blob([await this.arrayBuffer(opts)], { type: this.type })
  }

  stream(opts?: FileStreamOptions): ReadableStream<Uint8Array> {
    if (this._destroyed) throw new Error('File is destroyed')
    let iterator: AsyncIterator<Uint8Array> | undefined
    return new ReadableStream({
      start: () => {
        const asyncIterable = this[Symbol.asyncIterator](opts)
        iterator = asyncIterable as AsyncIterator<Uint8Array>
      },
      async pull(controller) {
        if (!iterator) return
        const { value, done } = await iterator.next()
        if (done) {
          controller.close()
        } else {
          controller.enqueue(value)
        }
      },
      cancel() {
        iterator?.return?.()
      },
    })
  }

  get streamURL(): string {
    if (!this._client._server) throw new Error('No server created')
    return `${this._client._server.pathname}/${this._torrent.infoHash}/${this.path}`
  }

  streamTo(elem: HTMLMediaElement): HTMLMediaElement {
    elem.src = this.streamURL
    return elem
  }

  includes(piece: number): boolean {
    return this._startPiece <= piece && this._endPiece >= piece
  }

  _destroy(): void {
    this._destroyed = true
    this._torrent = null as any

    for (const fileStream of this._fileStreams) {
      fileStream.destroy()
    }
    this._fileStreams.clear()
    for (const iterator of this._iterators) {
      iterator.destroy()
    }
    this._iterators.clear()
  }
}
