import ipLib from 'ip'
import { RemoteInfo } from 'dgram'
import * as common from '../common.js'
import { equal } from 'uint8-util'

interface ParsedParams {
  connectionId: Uint8Array
  action: number
  transactionId: number
  type: 'udp'
  info_hash?: string | string[]
  peer_id?: string
  downloaded?: number
  left?: number
  uploaded?: number
  event?: string
  ip?: string
  key?: number
  numwant?: number
  port?: number
  addr?: string
  compact?: number
}

export function parseUdpRequest(msg: Uint8Array | Buffer, rinfo: RemoteInfo): ParsedParams {
  if (msg.length < 16) throw new Error('received packet is too short')

  const bufferMsg = Buffer.isBuffer(msg) ? msg : Buffer.from(msg)
  const params: ParsedParams = {
    connectionId: bufferMsg.slice(0, 8),
    action: bufferMsg.readUInt32BE(8),
    transactionId: bufferMsg.readUInt32BE(12),
    type: 'udp',
  }

  if (!equal(common.CONNECTION_ID, params.connectionId)) {
    throw new Error('received packet with invalid connection id')
  }

  if (params.action === common.ACTIONS.CONNECT) {
    // No further params
  } else if (params.action === common.ACTIONS.ANNOUNCE) {
    params.info_hash = bufferMsg.slice(16, 36).toString('hex')
    params.peer_id = bufferMsg.slice(36, 56).toString('hex')
    params.downloaded = fromUInt64(bufferMsg.slice(56, 64))
    params.left = fromUInt64(bufferMsg.slice(64, 72))
    params.uploaded = fromUInt64(bufferMsg.slice(72, 80))

    params.event = common.EVENT_IDS[bufferMsg.readUInt32BE(80)]
    if (!params.event) throw new Error('invalid event')

    const ip = bufferMsg.readUInt32BE(84)
    params.ip = ip ? ipLib.toString([ip]) : rinfo.address

    params.key = bufferMsg.readUInt32BE(88)

    params.numwant = Math.min(
      bufferMsg.readUInt32BE(92) || common.DEFAULT_ANNOUNCE_PEERS,
      common.MAX_ANNOUNCE_PEERS
    )

    params.port = bufferMsg.readUInt16BE(96) || rinfo.port
    params.addr = `${params.ip}:${params.port}`
    params.compact = 1
  } else if (params.action === common.ACTIONS.SCRAPE) {
    if ((bufferMsg.length - 16) % 20 !== 0) throw new Error('invalid scrape message')
    params.info_hash = []
    for (let i = 0, len = (bufferMsg.length - 16) / 20; i < len; i += 1) {
      const infoHash = bufferMsg.slice(16 + i * 20, 36 + i * 20).toString('hex')
      ;(params.info_hash as string[]).push(infoHash)
    }
  } else {
    throw new Error(`Invalid action in UDP packet: ${params.action}`)
  }

  return params
}

const TWO_PWR_32 = (1 << 16) * 2

function fromUInt64(buf: Uint8Array | Buffer): number {
  const bufferBuf = Buffer.isBuffer(buf) ? buf : Buffer.from(buf)
  const high = bufferBuf.readUInt32BE(0) | 0
  const low = bufferBuf.readUInt32BE(4) | 0
  const lowUnsigned = low >= 0 ? low : TWO_PWR_32 + low

  return high * TWO_PWR_32 + lowUnsigned
}
