import { EventEmitter } from 'eventemitter3'
import { Transform, pipeline } from 'streamx'
import arrayRemove from 'unordered-array-remove'
import debugFactory from 'debug'
import Wire from '@z-torrent/protocol'
import type { TorrentWire } from './types.js'

const CONNECT_TIMEOUT_TCP = 5_000
const CONNECT_TIMEOUT_UTP = 5_000
const CONNECT_TIMEOUT_WEBRTC = 25_000
const HANDSHAKE_TIMEOUT = 25_000

const TYPE_TCP_INCOMING = 'tcpIncoming'
const TYPE_TCP_OUTGOING = 'tcpOutgoing'
const TYPE_UTP_INCOMING = 'utpIncoming'
const TYPE_UTP_OUTGOING = 'utpOutgoing'
const TYPE_WEBRTC = 'webrtc'
const TYPE_WEBSEED = 'webSeed'

const SOURCE_MANUAL = 'manual'
const SOURCE_TRACKER = 'tracker'
const SOURCE_DHT = 'dht'
const SOURCE_LSD = 'lsd'
const SOURCE_UT_PEX = 'ut_pex'

const debug = debugFactory('webtorrent:peer')

let secure = false

export const enableSecure = (): void => {
  secure = true
}

type PeerType = 'tcpIncoming' | 'tcpOutgoing' | 'utpIncoming' | 'utpOutgoing' | 'webrtc' | 'webSeed'
type PeerSource = 'manual' | 'tracker' | 'dht' | 'lsd' | 'ut_pex'

export interface ThrottleGroups {
  down: { throttle: () => Transform }
  up: { throttle: () => Transform }
}

export interface PeerSwarm extends TorrentWire {
  destroyed: boolean
  infoHash: string
  infoHashHash?: string
  private?: boolean
  wires: unknown[]
  client: { peerId: string; dht?: unknown }
  _onWire(wire: unknown, addr?: string): void
  removePeer(id: string): void
}

export default class Peer extends EventEmitter {
  id: string
  type: PeerType
  addr: string | null
  conn: any
  swarm: PeerSwarm | null
  wire: Wire | null
  source: PeerSource | null
  throttleGroups: ThrottleGroups | null
  connected: boolean
  destroyed: boolean
  timeout: ReturnType<typeof setTimeout> | null
  retries: number
  connectTimeout: ReturnType<typeof setTimeout> | null
  handshakeTimeout: ReturnType<typeof setTimeout> | null
  sentPe1: boolean
  sentPe2: boolean
  sentPe3: boolean
  sentPe4: boolean
  sentHandshake: boolean

  constructor(id: string, type: PeerType) {
    super()

    this.id = id
    this.type = type

    debug('new %s Peer %s', type, id)

    this.addr = null
    this.conn = null
    this.swarm = null
    this.wire = null
    this.source = null
    this.throttleGroups = null

    this.connected = false
    this.destroyed = false
    this.timeout = null
    this.retries = 0

    this.sentPe1 = false
    this.sentPe2 = false
    this.sentPe3 = false
    this.sentPe4 = false
    this.sentHandshake = false
  }

  onConnect(): void {
    if (this.destroyed) return
    this.connected = true
    this.emit('connect')

    debug('Peer %s connected', this.id)

    clearTimeout(this.connectTimeout!)

    const conn = this.conn
    conn.once('end', () => {
      this.destroy()
    })
    conn.once('close', () => {
      this.destroy()
    })
    conn.once('finish', () => {
      this.destroy()
    })
    conn.once('error', (err: Error) => {
      this.destroy(err)
    })

    const wire = (this.wire = new Wire(this.type as any, this.retries, secure))

    wire.once('end', () => {
      this.destroy()
    })
    wire.once('close', () => {
      this.destroy()
    })
    wire.once('finish', () => {
      this.destroy()
    })
    wire.once('error', (err: Error) => {
      this.destroy(err)
    })

    wire.once('pe1', () => {
      this.onPe1()
    })
    wire.once('pe2', () => {
      this.onPe2()
    })
    wire.once('pe3', () => {
      this.onPe3()
    })
    wire.once('pe4', () => {
      this.onPe4()
    })
    wire.once('handshake', (infoHash: string, peerId: string) => {
      this.onHandshake(infoHash, peerId)
    })
    this.startHandshakeTimeout()

    this.setThrottlePipes()

    if (this.swarm) {
      if (this.type === 'tcpOutgoing') {
        if (secure && this.retries === 0 && !this.sentPe1) this.sendPe1()
        else if (!this.sentHandshake) this.handshake()
      } else if (this.type !== 'tcpIncoming' && !this.sentHandshake) this.handshake()
    }
  }

