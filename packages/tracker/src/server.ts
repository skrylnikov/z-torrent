import bencode from 'bencode'
import Debug from 'debug'
import dgram, { RemoteInfo } from 'dgram'
import { EventEmitter } from 'eventemitter3'

import http, { IncomingMessage, ServerResponse, Server as HttpServer } from 'http'
import peerid from 'bittorrent-peerid'
import series from 'run-series'
import { string2compact } from '@z-torrent/utils'
import { WebSocketServer, WebSocket } from 'ws'
import { hex2bin } from 'uint8-util'

import * as common from './common.js'
import { Swarm } from './server/swarm.js'
import { parseHttpRequest } from './server/parse-http.js'
import { parseUdpRequest } from './server/parse-udp.js'
import { parseWebSocketRequest } from './server/parse-websocket.js'

const debug = Debug('@z-torrent/tracker:server')
const hasOwnProperty = Object.prototype.hasOwnProperty

interface WebSocketWithExtra extends WebSocket {
  upgradeReq?: IncomingMessage | null
  peerId?: string | null
  infoHashes?: string[]
  onSend?: (err: Error | null) => void
  onMessageBound?: (params: unknown) => void
  onErrorBound?: (err: Error) => void
  onCloseBound?: () => void
  destroyed?: boolean
  ip?: string
  port?: number
  addr?: string
  headers?: IncomingMessage['headers']
}

interface ServerOptions {
  interval?: number
  trustProxy?: boolean
  http?: boolean | Record<string, unknown>
  udp?: boolean | Record<string, unknown>
  ws?: boolean | Record<string, unknown>
  stats?: boolean
  filter?: (infoHash: string, params: any, cb: (err?: Error) => void) => void
  peersCacheLength?: number
  peersCacheTtl?: number
}

interface RequestParams {
  action?: number
  info_hash?: string | string[]
  peer_id?: string
  port?: number
  left?: number
  uploaded?: number
  downloaded?: number
  event?: string
  numwant?: number
  compact?: number
  addr?: string
  ip?: string
  type?: 'http' | 'udp' | 'ws'
  transactionId?: Uint8Array
  connectionId?: Uint8Array
  socket?: WebSocketWithExtra
  httpReq?: IncomingMessage
  httpRes?: ServerResponse
  offers?: Array<{ offer: RTCSessionDescriptionInit; offer_id: string }>
  answer?: RTCSessionDescriptionInit
  offer_id?: string
  to_peer_id?: string
}

interface PeerData {
  type: 'udp' | 'http' | 'ws'
  complete: boolean
  peerId: string
  ip?: string
  port?: number
  socket?: WebSocketWithExtra
}

interface AnnounceResponse {
  action?: number
  interval?: number
  complete?: number
  incomplete?: number
  peers?: PeerData[] | Uint8Array | any[]
  peers6?: Uint8Array
}

interface ScrapeResponse {
  action: number
  files: Record<string, { complete: number; incomplete: number; downloaded: number }>
  flags: { min_request_interval: number }
}

export class Server extends EventEmitter {
  intervalMs: number
  _trustProxy: boolean
  _filter?: (infoHash: string, params: RequestParams, cb: (err?: Error) => void) => void
  peersCacheLength?: number
  peersCacheTtl?: number
  _listenCalled: boolean
  listening: boolean
  destroyed: boolean
  torrents: Record<string, Swarm>
  http: HttpServer | null
  udp4: dgram.Socket | null
  udp6: dgram.Socket | null
  udp: dgram.Socket | null
  ws: WebSocketServer | null

  static Swarm = Swarm

