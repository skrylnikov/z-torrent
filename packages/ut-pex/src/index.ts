import { EventEmitter } from 'eventemitter3'
import { string2compact, compact2stringMulti, compact2stringMulti6 } from '@z-torrent/utils'
import bencode from 'bencode'
import type { PEXFlags, DecodedPEXFlags, PEXMessage, Wire, PeerEntry } from './types.js'

const PEX_INTERVAL = 65000
const PEX_MAX_PEERS = 50
const PEX_MIN_ALLOWED_INTERVAL = 60000

const FLAGS = {
  prefersEncryption: 0x01,
  isSender: 0x02,
  supportsUtp: 0x04,
  supportsUtHolepunch: 0x08,
  isReachable: 0x10,
  supportsV2: 0x20,
}

function toUint8Array(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value
  if (Array.isArray(value) && value.every((v) => typeof v === 'number')) {
    return Uint8Array.from(value)
  }
  return null
}

export class UtPex extends EventEmitter {
  get name() {
    return 'ut_pex'
  }
  #wire: Wire
  #intervalId: ReturnType<typeof setInterval> | null = null
  #lastMessageTimestamp = 0
  #remoteAddedPeers: Record<string, PeerEntry> = {}
  #remoteDroppedPeers: Record<string, PeerEntry> = {}
  #localAddedPeers: Record<string, PeerEntry> = {}
  #localDroppedPeers: Record<string, PeerEntry> = {}

  constructor(wire: Wire) {
    super()

    this.#wire = wire
    this.reset()
  }

  onHandshake(_infoHash: string, _peerId: string, _extensions: unknown): void {}

