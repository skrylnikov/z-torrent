import { EventEmitter } from 'events'
import compact2string from 'compact2string'
import string2compact from 'string2compact'
import bencode from 'bencode'
import type { PEXFlags, DecodedPEXFlags, Wire } from './types.js'

import type { PeerInfo } from './types.js'

const PEX_INTERVAL = 65000
const PEX_MAX_PEERS = 50
const PEX_MIN_ALLOWED_INTERVAL = 60000

const FLAGS = {
  prefersEncryption: 0x01,
  isSender: 0x02,
  supportsUtp: 0x04,
  supportsUtHolepunch: 0x08,
  isReachable: 0x10,
}

interface PeerEntry {
  ip: 4 | 6
  flags?: number
}

interface UtPexWire extends Wire {
  extended(name: string, data: unknown): void
  destroy(): void
}

class utPex extends EventEmitter {
  static name = 'ut_pex'

  private _wire: UtPexWire
  private _intervalId: ReturnType<typeof setInterval> | null = null
  private _lastMessageTimestamp = 0
  private _remoteAddedPeers: Record<string, PeerEntry> = {}
  private _remoteDroppedPeers: Record<string, PeerEntry> = {}
  private _localAddedPeers: Record<string, PeerEntry> = {}
  private _localDroppedPeers: Record<string, PeerEntry> = {}

  constructor(wire: UtPexWire) {
    super()

    this._wire = wire
    this.reset()
  }

  start(): void {
    clearInterval(this._intervalId!)
    this._intervalId = setInterval(() => this._sendMessage(), PEX_INTERVAL)
    if (this._intervalId!.unref) this._intervalId!.unref()
  }

  stop(): void {
    clearInterval(this._intervalId!)
    this._intervalId = null
  }

  reset(): void {
    this._remoteAddedPeers = {}
    this._remoteDroppedPeers = {}
    this._localAddedPeers = {}
    this._localDroppedPeers = {}
    this.stop()
  }

  addPeer(peer: string, flags: PEXFlags = {}): void {
    this._addPeer(peer, this._encodeFlags(flags), 4)
  }

  addPeer6(peer: string, flags: PEXFlags = {}): void {
    this._addPeer(peer, this._encodeFlags(flags), 6)
  }

  private _addPeer(peer: string, flags: number, version: 4 | 6): void {
    if (!peer.includes(':')) return
    if (peer in this._remoteAddedPeers) return
    if (peer in this._localDroppedPeers) delete this._localDroppedPeers[peer]
    this._localAddedPeers[peer] = { ip: version, flags }
  }

  dropPeer(peer: string): void {
    this._dropPeer(peer, 4)
  }

  dropPeer6(peer: string): void {
    this._dropPeer(peer, 6)
  }

  private _dropPeer(peer: string, version: 4 | 6): void {
    if (!peer.includes(':')) return
    if (peer in this._remoteDroppedPeers) return
    if (peer in this._localAddedPeers) delete this._localAddedPeers[peer]
    this._localDroppedPeers[peer] = { ip: version }
  }

  onExtendedHandshake(handshake: { m?: { ut_pex?: number } }): void {
    if (!handshake.m || !handshake.m.ut_pex) {
      return this.emit('warning', new Error('Peer does not support ut_pex'))
    }
  }

