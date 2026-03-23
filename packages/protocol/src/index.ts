import bencode from 'bencode'
import BitField from 'bitfield'
import Debug from 'debug'
import RC4 from 'rc4'
import { Duplex } from 'streamx'
import { hash, concat, equal, hex2arr, arr2hex, text2arr, arr2text, randomBytes } from 'uint8-util'
import { createDiffieHellman, type DiffieHellman } from './dh-browser.js'
import throughput from 'throughput'
import arrayRemove from 'unordered-array-remove'

const debug = Debug('@z-torrent/protocol:wire')

const BITFIELD_GROW = 400000
const KEEP_ALIVE_TIMEOUT = 55000
const ALLOWED_FAST_SET_MAX_LENGTH = 100

const MESSAGE_PROTOCOL = text2arr('\u0013BitTorrent protocol')
const MESSAGE_KEEP_ALIVE = new Uint8Array([0x00, 0x00, 0x00, 0x00])
const MESSAGE_CHOKE = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x00])
const MESSAGE_UNCHOKE = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x01])
const MESSAGE_INTERESTED = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x02])
const MESSAGE_UNINTERESTED = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x03])

const MESSAGE_RESERVED = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
const MESSAGE_PORT = [0x00, 0x00, 0x00, 0x03, 0x09, 0x00, 0x00]

// BEP6 Fast Extension
const MESSAGE_HAVE_ALL = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x0e])
const MESSAGE_HAVE_NONE = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x0f])

const DH_PRIME =
  'ffffffffffffffffc90fdaa22168c234c4c6628b80dc1cd129024e088a67cc74020bbea63b139b22514a08798e3404ddef9519b3cd3a431b302b0a6df25f14374fe1356d6d51c245e485b576625e7ec6f44c42e9a63a36210000000000090563'
const DH_GENERATOR = 2
const VC = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
const CRYPTO_PROVIDE = new Uint8Array([0x00, 0x00, 0x01, 0x02])
const CRYPTO_SELECT = new Uint8Array([0x00, 0x00, 0x00, 0x02]) // always try to choose RC4 encryption instead of plaintext

function xor(a: Uint8Array, b: Uint8Array): Uint8Array {
  for (let len = a.length; len--; ) a[len] ^= b[len]
  return a
}

function getUint32(buffer: Uint8Array, at: number = 0): number {
  return (buffer[at] << 24) | (buffer[at + 1] << 16) | (buffer[at + 2] << 8) | buffer[at + 3]
}

function setUint32(buffer: Uint8Array, at: number, value: number): void {
  buffer[at] = (value >>> 24) & 0xff
  buffer[at + 1] = (value >>> 16) & 0xff
  buffer[at + 2] = (value >>> 8) & 0xff
  buffer[at + 3] = value & 0xff
}

function indexOfPattern(buffer: Uint8Array, pattern: Uint8Array): number {
  if (pattern.length === 0) return 0
  if (buffer.length < pattern.length) return -1
  for (let i = 0; i <= buffer.length - pattern.length; i++) {
    let found = true
    for (let j = 0; j < pattern.length; j++) {
      if (buffer[i + j] !== pattern[j]) {
        found = false
        break
      }
    }
    if (found) return i
  }
  return -1
}

type RequestCallback = (err: Error | null, buffer: Uint8Array | null) => void

class Request {
  piece: number
  offset: number
  length: number
  callback: RequestCallback

  constructor(piece: number, offset: number, length: number, callback: RequestCallback) {
    this.piece = piece
    this.offset = offset
    this.length = length
    this.callback = callback
  }
}

class HaveAllBitField {
  buffer: Uint8Array

  constructor() {
    this.buffer = new Uint8Array() // dummy
  }

  get(_index: number): boolean {
    return true
  }

  set(_index: number, _value?: boolean): void {}
}

export interface ProtocolExtensions {
  extended: boolean
  dht: boolean
  fast: boolean
  /** BEP 52: bit 0x10 in last reserved byte (hybrid / v2 hash tree) */
  v2?: boolean
}

/** BEP 52 hash request / hash reject payload (binary layout after message id). */
export interface HashWirePayload {
  piecesRoot: Uint8Array
  baseLayer: number
  index: number
  length: number
  proofLayers: number
}

export interface ProtocolExtendedHandshake {
  m?: Record<string, number | Uint8Array>
  [key: string]: unknown
}

export interface ProtocolExtension {
  name: string
  onHandshake: (infoHash: string, peerId: string, extensions: ProtocolExtensions) => void
  onExtendedHandshake: (handshake: ProtocolExtendedHandshake) => void
  onMessage: (buf: Uint8Array) => void
}

export type ProtocolExtensionConstructor = new (wire: Wire) => ProtocolExtension

type BitFieldLike = BitField | HaveAllBitField

class Wire extends Duplex {
  _debugId: string
  peerId: string | null
  peerIdBuffer: Uint8Array | null
  type: string | null

  amChoking: boolean
  amInterested: boolean

  peerChoking: boolean
  peerInterested: boolean

  peerPieces: BitFieldLike

  extensions: ProtocolExtensions
  peerExtensions: ProtocolExtensions

  requests: Request[]
  peerRequests: Request[]

  extendedMapping: Record<number, string>
  peerExtendedMapping: Record<string, number>

  extendedHandshake: ProtocolExtendedHandshake
  peerExtendedHandshake: ProtocolExtendedHandshake

  hasFast: boolean
  allowedFastSet: number[]
  peerAllowedFastSet: number[]

  _ext: Record<string, ProtocolExtension>
  _nextExt: number

  uploaded: number
  downloaded: number
  uploadSpeed: (bytes: number) => void
  downloadSpeed: (bytes: number) => void

  _keepAliveInterval: ReturnType<typeof setInterval> | null
  _timeout: ReturnType<typeof setTimeout> | null
  _timeoutMs: number
  _timeoutExpiresAt: number | null
  _timeoutUnref: boolean

  _finished: boolean

  _parserSize: number
  _parser: ((buffer: Uint8Array) => void) | null

  _buffer: Uint8Array[]
  _bufferSize: number

  _peEnabled: boolean
  _dh: DiffieHellman | null
  _myPubKey: string | null
  _peerPubKey: string | null
  _sharedSecret: string | null
  _peerCryptoProvide: number[]
  _cryptoHandshakeDone: boolean

