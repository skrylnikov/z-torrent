import Debug from 'debug'
import { EventEmitter } from 'eventemitter3'
import parallel from 'run-parallel'
import { arr2hex } from 'uint8-util'

import { DHT } from '@z-torrent/dht'
import { LSD } from '@z-torrent/lsd'
import { Client } from '@z-torrent/tracker'

const debug = Debug('@z-torrent/discovery:discovery')

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
  /** BEP 52 hybrid: truncated v2 info-hash (40 hex) for second tracker/DHT swarm */
  infoHashV2Truncated?: string | Uint8Array
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
  tracker: InstanceType<typeof Client> | null = null
  /** Second tracker client for BEP 52 hybrid (v2 truncated swarm). */
  trackerV2: InstanceType<typeof Client> | null = null
  lsd: LSD | null

  #port: number
  #infoHashV2Truncated: string | null
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
    const id = normalizeHexId(infoHash)
    if (id !== this.infoHash && id !== this.#infoHashV2Truncated) return
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
    this.#infoHashV2Truncated = opts.infoHashV2Truncated
      ? normalizeHexId(opts.infoHashV2Truncated)
      : null

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
      this.trackerV2 = null
    } else if (opts.tracker && typeof opts.tracker === 'object') {
      this.#trackerOpts = Object.assign({}, opts.tracker)
      this.tracker = this.#createTracker(this.infoHash)
      this.trackerV2 = this.#infoHashV2Truncated
        ? this.#createTracker(this.#infoHashV2Truncated)
        : null
    } else {
      this.tracker = this.#createTracker(this.infoHash)
      this.trackerV2 = this.#infoHashV2Truncated
        ? this.#createTracker(this.#infoHashV2Truncated)
        : null
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
      this.trackerV2?.stop()
      const v2h = this.#infoHashV2Truncated
      const recreate = (): void => {
        this.tracker = this.#createTracker(this.infoHash)
        this.trackerV2 = v2h ? this.#createTracker(v2h) : null
      }
      if (this.trackerV2) {
        this.trackerV2.destroy(() => {
          this.tracker!.destroy(() => recreate())
        })
      } else {
        this.tracker.destroy(() => recreate())
      }
    }
  }

  complete(opts?: object): void {
    if (this.tracker) {
      this.tracker.complete(opts)
    }
    this.trackerV2?.complete(opts)
  }

  destroy(cb?: () => void): void {
    if (this.destroyed) return
    this.destroyed = true

    if (this.#dhtTimeout !== false) {
      clearTimeout(this.#dhtTimeout)
      this.#dhtTimeout = false
    }

    const tasks: ((taskCb: (err: Error | null) => void) => void)[] = []

    const destroyTracker = (t: InstanceType<typeof Client>) => {
      t.stop()
      t.removeListener('warning', this.#onWarning)
      t.removeListener('error', this.#onError)
      t.removeListener('peer', this.#onTrackerPeer)
      t.removeListener('update', this.#onTrackerAnnounce)
      tasks.push((taskCb) => {
        t.destroy(() => taskCb(null))
      })
    }

    if (this.tracker) {
      destroyTracker(this.tracker)
    }
    if (this.trackerV2) {
      destroyTracker(this.trackerV2)
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
    this.trackerV2 = null
    this.lsd = null
    this.#announce = null
  }

  #createTracker(infoHashHex: string): InstanceType<typeof Client> {
    const opts = Object.assign({}, this.#trackerOpts, {
      infoHash: infoHashHex,
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

    const afterAnnounce = (err?: Error | null) => {
      this.#dhtAnnouncing = false
      debug('dht announce complete')

      if (err) this.emit('warning', err)
      this.emit('dhtAnnounce')

      if (!this.destroyed) {
        const timer = setTimeout(
          () => {
            this.#dhtAnnounce()
          },
          this.#intervalMs + Math.floor((Math.random() * this.#intervalMs) / 5)
        )
        this.#dhtTimeout = timer
        if (typeof timer.unref === 'function') timer.unref()
      }
    }

    if (this.#infoHashV2Truncated) {
      this.dht!.announce(this.infoHash, this.#port, (err1?: Error | null) => {
        if (err1) this.emit('warning', err1)
        this.dht!.announce(this.#infoHashV2Truncated!, this.#port, afterAnnounce)
      })
    } else {
      this.dht!.announce(this.infoHash, this.#port, afterAnnounce)
    }
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
