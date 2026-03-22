import { EventEmitter } from 'eventemitter3'
import parallel from 'run-parallel'
import { parseTorrent } from '@z-torrent/parse'
import type { Instance as ParseInstance } from '@z-torrent/parse'
import type { IPInput, IPSet } from '@z-torrent/utils'

import { hash, hex2arr, arr2hex, arr2base, text2arr, randomBytes } from 'uint8-util'
import throughput from 'throughput'
import { ThrottleGroup } from 'speed-limiter'

import { Torrent } from './lib/torrent.js'
import { enableSecure } from './lib/peer.js'
import { parsedTorrentMatchesTorrent, sameTorrentIdentity } from './lib/torrent-identity.js'
import debugFactory from 'debug'
import type {
  ConnectionPoolInstance,
  DHTInstance,
  NatTraversalInstance,
  PlatformAdapter,
  Server,
  ServerOptions,
} from './interfaces.js'
import type { ParsedTorrent, TorrentOpts, ZTorrentClient } from './lib/torrent.js'
import type { TorrentDestroyOpts, TrackerOpts } from './client-types.js'

import { VERSION_STR } from './version.js'

export type {
  TorrentDestroyOpts,
  TrackerAnnounceOpts,
  TrackerOpts,
  TrackerProxyOpts,
} from './client-types.js'

/** Value that identifies a torrent for `get` / `add` / `remove`. */
export type TorrentId =
  | string
  | ArrayBufferView
  | ParsedTorrent
  | ParseInstance
  | Torrent
  | null

const debug = debugFactory('@z-torrent/core:client')

const VERSION_PREFIX = `-WW${VERSION_STR}-`

/** Runtime API of `speed-limiter` ThrottleGroup (types package incomplete). */
interface ThrottleGroupControl {
  setRate(rate: number): void
  setEnabled(enabled: boolean): void
  destroy(): void
}

export interface ZTorrentCoreOpts {
  platform: PlatformAdapter
  peerId?: string | ArrayBufferView
  nodeId?: string | ArrayBufferView
  torrentPort?: number
  dhtPort?: number
  tracker?: boolean | TrackerOpts
  lsd?: boolean
  utPex?: boolean
  natUpnp?: boolean | string
  natPmp?: boolean
  maxConns?: number
  utp?: boolean
  seedOutgoingConnections?: boolean
  downloadLimit?: number
  uploadLimit?: number
  blocklist?: string | IPInput[]
  dht?: boolean | Record<string, unknown>
  webSeeds?: boolean
  secure?: boolean
}

export class ZTorrentCore extends EventEmitter implements ZTorrentClient {
  platform: PlatformAdapter
  peerId: string
  peerIdBuffer: Uint8Array
  nodeId: string
  nodeIdBuffer: Uint8Array
  readonly debugId: string
  destroyed: boolean
  listening: boolean
  ready: boolean
  torrentPort: number
  dhtPort: number
  tracker: boolean | TrackerOpts
  lsd: boolean
  utPex: boolean
  torrents: Torrent[]
  maxConns: number
  utp: boolean
  throttleGroups: { down: ThrottleGroup; up: ThrottleGroup }
  enableWebSeeds: boolean
  dht: DHTInstance | null
  natTraversal: NatTraversalInstance | null
  blocked: IPSet | null

  #connPool: ConnectionPoolInstance | null = null
  #httpServer: (Server & { pathname?: string }) | null = null
  #downloadSpeedMeasure = throughput()
  #uploadSpeedMeasure = throughput()

