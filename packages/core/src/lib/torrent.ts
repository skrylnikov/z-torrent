import { EventEmitter } from 'eventemitter3'
import { addrToIPPort } from '@z-torrent/utils/addr-ip-port'
import { Piece } from '@z-torrent/utils/piece'
import BitField from 'bitfield'
import CacheChunkStore from 'cache-chunk-store'
import { chunkStoreWrite } from 'chunk-store-iterator'
import debugFactory from 'debug'
import ImmediateChunkStore from 'immediate-chunk-store'
import ltDontHave from 'lt_donthave'
import joinIterator from 'join-async-iterator'
import parallel from 'run-parallel'
import parallelLimit from 'run-parallel-limit'
import { parseTorrent, toMagnetURI, toTorrentFile, remote } from '@z-torrent/parse'

import randomIterate from 'random-iterate'
import { pieceSubtreeRootFromBytes } from '@z-torrent/merkle-tree'
import { hash, arr2hex, equal } from 'uint8-util'
import throughput from 'throughput'
import { createUtMetadata } from '@z-torrent/ut-metadata'
import { UtPex } from '@z-torrent/ut-pex'

import { File } from './file.js'
import { Peer, type PeerSwarm, type ThrottleGroups } from './peer.js'
import { RarityMap } from './rarity-map.js'
import { WebConn } from './webconn.js'
import { Selections } from '../selections.js'
import MemoryChunkStore from 'memory-chunk-store'
import type { Discovery, PlatformAdapter } from '../interfaces.js'
import type { V2FileLayoutEntry } from '@z-torrent/parse'
import { buildV2ExpectedPieceRoots, v2IsFirstPieceOfFile } from './v2-piece-roots.js'
import type { TorrentWire, TorrentForFile } from './types.js'

const debug = debugFactory('@z-torrent/core:torrent')
const MAX_BLOCK_LENGTH = 128 * 1024
const PIECE_TIMEOUT = 30_000
const CHOKE_TIMEOUT = 5_000
const SPEED_THRESHOLD = 3 * Piece.BLOCK_LENGTH

const PIPELINE_MIN_DURATION = 0.5
const PIPELINE_MAX_DURATION = 1

const RECHOKE_INTERVAL = 10_000
const RECHOKE_OPTIMISTIC_DURATION = 2

const DEFAULT_NO_PEERS_INTERVAL = 30_000

const RECONNECT_WAIT = [1_000, 5_000, 15_000]

const USER_AGENT = 'Z-Torrent/2.8.5 (https://github.com/webtorrent/webtorrent)'

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
  infoHash?: string
  infoHashBuffer?: Uint8Array
  infoHashV2?: string
  infoHashV2Buffer?: Uint8Array
  version?: 'v1' | 'v2' | 'hybrid'
  'piece layers'?: Record<string, Uint8Array>
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
  pieces?: string[] | Uint8Array[]
  pieceLength: number
  lastPieceLength: number
  length: number
  files?: Array<{
    path: string
    name: string
    length: number
    offset: number
    attr?: string
  }>
  xs?: string | string[]
  pieceLayersByRootHex?: Record<string, Uint8Array[]>
  v2FileLayout?: V2FileLayoutEntry[]
}

export interface ZTorrentClient {
  platform: PlatformAdapter
  peerId: string
  torrentPort: number
  maxConns: number
  utp: boolean
  throttleGroups: ThrottleGroups
  dht?: unknown
  tracker?: unknown
  lsd?: boolean
  utPex?: boolean
  enableWebSeeds?: boolean
  seedOutgoingConnections?: boolean
  httpServer?: { pathname: string } | null
  debugId: string
  recordDownload: (bytes?: number) => number
  recordUpload: (bytes?: number) => number
  removeTorrentFromClient: (torrent: Torrent, opts?: unknown, cb?: () => void) => void
  listening: boolean
  on: (event: string, fn: (...args: unknown[]) => void) => void
  once: (event: string, fn: (...args: unknown[]) => void) => void
  emit: (event: string, ...args: unknown[]) => boolean
}

