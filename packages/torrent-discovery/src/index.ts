/*! torrent-discovery. MIT License. WebTorrent LLC <https://webtorrent.io/opensource> */
import Debug from 'debug'
import DHT from 'bittorrent-dht'
import { EventEmitter } from 'events'
import parallel from 'run-parallel'
import { Client as Tracker } from 'bittorrent-tracker'
import LSD from 'bittorrent-lsd'

const debug = Debug('torrent-discovery')

export interface DiscoveryOptions {
  peerId: string | Buffer
  infoHash: string | Buffer
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

class Discovery extends EventEmitter {
  peerId: string
  infoHash: string
  destroyed: boolean
  dht: DHT | null
  tracker: Tracker | null
  lsd: LSD | null

  private _port: number
  private _userAgent?: string
  private _announce: string[] | null
  private _intervalMs: number
  private _trackerOpts: object | null
  private _dhtAnnouncing: boolean
  private _dhtTimeout: NodeJS.Timeout | false
  private _internalDHT: boolean

  private _onWarning: (err: Error) => void
  private _onError: (err: Error) => void
  private _onDHTPeer: (peer: DHTPeer, infoHash: Buffer) => void
  private _onTrackerPeer: (peer: string) => void
  private _onTrackerAnnounce: () => void
  private _onLSDPeer: (peer: string, infoHash: Buffer) => void

  constructor(opts: DiscoveryOptions) {
    super()

    if (!opts.peerId) throw new Error('Option `peerId` is required')
    if (!opts.infoHash) throw new Error('Option `infoHash` is required')
    if (!(process as any).browser && !opts.port) throw new Error('Option `port` is required')

    this.peerId = typeof opts.peerId === 'string' ? opts.peerId : opts.peerId.toString('hex')
    this.infoHash =
      typeof opts.infoHash === 'string'
        ? opts.infoHash.toLowerCase()
        : opts.infoHash.toString('hex')
    this._port = opts.port
    this._userAgent = opts.userAgent

    this.destroyed = false

    this._announce = opts.announce || []
    this._intervalMs = opts.intervalMs || 15 * 60 * 1000
    this._trackerOpts = null
    this._dhtAnnouncing = false
    this._dhtTimeout = false
    this._internalDHT = false

    this._onWarning = (err) => {
      this.emit('warning', err)
    }
    this._onError = (err) => {
      this.emit('error', err)
    }
    this._onDHTPeer = (peer, infoHash) => {
      if (infoHash.toString('hex') !== this.infoHash) return
      this.emit('peer', `${peer.host}:${peer.port}`, 'dht')
    }
    this._onTrackerPeer = (peer) => {
      this.emit('peer', peer, 'tracker')
    }
    this._onTrackerAnnounce = () => {
      this.emit('trackerAnnounce')
    }
    this._onLSDPeer = (peer) => {
      this.emit('peer', peer, 'lsd')
    }

    const createDHT = (port?: number, dhtOpts?: object): DHT => {
      const dht = new DHT(dhtOpts)
      dht.on('warning', this._onWarning)
      dht.on('error', this._onError)
      dht.listen(port)
      this._internalDHT = true
      return dht
    }

    if (opts.tracker === false) {
      this.tracker = null
    } else if (opts.tracker && typeof opts.tracker === 'object') {
      this._trackerOpts = Object.assign({}, opts.tracker)
      this.tracker = this._createTracker()
    } else {
      this.tracker = this._createTracker()
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
      this.dht.on('peer', this._onDHTPeer)
      this._dhtAnnounce()
    }

    if (opts.lsd === false || typeof LSD !== 'function') {
      this.lsd = null
    } else {
      this.lsd = this._createLSD()
    }
  }

  updatePort(port: number): void {
    if (port === this._port) return
    this._port = port

    if (this.dht) this._dhtAnnounce()

    if (this.tracker) {
      this.tracker.stop()
      this.tracker.destroy(() => {
        this.tracker = this._createTracker()
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

    clearTimeout(this._dhtTimeout as NodeJS.Timeout)

    const tasks: ((cb: () => void) => void)[] = []

    if (this.tracker) {
      this.tracker.stop()
      this.tracker.removeListener('warning', this._onWarning)
      this.tracker.removeListener('error', this._onError)
      this.tracker.removeListener('peer', this._onTrackerPeer)
      this.tracker.removeListener('update', this._onTrackerAnnounce)
      tasks.push((cb) => {
        this.tracker!.destroy(cb)
      })
    }

    if (this.dht) {
      this.dht.removeListener('peer', this._onDHTPeer)
    }

    if (this._internalDHT) {
      this.dht!.removeListener('warning', this._onWarning)
      this.dht!.removeListener('error', this._onError)
      tasks.push((cb) => {
        this.dht!.destroy(cb)
      })
    }

    if (this.lsd) {
      this.lsd.removeListener('warning', this._onWarning)
      this.lsd.removeListener('error', this._onError)
      this.lsd.removeListener('peer', this._onLSDPeer)
      tasks.push((cb) => {
        this.lsd!.destroy(cb)
      })
    }

    parallel(tasks, cb || (() => {}))

    this.dht = null
    this.tracker = null
    this.lsd = null
    this._announce = null
  }

  private _createTracker(): Tracker {
    const opts = Object.assign({}, this._trackerOpts, {
      infoHash: this.infoHash,
      announce: this._announce,
      peerId: this.peerId,
      port: this._port,
      userAgent: this._userAgent,
    })

    const tracker = new Tracker(opts)
    tracker.on('warning', this._onWarning)
    tracker.on('error', this._onError)
    tracker.on('peer', this._onTrackerPeer)
    tracker.on('update', this._onTrackerAnnounce)
    tracker.setInterval(this._intervalMs)
    tracker.start()
    return tracker
  }

  private _dhtAnnounce(): void {
    if (this._dhtAnnouncing) return
    debug('dht announce')

    this._dhtAnnouncing = true
    clearTimeout(this._dhtTimeout as NodeJS.Timeout)

    this.dht!.announce(this.infoHash, this._port, (err?: Error) => {
      this._dhtAnnouncing = false
      debug('dht announce complete')

      if (err) this.emit('warning', err)
      this.emit('dhtAnnounce')

      if (!this.destroyed) {
        this._dhtTimeout = setTimeout(
          () => {
            this._dhtAnnounce()
          },
          this._intervalMs + Math.floor((Math.random() * this._intervalMs) / 5)
        )
        if (this._dhtTimeout.unref) this._dhtTimeout.unref()
      }
    })
  }

  private _createLSD(): LSD {
    const opts = Object.assign(
      {},
      {
        infoHash: this.infoHash,
        peerId: this.peerId,
        port: this._port,
      }
    )

    const lsd = new LSD(opts)
    lsd.on('warning', this._onWarning)
    lsd.on('error', this._onError)
    lsd.on('peer', this._onLSDPeer)
    lsd.start()
    return lsd
  }
}

export default Discovery
