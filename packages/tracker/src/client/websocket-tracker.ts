import Debug from 'debug'
import Peer from '@thaunknown/simple-peer/lite.js'
import Socket from '@thaunknown/simple-websocket'
import { arr2text, arr2hex, hex2bin, bin2hex, randomBytes } from 'uint8-util'

import * as common from '../common.js'
import type { TrackerClientContext } from '../client-context.js'
import { Tracker } from './tracker.js'

const debug = Debug('@z-torrent/tracker:websocket-tracker')
const socketPool: Record<string, any> = {}
const RECONNECT_MINIMUM = 10 * 1000
const RECONNECT_MAXIMUM = 60 * 60 * 1000
const RECONNECT_VARIANCE = 5 * 60 * 1000
const OFFER_TIMEOUT = 50 * 1000

export class WebSocketTracker extends Tracker {
  peers: Record<string, any>
  socket: any
  reconnecting: boolean
  retries: number
  reconnectTimer: NodeJS.Timeout | null
  expectingResponse: boolean
  _trackerId?: string
  _onSocketConnectBound!: () => void
  _onSocketErrorBound!: (err: Error) => void
  _onSocketDataBound!: (data: any) => void
  _onSocketCloseBound!: () => void
  DEFAULT_ANNOUNCE_INTERVAL = 30 * 1000
  static _socketPool = socketPool

  constructor(client: TrackerClientContext, announceUrl: string) {
    super(client, announceUrl)
    debug('new websocket tracker %s', announceUrl)

    this.peers = {}
    this.socket = null
    this.reconnecting = false
    this.retries = 0
    this.reconnectTimer = null
    this.expectingResponse = false
    this._openSocket()
  }

  announce(opts: any): void {
    if (this.destroyed || this.reconnecting) return
    if (!this.socket.connected) {
      this.socket.once('connect', () => this.announce(opts))
      return
    }
    const params = Object.assign({}, opts, {
      action: 'announce',
      info_hash: this.client.infoHashBinary,
      peer_id: this.client.peerIdBinary,
    })
    if (this._trackerId) params.trackerid = this._trackerId
    if (opts.event === 'stopped' || opts.event === 'completed') {
      this._send(params)
    } else {
      const numwant = Math.min(opts.numwant, 5)
      this._generateOffers(numwant, (offers) => {
        params.numwant = numwant
        params.offers = offers
        this._send(params)
      })
    }
  }

  scrape(opts: any): void {
    if (this.destroyed || this.reconnecting) return
    if (!this.socket.connected) {
      this.socket.once('connect', () => this.scrape(opts))
      return
    }
    const infoHashes =
      Array.isArray(opts.infoHash) && opts.infoHash.length > 0
        ? opts.infoHash.map((infoHash: string) => hex2bin(infoHash))
        : (opts.infoHash && hex2bin(opts.infoHash)) || this.client.infoHashBinary
    const params = {
      action: 'scrape',
      info_hash: infoHashes,
    }
    this._send(params)
  }

  destroy(cb?: () => void): void {
    if (this.destroyed) return cb?.()
    this.destroyed = true
    clearInterval(this.interval!)
    clearTimeout(this.reconnectTimer!)
    for (const peerId in this.peers) {
      const peer = this.peers[peerId]
      clearTimeout(peer.trackerTimeout)
      peer.destroy()
    }
    this.peers = null!
    if (this.socket) {
      this.socket.removeListener('connect', this._onSocketConnectBound)
      this.socket.removeListener('data', this._onSocketDataBound)
      this.socket.removeListener('close', this._onSocketCloseBound)
      this.socket.removeListener('error', this._onSocketErrorBound)
      this.socket = null
    }
    this._onSocketConnectBound = null!
    this._onSocketErrorBound = null!
    this._onSocketDataBound = null!
    this._onSocketCloseBound = null!
    if (socketPool[this.announceUrl]) {
      socketPool[this.announceUrl].consumers -= 1
    }
    if (socketPool[this.announceUrl]?.consumers > 0) return cb?.()
    const socket = socketPool[this.announceUrl]
    delete socketPool[this.announceUrl]
    socket.on('error', noop)
    socket.once('close', cb || noop)
    let timeout: NodeJS.Timeout | null
    if (!this.expectingResponse) return destroyCleanup()
    timeout = setTimeout(destroyCleanup, common.DESTROY_TIMEOUT)
    socket.once('data', destroyCleanup)
    function destroyCleanup() {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      socket.removeListener('data', destroyCleanup)
      socket.destroy()
    }
  }