  constructor(opts: ZTorrentCoreOpts = {} as ZTorrentCoreOpts) {
    super()

    const platform = opts.platform
    if (!platform) throw new Error('platform adapter is required')

    this.platform = platform

    if (typeof opts.peerId === 'string') {
      this.peerId = opts.peerId
    } else if (opts.peerId && ArrayBuffer.isView(opts.peerId)) {
      this.peerId = arr2hex(opts.peerId as Uint8Array)
    } else {
      this.peerId = arr2hex(text2arr(VERSION_PREFIX + arr2base(randomBytes(9))))
    }
    this.peerIdBuffer = hex2arr(this.peerId)

    if (typeof opts.nodeId === 'string') {
      this.nodeId = opts.nodeId
    } else if (opts.nodeId && ArrayBuffer.isView(opts.nodeId)) {
      this.nodeId = arr2hex(opts.nodeId as Uint8Array)
    } else {
      this.nodeId = arr2hex(randomBytes(20))
    }
    this.nodeIdBuffer = hex2arr(this.nodeId)

    this.debugId = this.peerId.substring(0, 7)

    this.destroyed = false
    this.listening = false
    this.ready = false
    this.torrentPort = opts.torrentPort || 0
    this.dhtPort = opts.dhtPort || 0
    this.tracker = opts.tracker !== undefined ? opts.tracker : ({} as TrackerOpts)
    this.blocked = null
    this.lsd = opts.lsd !== false
    this.utPex = opts.utPex !== false
    this.torrents = []
    this.maxConns = Number(opts.maxConns) || 55
    this.utp = platform.utpSupport && opts.utp !== false

    const downloadLimit = Math.max(
      typeof opts.downloadLimit === 'number' ? opts.downloadLimit : -1,
      -1
    )
    const uploadLimit = Math.max(typeof opts.uploadLimit === 'number' ? opts.uploadLimit : -1, -1)

    if (platform.createNatTraversal && (opts.natUpnp ?? true) && (opts.natPmp ?? true)) {
      this.natTraversal = platform.createNatTraversal({
        enableUPNP: opts.natUpnp !== false,
        enablePMP: opts.natPmp !== false,
      })
    } else {
      this.natTraversal = null
    }

    if (opts.secure === true) {
      enableSecure()
    }

    this.throttleGroups = {
      down: new ThrottleGroup({
        rate: Math.max(downloadLimit, 0),
        enabled: downloadLimit >= 0,
      }),
      up: new ThrottleGroup({
        rate: Math.max(uploadLimit, 0),
        enabled: uploadLimit >= 0,
      }),
    }

    if (this.tracker && typeof this.tracker === 'object') {
      const tr = this.tracker
      const g = globalThis as typeof globalThis & { WRTC?: object }
      if (g.WRTC && !tr.wrtc) tr.wrtc = g.WRTC
    }

    const connPool = platform.createConnPool?.(this)
    if (connPool) {
      this.#connPool = connPool
    } else {
      queueMicrotask(() => {
        this.notifyListening()
      })
    }

    let dht: DHTInstance | null = null
    if (opts.dht !== false && platform.createDHT) {
      const dhtOpts: Record<string, unknown> = { nodeId: this.nodeIdBuffer }
      if (opts.dht != null && typeof opts.dht === 'object') {
        Object.assign(dhtOpts, opts.dht as Record<string, unknown>)
      }
      dht = platform.createDHT(dhtOpts)
    }
    if (dht) {
      this.dht = dht
      dht.once('error', (err: Error) => {
        this.shutdownWithError(err)
      })
      dht.once('listening', () => {
        const address = dht.address()
        if (address) {
          this.dhtPort = address.port
          if (this.natTraversal) {
            this.natTraversal
              .map({
                publicPort: this.dhtPort,
                privatePort: this.dhtPort,
                protocol: 'udp',
                description: 'Z-Torrent DHT',
              })
              .catch((err: Error) => {
                debug('error mapping DHT port via UPnP/PMP: %o', err)
              })
          }
        }
      })
      dht.setMaxListeners?.(0)
      dht.listen(this.dhtPort)
    } else {
      this.dht = null
    }

    this.enableWebSeeds = opts.webSeeds !== false

    const ready = () => {
      if (this.destroyed) return
      this.ready = true
      this.emit('ready')
    }

    if (platform.loadIPSet && opts.blocklist != null) {
      platform.loadIPSet(
        opts.blocklist,
        {
          headers: {
            'user-agent': `Z-Torrent/0.1 (https://github.com/skrylnikov/z-torrent)`,
          },
        },
        (err, ipSet) => {
          if (err) return console.error(`Failed to load blocklist: ${err.message}`)
          this.blocked = ipSet ?? null
          ready()
        }
      )
    } else {
      queueMicrotask(ready)
    }
  }

