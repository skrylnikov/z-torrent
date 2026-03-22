import arrayRemove from 'unordered-array-remove'
import Debug from 'debug'
import { EventEmitter } from 'eventemitter3'
import { LRUCache } from 'lru-cache'
import randomIterate from 'random-iterate'
import type { WebSocket } from 'ws'

const debug = Debug('@z-torrent/tracker:swarm')

interface PeerData {
  type: 'http' | 'udp' | 'ws'
  complete: boolean
  peerId: string
  ip?: string
  port?: number
  socket?: WebSocket & { infoHashes?: string[]; destroyed?: boolean }
}

interface AnnounceParams {
  type: 'http' | 'udp' | 'ws'
  event: 'started' | 'stopped' | 'completed' | 'update' | 'paused'
  numwant: number
  peer_id: string
  addr?: string
  ip?: string
  port?: number
  left?: number
  socket?: WebSocket
}

interface AnnounceResponse {
  complete: number
  incomplete: number
  peers: PeerData[]
}

interface ScrapeResponse {
  complete: number
  incomplete: number
}

interface ServerLike {
  peersCacheLength?: number
  peersCacheTtl?: number
}

/**
 * LRU peer map with the same surface as the former `lru` package:
 * `length`, `keys`, `get` / `set` / `peek` / `delete`, and `evict` events.
 */
class PeersCache extends EventEmitter {
  readonly #cache: LRUCache<string, PeerData>

  constructor(
    max: number,
    ttlMs: number,
    onEvictOrExpire: (peer: PeerData, id: string) => void
  ) {
    super()
    this.#cache = new LRUCache<string, PeerData>({
      max,
      ttl: ttlMs,
      // Run after the triggering `set()` finishes so eviction + insert are atomic
      // (matches ordering assumptions of WS announce / offer relay).
      disposeAfter: (peer, id, reason) => {
        if (reason !== 'evict' && reason !== 'expire') return
        onEvictOrExpire(peer, id)
        this.emit('evict', { key: id, value: peer })
      },
    })
  }

  get length(): number {
    return this.#cache.size
  }

  /** Snapshot of keys (new array each read), like the old `lru` getter. */
  get keys(): string[] {
    return [...this.#cache.keys()]
  }

  get(id: string): PeerData | undefined {
    return this.#cache.get(id)
  }

  set(id: string, peer: PeerData): void {
    this.#cache.set(id, peer)
  }

  delete(id: string): void {
    this.#cache.delete(id)
  }

  peek(id: string): PeerData | undefined {
    return this.#cache.peek(id)
  }
}

export class Swarm {
  infoHash!: string
  complete!: number
  incomplete!: number
  peers!: PeersCache

  constructor(infoHash: string, server: ServerLike) {
    const self = this
    self.infoHash = infoHash
    self.complete = 0
    self.incomplete = 0

    self.peers = new PeersCache(
      server.peersCacheLength || 1000,
      server.peersCacheTtl || 20 * 60 * 1000,
      (peer, id) => {
        const params: AnnounceParams = {
          type: peer.type,
          event: 'stopped',
          numwant: 0,
          peer_id: peer.peerId,
        }
        self._onAnnounceStopped(params, peer, id)
        peer.socket = undefined
      }
    )
  }

  announce(
    params: AnnounceParams,
    cb: (err: Error | null, response?: AnnounceResponse) => void
  ): void {
    const self = this
    const id = params.type === 'ws' ? params.peer_id : params.addr!
    const peer = self.peers.get(id)

    if (params.event === 'started') {
      self._onAnnounceStarted(params, peer, id)
    } else if (params.event === 'stopped') {
      self._onAnnounceStopped(params, peer, id)
      if (!cb) return
    } else if (params.event === 'completed') {
      self._onAnnounceCompleted(params, peer, id)
    } else if (params.event === 'update') {
      self._onAnnounceUpdate(params, peer, id)
    } else if (params.event === 'paused') {
      self._onAnnouncePaused(params, peer, id)
    } else {
      cb(new Error('invalid event'))
      return
    }
    cb(null, {
      complete: self.complete,
      incomplete: self.incomplete,
      peers: self._getPeers(params.numwant, params.peer_id, !!params.socket),
    })
  }

  scrape(_params: unknown, cb: (err: null, response: ScrapeResponse) => void): void {
    cb(null, {
      complete: this.complete,
      incomplete: this.incomplete,
    })
  }

  _onAnnounceStarted(params: AnnounceParams, peer: PeerData | undefined, id: string): void {
    if (peer) {
      debug('unexpected `started` event from peer that is already in swarm')
      return this._onAnnounceUpdate(params, peer, id)
    }

    if (params.left === 0) this.complete += 1
    else this.incomplete += 1
    this.peers.set(id, {
      type: params.type,
      complete: params.left === 0,
      peerId: params.peer_id,
      ip: params.ip,
      port: params.port,
      socket: params.socket as PeerData['socket'],
    })
  }

  _onAnnounceStopped(_params: AnnounceParams, peer: PeerData | undefined, id: string): void {
    if (!peer) {
      debug('unexpected `stopped` event from peer that is not in swarm')
      return
    }

    if (peer.complete) this.complete -= 1
    else this.incomplete -= 1

    if (peer.socket && !peer.socket.destroyed) {
      const index = peer.socket.infoHashes!.indexOf(this.infoHash)
      arrayRemove(peer.socket.infoHashes!, index)
    }

    this.peers.delete(id)
  }

  _onAnnounceCompleted(params: AnnounceParams, peer: PeerData | undefined, id: string): void {
    if (!peer) {
      debug('unexpected `completed` event from peer that is not in swarm')
      return this._onAnnounceStarted(params, peer, id)
    }
    if (peer.complete) {
      debug('unexpected `completed` event from peer that is already completed')
      return this._onAnnounceUpdate(params, peer, id)
    }

    this.complete += 1
    this.incomplete -= 1
    peer.complete = true
    this.peers.set(id, peer)
  }

  _onAnnounceUpdate(params: AnnounceParams, peer: PeerData | undefined, id: string): void {
    if (!peer) {
      debug('unexpected `update` event from peer that is not in swarm')
      return this._onAnnounceStarted(params, peer, id)
    }

    if (!peer.complete && params.left === 0) {
      this.complete += 1
      this.incomplete -= 1
      peer.complete = true
    }
    this.peers.set(id, peer)
  }

  _onAnnouncePaused(params: AnnounceParams, peer: PeerData | undefined, id: string): void {
    if (!peer) {
      debug('unexpected `paused` event from peer that is not in swarm')
      return this._onAnnounceStarted(params, peer, id)
    }

    this._onAnnounceUpdate(params, peer, id)
  }

  _getPeers(numwant: number, ownPeerId: string, isWebRTC: boolean): PeerData[] {
    const peers: PeerData[] = []
    const ite = randomIterate(this.peers.keys)
    let peerId: string | undefined
    while ((peerId = ite()) && peers.length < numwant) {
      const peer = this.peers.peek(peerId)
      if (!peer) continue
      if (isWebRTC && peer.peerId === ownPeerId) continue
      if ((isWebRTC && peer.type !== 'ws') || (!isWebRTC && peer.type === 'ws')) continue
      peers.push(peer)
    }
    return peers
  }
}
