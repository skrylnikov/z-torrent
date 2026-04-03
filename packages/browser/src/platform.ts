/**
 * Browser platform adapter for z-torrent-core.
 */

import { IDBChunkStore } from '@z-torrent/utils/idb-chunk-store'
import { BrowserServer, type BrowserServerOptions } from './lib/server.js'
import { BrowserDiscovery } from './lib/browser-discovery.js'
import type { PlatformAdapter, DiscoveryOptions, ClientWithTorrents } from '@z-torrent/core'

const IDLE_CALLBACK =
  typeof (globalThis as typeof globalThis & { requestIdleCallback?: typeof requestIdleCallback })
    .requestIdleCallback === 'function'
    ? (globalThis as typeof globalThis & { requestIdleCallback: typeof requestIdleCallback })
        .requestIdleCallback
    : null

export function createBrowserPlatformAdapter(): PlatformAdapter {
  return {
    defaultStore: IDBChunkStore,
    tmpDir: '/',
    fsConcurrency: 2,
    utpSupport: false,
    idleCallback: IDLE_CALLBACK,

    createConnPool: undefined,
    createServer(client, opts) {
      return new BrowserServer(client as ClientWithTorrents, opts as BrowserServerOptions)
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