  sendPe1(): void {
    this.wire!.sendPe1()
    this.sentPe1 = true
  }

  onPe1(): void {
    this.sendPe2()
  }

  sendPe2(): void {
    this.wire!.sendPe2()
    this.sentPe2 = true
  }

  onPe2(): void {
    this.sendPe3()
  }

  sendPe3(): void {
    this.wire!.sendPe3(this.swarm!.infoHash)
    this.sentPe3 = true
  }

  onPe3(infoHashHash: string): void {
    if (this.swarm) {
      if (this.swarm.infoHashHash !== infoHashHash) {
        this.destroy(new Error('unexpected crypto handshake info hash for this swarm'))
      }
      this.sendPe4()
    }
  }

  sendPe4(): void {
    this.wire!.sendPe4(this.swarm!.infoHash)
    this.sentPe4 = true
  }

  onPe4(): void {
    if (!this.sentHandshake) this.handshake()
  }

  clearPipes(): void {
    this.conn.unpipe()
    this.wire!.unpipe()
  }

  setThrottlePipes(): void {
    const self = this
    pipeline(
      this.conn,
      this.throttleGroups!.down.throttle(),
      new Transform({
        transform(chunk: Uint8Array, callback: (err?: Error | null, data?: Uint8Array) => void) {
          self.emit('download', chunk.length)
          if (self.destroyed) return
          callback(null, chunk)
        },
      }),
      this.wire,
      this.throttleGroups!.up.throttle(),
      new Transform({
        transform(chunk: Uint8Array, callback: (err?: Error | null, data?: Uint8Array) => void) {
          self.emit('upload', chunk.length)
          if (self.destroyed) return
          callback(null, chunk)
        },
      }),
      this.conn
    )
  }

  onHandshake(infoHash: string, peerId: string): void {
    if (!this.swarm) return
    if (this.destroyed) return

    if (this.swarm.destroyed) {
      return this.destroy(new Error('swarm already destroyed'))
    }
    if (infoHash !== this.swarm.infoHash) {
      return this.destroy(new Error('unexpected handshake info hash for this swarm'))
    }
    if (peerId === this.swarm.client.peerId) {
      return this.destroy(new Error('refusing to connect to ourselves'))
    }

    debug('Peer %s got handshake %s', this.id, infoHash)

    clearTimeout(this.handshakeTimeout!)

    this.retries = 0

    let addr = this.addr
    if (!addr && this.conn.remoteAddress && this.conn.remotePort) {
      addr = `${this.conn.remoteAddress}:${this.conn.remotePort}`
    }
    this.swarm._onWire(this.wire, addr)

    if (!this.swarm || this.swarm.destroyed) return

    if (!this.sentHandshake) this.handshake()
  }

  handshake(): void {
    const opts = {
      dht: this.swarm!.private ? false : !!this.swarm!.client.dht,
      fast: true,
    }
    this.wire!.handshake(this.swarm!.infoHash, this.swarm!.client.peerId, opts)
    this.sentHandshake = true
  }

  startConnectTimeout(): void {
    clearTimeout(this.connectTimeout!)

    const connectTimeoutValues: Record<string, number> = {
      webrtc: CONNECT_TIMEOUT_WEBRTC,
      tcpOutgoing: CONNECT_TIMEOUT_TCP,
      utpOutgoing: CONNECT_TIMEOUT_UTP,
    }

    this.connectTimeout = setTimeout(() => {
      this.destroy(new Error('connect timeout'))
    }, connectTimeoutValues[this.type])
    if ((this.connectTimeout as any)?.unref) (this.connectTimeout as any).unref()
  }

  startHandshakeTimeout(): void {
    clearTimeout(this.handshakeTimeout!)
    this.handshakeTimeout = setTimeout(() => {
      this.destroy(new Error('handshake timeout'))
    }, HANDSHAKE_TIMEOUT)
    if ((this.handshakeTimeout as any)?.unref) (this.handshakeTimeout as any).unref()
  }