  constructor(opts: ServerOptions = {}) {
    super()
    debug('new server %s', JSON.stringify(opts))

    this.intervalMs = opts.interval ? opts.interval : 10 * 60 * 1000 // 10 min

    this._trustProxy = !!opts.trustProxy
    if (typeof opts.filter === 'function') this._filter = opts.filter

    this.peersCacheLength = opts.peersCacheLength
    this.peersCacheTtl = opts.peersCacheTtl

    this._listenCalled = false
    this.listening = false
    this.destroyed = false
    this.torrents = {}

    this.http = null
    this.udp4 = null
    this.udp6 = null
    this.udp = null
    this.ws = null

    let num = 0
    const self = this
    function onListening() {
      num -= 1
      if (num === 0) {
        self.listening = true
        debug('listening')
        self.emit('listening')
      }
    }

    if (opts.http !== false) {
      num++
      this.http = http.createServer(isObject(opts.http) ? (opts.http as any) : undefined)
      this.http.on('error', (err) => {
        this._onError(err)
      })
      this.http.on('listening', onListening)

      queueMicrotask(() => {
        this.http!.on('request', (req, res) => {
          if (res.headersSent) return
          this.onHttpRequest(req, res)
        })
      })
    }

    if (opts.udp !== false) {
      num += 2
      this.udp4 = this.udp = dgram.createSocket({
        type: 'udp4',
        reuseAddr: true,
        ...(isObject(opts.udp) ? opts.udp : {}),
      })
      this.udp4.on('message', (msg, rinfo) => {
        this.onUdpRequest(msg, rinfo)
      })
      this.udp4.on('error', (err) => {
        this._onError(err)
      })
      this.udp4.on('listening', onListening)

      this.udp6 = dgram.createSocket({
        type: 'udp6',
        reuseAddr: true,
        ...(isObject(opts.udp) ? opts.udp : {}),
      })
      this.udp6.on('message', (msg, rinfo) => {
        this.onUdpRequest(msg, rinfo)
      })
      this.udp6.on('error', (err) => {
        this._onError(err)
      })
      this.udp6.on('listening', onListening)
    }

    if (opts.ws !== false) {
      const noServer = isObject(opts.ws) && (opts.ws as any).noServer
      if (!this.http && !noServer) {
        num++
        this.http = http.createServer()
        this.http.on('error', (err) => {
          this._onError(err)
        })
        this.http.on('listening', onListening)

        queueMicrotask(() => {
          this.http!.on('request', (_req, res) => {
            if (res.headersSent) return
            res.statusCode = 404
            res.end('404 Not Found')
          })
        })
      }
      this.ws = new WebSocketServer({
        server: noServer ? undefined : this.http!,
        perMessageDeflate: false,
        clientTracking: false,
        ...(isObject(opts.ws) ? opts.ws : {}),
      })
      ;(this.ws as any).address = () => {
        if (noServer) {
          throw new Error('address() unavailable with { noServer: true }')
        }
        return this.http!.address()
      }

      this.ws.on('error', (err) => {
        this._onError(err)
      })
      this.ws.on('connection', (socket: WebSocketWithExtra, req) => {
        socket.upgradeReq = req
        this.onWebSocketConnection(socket)
      })
    }

    if (opts.stats !== false) {
      if (!this.http) {
        num++
        this.http = http.createServer()
        this.http.on('error', (err) => {
          this._onError(err)
        })
        this.http.on('listening', onListening)
      }

      this.http.on('request', (req, res) => {
        if (res.headersSent) return
        this._handleStats(req, res)
      })
    }
  }

  _onError(err: Error): void {
    this.emit('error', err)
  }

