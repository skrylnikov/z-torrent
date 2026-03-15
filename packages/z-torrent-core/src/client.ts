/**
 * WebTorrentCore — platform-agnostic client.
 * Requires platform adapter (PlatformAdapter) to be passed in opts.
 */

import { EventEmitter } from 'eventemitter3'
import parallel from 'run-parallel'
import parseTorrent from 'parse-torrent'
import queueMicrotask from 'queue-microtask'
import { hash, hex2arr, arr2hex, arr2base, text2arr, randomBytes, concat } from 'uint8-util'
import throughput from 'throughput'
import { ThrottleGroup } from 'speed-limiter'

import Torrent from './lib/torrent.js'
import FileIterator from './lib/file-iterator.js'
import debugFactory from 'debug'
import type { PlatformAdapter, ServerOptions } from './interfaces.js'
import type { WebTorrentClient } from './lib/torrent.js'

const debug = debugFactory('webtorrent')

import VERSION from './version.js'
const VERSION_STR = VERSION.replace(/\d*./g, (v: string) => `0${parseInt(v, 10) % 100}`.slice(-2)).slice(0, 4)
const VERSION_PREFIX = `-WW${VERSION_STR}-`

export interface WebTorrentCoreOpts {
  platform: PlatformAdapter
  peerId?: string | ArrayBufferView
  nodeId?: string | ArrayBufferView
  torrentPort?: number
  dhtPort?: number
  tracker?: unknown
  lsd?: boolean
  utPex?: boolean
  natUpnp?: boolean | string
  natPmp?: boolean
  maxConns?: number
  utp?: boolean
  seedOutgoingConnections?: boolean
  downloadLimit?: number
  uploadLimit?: number
  blocklist?: unknown
  dht?: boolean | Record<string, unknown>
  webSeeds?: boolean
  secure?: boolean
}

export default class WebTorrentCore extends EventEmitter implements WebTorrentClient {
  platform: PlatformAdapter
  peerId: string
  peerIdBuffer: Uint8Array
  nodeId: string
  nodeIdBuffer: Uint8Array
  _debugId: string
  destroyed: boolean
  listening: boolean
  ready: boolean
  torrentPort: number
  dhtPort: number
  tracker: unknown
  lsd: boolean
  utPex: boolean
  torrents: Torrent[]
  maxConns: number
  utp: boolean
  throttleGroups: { down: ThrottleGroup; up: ThrottleGroup }
  _downloadSpeed: (bytes?: number) => number
  _uploadSpeed: (bytes?: number) => number
  enableWebSeeds: boolean
  _connPool: unknown
  dht: unknown
  _server: unknown
  natTraversal: unknown
  blocked: unknown

  constructor(opts: WebTorrentCoreOpts = {} as WebTorrentCoreOpts) {
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

    this._debugId = this.peerId.substring(0, 7)

    this.destroyed = false
    this.listening = false
    this.ready = false
    this.torrentPort = opts.torrentPort || 0
    this.dhtPort = opts.dhtPort || 0
    this.tracker = opts.tracker !== undefined ? opts.tracker : {}
    this.lsd = opts.lsd !== false
    this.utPex = opts.utPex !== false
    this.torrents = []
    this.maxConns = Number(opts.maxConns) || 55
    this.utp = platform.utpSupport && opts.utp !== false

    const downloadLimit = Math.max(typeof opts.downloadLimit === 'number' ? opts.downloadLimit : -1, -1)
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
      import('./lib/peer.js').then(({ enableSecure }) => enableSecure())
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
      const tr = this.tracker as Record<string, unknown>
      if ((globalThis as any).WRTC && !tr.wrtc) tr.wrtc = (globalThis as any).WRTC
    }

    const connPool = platform.createConnPool?.(this)
    if (connPool) {
      this._connPool = connPool
    } else {
      queueMicrotask(() => {
        this._onListening()
      })
    }

    this._downloadSpeed = throughput()
    this._uploadSpeed = throughput()

