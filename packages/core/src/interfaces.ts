/**
 * Platform-agnostic interfaces for z-torrent.
 * Implementations are provided by z-torrent-node, z-torrent-browser, z-torrent-bun.
 */

/** Chunk storage abstraction — read/write piece data */
export interface ChunkStore {
  get(
    index: number,
    opts: { offset?: number; length?: number },
    cb: (err: Error | null, chunk?: Uint8Array) => void
  ): void
  put(
    index: number,
    chunk: Uint8Array,
    opts: Record<string, unknown>,
    cb: (err?: Error) => void
  ): void
  close(cb: () => void): void
  destroy?(cb: () => void): void
}

/** Chunk store constructor — (pieceLength, opts) => ChunkStore */
export type ChunkStoreConstructor = new (
  pieceLength: number,
  opts: Record<string, unknown>
) => ChunkStore

/** Peer discovery — trackers, DHT, LSD, etc. */
export interface Discovery {
  on(event: string, fn: (...args: unknown[]) => void): void
  removeListener(event: string, fn: (...args: unknown[]) => void): void
  destroy(): void
  complete(opts?: object): void
}

/** Options for createDiscovery */
export interface DiscoveryOptions {
  infoHash: string
  peerId: string
  port: number
  announce?: string[]
  dht?: boolean | object
  dhtPort?: number
  lsd?: boolean
  tracker?: boolean | object
  userAgent?: string
  intervalMs?: number
}

/** Connection pool — TCP/uTP listeners for incoming peers */
export interface ConnectionPool {
  address(): { address: string; port: number } | null
  destroy(cb: () => void): void
}

/** TCP/uTP pool as wired into WebTorrentCore (optional `tcpServer` for port mapping). */
export interface ConnectionPoolInstance extends ConnectionPool {
  tcpServer?: { address: () => { address: string; port: number; family?: string } }
}

/** DHT client API used by WebTorrentCore (not the same as swarm `Discovery`). */
export interface DHTInstance {
  once(event: string, fn: (...args: unknown[]) => void): void
  listen(port: number): void
  destroy(cb: () => void): void
  address(): { port: number } | null
  setMaxListeners?(n: number): void
  removeTorrentRoutingTable?(infoHash: unknown): void
}

/** UPnP/NAT-PMP helper used by WebTorrentCore. */
export interface NatTraversalInstance {
  map(opts: Record<string, unknown>): Promise<void>
  destroy(): Promise<void>
}

/** HTTP/streaming server for serving torrent content */
export interface Server {
  destroy(cb: () => void): void
}

/** Server options for createServer (browser SW `controller` lives in platform-specific types). */
export interface ServerOptions {
  origin?: string | false
  hostname?: string
  pathname?: string
}

/** Platform adapter — injects platform-specific implementations into core */
export interface PlatformAdapter {
  /** Default chunk store constructor */
  defaultStore: ChunkStoreConstructor
  /** Temp directory path for downloads */
  tmpDir: string
  /** Max concurrent filesystem operations for verification */
  fsConcurrency: number
  /** UTP support flag */
  utpSupport: boolean
  /** requestIdleCallback or equivalent for _update batching (null = sync) */
  idleCallback: ((cb: () => void, opts?: { timeout?: number }) => void) | null

  /** Create TCP/UTP connection pool (null in browser) */
  createConnPool?(client: unknown): ConnectionPool | null
  /** Create HTTP/SW server */
  createServer(client: unknown, opts: ServerOptions): Server
  /** Create DHT instance (null in browser) */
  createDHT?(opts: Record<string, unknown>): DHTInstance | null
  /** Load IP blocklist (null in browser) */
  loadIPSet?(blocklist: unknown, opts: Record<string, unknown>, cb: (err: Error | null, ipSet?: unknown) => void): void
  /** NAT traversal (null in browser) */
  createNatTraversal?(opts: Record<string, unknown>): NatTraversalInstance | null
  /** Connect to peer via TCP/UTP (null in browser, returns connection object) */
  connectPeer?(opts: { host: string; port: number }, type: 'tcp' | 'utp', client: unknown): unknown
  /** Create peer discovery (trackers, DHT, LSD). Required. */
  createDiscovery(opts: DiscoveryOptions): Discovery
  /** Check if running in browser (for createServer branch) */
  isBrowser?: boolean
}
