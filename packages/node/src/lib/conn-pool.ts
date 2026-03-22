import net from 'net'
import debugFactory from 'debug'

import { Peer } from '@z-torrent/core'

import utp from './utp.cjs'

const debug = debugFactory('webtorrent:conn-pool')

export class ConnPool {
  #client: any
  #pendingConns: Set<net.Socket | any>
  #onTCPConnectionBound: (conn: net.Socket) => void
  #onUTPConnectionBound: (conn: any) => void
  #onListening: () => void
  #onTCPError: (err: Error) => void
  #onUTPError: (err: Error) => void
  tcpServer: net.Server | null
  utpServer: any = null

  constructor(client: any) {
    debug('create pool (port %s)', client.torrentPort)

    this.#client = client

    this.#pendingConns = new Set()

    this.#onTCPConnectionBound = (conn: net.Socket) => {
      this.#onConnection(conn, 'tcp')
    }

    this.#onUTPConnectionBound = (conn: any) => {
      this.#onConnection(conn, 'utp')
    }

    this.#onListening = () => {
      this.#client.notifyListening()
    }

    this.#onTCPError = (err: Error) => {
      this.#client.shutdownWithError(err)
    }

    this.#onUTPError = (err: Error) => {
      this.#client.utp = false
      this.#client.emit('error', err)
      if (!this.#client.listening) this.#onListening()
    }

    const tcp = net.createServer()
    this.tcpServer = tcp
    tcp.on('connection', this.#onTCPConnectionBound)
    tcp.on('error', this.#onTCPError)

    tcp.listen(client.torrentPort, () => {
      const addr = tcp.address() as net.AddressInfo
      debug('creating tcpServer in port %s', addr.port)
      if (this.#client.utp) {
        this.utpServer = utp.createServer()
        this.utpServer.on('connection', this.#onUTPConnectionBound)
        this.utpServer.on('listening', this.#onListening)
        this.utpServer.on('error', this.#onUTPError)

        debug('creating utpServer in port %s', addr.port)
        this.utpServer.listen(addr.port)
      } else {
        this.#onListening()
      }
    })
  }

  destroy(cb?: () => void): void {
    debug('destroy conn pool')

    if (this.utpServer) {
      this.utpServer.removeListener('connection', this.#onUTPConnectionBound)
      this.utpServer.removeListener('listening', this.#onListening)
      this.utpServer.removeListener('error', this.#onUTPError)
    }

    const srv = this.tcpServer
    if (srv) {
      srv.removeListener('connection', this.#onTCPConnectionBound)
      srv.removeListener('error', this.#onTCPError)
    }

    this.#pendingConns.forEach((conn: any) => {
      conn.on('error', noop)
      conn.destroy()
    })

    if (this.utpServer) {
      try {
        this.utpServer.close(cb)
      } catch {
        if (cb) queueMicrotask(cb)
      }
    }

    if (srv) {
      try {
        srv.close(cb)
      } catch {
        if (cb) queueMicrotask(cb)
      }
    }

    this.tcpServer = null
    this.utpServer = null
    this.#client = null
    this.#pendingConns = new Set()
  }

  address(): { address: string; port: number } | null {
    const s = this.tcpServer
    if (!s) return null
    const a = s.address()
    if (a === null || typeof a === 'string') return null
    return { address: a.address, port: a.port }
  }

  #onConnection(conn: net.Socket | any, type: 'tcp' | 'utp'): void {
    const self = this

    if (!conn.remoteAddress) {
      conn.on('error', noop)
      conn.destroy()
      return
    }

    self.#pendingConns.add(conn)
    conn.once('close', cleanupPending)

    const peer =
      type === 'utp'
        ? Peer.createUTPIncomingPeer(conn, this.#client.throttleGroups)
        : Peer.createTCPIncomingPeer(conn, this.#client.throttleGroups)

    const wire = peer.wire
    if (!wire) {
      conn.destroy()
      return
    }
    const wireEvents = wire as unknown as {
      once(event: string, fn: (...args: unknown[]) => void): void
      removeListener(event: string, fn: (...args: unknown[]) => void): void
    }

    async function onPe3(infoHashHash: string): Promise<void> {
      const torrent = await self.#client.getTorrentByPe3Hash(infoHashHash)
      if (torrent) {
        peer.swarm = torrent
        torrent.acceptIncomingPeer(peer)
        peer.onPe3(infoHashHash)
      } else {
        peer.destroy(
          new Error(`Unexpected info hash hash ${infoHashHash} from incoming peer ${peer.id}`)
        )
      }
    }

    async function onHandshake(infoHash: string, peerId: string): Promise<void> {
      cleanupPending()

      const torrent = await self.#client.get(infoHash)
      if (torrent) {
        if (!peer.swarm) {
          peer.swarm = torrent
          torrent.acceptIncomingPeer(peer)
        }
        peer.onHandshake(infoHash, peerId)
      } else {
        const err = new Error(`Unexpected info hash ${infoHash} from incoming peer ${peer.id}`)
        peer.destroy(err)
      }
    }

    const onHandshakeBound = (...args: unknown[]) => {
      void onHandshake(args[0] as string, args[1] as string)
    }

    wireEvents.once('pe3', (...args: unknown[]) => {
      void onPe3(args[0] as string)
    })
    wireEvents.once('handshake', onHandshakeBound)

    function cleanupPending(): void {
      conn.removeListener('close', cleanupPending)
      wireEvents.removeListener('handshake', onHandshakeBound)
      self.#pendingConns.delete(conn)
    }
  }

  static UTP_SUPPORT = typeof utp?.createServer === 'function'
}

function noop(): void {}