  get httpServer(): { pathname: string } | null {
    const s = this.#httpServer
    if (s && typeof s.pathname === 'string') return { pathname: s.pathname }
    return null
  }

  recordDownload(bytes?: number): number {
    return this.#downloadSpeedMeasure(bytes)
  }

  recordUpload(bytes?: number): number {
    return this.#uploadSpeedMeasure(bytes)
  }

  /**
   * Removes a torrent from the client list and destroys it. Used by the platform layer
   * when replacing a duplicate torrent (e.g. seed flow).
   */
  detachTorrent(
    torrent: Torrent,
    opts?: TorrentDestroyOpts | null | (() => void),
    cb?: () => void
  ): void {
    if (!torrent) return
    if (typeof opts === 'function') return this.detachTorrent(torrent, null, opts)
    const index = this.torrents.indexOf(torrent)
    if (index === -1) return
    this.torrents.splice(index, 1)
    torrent.destroy(opts, cb)
    this.dht?.removeTorrentRoutingTable?.(torrent.infoHash)
    this.emit('remove', torrent)
  }

  /** Called by the connection pool when TCP/uTP servers are listening. */
  notifyListening(): void {
    this.listening = true

    const pool = this.#connPool
    if (pool?.tcpServer) {
      const address = pool.tcpServer.address()
      if (address) {
        this.torrentPort = address.port
        if (this.natTraversal) {
          this.natTraversal
            .map({
              publicPort: this.torrentPort,
              privatePort: this.torrentPort,
              protocol: this.utp ? null : 'tcp',
              description: 'Z-Torrent Torrent',
            })
            .catch((err: Error) => {
              debug('error mapping Z-Torrent port via UPnP/PMP: %o', err)
            })
        }
      }
    }

    this.emit('listening')
  }

  /** Full client teardown; optional error is emitted before cleanup. */
  shutdownWithError(err: Error | null, cb?: () => void): void {
    this.destroyed = true

    const tasks = this.torrents.map((torrent) => (c: () => void) => {
      torrent.destroy(c)
    })

    if (this.#connPool) {
      const pool = this.#connPool
      tasks.push((c) => {
        pool.destroy(c)
      })
    }

    if (this.dht) {
      const dht = this.dht
      tasks.push((c) => {
        dht.destroy(c)
      })
    }

    if (this.#httpServer) {
      const httpServer = this.#httpServer
      tasks.push((c) => {
        httpServer.destroy(c)
      })
    }

    if (this.natTraversal) {
      const nat = this.natTraversal
      tasks.push((c) => {
        void nat.destroy().then(() => c())
      })
    }

    parallel(tasks, cb)

    if (err) this.emit('error', err)

    this.torrents = []
    this.#connPool = null
    this.dht = null

    this.throttleGroups.down.destroy()
    this.throttleGroups.up.destroy()
  }

