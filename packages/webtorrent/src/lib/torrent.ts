import { EventEmitter } from 'events'
import fs from 'fs'
import net from 'net'
import os from 'os'
import path from 'path'
import addrToIPPort from 'addr-to-ip-port'
import BitField from 'bitfield'
import CacheChunkStore from 'cache-chunk-store'
import { chunkStoreWrite } from 'chunk-store-iterator'
import cpus from 'cpus'
import debugFactory from 'debug'
import Discovery from 'torrent-discovery'
import FSChunkStore from 'fs-chunk-store'
import fetch from 'cross-fetch-ponyfill'
import ImmediateChunkStore from 'immediate-chunk-store'
import ltDontHave from 'lt_donthave'
import MemoryChunkStore from 'memory-chunk-store'
import joinIterator from 'join-async-iterator'
import parallel from 'run-parallel'
import parallelLimit from 'run-parallel-limit'
import parseTorrent, { toMagnetURI, toTorrentFile, remote } from 'parse-torrent'
import Piece from 'torrent-piece'
import queueMicrotask from 'queue-microtask'
import randomIterate from 'random-iterate'
import { hash, arr2hex } from 'uint8-util'
import throughput from 'throughput'
import utMetadata from 'ut_metadata'
import utPex from 'ut_pex'

import File from './file.js'
import Peer from './peer.js'
import RarityMap from './rarity-map.js'
import WebConn from './webconn.js'
import { Selections } from './selections.js'
import type { WebTorrent } from '../../index.js'

import VERSION from '../../version.cjs'

const debug = debugFactory('webtorrent:torrent')
const MAX_BLOCK_LENGTH = 128 * 1024
const PIECE_TIMEOUT = 30_000
const CHOKE_TIMEOUT = 5_000
const SPEED_THRESHOLD = 3 * Piece.BLOCK_LENGTH

const PIPELINE_MIN_DURATION = 0.5
const PIPELINE_MAX_DURATION = 1

const RECHOKE_INTERVAL = 10_000
const RECHOKE_OPTIMISTIC_DURATION = 2

const DEFAULT_NO_PEERS_INTERVAL = 30_000

const FILESYSTEM_CONCURRENCY = typeof window !== 'undefined' ? cpus().length : 2

const RECONNECT_WAIT = [1_000, 5_000, 15_000]

const USER_AGENT = `Z-Torrent/${VERSION} (https://github.com/webtorrent/webtorrent)`

const SUPPORTS_FSA =
  (globalThis as any).navigator?.storage?.getDirectory &&
  (globalThis as any).FileSystemFileHandle?.prototype?.createWritable

const FALLBACK_STORE =
  typeof window === 'undefined' || SUPPORTS_FSA ? FSChunkStore : MemoryChunkStore

let TMP: string
try {
  TMP = path.join(fs.statSync('/tmp') && '/tmp', 'z-torrent')
} catch (err) {
  TMP = path.join(typeof os.tmpdir === 'function' ? os.tmpdir() : '/', 'z-torrent')
}

const IDLE_CALLBACK =
  typeof window !== 'undefined' &&
  typeof (window as any).requestIdleCallback === 'function' &&
  (window as any).requestIdleCallback

export interface TorrentOpts {
  announce?: string[]
  urlList?: string[]
  path?: string
  addUID?: boolean
  rootDir?: FileSystemDirectoryHandle | null
  skipVerify?: boolean
  bitfield?: Uint8Array | ArrayLike<number>
  store?: any
  preloadedStore?: any
  storeCacheSlots?: number
  destroyStoreOnDestroy?: boolean
  storeOpts?: Record<string, unknown>
  alwaysChokeSeeders?: boolean
  getAnnounceOpts?: () => Record<string, unknown>
  private?: boolean
  strategy?: 'rarest' | 'sequential'
  maxWebConns?: number
  uploads?: number | false
  noPeersIntervalTime?: number
  deselect?: boolean
  paused?: boolean
  fileModtimes?: number[]
}

export interface ParsedTorrent {
  infoHash: string
  infoHashBuffer: Buffer
  info?: Record<string, unknown>
  name: string
  announce?: string[]
  'announce-list'?: string[][]
  'url-list'?: string[]
  urlList?: string[]
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
  xs?: string | string[]
}

