import { EventEmitter } from 'events'
import bencode from 'bencode'
import BitField from 'bitfield'
import Debug from 'debug'
import { hash, arr2text, concat } from 'uint8-util'

const debug = Debug('ut_metadata')

const MAX_METADATA_SIZE = 1e7 // 10 MB
const BITFIELD_GROW = 1e3
const PIECE_LENGTH = 1 << 14 // 16 KiB

interface Wire {
  extended(name: string, data: unknown): void
  extendedHandshake: {
    metadata_size?: number
  }
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

class utMetadata extends EventEmitter {
  static name = 'ut_metadata'

  metadata?: Uint8Array

  private _wire: Wire
  private _infoHash?: string
  private _fetching: boolean
  private _metadataComplete: boolean
  private _metadataSize: number | null
  private _numPieces: number = 0
  private _remainingRejects: number | null
  private _bitfield: BitField

  constructor(wire: Wire, metadata?: Uint8Array) {
    super()

    this._wire = wire

    this._fetching = false
    this._metadataComplete = false
    this._metadataSize = null
    this._remainingRejects = null

    this._bitfield = new BitField(0, { grow: BITFIELD_GROW })

    if (metadata) {
      this.setMetadata(metadata)
    }
  }

  onHandshake(infoHash: string, peerId: string, extensions: unknown): void {
    this._infoHash = infoHash
  }

  onExtendedHandshake(handshake: ExtendedHandshake): void {
    if (!handshake.m || !handshake.m.ut_metadata) {
      return this.emit('warning', new Error('Peer does not support ut_metadata'))
    }
    if (!handshake.metadata_size) {
      return this.emit('warning', new Error('Peer does not have metadata'))
    }
    if (
      typeof handshake.metadata_size !== 'number' ||
      MAX_METADATA_SIZE < handshake.metadata_size ||
      handshake.metadata_size <= 0
    ) {
      return this.emit('warning', new Error('Peer gave invalid metadata size'))
    }

    this._metadataSize = handshake.metadata_size
    this._numPieces = Math.ceil(this._metadataSize / PIECE_LENGTH)
    this._remainingRejects = this._numPieces * 2

    this._requestPieces()
  }

  onMessage(buf: Uint8Array): void {
    let dict: MessageDict
    let trailer: Uint8Array
    try {
      const str = arr2text(buf)
      const trailerIndex = str.indexOf('ee') + 2
      dict = bencode.decode(str.substring(0, trailerIndex)) as MessageDict
      trailer = buf.slice(trailerIndex)
    } catch {
      return
    }

    switch (dict.msg_type) {
      case 0:
        this._onRequest(dict.piece)
        break
      case 1:
        this._onData(dict.piece, trailer, dict.total_size!)
        break
      case 2:
        this._onReject(dict.piece)
        break
    }
  }

  fetch(): void {
    if (this._metadataComplete) {
      return
    }
    this._fetching = true
    if (this._metadataSize) {
      this._requestPieces()
    }
  }

  cancel(): void {
    this._fetching = false
  }

  async setMetadata(metadata: Uint8Array): Promise<boolean> {
    if (this._metadataComplete) return true
    debug('set metadata')

    try {
      const decoded = bencode.decode(metadata)
      if (decoded && typeof decoded === 'object' && 'info' in decoded) {
        metadata = bencode.encode((decoded as { info: unknown }).info)
      }
    } catch {}

    if (this._infoHash && this._infoHash !== (await hash(metadata, 'hex'))) {
      return false
    }

    this.cancel()

    this.metadata = metadata
    this._metadataComplete = true
    this._metadataSize = this.metadata.length
    this._wire.extendedHandshake.metadata_size = this._metadataSize

    this.emit(
      'metadata',
      bencode.encode({
        info: bencode.decode(this.metadata),
      })
    )

    return true
  }

  private _send(dict: Record<string, unknown>, trailer?: Uint8Array): void {
    let buf = bencode.encode(dict)
    if (trailer) {
      buf = concat([buf, trailer])
    }
    this._wire.extended('ut_metadata', buf)
  }

  private _request(piece: number): void {
    this._send({ msg_type: 0, piece })
  }

  private _data(piece: number, buf: Uint8Array, totalSize?: number): void {
    const msg: Record<string, unknown> = { msg_type: 1, piece }
    if (typeof totalSize === 'number') {
      msg.total_size = totalSize
    }
    this._send(msg, buf)
  }

  private _reject(piece: number): void {
    this._send({ msg_type: 2, piece })
  }

  private _onRequest(piece: number): void {
    if (!this._metadataComplete || !this.metadata || !this._metadataSize) {
      this._reject(piece)
      return
    }
    const start = piece * PIECE_LENGTH
    let end = start + PIECE_LENGTH
    if (end > this._metadataSize) {
      end = this._metadataSize
    }
    const buf = this.metadata.slice(start, end)
    this._data(piece, buf, this._metadataSize)
  }

  private _onData(piece: number, buf: Uint8Array, totalSize: number): void {
    if (buf.length > PIECE_LENGTH || !this._fetching) {
      return
    }
    if (!this.metadata) {
      this.metadata = new Uint8Array(this._metadataSize!)
    }
    this.metadata.set(buf, piece * PIECE_LENGTH)
    this._bitfield.set(piece)
    this._checkDone()
  }

  private _onReject(piece: number): void {
    if (this._remainingRejects! > 0 && this._fetching) {
      this._request(piece)
      this._remainingRejects! -= 1
    } else {
      this.emit('warning', new Error('Peer sent "reject" too much'))
    }
  }

  private _requestPieces(): void {
    if (!this._fetching) return
    this.metadata = new Uint8Array(this._metadataSize!)
    for (let piece = 0; piece < this._numPieces; piece++) {
      this._request(piece)
    }
  }

  private async _checkDone(): Promise<void> {
    let done = true
    for (let piece = 0; piece < this._numPieces; piece++) {
      if (!this._bitfield.get(piece)) {
        done = false
        break
      }
    }
    if (!done) return

    const success = await this.setMetadata(this.metadata!)

    if (!success) {
      this._failedMetadata()
    }
  }

  private _failedMetadata(): void {
    this._bitfield = new BitField(0, { grow: BITFIELD_GROW })
    this._remainingRejects! -= this._numPieces
    if (this._remainingRejects! > 0) {
      this._requestPieces()
    } else {
      this.emit('warning', new Error('Peer sent invalid metadata'))
    }
  }
}

;(utMetadata as any).prototype.name = 'ut_metadata'

export default (metadata?: Uint8Array) => {
  class UtMetadataWithMetadata extends utMetadata {
    constructor(wire: Wire) {
      super(wire, metadata)
    }
  }
  ;(UtMetadataWithMetadata as any).prototype.name = 'ut_metadata'
  return UtMetadataWithMetadata
}
