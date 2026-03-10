import dgram from 'dgram'
import { EventEmitter } from 'eventemitter3'
import Debug from 'debug'

const debug = Debug('bittorrent-lsd')

const ANNOUNCE_INTERVAL = 300000 // 5min
const LSD_HOST = '239.192.152.143'
const LSD_PORT = 6771

interface LSDOptions {
  peerId: string | Buffer
  infoHash: string | Buffer
  port: string | number
}

interface ParsedAnnounce {
  host: string
  port: string
  infoHash: string[]
  cookie: string | null
}

class LSD extends EventEmitter {
  peerId: string
  infoHash: string
  port: string
  cookie: string
  destroyed: boolean = false
  annouceIntervalId: ReturnType<typeof setInterval> | null = null
  server: dgram.Socket

  constructor(opts: LSDOptions) {
    super()

    if (!opts.peerId) throw new Error('Option `peerId` is required')
    if (!opts.infoHash) throw new Error('Option `infoHash` is required')
    if (!opts.port) throw new Error('Option `port` is required')

    this.peerId = typeof opts.peerId === 'string' ? opts.peerId : opts.peerId.toString('hex')

    this.infoHash =
      typeof opts.infoHash === 'string'
        ? opts.infoHash.toLowerCase()
        : opts.infoHash.toString('hex')

    this.port = typeof opts.port === 'string' ? opts.port : opts.port.toString()

    this.cookie = `bittorrent-lsd-${this.peerId}`

    this.server = dgram.createSocket({ type: 'udp4', reuseAddr: true })

    const onListening = () => {
      debug('listening')

      try {
        this.server.addMembership(LSD_HOST)
      } catch (err) {
        this.emit('warning', err)
      }
    }

    const onMessage = (msg: Buffer, rinfo: dgram.RemoteInfo) => {
      debug('message', msg.toString(), `${rinfo.address}:${rinfo.port}`)

      const parsedAnnounce = this._parseAnnounce(msg.toString())

      if (parsedAnnounce === null) return
      if (parsedAnnounce.cookie === this.cookie) return

      parsedAnnounce.infoHash.forEach((infoHash) => {
        this.emit('peer', `${rinfo.address}:${parsedAnnounce.port}`, infoHash)
      })
    }

    const onError = (err: Error) => {
      this.emit('error', err)
    }

    this.server.on('listening', onListening)
    this.server.on('message', onMessage)
    this.server.on('error', onError)
  }

  private _parseAnnounce(announce: string): ParsedAnnounce | null {
    const checkHost = (host: string) => {
      return /^(239.192.152.143|\[ff15::efc0:988f\]):6771$/.test(host)
    }

    const checkPort = (port: string) => {
      return /^\d+$/.test(port)
    }

    const checkInfoHash = (infoHash: string) => {
      return /^[0-9a-fA-F]{40}$/.test(infoHash)
    }

    debug('parse announce', announce)
    const sections = announce.split('\r\n')

    if (sections[0] !== 'BT-SEARCH * HTTP/1.1') {
      this.emit('warning', 'Invalid LSD announce (header)')
      return null
    }

    const host = sections[1].split('Host: ')[1]

    if (!checkHost(host)) {
      this.emit('warning', 'Invalid LSD announce (host)')
      return null
    }

    const port = sections[2].split('Port: ')[1]

    if (!checkPort(port)) {
      this.emit('warning', 'Invalid LSD announce (port)')
      return null
    }

    const infoHash = sections
      .filter((section) => section.includes('Infohash: '))
      .map((section) => section.split('Infohash: ')[1])
      .filter((hash) => checkInfoHash(hash))

    if (infoHash.length === 0) {
      this.emit('warning', 'Invalid LSD announce (infoHash)')
      return null
    }

    const cookie = sections
      .filter((section) => section.includes('cookie: '))
      .map((section) => section.split('cookie: ')[1])
      .reduce((_acc, cur) => cur, null)

    return {
      host,
      port,
      infoHash,
      cookie,
    }
  }

  destroy(cb?: () => void): void {
    if (this.destroyed) return
    this.destroyed = true
    debug('destroy')

    clearInterval(this.annouceIntervalId!)
    this.server.close(cb)
  }

  start(): void {
    debug('start')
    this.server.bind(LSD_PORT)
    this._announce()

    this.annouceIntervalId = setInterval(() => {
      this._announce()
    }, ANNOUNCE_INTERVAL)
  }

  private _announce(): void {
    debug('send announce')
    const host = `${LSD_HOST}:${LSD_PORT}`

    const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${this.port}\r\nInfohash: ${this.infoHash}\r\ncookie: ${this.cookie}\r\n\r\n\r\n`
    this.server.send(announce, LSD_PORT, LSD_HOST)
  }
}

export default LSD
export type { LSDOptions, ParsedAnnounce }