export default class Torrent extends EventEmitter {
  private _debugId: string
  client: WebTorrent
  announce?: string[]
  urlList?: string[]
  path: string | null
  addUID: boolean
  rootDir: FileSystemDirectoryHandle | null
  skipVerify: boolean
  private _startupBitfield?: Uint8Array | ArrayLike<number>
  private _store: any
  private _preloadedStore: any
  private _storeCacheSlots: number
  private _destroyStoreOnDestroy: boolean
  private _getAnnounceOpts?: () => Record<string, unknown>
  strategy: 'rarest' | 'sequential'
  maxWebConns: number
  private _rechokeNumSlots: number
  private _rechokeOptimisticWire: any
  private _rechokeOptimisticTime: number
  private _rechokeIntervalId: ReturnType<typeof setInterval> | null
  private _noPeersIntervalId: ReturnType<typeof setInterval> | null
  private _noPeersIntervalTime: number
  private _startAsDeselected: boolean
  ready: boolean
  destroyed: boolean
  paused: boolean
  done: boolean
  metadata: ParsedTorrent | null
  files: File[]
  pieces: Piece[]
  private _amInterested: boolean
  private _selections: Selections
  private _critical: number[]
  wires: any[]
  private _queue: any[]
  private _peers: Map<string, Peer>
  private _peersLength: number
  received: number
  uploaded: number
  private _downloadSpeed: () => number
  private _uploadSpeed: () => number
  private _servers: any[]
  private _xsRequests: any[]
  private _fileModtimes?: number[]

  infoHash: string = ''
  infoHashBuffer: Buffer = Buffer.alloc(0)
  infoHashHash: string = ''
  name: string = ''
  info?: Record<string, unknown>
  length: number = 0
  pieceLength: number = 0
  lastPieceLength: number = 0
  pieces_: Buffer[] = []
  magnetURI: string = ''
  torrentFile: Uint8Array | null = null
  discovery: any = null
  store: any = null
  storeOpts?: Record<string, unknown>
  alwaysChokeSeeders: boolean
  bitfield: BitField | null = null
  rarityMap: RarityMap | null = null
  xs?: string | string[]
  _numConns: number = 0

  constructor(
    torrentId: string | ArrayBufferView | ParsedTorrent | null,
    client: WebTorrent,
    opts: TorrentOpts = {}
  ) {
    super()

    this._debugId = 'unknown infohash'
    this.client = client

    this.announce = opts.announce
    this.urlList = opts.urlList

    this.path = opts.path || TMP
    this.addUID = opts.addUID || false
    this.rootDir = opts.rootDir || null
    this.skipVerify = !!opts.skipVerify
    this._startupBitfield = opts.bitfield
    this._store = opts.store || FALLBACK_STORE
    this._preloadedStore = opts.preloadedStore || null
    this._storeCacheSlots = opts.storeCacheSlots !== undefined ? opts.storeCacheSlots : 20
    this._destroyStoreOnDestroy = opts.destroyStoreOnDestroy || false
    this.store = null
    this.storeOpts = opts.storeOpts
    this.alwaysChokeSeeders = opts.alwaysChokeSeeders ?? true

    this._getAnnounceOpts = opts.getAnnounceOpts

    if (typeof opts.private === 'boolean') (this as any).private = opts.private

    this.strategy = opts.strategy || 'sequential'

    this.maxWebConns = opts.maxWebConns || 4

    this._rechokeNumSlots = opts.uploads === false || opts.uploads === 0 ? 0 : +opts.uploads! || 10
    this._rechokeOptimisticWire = null
    this._rechokeOptimisticTime = 0
    this._rechokeIntervalId = null
    this._noPeersIntervalId = null
    this._noPeersIntervalTime = opts.noPeersIntervalTime
      ? opts.noPeersIntervalTime * 1000
      : DEFAULT_NO_PEERS_INTERVAL
    this._startAsDeselected = opts.deselect || false

    this.ready = false
    this.destroyed = false
    this.paused = opts.paused || false
    this.done = false

    this.metadata = null
    this.files = []

    this.pieces = []

    this._amInterested = false
    this._selections = new Selections()
    this._critical = []

    this.wires = []

    this._queue = []

    this._peers = new Map()
    this._peersLength = 0

    this.received = 0
    this.uploaded = 0
    this._downloadSpeed = throughput()
    this._uploadSpeed = throughput()

    this._servers = []
    this._xsRequests = []

    this._fileModtimes = opts.fileModtimes

    if (torrentId !== null) this._onTorrentId(torrentId as any)

    this._debug('new torrent')
  }

