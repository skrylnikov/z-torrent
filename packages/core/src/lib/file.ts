import { EventEmitter } from 'eventemitter3'
import { chunkStoreRead } from 'chunk-store-iterator'
import { resolveTorrentFileMime } from '@z-torrent/utils/streaming-mime'
import mime from 'mime/lite.js'
import { FileIterator } from './file-iterator.js'
import type { FileWire, TorrentForFile } from './types.js'

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

export class File extends EventEmitter implements FileWire {
  _torrent: TorrentForFile
  private _destroyed: boolean
  private _iterators: Set<FileIterator>
  private readonly _startPiece: number
  private readonly _endPiece: number
  private readonly _client: unknown

  name: string
  path: string
  length: number
  size: number
  type: string
  offset: number
  done: boolean

  constructor(torrent: TorrentForFile, file: FileMetadata) {
    super()

    this._torrent = torrent
    this._destroyed = false
    this._iterators = new Set()

    this.name = file.name
    this.path = file.path
    this.length = file.length
    this.size = file.length
    this.type = resolveTorrentFileMime(this.name, mime.getType(this.name))
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
      return chunkStoreRead(this._torrent.store as Parameters<typeof chunkStoreRead>[0], {
        offset: start + this.offset,
        length: end - start + 1,
      }) as AsyncIterable<Uint8Array>
    }

    const iterator = new FileIterator(this, { start, end })
    this._iterators.add(iterator)
    iterator.once('return', () => {
      this._iterators.delete(iterator)
    })

    return iterator
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
    return new Blob([await this.arrayBuffer(opts ?? {})], { type: this.type })
  }

  stream(opts?: FileStreamOptions): ReadableStream<Uint8Array> {
    if (this._destroyed) throw new Error('File is destroyed')
    let iterator: AsyncIterator<Uint8Array> | undefined
    return new ReadableStream({
      start: () => {
        const it = this[Symbol.asyncIterator](opts) as unknown
        iterator =
          typeof (it as AsyncIterator<Uint8Array>).next === 'function'
            ? (it as AsyncIterator<Uint8Array>)
            : (it as AsyncIterable<Uint8Array>)[Symbol.asyncIterator]()
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
    const hs = this._torrent.client.httpServer
    if (!hs) throw new Error('No server created')
    const path = this.path.replace(/\\/g, '/')
    return `${hs.pathname}/${this._torrent.infoHash}/${path}`
  }

  /** Browser: stream file to media element (video/audio). Requires createServer. */
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

    for (const iterator of this._iterators) {
      iterator.destroy()
    }
    this._iterators.clear()
  }
}
