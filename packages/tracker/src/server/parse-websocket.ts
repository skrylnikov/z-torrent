import { IncomingMessage } from 'http'
import { WebSocket } from 'ws'
import { bin2hex } from 'uint8-util'

import * as common from '../common.js'

interface ParseOptions {
  trustProxy?: boolean
}

interface WebSocketWithExtra extends WebSocket {
  upgradeReq?: IncomingMessage | null
  ip?: string
  port?: number
  addr?: string
  headers?: IncomingMessage['headers']
}

interface ParsedParams {
  type: 'ws'
  socket: WebSocketWithExtra
  action: number
  info_hash?: string | string[]
  peer_id?: string
  to_peer_id?: string
  answer?: RTCSessionDescriptionInit
  offer_id?: string
  offers?: Array<{ offer: RTCSessionDescriptionInit; offer_id: string }>
  left?: number
  numwant?: number
  compact?: number
  ip?: string
  port?: number
  addr?: string
  headers?: IncomingMessage['headers']
}

export function parseWebSocketRequest(
  socket: WebSocketWithExtra,
  opts: ParseOptions | undefined,
  paramsData: string | Buffer
): ParsedParams {
  if (!opts) opts = {}
  const parsed = JSON.parse(paramsData.toString()) as ParsedParams
  const params: ParsedParams = parsed

  params.type = 'ws'
  params.socket = socket
  if (params.action === ('announce' as any)) {
    params.action = common.ACTIONS.ANNOUNCE

    if (typeof params.info_hash !== 'string' || params.info_hash.length !== 20) {
      throw new Error('invalid info_hash')
    }
    params.info_hash = bin2hex(params.info_hash)

    if (typeof params.peer_id !== 'string' || params.peer_id.length !== 20) {
      throw new Error('invalid peer_id')
    }
    params.peer_id = bin2hex(params.peer_id)

    if (params.answer) {
      if (typeof params.to_peer_id !== 'string' || params.to_peer_id.length !== 20) {
        throw new Error('invalid `to_peer_id` (required with `answer`)')
      }
      params.to_peer_id = bin2hex(params.to_peer_id)
    }

    params.left = Number(params.left)
    if (Number.isNaN(params.left!)) params.left = Infinity

    params.numwant = Math.min(
      Number(params.offers && params.offers.length) || 0,
      common.MAX_ANNOUNCE_PEERS
    )
    params.compact = -1
  } else if (params.action === ('scrape' as any)) {
    params.action = common.ACTIONS.SCRAPE

    if (typeof params.info_hash === 'string') params.info_hash = [params.info_hash]
    if (Array.isArray(params.info_hash)) {
      params.info_hash = params.info_hash.map((binaryInfoHash) => {
        if (typeof binaryInfoHash !== 'string' || binaryInfoHash.length !== 20) {
          throw new Error('invalid info_hash')
        }
        return bin2hex(binaryInfoHash)
      })
    }
  } else {
    throw new Error(`invalid action in WS request: ${params.action}`)
  }

  if (socket.upgradeReq) {
    if (opts.trustProxy) {
      if (socket.upgradeReq.headers['x-forwarded-for']) {
        const forwardedFor = socket.upgradeReq.headers['x-forwarded-for']
        const [realIp] = (typeof forwardedFor === 'string' ? forwardedFor : forwardedFor[0]).split(
          ','
        )
        socket.ip = realIp.trim()
      } else {
        socket.ip = (socket.upgradeReq.connection as any).remoteAddress
      }
    } else {
      const remoteAddress = (socket.upgradeReq.connection as any).remoteAddress
      socket.ip = remoteAddress.replace(common.REMOVE_IPV4_MAPPED_IPV6_RE, '')
    }

    socket.port = (socket.upgradeReq.connection as any).remotePort
    if (socket.port) {
      socket.addr = `${
        common.IPV6_RE.test(socket.ip!) ? `[${socket.ip}]` : socket.ip
      }:${socket.port}`
    }

    socket.headers = socket.upgradeReq.headers

    socket.upgradeReq = null
  }

  params.ip = socket.ip
  params.port = socket.port
  params.addr = socket.addr
  params.headers = socket.headers

  return params
}