  _handleStats(req: IncomingMessage, res: ServerResponse): void {
    const infoHashes = Object.keys(this.torrents)
    let activeTorrents = 0
    const allPeers: Record<string, any> = {}

    function countPeers(filterFunction: (peer: any) => boolean): number {
      let count = 0
      let key

      for (key in allPeers) {
        if (hasOwnProperty.call(allPeers, key) && filterFunction(allPeers[key])) {
          count++
        }
      }

      return count
    }

    function groupByClient(): Record<string, Record<string, number>> {
      const clients: Record<string, Record<string, number>> = {}
      for (const key in allPeers) {
        if (hasOwnProperty.call(allPeers, key)) {
          const peer = allPeers[key]

          if (!clients[peer.client.client]) {
            clients[peer.client.client] = {}
          }
          const client = clients[peer.client.client]
          const version =
            peer.client.version || Buffer.from(peer.peerId, 'hex').toString().substring(0, 8)
          if (!client[version]) {
            client[version] = 0
          }
          client[version]++
        }
      }
      return clients
    }

    function printClients(clients: Record<string, Record<string, number>>): string {
      let html = '<ul>\n'
      for (const name in clients) {
        if (hasOwnProperty.call(clients, name)) {
          const client = clients[name]
          for (const version in client) {
            if (hasOwnProperty.call(client, version)) {
              html += `<li><strong>${name}</strong> ${version} : ${client[version]}</li>\n`
            }
          }
        }
      }
      html += '</ul>'
      return html
    }

    if (req.method === 'GET' && (req.url === '/stats' || req.url === '/stats.json')) {
      infoHashes.forEach((infoHash) => {
        const peers = this.torrents[infoHash].peers
        const keys = peers.keys
        if (keys.length > 0) activeTorrents++

        keys.forEach((peerId) => {
          const peer = peers.peek(peerId)
          if (peer == null) return

          if (!hasOwnProperty.call(allPeers, peerId)) {
            allPeers[peerId] = {
              ipv4: false,
              ipv6: false,
              seeder: false,
              leecher: false,
            }
          }

          if (peer.ip?.includes(':')) {
            allPeers[peerId].ipv6 = true
          } else {
            allPeers[peerId].ipv4 = true
          }

          if (peer.complete) {
            allPeers[peerId].seeder = true
          } else {
            allPeers[peerId].leecher = true
          }

          allPeers[peerId].peerId = peer.peerId
          allPeers[peerId].client = peerid(peer.peerId)
        })
      })

      const isSeederOnly = (peer: any) => peer.seeder && peer.leecher === false
      const isLeecherOnly = (peer: any) => peer.leecher && peer.seeder === false
      const isSeederAndLeecher = (peer: any) => peer.seeder && peer.leecher
      const isIPv4 = (peer: any) => peer.ipv4
      const isIPv6 = (peer: any) => peer.ipv6

      const stats = {
        torrents: infoHashes.length,
        activeTorrents,
        peersAll: Object.keys(allPeers).length,
        peersSeederOnly: countPeers(isSeederOnly),
        peersLeecherOnly: countPeers(isLeecherOnly),
        peersSeederAndLeecher: countPeers(isSeederAndLeecher),
        peersIPv4: countPeers(isIPv4),
        peersIPv6: countPeers(isIPv6),
        clients: groupByClient(),
      }

      if (req.url === '/stats.json' || req.headers.accept === 'application/json') {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(stats))
      } else if (req.url === '/stats') {
        res.setHeader('Content-Type', 'text/html')
        res.end(
          `
          <h1>${stats.torrents} torrents (${stats.activeTorrents} active)</h1>
          <h2>Connected Peers: ${stats.peersAll}</h2>
          <h3>Peers Seeding Only: ${stats.peersSeederOnly}</h3>
          <h3>Peers Leeching Only: ${stats.peersLeecherOnly}</h3>
          <h3>Peers Seeding & Leeching: ${stats.peersSeederAndLeecher}</h3>
          <h3>IPv4 Peers: ${stats.peersIPv4}</h3>
          <h3>IPv6 Peers: ${stats.peersIPv6}</h3>
          <h3>Clients:</h3>
          ${printClients(stats.clients)}
        `.replace(/^\s+/gm, '')
        )
      }
    }
  }

  listen(...args: any[]): void {
    if (this._listenCalled || this.listening) throw new Error('server already listening')
    this._listenCalled = true

    const lastArg = args[args.length - 1]
    if (typeof lastArg === 'function') this.once('listening', lastArg)

    const port = toNumber(args[0]) || args[0] || 0
    const hostname = typeof args[1] !== 'function' ? args[1] : undefined

    debug('listen (port: %o hostname: %o)', port, hostname)

    const httpPort = isObject(port) ? (port as any).http || 0 : port
    const udpPort = isObject(port) ? (port as any).udp || 0 : port

    const httpHostname = isObject(hostname) ? (hostname as any).http : hostname
    const udp4Hostname = isObject(hostname) ? (hostname as any).udp : hostname
    const udp6Hostname = isObject(hostname) ? (hostname as any).udp6 : hostname

    if (this.http) this.http.listen(httpPort, httpHostname)
    if (this.udp4) this.udp4.bind(udpPort, udp4Hostname)
    if (this.udp6) this.udp6.bind(udpPort, udp6Hostname)
  }

  close(cb: () => void = noop): void {
    debug('close')

    this.listening = false
    this.destroyed = true

    if (this.udp4) {
      try {
        this.udp4.close()
      } catch (err) {}
    }

    if (this.udp6) {
      try {
        this.udp6.close()
      } catch (err) {}
    }

    if (this.ws) {
      try {
        this.ws.close()
      } catch (err) {}
    }

    if (this.http) this.http.close(cb)
    else cb()
  }

  createSwarm(infoHash: string | Uint8Array, cb: (err: Error | null, swarm: Swarm) => void): void {
    if (ArrayBuffer.isView(infoHash)) infoHash = (infoHash as Buffer).toString('hex')

    queueMicrotask(() => {
      const swarm = (this.torrents[infoHash as string] = new Server.Swarm(infoHash as string, this))
      cb(null, swarm)
    })
  }

  getSwarm(
    infoHash: string | Uint8Array,
    cb: (err: Error | null, swarm: Swarm | undefined) => void
  ): void {
    if (ArrayBuffer.isView(infoHash)) infoHash = (infoHash as Buffer).toString('hex')

    queueMicrotask(() => {
      cb(null, this.torrents[infoHash as string])
    })
  }

  onHttpRequest(
    req: IncomingMessage,
    res: ServerResponse,
    opts: { trustProxy?: boolean } = {}
  ): void {
    opts.trustProxy = opts.trustProxy || this._trustProxy

    let params: RequestParams
    try {
      params = parseHttpRequest(req, opts) as RequestParams
      params.httpReq = req
      params.httpRes = res
    } catch (err: any) {
      res.end(
        bencode.encode({
          'failure reason': err.message,
        })
      )

      this.emit('warning', err)
      return
    }

    this._onRequest(params, (err, response) => {
      if (err) {
        this.emit('warning', err)
        response = {
          'failure reason': err.message,
        } as any
      }
      if (this.destroyed) return res.end()

      delete (response as any).action
      res.end(bencode.encode(response))

      if (params!.action === common.ACTIONS.ANNOUNCE) {
        this.emit(common.EVENT_NAMES[params!.event!] as any, params!.addr, params)
      }
    })
  }

  onUdpRequest(msg: Buffer, rinfo: RemoteInfo): void {
    let params: RequestParams
    try {
      params = parseUdpRequest(msg, rinfo) as unknown as RequestParams
    } catch (err: any) {
      this.emit('warning', err)
      return
    }

    this._onRequest(params, (err, response) => {
      if (err) {
        this.emit('warning', err)
        response = {
          action: common.ACTIONS.ERROR,
          'failure reason': err.message,
        } as any
      }
      if (this.destroyed) return

      response.transactionId = params!.transactionId
      response.connectionId = params!.connectionId

      const buf = makeUdpPacket(response)

      try {
        const udp = rinfo.family === 'IPv4' ? this.udp4 : this.udp6
        udp!.send(buf, 0, buf.length, rinfo.port, rinfo.address)
      } catch (err: any) {
        this.emit('warning', err)
      }

      if (params!.action === common.ACTIONS.ANNOUNCE) {
        this.emit(common.EVENT_NAMES[params!.event!] as any, params!.addr, params)
      }
    })
  }

  onWebSocketConnection(socket: WebSocketWithExtra, opts: { trustProxy?: boolean } = {}): void {
    opts.trustProxy = opts.trustProxy || this._trustProxy

    socket.peerId = null
    socket.infoHashes = []
    socket.onSend = (err) => {
      this._onWebSocketSend(socket, err!)
    }

    socket.onMessageBound = (params) => {
      this._onWebSocketRequest(socket, opts, params)
    }
    socket.on('message', socket.onMessageBound as any)

    socket.onErrorBound = (err) => {
      this._onWebSocketError(socket, err)
    }
    socket.on('error', socket.onErrorBound)

    socket.onCloseBound = () => {
      this._onWebSocketClose(socket)
    }
    socket.on('close', socket.onCloseBound)
  }

  _onWebSocketRequest(
    socket: WebSocketWithExtra,
    opts: { trustProxy?: boolean },
    paramsData: unknown
  ): void {
    let params: RequestParams
    try {
      params = parseWebSocketRequest(socket, opts, paramsData as string) as RequestParams
    } catch (err: any) {
      socket.send(
        JSON.stringify({
          'failure reason': err.message,
        }),
        socket.onSend as any
      )

      this.emit('warning', err)
      return
    }

    if (!socket.peerId) socket.peerId = params.peer_id

    this._onRequest(params, (err, response) => {
      if (this.destroyed || socket.destroyed) return
      if (err) {
        socket.send(
          JSON.stringify({
            action: params!.action === common.ACTIONS.ANNOUNCE ? 'announce' : 'scrape',
            'failure reason': err.message,
            info_hash: hex2bin(params!.info_hash as string),
          }),
          socket.onSend as any
        )

        this.emit('warning', err)
        return
      }

      response.action = params!.action === common.ACTIONS.ANNOUNCE ? 'announce' : 'scrape'

      let peers
      if (response.action === 'announce') {
        peers = response.peers
        delete response.peers

        if (!socket.infoHashes!.includes(params!.info_hash as string)) {
          socket.infoHashes!.push(params!.info_hash as string)
        }

        response.info_hash = hex2bin(params!.info_hash as string)

        response.interval = Math.ceil(this.intervalMs / 1000 / 5)
      }

      if (!(params as any).answer && !(params as any).candidate) {
        socket.send(JSON.stringify(response), socket.onSend as any)
        debug('sent response %s to %s', JSON.stringify(response), params!.peer_id)
      }

      if (Array.isArray((params as any).offers)) {
        debug('got %s offers from %s', (params as any).offers.length, params!.peer_id)
        debug('got %s peers from swarm %s', peers.length, params!.info_hash)
        peers.forEach((peer: any, i: number) => {
          peer.socket.send(
            JSON.stringify({
              action: 'announce',
              offer: (params as any).offers[i].offer,
              offer_id: (params as any).offers[i].offer_id,
              peer_id: hex2bin(params!.peer_id!),
              info_hash: hex2bin(params!.info_hash as string),
            }),
            peer.socket.onSend
          )
          debug('sent offer to %s from %s', peer.peerId, params!.peer_id)
        })
      }

      const done = () => {
        if (params!.action === common.ACTIONS.ANNOUNCE) {
          this.emit(common.EVENT_NAMES[params!.event!] as any, params!.peer_id, params)
        }
      }

      if ((params as any).answer) {
        debug('got answer %s from %s', JSON.stringify((params as any).answer), params!.peer_id)

        this.getSwarm(params!.info_hash as string, (err, swarm) => {
          if (this.destroyed) return
          if (err) return this.emit('warning', err)
          if (!swarm) {
            return this.emit('warning', new Error('no swarm with that `info_hash`'))
          }
          const toPeer = swarm!.peers.get((params as any).to_peer_id)
          if (!toPeer) {
            debug(
              'dropping answer: no peer for to_peer_id=%s (evicted or race)',
              (params as any).to_peer_id
            )
            return
          }
          if (!toPeer.socket) return

          toPeer.socket.send(
            JSON.stringify({
              action: 'announce',
              answer: (params as any).answer,
              offer_id: (params as any).offer_id,
              peer_id: hex2bin(params!.peer_id!),
              info_hash: hex2bin(params!.info_hash as string),
            }),
            (toPeer.socket as WebSocketWithExtra).onSend as any
          )
          debug('sent answer to %s from %s', toPeer.peerId, params!.peer_id)

          done()
        })
      } else if ((params as any).candidate) {
        debug(
          'got ICE candidate from %s for offer_id=%s',
          params!.peer_id,
          (params as any).offer_id
        )

        this.getSwarm(params!.info_hash as string, (err, swarm) => {
          if (this.destroyed) return
          if (err) return this.emit('warning', err)
          if (!swarm) {
            return this.emit('warning', new Error('no swarm with that `info_hash`'))
          }
          const toPeer = swarm!.peers.get((params as any).to_peer_id)
          if (!toPeer) {
            debug(
              'dropping candidate: no peer for to_peer_id=%s (evicted or race)',
              (params as any).to_peer_id
            )
            return
          }
          if (!toPeer.socket) return

          toPeer.socket.send(
            JSON.stringify({
              action: 'announce',
              candidate: (params as any).candidate,
              offer_id: (params as any).offer_id,
              peer_id: hex2bin(params!.peer_id!),
              info_hash: hex2bin(params!.info_hash as string),
            }),
            (toPeer.socket as WebSocketWithExtra).onSend as any
          )
          debug('sent candidate to %s from %s', toPeer.peerId, params!.peer_id)

          done()
        })
      } else {
        done()
      }
    })
  }

  _onWebSocketSend(socket: WebSocketWithExtra, err: Error): void {
    if (err) this._onWebSocketError(socket, err)
  }

  _onWebSocketClose(socket: WebSocketWithExtra): void {
    debug('websocket close %s', socket.peerId)
    socket.destroyed = true

    if (socket.peerId) {
      socket.infoHashes!.slice(0).forEach((infoHash) => {
        const swarm = this.torrents[infoHash]
        if (swarm) {
          swarm.announce(
            {
              type: 'ws',
              event: 'stopped',
              numwant: 0,
              peer_id: socket.peerId,
            } as any,
            () => {}
          )
        }
      })
    }

    socket.onSend = noop as any
    socket.on('error', noop as any)

    socket.peerId = null
    socket.infoHashes = undefined

    if (typeof socket.onMessageBound === 'function') {
      socket.removeListener('message', socket.onMessageBound as any)
    }
    socket.onMessageBound = undefined

    if (typeof socket.onErrorBound === 'function') {
      socket.removeListener('error', socket.onErrorBound)
    }
    socket.onErrorBound = undefined

    if (typeof socket.onCloseBound === 'function') {
      socket.removeListener('close', socket.onCloseBound)
    }
    socket.onCloseBound = undefined
  }

  _onWebSocketError(socket: WebSocketWithExtra, err: Error): void {
    debug('websocket error %s', err.message || err)
    this.emit('warning', err)
    this._onWebSocketClose(socket)
  }

  _onRequest(params: RequestParams, cb: (err: Error | null, response?: any) => void): void {
    if (params && params.action === common.ACTIONS.CONNECT) {
      cb(null, { action: common.ACTIONS.CONNECT })
    } else if (params && params.action === common.ACTIONS.ANNOUNCE) {
      this._onAnnounce(params, cb)
    } else if (params && params.action === common.ACTIONS.SCRAPE) {
      this._onScrape(params, cb)
    } else {
      cb(new Error('Invalid action'))
    }
  }

  _onAnnounce(
    params: RequestParams,
    cb: (err: Error | null, response?: AnnounceResponse) => void
  ): void {
    const self = this

    if (this._filter) {
      this._filter(params.info_hash as string, params, (err) => {
        if (err) return cb(err)

        getOrCreateSwarm((err, swarm) => {
          if (err) return cb(err)
          announce(swarm!)
        })
      })
    } else {
      getOrCreateSwarm((err, swarm) => {
        if (err) return cb(err)
        announce(swarm!)
      })
    }

    function getOrCreateSwarm(cb: (err: Error | null, swarm?: Swarm) => void) {
      self.getSwarm(params!.info_hash as string, (err, swarm) => {
        if (err) return cb(err)
        if (swarm) return cb(null, swarm)
        self.createSwarm(params!.info_hash as string, (err, swarm) => {
          if (err) return cb(err)
          cb(null, swarm)
        })
      })
    }

    function announce(swarm: Swarm) {
      if (!params!.event || params!.event === 'empty') params!.event = 'update'
      swarm.announce(params as any, (err, response) => {
        if (err) return cb(err)
        if (!response) return cb(new Error('no response'))

        const resp = response as any
        if (!resp.action) resp.action = common.ACTIONS.ANNOUNCE
        if (!resp.interval) resp.interval = Math.ceil(self.intervalMs / 1000)

        if (params!.compact === 1) {
          const peers = resp.peers as PeerData[]

          resp.peers = string2compact(
            peers
              .filter((peer: any) => common.IPV4_RE.test(peer.ip))
              .map((peer: any) => `${peer.ip}:${peer.port}`)
          )
          resp.peers6 = string2compact(
            peers
              .filter((peer: any) => common.IPV6_RE.test(peer.ip))
              .map((peer: any) => `[${peer.ip}]:${peer.port}`)
          )
        } else if (params!.compact === 0) {
          resp.peers = (resp.peers as PeerData[]).map((peer: any) => ({
            'peer id': hex2bin(peer.peerId),
            ip: peer.ip,
            port: peer.port,
          }))
        }

        cb(null, resp)
      })
    }
  }

  _onScrape(
    params: RequestParams,
    cb: (err: Error | null, response?: ScrapeResponse) => void
  ): void {
    if (params.info_hash == null) {
      params.info_hash = Object.keys(this.torrents)
    }

    series(
      (params.info_hash as string[]).map(
        (infoHash) => (cb: (err: Error | null, result?: any) => void) => {
          this.getSwarm(infoHash, (err, swarm) => {
            if (err) return cb(err)
            if (swarm) {
              swarm.scrape(params as any, (err, scrapeInfo) => {
                if (err) return cb(err)
                cb(null, {
                  infoHash,
                  complete: (scrapeInfo && scrapeInfo.complete) || 0,
                  incomplete: (scrapeInfo && scrapeInfo.incomplete) || 0,
                })
              })
            } else {
              cb(null, { infoHash, complete: 0, incomplete: 0 })
            }
          })
        }
      ),
      (err, results) => {
        if (err) return cb(err)

        const response: ScrapeResponse = {
          action: common.ACTIONS.SCRAPE,
          files: {},
          flags: { min_request_interval: Math.ceil(this.intervalMs / 1000) },
        }

        ;(results as any[]).forEach((result) => {
          response.files[hex2bin(result.infoHash)] = {
            complete: result.complete || 0,
            incomplete: result.incomplete || 0,
            downloaded: result.complete || 0,
          }
        })

        cb(null, response)
      }
    )
  }
}