  _openSocket(): void {
    this.destroyed = false
    if (!this.peers) this.peers = {}
    this._onSocketConnectBound = () => this._onSocketConnect()
    this._onSocketErrorBound = (err: Error) => this._onSocketError(err)
    this._onSocketDataBound = (data: any) => this._onSocketData(data)
    this._onSocketCloseBound = () => this._onSocketClose()
    this.socket = socketPool[this.announceUrl]
    if (this.socket) {
      socketPool[this.announceUrl].consumers += 1
      if (this.socket.connected) this._onSocketConnectBound()
    } else {
      const parsedUrl = new URL(this.announceUrl)
      let agent
      if (this.client.proxyOpts) {
        agent =
          parsedUrl.protocol === 'wss:'
            ? this.client.proxyOpts.httpsAgent
            : this.client.proxyOpts.httpAgent
        if (!agent && this.client.proxyOpts.socksProxy) agent = this.client.proxyOpts.socksProxy
      }
      this.socket = socketPool[this.announceUrl] = new Socket({
        url: this.announceUrl,
        agent,
      })
      this.socket.consumers = 1
      this.socket.once('connect', this._onSocketConnectBound)
    }
    this.socket.on('data', this._onSocketDataBound)
    this.socket.once('close', this._onSocketCloseBound)
    this.socket.once('error', this._onSocketErrorBound)
  }

  _onSocketConnect(): void {
    if (this.destroyed) return
    if (this.reconnecting) {
      this.reconnecting = false
      this.retries = 0
      this.announce(this.client.getDefaultAnnounceOpts())
    }
  }

  _onSocketData(data: any): void {
    if (this.destroyed) return
    this.expectingResponse = false
    let parsed: any
    try {
      parsed = JSON.parse(arr2text(data))
    } catch (err) {
      this.client.emit('warning', new Error('Invalid tracker response'))
      return
    }
    if (parsed.action === 'announce') {
      this._onAnnounceResponse(parsed)
    } else if (parsed.action === 'scrape') {
      this._onScrapeResponse(parsed)
    } else {
      this._onSocketError(new Error(`invalid action in WS response: ${parsed.action}`))
    }
  }

  _onAnnounceResponse(data: any): void {
    if (data.info_hash !== this.client.infoHashBinary) {
      debug(
        'ignoring websocket data from %s for %s (looking for %s: reused socket)',
        this.announceUrl,
        bin2hex(data.info_hash),
        this.client.infoHash
      )
      return
    }
    if (data.peer_id && data.peer_id === this.client.peerIdBinary) return
    debug(
      'received %s from %s for %s',
      JSON.stringify(data),
      this.announceUrl,
      this.client.infoHash
    )
    const failure = data['failure reason']
    if (failure) {
      this.client.emit('warning', new Error(failure))
      return
    }
    const warning = data['warning message']
    if (warning) this.client.emit('warning', new Error(warning))
    const interval = data.interval || data['min interval']
    if (interval) this.setInterval(interval * 1000)
    const trackerId = data['tracker id']
    if (trackerId) this._trackerId = trackerId
    if (data.complete != null) {
      const response = Object.assign({}, data, {
        announce: this.announceUrl,
        infoHash: bin2hex(data.info_hash),
      })
      this.client.emit('update', response)
    }
    let peer: any
    if (data.offer && data.peer_id) {
      debug('creating peer (from remote offer)')
      peer = this._createPeer()
      peer.id = bin2hex(data.peer_id)
      peer.once('signal', (answer: any) => {
        const params = {
          action: 'announce',
          info_hash: this.client.infoHashBinary,
          peer_id: this.client.peerIdBinary,
          to_peer_id: data.peer_id,
          answer,
          offer_id: data.offer_id,
        }
        if (this._trackerId) (params as any).trackerid = this._trackerId
        this._send(params)
      })
      this.client.emit('peer', peer)
      peer.signal(data.offer)
    }
    if (data.answer && data.peer_id) {
      const offerId = bin2hex(data.offer_id)
      peer = this.peers[offerId]
      if (peer) {
        peer.id = bin2hex(data.peer_id)
        this.client.emit('peer', peer)
        peer.signal(data.answer)
        clearTimeout(peer.trackerTimeout)
        peer.trackerTimeout = null
        delete this.peers[offerId]
      } else {
        debug(`got unexpected answer: ${JSON.stringify(data.answer)}`)
      }
    }
  }

