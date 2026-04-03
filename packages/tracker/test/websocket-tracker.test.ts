import { test, expect, describe } from 'bun:test'
import { EventEmitter } from 'eventemitter3'
import { hex2bin, text2arr } from 'uint8-util'
import { WebSocketTracker } from '../src/client/websocket-tracker.js'

// ---------------------------------------------------------------------------
// Minimal mock helpers
// ---------------------------------------------------------------------------

const INFO_HASH_HEX = '4cb67059ed6bd08362da625b3ae77f6f4a075705'
const PEER_ID_HEX = '3031323334353637383930313233343536373839'
const PEER_ID2_HEX = '3132333435363738393031323334353637383930'

/** Creates a minimal TrackerClientContext stub. */
function createMockClient() {
  const emitter = new EventEmitter()
  const client = Object.assign(emitter, {
    infoHash: INFO_HASH_HEX,
    peerId: PEER_ID_HEX,
    infoHashBinary: hex2bin(INFO_HASH_HEX),
    peerIdBinary: hex2bin(PEER_ID_HEX),
    infoHashBuffer: new Uint8Array(20),
    peerIdBuffer: new Uint8Array(20),
    port: 6881,
    userAgent: undefined,
    rtcConfig: undefined,
    wrtc: undefined,
    proxyOpts: undefined,
    getDefaultAnnounceOpts: () => ({ numwant: 0, event: 'started' }),
  })
  return client
}

/** Creates a mock socket that is NOT connected by default. */
function createMockSocket(connected = false) {
  const socket = new EventEmitter() as any
  socket.connected = connected
  socket.send = (_msg: string) => {}
  socket.destroy = () => {}
  socket.consumers = 1
  return socket
}

/**
 * Build a WebSocketTracker with a pre-wired mock socket so no real WS is opened.
 * We intercept `_openSocket` before construction completes by patching the prototype
 * temporarily.
 */
function createTrackerWithMockSocket(connected = false) {
  const client = createMockClient()
  // Use a unique URL per call to avoid socketPool cross-test contamination
  const url = `ws://fake-tracker-${Math.random().toString(36).slice(2)}.test`
  const mockSocket = createMockSocket(connected)

  // Patch _openSocket so no real Socket is created
  const origOpenSocket = WebSocketTracker.prototype._openSocket
  WebSocketTracker.prototype._openSocket = function (this: WebSocketTracker) {
    this.destroyed = false
    if (!this.peers) this.peers = {}
    if (!this._connectedPeers) this._connectedPeers = {}
    this._onSocketConnectBound = () => this._onSocketConnect()
    this._onSocketErrorBound = (err: Error) => this._onSocketError(err)
    this._onSocketDataBound = (data: any) => this._onSocketData(data)
    this._onSocketCloseBound = () => this._onSocketClose()
    // Register in socketPool so destroy() can find it
    WebSocketTracker._socketPool[this.announceUrl] = mockSocket
    this.socket = mockSocket
  }

  let tracker: WebSocketTracker
  try {
    tracker = new WebSocketTracker(client as any, url)
  } finally {
    WebSocketTracker.prototype._openSocket = origOpenSocket
  }

  return { tracker, client }
}

// ---------------------------------------------------------------------------
// SDP mutation tests
// ---------------------------------------------------------------------------

describe('WebSocketTracker SDP mutation — answer response path', () => {
  function simulateAnswerResponse(tracker: WebSocketTracker, answer: any) {
    const offerId =
      '\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14'
    const offerIdHex = '0102030405060708090a0b0c0d0e0f1011121314'

    const fakePeer = new EventEmitter() as any
    fakePeer.id = null
    fakePeer.trackerTimeout = null
    fakePeer.destroyed = false
    fakePeer._signaled = undefined
    fakePeer.destroy = () => {}
    fakePeer.signal = (data: any) => {
      fakePeer._signaled = data
    }
    tracker.peers[offerIdHex] = fakePeer

    const data = {
      action: 'announce',
      info_hash: tracker.client.infoHashBinary,
      peer_id: hex2bin(PEER_ID2_HEX),
      offer_id: offerId,
      answer,
    }

    tracker._onAnnounceResponse(data)

    return fakePeer
  }

  test('mutates SDP when answer has type "offer" — fixes actpass→active and type→answer', () => {
    const { tracker } = createTrackerWithMockSocket(true)

    const badAnswer = {
      type: 'offer',
      sdp: 'v=0\r\na=setup:actpass\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n',
    }

    const fakePeer = simulateAnswerResponse(tracker, badAnswer)

    expect(fakePeer._signaled).toBeDefined()
    expect(fakePeer._signaled.type).toBe('answer')
    expect(fakePeer._signaled.sdp).not.toContain('a=setup:actpass')
    expect(fakePeer._signaled.sdp).toContain('a=setup:active')

    tracker.destroy()
  })

  test('does not mutate SDP when answer has correct type "answer"', () => {
    const { tracker } = createTrackerWithMockSocket(true)

    const goodAnswer = {
      type: 'answer',
      sdp: 'v=0\r\na=setup:active\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n',
    }

    const fakePeer = simulateAnswerResponse(tracker, goodAnswer)

    expect(fakePeer._signaled).toBeDefined()
    expect(fakePeer._signaled.type).toBe('answer')
    expect(fakePeer._signaled.sdp).toContain('a=setup:active')

    tracker.destroy()
  })

  test('mutates only the a=setup:actpass lines, not unrelated SDP lines', () => {
    const { tracker } = createTrackerWithMockSocket(true)

    const multiLineSdp =
      'v=0\r\n' +
      'o=- 123 2 IN IP4 127.0.0.1\r\n' +
      'a=setup:actpass\r\n' +
      'a=group:BUNDLE 0\r\n' +
      'a=setup:actpass\r\n' +
      'm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n'

    const fakePeer = simulateAnswerResponse(tracker, {
      type: 'offer',
      sdp: multiLineSdp,
    })

    const mutatedSdp: string = fakePeer._signaled.sdp
    expect((mutatedSdp.match(/a=setup:active/g) ?? []).length).toBe(2)
    expect(mutatedSdp).not.toContain('a=setup:actpass')
    expect(mutatedSdp).toContain('a=group:BUNDLE 0')

    tracker.destroy()
  })
})

// ---------------------------------------------------------------------------
// _onSocketData parsing tests
// ---------------------------------------------------------------------------

describe('WebSocketTracker _onSocketData', () => {
  test('emits warning on invalid JSON', () => {
    const { tracker, client } = createTrackerWithMockSocket(true)

    const warnings: Error[] = []
    client.on('warning', (err: Error) => warnings.push(err))

    tracker._onSocketData(text2arr('not-valid-json'))

    expect(warnings.length).toBe(1)
    expect(warnings[0].message).toContain('Invalid tracker response')

    tracker.destroy()
  })

  test('emits warning for unknown action in response', () => {
    const { tracker, client } = createTrackerWithMockSocket(true)

    const warnings: Error[] = []
    client.on('warning', (err: Error) => warnings.push(err))

    tracker._startReconnectTimer = () => {}

    tracker._onSocketData(text2arr(JSON.stringify({ action: 'unknown-action' })))

    expect(warnings.length).toBeGreaterThanOrEqual(1)
  })
})
