/*! z-torrent-browser. MIT License. */

import SimplePeerLite from '@thaunknown/simple-peer/lite.js'
import type { ServerOptions } from '@z-torrent/core'
import { WebTorrentCore, FileIterator, VERSION } from '@z-torrent/core'
import { createBrowserPlatformAdapter } from './platform.js'
import type { BrowserServerOptions } from './lib/server.js'

export { FileIterator, Torrent, Peer, RarityMap, WebConn, ServerBase, File } from '@z-torrent/core'

export class WebTorrent extends WebTorrentCore {
  static WEBRTC_SUPPORT = SimplePeerLite.WEBRTC_SUPPORT
  static UTP_SUPPORT = false
  static VERSION = VERSION

  constructor(opts: Record<string, unknown> = {}) {
    const platform = createBrowserPlatformAdapter()
    super({
      ...opts,
      platform,
    })
  }

  override createServer(options: BrowserServerOptions): unknown {
    return super.createServer(options as ServerOptions)
  }
}