export class Torrent
  extends EventEmitter
  implements TorrentWire, TorrentForFile, PeerSwarm
{
  #instanceDebugId: string
  client: ZTorrentClient
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
  #rechokeNumSlots: number
  #rechokeOptimisticWire: any
  #rechokeOptimisticTime: number
  #rechokeIntervalId: ReturnType<typeof setInterval> | null
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
  #selections: Selections
  private _critical: number[]
  wires: any[]
  private _queue: Peer[]
  private _peers: Map<string, Peer>
  private _peersLength: number
  received: number
  uploaded: number
  #localDownloadSpeed: (bytes?: number) => number
  #localUploadSpeed: (bytes?: number) => number
  private _servers: any[]
  private _xsRequests: any[]
  private _fileModtimes?: number[]

  infoHash: string = ''
  infoHashBuffer: Uint8Array = new Uint8Array(0)
  infoHashHash: string = ''
  infoHashV2: string = ''
  infoHashV2Buffer: Uint8Array = new Uint8Array(0)
  version?: 'v1' | 'v2' | 'hybrid'
  name: string = ''
  info?: Record<string, unknown>
  length: number = 0
  pieceLength: number = 0
  lastPieceLength: number = 0
  pieces_: Uint8Array[] = []
  magnetURI: string = ''
  torrentFile: Uint8Array | null = null
  discovery: Discovery | null = null
  store: any = null
  storeOpts?: Record<string, unknown>
  alwaysChokeSeeders: boolean
  bitfield: BitField | null = null
  rarityMap: RarityMap | null = null
  xs?: string | string[]
  #numConns: number = 0
  private _reservations: (any[] | null)[] = []
  private _hashes: Uint8Array[] = []
  private _idleEmitted: boolean = false

  constructor(
    torrentId: string | ArrayBufferView | ParsedTorrent | null,
    client: ZTorrentClient,
    opts: TorrentOpts = {}
  ) {
    super()

    const platform = client.platform

    this.#instanceDebugId = 'unknown infohash'
    this.client = client

    this.announce = opts.announce
    this.urlList = opts.urlList

    this.path = opts.path || platform.tmpDir
    this.addUID = opts.addUID || false
    this.rootDir = opts.rootDir || null
    this.skipVerify = !!opts.skipVerify
    this._startupBitfield = opts.bitfield
    this._store = opts.store || platform.defaultStore
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

    this.#rechokeNumSlots = opts.uploads === false || opts.uploads === 0 ? 0 : +opts.uploads! || 10
    this.#rechokeOptimisticWire = null
    this.#rechokeOptimisticTime = 0
    this.#rechokeIntervalId = null
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
    this.#selections = new Selections()
    this._critical = []

    this.wires = []

    this._queue = []

    this._peers = new Map()
    this._peersLength = 0

    this.received = 0
    this.uploaded = 0
    this.#localDownloadSpeed = throughput()
    this.#localUploadSpeed = throughput()

    this._servers = []
    this._xsRequests = []

    this._fileModtimes = opts.fileModtimes

    if (torrentId !== null) this.applyTorrentInput(torrentId as any)

    this.#debug('new torrent')
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
    return this.#localDownloadSpeed()
  }

  get uploadSpeed(): number {
    return this.#localUploadSpeed()
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
    return new Blob([this.torrentFile as BlobPart], { type: 'application/x-bittorrent' })
  }

  #getQueuedPeerCount(): number {
    return this._queue.length + (this._peersLength - this.#numConns)
  }

  async applyTorrentInput(torrentId: string | ArrayBufferView | ParsedTorrent): Promise<void> {
    if (this.destroyed) return

    let parsedTorrent: ParsedTorrent | null = null
    try {
      parsedTorrent = (await parseTorrent(torrentId as any)) as ParsedTorrent
    } catch (err) {}
    if (parsedTorrent) {
      queueMicrotask(() => {
        if (this.destroyed) return
        this.#onParsedTorrent(parsedTorrent!)
      })
    } else {
      remote(
        torrentId as any,
        { headers: { 'user-agent': 'Z-Torrent/0.1 (https://github.com/skrylnikov/z-torrent)' } },
        ((err: Error | null, parsedTorrent?: ParsedTorrent) => {
          if (this.destroyed) return
          if (err) return this.#destroyTorrent(err)
          if (parsedTorrent) this.#onParsedTorrent(parsedTorrent)
        }) as (err: Error | null, parsed?: unknown) => void
      )
    }
  }

  #onParsedTorrent(parsedTorrent: ParsedTorrent): void {
    if (this.destroyed) return

    this.#processParsedTorrent(parsedTorrent)

    if (!this.infoHash) {
      return this.#destroyTorrent(new Error('Malformed torrent data: No info hash'))
    }

    this.#rechokeIntervalId = setInterval(() => {
      this.#rechoke()
    }, RECHOKE_INTERVAL)
    if ((this.#rechokeIntervalId as any)?.unref) (this.#rechokeIntervalId as any).unref()

    this.emit('_infoHash', this.infoHash)
    if (this.destroyed) return

    this.emit('infoHash', this.infoHash)
    if (this.destroyed) return

    if (this.client.listening) {
      this.#onListening()
    } else {
      this.client.once('listening', () => {
        this.#onListening()
      })
    }
  }

  /**
   * BEP 52: without a v1 info-hash, the value in the peer handshake is the first 20 bytes
   * of SHA-256(bencoded info). Hybrid torrents keep the v1 SHA-1 info-hash from the file.
   */
  #applyV2PeerProtocolInfoHash(): void {
    if (this.infoHash) return
    const v2b = this.infoHashV2Buffer
    if (!v2b || v2b.length !== 32) return
    const slice = v2b.slice(0, 20)
    this.infoHashBuffer = slice
    this.infoHash = arr2hex(slice)
  }

  #processParsedTorrent(parsedTorrent: ParsedTorrent): void {
    parsedTorrent.announce = parsedTorrent.announce || []
    parsedTorrent.urlList = parsedTorrent.urlList || []

    if (typeof (this as any).private !== 'undefined') {
      parsedTorrent.private = (this as any).private
    }

    if (Array.isArray(this.announce)) {
      parsedTorrent.announce = parsedTorrent.announce.concat(this.announce)
    }

    if (
      this.client.tracker &&
      Array.isArray((this.client.tracker as any).announce) &&
      !parsedTorrent.private
    ) {
      parsedTorrent.announce = parsedTorrent.announce.concat((this.client.tracker as any).announce)
    }

    if (this.client.tracker && (globalThis as any).WEBTORRENT_ANNOUNCE && !parsedTorrent.private) {
      parsedTorrent.announce = parsedTorrent.announce.concat(
        (globalThis as any).WEBTORRENT_ANNOUNCE
      )
    }

    if (this.urlList) {
      parsedTorrent.urlList = parsedTorrent.urlList.concat(this.urlList)
    }

    parsedTorrent.announce = Array.from(new Set(parsedTorrent.announce)) as string[]
    parsedTorrent.urlList = Array.from(new Set(parsedTorrent.urlList)) as string[]

    Object.assign(this, parsedTorrent)

    this.#applyV2PeerProtocolInfoHash()

    if (this.infoHashBuffer.length > 0) {
      this.#instanceDebugId = arr2hex(this.infoHashBuffer).substring(0, 7)
    } else if (this.infoHash.length >= 7) {
      this.#instanceDebugId = this.infoHash.substring(0, 7)
    }

    const magnetOpts = { ...parsedTorrent } as any
    if (magnetOpts.xs === undefined) delete magnetOpts.xs
    this.magnetURI = toMagnetURI(magnetOpts)
    this.torrentFile = toTorrentFile(parsedTorrent as any)
  }

  #onListening(): void {
    if (this.destroyed) return

    if (this.info) {
      this.#onMetadata(this as any)
    } else {
      if (this.xs) this.#getMetadataFromServer()
      this.#startDiscovery()
    }
  }

  #startDiscovery(): void {
    if (this.discovery || this.destroyed) return

    let trackerOpts = this.client.tracker
    if (trackerOpts) {
      trackerOpts = Object.assign({}, this.client.tracker, {
        getAnnounceOpts: () => {
          if (this.destroyed) return {}

          const opts = {
            uploaded: this.uploaded,
            downloaded: this.downloaded,
            left: Math.max(this.length - this.downloaded, 0),
          }
          if ((this.client.tracker as any)?.getAnnounceOpts) {
            Object.assign(opts, (this.client.tracker as any).getAnnounceOpts())
          }
          if (this._getAnnounceOpts) {
            Object.assign(opts, this._getAnnounceOpts())
          }
          return opts
        },
      })
    }

    const v2Trunc =
      this.version === 'hybrid' && this.infoHashV2Buffer && this.infoHashV2Buffer.length === 32
        ? arr2hex(this.infoHashV2Buffer.subarray(0, 20))
        : undefined

    this.discovery = this.client.platform.createDiscovery({
      infoHash: this.infoHash,
      infoHashV2Truncated: v2Trunc,
      announce: this.announce,
      peerId: this.client.peerId,
      dht: !(this as any).private && this.client.dht,
      tracker: trackerOpts,
      port: this.client.torrentPort,
      userAgent: USER_AGENT,
      lsd: this.client.lsd,
    } as import('../interfaces.js').DiscoveryOptions)

    this.discovery.on('error', (...args: unknown[]) => {
      this.#destroyTorrent(args[0] as Error)
    })

    this.discovery.on('peer', (...args: unknown[]) => {
      const peer = args[0]
      const source = args[1] as string
      this.#debug('peer %s discovered via %s', peer, source)
      if (typeof peer === 'string') {
        this.#addPeer(peer, 'tcp', source)
      } else {
        this.#addWebPeer(peer, source)
      }
    })

    this.discovery.on('trackerAnnounce', () => {
      this.emit('trackerAnnounce')
    })

    this.discovery.on('dhtAnnounce', () => {
      this.emit('dhtAnnounce')
    })

    this.discovery.on('warning', (...args: unknown[]) => {
      this.emit('warning', args[0] as Error)
    })
  }

  #getMetadataFromServer(): void {
    const xsList = Array.isArray(this.xs) ? this.xs : [this.xs]
    const urls = xsList.filter((u): u is string => typeof u === 'string')
    const controller = new AbortController()
    ;(this as any)._xsRequestsController = controller
    const signal = controller.signal

    const tasks = urls.map((url: string) => (cb: (err?: Error) => void) => {
      this.#getMetadataFromURL(url, signal, cb)
    })
    parallel(tasks)
  }

  async #getMetadataFromURL(
    url: string,
    signal: AbortSignal,
    cb: (err?: Error) => void
  ): Promise<void> {
    if (url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0) {
      this.emit('warning', new Error(`skipping non-http xs param: ${url}`))
      return cb()
    }

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'user-agent': 'Z-Torrent/0.1 (https://github.com/skrylnikov/z-torrent)' },
        signal,
      })

      if (this.destroyed) return cb()
      if (this.metadata) return cb()

      if (res.status !== 200) {
        this.emit('warning', new Error(`non-200 status code ${res.status} from xs param: ${url}`))
        return cb()
      }

      const torrentBuf = new Uint8Array(await res.arrayBuffer())
      const parsedTorrent = await parseTorrent(torrentBuf)

      if (!parsedTorrent) {
        this.emit('warning', new Error(`got invalid torrent file from xs param: ${url}`))
        return cb()
      }

      const xsMatches =
        (parsedTorrent.infoHashV2 &&
          this.infoHashV2 &&
          parsedTorrent.infoHashV2 === this.infoHashV2) ||
        (parsedTorrent.infoHash &&
          this.infoHash &&
          parsedTorrent.infoHash === this.infoHash)
      if (!xsMatches) {
        this.emit(
          'warning',
          new Error(`got torrent file with incorrect info hash from xs param: ${url}`)
        )
        return cb()
      }

      this.#onMetadata(parsedTorrent as any)
      cb()
    } catch (err) {
      this.emit('warning', new Error(`http error from xs param: ${(err as Error).message}`))
      cb()
    }
  }

  #registerPeer(newPeer: Peer): void {
    newPeer.on('download', (downloaded: number) => {
      if (this.destroyed) return
      this.received += downloaded
      this.#localDownloadSpeed(downloaded)
      this.client.recordDownload(downloaded)
      this.emit('download', downloaded)
      if (this.destroyed) return
      this.client.emit('download', downloaded)
    })

    newPeer.on('upload', (uploaded: number) => {
      if (this.destroyed) return
      this.uploaded += uploaded
      this.#localUploadSpeed(uploaded)
      this.client.recordUpload(uploaded)
      this.emit('upload', uploaded)
      if (this.destroyed) return
      this.client.emit('upload', uploaded)
    })

    if (newPeer.connected) {
      this.#numConns += 1
    } else {
      newPeer.once('connect', () => {
        if (this.destroyed) return
        this.#numConns += 1
      })
    }
    newPeer.once('disconnect', () => {
      this.#numConns -= 1
    })

    this._peers.set(newPeer.id, newPeer)
    this._peersLength += 1
  }

  acceptIncomingPeer(peer: Peer): void {
    if (this.destroyed) return peer.destroy(new Error('torrent is destroyed'))
    if (this.paused) return peer.destroy(new Error('torrent is paused'))

    this.#debug('add incoming peer %s', peer.id)

    this.#registerPeer(peer)
  }

  #addPeer(addr: string, type: string, source: string): Peer | null {
    if (this.destroyed) return null
    if (typeof addr === 'string' && !this.#validAddr(addr)) {
      this.#debug('ignoring peer: invalid %s', addr)
      return null
    }

    const id = addr
    if (this._peers.has(id)) {
      this.#debug('ignoring peer: duplicate (%s)', id)
      return null
    }

    if (this.paused) {
      this.#debug('ignoring peer: torrent is paused')
      return null
    }

    this.#debug('add peer %s', id)

    const newPeer =
      type === 'utp'
        ? Peer.createUTPOutgoingPeer(addr, this, this.client.throttleGroups, source as any)
        : Peer.createTCPOutgoingPeer(addr, this, this.client.throttleGroups, source as any)

    this.#registerPeer(newPeer)

    this._queue.push(newPeer)
    this.#drain()

    return newPeer
  }

  #addWebPeer(peer: any, source: string): void {
    if (this.destroyed) {
      if (typeof peer !== 'string') peer.destroy()
      return
    }

    const id = (peer && peer.id) || peer
    if (this._peers.has(id)) {
      this.#debug('ignoring peer: duplicate (%s)', id)
      if (typeof peer !== 'string') peer.destroy()
      return
    }

    if (this.paused) {
      this.#debug('ignoring peer: torrent is paused')
      if (typeof peer !== 'string') peer.destroy()
      return
    }

    this.#debug('add peer %s', id)

    const newPeer = Peer.createWebRTCPeer(peer, this, this.client.throttleGroups, source as any)

    this.#registerPeer(newPeer)
  }

  handleWire(wire: any, addr?: string): void {
    this.#debug('got wire %s (%s)', (wire as any)._debugId, addr || 'Unknown')

    this.wires.push(wire)

    if (addr) {
      const parts = addrToIPPort(addr)
      ;(wire as any).remoteAddress = parts[0]
      ;(wire as any).remotePort = parts[1]
    }

    if (this.client.dht && (this.client.dht as any).listening) {
      wire.on('port', (port: number) => {
        if (this.destroyed || (this.client.dht as any).destroyed) return
        if (!(wire as any).remoteAddress)
          return this.#debug('ignoring PORT from peer with no address')
        if (port === 0 || port > 65536) return this.#debug('ignoring invalid PORT from peer')
        this.#debug('port: %s (from %s)', port, addr)
        ;(this.client.dht as any).addNode({ host: (wire as any).remoteAddress, port })
      })
    }

    wire.on('timeout', () => {
      this.#debug('wire timeout (%s)', addr)
      wire.destroy()
    })

    if ((wire as any).type !== 'webSeed') {
      wire.setTimeout(PIECE_TIMEOUT, true)
    }

    wire.setKeepAlive(true)

    wire.use(
      createUtMetadata(this.metadata as any, {
        infoHashV2: this.infoHashV2 || undefined,
      })
    )
    ;(wire as any).ut_metadata.on('warning', (err: Error) => {
      this.#debug('ut_metadata warning: %s', err.message)
    })

    if (!this.metadata) {
      ;(wire as any).ut_metadata.on('metadata', async (metadata: any) => {
        this.#debug('got metadata via ut_metadata')
        try {
          const parsed = await parseTorrent(metadata)
          this.#onMetadata(parsed as any)
        } catch (err) {
          this.#destroyTorrent(err as Error)
        }
      })
      ;(wire as any).ut_metadata.fetch()
    }

    if (this.client.utPex && !(this as any).private) {
      wire.use(UtPex)
      ;(wire as any).ut_pex.on('peer', (peer: string) => {
        if (!(this.client as any).seedOutgoingConnections && this.done) {
          this.#debug(
            'ut_pex ignoring peer %s: torrent is done and seedOutgoingConnections is false',
            peer
          )
          return
        }
        this.#debug('ut_pex: got peer: %s (from %s)', peer, addr)
        this.addPeer(peer, Peer.SOURCE_UT_PEX)
      })
      ;(wire as any).ut_pex.on('dropped', (peer: string) => {
        const peerObj = this._peers.get(peer)
        if (peerObj && !peerObj.connected) {
          this.#debug('ut_pex: dropped peer: %s (from %s)', peer, addr)
          this.removePeer(peer)
        }
      })
      wire.once('close', () => {
        ;(wire as any).ut_pex.reset()
      })
    }

    wire.use(ltDontHave())

    this.emit('wire', wire, addr)

    if (this.ready) {
      queueMicrotask(() => {
        this.#onWireWithMetadata(wire)
      })
    }
  }

  #onWireWithMetadata(wire: any): void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const onChokeTimeout = () => {
      if (this.destroyed || wire.destroyed) return
      if (this.#getQueuedPeerCount() > 2 * (this.#numConns - this.numPeers) && (wire as any).amInterested) {
        wire.destroy()
      } else {
        timeoutId = setTimeout(onChokeTimeout, CHOKE_TIMEOUT)
        if ((timeoutId as any)?.unref) (timeoutId as any).unref()
      }
    }

    const updateSeedStatus = () => {
      const peerPieces = (wire as any).peerPieces
      if (!peerPieces) return
      let allPieces = true
      for (let i = 0; i < this.pieces.length; ++i) {
        if (!peerPieces.get(i)) {
          allPieces = false
          break
        }
      }
      if (allPieces) {
        ;(wire as any).isSeeder = true
        if (this.alwaysChokeSeeders) wire.choke()
      } else {
        ;(wire as any).isSeeder = false
      }
    }

    wire.on('bitfield', () => {
      updateSeedStatus()
      this.#update()
      this.#updateWireInterest(wire)
    })

    wire.on('have', () => {
      updateSeedStatus()
      this.#update()
      this.#updateWireInterest(wire)
    })
    ;(wire as any).lt_donthave?.on('donthave', () => {
      updateSeedStatus()
      this.#update()
      this.#updateWireInterest(wire)
    })

    wire.on('have-all', () => {
      ;(wire as any).isSeeder = true
      if (this.alwaysChokeSeeders) wire.choke()
      this.#update()
      this.#updateWireInterest(wire)
    })

    wire.on('have-none', () => {
      ;(wire as any).isSeeder = false
      this.#update()
      this.#updateWireInterest(wire)
    })

    wire.on('allowed-fast', () => {
      this.#update()
    })

    wire.once('interested', () => {
      wire.unchoke()
    })

    wire.once('close', () => {
      if (timeoutId) clearTimeout(timeoutId)
    })

    wire.on('choke', () => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(onChokeTimeout, CHOKE_TIMEOUT)
      if ((timeoutId as any)?.unref) (timeoutId as any).unref()
    })

    wire.on('unchoke', () => {
      if (timeoutId) clearTimeout(timeoutId)
      this.#update()
    })

    wire.on(
      'request',
      (
        index: number,
        offset: number,
        length: number,
        cb: (err?: Error, chunk?: Uint8Array) => void
      ) => {
        if (length > MAX_BLOCK_LENGTH) return wire.destroy()
        if ((this.pieces as any[])[index]) return
        this.store!.get(index, { offset, length }, cb)
      }
    )

    if ((wire as any).hasFast && this.#hasAllPieces()) wire.haveAll()
    else if ((wire as any).hasFast && this.#hasNoPieces()) wire.haveNone()
    else wire.bitfield(this.bitfield!)

    this.#updateWireInterest(wire)

    const dht = this.client.dht as { listening?: boolean; address?: () => { port: number } } | null
    if ((wire as any).peerExtensions?.dht && dht?.listening) {
      wire.port(dht.address!().port)
    }

    if ((wire as any).type !== 'webSeed') {
      timeoutId = setTimeout(onChokeTimeout, CHOKE_TIMEOUT)
      if ((timeoutId as any)?.unref) (timeoutId as any).unref()
    }

    ;(wire as any).isSeeder = false
    updateSeedStatus()
  }

  #updateWireInterest(wire: any): void {
    let interested = false
    for (let index = 0; index < this.pieces.length; ++index) {
      if ((this.pieces as any[])[index] && wire.peerPieces?.get(index)) {
        interested = true
        break
      }
    }
    if (interested) wire.interested()
    else wire.uninterested()
  }

  #update(): void {
    const idleCallback = this.client.platform.idleCallback
    if (idleCallback) {
      idleCallback(() => this.#updateWireWrapper(), { timeout: 250 })
    } else {
      this.#updateWireWrapper()
    }
  }

  #updateWireWrapper(): void {
    if (this.destroyed) return
    const ite = randomIterate(this.wires)
    let wire
    while ((wire = ite())) {
      this.#updateWire(wire)
    }
    this.#checkIdle()
  }

  #updateWire(wire: any): boolean {
    if (wire.destroyed) return false
    const isWebSeed = (wire as any).type === 'webSeed'
    const getBlockPipelineLength = (w: any, duration: number) =>
      Math.max(
        2,
        2 +
          Math.ceil(
            (duration * (typeof w.downloadSpeed === 'function' ? w.downloadSpeed() : 0)) /
              Piece.BLOCK_LENGTH
          )
      )
    const getPiecePipelineLength = (w: any, duration: number, pl: number) =>
      Math.max(
        1,
        1 +
          Math.ceil(
            (duration * (typeof w.downloadSpeed === 'function' ? w.downloadSpeed() : 0)) / pl
          )
      )
    const minOutstanding = isWebSeed
      ? Math.min(
          getPiecePipelineLength(wire, PIPELINE_MIN_DURATION, this.pieceLength),
          this.maxWebConns
        )
      : getBlockPipelineLength(wire, PIPELINE_MIN_DURATION)
    const maxOutstanding = isWebSeed
      ? Math.min(
          getPiecePipelineLength(wire, PIPELINE_MAX_DURATION, this.pieceLength),
          this.maxWebConns
        )
      : getBlockPipelineLength(wire, PIPELINE_MAX_DURATION)

    if ((wire.requests?.length ?? 0) >= minOutstanding) return false
    if ((wire as any).peerChoking) return false

    const selections = this.#selections
    if (!selections) return false

    // Process stream selections first (video/audio) so playback can start immediately.
    // Then process regular selections (rarest-first for swarm health).
    const order = [true, false] as const // isStreamSelection: true first, then false
    for (const wantStream of order) {
      for (let i = 0; i < selections.length; i++) {
        const next = selections.get(i)
        if (!next || !!next.isStreamSelection !== wantStream) continue
        const start = next.from + next.offset
        const end = next.to
        const ascending = !!next.isStreamSelection
        for (
          let piece = ascending ? start : end;
          ascending ? piece <= end : piece >= start;
          ascending ? piece++ : piece--
        ) {
          if (!wire.peerPieces?.get(piece)) continue
          if (this.bitfield!.get(piece)) continue
          if (this.#request(wire, piece, (this._critical as any)?.[piece] || false)) return true
        }
      }
    }
    return false
  }

  async #verifyPieceBufferForVersion(index: number, u8: Uint8Array): Promise<boolean> {
    if (this.version === 'v2') {
      const layout = (this as unknown as ParsedTorrent).v2FileLayout
      const exp = (this._hashes as Uint8Array[])[index]
      if (!layout?.length || !exp) return false
      const first = v2IsFirstPieceOfFile(layout, this.pieceLength, index)
      const computed = pieceSubtreeRootFromBytes(u8, this.pieceLength, first)
      return equal(computed, exp)
    }
    const hex = await hash(u8, 'hex')
    const expected = (this._hashes as any)[index]
    const expectedHex = ArrayBuffer.isView(expected)
      ? arr2hex(expected as Uint8Array)
      : (expected as string)
    return hex === expectedHex
  }

  #request(wire: any, index: number, hotswap: boolean): boolean {
    if (this.bitfield!.get(index)) return false
    const piece = (this.pieces as any[])[index]
    if (!piece) return false
    const isWebSeed = (wire as any).type === 'webSeed'
    const reservation = isWebSeed ? piece.reserveRemaining?.() : piece.reserve?.()
    if (reservation === -1) return false

    if (!this._reservations[index]) this._reservations[index] = []
    const resArr = this._reservations[index]!
    let i = resArr.indexOf(null)
    if (i === -1) i = resArr.length
    resArr[i] = wire

    const chunkOffset = piece.chunkOffset(reservation)
    const chunkLength = isWebSeed
      ? piece.chunkLengthRemaining?.(reservation)
      : piece.chunkLength(reservation)
    if (chunkLength === undefined) return false

    wire.request(index, chunkOffset, chunkLength, async (err: Error | null, chunk?: Uint8Array) => {
      if (this.destroyed) return
      if (!this.ready)
        return this.once('ready', () => wire.request(index, chunkOffset, chunkLength, arguments[3]))
      if (resArr[i] === wire) resArr[i] = null
      if (piece !== (this.pieces as any[])[index]) return queueMicrotask(() => this.#update())

      if (err) {
        isWebSeed ? piece.cancelRemaining?.(reservation) : piece.cancel(reservation)
        return queueMicrotask(() => this.#update())
      }

      if (!piece.set(reservation, chunk!, wire)) return queueMicrotask(() => this.#update())

      const buf = piece.flush()
      if (!buf) return queueMicrotask(() => this.#update())

      try {
        const u8 =
          buf instanceof Uint8Array
            ? buf
            : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
        if (this.destroyed) return
        const ok = await this.#verifyPieceBufferForVersion(index, u8)
        if (this.destroyed) return
        if (ok) {
          this.store!.put(index, buf, (storeErr: Error | null) => {
            if (storeErr) return this.#destroyTorrent(storeErr)
            ;(this.pieces as any[])[index] = null
            this.#markVerified(index)
            this.wires.forEach((w) => w.have(index))
            this.#checkDone()
            queueMicrotask(() => this.#update())
          })
        } else {
          ;(this.pieces as any[])[index] = new Piece(piece.length)
          this.emit('warning', new Error(`Piece ${index} failed verification`))
          queueMicrotask(() => this.#update())
        }
      } catch {
        queueMicrotask(() => this.#update())
      }
    })

    return true
  }

  #hasNoPieces(): boolean {
    for (let index = 0; index < this.pieces.length; index++) {
      if (this.bitfield!.get(index)) return false
    }
    return true
  }

  #onMetadata(parsedTorrent: ParsedTorrent | this): void {
    if (this.metadata || this.destroyed) return
    this.#debug('got metadata')

    const metadata = parsedTorrent as ParsedTorrent
    if (metadata && (metadata.infoHash || metadata.infoHashV2)) {
      this.#processParsedTorrent(metadata)
    }

    if (this.version === 'v2') {
      const layout = (this as unknown as ParsedTorrent).v2FileLayout
      const plm = (this as unknown as ParsedTorrent).pieceLayersByRootHex
      if (!layout?.length || !plm) {
        return this.#destroyTorrent(
          new Error('Invalid BitTorrent v2 torrent: missing v2 file layout or piece layers')
        )
      }
      try {
        const roots = buildV2ExpectedPieceRoots(layout, this.pieceLength, plm)
        this.pieces = roots as unknown as Piece[]
      } catch (err) {
        return this.#destroyTorrent(err as Error)
      }
    }

    this.metadata = this.torrentFile as any

    if (this.client.enableWebSeeds && this.urlList) {
      this.urlList.forEach((url) => {
        this.addWebSeed(url)
      })
    }

    this.rarityMap = new RarityMap(this)

    this.files = (this.files || []).map((file) => new File(this, file as any))

    let rawStore = this._preloadedStore
    if (!rawStore) {
      rawStore = new this._store(this.pieceLength, {
        ...this.storeOpts,
        torrent: this,
        path: this.path,
        files: this.files,
        length: this.length,
        name: this.name + ' - ' + this.infoHash.slice(0, 8),
        addUID: this.addUID,
        rootDir: this.rootDir,
        max: this._storeCacheSlots,
      })
    }

    if (this._storeCacheSlots > 0 && !(rawStore instanceof MemoryChunkStore)) {
      rawStore = new CacheChunkStore(rawStore, {
        max: this._storeCacheSlots,
      })
    }

    this.store = new ImmediateChunkStore(rawStore)

    if (this.pieces.length !== 0 && !this._startAsDeselected) {
      this.select(0, this.pieces.length - 1)
    }

    this._hashes = this.pieces as any
    const hasStartupBitfield =
      this._startupBitfield &&
      this._startupBitfield.length === Math.ceil(this.pieces.length / 8) &&
      !this.skipVerify

    this.bitfield = new BitField(
      hasStartupBitfield
        ? new Uint8Array(this._startupBitfield as ArrayLike<number>)
        : this.pieces.length
    )
    this._reservations = hasStartupBitfield
      ? (this.pieces as any[]).map((_, index) => (this.bitfield!.get(index) ? null : []))
      : (this.pieces as any[]).map(() => [])

    this.pieces = (this.pieces as any[]).map((_hash, i) => {
      const pieceLength =
        i === (this.pieces as any[]).length - 1 ? this.lastPieceLength : this.pieceLength
      return new Piece(pieceLength)
    }) as any

    this.emit('metadata')

    if (this.destroyed) return

    if (this.skipVerify) {
      this.#markAllVerified()
      this.#onStore()
    } else {
      this.#verifyPieces((err) => {
        if (err) return this.#destroyTorrent(err)
        this.#debug('done verifying')
        this.#onStore()
      })
    }
  }

  #verifyPieces(cb: (err?: Error | null) => void): void {
    if (this.destroyed) return cb()
    const piecesToVerify = (this._hashes as any[]).map((_, i) => i)
    const fsConcurrency = this.client.platform.fsConcurrency
    parallelLimit(
      piecesToVerify.map((index) => (verifyCb: (err?: Error) => void) => {
        this.#verifyPiece(index, (err, isVerified) => {
          if (err) return verifyCb(err)
          if (isVerified) this.#markVerified(index)
          else this.#markUnverified(index)
          verifyCb()
        })
      }),
      fsConcurrency,
      cb
    )
  }

  #verifyPiece(index: number, cb: (err?: Error, isVerified?: boolean) => void): void {
    if (this.destroyed) return cb(new Error('torrent is destroyed'))
    const getOpts: any =
      index === (this.pieces as any[]).length - 1 ? { length: this.lastPieceLength } : {}
    this.store.get(index, getOpts, async (err: Error | null, buf: Uint8Array) => {
      if (this.destroyed) return cb(new Error('torrent is destroyed'))
      if (err) return queueMicrotask(() => cb(undefined, false))
      try {
        if (this.destroyed) return cb(new Error('torrent is destroyed'))
        const ok = await this.#verifyPieceBufferForVersion(index, buf as Uint8Array)
        if (this.destroyed) return cb(new Error('torrent is destroyed'))
        cb(undefined, ok)
      } catch {
        cb(undefined, false)
      }
    })
  }

  #markUnverified(index: number): void {
    const len =
      index === (this.pieces as any[]).length - 1 ? this.lastPieceLength : this.pieceLength
    ;(this.pieces as any[])[index] = new Piece(len)
    this.bitfield!.set(index, false)
    if (!this._startAsDeselected) this.select(index, index)
    for (const file of this.files) {
      if (file.done && file.includes(index)) file.done = false
    }
  }

  #markAllVerified(): void {
    for (let index = 0; index < (this.pieces as any[]).length; index++) {
      this.#markVerified(index)
    }
  }

  #markVerified(index: number): void {
    ;(this.pieces as any[])[index] = null
    this._reservations[index] = null
    this.bitfield!.set(index, true)
    this.emit('verified', index)
  }

  #hasAllPieces(): boolean {
    for (let index = 0; index < (this.pieces as any[]).length; index++) {
      if (!this.bitfield!.get(index)) return false
    }
    return true
  }

  #onStore(): void {
    if (this.destroyed) return
    this.#debug('on store')
    this.#startDiscovery()
    this.ready = true
    this.emit('ready')
    this.wires.forEach((wire) => {
      if (!wire.destroyed) this.#onWireWithMetadata(wire)
    })
    this.#checkDone()
  }

  #checkDone(): boolean {
    if (this.destroyed) return false
    for (const file of this.files) {
      if (file.done) continue
      for (let i = (file as any)._startPiece; i <= (file as any)._endPiece; ++i) {
        if (!this.bitfield!.get(i)) break
      }
      let allPieces = true
      for (let i = (file as any)._startPiece; i <= (file as any)._endPiece; ++i) {
        if (!this.bitfield!.get(i)) {
          allPieces = false
          break
        }
      }
      if (allPieces) {
        file.done = true
        file.emit('done')
      }
    }
    const done = this.files.every((file) => file.done)
    if (!this.done && done) {
      this.done = true
      this.#debug(`torrent done: ${this.infoHash}`)
      this.emit('done')
      if (!this.destroyed && this.discovery) this.discovery.complete()
    }
    this.#checkIdle()
    return done
  }

  #checkIdle(): void {
    if (this.destroyed || this._idleEmitted || !this.ready) return
    let hasWork = false
    if (this.#selections && this.#selections.length > 0) {
      for (let i = 0; i < this.#selections.length; i++) {
        const next = this.#selections.get(i)
        if (!next) continue
        for (let piece = next.from; piece <= next.to; piece++) {
          if (!this.bitfield!.get(piece)) {
            hasWork = true
            break
          }
        }
        if (hasWork) break
      }
    }
    if (!hasWork) {
      this._idleEmitted = true
      this.emit('idle')
    }
  }

  async load(streams: any, cb?: (err?: Error | null) => void): Promise<void> {
    if (this.destroyed) throw new Error('torrent is destroyed')
    if (!this.ready)
      return void this.once('ready', () => {
        void this.load(streams, cb)
      })
    if (!Array.isArray(streams)) streams = [streams]
    if (!cb) cb = () => {}
    try {
      await chunkStoreWrite(this.store, joinIterator(streams), {
        chunkLength: this.pieceLength,
      })
      this.#markAllVerified()
      this.#checkDone()
      cb(null)
    } catch (err) {
      cb(err as Error)
    }
  }

  #rechoke(): void {
    if (!this.ready) return

    const wireStack = this.wires
      .map((wire) => ({
        wire,
        random: Math.random(),
        downspeed:
          typeof (wire as any).downloadSpeed === 'function' ? (wire as any).downloadSpeed() : 0,
      }))
      .sort((objA, objB) => {
        if (objA.downspeed !== objB.downspeed) return objA.downspeed - objB.downspeed
        const aup =
          typeof (objA.wire as any).uploadSpeed === 'function'
            ? (objA.wire as any).uploadSpeed()
            : 0
        const bup =
          typeof (objB.wire as any).uploadSpeed === 'function'
            ? (objB.wire as any).uploadSpeed()
            : 0
        if (aup !== bup) return aup - bup
        if ((objA.wire as any).amChoking !== (objB.wire as any).amChoking) {
          return (objA.wire as any).amChoking ? -1 : 1
        }
        return objA.random - objB.random
      })
      .map((obj) => obj.wire)

    if (this.#rechokeOptimisticTime <= 0) {
      this.#rechokeOptimisticWire = null
    } else {
      this.#rechokeOptimisticTime -= 1
    }

    let numInterestedUnchoked = 0
    while (wireStack.length > 0 && numInterestedUnchoked < this.#rechokeNumSlots - 1) {
      const wire = wireStack.pop()!
      if ((wire as any).isSeeder || wire === this.#rechokeOptimisticWire) continue
      wire.unchoke()
      if ((wire as any).peerInterested) numInterestedUnchoked++
    }

    if (this.#rechokeOptimisticWire === null && this.#rechokeNumSlots > 0) {
      const remaining = wireStack.filter((wire) => (wire as any).peerInterested)
      if (remaining.length > 0) {
        const newOptimisticPeer = remaining[Math.floor(Math.random() * remaining.length)]
        newOptimisticPeer.unchoke()
        this.#rechokeOptimisticWire = newOptimisticPeer
        this.#rechokeOptimisticTime = RECHOKE_OPTIMISTIC_DURATION
      }
    }

    wireStack.filter((wire) => wire !== this.#rechokeOptimisticWire).forEach((wire) => wire.choke())
  }

  pause(): void {
    if (this.destroyed) return
    this.#debug('pause')
    this.paused = true
  }

  resume(): void {
    if (this.destroyed) return
    this.#debug('resume')
    this.paused = false
    this.#drain()
  }

  #debug(...args: unknown[]): void {
    if (typeof args[0] === 'string') {
      args[0] = `[${this.client.debugId}] [${this.#instanceDebugId}] ${args[0]}`
    }
    const log = debug as (...a: unknown[]) => void
    log(...args)
  }

  #drain(): void {
    const platform = this.client.platform
    const connectPeer = platform.connectPeer

    this.#debug(
      '_drain numConns %s maxConns %s _peersLength %s',
      this.#numConns,
      this.client.maxConns,
      this._peersLength
    )
    if (!connectPeer || this.destroyed || this.paused || this.#numConns >= this.client.maxConns) {
      return
    }
    this.#debug(
      'drain (%s queued, %s/%s peers)',
      this.#getQueuedPeerCount(),
      this.numPeers,
      this.client.maxConns
    )

    const peer = this._queue.shift()
    if (!peer) return

    this.#debug('%s connect attempt to %s', peer.type, peer.addr)

    const parts = addrToIPPort(peer.addr!)
    const conn = connectPeer(
      { host: parts[0], port: parts[1] },
      this.client.utp && peer.type === Peer.TYPE_UTP_OUTGOING ? 'utp' : 'tcp',
      this.client
    ) as {
      once(event: string, fn: (...args: unknown[]) => void): void
      on(event: string, fn: (...args: unknown[]) => void): void
    } | null

    if (!conn) return

    peer.conn = conn

    conn.once('connect', () => {
      if (!this.destroyed) peer.onConnect()
    })
    conn.once('error', (...args: unknown[]) => {
      peer.destroy(args[0] as Error)
    })
    peer.startConnectTimeout()

    conn.on('close', () => {
      if (this.destroyed) return

      if (peer.retries >= RECONNECT_WAIT.length) {
        if (this.client.utp) {
          const newPeer = this.#addPeer(peer.addr!, 'tcp', peer.source!)
          if (newPeer) newPeer.retries = 0
        } else {
          this.#debug(
            'conn %s closed: will not re-add (max %s attempts)',
            peer.addr,
            RECONNECT_WAIT.length
          )
        }
        return
      }

      const ms = RECONNECT_WAIT[peer.retries]
      this.#debug(
        'conn %s closed: will re-add to queue in %sms (attempt %s)',
        peer.addr,
        ms,
        peer.retries + 1
      )

      const reconnectTimeout = setTimeout(() => {
        if (this.destroyed) return
        const host = addrToIPPort(peer.addr!)[0]
        const type = this.client.utp && this.#isIPv4(host) ? 'utp' : 'tcp'
        const newPeer = this.#addPeer(peer.addr!, type, peer.source!)
        if (newPeer) newPeer.retries = peer.retries + 1
      }, ms)
      if ((reconnectTimeout as any).unref) (reconnectTimeout as any).unref()
    })
  }

  #validAddr(addr: string): boolean {
    let parts
    try {
      parts = addrToIPPort(addr)
    } catch (e) {
      return false
    }
    const host = parts[0]
    const port = parts[1]
    return port > 0 && port < 65535 && !(host === '127.0.0.1' && port === this.client.torrentPort)
  }

  #isIPv4(addr: string): boolean {
    const IPv4Pattern =
      /^((?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])[.]){3}(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])$/
    return IPv4Pattern.test(addr)
  }

  #destroyTorrent(err?: Error, opts?: any, cb?: () => void): void {
    if (typeof opts === 'function') return this.#destroyTorrent(err, null, opts)
    if (this.destroyed) return
    this.destroyed = true
    this.#debug('destroy')

    this.client.removeTorrentFromClient(this)

    if (this.#rechokeIntervalId) {
      clearInterval(this.#rechokeIntervalId)
      this.#rechokeIntervalId = null
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

    const tasks: Array<(cb: (err?: Error) => void) => void> = []

    if (this.store) {
      const destroyStore =
        opts?.destroyStore !== undefined ? opts.destroyStore : this._destroyStoreOnDestroy
      tasks.push((storeCb) => {
        if (destroyStore) {
          this.store!.destroy(storeCb)
        } else {
          this.store!.close(storeCb)
        }
      })
    }

    parallel(tasks, (_parallelErr: Error | null | undefined) => {
      if (err) {
        if (this.listenerCount('error') === 0) {
          this.client.emit('error', err)
        } else {
          this.emit('error', err)
        }
      }
      this.emit('close')
      cb?.()
    })
  }


  destroyWithError(err: Error, cb?: () => void): void {
    this.#destroyTorrent(err, undefined, cb)
  }

  destroy(opts?: any, cb?: (err?: Error) => void): void {
    if (typeof opts === 'function') return this.destroy(null, opts)
    this.#destroyTorrent(undefined, opts, cb)
  }

  addPeer(peer: string, source?: string): boolean {
    if (this.destroyed) throw new Error('torrent is destroyed')
    if (!this.infoHash) throw new Error('addPeer() must not be called before the `infoHash` event')

    let host: string | undefined
    try {
      const parts = addrToIPPort(peer)
      host = parts[0]
    } catch {
      this.#debug('ignoring peer: invalid %s', peer)
      this.emit('invalidPeer', peer)
      return false
    }

    if ((this.client as any).blocked && host && (this.client as any).blocked.contains(host)) {
      this.#debug('ignoring peer: blocked %s', peer)
      this.emit('blockedPeer', peer)
      return false
    }

    const type = this.client.utp && this.#isIPv4(host) ? 'utp' : 'tcp'
    const wasAdded = !!this.#addPeer(peer, type, source ?? 'manual')

    if (wasAdded) this.emit('peer', peer)
    else this.emit('invalidPeer', peer)
    return wasAdded
  }

  removePeer(peer: string | any): void {
    const id = peer?.id ?? peer
    let peerObj = peer
    if (peer && typeof peer === 'object' && !peer.id) {
      peerObj = this._peers?.get(id)
    } else if (typeof peer === 'string') {
      peerObj = this._peers?.get(id)
    }

    if (!peerObj) return
    peerObj.destroy()

    if (this.destroyed) return

    this.#debug('removePeer %s', id)

    if (this._peers.has(id)) {
      this._peers.delete(id)
      this._peersLength -= 1
    }

    this.#drain()
  }

  addWebSeed(urlOrConn: string | any): void {
    if (this.destroyed) throw new Error('torrent is destroyed')

    let id: string
    let conn: any

    if (typeof urlOrConn === 'string') {
      id = urlOrConn

      if (!/^https?:\/\/.+/.test(id)) {
        this.emit('warning', new Error(`ignoring invalid web seed: ${id}`))
        this.emit('invalidPeer', id)
        return
      }

      if (this._peers.has(id)) {
        this.emit('warning', new Error(`ignoring duplicate web seed: ${id}`))
        this.emit('invalidPeer', id)
        return
      }

      conn = new WebConn(id, this)
    } else if (urlOrConn && typeof urlOrConn.connId === 'string') {
      conn = urlOrConn
      id = conn.connId

      if (this._peers.has(id)) {
        this.emit('warning', new Error(`ignoring duplicate web seed: ${id}`))
        this.emit('invalidPeer', id)
        return
      }
    } else {
      this.emit(
        'warning',
        new Error('addWebSeed must be passed a string or connection object with id property')
      )
      return
    }

    this.#debug('add web seed %s', id)

    const newPeer = Peer.createWebSeedPeer(conn, id, this, this.client.throttleGroups)

    this.#registerPeer(newPeer)

    this.emit('peer', id)
  }

  removeWebSeed(url: string): void {
    this.removePeer(url)
  }

  select(start: number, end: number, priority?: number, notify?: () => void): void {
    this.#select(start, end, priority ?? 0, notify ?? null, false)
  }

  deselect(start: number, end: number): void {
    this.#deselect(start, end, false)
  }

  /** Piece range for streaming reads (FileIterator); marks selection as stream-scoped. */
  selectStreamPieces(start: number, end: number): void {
    this.#select(start, end, 1, null, true)
  }

  deselectStreamPieces(start: number, end: number): void {
    this.#deselect(start, end, true)
  }

  /** Snapshot of non-stream piece intervals (for tests / diagnostics). */
  getPieceSelectionRanges(): Array<{ from: number; to: number }> {
    return this.#selections.toArray()
  }

  critical(start: number, end: number): void {
    if (this.destroyed) throw new Error('torrent is destroyed')
    for (let i = start; i <= end; ++i) {
      this._critical[i] = 1
    }
  }

  #select(
    start: number,
    end: number,
    priority: number,
    notify?: (() => void) | null,
    isStreamSelection?: boolean
  ): void {
    if (this.destroyed) return
    if (start > end) return
    const stream = isStreamSelection ?? false
    this.#selections.insert({
      from: start,
      to: end,
      offset: 0,
      priority,
      ...(notify != null
        ? { notify }
        : stream
          ? { notify: () => {} }
          : {}),
      isStreamSelection: stream,
    })
  }

  #deselect(start: number, end: number, isStreamSelection?: boolean): void {
    if (this.destroyed) return
    this.#selections.remove({ from: start, to: end, isStreamSelection: isStreamSelection ?? false })
  }
}