  get timeRemaining(): number {
    if (this.done) return 0
    if (this.downloadSpeed === 0) return Infinity
    return ((this.length - this.downloaded) / this.downloadSpeed) * 1000
  }

  get downloaded(): number {
    if (!this.bitfield) return 0
    let downloaded = 0
    for (let index = 0, len = this.pieces.length; index < len; ++index) {
      if (this.bitfield.get(index)) {
        downloaded += index === len - 1 ? this.lastPieceLength : this.pieceLength
      } else {
        const piece = this.pieces[index]
        downloaded += (piece as any).length - (piece as any).missing
      }
    }
    return downloaded
  }

  get downloadSpeed(): number {
    return this._downloadSpeed()
  }

  get uploadSpeed(): number {
    return this._uploadSpeed()
  }

  get progress(): number {
    return this.length ? this.downloaded / this.length : 0
  }

  get ratio(): number {
    return this.uploaded / (this.received || this.length)
  }

  get numPeers(): number {
    return this.wires.length
  }

  get torrentFileBlob(): Blob | null {
    if (!this.torrentFile) return null
    return new Blob([this.torrentFile], { type: 'application/x-bittorrent' })
  }

  get _numQueued(): number {
    return this._queue.length + (this._peersLength - this._numConns)
  }

  async _onTorrentId(torrentId: string | ArrayBufferView | ParsedTorrent): Promise<void> {
    if (this.destroyed) return

    let parsedTorrent: ParsedTorrent | null = null
    try {
      parsedTorrent = (await parseTorrent(torrentId as any)) as ParsedTorrent
    } catch (err) {}
    if (parsedTorrent) {
      ;(this as any).infoHash = parsedTorrent.infoHash
      this._debugId = arr2hex(parsedTorrent.infoHashBuffer as any).substring(0, 7)
      queueMicrotask(() => {
        if (this.destroyed) return
        this._onParsedTorrent(parsedTorrent!)
      })
    } else {
      remote(torrentId as any, (err: Error | null, parsedTorrent: ParsedTorrent) => {
        if (this.destroyed) return
        if (err) return this._destroy(err)
        this._onParsedTorrent(parsedTorrent)
      })
    }
  }

  _onParsedTorrent(parsedTorrent: ParsedTorrent): void {
    if (this.destroyed) return

    this._processParsedTorrent(parsedTorrent)

    if (!this.infoHash) {
      return this._destroy(new Error('Malformed torrent data: No info hash'))
    }

    this._rechokeIntervalId = setInterval(() => {
      this._rechoke()
    }, RECHOKE_INTERVAL)
    if ((this._rechokeIntervalId as any)?.unref) (this._rechokeIntervalId as any).unref()

    this.emit('_infoHash', this.infoHash)
    if (this.destroyed) return

    this.emit('infoHash', this.infoHash)
    if (this.destroyed) return

    if ((this.client as any).listening) {
      this._onListening()
    } else {
      this.client.once('listening', () => {
        this._onListening()
      })
    }
  }

  _processParsedTorrent(parsedTorrent: ParsedTorrent): void {
    this._debugId = arr2hex(parsedTorrent.infoHashBuffer as any).substring(0, 7)

    if (typeof (this as any).private !== 'undefined') {
      parsedTorrent.private = (this as any).private
    }

    if (Array.isArray(this.announce)) {
      parsedTorrent.announce = parsedTorrent.announce!.concat(this.announce)
    }

    if (
      (this.client as any).tracker &&
      Array.isArray((this.client as any).tracker.announce) &&
      !parsedTorrent.private
    ) {
      parsedTorrent.announce = parsedTorrent.announce!.concat((this.client as any).tracker.announce)
    }

    if (
      (this.client as any).tracker &&
      (globalThis as any).WEBTORRENT_ANNOUNCE &&
      !parsedTorrent.private
    ) {
      parsedTorrent.announce = parsedTorrent.announce!.concat(
        (globalThis as any).WEBTORRENT_ANNOUNCE
      )
    }

    if (this.urlList) {
      parsedTorrent.urlList = parsedTorrent.urlList!.concat(this.urlList)
    }

    parsedTorrent.announce = Array.from(new Set(parsedTorrent.announce)) as string[]
    parsedTorrent.urlList = Array.from(new Set(parsedTorrent.urlList)) as string[]

    Object.assign(this, parsedTorrent)

    this.magnetURI = toMagnetURI(parsedTorrent as any)
    this.torrentFile = toTorrentFile(parsedTorrent as any)
  }

