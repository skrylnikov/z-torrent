import arrayRemove from 'unordered-array-remove'
import bencode from 'bencode'
import Debug from 'debug'
import { bin2hex, hex2bin, arr2text, text2arr, arr2hex } from 'uint8-util'

import * as common from '../common.js'
import type { TrackerClientContext } from '../client-context.js'
import { Tracker } from './tracker.js'
import { compact2stringMulti, compact2stringMulti6 } from '@z-torrent/utils'

const debug = Debug('@z-torrent/tracker:http-tracker')
const HTTP_SCRAPE_SUPPORT = /\/(announce)[^/]*$/

interface AnnounceOpts {
  uploaded?: number
  downloaded?: number
  left?: number
  numwant?: number
  compact?: number
  event?: string
}

interface ScrapeOpts {
  infoHash?: string | string[]
}

interface BencodeResponse {
  interval?: number
  'min interval'?: number
  'tracker id'?: string
  info_hash?: string | Uint8Array
  peers?: Uint8Array | Array<{ ip: string; port: number }>
  peers6?: Uint8Array | Array<{ ip: string; port: number }>
  'failure reason'?: string | Uint8Array
  'warning message'?: string | Uint8Array
  files?: Record<string, any>
  host?: Record<string, any>
  [key: string]: any
}

function abortTimeout(ms: number): AbortController {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, ms)
  if (timeout.unref) timeout.unref()
  return controller
}

export class HTTPTracker extends Tracker {
  scrapeUrl: string | null
  cleanupFns: Array<() => void>
  maybeDestroyCleanup: (() => void) | null
  _trackerId?: string
  DEFAULT_ANNOUNCE_INTERVAL = 30 * 60 * 1000

  constructor(client: TrackerClientContext, announceUrl: string) {
    super(client, announceUrl)

    debug('new http tracker %s', announceUrl)

    this.scrapeUrl = null

    const match = this.announceUrl.match(HTTP_SCRAPE_SUPPORT)
    if (match) {
      const pre = this.announceUrl.slice(0, match.index)
      const post = this.announceUrl.slice(match.index! + 9)
      this.scrapeUrl = `${pre}/scrape${post}`
    }

    this.cleanupFns = []
    this.maybeDestroyCleanup = null
  }

  announce(opts: AnnounceOpts): void {
    if (this.destroyed) return

    const params: any = Object.assign({}, opts, {
      compact: opts.compact == null ? 1 : opts.compact,
      info_hash: this.client.infoHashBinary,
      peer_id: this.client.peerIdBinary,
      port: this.client.port,
    })

    if (params.left !== 0 && !params.left) params.left = 16384
    if (this._trackerId) params.trackerid = this._trackerId

    this._request(this.announceUrl, params, (err, data) => {
      if (err) {
        this.client.emit('warning', err)
        return
      }
      this._onAnnounceResponse(data!)
    })
  }

  scrape(opts: ScrapeOpts): void {
    if (this.destroyed) return

    if (!this.scrapeUrl) {
      this.client.emit('error', new Error(`scrape not supported ${this.announceUrl}`))
      return
    }

    const infoHashes =
      Array.isArray(opts.infoHash) && opts.infoHash.length > 0
        ? opts.infoHash.map((infoHash) => hex2bin(infoHash))
        : (opts.infoHash && hex2bin(opts.infoHash as string)) || this.client.infoHashBinary
    const params = {
      info_hash: infoHashes,
    }
    this._request(this.scrapeUrl, params, (err, data) => {
      if (err) {
        this.client.emit('warning', err)
        return
      }
      this._onScrapeResponse(data!)
    })
  }

  destroy(cb?: (err?: Error | null) => void): void {
    const self = this
    if (this.destroyed) return cb?.()
    this.destroyed = true
    clearInterval(this.interval!)

    let timeout: NodeJS.Timeout | null

    if (this.cleanupFns.length === 0) return destroyCleanup()

    timeout = setTimeout(destroyCleanup, common.DESTROY_TIMEOUT)

    this.maybeDestroyCleanup = () => {
      if (this.cleanupFns.length === 0) destroyCleanup()
    }

    function destroyCleanup() {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      self.maybeDestroyCleanup = null
      self.cleanupFns.slice(0).forEach((cleanup) => {
        cleanup()
      })
      self.cleanupFns = []
      cb?.()
    }
  }

