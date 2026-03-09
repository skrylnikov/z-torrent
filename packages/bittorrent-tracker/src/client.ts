import Debug from 'debug'
import EventEmitter from 'events'
import once from 'once'
import parallel from 'run-parallel'
import Peer from '@thaunknown/simple-peer/lite.js'
import queueMicrotask from 'queue-microtask'
import { hex2arr, hex2bin, text2arr, arr2hex, arr2text } from 'uint8-util'

import common from './common.js'
import HTTPTracker from './client/http-tracker.js'
import UDPTracker from './client/udp-tracker.js'
import WebSocketTracker from './client/websocket-tracker.js'

const debug = Debug('bittorrent-tracker:client')

interface AnnounceOptions {
  uploaded?: number
  downloaded?: number
  left?: number | string
  numwant?: number
  event?: string
}

interface ScrapeOptions {
  infoHash?: string | string[]
}

interface ScrapeResponse {
  infoHash?: string
  complete?: number
  incomplete?: number
  downloaded?: number
}

class Client extends EventEmitter {
  peerId: string
  _peerIdBuffer: Uint8Array
  _peerIdBinary: string
  infoHash: string
  _infoHashBuffer: Uint8Array
  _infoHashBinary: string
  destroyed: boolean
  _port: number
  _getAnnounceOpts?: () => Record<string, unknown>
  _rtcConfig?: RTCConfiguration
  _userAgent?: string
  _proxyOpts?: unknown
  _wrtc?: unknown
  _trackers: any[]

  constructor(
    opts: {
      peerId?: string | Uint8Array
      infoHash?: string | Uint8Array
      announce?: string | string[]
      port?: number
      getAnnounceOpts?: () => Record<string, unknown>
      rtcConfig?: RTCConfiguration
      userAgent?: string
      wrtc?: unknown | (() => unknown) | undefined
      proxyOpts?: unknown
    } = {}
  ) {
    super()

    if (!opts.peerId) throw new Error('Option `peerId` is required')
    if (!opts.infoHash) throw new Error('Option `infoHash` is required')
    if (!opts.announce) throw new Error('Option `announce` is required')
    if (typeof process !== 'undefined' && !(process as any).browser && !opts.port)
      throw new Error('Option `port` is required')

    this.peerId = typeof opts.peerId === 'string' ? opts.peerId : arr2hex(opts.peerId as Uint8Array)
    this._peerIdBuffer = hex2arr(this.peerId)
    this._peerIdBinary = hex2bin(this.peerId)

    this.infoHash =
      typeof opts.infoHash === 'string'
        ? opts.infoHash.toLowerCase()
        : arr2hex(opts.infoHash as Uint8Array)
    this._infoHashBuffer = hex2arr(this.infoHash)
    this._infoHashBinary = hex2bin(this.infoHash)

    debug('new client %s', this.infoHash)

    this.destroyed = false

    this._port = opts.port!
    this._getAnnounceOpts = opts.getAnnounceOpts
    this._rtcConfig = opts.rtcConfig
    this._userAgent = opts.userAgent
    this._proxyOpts = opts.proxyOpts

    this._wrtc = typeof opts.wrtc === 'function' ? opts.wrtc() : opts.wrtc

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

    const webrtcSupport = this._wrtc !== false && (!!this._wrtc || Peer.WEBRTC_SUPPORT)

    const nextTickWarn = (err: Error) => queueMicrotask(() => this.emit('warning', err))

    this._trackers = announce
      .map((url: string) => {
        try {
          const parsed = common.parseUrl(url)
          const portNum = parseInt(parsed.port, 10)
          if (isNaN(portNum) || portNum < 0 || portNum > 65535) {
            nextTickWarn(new Error(`Invalid tracker port: ${url}`))
            return null
          }
          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return HTTPTracker ? new HTTPTracker(this, url) : null
          } else if (parsed.protocol === 'udp:') {
            return UDPTracker ? new UDPTracker(this, url) : null
          } else if ((parsed.protocol === 'ws:' || parsed.protocol === 'wss:') && webrtcSupport) {
            if (
              parsed.protocol === 'ws:' &&
              typeof window !== 'undefined' &&
              window.location.protocol === 'https:'
            ) {
              nextTickWarn(new Error(`Unsupported tracker protocol: ${url}`))
              return null
            }
            return new WebSocketTracker(this, url)
          } else {
            nextTickWarn(new Error(`Unsupported tracker protocol: ${url}`))
            return null
          }
        } catch (err) {
          nextTickWarn(new Error(`Invalid tracker URL: ${url}`))
          return null
        }
      })
      .filter(Boolean) as any[]
  }

  start(opts?: AnnounceOptions) {
    const _opts = this._defaultAnnounceOpts(opts)
    _opts.event = 'started'
    debug('send `start` %o', _opts)
    this._announce(_opts)
    this._trackers.forEach((tracker) => tracker.setInterval())
  }

  stop(opts?: AnnounceOptions) {
    const _opts = this._defaultAnnounceOpts(opts)
    _opts.event = 'stopped'
    debug('send `stop` %o', _opts)
    this._announce(_opts)
  }

  complete(opts?: AnnounceOptions) {
    const _opts = this._defaultAnnounceOpts(opts || {})
    _opts.event = 'completed'
    debug('send `complete` %o', _opts)
    this._announce(_opts)
  }

  update(opts?: AnnounceOptions) {
    const _opts = this._defaultAnnounceOpts(opts)
    delete _opts.event
    debug('send `update` %o', _opts)
    this._announce(_opts)
  }

  _announce(opts: AnnounceOptions & { event?: string }) {
    this._trackers.forEach((tracker) => tracker.announce(opts))
  }

  scrape(opts?: ScrapeOptions) {
    debug('send `scrape`')
    if (!opts) opts = {}
    this._trackers.forEach((tracker) => tracker.scrape(opts))
  }

  setInterval(intervalMs: number) {
    debug('setInterval %d', intervalMs)
    this._trackers.forEach((tracker) => tracker.setInterval(intervalMs))
  }

  destroy(cb?: () => void) {
    if (this.destroyed) return
    this.destroyed = true
    debug('destroy')
    const tasks = this._trackers.map(
      (tracker) => (cb: (err?: Error | null) => void) => tracker.destroy(cb)
    )
    parallel(tasks, cb || (() => {}))
    this._trackers = []
    this._getAnnounceOpts = undefined
  }

  _defaultAnnounceOpts(opts: AnnounceOptions = {}): AnnounceOptions & { event?: string } {
    if (opts.numwant == null) opts.numwant = common.DEFAULT_ANNOUNCE_PEERS
    if (opts.uploaded == null) opts.uploaded = 0
    if (opts.downloaded == null) opts.downloaded = 0
    if (this._getAnnounceOpts) opts = Object.assign({}, opts, this._getAnnounceOpts())
    return opts
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
          cb(null, results[keys[0]])
        } else {
          cb(null, results)
        }
      }
    })

    client.scrape({ infoHash: opts.infoHash })
    return client
  }
}

export default Client