  _cryptoSyncPattern: Uint8Array | null
  _waitMaxBytes: number | null
  _encryptionMethod: number | null
  _encryptGenerator: RC4 | null
  _decryptGenerator: RC4 | null
  _setGenerators: boolean

  _infoHash: Uint8Array | null
  _handshakeSent: boolean
  _extendedHandshakeSent: boolean;

  [key: string]: unknown

  constructor(type: string | null = null, retries: number = 0, peEnabled: boolean = false) {
    super()

    this._debugId = arr2hex(randomBytes(4))
    this._debug('new wire')

    this.peerId = null // remote peer id (hex string)
    this.peerIdBuffer = null // remote peer id (buffer)
    this.type = type // connection type ('webrtc', 'tcpIncoming', 'tcpOutgoing', 'webSeed')

    this.amChoking = true // are we choking the peer?
    this.amInterested = false // are we interested in the peer?

    this.peerChoking = true // is the peer choking us?
    this.peerInterested = false // is the peer interested in us?

    // The largest torrent that I know of (the Geocities archive) is ~641 GB and has
    // ~41,000 pieces. Therefore, cap bitfield to 10x larger (400,000 bits) to support all
    // possible torrents but prevent malicious peers from growing bitfield to fill memory.
    this.peerPieces = new BitField(0, { grow: BITFIELD_GROW })

    this.extensions = { extended: false, dht: false, fast: false, v2: false }
    this.peerExtensions = { extended: false, dht: false, fast: false, v2: false }

    this.requests = [] // outgoing
    this.peerRequests = [] // incoming

    this.extendedMapping = {} // number -> string, ex: 1 -> 'ut_metadata'
    this.peerExtendedMapping = {} // string -> number, ex: 9 -> 'ut_metadata'

    // The extended handshake to send, minus the "m" field, which gets automatically
    // filled from `this.extendedMapping`
    this.extendedHandshake = {}

    this.peerExtendedHandshake = {} // remote peer's extended handshake

    // BEP6 Fast Estension
    this.hasFast = false // is fast extension enabled?
    this.allowedFastSet = [] // allowed fast set
    this.peerAllowedFastSet = [] // peer's allowed fast set

    this._ext = {} // string -> function, ex 'ut_metadata' -> ut_metadata()
    this._nextExt = 1

    this.uploaded = 0
    this.downloaded = 0
    this.uploadSpeed = throughput()
    this.downloadSpeed = throughput()

    this._keepAliveInterval = null
    this._timeout = null
    this._timeoutMs = 0
    this._timeoutExpiresAt = null
    this._timeoutUnref = false

    this._finished = false

    this._parserSize = 0 // number of needed bytes to parse next message from remote peer
    this._parser = null // function to call once `this._parserSize` bytes are available

    this._buffer = [] // incomplete message data
    this._bufferSize = 0 // cached total length of buffers in `this._buffer`

    this._peEnabled = peEnabled
    if (peEnabled) {
      this._dh = createDiffieHellman(DH_PRIME, 'hex', DH_GENERATOR)
      this._myPubKey = this._dh.generateKeys('hex') // my DH public key
    } else {
      this._dh = null
      this._myPubKey = null
    }
    this._peerPubKey = null // peer's DH public key
    this._sharedSecret = null // shared DH secret
    this._peerCryptoProvide = [] // encryption methods provided by peer; we expect this to always contain 0x02
    this._cryptoHandshakeDone = false

    this._cryptoSyncPattern = null // the pattern to search for when resynchronizing after receiving pe1/pe2
    this._waitMaxBytes = null // the maximum number of bytes resynchronization must occur within
    this._encryptionMethod = null // 1 for plaintext, 2 for RC4
    this._encryptGenerator = null // RC4 keystream generator for encryption
    this._decryptGenerator = null // RC4 keystream generator for decryption
    this._setGenerators = false // a flag for whether setEncrypt() has successfully completed

    this._infoHash = null
    this._handshakeSent = false
    this._extendedHandshakeSent = false

    this.once('finish', () => this._onFinish())

    this.on('finish', this._onFinish)
    this._debug('type:', this.type)

    if (this.type === 'tcpIncoming' && this._peEnabled) {
      // If we are not the initiator, we should wait to see if the client begins
      // with PE/MSE handshake or the standard bittorrent handshake.
      this._determineHandshakeType()
    } else if (this.type === 'tcpOutgoing' && this._peEnabled && retries === 0) {
      this._parsePe2()
    } else {
      this._parseHandshake()
    }
  }

  setKeepAlive(enable: boolean): void {
    this._debug('setKeepAlive %s', enable)
    clearInterval(this._keepAliveInterval!)
    if (enable === false) return
    this._keepAliveInterval = setInterval(() => {
      this.keepAlive()
    }, KEEP_ALIVE_TIMEOUT)
  }

  setTimeout(ms: number, unref?: boolean): void {
    this._debug('setTimeout ms=%d unref=%s', ms, unref)
    this._timeoutMs = ms
    this._timeoutUnref = !!unref
    this._resetTimeout(true)
  }

  destroy(): this {
    if (this.destroyed) return this
    this._debug('destroy')
    this.end()
    return this
  }

  end(data?: unknown): this {
    if (this.destroyed || this.destroying) return this
    this._debug('end')
    this._onUninterested()
    this._onChoke()
    return super.end(data) as this
  }

  use(ExtCtor: ProtocolExtensionConstructor): void {
    const name = ExtCtor.prototype.name
    if (!name) {
      throw new Error('Extension class requires a "name" property on the prototype')
    }
    this._debug('use extension.name=%s', name)

    const ext = this._nextExt
    const handler = new ExtCtor(this)

    function noop(): void {}

    if (typeof handler.onHandshake !== 'function') {
      handler.onHandshake = noop
    }
    if (typeof handler.onExtendedHandshake !== 'function') {
      handler.onExtendedHandshake = noop
    }
    if (typeof handler.onMessage !== 'function') {
      handler.onMessage = noop
    }

    this.extendedMapping[ext] = name
    this._ext[name] = handler
    this[name] = handler

    this._nextExt += 1
  }

  keepAlive(): void {
    this._debug('keep-alive')
    this._push(MESSAGE_KEEP_ALIVE)
  }

