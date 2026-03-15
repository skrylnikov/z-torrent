import { IncomingMessage } from 'http'
import { bin2hex } from 'uint8-util'

import common from '../common.js'

interface ParseOptions {
  action?: 'announce' | 'scrape'
  trustProxy?: boolean
}

interface ParsedParams {
  type: 'http'
  action: number
  info_hash?: string | string[]
  peer_id?: string
  port?: number
  left?: number
  compact?: number
  numwant?: number
  ip?: string
  addr?: string
  event?: string
  headers?: IncomingMessage['headers']
}

export default function parseHttpRequest(req: IncomingMessage, opts?: ParseOptions): ParsedParams {
  if (!opts) opts = {}
  const s = req.url!.split('?')
  const queryParams = common.querystringParse(s[1])
  const params = queryParams as unknown as ParsedParams
  params.type = 'http'

  if (opts.action === 'announce' || s[0] === '/announce') {
    params.action = common.ACTIONS.ANNOUNCE

    if (typeof params.info_hash !== 'string' || params.info_hash.length !== 20) {
      throw new Error('invalid info_hash')
    }
    params.info_hash = bin2hex(params.info_hash)

    if (typeof params.peer_id !== 'string' || params.peer_id.length !== 20) {
      throw new Error('invalid peer_id')
    }
    params.peer_id = bin2hex(params.peer_id)

    params.port = Number(params.port)
    if (!params.port || params.port <= 0 || params.port > 65535) throw new Error('invalid port')

    params.left = Number(params.left)
    if (Number.isNaN(params.left)) params.left = Infinity

    params.compact = Number(params.compact) || 0
    params.numwant = Math.min(
      Number(params.numwant) || common.DEFAULT_ANNOUNCE_PEERS,
      common.MAX_ANNOUNCE_PEERS
    )

    if (opts.trustProxy) {
      if (req.headers['x-forwarded-for']) {
        const forwardedFor = req.headers['x-forwarded-for']
        const [realIp] = (typeof forwardedFor === 'string' ? forwardedFor : forwardedFor[0]).split(
          ','
        )
        params.ip = realIp.trim()
      } else {
        params.ip = (req.connection as any).remoteAddress
      }
    } else {
      const remoteAddress = (req.connection as any).remoteAddress
      params.ip = remoteAddress.replace(common.REMOVE_IPV4_MAPPED_IPV6_RE, '')
    }

    params.addr = `${common.IPV6_RE.test(params.ip!) ? `[${params.ip}]` : params.ip}:${params.port}`

    params.headers = req.headers
  } else if (opts.action === 'scrape' || s[0] === '/scrape') {
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
    throw new Error(`invalid action in HTTP request: ${req.url}`)
  }

  return params
}