  _onListening(): void {
    if (this.destroyed) return

    if (this.info) {
      this._onMetadata(this as any)
    } else {
      if (this.xs) this._getMetadataFromServer()
      this._startDiscovery()
    }
  }

  _startDiscovery(): void {
    if (this.discovery || this.destroyed) return

    let trackerOpts = (this.client as any).tracker
    if (trackerOpts) {
      trackerOpts = Object.assign({}, (this.client as any).tracker, {
        getAnnounceOpts: () => {
          if (this.destroyed) return

          const opts = {
            uploaded: this.uploaded,
            downloaded: this.downloaded,
            left: Math.max(this.length - this.downloaded, 0),
          }
          if ((this.client as any).tracker.getAnnounceOpts) {
            Object.assign(opts, (this.client as any).tracker.getAnnounceOpts())
          }
          if (this._getAnnounceOpts) {
            Object.assign(opts, this._getAnnounceOpts())
          }
          return opts
        },
      })
    }

    this.discovery = new Discovery({
      infoHash: this.infoHash,
      announce: this.announce,
      peerId: (this.client as any).peerId,
      dht: !(this as any).private && (this.client as any).dht,
      tracker: trackerOpts,
      port: (this.client as any).torrentPort,
      userAgent: USER_AGENT,
      lsd: (this.client as any).lsd,
    })

    this.discovery.on('error', (err: Error) => {
      this._destroy(err)
    })

    this.discovery.on('peer', (peer: any, source: string) => {
      this._debug('peer %s discovered via %s', peer, source)
      if (typeof peer === 'string') {
        this._addPeer(peer, 'tcp', source)
      } else {
        this._addWebPeer(peer, source)
      }
    })

    this.discovery.on('trackerAnnounce', () => {
      this.emit('trackerAnnounce')
    })

    this.discovery.on('dhtAnnounce', () => {
      this.emit('dhtAnnounce')
    })

    this.discovery.on('warning', (err: Error) => {
      this.emit('warning', err)
    })
  }

  _getMetadataFromServer(): void {
    // Implementation for getting metadata from server
  }

  _addPeer(addr: string, type: string, source: string): Peer | null {
    // Implementation for adding peer
    return null
  }

  _addWebPeer(peer: any, source: string): void {
    // Implementation for adding web peer
  }

  _onMetadata(parsedTorrent: ParsedTorrent): void {
    // Implementation for metadata handling
    this._debug('got metadata')
    this.emit('metadata')
  }

  _rechoke(): void {
    // Implementation for rechoke logic
  }

  pause(): void {
    if (this.destroyed) return
    this._debug('pause')
    this.paused = true
  }

  resume(): void {
    if (this.destroyed) return
    this._debug('resume')
    this.paused = false
    this._drain()
  }

  _debug(...args: any[]): void {
    args[0] = `[${(this.client as any)._debugId}] [${this._debugId}] ${args[0]}`
    debug(...args)
  }

