import { EventEmitter } from 'eventemitter3'
import bencode from 'bencode'
import BitField from 'bitfield'
import Debug from 'debug'
import { hash, arr2text, concat } from 'uint8-util'

const debug = Debug('ut_metadata')

const MAX_METADATA_SIZE = 1e7
const BITFIELD_GROW = 1e3
const PIECE_LENGTH = 1 << 14

interface Wire {
  extended(name: string, data: unknown): void
  extendedHandshake: Record<string, unknown>
}

interface ExtendedHandshake {
  m?: {
    ut_metadata?: number
  }
  metadata_size?: number
}

interface MessageDict {
  msg_type: 0 | 1 | 2
  piece: number
  total_size?: number
}

export class UtMetadata extends EventEmitter {
  metadata?: Uint8Array

  #wire: Wire
  #infoHash?: string
  /** Full v2 info-hash (64 hex), when known (e.g. magnet `urn:btmh`). */
  #infoHashV2?: string
  #fetching = false
  #metadataComplete = false
  #metadataSize: number | null = null
  #numPieces = 0
  #remainingRejects: number | null = null
  #bitfield: BitField

  constructor(wire: Wire, metadata?: Uint8Array, infoHashV2?: string) {
    super()

    this.#wire = wire
    this.#infoHashV2 = infoHashV2?.toLowerCase()
    this.#bitfield = new BitField(0, { grow: BITFIELD_GROW })

    if (metadata) {
      void this.setMetadata(metadata)
    }
  }

  get name(): string {
    return 'ut_metadata'
  }

  onHandshake(infoHash: string, _peerId: string, _extensions: unknown): void {
    this.#infoHash = infoHash
  }

  onExtendedHandshake(handshake: ExtendedHandshake): void {
    if (!handshake.m || !handshake.m.ut_metadata) {
      this.emit('warning', new Error('Peer does not support ut_metadata'))
      return
    }
    if (!handshake.metadata_size) {
      this.emit('warning', new Error('Peer does not have metadata'))
      return
    }
    if (
      typeof handshake.metadata_size !== 'number' ||
      MAX_METADATA_SIZE < handshake.metadata_size ||
      handshake.metadata_size <= 0
    ) {
      this.emit('warning', new Error('Peer gave invalid metadata size'))
      return
    }

    this.#metadataSize = handshake.metadata_size
    this.#numPieces = Math.ceil(this.#metadataSize / PIECE_LENGTH)
    this.#remainingRejects = this.#numPieces * 2

    this.#requestPieces()
  }

  onMessage(buf: Uint8Array): void {
    let dict: MessageDict
    let trailer: Uint8Array
    try {
      const str = arr2text(buf)
      const trailerIndex = str.indexOf('ee') + 2
      dict = bencode.decode(Buffer.from(str.substring(0, trailerIndex))) as MessageDict
      trailer = buf.slice(trailerIndex)
    } catch {
      return
    }

    switch (dict.msg_type) {
      case 0:
        this.#onRequest(dict.piece)
        break
      case 1:
        this.#onData(dict.piece, trailer, dict.total_size!)
        break
      case 2:
        this.#onReject(dict.piece)
        break
    }
  }

  fetch(): void {
    if (this.#metadataComplete) {
      return
    }
    this.#fetching = true
    if (this.#metadataSize) {
      this.#requestPieces()
    }
  }

  cancel(): void {
    this.#fetching = false
  }

  async setMetadata(metadata: Uint8Array): Promise<boolean> {
    if (this.#metadataComplete) return true
    debug('set metadata')

    try {
      const decoded = bencode.decode(Buffer.from(metadata))
      if (decoded && typeof decoded === 'object' && 'info' in decoded) {
        metadata = Uint8Array.from(bencode.encode((decoded as { info: unknown }).info))
      }
    } catch {}

    const sha1Hex = await hash(metadata, 'hex')
    const sha256Hex = await hash(metadata, 'hex', 'sha256')
    if (this.#infoHashV2 && this.#infoHashV2 !== sha256Hex) {
      return false
    }
    if (this.#infoHash && this.#infoHash !== sha1Hex) {
      return false
    }

    this.cancel()

    this.metadata = metadata
    this.#metadataComplete = true
    this.#metadataSize = this.metadata.length
    this.#wire.extendedHandshake.metadata_size = this.#metadataSize

    this.emit(
      'metadata',
      Uint8Array.from(
        bencode.encode({
          info: bencode.decode(Buffer.from(this.metadata)),
        })
      )
    )

    return true
  }

  #send(dict: Record<string, unknown>, trailer?: Uint8Array): void {
    const encoded = Uint8Array.from(bencode.encode(dict))
    const buf = trailer ? concat([encoded, trailer]) : encoded
    this.#wire.extended('ut_metadata', buf)
  }

  #request(piece: number): void {
    this.#send({ msg_type: 0, piece })
  }

  #data(piece: number, buf: Uint8Array, totalSize?: number): void {
    const msg: Record<string, unknown> = { msg_type: 1, piece }
    if (typeof totalSize === 'number') {
      msg.total_size = totalSize
    }
    this.#send(msg, buf)
  }

  #reject(piece: number): void {
    this.#send({ msg_type: 2, piece })
  }

  #onRequest(piece: number): void {
    if (!this.#metadataComplete || !this.metadata || !this.#metadataSize) {
      this.#reject(piece)
      return
    }
    const start = piece * PIECE_LENGTH
    let end = start + PIECE_LENGTH
    if (end > this.#metadataSize) {
      end = this.#metadataSize
    }
    const buf = this.metadata.slice(start, end)
    this.#data(piece, buf, this.#metadataSize)
  }

  #onData(piece: number, buf: Uint8Array, totalSize: number): void {
    if (buf.length > PIECE_LENGTH || !this.#fetching) {
      return
    }
    if (!this.metadata) {
      this.metadata = new Uint8Array(this.#metadataSize!)
    }
    this.metadata.set(buf, piece * PIECE_LENGTH)
    this.#bitfield.set(piece)
    this.#checkDone()
  }

  #onReject(piece: number): void {
    if (this.#remainingRejects! > 0 && this.#fetching) {
      this.#request(piece)
      this.#remainingRejects! -= 1
    } else {
      this.emit('warning', new Error('Peer sent "reject" too much'))
    }
  }

  #requestPieces(): void {
    if (!this.#fetching) return
    this.metadata = new Uint8Array(this.#metadataSize!)
    for (let piece = 0; piece < this.#numPieces; piece++) {
      this.#request(piece)
    }
  }

  async #checkDone(): Promise<void> {
    let done = true
    for (let piece = 0; piece < this.#numPieces; piece++) {
      if (!this.#bitfield.get(piece)) {
        done = false
        break
      }
    }
    if (!done) return

    const success = await this.setMetadata(this.metadata!)

    if (!success) {
      this.#failedMetadata()
    }
  }

  #failedMetadata(): void {
    this.#bitfield = new BitField(0, { grow: BITFIELD_GROW })
    this.#remainingRejects! -= this.#numPieces
    if (this.#remainingRejects! > 0) {
      this.#requestPieces()
    } else {
      this.emit('warning', new Error('Peer sent invalid metadata'))
    }
  }
}

export function createUtMetadata(
  metadata?: Uint8Array,
  opts?: { infoHashV2?: string }
): typeof UtMetadata {
  class UtMetadataWithMetadata extends UtMetadata {
    constructor(wire: Wire) {
      super(wire, metadata, opts?.infoHashV2)
    }
  }
  return UtMetadataWithMetadata
}
