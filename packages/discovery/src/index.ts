/*! @z-torrent/discovery. MIT License. WebTorrent LLC <https://webtorrent.io/opensource> */

import Debug from 'debug'
import { EventEmitter } from 'eventemitter3'
import parallel from 'run-parallel'
import { arr2hex } from 'uint8-util'

import { DHT } from '@z-torrent/dht'
import { LSD } from '@z-torrent/lsd'
import { Client } from '@z-torrent/tracker'

const debug = Debug('torrent-discovery')

function isBrowserRuntime(): boolean {
  if (typeof process === 'undefined') return false
  return Boolean((process as { browser?: boolean }).browser)
}

function normalizeHexId(value: string | Uint8Array): string {
  if (typeof value === 'string') return value.toLowerCase()
  return arr2hex(value).toLowerCase()
}

export interface DiscoveryOptions {
  peerId: string | Uint8Array
  infoHash: string | Uint8Array
  port: number
  announce?: string[]
  intervalMs?: number
  tracker?: boolean | object
  dht?: boolean | DHT | object
  dhtPort?: number
  lsd?: boolean
  userAgent?: string
}

export interface DHTPeer {
  host: string
  port: number | string
}

export class Discovery extends EventEmitter {
  peerId: string
  infoHash: string
  destroyed: boolean
  dht: DHT | null
  tracker: InstanceType<typeof Client> | null
  lsd: LSD | null

  #port: number
  #userAgent?: string
  #announce: string[] | null
  #intervalMs: number
  #trackerOpts: object | null
  #dhtAnnouncing: boolean
  #dhtTimeout: ReturnType<typeof setTimeout> | false
  #internalDHT: boolean