  sendPe1(): void {
    if (this._peEnabled) {
      const padALen = Math.floor(Math.random() * 513)
      const padA = randomBytes(padALen)
      this._push(concat([hex2arr(this._myPubKey!), padA]))
    }
  }

  sendPe2(): void {
    const padBLen = Math.floor(Math.random() * 513)
    const padB = randomBytes(padBLen)
    this._push(concat([hex2arr(this._myPubKey!), padB]))
  }

  async sendPe3(infoHash: string): Promise<void> {
    await this.setEncrypt(this._sharedSecret!, infoHash)

    const hash1Buffer = await hash(hex2arr(this._utfToHex('req1') + this._sharedSecret))

    const hash2Buffer = await hash(hex2arr(this._utfToHex('req2') + infoHash))
    const hash3Buffer = await hash(hex2arr(this._utfToHex('req3') + this._sharedSecret))
    const hashesXorBuffer = xor(hash2Buffer, hash3Buffer)

    const padCLen = new DataView(randomBytes(2).buffer).getUint16(0) % 512
    const padCBuffer = randomBytes(padCLen)

    let vcAndProvideBuffer: Uint8Array = new Uint8Array(8 + 4 + 2 + padCLen + 2)
    vcAndProvideBuffer.set(VC)
    vcAndProvideBuffer.set(CRYPTO_PROVIDE, 8)

    const view = new DataView(vcAndProvideBuffer.buffer)

    view.setInt16(12, padCLen) // pad C length
    vcAndProvideBuffer.set(padCBuffer, 14)
    view.setInt16(14 + padCLen, 0) // IA length
    vcAndProvideBuffer = this._encryptHandshake(vcAndProvideBuffer)

    this._push(concat([hash1Buffer, hashesXorBuffer, vcAndProvideBuffer]))
  }

  async sendPe4(infoHash: string): Promise<void> {
    await this.setEncrypt(this._sharedSecret!, infoHash)

    const padDLen = new DataView(randomBytes(2).buffer).getUint16(0) % 512
    const padDBuffer = randomBytes(padDLen)
    let vcAndSelectBuffer: Uint8Array = new Uint8Array(8 + 4 + 2 + padDLen)
    const view = new DataView(vcAndSelectBuffer.buffer)

    vcAndSelectBuffer.set(VC)
    vcAndSelectBuffer.set(CRYPTO_SELECT, 8)
    view.setInt16(12, padDLen) // lenD?
    vcAndSelectBuffer.set(padDBuffer, 14)
    vcAndSelectBuffer = this._encryptHandshake(vcAndSelectBuffer)
    this._push(vcAndSelectBuffer)
    this._cryptoHandshakeDone = true
    this._debug('completed crypto handshake')
  }

  handshake(
    infoHash: Uint8Array | string,
    peerId: Uint8Array | string,
    extensions?: { dht?: boolean; fast?: boolean; v2?: boolean }
  ): void {
    let infoHashBuffer: Uint8Array
    let peerIdBuffer: Uint8Array
    let infoHashStr: string
    let peerIdStr: string
    if (typeof infoHash === 'string') {
      infoHashStr = infoHash.toLowerCase()
      infoHashBuffer = hex2arr(infoHashStr)
    } else {
      infoHashBuffer = infoHash
      infoHashStr = arr2hex(infoHashBuffer)
    }
    if (typeof peerId === 'string') {
      peerIdStr = peerId
      peerIdBuffer = hex2arr(peerIdStr)
    } else {
      peerIdBuffer = peerId
      peerIdStr = arr2hex(peerIdBuffer)
    }

    this._infoHash = infoHashBuffer

    if (infoHashBuffer.length !== 20 || peerIdBuffer.length !== 20) {
      throw new Error('infoHash and peerId MUST have length 20')
    }

    this._debug('handshake i=%s p=%s exts=%o', infoHashStr, peerIdStr, extensions)

    const reserved = new Uint8Array(MESSAGE_RESERVED)

    this.extensions = {
      extended: true,
      dht: !!(extensions && extensions.dht),
      fast: !!(extensions && extensions.fast),
      v2: !!(extensions && extensions.v2),
    }

    reserved[5] |= 0x10 // enable extended message
    if (this.extensions.dht) reserved[7] |= 0x01
    if (this.extensions.fast) reserved[7] |= 0x04
    if (this.extensions.v2) reserved[7] |= 0x10 // BEP 52

    // BEP6 Fast Extension: The extension is enabled only if both ends of the connection set this bit.
    if (this.extensions.fast && this.peerExtensions.fast) {
      this._debug('fast extension is enabled')
      this.hasFast = true
    }
    this._push(concat([MESSAGE_PROTOCOL, reserved, infoHashBuffer, peerIdBuffer]))
    this._handshakeSent = true

    if (this.peerExtensions.extended && !this._extendedHandshakeSent) {
      // Peer's handshake indicated support already
      // (incoming connection)
      this._sendExtendedHandshake()
    }
  }

  _sendExtendedHandshake(): void {
    // Create extended message object from registered extensions
    const msg: ProtocolExtendedHandshake = Object.assign({}, this.extendedHandshake)
    msg.m = {}
    for (const ext in this.extendedMapping) {
      const name = this.extendedMapping[ext as unknown as number]
      msg.m![name] = Number(ext)
    }

    // Send extended handshake
    this.extended(0, bencode.encode(msg))
    this._extendedHandshakeSent = true
  }

  choke(): void {
    if (this.amChoking) return
    this.amChoking = true
    this._debug('choke')
    this._push(MESSAGE_CHOKE)

    if (this.hasFast) {
      // BEP6: If a peer sends a choke, it MUST reject all requests from the peer to whom the choke
      // was sent except it SHOULD NOT reject requests for pieces that are in the allowed fast set.
      let allowedCount = 0
      while (this.peerRequests.length > allowedCount) {
        // until only allowed requests are left
        const request = this.peerRequests[allowedCount] // first non-allowed request
        if (this.allowedFastSet.includes(request.piece)) {
          ++allowedCount // count request as allowed
        } else {
          this.reject(request.piece, request.offset, request.length) // removes from this.peerRequests
        }
      }
    } else {
      while (this.peerRequests.length) {
        this.peerRequests.pop()
      }
    }
  }