  createServer(options: ServerOptions = {}): Server {
    if (this.destroyed) throw new Error('torrent is destroyed')
    if (this.#httpServer) throw new Error('server already created')
    const server = this.platform.createServer(this, options)
    this.#httpServer = server as Server & { pathname?: string }
    return server
  }

  throttleDownload(rate: number): boolean {
    rate = Number(rate)
    if (isNaN(rate) || !isFinite(rate) || (rate < 0 && rate !== -1)) return false
    const group = this.throttleGroups.down as unknown as ThrottleGroupControl
    if (rate === -1) {
      group.setEnabled(false)
      return true
    }
    const rounded = Math.round(rate)
    group.setRate(rounded)
    group.setEnabled(true)
    return true
  }

  throttleUpload(rate: number): boolean {
    rate = Number(rate)
    if (isNaN(rate) || !isFinite(rate) || (rate < 0 && rate !== -1)) return false
    const group = this.throttleGroups.up as unknown as ThrottleGroupControl
    if (rate === -1) {
      group.setEnabled(false)
      return true
    }
    const rounded = Math.round(rate)
    group.setRate(rounded)
    group.setEnabled(true)
    return true
  }

  get downloadSpeed(): number {
    return this.#downloadSpeedMeasure()
  }

  get uploadSpeed(): number {
    return this.#uploadSpeedMeasure()
  }

  get progress(): number {
    const torrents = this.torrents.filter((t) => t.progress !== 1)
    const downloaded = torrents.reduce((total, t) => total + t.downloaded, 0)
    const length = torrents.reduce((total, t) => total + (t.length || 0), 0) || 1
    return downloaded / length
  }

  get ratio(): number {
    const uploaded = this.torrents.reduce((total, t) => total + t.uploaded, 0)
    const received = this.torrents.reduce((total, t) => total + t.received, 0) || 1
    return uploaded / received
  }

  async get(torrentId: TorrentId): Promise<Torrent | null> {
    if (torrentId instanceof Torrent) {
      if (this.torrents.includes(torrentId)) return torrentId
      return null
    }
    if (torrentId == null) {
      return null
    } else {
      let parsed: ParseInstance | undefined
      try {
        parsed = await parseTorrent(torrentId as string | Uint8Array | ParseInstance)
      } catch {
        /* invalid id */
      }
      if (!parsed) return null
      if (!parsed.infoHash && !parsed.infoHashV2) throw new Error('Invalid torrent identifier')

      for (const torrent of this.torrents) {
        if (parsedTorrentMatchesTorrent(parsed, torrent)) return torrent
      }
    }
    return null
  }

  add(
    torrentId: TorrentId,
    opts: TorrentOpts | ((t: Torrent) => void) = {},
    ontorrent: (t: Torrent) => void = () => {}
  ): Torrent {
    if (this.destroyed) throw new Error('client is destroyed')
    if (typeof opts === 'function') {
      ontorrent = opts
      opts = {}
    }

    const onInfoHash = () => {
      if (this.destroyed) return
      for (const t of this.torrents) {
        if (t !== torrent && sameTorrentIdentity(t, torrent)) {
          torrent.destroy(
            new Error(`Cannot add duplicate torrent ${torrent.infoHash || torrent.infoHashV2}`)
          )
          ontorrent(t)
          return
        }
      }
    }

    const onReady = () => {
      if (this.destroyed) return
      ontorrent(torrent)
      this.emit('torrent', torrent)
    }

    function onClose() {
      torrent.removeListener('_infoHash', onInfoHash)
      torrent.removeListener('ready', onReady)
      torrent.removeListener('close', onClose)
    }

    const torrentOpts: TorrentOpts = opts ? Object.assign({}, opts) : {}

    const torrent = new Torrent(
      torrentId as ConstructorParameters<typeof Torrent>[0],
      this,
      torrentOpts
    )
    this.torrents.push(torrent)

    torrent.once('_infoHash', onInfoHash)
    torrent.once('ready', onReady)
    torrent.once('close', onClose)

    this.emit('add', torrent)
    return torrent
  }

  async remove(
    torrentId: TorrentId,
    opts?: TorrentDestroyOpts | null | (() => void),
    cb?: () => void
  ): Promise<void> {
    if (typeof opts === 'function') return this.remove(torrentId, null, opts)

    const torrent = await this.get(torrentId)
    if (!torrent) throw new Error(`No torrent with id ${torrentId}`)
    this.detachTorrent(torrent, opts, cb)
  }

  removeTorrentFromClient(
    torrent: Torrent,
    opts?: TorrentDestroyOpts | null | (() => void),
    cb?: () => void
  ): void {
    this.detachTorrent(torrent, opts, cb)
  }

  address(): { address: string; port: number } | null {
    if (!this.listening) return null
    const pool = this.#connPool
    const addr = pool?.tcpServer?.address?.()
    if (addr) return { address: addr.address, port: addr.port }
    return { address: '0.0.0.0', port: 0 }
  }

  destroy(cb?: () => void): void {
    if (this.destroyed) throw new Error('client already destroyed')
    this.shutdownWithError(null, cb)
  }

  async getTorrentByPe3Hash(infoHashHash: string): Promise<Torrent | null> {
    for (const torrent of this.torrents) {
      if (!torrent.infoHashHash) {
        torrent.infoHashHash = await hash(hex2arr('72657132' + torrent.infoHash), 'hex')
      }
      if (infoHashHash === torrent.infoHashHash) {
        return torrent
      }
    }

    return null
  }
}
