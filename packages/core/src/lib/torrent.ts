/**
 * Torrent class — platform-agnostic core logic.
 * Uses client.platform (PlatformAdapter) for platform-specific operations.
 */

import { EventEmitter } from 'eventemitter3'
import { addrToIPPort } from '@z-torrent/utils/addr-ip-port'
import { Piece } from '@z-torrent/utils/piece'
import BitField from 'bitfield'
import CacheChunkStore from 'cache-chunk-store'
import { chunkStoreWrite } from 'chunk-store-iterator'
import debugFactory from 'debug'
import fetch from 'cross-fetch-ponyfill'
import ImmediateChunkStore from 'immediate-chunk-store'
import ltDontHave from 'lt_donthave'
import joinIterator from 'join-async-iterator'
import parallel from 'run-parallel'
import parallelLimit from 'run-parallel-limit'
import parseTorrent, { toMagnetURI, toTorrentFile, remote } from '@z-torrent/parse'

import randomIterate from 'random-iterate'
import { hash, arr2hex } from 'uint8-util'
import throughput from 'throughput'
import { createUtMetadata } from '@z-torrent/ut-metadata'
import { UtPex } from '@z-torrent/ut-pex'

import File from './file.js'
import Peer, { type PeerSwarm, type ThrottleGroups } from './peer.js'
import RarityMap from './rarity-map.js'
import WebConn from './webconn.js'
import { Selections } from '../selections.js'
import MemoryChunkStore from 'memory-chunk-store'
import type { PlatformAdapter } from '../interfaces.js'
import type { TorrentWire, TorrentForFile } from './types.js'

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
  infoHash: string
  infoHashBuffer: Uint8Array
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
  pieces: Uint8Array[]
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

export interface WebTorrentClient {
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
  _server?: { pathname: string }
  _debugId: string
  _downloadSpeed: (bytes?: number) => number
  _uploadSpeed: (bytes?: number) => number
  _remove: (torrent: Torrent) => void
  listening: boolean
  on: (event: string, fn: (...args: unknown[]) => void) => void
  once: (event: string, fn: (...args: unknown[]) => void) => void
  emit: (event: string, ...args: unknown[]) => boolean
}

