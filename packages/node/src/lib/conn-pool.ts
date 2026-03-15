import net from 'net'
import debugFactory from 'debug'

import { Peer } from '@z-torrent/core'

import utp from './utp.cjs'

const debug = debugFactory('webtorrent:conn-pool')

export default class ConnPool {
  private _client: any
  private _pendingConns: Set<net.Socket | any>
  private _onTCPConnectionBound: (conn: net.Socket) => void
  private _onUTPConnectionBound: (conn: any) => void
  private _onListening: () => void
  private _onTCPError: (err: Error) => void
  private _onUTPError: (err: Error) => void
  tcpServer: net.Server
  utpServer: any

  constructor(client: any) {
    debug('create pool (port %s)', client.torrentPort)

    this._client = client

    this._pendingConns = new Set()

    this._onTCPConnectionBound = (conn: net.Socket) => {
      this._onConnection(conn, 'tcp')
    }

    this._onUTPConnectionBound = (conn: any) => {
      this._onConnection(conn, 'utp')
    }

    this._onListening = () => {
      this._client._onListening()
    }

    this._onTCPError = (err: Error) => {
      this._client._destroy(err)
    }

    this._onUTPError = (err: Error) => {
      this._client.utp = false
      this._client.emit('error', err)
      if (!this._client.listening) this._onListening()
    }

    // Setup TCP
    this.tcpServer = net.createServer()
    this.tcpServer.on('connection', this._onTCPConnectionBound)
    this.tcpServer.on('error', this._onTCPError)

    // Start TCP
    this.tcpServer.listen(client.torrentPort, () => {
      debug('creating tcpServer in port %s', (this.tcpServer.address() as any).port)
      if (this._client.utp) {
        // Setup uTP
        this.utpServer = utp.createServer()
        this.utpServer.on('connection', this._onUTPConnectionBound)
        this.utpServer.on('listening', this._onListening)
        this.utpServer.on('error', this._onUTPError)

        // Start uTP
        debug('creating utpServer in port %s', (this.tcpServer.address() as any).port)
        this.utpServer.listen((this.tcpServer.address() as any).port)
      } else {
        this._onListening()
      }
    })
  }

  destroy(cb?: () => void): void {
    debug('destroy conn pool')

    if (this.utpServer) {
      this.utpServer.removeListener('connection', this._onUTPConnectionBound)
      this.utpServer.removeListener('listening', this._onListening)
      this.utpServer.removeListener('error', this._onUTPError)
    }

    this.tcpServer.removeListener('connection', this._onTCPConnectionBound)
    this.tcpServer.removeListener('error', this._onTCPError)

    // Destroy all open connection objects so server can close gracefully without waiting
    // for connection timeout or remote peer to disconnect.
    this._pendingConns.forEach((conn: any) => {
      conn.on('error', noop)
      conn.destroy()
    })

    if (this.utpServer) {
      try {
        this.utpServer.close(cb)
      } catch (err) {
        if (cb) queueMicrotask(cb)
      }
    }

    try {
      this.tcpServer.close(cb)
    } catch (err) {
      if (cb) queueMicrotask(cb)
    }

    ;(this as any).tcpServer = null
    ;(this as any).utpServer = null
    this._client = null
    this._pendingConns = null as any
  }

  private _onConnection(conn: net.Socket | any, type: 'tcp' | 'utp'): void {
    const self = this

    // If the connection has already been closed before the `connect` event is fired,
    // then `remoteAddress` will not be available, and we can't use this connection.
    // - Node.js issue: https://github.com/nodejs/node-v0.x-archive/issues/7566
    // - WebTorrent issue: https://github.com/webtorrent/webtorrent/issues/398
    if (!conn.remoteAddress) {
      conn.on('error', noop)
      conn.destroy()
      return
    }

    self._pendingConns.add(conn)
    conn.once('close', cleanupPending)

    const peer =
      type === 'utp'
        ? Peer.createUTPIncomingPeer(conn, this._client.throttleGroups)
        : Peer.createTCPIncomingPeer(conn, this._client.throttleGroups)

    const wire = peer.wire
    wire.once('pe3', onPe3)
    wire.once('handshake', onHandshake)

    async function onPe3(infoHashHash: string): Promise<void> {
      const torrent = await self._client._getByHash(infoHashHash)
      if (torrent) {
        peer.swarm = torrent
        torrent._addIncomingPeer(peer)
        peer.onPe3(infoHashHash)
      } else {
        peer.destroy(
          new Error(`Unexpected info hash hash ${infoHashHash} from incoming peer ${peer.id}`)
        )
      }
    }

    async function onHandshake(infoHash: string, peerId: string): Promise<void> {
      cleanupPending()

      const torrent = await self._client.get(infoHash)
      // only add incoming peer if didn't already do so in protocol encryption handshake
      if (torrent) {
        if (!peer.swarm) {
          peer.swarm = torrent
          torrent._addIncomingPeer(peer)
        }
        peer.onHandshake(infoHash, peerId)
      } else {
        const err = new Error(`Unexpected info hash ${infoHash} from incoming peer ${peer.id}`)
        peer.destroy(err)
      }
    }

    function cleanupPending(): void {
      conn.removeListener('close', cleanupPending)
      wire.removeListener('handshake', onHandshake)
      if (self._pendingConns) {
        self._pendingConns.delete(conn)
      }
    }
  }

  static UTP_SUPPORT = typeof utp?.createServer === 'function'
}

function noop(): void {}