  destroy(err?: Error): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this.connected) this.emit('disconnect', err)
    this.connected = false

    debug('destroy %s %s (error: %s)', this.type, this.id, err && (err.message || err))

    clearTimeout(this.connectTimeout!)
    clearTimeout(this.handshakeTimeout!)

    const swarm = this.swarm
    const conn = this.conn
    const wire = this.wire

    this.swarm = null
    this.conn = null
    this.wire = null

    if (swarm && wire) {
      arrayRemove(swarm.wires, swarm.wires.indexOf(wire))
    }
    if (conn) {
      conn.on('error', () => {})
      conn.destroy()
    }
    if (wire) wire.destroy()
    if (swarm) swarm.removePeer(this.id)
  }

  static TYPE_TCP_INCOMING = TYPE_TCP_INCOMING
  static TYPE_TCP_OUTGOING = TYPE_TCP_OUTGOING
  static TYPE_UTP_INCOMING = TYPE_UTP_INCOMING
  static TYPE_UTP_OUTGOING = TYPE_UTP_OUTGOING
  static TYPE_WEBRTC = TYPE_WEBRTC
  static TYPE_WEBSEED = TYPE_WEBSEED

  static SOURCE_MANUAL = SOURCE_MANUAL
  static SOURCE_TRACKER = SOURCE_TRACKER
  static SOURCE_DHT = SOURCE_DHT
  static SOURCE_LSD = SOURCE_LSD
  static SOURCE_UT_PEX = SOURCE_UT_PEX

  static createWebRTCPeer(
    conn: any,
    swarm: PeerSwarm,
    throttleGroups: ThrottleGroups,
    source: PeerSource | null = null
  ): Peer {
    const peer = new Peer(conn.id, 'webrtc')
    peer.conn = conn
    peer.swarm = swarm
    peer.throttleGroups = throttleGroups
    peer.source = source

    if (peer.conn.connected) {
      peer.onConnect()
    } else {
      const cleanup = () => {
        peer.conn.removeListener('connect', onConnect)
        peer.conn.removeListener('error', onError)
      }
      const onConnect = () => {
        cleanup()
        peer.onConnect()
      }
      const onError = (err: Error) => {
        cleanup()
        peer.destroy(err)
      }
      peer.conn.once('connect', onConnect)
      peer.conn.once('error', onError)
      peer.startConnectTimeout()
    }

    return peer
  }

  static createTCPIncomingPeer(conn: any, throttleGroups: ThrottleGroups): Peer {
    return Peer._createIncomingPeer(conn, TYPE_TCP_INCOMING, throttleGroups)
  }

  static createUTPIncomingPeer(conn: any, throttleGroups: ThrottleGroups): Peer {
    return Peer._createIncomingPeer(conn, TYPE_UTP_INCOMING, throttleGroups)
  }

  static createTCPOutgoingPeer(
    addr: string,
    swarm: PeerSwarm,
    throttleGroups: ThrottleGroups,
    source: PeerSource
  ): Peer {
    return Peer._createOutgoingPeer(addr, swarm, TYPE_TCP_OUTGOING, throttleGroups, source)
  }

  static createUTPOutgoingPeer(
    addr: string,
    swarm: PeerSwarm,
    throttleGroups: ThrottleGroups,
    source: PeerSource
  ): Peer {
    return Peer._createOutgoingPeer(addr, swarm, TYPE_UTP_OUTGOING, throttleGroups, source)
  }

  static _createIncomingPeer(conn: any, type: PeerType, throttleGroups: ThrottleGroups): Peer {
    const addr = `${conn.remoteAddress}:${conn.remotePort}`
    const peer = new Peer(addr, type)
    peer.conn = conn
    peer.addr = addr
    peer.throttleGroups = throttleGroups

    peer.onConnect()

    return peer
  }

  static _createOutgoingPeer(
    addr: string,
    swarm: PeerSwarm,
    type: PeerType,
    throttleGroups: ThrottleGroups,
    source: PeerSource | null = null
  ): Peer {
    const peer = new Peer(addr, type)
    peer.addr = addr
    peer.swarm = swarm
    peer.throttleGroups = throttleGroups
    peer.source = source

    return peer
  }

  static createWebSeedPeer(
    conn: any,
    id: string,
    swarm: PeerSwarm,
    throttleGroups: ThrottleGroups
  ): Peer {
    const peer = new Peer(id, TYPE_WEBSEED)

    peer.swarm = swarm
    peer.conn = conn
    peer.throttleGroups = throttleGroups

    peer.onConnect()

    return peer
  }
}