  onMessage(buf: Uint8Array): void {
    const currentMessageTimestamp = Date.now()

    if (currentMessageTimestamp - this._lastMessageTimestamp < PEX_MIN_ALLOWED_INTERVAL) {
      this.reset()
      this._wire.destroy()
      return this.emit(
        'warning',
        new Error('Peer disconnected for sending PEX messages too frequently')
      )
    } else {
      this._lastMessageTimestamp = currentMessageTimestamp
    }

    let message: Record<string, unknown>

    try {
      message = bencode.decode(buf) as Record<string, unknown>

      if (message.added) {
        compact2string.multi(Buffer.from(message.added as Uint8Array)).forEach((peer, idx) => {
          delete this._remoteDroppedPeers[peer]
          if (!(peer in this._remoteAddedPeers)) {
            const flags = (message['added.f'] as Uint8Array | undefined)?.[idx]
            this._remoteAddedPeers[peer] = { ip: 4, flags }
            this.emit('peer', peer, this._decodeFlags(flags))
          }
        })
      }

      if (message.added6) {
        compact2string.multi6(Buffer.from(message.added6 as Uint8Array)).forEach((peer, idx) => {
          delete this._remoteDroppedPeers[peer]
          if (!(peer in this._remoteAddedPeers)) {
            const flags = (message['added6.f'] as Uint8Array | undefined)?.[idx]
            this._remoteAddedPeers[peer] = { ip: 6, flags }
            this.emit('peer', peer, this._decodeFlags(flags))
          }
        })
      }

      if (message.dropped) {
        compact2string.multi(Buffer.from(message.dropped as Uint8Array)).forEach((peer) => {
          delete this._remoteAddedPeers[peer]
          if (!(peer in this._remoteDroppedPeers)) {
            this._remoteDroppedPeers[peer] = { ip: 4 }
            this.emit('dropped', peer)
          }
        })
      }

      if (message.dropped6) {
        compact2string.multi6(Buffer.from(message.dropped6 as Uint8Array)).forEach((peer) => {
          delete this._remoteAddedPeers[peer]
          if (!(peer in this._remoteDroppedPeers)) {
            this._remoteDroppedPeers[peer] = { ip: 6 }
            this.emit('dropped', peer)
          }
        })
      }
    } catch {
      // drop invalid messages
    }
  }

  private _decodeFlags(flags: number | undefined): DecodedPEXFlags {
    return {
      prefersEncryption: !!(flags! & FLAGS.prefersEncryption),
      isSender: !!(flags! & FLAGS.isSender),
      supportsUtp: !!(flags! & FLAGS.supportsUtp),
      supportsUtHolepunch: !!(flags! & FLAGS.supportsUtHolepunch),
      isReachable: !!(flags! & FLAGS.isReachable),
    }
  }

  private _encodeFlags(flags: PEXFlags): number {
    return Object.keys(flags).reduce(
      (acc, cur) =>
        flags[cur as keyof PEXFlags] === true ? acc | (FLAGS as Record<string, number>)[cur] : acc,
      0x00
    )
  }

  private _sendMessage(): void {
    const localAdded = Object.keys(this._localAddedPeers).slice(0, PEX_MAX_PEERS)
    const localDropped = Object.keys(this._localDroppedPeers).slice(0, PEX_MAX_PEERS)

    const _isIPv4 = (peers: Record<string, PeerEntry>, addr: string) => peers[addr].ip === 4
    const _isIPv6 = (peers: Record<string, PeerEntry>, addr: string) => peers[addr].ip === 6
    const _flags = (peers: Record<string, PeerEntry>, addr: string) => peers[addr].flags

    const added = string2compact(localAdded.filter((k) => _isIPv4(this._localAddedPeers, k)))

    const added6 = string2compact(localAdded.filter((k) => _isIPv6(this._localAddedPeers, k)))

    const dropped = string2compact(localDropped.filter((k) => _isIPv4(this._localDroppedPeers, k)))

    const dropped6 = string2compact(localDropped.filter((k) => _isIPv6(this._localDroppedPeers, k)))

    const addedFlags = Buffer.from(
      localAdded
        .filter((k) => _isIPv4(this._localAddedPeers, k))
        .map((k) => _flags(this._localAddedPeers, k) ?? 0)
    )

    const added6Flags = Buffer.from(
      localAdded
        .filter((k) => _isIPv6(this._localAddedPeers, k))
        .map((k) => _flags(this._localAddedPeers, k) ?? 1)
    )

    localAdded.forEach((peer) => delete this._localAddedPeers[peer])
    localDropped.forEach((peer) => delete this._localDroppedPeers[peer])

    this._wire.extended('ut_pex', {
      added: Buffer.from(added),
      'added.f': addedFlags,
      dropped: Buffer.from(dropped),
      added6: Buffer.from(added6),
      'added6.f': added6Flags,
      dropped6: Buffer.from(dropped6),
    })
  }
}

;(utPex as any).prototype.name = 'ut_pex'

export default () => utPex
export type { PEXFlags, DecodedPEXFlags, Wire }