  async _request(
    requestUrl: string,
    params: any,
    cb: (err: Error | null, data?: BencodeResponse) => void
  ): Promise<void> {
    const parsedUrl = new URL(
      requestUrl +
        (requestUrl.indexOf('?') === -1 ? '?' : '&') +
        common.querystringStringify(params)
    )
    let agent: any
    if (this.client.proxyOpts) {
      agent =
        parsedUrl.protocol === 'https:'
          ? this.client.proxyOpts.httpsAgent
          : this.client.proxyOpts.httpAgent
      if (!agent && this.client.proxyOpts.socksProxy) {
        agent = this.client.proxyOpts.socksProxy
      }
    }

    let controller = abortTimeout(common.REQUEST_TIMEOUT)

    const cleanup = () => {
      if (!controller!.signal.aborted) {
        arrayRemove(this.cleanupFns, this.cleanupFns.indexOf(cleanup))
        controller!.abort()
        controller = null!
      }
      if (this.maybeDestroyCleanup) this.maybeDestroyCleanup()
    }

    this.cleanupFns.push(cleanup)

    let res: Response
    try {
      const init: RequestInit & { dispatcher?: unknown } = {
        signal: controller.signal,
        headers: {
          'user-agent': this.client.userAgent || '',
        },
      }
      if (agent) init.dispatcher = agent
      res = await globalThis.fetch(parsedUrl.toString(), init)
      if ((res.body as any).on) (res.body as any).on('error', cb)
    } catch (err: any) {
      if (err) return cb(err)
      return
    }
    const data = new Uint8Array(await res.arrayBuffer())
    cleanup()
    if (this.destroyed) return

    if (res.status !== 200) {
      return cb(new Error(`Non-200 response code ${res.status} from ${this.announceUrl}`))
    }
    if (!data || data.length === 0) {
      return cb(new Error(`Invalid tracker response from${this.announceUrl}`))
    }

    let decoded: BencodeResponse
    try {
      decoded = bencode.decode(data) as BencodeResponse
    } catch (err: any) {
      return cb(new Error(`Error decoding tracker response: ${err.message}`))
    }
    const failure = decoded['failure reason'] && arr2text(decoded['failure reason'] as Uint8Array)
    if (failure) {
      debug(`failure from ${requestUrl} (${failure})`)
      return cb(new Error(failure))
    }

    const warning = decoded['warning message'] && arr2text(decoded['warning message'] as Uint8Array)
    if (warning) {
      debug(`warning from ${requestUrl} (${warning})`)
      this.client.emit('warning', new Error(warning))
    }

    debug(`response from ${requestUrl}`)

    cb(null, decoded)
  }

  _onAnnounceResponse(data: BencodeResponse): void {
    const interval = data.interval || data['min interval']
    if (interval) this.setInterval(interval * 1000)

    const trackerId = data['tracker id']
    if (trackerId) {
      this._trackerId = trackerId as string
    }

    const response = Object.assign({}, data, {
      announce: this.announceUrl,
      infoHash: bin2hex((data.info_hash || String(data.info_hash)) as any),
    })
    this.client.emit('update', response)

    let addrs: string[]
    if (ArrayBuffer.isView(data.peers)) {
      try {
        addrs = compact2stringMulti(Buffer.from(data.peers as Uint8Array))
      } catch (err: any) {
        this.client.emit('warning', err)
        return
      }
      addrs.forEach((addr) => {
        this.client.emit('peer', addr)
      })
    } else if (Array.isArray(data.peers)) {
      data.peers.forEach((peer) => {
        this.client.emit('peer', `${peer.ip}:${peer.port}`)
      })
    }

    if (ArrayBuffer.isView(data.peers6)) {
      try {
        addrs = compact2stringMulti6(Buffer.from(data.peers6 as Uint8Array))
      } catch (err: any) {
        this.client.emit('warning', err)
        return
      }
      addrs.forEach((addr) => {
        this.client.emit('peer', addr)
      })
    } else if (Array.isArray(data.peers6)) {
      data.peers6.forEach((peer) => {
        const ip = /^\[/.test(peer.ip) || !/:/.test(peer.ip) ? peer.ip : `[${peer.ip}]`
        this.client.emit('peer', `${ip}:${peer.port}`)
      })
    }
  }

  _onScrapeResponse(data: BencodeResponse): void {
    data = (data.files || data.host || {}) as BencodeResponse

    const keys = Object.keys(data)
    if (keys.length === 0) {
      this.client.emit('warning', new Error('invalid scrape response'))
      return
    }

    keys.forEach((_infoHash) => {
      const infoHash =
        _infoHash.length !== 20
          ? arr2hex(text2arr(_infoHash) as Uint8Array)
          : bin2hex(_infoHash as any)

      const response = Object.assign((data as any)[_infoHash], {
        announce: this.announceUrl,
        infoHash,
      })
      this.client.emit('scrape', response)
    })
  }
}
