/*! @z-torrent/tracker. MIT License. */
import Debug from 'debug'
import { EventEmitter } from 'eventemitter3'
import { once } from '@z-torrent/utils'
import parallel from 'run-parallel'
import Peer from '@thaunknown/simple-peer/lite.js'

import { hex2arr, hex2bin, text2arr, arr2hex, arr2text } from 'uint8-util'

import * as common from './common.js'
import type { TrackerClientContext, TrackerProxyOpts } from './client-context.js'
import { WebSocketTracker } from './client/websocket-tracker.js'

const debug = Debug('bittorrent-tracker:client')

export interface AnnounceOptions {
  uploaded?: number
  downloaded?: number
  left?: number | string
  numwant?: number
  event?: string
}

export interface ScrapeOptions {
  infoHash?: string | string[]
}

export interface ScrapeResponse {
  infoHash?: string
  complete?: number
  incomplete?: number
  downloaded?: number
}

type SubTracker = {
  announce: (opts: object) => void
  scrape: (opts: object) => void
  setInterval: (intervalMs?: number) => void
  destroy: (cb?: (err?: Error | null) => void) => void
}

type TrackerCtor = new (client: TrackerClientContext, url: string) => SubTracker

/** BEP 52 hybrid: second swarm uses truncated SHA-256 (20 bytes = 40 hex) as info_hash. */
function normalizeTruncatedV2InfoHash(value: string | Uint8Array): string {
  const hex =
    typeof value === 'string' ? value.toLowerCase() : arr2hex(value as Uint8Array).toLowerCase()
  if (hex.length !== 40 || !/^[0-9a-f]+$/.test(hex)) {
    throw new Error('infoHashV2 must be 40 hex chars (20-byte truncated SHA-256, BEP 52)')
  }
  return hex
}

/**
 * BEP 52 v2-truncated swarm: same logical client, different `info_hash` on the wire.
 * Must not use a Proxy — sub-trackers call `getDefaultAnnounceOpts()` on this object, and
 * private fields on the real `Client` only work when `this` is the actual instance.
 */
function v2SwarmContext(base: TrackerClientContext, v2Hex: string): TrackerClientContext {
  const infoHashBuffer = hex2arr(v2Hex)
  const infoHashBinary = hex2bin(v2Hex)
  return {
    infoHash: v2Hex,
    infoHashBuffer,
    infoHashBinary,
    peerId: base.peerId,
    peerIdBuffer: base.peerIdBuffer,
    peerIdBinary: base.peerIdBinary,
    port: base.port,
    userAgent: base.userAgent,
    rtcConfig: base.rtcConfig,
    wrtc: base.wrtc,
    proxyOpts: base.proxyOpts,
    getDefaultAnnounceOpts: (opts?: Record<string, unknown>) =>
      base.getDefaultAnnounceOpts(opts as AnnounceOptions),
    on: base.on.bind(base),
    once: base.once.bind(base),
    off: base.off.bind(base),
    emit: base.emit.bind(base),
    addListener: base.addListener.bind(base),
    removeListener: base.removeListener.bind(base),
    removeAllListeners: base.removeAllListeners.bind(base),
  } as TrackerClientContext
}

function buildSubTrackers(
  ctx: TrackerClientContext,
  announce: string[],
  HTTPTracker: TrackerCtor | null,
  UDPTracker: TrackerCtor | null,
  webrtcSupport: boolean,
  nextTickWarn: (err: Error) => void
): SubTracker[] {
  const trackers: SubTracker[] = []
  for (const url of announce) {
    try {
      const parsed = common.parseUrl(url)
      const portNum = parsed.port ? parseInt(parsed.port, 10) : NaN
      if (parsed.port !== '' && (isNaN(portNum) || portNum < 0 || portNum > 65535)) {
        nextTickWarn(new Error(`Invalid tracker port: ${url}`))
        continue
      }
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        if (HTTPTracker != null) trackers.push(new HTTPTracker(ctx, url))
      } else if (parsed.protocol === 'udp:') {
        if (UDPTracker != null) trackers.push(new UDPTracker(ctx, url))
      } else if ((parsed.protocol === 'ws:' || parsed.protocol === 'wss:') && webrtcSupport) {
        if (
          parsed.protocol === 'ws:' &&
          typeof window !== 'undefined' &&
          window.location.protocol === 'https:'
        ) {
          nextTickWarn(new Error(`Unsupported tracker protocol: ${url}`))
          continue
        }
        trackers.push(new WebSocketTracker(ctx, url))
      } else {
        nextTickWarn(new Error(`Unsupported tracker protocol: ${url}`))
      }
    } catch {
      nextTickWarn(new Error(`Invalid tracker URL: ${url}`))
    }
  }
  return trackers
}