  unchoke(): void {
    if (!this.amChoking) return
    this.amChoking = false
    this._debug('unchoke')
    this._push(MESSAGE_UNCHOKE)
  }

  interested(): void {
    if (this.amInterested) return
    this.amInterested = true
    this._debug('interested')
    this._push(MESSAGE_INTERESTED)
  }

  uninterested(): void {
    if (!this.amInterested) return
    this.amInterested = false
    this._debug('uninterested')
    this._push(MESSAGE_UNINTERESTED)
  }

  have(index: number): void {
    this._debug('have %d', index)
    this._message(4, [index], null)
  }

  bitfield(bitfield: BitField | Uint8Array): void {
    this._debug('bitfield')
    const data = ArrayBuffer.isView(bitfield) ? bitfield : (bitfield as BitField).buffer
    this._message(5, [], data)
  }

  request(index: number, offset: number, length: number, cb?: RequestCallback): void {
    const callback = cb || (() => {})
    if (this._finished) {
      callback(new Error('wire is closed'), null)
      return
    }

    if (this.peerChoking && !(this.hasFast && this.peerAllowedFastSet.includes(index))) {
      callback(new Error('peer is choking'), null)
      return
    }

    this._debug('request index=%d offset=%d length=%d', index, offset, length)

    this.requests.push(new Request(index, offset, length, callback))
    if (!this._timeout) {
      this._resetTimeout(true)
    }
    this._message(6, [index, offset, length], null)
  }

  piece(index: number, offset: number, buffer: Uint8Array): void {
    this._debug('piece index=%d offset=%d', index, offset)
    this._message(7, [index, offset], buffer)
    this.uploaded += buffer.length
    this.uploadSpeed(buffer.length)
    this.emit('upload', buffer.length)
  }

  cancel(index: number, offset: number, length: number): void {
    this._debug('cancel index=%d offset=%d length=%d', index, offset, length)
    this._callback(
      this._pull(this.requests, index, offset, length),
      new Error('request was cancelled'),
      null
    )
    this._message(8, [index, offset, length], null)
  }

  port(port: number): void {
    this._debug('port %d', port)
    const message = new Uint8Array(MESSAGE_PORT)
    const view = new DataView(message.buffer)
    view.setUint16(5, port)
    this._push(message)
  }

  suggest(index: number): void {
    if (!this.hasFast) throw Error('fast extension is disabled')
    this._debug('suggest %d', index)
    this._message(0x0d, [index], null)
  }

  haveAll(): void {
    if (!this.hasFast) throw Error('fast extension is disabled')
    this._debug('have-all')
    this._push(MESSAGE_HAVE_ALL)
  }

  haveNone(): void {
    if (!this.hasFast) throw Error('fast extension is disabled')
    this._debug('have-none')
    this._push(MESSAGE_HAVE_NONE)
  }

  reject(index: number, offset: number, length: number): void {
    if (!this.hasFast) throw Error('fast extension is disabled')
    this._debug('reject index=%d offset=%d length=%d', index, offset, length)
    this._pull(this.peerRequests, index, offset, length)
    this._message(0x10, [index, offset, length], null)
  }

  allowedFast(index: number): void {
    if (!this.hasFast) throw Error('fast extension is disabled')
    this._debug('allowed-fast %d', index)
    if (!this.allowedFastSet.includes(index)) this.allowedFastSet.push(index)
    this._message(0x11, [index], null)
  }

  /** BEP 52: hash wire messages require v2 bit negotiated on both handshakes (reserved byte). */
  _assertBep52HashWire(): void {
    if (!this.extensions.v2 || !this.peerExtensions.v2) {
      throw new Error(
        'BEP 52 hash wire messages require v2 support on both sides (handshake reserved bit 0x10)'
      )
    }
  }

  /**
   * BEP 52 hash request (message id 21).
   * `piecesRoot` must be 32 bytes (SHA-256 subtree root).
   */
  hashRequest(
    piecesRoot: Uint8Array,
    baseLayer: number,
    index: number,
    length: number,
    proofLayers: number
  ): void {
    this._assertBep52HashWire()
    if (piecesRoot.length !== 32) {
      throw new Error('hashRequest: piecesRoot must be 32 bytes')
    }
    this._debug('hashRequest baseLayer=%d index=%d len=%d', baseLayer, index, length)
    this._pushHashWire(21, piecesRoot, baseLayer, index, length, proofLayers, null)
  }

  /** BEP 52 hashes reply (message id 22). */
  hashes(
    piecesRoot: Uint8Array,
    baseLayer: number,
    index: number,
    length: number,
    proofLayers: number,
    hashPayload: Uint8Array
  ): void {
    this._assertBep52HashWire()
    if (piecesRoot.length !== 32) {
      throw new Error('hashes: piecesRoot must be 32 bytes')
    }
    this._debug('hashes baseLayer=%d index=%d', baseLayer, index)
    this._pushHashWire(22, piecesRoot, baseLayer, index, length, proofLayers, hashPayload)
  }

  /** BEP 52 hash reject (message id 23). */
  hashReject(
    piecesRoot: Uint8Array,
    baseLayer: number,
    index: number,
    length: number,
    proofLayers: number
  ): void {
    this._assertBep52HashWire()
    if (piecesRoot.length !== 32) {
      throw new Error('hashReject: piecesRoot must be 32 bytes')
    }
    this._debug('hashReject')
    this._pushHashWire(23, piecesRoot, baseLayer, index, length, proofLayers, null)
  }

  extended(ext: number | string, obj: Uint8Array | Record<string, unknown>): void {
    this._debug('extended ext=%s', ext)
    if (typeof ext === 'string' && this.peerExtendedMapping[ext]) {
      ext = this.peerExtendedMapping[ext]
    }
    if (typeof ext === 'number') {
      const extId = new Uint8Array([ext])
      const buf = ArrayBuffer.isView(obj) ? obj : bencode.encode(obj as Record<string, unknown>)

      this._message(20, [], concat([extId, buf]))
    } else {
      throw new Error(`Unrecognized extension: ${ext}`)
    }
  }