export default class Torrent
  extends EventEmitter
  implements TorrentWire, TorrentForFile, PeerSwarm
{
  private _debugId: string
  client: WebTorrentClient
  announce?: string[]
  urlList?: string[]
  path: string | null
  addUID: boolean
  rootDir: FileSystemDirectoryHandle | null
  skipVerify: boolean
  private _startupBitfield?: Uint8Array | ArrayLike<number>
  _hasStartupBitfield: boolean = false
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
  private _queue: Peer[]
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
  infoHashBuffer: Uint8Array = new Uint8Array(0)
  infoHashHash: string = ''
  name: string = ''
  info?: Record<string, unknown>
  length: number = 0
  pieceLength: number = 0
  lastPieceLength: number = 0
  pieces_: Uint8Array[] = []
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
  private _reservations: (any[] | null)[] = []
  private _hashes: Uint8Array[] = []
  private _idleEmitted: boolean = false

  constructor(
    torrentId: string | ArrayBufferView | ParsedTorrent | null,
    client: WebTorrentClient,
    opts: TorrentOpts = {}
  ) {
    super()

    const platform = client.platform

    this._debugId = 'unknown infohash'
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
      remote(
        torrentId as any,
        { headers: { 'user-agent': 'Z-Torrent/0.1 (https://github.com/skrylnikov/z-torrent)' } },
        (err: Error | null, parsedTorrent: ParsedTorrent) => {
          if (this.destroyed) return
          if (err) return this._destroy(err)
          this._onParsedTorrent(parsedTorrent)
        }
      )
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

    if (this.client.listening) {
      this._onListening()
    } else {
      this.client.once('listening', () => {
        this._onListening()
      })
    }
  }

  _processParsedTorrent(parsedTorrent: ParsedTorrent): void {
    this._debugId = arr2hex(parsedTorrent.infoHashBuffer as any).substring(0, 7)

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

    const magnetOpts = { ...parsedTorrent } as any
    if (magnetOpts.xs === undefined) delete magnetOpts.xs
    this.magnetURI = toMagnetURI(magnetOpts)
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

    this.discovery = this.client.platform.createDiscovery({
      infoHash: this.infoHash,
      announce: this.announce,
      peerId: this.client.peerId,
      dht: !(this as any).private && this.client.dht,
      tracker: trackerOpts,
      port: this.client.torrentPort,
      userAgent: USER_AGENT,
      lsd: this.client.lsd,
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
    const urls = Array.isArray(this.xs) ? this.xs : [this.xs]
    const controller = new AbortController()
    ;(this as any)._xsRequestsController = controller
    const signal = controller.signal

    const tasks = urls.map((url: string) => (cb: (err?: Error) => void) => {
      this._getMetadataFromURL(url, signal, cb)
    })
    parallel(tasks)
  }

  private async _getMetadataFromURL(
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

      if (parsedTorrent.infoHash !== this.infoHash) {
        this.emit(
          'warning',
          new Error(`got torrent file with incorrect info hash from xs param: ${url}`)
        )
        return cb()
      }

      this._onMetadata(parsedTorrent as any)
      cb()
    } catch (err) {
      this.emit('warning', new Error(`http error from xs param: ${(err as Error).message}`))
      cb()
    }
  }

  _registerPeer(newPeer: Peer): void {
    newPeer.on('download', (downloaded: number) => {
      if (this.destroyed) return
      this.received += downloaded
      this._downloadSpeed(downloaded)
      this.client._downloadSpeed(downloaded)
      this.emit('download', downloaded)
      if (this.destroyed) return
      this.client.emit('download', downloaded)
    })

    newPeer.on('upload', (uploaded: number) => {
      if (this.destroyed) return
      this.uploaded += uploaded
      this._uploadSpeed(uploaded)
      this.client._uploadSpeed(uploaded)
      this.emit('upload', uploaded)
      if (this.destroyed) return
      this.client.emit('upload', uploaded)
    })

    if (newPeer.connected) {
      this._numConns += 1
    } else {
      newPeer.once('connect', () => {
        if (this.destroyed) return
        this._numConns += 1
      })
    }
    newPeer.once('disconnect', () => {
      this._numConns -= 1
    })

    this._peers.set(newPeer.id, newPeer)
    this._peersLength += 1
  }

  _addIncomingPeer(peer: Peer): void {
    if (this.destroyed) return peer.destroy(new Error('torrent is destroyed'))
    if (this.paused) return peer.destroy(new Error('torrent is paused'))

    this._debug('add incoming peer %s', peer.id)

    this._registerPeer(peer)
  }

  _addPeer(addr: string, type: string, source: string): Peer | null {
    if (this.destroyed) return null
    if (typeof addr === 'string' && !this._validAddr(addr)) {
      this._debug('ignoring peer: invalid %s', addr)
      return null
    }

    const id = addr
    if (this._peers.has(id)) {
      this._debug('ignoring peer: duplicate (%s)', id)
      return null
    }

    if (this.paused) {
      this._debug('ignoring peer: torrent is paused')
      return null
    }

    this._debug('add peer %s', id)

    const newPeer =
      type === 'utp'
        ? Peer.createUTPOutgoingPeer(addr, this, this.client.throttleGroups, source as any)
        : Peer.createTCPOutgoingPeer(addr, this, this.client.throttleGroups, source as any)

    this._registerPeer(newPeer)

    this._queue.push(newPeer)
    this._drain()

    return newPeer
  }

  _addWebPeer(peer: any, source: string): void {
    if (this.destroyed) {
      if (typeof peer !== 'string') peer.destroy()
      return
    }

    const id = (peer && peer.id) || peer
    if (this._peers.has(id)) {
      this._debug('ignoring peer: duplicate (%s)', id)
      if (typeof peer !== 'string') peer.destroy()
      return
    }

    if (this.paused) {
      this._debug('ignoring peer: torrent is paused')
      if (typeof peer !== 'string') peer.destroy()
      return
    }

    this._debug('add peer %s', id)

    const newPeer = Peer.createWebRTCPeer(peer, this, this.client.throttleGroups, source as any)

    this._registerPeer(newPeer)
  }

  _onWire(wire: any, addr?: string): void {
    this._debug('got wire %s (%s)', (wire as any)._debugId, addr || 'Unknown')

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
          return this._debug('ignoring PORT from peer with no address')
        if (port === 0 || port > 65536) return this._debug('ignoring invalid PORT from peer')
        this._debug('port: %s (from %s)', port, addr)
        ;(this.client.dht as any).addNode({ host: (wire as any).remoteAddress, port })
      })
    }

    wire.on('timeout', () => {
      this._debug('wire timeout (%s)', addr)
      wire.destroy()
    })

    if ((wire as any).type !== 'webSeed') {
      wire.setTimeout(PIECE_TIMEOUT, true)
    }

    wire.setKeepAlive(true)

    wire.use(createUtMetadata(this.metadata))
    ;(wire as any).ut_metadata.on('warning', (err: Error) => {
      this._debug('ut_metadata warning: %s', err.message)
    })

    if (!this.metadata) {
      ;(wire as any).ut_metadata.on('metadata', async (metadata: any) => {
        this._debug('got metadata via ut_metadata')
        try {
          const parsed = await parseTorrent(metadata)
          this._onMetadata(parsed as any)
        } catch (err) {
          this._destroy(err as Error)
        }
      })
      ;(wire as any).ut_metadata.fetch()
    }

    if (this.client.utPex && !(this as any).private) {
      wire.use(UtPex)
      ;(wire as any).ut_pex.on('peer', (peer: string) => {
        if (!(this.client as any).seedOutgoingConnections && this.done) {
          this._debug(
            'ut_pex ignoring peer %s: torrent is done and seedOutgoingConnections is false',
            peer
          )
          return
        }
        this._debug('ut_pex: got peer: %s (from %s)', peer, addr)
        this.addPeer(peer, Peer.SOURCE_UT_PEX)
      })
      ;(wire as any).ut_pex.on('dropped', (peer: string) => {
        const peerObj = this._peers.get(peer)
        if (peerObj && !peerObj.connected) {
          this._debug('ut_pex: dropped peer: %s (from %s)', peer, addr)
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
        this._onWireWithMetadata(wire)
      })
    }
  }

  _onWireWithMetadata(wire: any): void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const onChokeTimeout = () => {
      if (this.destroyed || wire.destroyed) return
      if (this._numQueued > 2 * (this._numConns - this.numPeers) && (wire as any).amInterested) {
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
      this._update()
      this._updateWireInterest(wire)
    })

    wire.on('have', () => {
      updateSeedStatus()
      this._update()
      this._updateWireInterest(wire)
    })
    ;(wire as any).lt_donthave?.on('donthave', () => {
      updateSeedStatus()
      this._update()
      this._updateWireInterest(wire)
    })

    wire.on('have-all', () => {
      ;(wire as any).isSeeder = true
      if (this.alwaysChokeSeeders) wire.choke()
      this._update()
      this._updateWireInterest(wire)
    })

    wire.on('have-none', () => {
      ;(wire as any).isSeeder = false
      this._update()
      this._updateWireInterest(wire)
    })

    wire.on('allowed-fast', () => {
      this._update()
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
      this._update()
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

    if ((wire as any).hasFast && this._hasAllPieces()) wire.haveAll()
    else if ((wire as any).hasFast && this._hasNoPieces()) wire.haveNone()
    else wire.bitfield(this.bitfield!)

    this._updateWireInterest(wire)

    if ((wire as any).peerExtensions?.dht && this.client.dht?.listening) {
      wire.port((this.client.dht as any).address().port)
    }

    if ((wire as any).type !== 'webSeed') {
      timeoutId = setTimeout(onChokeTimeout, CHOKE_TIMEOUT)
      if ((timeoutId as any)?.unref) (timeoutId as any).unref()
    }

    ;(wire as any).isSeeder = false
    updateSeedStatus()
  }

  _updateWireInterest(wire: any): void {
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

  _update(): void {
    const idleCallback = this.client.platform.idleCallback
    if (idleCallback) {
      idleCallback(() => this._updateWireWrapper(), { timeout: 250 })
    } else {
      this._updateWireWrapper()
    }
  }

  _updateWireWrapper(): void {
    if (this.destroyed) return
    const ite = randomIterate(this.wires)
    let wire
    while ((wire = ite())) {
      this._updateWire(wire)
    }
    this._checkIdle()
  }

  _updateWire(wire: any): boolean {
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

    const selections = this._selections
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
          if (this._request(wire, piece, (this._critical as any)?.[piece] || false)) return true
        }
      }
    }
    return false
  }

  _request(wire: any, index: number, hotswap: boolean): boolean {
    if (this.bitfield!.get(index)) return false
    const piece = (this.pieces as any[])[index]
    if (!piece) return false
    const isWebSeed = (wire as any).type === 'webSeed'
    const reservation = isWebSeed ? piece.reserveRemaining?.() : piece.reserve?.()
    if (reservation === -1) return false

    const r = this._reservations[index]
    if (!r) this._reservations[index] = []
    const resArr = this._reservations[index]
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
      if (piece !== (this.pieces as any[])[index]) return queueMicrotask(() => this._update())

      if (err) {
        isWebSeed ? piece.cancelRemaining?.(reservation) : piece.cancel(reservation)
        return queueMicrotask(() => this._update())
      }

      if (!piece.set(reservation, chunk!, wire)) return queueMicrotask(() => this._update())

      const buf = piece.flush()
      if (!buf) return queueMicrotask(() => this._update())

      try {
        const hex = await hash(buf as any, 'hex')
        if (this.destroyed) return
        const expected = (this._hashes as any)[index]
        const expectedHex = ArrayBuffer.isView(expected) ? arr2hex(expected) : (expected as string)
        if (hex === expectedHex) {
          this.store!.put(index, buf, (storeErr: Error | null) => {
            if (storeErr) return this._destroy(storeErr)
            ;(this.pieces as any[])[index] = null
            this._markVerified(index)
            this.wires.forEach((w) => w.have(index))
            this._checkDone()
            queueMicrotask(() => this._update())
          })
        } else {
          ;(this.pieces as any[])[index] = new Piece(piece.length)
          this.emit('warning', new Error(`Piece ${index} failed verification`))
          queueMicrotask(() => this._update())
        }
      } catch {
        queueMicrotask(() => this._update())
      }
    })

    return true
  }

  _hasNoPieces(): boolean {
    for (let index = 0; index < this.pieces.length; index++) {
      if (this.bitfield!.get(index)) return false
    }
    return true
  }

  _onMetadata(parsedTorrent: ParsedTorrent | this): void {
    if (this.metadata || this.destroyed) return
    this._debug('got metadata')

    const metadata = parsedTorrent as ParsedTorrent
    if (metadata && metadata.infoHash) {
      this._processParsedTorrent(metadata)
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

    this._hasStartupBitfield = !!hasStartupBitfield

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
      this._markAllVerified()
      this._onStore()
    } else {
      this._verifyPieces((err) => {
        if (err) return this._destroy(err)
        this._debug('done verifying')
        this._onStore()
      })
    }
  }

  _verifyPieces(cb: (err?: Error) => void): void {
    if (this.destroyed) return cb()
    const piecesToVerify = (this._hashes as any[]).map((_, i) => i)
    const fsConcurrency = this.client.platform.fsConcurrency
    parallelLimit(
      piecesToVerify.map((index) => (verifyCb: (err?: Error) => void) => {
        this._verifyPiece(index, (err, isVerified) => {
          if (err) return verifyCb(err)
          if (isVerified) this._markVerified(index)
          else this._markUnverified(index)
          verifyCb()
        })
      }),
      fsConcurrency,
      cb
    )
  }

  _verifyPiece(index: number, cb: (err?: Error, isVerified?: boolean) => void): void {
    if (this.destroyed) return cb(new Error('torrent is destroyed'))
    const getOpts: any =
      index === (this.pieces as any[]).length - 1 ? { length: this.lastPieceLength } : {}
    this.store.get(index, getOpts, async (err: Error | null, buf: Uint8Array) => {
      if (this.destroyed) return cb(new Error('torrent is destroyed'))
      if (err) return queueMicrotask(() => cb(undefined, false))
      try {
        const hex = await hash(buf as any, 'hex')
        if (this.destroyed) return cb(new Error('torrent is destroyed'))
        const expected = (this._hashes as any)[index]
        const expectedHex = ArrayBuffer.isView(expected) ? arr2hex(expected) : (expected as string)
        cb(undefined, hex === expectedHex)
      } catch {
        cb(undefined, false)
      }
    })
  }

  _markUnverified(index: number): void {
    const len =
      index === (this.pieces as any[]).length - 1 ? this.lastPieceLength : this.pieceLength
    ;(this.pieces as any[])[index] = new Piece(len)
    this.bitfield!.set(index, false)
    if (!this._startAsDeselected) this.select(index, index)
    for (const file of this.files) {
      if (file.done && file.includes(index)) file.done = false
    }
  }

  _markAllVerified(): void {
    for (let index = 0; index < (this.pieces as any[]).length; index++) {
      this._markVerified(index)
    }
  }

  _markVerified(index: number): void {
    ;(this.pieces as any[])[index] = null
    this._reservations[index] = null
    this.bitfield!.set(index, true)
    this.emit('verified', index)
  }

  _hasAllPieces(): boolean {
    for (let index = 0; index < (this.pieces as any[]).length; index++) {
      if (!this.bitfield!.get(index)) return false
    }
    return true
  }

  _onStore(): void {
    if (this.destroyed) return
    this._debug('on store')
    this._startDiscovery()
    this.ready = true
    this.emit('ready')
    this.wires.forEach((wire) => {
      if (!wire.destroyed) this._onWireWithMetadata(wire)
    })
    this._checkDone()
  }

  _checkDone(): boolean {
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
      this._debug(`torrent done: ${this.infoHash}`)
      this.emit('done')
      if (!this.destroyed && this.discovery) (this.discovery as any).complete?.()
    }
    this._checkIdle()
    return done
  }

  _checkIdle(): void {
    if (this.destroyed || this._idleEmitted || !this.ready) return
    let hasWork = false
    if (this._selections && this._selections.length > 0) {
      for (let i = 0; i < this._selections.length; i++) {
        const next = this._selections.get(i)
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
    if (!this.ready) return this.once('ready', () => this.load(streams, cb))
    if (!Array.isArray(streams)) streams = [streams]
    if (!cb) cb = () => {}
    try {
      await chunkStoreWrite(this.store, joinIterator(streams), {
        chunkLength: this.pieceLength,
      })
      this._markAllVerified()
      this._checkDone()
      cb(null)
    } catch (err) {
      cb(err as Error)
    }
  }

  _rechoke(): void {
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

    if (this._rechokeOptimisticTime <= 0) {
      this._rechokeOptimisticWire = null
    } else {
      this._rechokeOptimisticTime -= 1
    }

    let numInterestedUnchoked = 0
    while (wireStack.length > 0 && numInterestedUnchoked < this._rechokeNumSlots - 1) {
      const wire = wireStack.pop()!
      if ((wire as any).isSeeder || wire === this._rechokeOptimisticWire) continue
      wire.unchoke()
      if ((wire as any).peerInterested) numInterestedUnchoked++
    }

    if (this._rechokeOptimisticWire === null && this._rechokeNumSlots > 0) {
      const remaining = wireStack.filter((wire) => (wire as any).peerInterested)
      if (remaining.length > 0) {
        const newOptimisticPeer = remaining[Math.floor(Math.random() * remaining.length)]
        newOptimisticPeer.unchoke()
        this._rechokeOptimisticWire = newOptimisticPeer
        this._rechokeOptimisticTime = RECHOKE_OPTIMISTIC_DURATION
      }
    }

    wireStack.filter((wire) => wire !== this._rechokeOptimisticWire).forEach((wire) => wire.choke())
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
    args[0] = `[${this.client._debugId}] [${this._debugId}] ${args[0]}`
    debug(...args)
  }

  _drain(): void {
    const platform = this.client.platform
    const connectPeer = platform.connectPeer

    this._debug(
      '_drain numConns %s maxConns %s _peersLength %s',
      this._numConns,
      this.client.maxConns,
      this._peersLength
    )
    if (!connectPeer || this.destroyed || this.paused || this._numConns >= this.client.maxConns) {
      return
    }
    this._debug(
      'drain (%s queued, %s/%s peers)',
      this._numQueued,
      this.numPeers,
      this.client.maxConns
    )

    const peer = this._queue.shift()
    if (!peer) return

    this._debug('%s connect attempt to %s', peer.type, peer.addr)

    const parts = addrToIPPort(peer.addr!)
    const conn = connectPeer(
      { host: parts[0], port: parts[1] },
      this.client.utp && peer.type === Peer.TYPE_UTP_OUTGOING ? 'utp' : 'tcp',
      this.client
    )

    if (!conn) return

    peer.conn = conn

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
        if (this.client.utp) {
          const newPeer = this._addPeer(peer.addr!, 'tcp', peer.source!)
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
        const host = addrToIPPort(peer.addr!)[0]
        const type = this.client.utp && this._isIPv4(host) ? 'utp' : 'tcp'
        const newPeer = this._addPeer(peer.addr!, type, peer.source!)
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
    return port > 0 && port < 65535 && !(host === '127.0.0.1' && port === this.client.torrentPort)
  }

  _isIPv4(addr: string): boolean {
    const IPv4Pattern =
      /^((?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])[.]){3}(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])$/
    return IPv4Pattern.test(addr)
  }

  _destroy(err?: Error, opts?: any, cb?: () => void): void {
    if (typeof opts === 'function') return this._destroy(err, null, opts)
    if (this.destroyed) return
    this.destroyed = true
    this._debug('destroy')

    this.client._remove(this)

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

    parallel(tasks, (parallelErr) => {
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

  destroy(opts?: any, cb?: (err?: Error) => void): void {
    if (typeof opts === 'function') return this.destroy(null, opts)
    this._destroy(undefined, opts, cb)
  }

  addPeer(peer: string, source?: string): boolean {
    if (this.destroyed) throw new Error('torrent is destroyed')
    if (!this.infoHash) throw new Error('addPeer() must not be called before the `infoHash` event')

    let host: string | undefined
    try {
      const parts = addrToIPPort(peer)
      host = parts[0]
    } catch {
      this._debug('ignoring peer: invalid %s', peer)
      this.emit('invalidPeer', peer)
      return false
    }

    if ((this.client as any).blocked && host && (this.client as any).blocked.contains(host)) {
      this._debug('ignoring peer: blocked %s', peer)
      this.emit('blockedPeer', peer)
      return false
    }

    const type = this.client.utp && this._isIPv4(host) ? 'utp' : 'tcp'
    const wasAdded = !!this._addPeer(peer, type, source ?? 'manual')

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

    this._debug('removePeer %s', id)

    if (this._peers.has(id)) {
      this._peers.delete(id)
      this._peersLength -= 1
    }

    this._drain()
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

    this._debug('add web seed %s', id)

    const newPeer = Peer.createWebSeedPeer(conn, id, this, this.client.throttleGroups)

    this._registerPeer(newPeer)

    this.emit('peer', id)
  }

  removeWebSeed(url: string): void {
    this.removePeer(url)
  }

  select(start: number, end: number, priority?: number, notify?: () => void): void {
    this._select(start, end, priority ?? 0, notify ?? null, false)
  }

  deselect(start: number, end: number): void {
    this._deselect(start, end, false)
  }

  critical(start: number, end: number): void {
    if (this.destroyed) throw new Error('torrent is destroyed')
    for (let i = start; i <= end; ++i) {
      this._critical[i] = true
    }
  }

  _select(
    start: number,
    end: number,
    priority: number,
    notify?: (() => void) | null,
    isStreamSelection?: boolean
  ): void {
    if (this.destroyed) return
    if (start > end) return
    this._selections.insert({
      from: start,
      to: end,
      offset: 0,
      priority,
      notify: notify ?? undefined,
      isStreamSelection: isStreamSelection ?? false,
    })
  }

  _deselect(start: number, end: number, isStreamSelection?: boolean): void {
    if (this.destroyed) return
    this._selections.remove({ from: start, to: end, isStreamSelection: isStreamSelection ?? false })
  }
}