  _onScrapeResponse(data: any): void {
    data = data.files || {}
    const keys = Object.keys(data)
    if (keys.length === 0) {
      this.client.emit('warning', new Error('invalid scrape response'))
      return
    }
    keys.forEach((infoHash) => {
      const response = Object.assign(data[infoHash], {
        announce: this.announceUrl,
        infoHash: bin2hex(infoHash),
      })
      this.client.emit('scrape', response)
    })
  }

  _onSocketClose(): void {
    if (this.destroyed) return
    this.destroy()
    this._startReconnectTimer()
  }

  _onSocketError(err: Error): void {
    if (this.destroyed) return
    this.destroy()
    this.client.emit('warning', err)
    this._startReconnectTimer()
  }

  _startReconnectTimer(): void {
    const ms =
      Math.floor(Math.random() * RECONNECT_VARIANCE) +
      Math.min(Math.pow(2, this.retries) * RECONNECT_MINIMUM, RECONNECT_MAXIMUM)
    this.reconnecting = true
    clearTimeout(this.reconnectTimer!)
    this.reconnectTimer = setTimeout(() => {
      this.retries++
      this._openSocket()
    }, ms)
    if (this.reconnectTimer.unref) this.reconnectTimer.unref()
    debug('reconnecting socket in %s ms', ms)
  }

  _send(params: any): void {
    if (this.destroyed) return
    this.expectingResponse = true
    const message = JSON.stringify(params)
    debug('send %s', message)
    this.socket.send(message)
  }

  _generateOffers(numwant: number, cb: (offers: any[]) => void): void {
    const self = this
    const offers: any[] = []
    debug('generating %s offers', numwant)
    for (let i = 0; i < numwant; ++i) {
      generateOffer()
    }
    checkDone()
    function generateOffer() {
      const offerId = arr2hex(randomBytes(20))
      debug('creating peer (from _generateOffers)')
      const peer = (self.peers[offerId] = self._createPeer({
        initiator: true,
      }))
      peer.once('signal', (offer: any) => {
        offers.push({ offer, offer_id: hex2bin(offerId) })
        checkDone()
      })
      peer.trackerTimeout = setTimeout(() => {
        debug('tracker timeout: destroying peer')
        peer.trackerTimeout = null
        delete self.peers[offerId]
        peer.destroy()
      }, OFFER_TIMEOUT)
      if (peer.trackerTimeout.unref) peer.trackerTimeout.unref()
    }
    function checkDone() {
      if (offers.length === numwant) {
        debug('generated %s offers', numwant)
        cb(offers)
      }
    }
  }

  _createPeer(opts: any = {}): any {
    const self = this
    opts = Object.assign(
      {
        trickle: false,
        config: self.client.rtcConfig,
        wrtc: self.client.wrtc,
      },
      opts
    )
    const peer = new Peer(opts)
    peer.once('error', onError)
    peer.once('connect', onConnect)
    return peer
    function onError(err: Error) {
      self.client.emit('warning', new Error(`Connection error: ${err.message}`))
      peer.destroy()
    }
    function onConnect() {
      peer.removeListener('error', onError)
      peer.removeListener('connect', onConnect)
    }
  }
}

function noop() {}
