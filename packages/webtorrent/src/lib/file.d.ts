import { EventEmitter } from 'events'
import type { Stats } from 'fs'
import type FileIterator from './file-iterator.js'
import type Torrent from './torrent.js'

export interface FileOptions {
  length: number
  offset: number
  name: string
  path: string
}

export default class File extends EventEmitter {
  _torrent: Torrent
  name: string
  path: string
  length: number
  offset: number

  constructor(torrent: Torrent, options: FileOptions)

  get downloaded(): number
  get progress(): number
  get done(): boolean

  createReadStream(opts?: { start?: number; end?: number }): NodeJS.ReadableStream
  createWebStream(opts?: { start?: number; end?: number }): ReadableStream<Uint8Array>
  getIterator(opts?: { start?: number; end?: number }): FileIterator
  arrayBuffer(): Promise<ArrayBuffer>
  stream(): ReadableStream<Uint8Array>
  blob(): Promise<Blob>
  getBlobURL(): Promise<string>
  appendTo(elem: HTMLElement, opts?: { maxBlobLength?: number }): Promise<HTMLElement>
  renderTo(elem: HTMLElement, opts?: { maxBlobLength?: number }): Promise<HTMLElement>
  includes(pieceIndex: number): boolean
  select(priority?: number): void
  deselect(): void
  download(cb?: (err?: Error) => void): void
}

export type { File }