  async setEncrypt(sharedSecret: string, infoHash: string): Promise<boolean> {
    if (!this.type?.startsWith('tcp')) return false

    const outgoing = this.type === 'tcpOutgoing'

    const keyAGenerator = new RC4([
      ...(await hash(hex2arr(this._utfToHex('keyA') + sharedSecret + infoHash))),
    ])
    const keyBGenerator = new RC4([
      ...(await hash(hex2arr(this._utfToHex('keyB') + sharedSecret + infoHash))),
    ])

    this._encryptGenerator = outgoing ? keyAGenerator : keyBGenerator
    this._decryptGenerator = outgoing ? keyBGenerator : keyAGenerator

    // Discard the first 1024 bytes, as per MSE/PE implementation
    for (let i = 0; i < 1024; i++) {
      this._encryptGenerator.randomByte()
      this._decryptGenerator.randomByte()
    }

    this._setGenerators = true
    this.emit('_generators')
    return true
  }

  _message(id: number, numbers: number[], data: Uint8Array | null): void {
    const dataLength = data ? data.length : 0
    const buffer = new Uint8Array(5 + 4 * numbers.length)

    setUint32(buffer, 0, buffer.length + dataLength - 4)
    buffer[4] = id
    for (let i = 0; i < numbers.length; i++) {
      setUint32(buffer, 5 + 4 * i, numbers[i])
    }

    this._push(buffer)
    if (data) this._push(data)
  }

  /** BEP 52 hash messages: id + 32-byte root + four big-endian uint32 + optional tail. */
  _pushHashWire(
    id: number,
    piecesRoot: Uint8Array,
    baseLayer: number,
    index: number,
    length: number,
    proofLayers: number,
    trailing: Uint8Array | null
  ): void {
    const trailLen = trailing ? trailing.length : 0
    const bodyAfterLen = 1 + 32 + 16 + trailLen
    const buf = new Uint8Array(4 + bodyAfterLen)
    setUint32(buf, 0, bodyAfterLen)
    buf[4] = id & 0xff
    buf.set(piecesRoot, 5)
    setUint32(buf, 37, baseLayer)
    setUint32(buf, 41, index)
    setUint32(buf, 45, length)
    setUint32(buf, 49, proofLayers)
    if (trailing) buf.set(trailing, 53)
    this._push(buf)
  }

  _parseHashWirePayload(buffer: Uint8Array): HashWirePayload | null {
    if (buffer.length < 49) return null
    return {
      piecesRoot: buffer.subarray(1, 33),
      baseLayer: getUint32(buffer, 33),
      index: getUint32(buffer, 37),
      length: getUint32(buffer, 41),
      proofLayers: getUint32(buffer, 45),
    }
  }

  _onHashRequest(buffer: Uint8Array): void {
    const p = this._parseHashWirePayload(buffer)
    if (!p) {
      this._debug('short hash_request')
      return
    }
    this._debug('got hash_request')
    this.emit('hash_request', p)
  }

  _onHashes(buffer: Uint8Array): void {
    const p = this._parseHashWirePayload(buffer)
    /** 1 byte id + 32 root + 16 bytes (four uint32) = 49; tail is merkle hash data */
    if (!p || buffer.length < 49) {
      this._debug('short hashes')
      return
    }
    const hashes = buffer.subarray(49)
    this._debug('got hashes payload=%d', hashes.length)
    this.emit('hashes', p, hashes)
  }

  _onHashReject(buffer: Uint8Array): void {
    const p = this._parseHashWirePayload(buffer)
    if (!p) {
      this._debug('short hash_reject')
      return
    }
    this._debug('got hash_reject')
    this.emit('hash_reject', p)
  }

  _push(data: Uint8Array): boolean | void {
    if (this._finished) return
    if (this._encryptionMethod === 2 && this._cryptoHandshakeDone) {
      data = this._encrypt(data)
    }
    return this.push(data)
  }

  _onKeepAlive(): void {
    this._debug('got keep-alive')
    this.emit('keep-alive')
  }

  _onPe1(pubKeyBuffer: Uint8Array): void {
    this._peerPubKey = arr2hex(pubKeyBuffer)
    this._sharedSecret = this._dh!.computeSecret(this._peerPubKey, 'hex', 'hex')
    this.emit('pe1')
  }

  _onPe2(pubKeyBuffer: Uint8Array): void {
    this._peerPubKey = arr2hex(pubKeyBuffer)
    this._sharedSecret = this._dh!.computeSecret(this._peerPubKey, 'hex', 'hex')
    this.emit('pe2')
  }

  async _onPe3(hashesXorBuffer: Uint8Array): Promise<void> {
    const hash3 = await hash(hex2arr(this._utfToHex('req3') + this._sharedSecret))
    const sKeyHash = arr2hex(xor(hash3, hashesXorBuffer))
    this.emit('pe3', sKeyHash)
  }

  _onPe3Encrypted(
    vcBuffer: Uint8Array,
    peerProvideBuffer: Uint8Array,
    _padCBuffer: Uint8Array,
    _iaBuffer: Uint8Array
  ): void {
    if (!equal(vcBuffer, VC)) {
      this._debug('Error: verification constant did not match')
      this.destroy()
      return
    }

    for (const provideByte of peerProvideBuffer.values()) {
      if (provideByte !== 0) {
        this._peerCryptoProvide.push(provideByte)
      }
    }
    if (this._peerCryptoProvide.includes(2)) {
      this._encryptionMethod = 2
    } else {
      this._debug('Error: RC4 encryption method not provided by peer')
      this.destroy()
    }
  }

  _onPe4(peerSelectBuffer: Uint8Array): void {
    this._encryptionMethod = peerSelectBuffer[3]
    if (!CRYPTO_PROVIDE.includes(this._encryptionMethod)) {
      this._debug('Error: peer selected invalid crypto method')
      this.destroy()
    }
    this._cryptoHandshakeDone = true
    this._debug('crypto handshake done')
    this.emit('pe4')
  }

  _onHandshake(
    infoHashBuffer: Uint8Array,
    peerIdBuffer: Uint8Array,
    extensions: ProtocolExtensions
  ): void {
    const infoHash = arr2hex(infoHashBuffer)
    const peerId = arr2hex(peerIdBuffer)

    this._debug('got handshake i=%s p=%s exts=%o', infoHash, peerId, extensions)

    this.peerId = peerId
    this.peerIdBuffer = peerIdBuffer
    this.peerExtensions = extensions

    // BEP6 Fast Extension: The extension is enabled only if both ends of the connection set this bit.
    if (this.extensions.fast && this.peerExtensions.fast) {
      this._debug('fast extension is enabled')
      this.hasFast = true
    }

    this.emit('handshake', infoHash, peerId, extensions)

    for (const name in this._ext) {
      this._ext[name].onHandshake(infoHash, peerId, extensions)
    }

    if (extensions.extended && this._handshakeSent && !this._extendedHandshakeSent) {
      // outgoing connection
      this._sendExtendedHandshake()
    }
  }