  _drain(): void {
    this._debug(
      '_drain numConns %s maxConns %s _peersLength %s',
      this._numConns,
      (this.client as any).maxConns,
      this._peersLength
    )
    if (
      typeof net.connect !== 'function' ||
      this.destroyed ||
      this.paused ||
      this._numConns >= (this.client as any).maxConns
    ) {
      return
    }
    this._debug(
      'drain (%s queued, %s/%s peers)',
      this._numQueued,
      this.numPeers,
      (this.client as any).maxConns
    )

    const peer = this._queue.shift()
    if (!peer) return

    this._debug('%s connect attempt to %s', peer.type, peer.addr)

    const parts = addrToIPPort(peer.addr)
    const opts = {
      host: parts[0],
      port: parts[1],
    }

    if ((this.client as any).utp && peer.type === Peer.TYPE_UTP_OUTGOING) {
      const utp = require('./utp.cjs')
      peer.conn = utp.connect(opts.port, opts.host)
    } else {
      peer.conn = net.connect(opts)
    }

    const conn = peer.conn

    conn.once('connect', () => {
      if (!this.destroyed) peer.onConnect()
    })
    conn.once('error', (err: Error) => {
      peer.destroy(err)
    })
    peer.startConnectTimeout()

    conn.on('close', () => {
      if (this.destroyed) return

      if (peer.retries >= RECONNECT_WAIT.length) {
        if ((this.client as any).utp) {
          const newPeer = this._addPeer(peer.addr, 'tcp', peer.source)
          if (newPeer) newPeer.retries = 0
        } else {
          this._debug(
            'conn %s closed: will not re-add (max %s attempts)',
            peer.addr,
            RECONNECT_WAIT.length
          )
        }
        return
      }

      const ms = RECONNECT_WAIT[peer.retries]
      this._debug(
        'conn %s closed: will re-add to queue in %sms (attempt %s)',
        peer.addr,
        ms,
        peer.retries + 1
      )

      const reconnectTimeout = setTimeout(() => {
        if (this.destroyed) return
        const host = addrToIPPort(peer.addr)[0]
        const type = (this.client as any).utp && this._isIPv4(host) ? 'utp' : 'tcp'
        const newPeer = this._addPeer(peer.addr, type, peer.source)
        if (newPeer) newPeer.retries = peer.retries + 1
      }, ms)
      if ((reconnectTimeout as any).unref) (reconnectTimeout as any).unref()
    })
  }

  _validAddr(addr: string): boolean {
    let parts
    try {
      parts = addrToIPPort(addr)
    } catch (e) {
      return false
    }
    const host = parts[0]
    const port = parts[1]
    return (
      port > 0 &&
      port < 65535 &&
      !(host === '127.0.0.1' && port === (this.client as any).torrentPort)
    )
  }

  _isIPv4(addr: string): boolean {
    const IPv4Pattern =
      /^((?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])[.]){3}(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])$/
    return IPv4Pattern.test(addr)
  }

  _destroy(err?: Error, cb?: () => void): void {
    if (this.destroyed) return
    this.destroyed = true
    this._debug('destroy')

    if (this._rechokeIntervalId) {
      clearInterval(this._rechokeIntervalId)
      this._rechokeIntervalId = null
    }

    if (this._noPeersIntervalId) {
      clearInterval(this._noPeersIntervalId)
      this._noPeersIntervalId = null
    }

    if (this.discovery) {
      this.discovery.destroy()
    }

    for (const peer of this._peers.values()) {
      peer.destroy()
    }

    if (this.store) {
      this.store.close(() => {
        // Store closed
      })
    }

    if (err) {
      this.emit('error', err)
    }

    this.emit('close')
    cb?.()
  }

  destroy(cb?: (err?: Error) => void): void {
    this._destroy(undefined, cb)
  }

  addPeer(peer: string): boolean {
    return !!this._addPeer(peer, 'tcp', 'manual')
  }

  removePeer(peer: string | any): void {
    // Implementation for removing peer
  }

  addWebSeed(url: string): void {
    // Implementation for adding web seed
  }

  removeWebSeed(url: string): void {
    // Implementation for removing web seed
  }

  select(start: number, end: number, priority?: number, notify?: () => void): void {
    // Implementation for selecting pieces
  }

  deselect(start: number, end: number): void {
    // Implementation for deselecting pieces
  }

  critical(start: number, end: number): void {
    // Implementation for critical pieces
  }

  _select(
    start: number,
    end: number,
    priority: number,
    notify?: (() => void) | null,
    isStreamSelection?: boolean
  ): void {
    // Implementation
  }

  _deselect(start: number, end: number, isStreamSelection?: boolean): void {
    // Implementation
  }

  on(event: 'ready', listener: () => void): this
  on(event: 'error', listener: (err: Error) => void): this
  on(event: 'warning', listener: (err: Error) => void): this
  on(event: 'download', listener: (bytes: number) => void): this
  on(event: 'upload', listener: (bytes: number) => void): this
  on(event: 'wire', listener: (wire: any) => void): this
  on(event: 'done', listener: () => void): this
  on(event: 'metadata', listener: () => void): this
  on(event: 'infoHash', listener: (infoHash: string) => void): this
  on(event: 'verified', listener: (index: number) => void): this
  on(event: string, listener: (...args: any[]) => void): this
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener)
  }

  removeListener(event: string, listener: (...args: any[]) => void): this {
    return super.removeListener(event, listener)
  }
}
