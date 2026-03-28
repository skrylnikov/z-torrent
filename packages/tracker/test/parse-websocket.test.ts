import { test, expect, describe } from 'bun:test'
import { parseWebSocketRequest } from '../src/server/parse-websocket.js'
import { hex2bin } from 'uint8-util'

function createMockSocket(): any {
  return {
    upgradeReq: null,
    ip: '127.0.0.1',
    port: 12345,
    addr: '127.0.0.1:12345',
    headers: {},
  }
}

const INFO_HASH_HEX = '4cb67059ed6bd08362da625b3ae77f6f4a075705'
const PEER_ID_HEX = '3031323334353637383930313233343536373839'
const TO_PEER_ID_HEX = '3132333435363738393031323334353637383930'
const OFFER_ID_HEX = '6162636465666768696a6b6c6d6e6f7071727374757677'

function makeCandidateMessage(overrides: Record<string, any> = {}): string {
  return JSON.stringify({
    action: 'announce',
    info_hash: hex2bin(INFO_HASH_HEX),
    peer_id: hex2bin(PEER_ID_HEX),
    to_peer_id: hex2bin(TO_PEER_ID_HEX),
    offer_id: hex2bin(OFFER_ID_HEX),
    candidate: {
      candidate: 'candidate:1 1 udp 2130706431 192.168.1.1 12345 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    },
    ...overrides,
  })
}

describe('parseWebSocketRequest', () => {
  test('parses candidate message and converts to_peer_id to hex', () => {
    const socket = createMockSocket()
    const params = parseWebSocketRequest(socket, {}, makeCandidateMessage())

    expect(params.action).toBe(1)
    expect(params.info_hash).toBe(INFO_HASH_HEX)
    expect(params.peer_id).toBe(PEER_ID_HEX)
    expect(params.to_peer_id).toBe(TO_PEER_ID_HEX)
    expect(params.candidate).toEqual({
      candidate: 'candidate:1 1 udp 2130706431 192.168.1.1 12345 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    })
  })

  test('throws if candidate message has no to_peer_id', () => {
    const socket = createMockSocket()
    const msg = JSON.stringify({
      action: 'announce',
      info_hash: hex2bin(INFO_HASH_HEX),
      peer_id: hex2bin(PEER_ID_HEX),
      candidate: { candidate: 'test' },
    })
    expect(() => parseWebSocketRequest(socket, {}, msg)).toThrow('invalid `to_peer_id`')
  })

  test('throws if candidate message has wrong to_peer_id length', () => {
    const socket = createMockSocket()
    const msg = JSON.stringify({
      action: 'announce',
      info_hash: hex2bin(INFO_HASH_HEX),
      peer_id: hex2bin(PEER_ID_HEX),
      to_peer_id: hex2bin('abcd'),
      candidate: { candidate: 'test' },
    })
    expect(() => parseWebSocketRequest(socket, {}, msg)).toThrow('invalid `to_peer_id`')
  })

  test('still parses answer messages with to_peer_id', () => {
    const socket = createMockSocket()
    const msg = JSON.stringify({
      action: 'announce',
      info_hash: hex2bin(INFO_HASH_HEX),
      peer_id: hex2bin(PEER_ID_HEX),
      to_peer_id: hex2bin(TO_PEER_ID_HEX),
      answer: { type: 'answer', sdp: 'test-sdp' },
    })
    const params = parseWebSocketRequest(socket, {}, msg)

    expect(params.action).toBe(1)
    expect(params.to_peer_id).toBe(TO_PEER_ID_HEX)
    expect(params.answer).toEqual({ type: 'answer', sdp: 'test-sdp' })
    expect(params.candidate).toBeUndefined()
  })

  test('allows announce without to_peer_id when no answer or candidate', () => {
    const socket = createMockSocket()
    const msg = JSON.stringify({
      action: 'announce',
      info_hash: hex2bin(INFO_HASH_HEX),
      peer_id: hex2bin(PEER_ID_HEX),
    })
    const params = parseWebSocketRequest(socket, {}, msg)

    expect(params.to_peer_id).toBeUndefined()
  })
})