  _onChoke(): void {
    this.peerChoking = true
    this._debug('got choke')
    this.emit('choke')
    if (!this.hasFast) {
      // BEP6 Fast Extension: Choke no longer implicitly rejects all pending requests
      while (this.requests.length) {
        this._callback(this.requests.pop()!, new Error('peer is choking'), null)
      }
    }
  }

  _onUnchoke(): void {
    this.peerChoking = false
    this._debug('got unchoke')
    this.emit('unchoke')
  }

  _onInterested(): void {
    this.peerInterested = true
    this._debug('got interested')
    this.emit('interested')
  }

  _onUninterested(): void {
    this.peerInterested = false
    this._debug('got uninterested')
    this.emit('uninterested')
  }

  _onHave(index: number): void {
    if (this.peerPieces.get(index)) return
    this._debug('got have %d', index)

    this.peerPieces.set(index, true)
    this.emit('have', index)
  }

  _onBitField(buffer: Uint8Array): void {
    this.peerPieces = new BitField(buffer)
    this._debug('got bitfield')
    this.emit('bitfield', this.peerPieces)
  }

  _onRequest(index: number, offset: number, length: number): void {
    if (this.amChoking && !(this.hasFast && this.allowedFastSet.includes(index))) {
      // BEP6: If a peer receives a request from a peer its choking, the peer receiving
      // the request SHOULD send a reject unless the piece is in the allowed fast set.
      if (this.hasFast) this.reject(index, offset, length)
      return
    }
    this._debug('got request index=%d offset=%d length=%d', index, offset, length)

    const respond: RequestCallback = (err, buffer) => {
      if (request !== this._pull(this.peerRequests, index, offset, length)) return
      if (err) {
        this._debug(
          'error satisfying request index=%d offset=%d length=%d (%s)',
          index,
          offset,
          length,
          err.message
        )
        if (this.hasFast) this.reject(index, offset, length)
        return
      }
      this.piece(index, offset, buffer!)
    }

    const request = new Request(index, offset, length, respond)
    this.peerRequests.push(request)
    this.emit('request', index, offset, length, respond)
  }

  _onPiece(index: number, offset: number, buffer: Uint8Array): void {
    this._debug('got piece index=%d offset=%d', index, offset)
    this._callback(this._pull(this.requests, index, offset, buffer.length), null, buffer)
    this.downloaded += buffer.length
    this.downloadSpeed(buffer.length)
    this.emit('download', buffer.length)
    this.emit('piece', index, offset, buffer)
  }

  _onCancel(index: number, offset: number, length: number): void {
    this._debug('got cancel index=%d offset=%d length=%d', index, offset, length)
    this._pull(this.peerRequests, index, offset, length)
    this.emit('cancel', index, offset, length)
  }

  _onPort(port: number): void {
    this._debug('got port %d', port)
    this.emit('port', port)
  }

  _onSuggest(index: number): void {
    if (!this.hasFast) {
      // BEP6: the peer MUST close the connection
      this._debug('Error: got suggest whereas fast extension is disabled')
      this.destroy()
      return
    }
    this._debug('got suggest %d', index)
    this.emit('suggest', index)
  }

  _onHaveAll(): void {
    if (!this.hasFast) {
      // BEP6: the peer MUST close the connection
      this._debug('Error: got have-all whereas fast extension is disabled')
      this.destroy()
      return
    }
    this._debug('got have-all')
    this.peerPieces = new HaveAllBitField()
    this.emit('have-all')
  }

  _onHaveNone(): void {
    if (!this.hasFast) {
      // BEP6: the peer MUST close the connection
      this._debug('Error: got have-none whereas fast extension is disabled')
      this.destroy()
      return
    }
    this._debug('got have-none')
    this.emit('have-none')
  }

  _onReject(index: number, offset: number, length: number): void {
    if (!this.hasFast) {
      // BEP6: the peer MUST close the connection
      this._debug('Error: got reject whereas fast extension is disabled')
      this.destroy()
      return
    }
    this._debug('got reject index=%d offset=%d length=%d', index, offset, length)
    this._callback(
      this._pull(this.requests, index, offset, length),
      new Error('request was rejected'),
      null
    )
    this.emit('reject', index, offset, length)
  }

  _onAllowedFast(index: number): void {
    if (!this.hasFast) {
      // BEP6: the peer MUST close the connection
      this._debug('Error: got allowed-fast whereas fast extension is disabled')
      this.destroy()
      return
    }
    this._debug('got allowed-fast %d', index)
    if (!this.peerAllowedFastSet.includes(index)) this.peerAllowedFastSet.push(index)
    if (this.peerAllowedFastSet.length > ALLOWED_FAST_SET_MAX_LENGTH)
      this.peerAllowedFastSet.shift()
    this.emit('allowed-fast', index)
  }

  _onExtended(ext: number, buf: Uint8Array): void {
    if (ext === 0) {
      let info: ProtocolExtendedHandshake | undefined
      try {
        info = bencode.decode(buf) as ProtocolExtendedHandshake
      } catch (err) {
        const error = err as Error
        this._debug('ignoring invalid extended handshake: %s', error.message || error)
      }

      if (!info) return
      this.peerExtendedHandshake = info

      if (typeof info.m === 'object') {
        for (const name in info.m) {
          this.peerExtendedMapping[name] = Number(
            (info.m as Record<string, Uint8Array>)[name].toString()
          )
        }
      }
      for (const name in this._ext) {
        if (this.peerExtendedMapping[name]) {
          this._ext[name].onExtendedHandshake(this.peerExtendedHandshake)
        }
      }
      this._debug('got extended handshake')
      this.emit('extended', 'handshake', this.peerExtendedHandshake)
    } else {
      const extName = this.extendedMapping[ext]
      if (extName) {
        if (this._ext[extName]) {
          // there is an registered extension handler, so call it
          this._ext[extName].onMessage(buf)
        }
      }
      this._debug('got extended message ext=%s', ext)
      this.emit('extended', ext, buf)
    }
  }

