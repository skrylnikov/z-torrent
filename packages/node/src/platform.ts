/**
 * Node.js platform adapter for z-torrent-core.
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import net from 'net'
import { Client as DHT } from '@z-torrent/dht'
import { loadIPSet } from '@z-torrent/utils/load-ip-set'
import NatAPI from '@silentbot1/nat-api'
import FSChunkStore from 'fs-chunk-store'
import cpus from 'cpus'
import Discovery from '@z-torrent/discovery'

import ConnPool from './lib/conn-pool.js'
import { NodeServer } from './lib/server.js'
import type {
  PlatformAdapter,
  ServerOptions,
  ChunkStoreConstructor,
  DiscoveryOptions,
} from '@z-torrent/core'

let TMP: string
try {
  TMP = path.join(fs.statSync('/tmp') && '/tmp', 'z-torrent')
} catch {
  TMP = path.join(typeof os.tmpdir === 'function' ? os.tmpdir() : '/', 'z-torrent')
}

export function createNodePlatformAdapter(): PlatformAdapter {
  return {
    defaultStore: FSChunkStore as ChunkStoreConstructor,
    tmpDir: TMP,
    fsConcurrency: cpus().length,
    utpSupport: ConnPool.UTP_SUPPORT,
    idleCallback: null,

    createConnPool(client) {
      return new ConnPool(client)
    },

    createServer(client, opts) {
      return new NodeServer(client, opts)
    },

    createDHT(opts) {
      return new DHT(opts as any)
    },

    loadIPSet(blocklist, opts, cb) {
      loadIPSet(blocklist, opts, cb)
    },

    createNatTraversal(opts) {
      return new NatAPI(opts as any)
    },

    connectPeer(opts, type, client) {
      const utp = require('./lib/utp.cjs')
      if (type === 'utp') {
        return utp.connect(opts.port, opts.host)
      }
      return net.connect(opts)
    },

    createDiscovery(opts: DiscoveryOptions) {
      return new Discovery({
        infoHash: opts.infoHash,
        peerId: opts.peerId,
        port: opts.port,
        announce: opts.announce,
        dht: opts.dht,
        dhtPort: opts.dhtPort,
        lsd: opts.lsd,
        tracker: opts.tracker,
        userAgent: opts.userAgent,
        intervalMs: opts.intervalMs,
      })
    },

    isBrowser: false,
  }
}