  #onWarning = (err: Error) => {
    this.emit('warning', err)
  }

  #onError = (err: Error) => {
    this.emit('error', err)
  }

  #onDHTPeer = (peer: DHTPeer, infoHash: Uint8Array) => {
    if (normalizeHexId(infoHash) !== this.infoHash) return
    this.emit('peer', `${peer.host}:${peer.port}`, 'dht')
  }

  #onTrackerPeer = (peer: string) => {
    this.emit('peer', peer, 'tracker')
  }

  #onTrackerAnnounce = () => {
    this.emit('trackerAnnounce')
  }

  #onLSDPeer = (peer: string, infoHash: Uint8Array) => {
    if (normalizeHexId(infoHash) !== this.infoHash) return
    this.emit('peer', peer, 'lsd')
  }

  constructor(opts: DiscoveryOptions) {
    super()

    if (!opts.peerId) throw new Error('Option `peerId` is required')
    if (!opts.infoHash) throw new Error('Option `infoHash` is required')
    if (!isBrowserRuntime() && !opts.port) throw new Error('Option `port` is required')

    this.peerId = normalizeHexId(opts.peerId)
    this.infoHash = normalizeHexId(opts.infoHash)
    this.#port = opts.port
    this.#userAgent = opts.userAgent

    this.destroyed = false

    this.#announce = opts.announce || []
    this.#intervalMs = opts.intervalMs || 15 * 60 * 1000
    this.#trackerOpts = null
    this.#dhtAnnouncing = false
    this.#dhtTimeout = false
    this.#internalDHT = false

    const createDHT = (port?: number, dhtOpts?: object): DHT => {
      const dht = new DHT(dhtOpts)
      dht.on('warning', this.#onWarning)
      dht.on('error', this.#onError)
      dht.listen(port)
      this.#internalDHT = true
      return dht
    }

    if (opts.tracker === false) {
      this.tracker = null
    } else if (opts.tracker && typeof opts.tracker === 'object') {
      this.#trackerOpts = Object.assign({}, opts.tracker)
      this.tracker = this.#createTracker()
    } else {
      this.tracker = this.#createTracker()
    }

    if (opts.dht === false || typeof DHT !== 'function') {
      this.dht = null
    } else if (opts.dht && typeof (opts.dht as DHT).addNode === 'function') {
      this.dht = opts.dht as DHT
    } else if (opts.dht && typeof opts.dht === 'object') {
      this.dht = createDHT(opts.dhtPort, opts.dht)
    } else {
      this.dht = createDHT(opts.dhtPort)
    }

    if (this.dht) {
      this.dht.on('peer', this.#onDHTPeer)
      this.#dhtAnnounce()
    }

    if (opts.lsd === false || typeof LSD !== 'function') {
      this.lsd = null
    } else {
      this.lsd = this.#createLSD()
    }
  }

  updatePort(port: number): void {
    if (port === this.#port) return
    this.#port = port

    if (this.dht) this.#dhtAnnounce()

    if (this.tracker) {
      this.tracker.stop()
      this.tracker.destroy(() => {
        this.tracker = this.#createTracker()
      })
    }
  }

  complete(opts?: object): void {
    if (this.tracker) {
      this.tracker.complete(opts)
    }
  }

  destroy(cb?: () => void): void {
    if (this.destroyed) return
    this.destroyed = true

    if (this.#dhtTimeout !== false) {
      clearTimeout(this.#dhtTimeout)
      this.#dhtTimeout = false
    }

    const tasks: ((taskCb: (err: Error | null) => void) => void)[] = []

    if (this.tracker) {
      this.tracker.stop()
      this.tracker.removeListener('warning', this.#onWarning)
      this.tracker.removeListener('error', this.#onError)
      this.tracker.removeListener('peer', this.#onTrackerPeer)
      this.tracker.removeListener('update', this.#onTrackerAnnounce)
      tasks.push((taskCb) => {
        this.tracker!.destroy(() => taskCb(null))
      })
    }

    if (this.dht) {
      this.dht.removeListener('peer', this.#onDHTPeer)
    }

    if (this.#internalDHT) {
      this.dht!.removeListener('warning', this.#onWarning)
      this.dht!.removeListener('error', this.#onError)
      tasks.push((taskCb) => {
        this.dht!.destroy(() => taskCb(null))
      })
    }

    if (this.lsd) {
      this.lsd.removeListener('warning', this.#onWarning)
      this.lsd.removeListener('error', this.#onError)
      this.lsd.removeListener('peer', this.#onLSDPeer)
      tasks.push((taskCb) => {
        this.lsd!.destroy(() => taskCb(null))
      })
    }

    parallel(tasks, () => {
      ;(cb || (() => {}))()
    })

    this.dht = null
    this.tracker = null
    this.lsd = null
    this.#announce = null
  }

  #createTracker(): InstanceType<typeof Client> {
    const opts = Object.assign({}, this.#trackerOpts, {
      infoHash: this.infoHash,
      announce: this.#announce ?? [],
      peerId: this.peerId,
      port: this.#port,
      userAgent: this.#userAgent,
    })

    const tracker = new Client(opts)
    tracker.on('warning', this.#onWarning)
    tracker.on('error', this.#onError)
    tracker.on('peer', this.#onTrackerPeer)
    tracker.on('update', this.#onTrackerAnnounce)
    tracker.setInterval(this.#intervalMs)
    tracker.start()
    return tracker
  }

  #dhtAnnounce(): void {
    if (this.#dhtAnnouncing) return
    debug('dht announce')

    this.#dhtAnnouncing = true
    if (this.#dhtTimeout !== false) {
      clearTimeout(this.#dhtTimeout)
      this.#dhtTimeout = false
    }

    this.dht!.announce(this.infoHash, this.#port, (err?: Error | null) => {
      this.#dhtAnnouncing = false
      debug('dht announce complete')

      if (err) this.emit('warning', err)
      this.emit('dhtAnnounce')

      if (!this.destroyed) {
        const timer = setTimeout(() => {
          this.#dhtAnnounce()
        }, this.#intervalMs + Math.floor((Math.random() * this.#intervalMs) / 5))
        this.#dhtTimeout = timer
        if (typeof timer.unref === 'function') timer.unref()
      }
    })
  }

  #createLSD(): LSD {
    const opts = Object.assign(
      {},
      {
        infoHash: this.infoHash,
        peerId: this.peerId,
        port: this.#port,
      }
    )

    const lsd = new LSD(opts)
    lsd.on('warning', this.#onWarning)
    lsd.on('error', this.#onError)
    lsd.on('peer', this.#onLSDPeer)
    lsd.start()
    return lsd
  }
}