  _onTimeout(): void {
    this._debug('request timed out')
    this._callback(this.requests.shift()!, new Error('request has timed out'), null)
    this.emit('timeout')
  }

  _write(data: Uint8Array, cb: (err?: Error | null) => void): void {
    if (this._encryptionMethod === 2 && this._cryptoHandshakeDone) {
      data = this._decrypt(data)
    }
    this._bufferSize += data.length
    this._buffer.push(data)
    if (this._buffer.length > 1) {
      this._buffer = [concat(this._buffer, this._bufferSize)]
    }
    // now this._buffer is an array containing a single Buffer
    if (this._cryptoSyncPattern) {
      const index = indexOfPattern(this._buffer[0], this._cryptoSyncPattern)
      if (index !== -1) {
        this._buffer[0] = this._buffer[0].slice(index + this._cryptoSyncPattern.length)
        this._bufferSize -= index + this._cryptoSyncPattern.length
        this._cryptoSyncPattern = null
      } else if (
        this._bufferSize + data.length >
        this._waitMaxBytes! + this._cryptoSyncPattern.length
      ) {
        this._debug('Error: could not resynchronize')
        this.destroy()
        return
      }
    }

    while (this._bufferSize >= this._parserSize && !this._cryptoSyncPattern) {
      if (this._parserSize === 0) {
        this._parser!(new Uint8Array())
      } else {
        const buffer = this._buffer[0]

        this._bufferSize -= this._parserSize
        this._buffer = this._bufferSize ? [buffer.subarray(this._parserSize)] : []
        this._parser!(buffer.subarray(0, this._parserSize))
      }
    }

    cb(null) // Signal that we're ready for more data
  }

  _callback(request: Request | null, err: Error | null, buffer: Uint8Array | null): void {
    if (!request) return

    this._resetTimeout(!this.peerChoking && !this._finished)

    request.callback(err, buffer)
  }

  _resetTimeout(setAgain: boolean): void {
    if (!setAgain || !this._timeoutMs || !this.requests.length) {
      clearTimeout(this._timeout!)
      this._timeout = null
      this._timeoutExpiresAt = null
      return
    }

    const timeoutExpiresAt = Date.now() + this._timeoutMs

    if (this._timeout) {
      // If existing expiration is already within 5% of correct, it's close enough
      if (timeoutExpiresAt - this._timeoutExpiresAt! < this._timeoutMs * 0.05) {
        return
      }
      clearTimeout(this._timeout)
    }

    this._timeoutExpiresAt = timeoutExpiresAt
    this._timeout = setTimeout(() => this._onTimeout(), this._timeoutMs)
    if (this._timeoutUnref && this._timeout?.unref) this._timeout.unref()
  }

  _parse(size: number, parser: (buffer: Uint8Array) => void): void {
    this._parserSize = size
    this._parser = parser
  }

  _parseUntil(pattern: Uint8Array, maxBytes: number): void {
    this._cryptoSyncPattern = pattern
    this._waitMaxBytes = maxBytes
  }

  _onMessageLength(buffer: Uint8Array): void {
    const length = getUint32(buffer)
    if (length > 0) {
      this._parse(length, this._onMessage)
    } else {
      this._onKeepAlive()
      this._parse(4, this._onMessageLength)
    }
  }

  _onMessage = (buffer: Uint8Array): void => {
    this._parse(4, this._onMessageLength)
    switch (buffer[0]) {
      case 0:
        return this._onChoke()
      case 1:
        return this._onUnchoke()
      case 2:
        return this._onInterested()
      case 3:
        return this._onUninterested()
      case 4:
        return this._onHave(getUint32(buffer, 1))
      case 5:
        return this._onBitField(buffer.subarray(1))
      case 6:
        return this._onRequest(getUint32(buffer, 1), getUint32(buffer, 5), getUint32(buffer, 9))
      case 7:
        return this._onPiece(getUint32(buffer, 1), getUint32(buffer, 5), buffer.subarray(9))
      case 8:
        return this._onCancel(getUint32(buffer, 1), getUint32(buffer, 5), getUint32(buffer, 9))
      case 9:
        return this._onPort((buffer[1] << 8) | buffer[2])
      case 0x0d:
        return this._onSuggest(getUint32(buffer, 1))
      case 0x0e:
        return this._onHaveAll()
      case 0x0f:
        return this._onHaveNone()
      case 0x10:
        return this._onReject(getUint32(buffer, 1), getUint32(buffer, 5), getUint32(buffer, 9))
      case 0x11:
        return this._onAllowedFast(getUint32(buffer, 1))
      case 21:
        return this._onHashRequest(buffer)
      case 22:
        return this._onHashes(buffer)
      case 23:
        return this._onHashReject(buffer)
      case 20:
        return this._onExtended(buffer[1], buffer.subarray(2))
      default:
        this._debug('got unknown message')
        this.emit('unknownmessage', buffer)
    }
  }

  _determineHandshakeType(): void {
    this._parse(1, (pstrLenBuffer) => {
      const pstrlen = pstrLenBuffer[0]
      if (pstrlen === 19) {
        this._parse(pstrlen + 48, this._onHandshakeBuffer)
      } else {
        this._parsePe1(pstrLenBuffer)
      }
    })
  }

  _parsePe1(pubKeyPrefix: Uint8Array): void {
    this._parse(95, (pubKeySuffix) => {
      this._onPe1(concat([pubKeyPrefix, pubKeySuffix]))
      this._parsePe3()
    })
  }

  _parsePe2(): void {
    this._parse(96, async (pubKey) => {
      this._onPe2(pubKey)
      if (!this._setGenerators) {
        // Wait until generators have been set
        await new Promise<void>((resolve) => this.once('_generators', resolve))
      }
      this._parsePe4()
    })
  }

  // Handles the unencrypted portion of step 4
  async _parsePe3(): Promise<void> {
    const hash1Buffer = await hash(hex2arr(this._utfToHex('req1') + this._sharedSecret))
    // synchronize on HASH('req1', S)
    this._parseUntil(hash1Buffer, 512)
    this._parse(20, async (buffer) => {
      this._onPe3(buffer)
      if (!this._setGenerators) {
        // Wait until generators have been set
        await new Promise<void>((resolve) => this.once('_generators', resolve))
      }
      this._parsePe3Encrypted()
    })
  }

