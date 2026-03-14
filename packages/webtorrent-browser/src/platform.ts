/**
 * Browser platform adapter for z-torrent-core.
 */

import MemoryChunkStore from 'memory-chunk-store'
import { BrowserServer } from './lib/server.js'
import BrowserDiscovery from './lib/browser-discovery.js'
import type { PlatformAdapter, ServerOptions, ChunkStoreConstructor, DiscoveryOptions } from '../../z-torrent-core/src/index.js'

const IDLE_CALLBACK =
  typeof (globalThis as any).requestIdleCallback === 'function'
    ? (globalThis as any).requestIdleCallback
    : null

export function createBrowserPlatformAdapter(): PlatformAdapter {
  return {
    defaultStore: MemoryChunkStore as ChunkStoreConstructor,
    tmpDir: '/',
    fsConcurrency: 2,
    utpSupport: false,
    idleCallback: IDLE_CALLBACK,

    createConnPool: undefined,
    createServer(client, opts) {
      return new BrowserServer(client, opts)
    },
    createDHT: undefined,
    loadIPSet: undefined,
    createNatTraversal: undefined,
    connectPeer: undefined,

    createDiscovery(opts: DiscoveryOptions) {
      return new BrowserDiscovery(opts)
    },

    isBrowser: true,
  }
}