export function createTrackerClient(HTTPTracker: TrackerCtor | null, UDPTracker: TrackerCtor | null) {
  class Client extends EventEmitter {
    readonly peerId: string
    readonly peerIdBuffer: Uint8Array
    readonly peerIdBinary: string
    readonly infoHash: string
    readonly infoHashBuffer: Uint8Array
    readonly infoHashBinary: string
    /** When set, each announce URL is registered twice (v1 + BEP 52 v2 truncated swarm). */
    readonly infoHashV2: string | undefined
    destroyed = false
    readonly port: number
    readonly userAgent?: string
    readonly rtcConfig?: RTCConfiguration
    readonly proxyOpts?: TrackerProxyOpts
    readonly wrtc?: unknown
    #getAnnounceOpts?: () => Record<string, unknown>
    #trackers: SubTracker[] = []

    constructor(
      opts: {
        peerId?: string | Uint8Array
        infoHash?: string | Uint8Array
        /** BEP 52: truncated v2 info-hash (40 hex); dual-announce to same tracker URLs */
        infoHashV2?: string | Uint8Array
        announce?: string | string[]
        port?: number
        getAnnounceOpts?: () => Record<string, unknown>
        rtcConfig?: RTCConfiguration
        userAgent?: string
        wrtc?: unknown | (() => unknown) | undefined
        proxyOpts?: TrackerProxyOpts
      } = {}
    ) {
      super()

      if (!opts.peerId) throw new Error('Option `peerId` is required')
      if (!opts.infoHash) throw new Error('Option `infoHash` is required')
      if (!opts.announce) throw new Error('Option `announce` is required')
      if (typeof process !== 'undefined' && !(process as { browser?: boolean }).browser && !opts.port)
        throw new Error('Option `port` is required')

      this.peerId = typeof opts.peerId === 'string' ? opts.peerId : arr2hex(opts.peerId as Uint8Array)
      this.peerIdBuffer = hex2arr(this.peerId)
      this.peerIdBinary = hex2bin(this.peerId)

      this.infoHash =
        typeof opts.infoHash === 'string'
          ? opts.infoHash.toLowerCase()
          : arr2hex(opts.infoHash as Uint8Array)
      this.infoHashBuffer = hex2arr(this.infoHash)
      this.infoHashBinary = hex2bin(this.infoHash)

      this.infoHashV2 =
        opts.infoHashV2 != null ? normalizeTruncatedV2InfoHash(opts.infoHashV2) : undefined

      debug('new client %s', this.infoHash)

      this.port = opts.port!
      this.#getAnnounceOpts = opts.getAnnounceOpts
      this.rtcConfig = opts.rtcConfig
      this.userAgent = opts.userAgent
      this.proxyOpts = opts.proxyOpts

      this.wrtc = typeof opts.wrtc === 'function' ? opts.wrtc() : opts.wrtc

      let announce =
        typeof opts.announce === 'string'
          ? [opts.announce]
          : opts.announce == null
            ? []
            : opts.announce

      announce = announce
        .map((announceUrl: string | Uint8Array) => {
          if (ArrayBuffer.isView(announceUrl)) announceUrl = arr2text(announceUrl as Uint8Array)
          return announceUrl
        })
        .map((announceUrl: string) =>
          announceUrl.endsWith('/') ? announceUrl.slice(0, -1) : announceUrl
        )
      announce = Array.from(new Set(announce))

      const webrtcSupport = this.wrtc !== false && (!!this.wrtc || Peer.WEBRTC_SUPPORT)

      const nextTickWarn = (err: Error) => queueMicrotask(() => this.emit('warning', err))

      const primaryCtx = this as unknown as TrackerClientContext
      const trackers = buildSubTrackers(
        primaryCtx,
        announce,
        HTTPTracker,
        UDPTracker,
        webrtcSupport,
        nextTickWarn
      )
      if (this.infoHashV2) {
        trackers.push(
          ...buildSubTrackers(
            v2SwarmContext(primaryCtx, this.infoHashV2),
            announce,
            HTTPTracker,
            UDPTracker,
            webrtcSupport,
            nextTickWarn
          )
        )
      }
      this.#trackers = trackers
    }

    start(opts?: AnnounceOptions): void {
      const _opts = this.getDefaultAnnounceOpts(opts)
      _opts.event = 'started'
      debug('send `start` %o', _opts)
      this.#announceToTrackers(_opts)
      this.#trackers.forEach((tracker) => tracker.setInterval())
    }

    stop(opts?: AnnounceOptions): void {
      const _opts = this.getDefaultAnnounceOpts(opts)
      _opts.event = 'stopped'
      debug('send `stop` %o', _opts)
      this.#announceToTrackers(_opts)
    }

    complete(opts?: AnnounceOptions): void {
      const _opts = this.getDefaultAnnounceOpts(opts || {})
      _opts.event = 'completed'
      debug('send `complete` %o', _opts)
      this.#announceToTrackers(_opts)
    }

    update(opts?: AnnounceOptions): void {
      const _opts = this.getDefaultAnnounceOpts(opts)
      delete _opts.event
      debug('send `update` %o', _opts)
      this.#announceToTrackers(_opts)
    }

    #announceToTrackers(opts: AnnounceOptions & { event?: string }): void {
      this.#trackers.forEach((tracker) => tracker.announce(opts))
    }

    scrape(opts?: ScrapeOptions): void {
      debug('send `scrape`')
      if (!opts) opts = {}
      this.#trackers.forEach((tracker) => tracker.scrape(opts))
    }

    setInterval(intervalMs: number): void {
      debug('setInterval %d', intervalMs)
      this.#trackers.forEach((tracker) => tracker.setInterval(intervalMs))
    }

    destroy(cb?: () => void): void {
      if (this.destroyed) return
      this.destroyed = true
      debug('destroy')
      const tasks = this.#trackers.map(
        (tracker) => (done: (err?: Error | null) => void) => tracker.destroy(done)
      )
      parallel(tasks, cb || (() => {}))
      this.#trackers = []
      this.#getAnnounceOpts = undefined
    }

    getDefaultAnnounceOpts(opts: AnnounceOptions = {}): object & { event?: string } {
      if (opts.numwant == null) opts.numwant = common.DEFAULT_ANNOUNCE_PEERS
      if (opts.uploaded == null) opts.uploaded = 0
      if (opts.downloaded == null) opts.downloaded = 0
      if (this.#getAnnounceOpts) opts = Object.assign({}, opts, this.#getAnnounceOpts())
      return opts as object & { event?: string }
    }

    static scrape(
      opts: ScrapeOptions & { announce: string },
      cb: (err: Error | null, data: ScrapeResponse | Record<string, ScrapeResponse>) => void
    ): Client {
      cb = once(cb)

      if (!opts.infoHash) throw new Error('Option `infoHash` is required')
      if (!opts.announce) throw new Error('Option `announce` is required')

      const clientOpts = Object.assign({}, opts, {
        infoHash: Array.isArray(opts.infoHash) ? opts.infoHash[0] : opts.infoHash,
        peerId: text2arr('01234567890123456789'),
        port: 6881,
      })

      const client = new Client(clientOpts)
      client.once('error', cb)
      client.once('warning', cb)

      let len = Array.isArray(opts.infoHash) ? opts.infoHash.length : 1
      const results: Record<string, ScrapeResponse> = {}
      client.on('scrape', (data: ScrapeResponse) => {
        len -= 1
        if (data.infoHash) {
          results[data.infoHash] = data
        }
        if (len === 0) {
          client.destroy()
          const keys = Object.keys(results)
          if (keys.length === 1) {
            const k = keys[0]!
            cb(null, results[k])
          } else {
            cb(null, results)
          }
        }
      })

      client.scrape({ infoHash: opts.infoHash })
      return client
    }
  }

  return Client
}
