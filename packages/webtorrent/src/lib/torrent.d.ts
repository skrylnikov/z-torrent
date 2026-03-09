import { EventEmitter } from 'events'
import type Wire from 'bittorrent-protocol'
import type File from './file.js'
import type { SelectionItem } from './selections.js'
import type RarityMap from './rarity-map.js'
import type ChunkStore = require('chunk-store')

export interface TorrentOptions {
  infoHash?: string
  announce?: string[]
  getAnnounceOpts?: () => {
    numwant?: number
    uploaded?: number
    downloaded?: number
    left?: number
  }
  urlList?: string[]
  private?: boolean
  store?: typeof ChunkStore
  storeOpts?: Record<string, unknown>
  skipVerify?: boolean
  preloadedStore?: ChunkStore
  path?: string
  name?: string
  addUID?: boolean
  rootDir?: FileSystemDirectoryHandle
  maxWebConns?: number
  strategy?: 'sequential' | 'rarest'
}

export interface ParsedTorrent {
  infoHash: string
  infoHashBuffer: Buffer
  name: string
  announce?: string[]
  'announce-list'?: string[][]
  'url-list'?: string[]
  'created by'?: string
  'creation date'?: number
  comment?: string
  private?: boolean
  pieces: Buffer[]
  pieceLength: number
  lastPieceLength: number
  length: number
  files?: Array<{
    path: string
    name: string
    length: number
    offset: number
  }>
}

export default class Torrent extends EventEmitter {
  readonly client: any
  readonly infoHash: string
  readonly infoHashBuffer: Buffer
  readonly infoHashHash: string
  readonly name: string
  readonly timeRemaining: number
  readonly downloaded: number
  readonly uploaded: number
  readonly downloadSpeed: number
  readonly uploadSpeed: number
  readonly progress: number
  readonly ratio: number
  readonly length: number
  readonly pieceLength: number
  readonly lastPieceLength: number
  readonly pieces: Buffer[]
  readonly done: boolean
  readonly paused: boolean
  readonly ready: boolean
  readonly destroyed: boolean
  readonly wires: Wire[]
  readonly files: File[]
  readonly bitfield: { get(index: number): boolean }
  readonly store: ChunkStore
  readonly rarityMap: RarityMap
  readonly path: string | null
  readonly _selections: SelectionItem[]

  constructor(client: any, torrentId: string | Buffer | ParsedTorrent, opts?: TorrentOptions)

  _select(
    start: number,
    end: number,
    priority: number,
    notify?: (() => void) | null,
    isStreamSelection?: boolean
  ): void
  _deselect(start: number, end: number, isStreamSelection?: boolean): void
  critical(start: number, end: number): void

  pause(): void
  resume(): void
  destroy(cb?: (err?: Error) => void): void
  addPeer(peer: string | Wire): boolean
  removePeer(peer: string | Wire): void
  addWebSeed(url: string): void
  removeWebSeed(url: string): void
  select(start: number, end: number, priority?: number, notify?: () => void): void
  deselect(start: number, end: number): void

  on(event: 'ready', listener: () => void): this
  on(event: 'error', listener: (err: Error) => void): this
  on(event: 'warning', listener: (err: Error) => void): this
  on(event: 'download', listener: (bytes: number) => void): this
  on(event: 'upload', listener: (bytes: number) => void): this
  on(event: 'wire', listener: (wire: Wire) => void): this
  on(event: 'done', listener: () => void): this
  on(event: 'verified', listener: (index: number) => void): this
  on(event: string, listener: (...args: unknown[]) => void): this

  removeListener(event: string, listener: (...args: unknown[]) => void): this
}

export type { Torrent }