    const dht = platform.createDHT?.({ nodeId: this.nodeIdBuffer, ...(opts.dht as object) })
    if (dht) {
      this.dht = dht
      ;(dht as any).once('error', (err: Error) => {
        this._destroy(err)
      })
      ;(dht as any).once('listening', () => {
        const address = (dht as any).address()
        if (address) {
          this.dhtPort = address.port
          if (this.natTraversal) {
            (this.natTraversal as any)
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
      if (typeof (dht as any).setMaxListeners === 'function') (dht as any).setMaxListeners(0)
      ;(dht as any).listen(this.dhtPort)
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
          this.blocked = ipSet
          ready()
        }
      )
    } else {
      queueMicrotask(ready)
    }
  }

  createServer(options: ServerOptions, force?: 'browser' | 'node'): unknown {
    if (this.destroyed) throw new Error('torrent is destroyed')
    if (this._server) throw new Error('server already created')
    const isBrowser = this.platform.isBrowser ?? (typeof (globalThis as any).window !== 'undefined')
    if ((!isBrowser || force === 'node') && force !== 'browser') {
      this._server = this.platform.createServer(this, options)
      return this._server
    } else {
      if (!(options?.controller instanceof (globalThis as any).ServiceWorkerRegistration))
        throw new Error('Invalid worker registration')
      const ctrl = options.controller as ServiceWorkerRegistration
      if (ctrl.active?.state !== 'activated' && ctrl.active?.state !== 'activating')
        throw new Error("Worker isn't activated")
      this._server = this.platform.createServer(this, options)
      return this._server
    }
  }

  get downloadSpeed(): number {
    return this._downloadSpeed()
  }

  get uploadSpeed(): number {
    return this._uploadSpeed()
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

  async get(torrentId: unknown): Promise<Torrent | null> {
    if (torrentId instanceof Torrent) {
      if (this.torrents.includes(torrentId)) return torrentId
    } else {
      let parsed
      try {
        parsed = await parseTorrent(torrentId as any)
      } catch (err) {}
      if (!parsed) return null
      if (!parsed.infoHash) throw new Error('Invalid torrent identifier')

      for (const torrent of this.torrents) {
        if (torrent.infoHash === parsed.infoHash) return torrent
      }
    }
    return null
  }

  add(torrentId: unknown, opts: any = {}, ontorrent: (t: Torrent) => void = () => {}): Torrent {
    if (this.destroyed) throw new Error('client is destroyed')
    if (typeof opts === 'function') [opts, ontorrent] = [{}, opts]

    const onInfoHash = () => {
      if (this.destroyed) return
      for (const t of this.torrents) {
        if (t.infoHash === torrent.infoHash && t !== torrent) {
          torrent.destroy(new Error(`Cannot add duplicate torrent ${torrent.infoHash}`))
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

    opts = opts ? Object.assign({}, opts) : {}

    const torrent = new Torrent(torrentId, this as any, opts)
    this.torrents.push(torrent)

    torrent.once('_infoHash', onInfoHash)
    torrent.once('ready', onReady)
    torrent.once('close', onClose)

    this.emit('add', torrent)
    return torrent
  }

  async remove(torrentId: unknown, opts?: unknown, cb?: () => void): Promise<void> {
    if (typeof opts === 'function') return this.remove(torrentId, null, opts)

    const torrent = await this.get(torrentId)
    if (!torrent) throw new Error(`No torrent with id ${torrentId}`)
    this._remove(torrent, opts, cb)
  }

  _remove(torrent: Torrent, opts?: unknown, cb?: () => void): void {
    if (!torrent) return
    if (typeof opts === 'function') return this._remove(torrent, null, opts)
    const index = this.torrents.indexOf(torrent)
    if (index === -1) return
    this.torrents.splice(index, 1)
    torrent.destroy(opts, cb)
    if (this.dht) {
      (this.dht as any)._tables?.remove?.(torrent.infoHash)
    }
    this.emit('remove', torrent)
  }

  address(): { address: string; port: number } | null {
    if (!this.listening) return null
    const pool = this._connPool as { tcpServer?: { address: () => { address: string; port: number } } }
    return pool?.tcpServer?.address?.() ?? { address: '0.0.0.0', family: 'IPv4', port: 0 } as any
  }

  destroy(cb?: () => void): void {
    if (this.destroyed) throw new Error('client already destroyed')
    this._destroy(null, cb)
  }

  _destroy(err: Error | null, cb?: () => void): void {
    this.destroyed = true

    const tasks = this.torrents.map((torrent) => (c: () => void) => {
      torrent.destroy(c)
    })

    if (this._connPool) {
      tasks.push((c) => {
        (this._connPool as any).destroy(c)
      })
    }

    if (this.dht) {
      tasks.push((c) => {
        (this.dht as any).destroy(c)
      })
    }

    if (this._server) {
      tasks.push((c) => {
        (this._server as any).destroy(c)
      })
    }

    if (this.natTraversal) {
      tasks.push((c) => {
        (this.natTraversal as any).destroy().then(() => c())
      })
    }

    parallel(tasks, cb)

    if (err) this.emit('error', err)

    this.torrents = []
    this._connPool = null
    this.dht = null

    this.throttleGroups.down.destroy()
    this.throttleGroups.up.destroy()
  }

  _onListening(): void {
    this.listening = true

    const pool = this._connPool as { tcpServer?: { address: () => { port: number } } }
    if (pool?.tcpServer) {
      const address = pool.tcpServer.address()
      if (address) {
        this.torrentPort = address.port
        if (this.natTraversal) {
          (this.natTraversal as any)
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

  async _getByHash(infoHashHash: string): Promise<Torrent | null> {
    for (const torrent of this.torrents) {
      if (!torrent.infoHashHash) {
        torrent.infoHashHash = await hash(
          hex2arr('72657132' + torrent.infoHash),
          'hex'
        )
      }
      if (infoHashHash === torrent.infoHashHash) {
        return torrent
      }
    }

    return null
  }
}