  _parsePe3Encrypted(): void {
    this._parse(14, (buffer) => {
      const vcBuffer = this._decryptHandshake(buffer.slice(0, 8))
      const peerProvideBuffer = this._decryptHandshake(buffer.slice(8, 12))
      const padCLen = new DataView(this._decryptHandshake(buffer.slice(12, 14)).buffer).getUint16(0)
      this._parse(padCLen, (padCBuffer) => {
        padCBuffer = this._decryptHandshake(padCBuffer)
        this._parse(2, (iaLenBuf) => {
          const iaLen = new DataView(this._decryptHandshake(iaLenBuf).buffer).getUint16(0)
          this._parse(iaLen, (iaBuffer) => {
            iaBuffer = this._decryptHandshake(iaBuffer)
            this._onPe3Encrypted(vcBuffer, peerProvideBuffer, padCBuffer, iaBuffer)
            const pstrlen = iaLen ? iaBuffer[0] : null
            const protocol = iaLen ? iaBuffer.slice(1, 20) : null
            if (pstrlen === 19 && arr2text(protocol!) === 'BitTorrent protocol') {
              this._onHandshakeBuffer(iaBuffer.slice(1))
            } else {
              this._parseHandshake()
            }
          })
        })
      })
    })
  }

  _parsePe4(): void {
    // synchronize on ENCRYPT(VC).
    // since we encrypt using bitwise xor, decryption and encryption are the same operation.
    // calling _decryptHandshake here advances the decrypt generator keystream forward 8 bytes
    const vcBufferEncrypted = this._decryptHandshake(VC)
    this._parseUntil(vcBufferEncrypted, 512)
    this._parse(6, (buffer) => {
      const peerSelectBuffer = this._decryptHandshake(buffer.slice(0, 4))
      const padDLen = new DataView(this._decryptHandshake(buffer.slice(4, 6)).buffer).getUint16(0)
      this._parse(padDLen, (padDBuf) => {
        this._decryptHandshake(padDBuf)
        this._onPe4(peerSelectBuffer)
        this._parseHandshake()
      })
    })
  }

  _parseHandshake(): void {
    this._parse(1, (buffer) => {
      const pstrlen = buffer[0]
      if (pstrlen !== 19) {
        this._debug('Error: wire not speaking BitTorrent protocol (%s)', pstrlen.toString())
        this.end()
        return
      }
      this._parse(pstrlen + 48, this._onHandshakeBuffer)
    })
  }

  _onHandshakeBuffer = (handshake: Uint8Array): void => {
    const protocol = handshake.slice(0, 19)
    if (arr2text(protocol) !== 'BitTorrent protocol') {
      this._debug('Error: wire not speaking BitTorrent protocol (%s)', arr2text(protocol))
      this.end()
      return
    }
    handshake = handshake.slice(19)
    this._onHandshake(handshake.slice(8, 28), handshake.slice(28, 48), {
      dht: !!(handshake[7] & 0x01), // see bep_0005
      fast: !!(handshake[7] & 0x04), // see bep_0006
      extended: !!(handshake[5] & 0x10), // see bep_0010
      v2: !!(handshake[7] & 0x10), // see bep_0052
    })
    this._parse(4, this._onMessageLength)
  }

  _onFinish(): void {
    this._finished = true

    this.push(null) // stream cannot be half open, so signal the end of it
    while (this.read()) {
      // body intentionally empty
      // consume and discard the rest of the stream data
    }

    clearInterval(this._keepAliveInterval!)
    this._parse(Number.MAX_VALUE, () => {})
    while (this.peerRequests.length) {
      this.peerRequests.pop()
    }
    while (this.requests.length) {
      this._callback(this.requests.pop()!, new Error('wire was closed'), null)
    }
  }

  _debug(...args: [string, ...unknown[]]): void {
    args[0] = `[${this._debugId}] ${args[0]}`
    debug(...(args as [string, ...unknown[]]))
  }

  _pull(requests: Request[], piece: number, offset: number, length: number): Request | null {
    for (let i = 0; i < requests.length; i++) {
      const req = requests[i]
      if (req.piece === piece && req.offset === offset && req.length === length) {
        arrayRemove(requests, i)
        return req
      }
    }
    return null
  }

  _encryptHandshake(buf: Uint8Array): Uint8Array {
    const crypt = new Uint8Array(buf)
    if (!this._encryptGenerator) {
      this._debug('Warning: Encrypting without any generator')
      return crypt
    }

    for (let i = 0; i < buf.length; i++) {
      const keystream = this._encryptGenerator.randomByte()
      crypt[i] = crypt[i] ^ keystream
    }

    return crypt
  }

  _encrypt(buf: Uint8Array): Uint8Array {
    const crypt = new Uint8Array(buf)

    if (!this._encryptGenerator || this._encryptionMethod !== 2) {
      return crypt
    }
    for (let i = 0; i < buf.length; i++) {
      const keystream = this._encryptGenerator.randomByte()
      crypt[i] = crypt[i] ^ keystream
    }

    return crypt
  }

  _decryptHandshake(buf: Uint8Array): Uint8Array {
    const decrypt = new Uint8Array(buf)

    if (!this._decryptGenerator) {
      this._debug('Warning: Decrypting without any generator')
      return decrypt
    }
    for (let i = 0; i < buf.length; i++) {
      const keystream = this._decryptGenerator.randomByte()
      decrypt[i] = decrypt[i] ^ keystream
    }

    return decrypt
  }

  _decrypt(buf: Uint8Array): Uint8Array {
    const decrypt = new Uint8Array(buf)

    if (!this._decryptGenerator || this._encryptionMethod !== 2) {
      return decrypt
    }
    for (let i = 0; i < buf.length; i++) {
      const keystream = this._decryptGenerator.randomByte()
      decrypt[i] = decrypt[i] ^ keystream
    }

    return decrypt
  }

  _utfToHex(str: string): string {
    return arr2hex(text2arr(str))
  }
}

export default Wire

export type { DiffieHellman } from './dh-browser.js'