  start(): void {
    clearInterval(this.#intervalId!)
    this.#intervalId = setInterval(() => this.sendMessage(), PEX_INTERVAL)
    if (this.#intervalId?.unref) this.#intervalId.unref()
  }

  stop(): void {
    clearInterval(this.#intervalId!)
    this.#intervalId = null
  }

  reset(): void {
    this.#remoteAddedPeers = {}
    this.#remoteDroppedPeers = {}
    this.#localAddedPeers = {}
    this.#localDroppedPeers = {}
    this.stop()
  }

  addPeer(peer: string, flags: PEXFlags = {}): void {
    this.#addPeer(peer, this.#encodeFlags(flags), 4)
  }

  addPeer6(peer: string, flags: PEXFlags = {}): void {
    this.#addPeer(peer, this.#encodeFlags(flags), 6)
  }

  dropPeer(peer: string): void {
    this.#dropPeer(peer, 4)
  }

  dropPeer6(peer: string): void {
    this.#dropPeer(peer, 6)
  }

  onExtendedHandshake(handshake: { m?: { ut_pex?: number } }): void {
    if (!handshake.m || !handshake.m.ut_pex) {
      this.emit('warning', new Error('Peer does not support ut_pex'))
    }
  }

  onMessage(buf: Uint8Array): void {
    const currentMessageTimestamp = Date.now()

    if (currentMessageTimestamp - this.#lastMessageTimestamp < PEX_MIN_ALLOWED_INTERVAL) {
      this.reset()
      this.#wire.destroy()
      this.emit('warning', new Error('Peer disconnected for sending PEX messages too frequently'))
      return
    } else {
      this.#lastMessageTimestamp = currentMessageTimestamp
    }

    let message: Record<string, unknown>

    try {
      message = bencode.decode(Buffer.from(buf)) as Record<string, unknown>

      if (message.added) {
        const addedBuf = toUint8Array(message.added)
        if (addedBuf) {
          const addedFlags = toUint8Array(message['added.f'])
          compact2stringMulti(addedBuf).forEach((peer, idx) => {
            delete this.#remoteDroppedPeers[peer]
            if (!(peer in this.#remoteAddedPeers)) {
              const flags = addedFlags?.[idx]
              this.#remoteAddedPeers[peer] = { ip: 4, flags }
              this.emit('peer', peer, this.#decodeFlags(flags))
            }
          })
        }
      }

      if (message.added6) {
        const added6Buf = toUint8Array(message.added6)
        if (added6Buf) {
          const added6Flags = toUint8Array(message['added6.f'])
          compact2stringMulti6(added6Buf).forEach((peer, idx) => {
            delete this.#remoteDroppedPeers[peer]
            if (!(peer in this.#remoteAddedPeers)) {
              const flags = added6Flags?.[idx]
              this.#remoteAddedPeers[peer] = { ip: 6, flags }
              this.emit('peer', peer, this.#decodeFlags(flags))
            }
          })
        }
      }

      if (message.dropped) {
        const droppedBuf = toUint8Array(message.dropped)
        if (droppedBuf) {
          compact2stringMulti(droppedBuf).forEach((peer) => {
            delete this.#remoteAddedPeers[peer]
            if (!(peer in this.#remoteDroppedPeers)) {
              this.#remoteDroppedPeers[peer] = { ip: 4 }
              this.emit('dropped', peer)
            }
          })
        }
      }

      if (message.dropped6) {
        const dropped6Buf = toUint8Array(message.dropped6)
        if (dropped6Buf) {
          compact2stringMulti6(dropped6Buf).forEach((peer) => {
            delete this.#remoteAddedPeers[peer]
            if (!(peer in this.#remoteDroppedPeers)) {
              this.#remoteDroppedPeers[peer] = { ip: 6 }
              this.emit('dropped', peer)
            }
          })
        }
      }
    } catch {
      // drop invalid messages
    }
  }

  sendMessage(): void {
    const localAdded = Object.keys(this.#localAddedPeers).slice(0, PEX_MAX_PEERS)
    const localDropped = Object.keys(this.#localDroppedPeers).slice(0, PEX_MAX_PEERS)

    if (localAdded.length === 0 && localDropped.length === 0) return

    const isIPv4 = (peers: Record<string, PeerEntry>, addr: string) => peers[addr]!.ip === 4
    const isIPv6 = (peers: Record<string, PeerEntry>, addr: string) => peers[addr]!.ip === 6
    const flags = (peers: Record<string, PeerEntry>, addr: string) => peers[addr]!.flags

    const added = string2compact(localAdded.filter((k) => isIPv4(this.#localAddedPeers, k)))
    const added6 = string2compact(localAdded.filter((k) => isIPv6(this.#localAddedPeers, k)))
    const dropped = string2compact(localDropped.filter((k) => isIPv4(this.#localDroppedPeers, k)))
    const dropped6 = string2compact(localDropped.filter((k) => isIPv6(this.#localDroppedPeers, k)))

    const addedFlags = new Uint8Array(
      localAdded
        .filter((k) => isIPv4(this.#localAddedPeers, k))
        .map((k) => flags(this.#localAddedPeers, k) ?? 0)
    )

    const added6Flags = new Uint8Array(
      localAdded
        .filter((k) => isIPv6(this.#localAddedPeers, k))
        .map((k) => flags(this.#localAddedPeers, k) ?? 1)
    )

    localAdded.forEach((peer) => delete this.#localAddedPeers[peer])
    localDropped.forEach((peer) => delete this.#localDroppedPeers[peer])

    this.#wire.extended('ut_pex', {
      added: new Uint8Array(added),
      'added.f': addedFlags,
      dropped: new Uint8Array(dropped),
      added6: new Uint8Array(added6),
      'added6.f': added6Flags,
      dropped6: new Uint8Array(dropped6),
    })
  }

  #addPeer(peer: string, flags: number, version: 4 | 6): void {
    if (!peer.includes(':')) return
    if (peer in this.#remoteAddedPeers) return
    if (peer in this.#localDroppedPeers) delete this.#localDroppedPeers[peer]
    this.#localAddedPeers[peer] = { ip: version, flags }
  }

  #dropPeer(peer: string, version: 4 | 6): void {
    if (!peer.includes(':')) return
    if (peer in this.#remoteDroppedPeers) return
    if (peer in this.#localAddedPeers) delete this.#localAddedPeers[peer]
    this.#localDroppedPeers[peer] = { ip: version }
  }

  #decodeFlags(flags: number | undefined): DecodedPEXFlags {
    return {
      prefersEncryption: !!(flags! & FLAGS.prefersEncryption),
      isSender: !!(flags! & FLAGS.isSender),
      supportsUtp: !!(flags! & FLAGS.supportsUtp),
      supportsUtHolepunch: !!(flags! & FLAGS.supportsUtHolepunch),
      isReachable: !!(flags! & FLAGS.isReachable),
      supportsV2: !!(flags! & FLAGS.supportsV2),
    }
  }

  #encodeFlags(flags: PEXFlags): number {
    return Object.keys(flags).reduce(
      (acc, cur) =>
        (flags[cur as keyof PEXFlags] ?? false) === true
          ? acc | ((FLAGS as Record<string, number>)[cur] ?? 0)
          : acc,
      0x00
    )
  }
}

export type { PEXFlags, DecodedPEXFlags, PEXMessage, Wire, PeerEntry }