function makeUdpPacket(params: any): Buffer {
  let packet
  switch (params.action) {
    case common.ACTIONS.CONNECT: {
      packet = Buffer.concat([
        common.toUInt32(common.ACTIONS.CONNECT),
        common.toUInt32(params.transactionId),
        params.connectionId,
      ])
      break
    }
    case common.ACTIONS.ANNOUNCE: {
      packet = Buffer.concat([
        common.toUInt32(common.ACTIONS.ANNOUNCE),
        common.toUInt32(params.transactionId),
        common.toUInt32(params.interval),
        common.toUInt32(params.incomplete),
        common.toUInt32(params.complete),
        params.peers,
      ])
      break
    }
    case common.ACTIONS.SCRAPE: {
      const scrapeResponse = [
        common.toUInt32(common.ACTIONS.SCRAPE),
        common.toUInt32(params.transactionId),
      ]
      for (const infoHash in params.files) {
        const file = params.files[infoHash]
        scrapeResponse.push(
          common.toUInt32(file.complete),
          common.toUInt32(file.downloaded),
          common.toUInt32(file.incomplete)
        )
      }
      packet = Buffer.concat(scrapeResponse)
      break
    }
    case common.ACTIONS.ERROR: {
      packet = Buffer.concat([
        common.toUInt32(common.ACTIONS.ERROR),
        common.toUInt32(params.transactionId || 0),
        Buffer.from(String(params['failure reason'])),
      ])
      break
    }
    default:
      throw new Error(`Action not implemented: ${params.action}`)
  }
  return packet
}

function isObject(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null
}

function toNumber(x: any): number | false {
  x = Number(x)
  return x >= 0 ? x : false
}

function noop() {}
